# Storage Architecture Plan

Status: **proposal** — not yet implemented.

This document describes how VDIO Touch should manage local disk so that a burst of
concurrent uploads cannot exhaust the host, while preserving the two properties the
current design is built around:

1. **Fast time-to-playable** — an asset becomes watchable as soon as its lowest
   rendition lands, not when the full ladder completes.
2. **Independent rendition workers** — four `process-video-worker` containers, one per
   resolution, separately schedulable and separately scalable (including onto GPU nodes).

Neither of those changes. What changes is *when bytes are allowed onto local disk*.

---

## 1. The problem

`server/docker-compose.yml` bind-mounts one shared host directory (`./temp_videos`) into
the API and all six workers, on the same disk as Docker, Mongo and Redis. Every asset
accumulates its source, four rendition trees, a remuxed MP4 and extracted audio there.

Peak footprint is roughly **2× the source file**, and disk is the only resource in the
pipeline with **no admission control**: CPU is bounded by `cpuset`, job concurrency is
bounded by BullMQ, but any number of assets can deposit bytes simultaneously. Queue depth
is unbounded, so arrival rate is decoupled from drain rate and the gap lands on disk.

On a 5 GB host with ~2.5 GB usable scratch, five concurrent 1 GB uploads need ~9.8 GB.
The host fills, and because scratch shares a volume with Mongo and Docker, the whole
stack dies rather than merely stalling.

---

## 2. Bugs that make it worse

These are defects in the current code, independent of the redesign. Several should be
fixed regardless of whether the rest of this plan is adopted.

| # | Location | Defect |
|---|---|---|
| B1 | `cleanup.service.ts:20-22` | `allDirectories.map(d => ObjectId(d.name))` runs over **files as well as directories**, before any `isDirectory()` filter. One stray entry (`.DS_Store`, a `.partial`) throws and **aborts the entire sweep**. Cleanup can appear scheduled and healthy while deleting nothing, on every run. |
| B2 | `cleanup.service.ts:14-18` | `FILE_STATUS.FAILED` is included in `activeDirectories`. FAILED is terminal, not active, so **an asset with one failed thumbnail is skipped forever**. |
| B3 | `cleanup.service.ts:28-30` | An asset absent from Mongo hits `continue`; orphaned directories are never removed. |
| B4 | `asset.service.ts:104` | `checkForDeleteLocalAssetFile` is **dead code** — never called from anywhere. The only in-process deletion is the FAILED branch at `asset.service.ts:143`. |
| B5 | `asset.service.ts:117-123` | `checkForAssetFailedStatus` only inspects `type: PLAYLIST`, so thumbnail/audio/transcript failures never propagate to asset status. |
| B6 | `process-video.worker.ts:10`, `download-file-generation.worker.ts:9` | `lockDuration: 1000 * 60 * 60 * 1` is **1 hour**; the trailing comment claims 2. A transcode exceeding it is redelivered, so a second ffmpeg writes the same output directory — corrupt segments and double disk. |
| B7 | `video-touch-common` `terminal()` | **Verify** whether it wraps `execSync`. If it blocks the event loop, BullMQ lock renewal never fires and *every* long job stalls and duplicates, regardless of `lockDuration`. |
| B8 | `downloader-http.service.ts:37` | Size cap compares against `content-length`. Absent on chunked responses → `undefined > n` is `false` → **cap silently does not apply**. |
| B9 | `tus.service.ts:12-45` | The tus `Server` construction is entirely commented out. Browser upload is currently broken, and the `MAX_VIDEO_SIZE_IN_BYTES` guard lives inside the commented block. |

### Verify B1 first

```bash
ls -a <TEMP_VIDEO_DIRECTORY> | grep -v '^[0-9a-f]\{24\}$'
curl -s -o /dev/null -w "%{http_code}\n" -X POST localhost:4000/api/v1/cron-jobs/cleanup-device
```

A 500 means cleanup has never succeeded, and B1 alone may account for the observed
disk exhaustion.

---

## 3. Design principles

**P1 — Ingest never touches disk.** Streaming an HTTP response straight into object
storage costs a few MB of buffer, not the file size. Source bytes have no reason to be
written down.

