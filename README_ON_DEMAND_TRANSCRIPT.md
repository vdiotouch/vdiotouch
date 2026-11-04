# On-demand transcript generation — implementation plan

Add an API that transcribes an asset **on demand**, starting from the `audio.mp3` that asset
already has, without re-downloading the video, re-running ffprobe, or touching the transcoding
branch.

Today transcription only happens as a side effect of ingesting a video with
`with_transcription: true`. There is no way to say "transcribe this asset now".

---

## 1. Target flow

```
POST /api/v1/assets/:assetId/transcribe
  │
  ├─ API  validate: asset exists, AUDIO file is READY, no run already in flight
  ├─ API  delete stale TRANSCRIPT + PARTIAL_TRANSCRIPT rows, rm <root>/transcripts/
  ├─ API  create TRANSCRIPT File row (QUEUED)            ← post-save hook fires
  │        └─ publish audio-split job → BULL_AUDIO_SPLIT_JOB_QUEUE
  └─ 202  { asset_id, transcript_file_id, status }
           │
audio-worker: AudioSplitWorker
  ├─ <root>/audio.mp3 present?  → use it            (fresh asset: no download)
  ├─ missing (cleanup cron reaped it)? → GET audio_url → <root>/audio.mp3
  ├─ rm -rf <root>/audio_chunks/ ; ffmpeg -f segment → 000.mp3, 001.mp3, …
  └─ publish UpdateFileStatusEvent(transcript_file_id, PROCESSING, "Audio split into N chunks")
           │
API: FileService.afterUpdateFileLatestStatus
  ├─ TRANSCRIPT → PROCESSING, and no partials exist yet
  ├─ readdir <root>/audio_chunks/  (shared volume — the API already does this today)
  └─ create N PARTIAL_TRANSCRIPT rows → each post-save publishes its transcription job
           │
    ── everything downstream is unchanged ──
    audio-worker transcribes each chunk → partials READY
      → TranscriptService merges → transcript-merger.worker → upload-video-worker
      → TRANSCRIPT READY
```

The API publishes to Bull and owns Mongo. The worker does the CPU work and reports back over
RabbitMQ. That is the existing architecture, unchanged.

## 2. Why this shape

- **`BULL_AUDIO_SPLIT_JOB_QUEUE` already exists.** It is a `getOrThrow` at audio-worker boot
  (`workers/audio-worker/src/common/app-config/service/app-config.service.ts:30`) with no
  processor consuming it. This fills a slot that was already reserved.
- **The split moves out of the API.** `file.service.ts:381` currently shells `ffmpeg` inside the
  API process. After this change the API never runs ffmpeg.
- **No new RabbitMQ event, no `video-touch-common` bump.** audio-worker's only outbound routing
  key is `RABBIT_MQ_UPDATE_FILE_STATUS_ROUTING_KEY`, so it cannot report a chunk list. It does
  not need to: the API and every worker share the `./temp_videos` volume, and the API already
  reads that chunk directory (`fs.readdirSync` in `checkForTranscriptionGeneration`). The worker
  says "done"; the API lists the directory.
- **Not `download-video-worker`.** It writes to a hardcoded `<assetId>.mp4` path with no
  destination field in `VideoDownloadJobModel`; it reports completion as an *asset* status
  (`DOWNLOADED`), which pushes a validate job and re-runs the entire pipeline; its own copy of
  `DownloaderHttpService` hard-rejects any content-type that is not `video/mp4`; it is pinned to
  `video-touch-common@^1.0.0` against api/audio-worker's `^5.x`; and its Dockerfile has no
  ffmpeg. audio-worker already has ffmpeg, axios, `TEMP_VIDEO_DIRECTORY` and `FileStatusPublisher`.
- **The automatic path collapses onto the same code.** `with_transcription` ingest and the new
  endpoint both end at "create the TRANSCRIPT row". One flow instead of two.

## 3. Changes — `server/api`

### 3.1 New: `src/api/assets/models/audio-split-job.model.ts`

