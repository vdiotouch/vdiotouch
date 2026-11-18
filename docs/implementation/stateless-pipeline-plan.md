# Stateless video pipeline — implementation plan

Tracks issue [#20](https://github.com/vdiotouch/vdiotouch/issues/20). Checked against `master` @ `05d069b`.

## TL;DR

- **Goal:** workers never share a disk. Every file moves through one S3-API bucket (R2 by default; S3 or GCS also work), and each of the 9 worker pools scales from 0 up to a max set in env.
- **Already done here:** each resolution has its own queue (`process_video_360p … 1080p`) and its own container. The issue's "per-height queue registry" step mostly exists already.
- **Not in the issue, and blocks stateless:** the API itself reads the shared disk (tus upload, audio chunking, cleanup), and the master `.m3u8` is built by appending to a file on that disk.
- **Order:** PRs 1–5 make the pipeline stateless and work on docker-compose. PR 6 adds scale-to-zero support. PR 7 is the **Cloudflare Containers** adapter (first target; see [cloudflare-containers-plan.md](./cloudflare-containers-plan.md)). PR 8, Kubernetes + KEDA, comes later.
- **Biggest risk:** `video-touch-common` versions have drifted. `download-video-worker` and `validate-video-worker` are on `^1.0.0`, `audio-worker` on `^4.4.0`, and `process-video-worker` is pinned to `5.0.1`. Bump all of them first.

## 1. Today vs. target

```
TODAY                                         TARGET
+------------------------------+              +-------------------------------+
| api (tus upload, splitAudio, |              | Bucket (S3 API)               |
|      cleanup cron)           |              |  sources/{id}/source.mp4      |
| download / validate /        |              |  videos/{id}/{h}/*            |
| thumbnail / process x4 /     |--> ./temp_   |  videos/{id}/master.m3u8      |
| upload / audio               |    videos    |  audio/{id}/chunks/*          |
| all always on                |   (shared)   +------^----------------^-------+
+------------------------------+                     |                |
                                              +------+-----+   +------+------+
                                              | each pool  |   | api (no     |
                                              | 0..MAX     |   | disk)       |
                                              | own /tmp   |   | always on   |
                                              +------------+   +-------------+
```

## 2. Who uses the shared disk today

| Component | File | Disk use today | Target |
|---|---|---|---|
| api | `tus.service.ts:53` | tus writes the upload to `temp_videos` | tus S3 store → `sources/{id}/source.mp4` |
| api | `file.service.ts:340` | `splitAudio` reads the mp3 from disk | move chunking to `audio-worker` |
| api | `cleanup.service.ts` | deletes `temp_videos` dirs | delete bucket prefixes / bucket lifecycle rule |
| download-video-worker | `download-video.worker.ts` | writes the source to disk | streams the source to the bucket |
| validate-video-worker | `validate-video.worker.ts` | runs ffprobe on the disk file | ffprobe on a presigned URL |
| thumbnail-generation-worker | `thumbnail-generation.worker.ts` | reads the source from disk | `ffmpeg -ss` on a presigned URL |
| process-video-worker | `transcoding.service.ts` | reads and writes disk | download source → own `/tmp` → upload own output |
| process-video-worker | `manifest.service.ts` | **appends** to a shared `master.m3u8` | api builds the master from READY files |
| upload-video-worker | `upload-video.worker.ts` | syncs a disk dir to the bucket | keep source + master upload only |
| audio-worker | 3 workers | extract / transcribe / merge on disk | presigned URL in, own `/tmp`, upload out |

## 3. A transcode job, before and after

```
BEFORE
api --add--> process_video_720p --> process-video-worker-720p
                                      | read  temp_videos/{id}/source
                                      | write temp_videos/{id}/720/
                                      | append temp_videos/{id}/master.m3u8
                                      +--add--> upload queue --> upload-worker syncs dir

AFTER
api --add--> process_video_720p --(scaler sees backlog)--> replica 720p-N (concurrency 1)
                                      | GET  sources/{id}/source.mp4 --> /tmp/{id}
                                      | ffmpeg (same flags)          --> /tmp/{id}/720/
                                      | PUT  videos/{id}/720/*
                                      | rm /tmp/{id}; publish READY (RabbitMQ)
api on READY --> rebuild master.m3u8 from READY playlist rows --> PUT videos/{id}/master.m3u8
```

## 4. PR plan

| PR | Title | Main changes | Done when |
|---|---|---|---|
| 0 | Common-package bump | Put all 7 packages on `video-touch-common ^5.1.1`; fix compile errors | All 7 `yarn build` / `npm run build` pass |
| 1 | Storage layer | New `ObjectStorageService` (S3 SDK, `S3_ENDPOINT`, `S3_FORCE_PATH_STYLE`, presigned GET) in api + workers; R2 becomes S3 with an endpoint | Upload and presign work against R2 |
| 2 | Source in bucket | Download worker streams to `sources/{id}/source.mp4`; tus uses an S3 store (also fixes the broken tus `Server`); validate and thumbnail read a presigned URL | A video reaches `VALIDATED` with no `temp_videos` mount |
| 3 | Transcode pools | Ladder → `TRANSCODE_HEIGHTS=720,540,480` (adds 540 to `getHeightWidthMap`); `concurrency: 1`; fetch → encode → upload in the worker; drop `appendManifest`; api writes `master.m3u8` when a playlist goes READY; remove the rendition path from the upload worker | 1 upload → 3 renditions + master in the bucket → asset `READY` |
| 4 | MP4 + audio stateless | MP4 built from the playlist URL; audio extraction from a presigned URL; **chunking moves to `audio-worker`**; api creates `PARTIAL_TRANSCRIPT` rows from the chunk count in the event | Transcription works with no shared disk |
| 5 | Remove the shared disk | Drop `TEMP_VIDEO_DIRECTORY` from the api; cleanup cron → bucket deletes; delete `./temp_videos` volumes from compose; `WORKER_ROLE=transcode\|mp4` | `grep TEMP_VIDEO_DIRECTORY server/api` is empty |
| 6 | Scale contract | `GET /internal/processors/backlog` (bearer `INTERNAL_API_TOKEN`); optional `SCALE_WEBHOOK_URL`; `WorkerIdleExitService`; `enableShutdownHooks()` ×6; `buildRedisConnection` (user / password / TLS) | Endpoint returns `wanted` for all 9 pools |
| 7 | Cloudflare adapter (first) | `deploy/cloudflare` processor-scaler + container classes; compose split per pool (R2 also used locally, no MinIO). Details: [cloudflare-containers-plan.md](./cloudflare-containers-plan.md) | 10 uploads → 30 transcode containers → 0 when done |
| 8 | Kubernetes adapter (later) | `deploy/kubernetes` Helm + KEDA (metrics-api trigger, `minReplicaCount: 0`) | 10 uploads → 30 transcode pods → 0 when done |

## 5. The 9 pools

| Pool | App | Queue(s) | Env max (default) |
|---|---|---|---|
| download | download-video-worker | `BULL_DOWNLOAD_JOB_QUEUE` | `DOWNLOAD_MAX_PROCESSORS=10` |
| validate | validate-video-worker | `BULL_VALIDATE_JOB_QUEUE` | `VALIDATE_MAX_PROCESSORS=10` |
| thumbnail | thumbnail-generation-worker | `BULL_THUMBNAIL_GENERATION_JOB_QUEUE` | `THUMBNAIL_MAX_PROCESSORS=10` |
| transcode-720p | process-video-worker (`PROCESSOR_HEIGHT=720`) | `BULL_720P_PROCESS_VIDEO_JOB_QUEUE` | `TRANSCODE_720P_MAX_PROCESSORS=10` |
| transcode-540p | same (`540`) | `BULL_540P_…` (exists, no container yet) | `TRANSCODE_540P_MAX_PROCESSORS=10` |
| transcode-480p | same (`480`) | `BULL_480P_…` | `TRANSCODE_480P_MAX_PROCESSORS=10` |
| mp4 | process-video-worker (`WORKER_ROLE=mp4`) | `BULL_DOWNLOAD_FILE_GENERATION_JOB_QUEUE` | `MP4_MAX_PROCESSORS=3` |
| upload | upload-video-worker | `BULL_UPLOAD_JOB_QUEUE` | `UPLOAD_MAX_PROCESSORS=3` |
| audio | audio-worker | extraction + transcription + merge | `AUDIO_MAX_PROCESSORS=5` |

`wanted = min(waiting + active, MAX)` is computed per pool, using the api's BullMQ `getJobCounts()`.

## 6. How replicas scale down

| Platform | Mechanism | Setting |
|---|---|---|
| Kubernetes + KEDA | SIGTERM → shutdown hook → `worker.close()` waits for the current job | `terminationGracePeriodSeconds` ≥ longest encode |
| Cloudflare Containers | Idle for N seconds → `process.exit(0)` | `WORKER_IDLE_EXIT_SEC=60` |
| docker-compose | Never (fixed size) | `WORKER_IDLE_EXIT_SEC` empty |

## 7. Risks

| Risk | Mitigation |
|---|---|
| `video-touch-common` drift (`^1.0.0` / `^4.4.0` / `5.0.1`) | PR 0 before anything else |
| Master manifest race when 3 renditions finish together | api rebuilds the whole file from DB each time (idempotent), never appends |
| Queue routing breaks running deployments | Drain the queues in Bull Board `/queues` before deploying PR 3 |
| `verify-bullmq-jobs` must know the new pools | Update its queue list in PR 3 |
| Cold start of 20–40 s after idle | Acceptable for VOD; document it |
| Outbound TCP from Cloudflare Containers is unproven | CF-0 spike before PR 1 |

## 8. Checklist

- [x] Open questions answered (2026-11-18): see the decisions table in [cloudflare-containers-plan.md §10](./cloudflare-containers-plan.md#10-decisions-2026-11-18).
- [ ] PR 0: bump the common package.
- [ ] PR 1: storage layer.
- [ ] PR 2: source in bucket.
- [ ] PR 3: transcode pools.
- [ ] PR 4: MP4 + audio stateless.
- [ ] PR 5: remove the shared disk.
- [ ] PR 6: scale contract.
- [ ] CF-0 spike: container TCP egress to Redis / RabbitMQ / Mongo (do this first).
- [ ] PR 7: Cloudflare adapter.
- [ ] PR 8 (later): Kubernetes adapter.
- [ ] Run each PR end to end on docker-compose (one upload → `READY`).