**P2 — Disk is a scheduled resource with a byte budget.** Not a job count. A 100 MB clip
and a 4 GB master cost very different amounts; the budget must be denominated in bytes so
mixed workloads self-balance.

**P3 — Peak disk must be independent of arrival rate.** It should depend only on what is
*admitted*, never on what *arrives*. Ten links or ten thousand produce the same peak.

**P4 — Every held resource is a lease, not a reservation.** Anything held without a
renewable expiry will eventually leak. Enumerating failure modes does not work; requiring
continued justification does.

**P5 — Provider-neutral.** This is self-hosted software run against S3, Bunny or R2 on
hardware ranging from a 5 GB VPS to a large dedicated box. No strategy may depend on one
provider's pricing (R2's free egress) or capabilities (Bunny has no presigned URLs and no
multipart upload).

**P6 — Optimize for time-to-playable, let HD fill in behind.** This is already the
system's behaviour and it must survive the redesign.

---

## 4. Target pipeline

```
                                                              DISK USED
link / upload
  └─ ingest worker:   origin ──stream──→ object storage           0
  └─ validate:        ffprobe against read handle                 0
  └─ ★ ADMISSION GATE (bytes)                                     0
  │
  ├─ PASS A ── fetch source → scratch                           1× source
  │            └─ 360p ──→ upload ──→ asset READY (playable)
  │            └─ thumbnail
  │            release source if budget is tight
  │
  └─ PASS B ── (re-)admit, source in scratch                    1× source
               ├─ 480p ┐
               ├─ 720p ├─ all read the SAME local copy   → 1× egress
               ├─1080p ┤
               ├─ audio┤
               └─ download remux (from largest rendition)
               all files terminal → release lease, delete scratch
```

### Why two passes

Gating at asset granularity bounds the expensive resource (the source, resident for the
whole ~20 min run) but accidentally bounds the cheap one too. The 360p worker finishes in
~2 min and would then idle for 18, waiting for permission to start the next asset —
and because the asset goes READY on its first rendition, that directly delays
time-to-playable for every queued video.

Pass A holds the source for ~2–4 min instead of ~20 — a **5–10× smaller disk-seconds
cost** — so the whole backlog can stream through it quickly while pass B grinds at
whatever rate the 1080p worker allows.

For 10 × 1 GB on ~2.5 GB of scratch:

| | all playable | all fully done |
|---|---|---|
| asset-level gating | ~3.3 h | 3.3 h |
| **two-pass** | **~40 min** | 3.3 h |

Total throughput is unchanged — 1080p is still the bottleneck — but time-to-playable
stops being hostage to it.

### Why a single fetch rather than streaming per worker

Six consumers read the source (four renditions, thumbnail, audio). Streaming each from
storage means **6× egress**, which is free on R2 and same-region S3 but billed on Bunny
and cross-region S3 (~$0.54/asset). Fetching once into the shared scratch volume gives
**1× egress on every provider** (P5), and is also faster and more reliable — ffmpeg
reading MP4 over HTTP must range-request the `moov` atom, often at the end of the file,
and six concurrent readers multiply that fragility.

### Why fetch-then-dispatch rather than a lock

The four rendition jobs dispatch within milliseconds of each other. Coordinating them
with a lockfile would leave three of four containers idle-blocked (each has
`concurrency: 1`), and stale locks from crashed workers require timeout heuristics.

Fetching as a **discrete job whose completion triggers dispatch** means exactly one
downloader by construction: no lock, no polling, retries and observability for free from
BullMQ, and a clean failure path (fetch fails → asset FAILED → nothing downstream was
ever dispatched).

---

## 5. State machine

### New status

| Status | Meaning |
|---|---|
| `PREPARING` | Admitted; source is being fetched from object storage into scratch. |

`ON_HOLD` already exists in `VIDEO_STATUS` and is referenced nowhere in the API. It now
means *waiting for byte budget*.

### New asset fields

| Field | Values | Purpose |
|---|---|---|
| `pipeline_phase` | `FAST` \| `HD` \| `COMPLETE` | Which pass the asset is in or waiting for. |
| `source_key` | string | Storage key of the source object. |
| `hold_since` | Date | Set when entering `ON_HOLD`; drives aging (§7). |