```ts
export interface AudioSplitJobModel {
  asset_id: string;
  file_id: string;               // the TRANSCRIPT file — status handle for the whole run
  audio_url: string;             // CDN url; fallback for when the local mp3 is gone
  audio_file_name: string;       // 'audio.mp3'
  chunk_duration_in_sec: number; // audio-worker has no AUDIO_CHUNK_DURATION_IN_SEC of its own
}
```

Defined locally in both packages rather than in `video-touch-common`. The package versions have
already drifted across workers (api/audio-worker `^5.x` / `^4.4.0`, download and validate workers
`^1.0.0`), and per-worker duplication is the established pattern here — `file-status.publisher.ts`
is copied into every worker. A shared-package bump would force a coordinated release across all
eight images for one interface.

### 3.2 `src/common/app-config/environment.ts` + `service/app-config.service.ts`

Add `BULL_AUDIO_SPLIT_JOB_QUEUE: string` and `this.configService.getOrThrow('BULL_AUDIO_SPLIT_JOB_QUEUE')`.

> This makes the var **required for the API to boot**. It is currently only set for audio-worker.
> See §5.

### 3.3 `src/api/assets/assets.module.ts`

- `BullModule.registerQueueAsync` — add `{ name: 'audio-split', useFactory: () => ({ name: AppConfigService.appConfig.BULL_AUDIO_SPLIT_JOB_QUEUE }) }`
- `BullBoardModule.forFeature({ name: 'audio-split', adapter: BullMQAdapter })`
- providers — add `TranscriptGenerationService` (§3.5)

### 3.4 `src/api/assets/services/job-manager.service.ts`

- `@InjectQueue('audio-split') private audioSplitQueue: Queue`
- `publishAudioSplitJob(transcriptFile, audioUrl)` → builds `AudioSplitJobModel`, adds to the
  queue with the same `jobId: uuidv4()` / `RETRY_JOB_ATTEMPT_COUNT` / fixed-backoff options every
  other publisher uses.

### 3.5 New: `src/api/assets/services/transcript-generation.service.ts`

Owns the Mongo side of a transcript run. Injects `FileRepository` only — **it must not inject
`FileService`**, which already injects `TranscriptService`; a cycle here would need `forwardRef`.

| Method | Does |
|---|---|
| `resetTranscriptFiles(assetId)` | `deleteMany` TRANSCRIPT + PARTIAL_TRANSCRIPT rows; `fs.rmSync` `Utils.getLocalPartialTranscriptsDir(...)`. `deleteMany` fires no Mongoose hook, so this schedules nothing. |
| `createTranscriptFile(assetId)` | Moved verbatim from `file.service.ts:321`. Its post-save hook publishes the split job (§3.6). |
| `createPartialTranscriptFiles(assetId, chunkNames)` | Loop from `file.service.ts:362-373`: `transcript_${i}.json`, `audio_file_name = chunkNames[i]`, `audio_start_time = i * AUDIO_CHUNK_DURATION_IN_SEC` formatted `HH:MM:SS`. |
| `readChunkNames(assetId)` | `readdirSync(Utils.getLocalAudioChunksDir(...))` sorted numerically — same comparator as today. |
| `hasRunInFlight(assetId)` | true if any PARTIAL_TRANSCRIPT row is QUEUED or PROCESSING. |

`splitAudio()` and `formatSecondsToHHMMSS()` move out of `FileService`; `splitAudio` is **deleted
from the API entirely** (it lives in the worker now).

### 3.6 `src/api/assets/services/file.service.ts`

**`afterSave` — add the missing `TRANSCRIPT` branch.** Every other file type has one
(playlist → process queues, thumbnail → thumbnail, source → upload, audio → extract-audio,
partial_transcript → transcription). `TRANSCRIPT` is the only type that schedules nothing:

