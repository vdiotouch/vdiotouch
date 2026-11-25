# Plan: idle workers that never exit (Cloudflare Containers)

Status: draft · Date: 2026-11-25 · Follows: PR #34 (`fix(workers): force exit when idle shutdown hangs`)

## TL;DR

- **Symptom:** every queue is empty, yet 15 `process-video` and 2 `download` instances stay live and billed.
- **Root cause:** `WorkerIdleExitService` counts jobs with BullMQ events. A job that ends in an `error` event (here: `Missing key for job … moveToDelayed`) never decrements the counter, so the worker believes it is busy forever. PR #34's force exit sits *after* that check and never runs.
- **Amplifier:** the scaler's keep-alive alarm renews Cloudflare's inactivity timeout every minute while the container runs, so nothing outside the worker can stop it.
- **Fix:** (1) the scaler stops slots of pools that stay idle, which also clears today's stuck instances; (2) the worker tracks jobs by id and checks with Redis that they are still active; (3) find out why the job key vanished.
- No API, env-contract or `video-touch-common` changes.

---

## 1. What happened (from `transcode-480p-3` logs)

```
 time      worker (transcode-480p-3)                 idle-exit service        scaler (DO alarm)
 16:5x     'active'  job a08c16a9…                   activeJobs = 1
           ...transcode throws...
 16:59:38  handleFailed -> retryIfFailed
           -> moveToDelayed
           Redis: "Missing key for job a08c16a9…"
           BullMQ emits 'error'  (no 'failed')       activeJobs stays 1
 16:59 →   (silent)                                  every 10s: busy, return   every 60s: running ->
                                                     force exit never armed     renew 10-min timeout
```

| Evidence | Meaning |
|---|---|
| `Missing key for job … moveToDelayed`, stack `Worker.handleFailed → retryIfFailed` | the job was deleted from Redis while this worker still held it |
| no container log after 16:59:38 for 2 h | `exitIfIdle` returns early and silently |
| DO alarm `outcome: ok` every minute | `PoolContainer.alarm()` → `keepAlive()` renews `setInactivityTimeout` |
| validate / thumbnail / upload / audio at 0 instances | idle exit works when jobs end normally |

## 2. Code causes