Using a field rather than more enum values keeps `video-touch-common` churn to one
addition — relevant because the package version is already scattered across packages
(api and two workers `^5.0.0`, `process-video` pinned `5.0.1`, `audio` `^4.4.0`,
`download`/`validate` `^1.0.0`) and every change forces a coordinated bump.

### Transitions

```
  QUEUED / UPLOAD_PENDING
        │  ingest worker: origin ──stream──→ storage
        ▼
  DOWNLOADING ──→ DOWNLOADED            (source in storage, no local copy)
        │  validate worker: ffprobe via read handle
        ▼
  VALIDATED
        │  ┌─ budget unavailable ─→ ON_HOLD (pipeline_phase=FAST, hold_since=now)
        │  │                            └─ admitter ─→ PREPARING
        └──┴─ budget available ────→ PREPARING
        │  source-fetch job: storage ──→ scratch
        ▼
  PROCESSING          pipeline_phase=FAST
        │  create thumbnail File + fastest-rendition playlist File only
        │  360p uploads → checkForAssetReadyStatus
        ▼
  READY               ← playable
        │  pass A complete
        │  ┌─ budget unavailable ─→ ON_HOLD (pipeline_phase=HD)
        │  │      (release source if tight; pass B re-fetches)
        │  │                            └─ admitter ─→ PREPARING (HD)
        └──┴─ budget available ────→ pipeline_phase=HD
        │  create remaining playlists + audio + download Files
        ▼
  all Files terminal (READY or FAILED)
        └─ release lease, delete scratch, pipeline_phase=COMPLETE
```

`asset.latest_status` keeps its current user-facing meaning; `READY` still means
playable, set on the first rendition by `checkForAssetReadyStatus`
(`asset.service.ts:265-277`).

### Where dispatch moves

Today all File rows are created together at `VALIDATED` (`asset.service.ts:165-181`),
and `file.service.ts` `afterSave` fans them out. That splits in two — **only the timing
of File creation changes; the fan-out mechanism is untouched.**

```ts
if (status === VALIDATED) {
  if (!await this.diskBudget.tryReserve(id, estimatedBytes)) {
    await this.updateAssetStatus(id, ON_HOLD, 'Waiting for scratch capacity');
    return;                                    // nothing dispatched, zero disk
  }
  await this.updateAssetStatus(id, PREPARING, 'Fetching source');
}

if (status === PREPARING) {
  await this.jobManagerService.pushSourceFetchJob(asset);   // one job, one puller
}

if (status === PROCESSING) {                   // fetch worker published this
  await this.createThumbnailFile(...);
  await this.insertManifestFilesData(id, [FASTEST_RENDITION]);      // pass A
}

if (asset.pipeline_phase === 'HD') {
  await this.insertManifestFilesData(id, remainingRenditions);      // pass B
  await this.createAudioFile(...);
  await this.createDownloadedFile(...);
}
```

### Breaking change to guard against

`createSourceFile` currently creates a SOURCE File whose upload job
(`upload-video.worker.ts:126`) reads `<TEMP>/<assetId>/<assetId>.mp4` **from local disk**.
With streaming ingest that file does not exist and every asset fails.

Create the SOURCE File as **already READY** — it is in storage before `VALIDATED` — and
skip the upload job. This removes one Bull job and a full source-sized read+write cycle
per asset.

`createDownloadedFile` (`asset.service.ts:331-336`) remuxes from the *largest* rendition's
playlist, so it must stay in pass B, and that rendition's directory must not be deleted
until the remux completes.

---

## 6. Disk budget

```
peak_disk = (download_concurrency × max_source_size)     ← ingest lane, reserved
          + Σ (admitted assets × working set)            ← what the gate controls
```

Queue depth does not appear (P3).

**Reserve the ingest lane; transcodes may not spend it.** Without this the gate admits
work that fills the disk and the next ingest hits `ENOSPC`.

```ts
const RESERVED_INGEST = DOWNLOAD_CONCURRENCY * MAX_VIDEO_SIZE_IN_BYTES;
const transcodeBudget = usableBytes - RESERVED_INGEST;
```

Note `download-video.worker.ts:11` has no `concurrency` option, so BullMQ defaults to 1 —
the ingest lane is currently one source wide for free.