```ts
if (doc.type === Constants.FILE_TYPE.TRANSCRIPT) {
  const audioFile = await this.repository.findOne({ asset_id: doc.asset_id, type: Constants.FILE_TYPE.AUDIO });
  const audioUrl = audioFile ? getCdnFileUrl(audioFile, CdnService.getCdnBaseUrl()) : '';
  const jobData = await this.jobManagerService.publishAudioSplitJob(doc, audioUrl);
  if (jobData) { await this.repository.findOneAndUpdate({ _id: doc._id }, { job_id: jobData.id }); }
}
```

**`afterUpdateFileLatestStatus` — add the split-completed branch.**

```ts
if (updatedFile.type === Constants.FILE_TYPE.TRANSCRIPT &&
    updatedFile.latest_status === Constants.FILE_STATUS.PROCESSING) {
  // guard: see the PROCESSING collision below
  if (!(await this.transcriptGenerationService.hasPartialTranscripts(assetId))) {
    const chunkNames = await this.transcriptGenerationService.readChunkNames(assetId);
    await this.transcriptGenerationService.createPartialTranscriptFiles(assetId, chunkNames);
  }
}
```

> **PROCESSING collision — do not skip this guard.** `FILE_STATUS` has only
> `QUEUED | PROCESSING | READY | FAILED`, so there is no distinct "split done" status.
> `transcript-merger.worker.ts:31-36` publishes **`PROCESSING` for the same transcript file** when
> the merge starts. Without the "no partials exist yet" guard, the merge would re-create the whole
> set of partial rows and re-run transcription in a loop.

**`checkForTranscriptionGeneration(asset)` — reduce to creating the TRANSCRIPT row.** Drop the
`fs.existsSync` probe, the `splitAudio` call, the `readdirSync`, and the partial-row loop; keep the
`TRANSCRIPTION_GENERATION_ENABLED && asset.with_transcription` gate. Update the call site at
`file.service.ts:79` (the `updatedFile` argument is no longer needed).

Remove the now-dead `createPartialTranscriptionFile`, `createTranscriptionFile`, `splitAudio`,
`formatSecondsToHHMMSS`, and the `terminal` / `getTranscriptFileName` / `FileMapper` imports.

### 3.7 `src/api/assets/controllers/asset.controller.ts`

```ts
@Post('/:assetId/transcribe')
@UseGuards(JwtAuthGuard)
async transcribeAsset(@Param('assetId') assetId: string, @UserInfoDec() user: UserDocument)
```

1. `400` if `!AppConfigService.appConfig.TRANSCRIPTION_GENERATION_ENABLED`, or `assetId` is not a
   valid ObjectId.
2. `404` if no asset for `{ _id, user_id: user._id }`.
3. `404` if no `FILE_TYPE.AUDIO` row; `409` if it is not `READY`.
4. `409` if `hasRunInFlight(assetId)` — re-triggering mid-run would delete rows whose jobs are
   still executing.
5. `resetTranscriptFiles` → `createTranscriptFile` → `202 { asset_id, transcript_file_id, status }`.

Everything after the row insert is driven by hooks, so the handler returns immediately without
backgrounding any work itself.

Note this is the first authenticated handler in `AssetController` — `POST /api/v1/assets` resolves
its user from an `email` in the body and has no guard. New endpoint, so it gets the guard.

**Also fix `generateTranscript` at line 43.** `this.fileRepo.findOne({ asset_id })` has no `type`
filter, so it returns whatever File comes back first — in practice the SOURCE row — and then
publishes a merge job targeting it and stamps `job_id` on it. Add `type: FILE_TYPE.TRANSCRIPT`.

## 4. Changes — `server/workers/audio-worker`

### 4.1 New: `src/worker/models/audio-split-job.model.ts`

Same interface as §3.1.

### 4.2 New: `src/worker/audio-download.service.ts`

`axios.get(url, { responseType: 'stream' })` → write to `Utils.getLocalMp3Path(assetId, TEMP_VIDEO_DIRECTORY)`.