| # | Where | Problem |
|---|---|---|
| C1 | `server/workers/*/src/common/idle-exit/worker-idle-exit.service.ts` | `activeJobs` is a counter of `active` minus `completed`/`failed`. Any job that ends another way (`error` from a lost job or lost lock, a removed job) leaks +1 forever. |
| C2 | same file, `exitIfIdle` | the force-exit timer (PR #34) is armed only after the idle check passes, so it can't rescue a leaked counter |
| C3 | `deploy/cloudflare/processor-scaler/src/pool-container.ts` `alarm()` + `container-lifecycle.ts` `keepAlive()` | renews the inactivity timeout unconditionally while running; the scaler (`scale-pools.ts`) only ever starts slots, never stops them |
| C4 | unknown, see §5 | something deleted job `a08c16a9…` while it was active |

---

## 3. Fix 1 — scaler stops slots of idle pools (outside safety net)

Do this first. It ends the instances that are stuck today, whatever image they run.

### 3.1 Behaviour

```
 every-minute cron: scaleAllPools
   |
   for each pool backlog: every slot.syncPoolState(poolIdle = wanted == 0)
   |
   +-- wanted > 0 -------> running slots clear idle_since; start free slots (as today)
   |
   +-- wanted == 0 ------> for each RUNNING slot:
                              |
                              +-- idle_since unset         -> set it, keep running
                              +-- now - idle_since < 10min -> keep running
                              +-- now - idle_since >= 10min-> SIGTERM; next sync >= 30s later: destroy()
```

`wanted = min(waiting + active, max)`, so `wanted == 0` means no job of that pool is waiting **or active**. Stopping then can't cut off a job.

### 3.2 Changes

| File | Change |
|---|---|
| `processor-scaler/src/scale-pools.ts` | no early `return` when `wanted == 0`; every slot gets `syncPoolState(poolIdle)` (replaces `isRunning()`), then free slots are started only when the pool is busy |
| `processor-scaler/src/pool-container.ts` | new RPC `syncPoolState(poolIdle): boolean`: keeps `pool_idle_since`, sends SIGTERM after 10 min idle, `destroy()` 30 s later if still running; `start()` clears both keys; unused `isRunning()` removed |
| `processor-scaler/src/pool-container.ts` `alarm()` | unchanged; stops renewing once the container is gone |
| `deploy/cloudflare/README.md` | idle-stop rule + diagram line |

Storage writes only happen when the state changes. Slots that are not running return without touching storage.

| Constant (code, not env) | Value | Why |
|---|---|---|
| `POOL_IDLE_STOP_MS` | 10 min | well above `WORKER_IDLE_EXIT_SEC` (60 s), so a healthy worker always exits by itself first |
| `STOP_GRACE_MS` | 30 s | same as the worker's force-exit window |

### 3.3 Edge cases

| Case | Result |
|---|---|
| pool idle, worker healthy | worker exits at ~60 s; scaler never needs to act |
| pool idle, worker stuck (today's bug) | stopped at ~10 min |
| pool busy (`wanted > 0`) but one slot stuck | not covered here; Fix 2 covers it |
| `transcode-*` and `mp4` share the `PROCESS_VIDEO_CONTAINER` binding | slot names are per pool (`transcode-480p-3`, `mp4-0`), so idle state is per pool |
| API unreachable (backlog fetch fails) | cron step fails as today; nothing is stopped |
| job added right after stop | next cron sees `wanted > 0` and starts a slot (≤ 1 min delay) |

---

## 4. Fix 2 — worker tracks jobs by id and checks with Redis (root fix)

Applies to all 6 copies of `worker-idle-exit.service.ts` (download, validate, thumbnail, process-video, upload, audio). Keep them identical.

### 4.1 Behaviour

```
 'active'(job)            -> inProgress.set(job.id, { worker, startedAt })
 'completed' / 'failed'   -> inProgress.delete(job.id)
 'error'(err)             -> log it (with job id if present); next tick reconciles

 idle tick (every 10s)
   |
   for each tracked job older than RECONCILE_AFTER_MS (60s):
   |   state = await Job.fromId(worker, id) -> getState()
   |   missing, or state not 'active'  -> delete + log "dropped lost job <id> (<state>)"
   |   Redis error                     -> keep (retry next tick)
   |   startedAt older than MAX_JOB_MS -> delete + log "dropped job <id> after max runtime"
   |
   inProgress.size == 0 and idle >= WORKER_IDLE_EXIT_SEC -> existing shutdown + force exit (PR #34)
```

### 4.2 Changes

| Item | Old | New |
|---|---|---|
| job tracking | `activeJobs: number` | `inProgress: Map<jobId, { worker, startedAt }>` |
| events | `active`, `completed`, `failed` | + `error` (log only) |
| lost-job check | none | `Job.fromId(worker, id)` + `getState()` (public BullMQ API; `Worker` is a valid queue arg) |
| backstop | none | `MAX_JOB_MS` = 3 h (code constant; longest transcode lock is 1 h) |
| logging | silent while busy | one line per drop; `idle exit: N job(s) in progress` at most every 10 min |

### 4.3 Edge cases

| Case | Result |
|---|---|
| job lost in Redis, processor already returned (today) | dropped at the first reconcile ≥ 60 s; worker exits ~60 s later |
| job taken over by another worker (lock lost) | state `active` (held by the other worker) until it finishes, then dropped; worst case `MAX_JOB_MS` |
| genuinely long job (> 60 s) | state `active`, so it is kept |
| Redis down during reconcile | kept; no false exit |
| exit while ffmpeg is still running for a dropped job | only after `MAX_JOB_MS`; BullMQ retries it elsewhere (job is already lost or stalled anyway) |

---

## 5. Fix 3 — find out why the job key vanished (investigation)

Nothing in the API removes an active job: only `removeOnComplete` (all queues) and `removeOnFail` (upload, download-file-generation, audio queues) delete jobs. So the job was deleted from outside.

| Suspect | Check | If confirmed |
|---|---|---|
| A. lock lost → job stalled → another 480p slot finished it → `removeOnComplete` deleted it → first worker's retry found nothing | search all `process-video` container logs for `a08c16a9`: two slots processed it; look for `stalled` / `Missing lock` | Fix 2 already handles the leak; also log BullMQ `stalled` in the API (QueueEvents) to measure how often |
| B. deleted or cleaned by hand in Bull Board (`/queues` has no auth) | ask the team; Bull Board has no audit, so check the time 16:59 against any activity | put `/queues` behind auth (already in the secure-auth spec §2) |
| C. Redis evicted the key | provider setting `maxmemory-policy` must be `noeviction`; check `evicted_keys` in Redis INFO | set `noeviction` (BullMQ requires it) |

Small fix found on the way: `process-video.worker.ts` and `download-file-generation.worker.ts` say `// 2 hours lock duration` but set 1 h. Fix the comment.

---

## 6. Rollout

| Step | Action | Who | Effect |
|---|---|---|---|
| 0 | stop the idle `process-video` and `download` instances from the dashboard (if the dashboard allows) | ops | billing stops now |
| 1 | deploy Fix 1 (scaler only: `wrangler deploy` of processor-scaler) | dev | any future stuck slot is stopped within ~10 min, including the current ones if step 0 isn't possible |
| 2 | deploy Fix 2 (6 worker images) | dev | stuck workers exit within ~2 min |
| 3 | Fix 3 investigation; apply the matching fix | dev + ops | stops the jobs going missing in the first place |

Fix 1 and Fix 2 are independent; each alone stops the billing leak.

## 7. Verification (manual; no test code)

| # | Step | Expected |
|---|---|---|
| 1 | after Fix 1 deploy, wait 10 min with empty queues | `process-video` / `download` live instances → 0; scaler log `stopped after pool idle` per slot |
| 2 | upload a video, let it finish | slots start, work, exit by themselves at ~60 s (`no active job for …s, shutting down`), no scaler stop |
| 3 | repro the leak: start a 480p transcode, then delete its job key in Redis (`DEL <prefix>:<queue>:<jobId>`) while it runs | worker logs `Missing key…`; with Fix 2: `dropped lost job <id>` within ~70 s, then idle exit |
| 4 | long real transcode (> 2 min) | not dropped; finishes normally |
| 5 | Redis briefly unreachable while idle with a tracked job | job kept; no exit until Redis answers |

## 8. Checklist

- [ ] Step 0: stop current idle instances (dashboard)
- [ ] Fix 1: `syncPoolState` in `PoolContainer`; `scale-pools.ts` handles `wanted == 0`
- [ ] Fix 1: README idle-stop note; deploy scaler; verify #1
- [ ] Fix 2: job map + `error` log + Redis reconcile + `MAX_JOB_MS` in all 6 `worker-idle-exit.service.ts`
- [ ] Fix 2: `yarn format` / `npm run format` per worker; build; deploy; verify #2–#5
- [ ] Fix 3: search logs for `a08c16a9`; check Redis `maxmemory-policy`; act per §5
- [ ] Fix the "2 hours lock duration" comments