Working set is reduced by deleting each rendition directory as soon as its playlist File
reaches READY (it is already in object storage at that point).

Example on ~2.5 GB usable with 1 GB sources:

```
ingest lane      1 × 1.0 GB = 1.0 GB
transcode budget 2.5 − 1.0  = 1.5 GB   → ~2 concurrent assets with eager deletion
```

---

## 7. Leases and leak prevention

Per P4. Without this, the gate converts a disk outage into a permanently wedged
pipeline — arguably worse.

**Release on terminal, not on success.** A failed thumbnail is *finished*, just
unsuccessfully, and must not hold an asset hostage:

```ts
const isTerminal = s => s === FILE_STATUS.READY || s === FILE_STATUS.FAILED;
if (files.every(f => isTerminal(f.latest_status))) {
  this.cleanUpService.deleteLocalAssetFile(assetId);
  await this.diskBudget.release(assetId);
}
```

This also fixes B2/B4 as they exist today.

**Leases expire.** Status events do get lost — a worker OOMs between ffmpeg finishing and
publishing, RabbitMQ drops a message, a job vanishes from BullMQ (see
`README_JOB_VERIFICATION.md`). Then a File sits non-terminal forever and the rule above
cannot fire.

```ts
await redis.hset('scratch:leases', assetId, JSON.stringify({
  bytes,
  expiresAt: now + LEASE_TTL_MS,     // ~2× worst-case transcode
}));
```

The admitter sweeps expired leases before computing budget. **A reclaim must also
force-delete that asset's scratch directory** — releasing the accounting without the bytes
is worse than leaking both. Renew on each file status transition so genuinely long jobs
keep their slot.

**Reap stuck work.** Extend `JobVerificationService` (already scans Processing/Queued
assets and republishes missing jobs) with a terminal escalation:

```
File in PROCESSING/QUEUED with no live BullMQ job:
    republish_count < N        → republish (current behaviour)
    else if age > STUCK_TIMEOUT → mark FAILED   ← makes it terminal
```

**Prevent starvation.** Admit in `hold_since` order. Strict FIFO with `break` on the
first asset that does not fit avoids starvation but head-of-line blocks; skipping to
smaller assets fixes utilization but can starve large ones. Use skip-with-aging: once an
asset has waited past a threshold, stop admitting anything else until it fits.

**Make leaks visible.** Ship with the gate, not after:

- `sum(active leases)` vs actual `du(SCRATCH_DIR)` — sustained divergence means a leak
- count of `ON_HOLD`, age of oldest `ON_HOLD` — monotonic climb means wedged
- count of leases reclaimed by expiry

---

## 8. Storage abstraction

Provider selection is currently an `if (S3) … else if (BUNNY) … else if (R2)` chain
repeated at every call site — five times in `upload-video.worker.ts` alone (lines 81, 134,
184, 236, 288) and again in `thumbnail-generation.worker.ts:48`. There are three
duplicated client sets (api, upload worker, thumbnail worker) which have already drifted.

Model the replacement on `IAudioTranscriptionService`, which already establishes the
pattern in this codebase.

```ts
export interface IStorageProvider {
  putStream(s: Readable, key: string, contentType: string, size?: number): Promise<void>;
  getToFile(key: string, localPath: string): Promise<void>;
  getReadHandle(key: string, ttlSec: number): Promise<{ url: string; headers?: Record<string, string> }>;
  putFile(localPath: string, key: string, contentType?: string): Promise<void>;
  putDirectory(localDir: string, keyPrefix: string): Promise<void>;
  delete(keyPrefix: string): Promise<void>;
  head(key: string): Promise<{ size: number; contentType: string }>;
}
```

`getReadHandle` returns `{url, headers}` rather than a bare signed URL — that is what lets
S3/R2 presigning and Bunny's static `AccessKey` header both work through one call:

```bash
ffprobe -headers "AccessKey: $KEY" -i "https://storage.bunnycdn.com/..."   # Bunny
ffprobe -i "https://bucket.s3.../src.mp4?X-Amz-Signature=..."              # S3/R2
```

Capability matrix the interface must tolerate:

| | S3 | R2 | Bunny |
|---|---|---|---|
| presigned upload | ✅ | ✅ | ❌ static key only |
| multipart upload | ✅ | ✅ | ❌ |
| free egress | ❌ | ✅ | ❌ |
| range requests | ✅ | ✅ | ⚠️ verify |

Streaming ingest requires the SDK, not the CLI — `aws s3 cp` and `rclone` both need a file
on disk. Existing rclone paths stay for rendition directories, which genuinely are files.

Live it in `video-touch-common` so all eight packages share one copy, and adding a
provider becomes one file plus a factory case.

**Generate read handles inside the worker at job start, never in the API at enqueue.**
With hour-plus lock durations and queue latency, a URL signed at dispatch will have
expired.

---

## 9. Configuration

```bash
STORAGE_PROVIDER=s3|bunny|r2
SCRATCH_DIR=/scratch
SCRATCH_BUDGET_BYTES=              # blank → auto-detect via statfs, use 75%
MAX_SOURCE_SIZE_BYTES=             # ingest lane sizing
DOWNLOAD_CONCURRENCY=1
SOURCE_CACHE_ENABLED=true          # false → stream per worker; free-egress + tiny-disk setups
LEASE_TTL_MS=14400000              # 4h
STUCK_TIMEOUT_MS=7200000           # 2h
FAST_PASS_RENDITION=360            # which rendition pass A produces
```

`SOURCE_CACHE_ENABLED=false` lets an R2 operator with plenty of bandwidth and little disk
opt into 6× egress at zero cost. Default `true` because it is safe on every provider.

`server/example.env` is currently unusable — it still lists the removed
`RABBIT_MQ_*_PROCESS_VIDEO_ROUTING_KEY` pipeline and is missing every `BULL_*` queue name,
all `REDIS_*`, `STORAGE_PROVIDER`, `CDN_PROVIDER` and the GenAI keys. Generate it from
`environment.ts` as part of this work so it cannot drift again.

---

## 10. Build order

| # | Work | Effort | Ships alone | Risk |
|---|---|---|---|---|
| 0 | Verify B1; fix B1–B5; fix B6/B7 | 1d | ✅ | low |
| 1 | `IStorageProvider` + factory; pin `video-touch-common` | 3d | ✅ pure refactor | low |
| 2 | Streaming ingest; SOURCE File created READY; fix B8 | 2d | ✅ | med |
| 3 | Validate via read handle (verify Bunny range support) | 1d | ✅ | low |
| 4 | `PREPARING` + source-fetch queue; move File creation to PROCESSING | 2d | ✅ | med |
| 5 | Byte budget, leases, admitter, reaper, metrics (§7) | 3d | ✅ | med |
| 6 | Two-pass split (§4) | 2d | ✅ | med |
| 7 | Eager rendition deletion; wire up `checkForDeleteLocalAssetFile` | 1d | ✅ | low |

**Phase 0 is independent of everything else and fixes live bugs — do it first.**
Phases 1–2 resolve the concurrent-ingest problem outright. Phases 4–6 bound disk.
Phase 5 must land with or before phase 6, per P4.

Not in scope, tracked separately:

- `-preset veryfast` on `transcoding.service.ts:10` (currently defaults to `medium`) —
  ~3× throughput and faster time-to-playable, unrelated to storage.
- Separate HLS audio rendition group; audio is currently muxed identically into all four
  variants, storing and delivering four copies.
- Per-host queues for multi-host source affinity (§4 assumes a single scratch volume).

---

## 11. Open questions

1. **Which provider runs in production?** Determines whether the 1× vs 6× egress
   difference is worth anything and how hard `SOURCE_CACHE_ENABLED` defaults matter.
2. **Does Bunny Storage support HTTP range requests?** Phase 3 depends on it; otherwise
   validation needs a bounded partial download.
3. **Is `terminal()` async?** (B7) Changes whether duplicate transcoding is currently
   happening.
4. **Pass A rendition** — is 360p always the right fast pass, or should it follow the
   source height (a 480p source has no 360p in `getAllHeightWidthMapByHeight`)?
5. **Migration** — this is breaking for existing self-hosters (local sources disappear,
   env vars change). Needs a version bump and migration notes.