Accept `audio/*`, `application/octet-stream` and `binary/octet-stream`, and treat a missing
content-type as acceptable. Do **not** copy `downloadVideo`'s `!== 'video/mp4'` hard-fail —
storage providers are inconsistent about what they stamp on an mp3, and the repo has already had
one Content-Type fix for R2 uploads (commit `6a0f409`).

### 4.3 New: `src/worker/audio-split.worker.ts`

```ts
@Processor(process.env.BULL_AUDIO_SPLIT_JOB_QUEUE)
```

Read straight from `process.env` at decorator time, matching every other worker in the repo.

```
publish PROCESSING("Audio split started")            // on the TRANSCRIPT file
audioPath = Utils.getLocalMp3Path(asset_id, TEMP_VIDEO_DIRECTORY)
if (!exists(audioPath) || size === 0):
    if (!msg.audio_url) throw new Error('audio file is not available locally and no audio_url was provided')
    await audioDownloadService.download(msg.audio_url, audioPath)
chunksDir = Utils.getLocalAudioChunksDir(asset_id, TEMP_VIDEO_DIRECTORY)
rmSync(chunksDir, { recursive: true, force: true }); mkdirSync(chunksDir, { recursive: true })
ffmpeg -i <audioPath> -f segment -segment_time <msg.chunk_duration_in_sec> -c copy <chunksDir>/%03d.mp3
n = readdirSync(chunksDir).length; if (n === 0) throw
publish PROCESSING(`Audio split into ${n} chunks`)   // this is the signal the API acts on
```

- Clear the chunk dir before splitting: a shorter re-run otherwise leaves the tail of the previous
  run behind, and the API's `readdir` would pick those stale chunks up. The current API-side
  implementation has this bug (`file.service.ts:351` only `mkdir`s if absent).
- `FileStatusPublisher.publishUpdateFileStatusEvent(fileId, details, dirSize, status)` — note the
  argument order, `details` before `dirSize`. **Pass `dirSize: 0`**: `FileService.updateFileStatus`
  writes `size: dir_size` onto any non-SOURCE file, so a non-zero value would overwrite the
  transcript file's size.
- On the last attempt (`checkLastAttempt`), publish `FAILED` with the error message; otherwise
  rethrow so BullMQ retries. Same shape as `audio-extraction.worker.ts:52-65`.

### 4.4 `src/worker/worker.module.ts`

Register the `BULL_AUDIO_SPLIT_JOB_QUEUE` queue and add `AudioSplitWorker` + `AudioDownloadService`
to providers.

## 5. Config and deployment

| Var | api | audio-worker |
|---|---|---|
| `BULL_AUDIO_SPLIT_JOB_QUEUE` | **new** (`getOrThrow`) | already required |
| `AUDIO_CHUNK_DURATION_IN_SEC` | already required | not needed — travels in the job |

- `BULL_AUDIO_SPLIT_JOB_QUEUE` is **already set** in `server/.env` (`audio_split_job_queue`) —
  audio-worker has always required it — so the API's new `getOrThrow` is already satisfied and no
  config change is needed. Every compose service shares `env_file: .env`, so the var reaches the
  API container automatically. It is still absent from the stale `example.env`.
- Confirm the same var is present in the production env before deploying the API, since the API
  will now refuse to boot without it.
- The API and audio-worker must keep sharing `./temp_videos:$TEMP_VIDEO_DIRECTORY`. The API reads
  the chunk directory the worker writes; they are not separable.
- No new image, no new container, no CI change. `.github/workflows/release-images-ci.yml` only runs
  on release publish with a CalVer tag.

## 6. Bugs fixed along the way

Both sit directly in this path.

1. **`asset.service.ts:117` `checkForAssetFailedStatus` fails the whole asset when there are no
   playlists.** It queries only `FILE_TYPE.PLAYLIST`. For an asset with `with_transcoding: false`
   that set is empty, so `failedFiles.length === files.length` is `0 === 0` → **any** single file
   failure marks the asset FAILED. `asset.service.ts:143` then deletes the local temp dir, wiping
   the audio chunks an in-flight transcription is still reading. Fix: return early when
   `files.length === 0`.

2. **`file.service.ts:153` merge race.** Every partial going READY re-runs "are all partials
   ready", unlocked, so chunks finishing together each publish a merge job. Fix: claim the
   transcript file atomically before publishing in `transcript.service.ts:32` —
   `findOneAndUpdate({ _id, $or: [{job_id: {$exists: false}}, {job_id: null}] }, { job_id: <placeholder> })`
   returns `null` when another caller already claimed it. Give `generateTranscript` a `force` flag
   so the manual `generate-transcript` retry endpoint can still re-merge.

3. Ordering: creating the TRANSCRIPT row **before** the partials (which this design does anyway)
   closes a third race — a chunk that finishes before the transcript row exists currently hits
   `Transcript file does not exist for this asset`, which is caught and logged at
   `file.service.ts:160` and silently lost.

## 7. Traps to respect

- **Writing a `files` row schedules work.** `createTranscriptFile` publishes a split job by virtue
  of being saved. Any debugging that inserts rows by hand will start real jobs.
- **`BaseRepository.findOneAndUpdate` returns the pre-update document** (Mongoose 5, no
  `{new: true}`). Re-`findOne` for fresh state.
- **The file hook reads `this['_update']['$set']['latest_status']`** and only calls
  `afterUpdateFileLatestStatus` when it is set. Mongoose auto-wraps top-level fields in `$set`, so
  a `{ job_id }` update is safe — it will not re-enter the status path.
- **`yarn lint` is broken** in the API and every worker (no eslint config under `server/`). Run
  `yarn format`. There are **no tests** — the suite matches no files.
- Both packages use **yarn**; `thumbnail-generation-worker` is the npm one. Lockfiles are
  gitignored.
- Commits must be conventional-commit format; commitlint runs on `commit-msg`.

## 8. Verification

No test infrastructure exists, so this is manual.

1. **Fresh asset, local mp3 present.** Ingest with `with_transcription: true`. Confirm the split
   job appears in Bull Board at `/queues` under the audio-split queue, `audio_chunks/` fills, N
   PARTIAL_TRANSCRIPT rows are created, and the asset reaches READY with a `transcript.json` at
   `videos/<assetId>/transcript.json`.
2. **Old asset, mp3 reaped.** `rm -rf server/temp_videos/<assetId>` on an asset whose AUDIO file is
   READY, then `POST /:assetId/transcribe`. Confirm the worker logs the CDN download and the run
   completes identically.
3. **Re-trigger.** Run `/transcribe` twice on the same asset. Confirm old rows are deleted, chunk
   count is right (no stale chunks), and exactly one merge job is published.
4. **In-flight rejection.** Call `/transcribe` while a run is active → `409`.
5. **Merge race.** Set `AUDIO_CHUNK_DURATION_IN_SEC` low on a short file to get many chunks
   finishing together; confirm exactly one job lands on the merge queue.
6. **No-playlist failure.** With `with_transcoding: false`, fail one file and confirm the asset is
   *not* marked FAILED (regression test for §6.1).

## 9. Out of scope

- Transcribing an arbitrary mp3 URL with no asset behind it.
- A "skip source upload and thumbnail for transcript-only assets" flag —
  `asset.service.ts:166-173` still creates SOURCE, THUMBNAIL and AUDIO unconditionally at
  `VALIDATED`, regardless of `with_transcoding`.
- An endpoint returning transcript *content*; callers still go
  `Asset.files` → `type: transcript` → `GetFileUrl(id)` → fetch the CDN JSON.
- `validateTranscriptionGenerationEnabled()` (`app-config.service.ts:182`) still knows only
  `OPENAI_*` and `GOOGLE_GEN_AI_*` and `process.exit(1)`s otherwise, so the API will not boot with
  transcription enabled on an Azure- or Cloudflare-only setup even though audio-worker supports both.
```
