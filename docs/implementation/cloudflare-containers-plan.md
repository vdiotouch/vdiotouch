# Cloudflare Containers adapter — implementation plan

Part of [stateless-pipeline-plan.md](./stateless-pipeline-plan.md) (issue [#20](https://github.com/vdiotouch/vdiotouch/issues/20)). Cloudflare comes first; Kubernetes + KEDA comes later.

## TL;DR

- One Cloudflare Worker, `processor-scaler`, starts worker containers when the api reports a backlog. It runs on a webhook from the api and on a cron every minute.
- Each container runs an unchanged worker image. It pulls jobs from an **external** Redis, reads and writes **R2**, publishes events to an **external** RabbitMQ, and exits by itself when idle.
- `server/` stays cloud-neutral. All Cloudflare code lives in `deploy/cloudflare/`.
- The stateless core (PRs 0–6 of the main plan) still comes first: Cloudflare containers have no shared disk at all.
- **Do a spike first:** prove that a container can open outbound TCP to Redis, RabbitMQ and Mongo before building anything else.
- **The api also runs on Cloudflare**, as an always-on container (1..N) behind the same Worker (§9). Only Redis, RabbitMQ and Mongo stay outside.

## 0. Cloudflare components we use

| Component | What it is | What it does for us | Why this one |
|---|---|---|---|
| **Workers** | Small JS/TS functions running on Cloudflare's edge | `processor-scaler`: front door for the api, receives `/scale`, decides how many containers to start | The only way to receive HTTP and to control containers on Cloudflare |
| **Cron Triggers** | Schedule that runs a Worker (`*/1 * * * *`) | Every minute: re-check the backlog (in case a webhook was lost) and call the api cron endpoints | Replaces `server/scripts/*.sh` and acts as a scaling backstop |
| **Durable Objects (DO)** | Small stateful objects, one per name, with storage and alarms | One DO per container slot (`transcode-720p-3`, `api-0`): starts, watches and keeps its container alive | Containers can only be started and owned by a DO |
| **DO Alarms** | A timer that wakes a DO later | Wakes every 60 s while the container runs, so Cloudflare doesn't stop it | Containers stop when their DO goes idle |
| **Containers** | Docker images running in Firecracker microVMs, started on demand | Run our api and 6 worker images unchanged, 0..N each | Lets NestJS + ffmpeg run on Cloudflare without code changes |
| **R2** | S3-compatible object storage, no egress fees | Holds sources, renditions, master manifests, thumbnails, audio chunks | Replaces the shared `temp_videos` disk; workers reach it through the S3 API |
| **Container registry** | Cloudflare's image store (`registry.cloudflare.com`) | `wrangler deploy` builds our Dockerfiles and pushes the images here | Containers pull images only from here (50 GB total) |
| **Secrets** | Encrypted Worker variables (`wrangler secret put`) | Store Redis / RabbitMQ / Mongo / R2 / JWT credentials; the DO passes them to containers as env | Keeps credentials out of `wrangler.jsonc` and git |
| **Wrangler** | Cloudflare's CLI | Deploy the Worker + images, set secrets, `wrangler containers list`, `wrangler tail` for logs | One tool for the whole adapter |

How they fit together:

```
Cron Trigger --+
HTTP request --+--> Worker (processor-scaler) --> Durable Object (one per slot)
                                                    | start() + alarm every 60 s
                                                    v
                                                  Container (image from registry, env from Secrets)
                                                    | S3 API
                                                    v
                                                    R2
```

Not used: Queues (BullMQ on Redis stays), D1 / KV (Mongo stays), Workers AI (the GenAI provider stays pluggable).

### 0.1 Durable Object vs Container

The **Container** is the machine that does the work. The **Durable Object (DO)** is the small manager that controls that machine. Only a DO can start a container.

```
  Worker (processor-scaler)        "We need 3 transcoders for 720p"
        |
        |  "slot 0, run!"  "slot 1, run!"  "slot 2, run!"
        v
  +-----------+   +-----------+   +-----------+
  | DO        |   | DO        |   | DO        |   <-- managers: tiny, cheap, no ffmpeg
  | 720p-0    |   | 720p-1    |   | 720p-2    |       start / watch / keep alive
  +-----+-----+   +-----+-----+   +-----+-----+
        | owns          | owns          | owns
  +-----v-----+   +-----v-----+   +-----v-----+
  | Container |   | Container |   | Container |   <-- workers: our Docker image,
  | ffmpeg    |   | ffmpeg    |   | ffmpeg    |       4 vCPU, does the encoding
  +-----------+   +-----------+   +-----------+
```

| | Durable Object (manager) | Container (worker) |
|---|---|---|
| What it is | A small piece of JavaScript code on Cloudflare | Our Docker image (NestJS worker + ffmpeg) |
| Who writes it | Us, in `deploy/cloudflare/` (new code) | Already exists: `server/workers/*` (unchanged) |
| Size | Tiny: no CPU-heavy work | Big: up to 4 vCPU / 12 GiB |
| Job | Start the container, check every 60 s that it's alive, notice when it exits | Take a job from Redis, encode, upload to R2 |
| Knows about videos? | No | Yes |
| How many | One per slot name (`transcode-720p-0`, `-1`, …) | At most one per DO |
| Lifetime | Wakes up when called or when its timer fires | Runs until the work is done and it has been idle for 60 s |

- **Why both:** Cloudflare's rule is that a container always belongs to a DO, which is the only thing that can start, watch or stop it.
- **Pool limit for free:** `TRANSCODE_720P_MAX_PROCESSORS=10` means 10 slot names (`720p-0` … `720p-9`), so there are never more than 10 containers.

### 0.2 One video, start to end

```
 api              Redis            Worker            DO 720p-0             Container 720p-0
  |                 |             (scaler)               |                        |
  |--1. add 720p--->|                 |                  |                        |
  |     job         |                 |                  |                        |
  |--webhook /scale------------------>|                  |                        |
  |                 |                 |--2. "run!"------>|                        |
  |                 |                 |                  |--3. start()----------->|
  |                 |                 |                  |   set 60 s timer       |  boots
  |                 |<---------------------------------------------4. take job-----|
  |                 |                 |                  |                        |  encode
  |                 |                 |                  |                        |  upload -> R2
  |<-------------------------------------------------------- READY (RabbitMQ) ----|
  |                 |                 |                  |--5. timer: alive?----->|
  |                 |                 |                  |<-- yes, stay awake ----|
  |                 |                 |                  |   (repeats every 60 s) |
  |                 |                 |                  |                        |  6. no job
  |                 |                 |                  |                        |  for 60 s
  |                 |                 |                  |<------ exit 0 ---------|  (gone)
  |                 |                 |                  |--7. stop timer, sleep  |
  |                 |                 |                  |   (costs ~nothing)     |
```

| Step | Who | What happens |
|---|---|---|
| 1 | api | Adds a 720p job to Redis and calls the scaler webhook |
| 2 | Worker | Sees a backlog, tells DO `720p-0` to "run" |
| 3 | DO | Starts its container, sets a 60 s timer |
| 4 | Container | Takes the job, encodes, uploads to R2, reports READY |
| 5 | DO | Every 60 s: "still running? OK, stay awake" |
| 6 | Container | No more jobs for 60 s, so it exits |
| 7 | DO | Sees the exit, stops its timer, goes to sleep |

## 1. Platform facts that drive the design

| Fact (Cloudflare docs) | Impact on us |
|---|---|
| Containers are reached only through a Durable Object (DO), `ctx.container.start()` | One DO per replica slot, e.g. `transcode-720p-3` |
| Inbound traffic is HTTP through a Worker only | Workers don't need inbound traffic; they pull from Redis |
| A container stops shortly after its DO is inactive; `setInactivityTimeout()` ≤ 6 h | DO keeps itself active with an alarm every 60 s while the container runs |
| Disk is ephemeral, fresh from the image on every start | Must be fully stateless (main plan PRs 1–5) |
| Largest instance `standard-4` = 4 vCPU / 12 GiB / 20 GB disk | Caps the source file size (~8 GB; see §5) |
| Shutdown: SIGTERM, then SIGKILL after 15 min | Longer encodes are lost on a rollout; BullMQ re-queues them |
| `durable_object` scheduling policy: DO decides when to restart on a new image | Use it, so deploys don't kill running encodes |
| Images must be `linux/amd64`; 50 GB total image storage | Build all 6 images for amd64 |
| Can't run Redis / RabbitMQ / Mongo as always-on containers | Use managed services outside Cloudflare |

## 2. Architecture

```
            browser / frontend
                  | HTTPS
+-----------------v------------------------- Cloudflare -----------------------------+
| +-----------------------------------+  proxy  +--------------------------------+  |
| | processor-scaler Worker           |-------->| ApiContainer 1..N (always on)  |  |
| |  - /*      -> api container       |<--------|  NestJS api, unchanged         |  |
| |  - /scale  (webhook from api)     | webhook +---------------+----------------+  |
| |  - cron */1: backlog + api crons  |  GET backlog            |                   |
| |  - for slot < wanted: ensureRunning ---+                    |                   |
| +-----------------------------------+    | DO slots           |                   |
|                                  +-------v------------------+ |    +-----------+  |
|                                  | worker containers 0..N   |-+--->|    R2     |  |
|                                  |  pull job, R2 in/out,    |      +-----------+  |
|                                  |  status via AMQP, idle   |                     |
|                                  |  N s -> exit 0           |                     |
|                                  +-------------+------------+                     |
+------------------------------------------------|----------------------------------+
                                                 | TCP (api + workers): BullMQ, AMQP, Mongo
                              +------------------v------------------------+
                              | outside Cloudflare: Redis (TLS),          |
                              | RabbitMQ (CloudAMQP, amqps), Mongo (Atlas)|
                              +-------------------------------------------+
```

## 3. One scale-up, step by step

```
api            processor-scaler        DO "transcode-720p-2"       container
 |--add job       |                          |                           |
 |--POST /scale-->|                          |                           |
 |<--GET backlog--|                          |                           |
 |--wanted=3----->|                          |                           |
 |                |--ensureRunning() x3----->|                           |
 |                |                          |--start({env})------------>|
 |                |                          |--set alarm 60s            |
 |                |                          |                           |--take job (Redis)
 |                |                          |<-alarm: running? renew----|--encode, upload R2
 |                |                          |                           |--READY (RabbitMQ)
 |                |                          |                           |--idle 60s -> exit 0
 |                |                          |<-monitor() resolves-------|
 |                |                          |  stop alarm (slot free)   |
 |--(cron */1 repeats the same loop as a backstop if a webhook is lost)  |
```

## 4. Container classes and instance types

There is one container class per image (6 classes). A pool is a class + start env + slot prefix.

| Pool | Class / image | Start env | Instance type (start with) | Max (env) |
|---|---|---|---|---|
| download | `DownloadContainer` / download-video-worker | — | standard-1 | `DOWNLOAD_MAX_PROCESSORS=10` |
| validate | `ValidateContainer` / validate-video-worker | — | basic | `VALIDATE_MAX_PROCESSORS=10` |
| thumbnail | `ThumbnailContainer` / thumbnail-generation-worker | — | standard-1 | `THUMBNAIL_MAX_PROCESSORS=10` |
| transcode-720p | `ProcessVideoContainer` / process-video-worker | `WORKER_ROLE=transcode PROCESSOR_HEIGHT=720` | standard-4 | `TRANSCODE_720P_MAX_PROCESSORS=10` |
| transcode-540p | same | `… PROCESSOR_HEIGHT=540` | standard-4 | `TRANSCODE_540P_MAX_PROCESSORS=10` |
| transcode-480p | same | `… PROCESSOR_HEIGHT=480` | standard-3 | `TRANSCODE_480P_MAX_PROCESSORS=10` |
| mp4 | same | `WORKER_ROLE=mp4` | standard-2 | `MP4_MAX_PROCESSORS=3` |
| upload | `UploadContainer` / upload-video-worker | — | standard-1 | `UPLOAD_MAX_PROCESSORS=3` |
| audio | `AudioContainer` / audio-worker | — | standard-2 | `AUDIO_MAX_PROCESSORS=5` |
| api (always on) | `ApiContainer` / api | — | standard-1 | `API_REPLICAS=1` (min 1, never 0) |

- `instance_type` is set per class, so all transcode heights share the largest type. If 480p needs a smaller type, split it into its own class.
- `max_instances` per class must be ≥ the sum of its pools' maxes (`ProcessVideoContainer` = 10+10+10+3 = 33).
- Slot names are fixed (`transcode-720p-0 … -9`), so `getByName()` can never exceed the pool max.

## 5. Limits to enforce in the app

| Limit | Value | Where to enforce |
|---|---|---|
| Disk per container (standard-4) | 20 GB including image | validate-video-worker rejects sources > `MAX_SOURCE_SIZE_GB` (default 8) |
| SIGTERM → SIGKILL | 15 min | Graceful `worker.close()`; a longer job is re-queued by BullMQ |
| Outbound HTTP body through an outbound handler | 100 MiB | Don't intercept outbound traffic; use multipart S3 uploads |
| Cold start | ~1–3 s plus Nest boot | Acceptable for VOD |

## 6. Files

```diff
+ deploy/cloudflare/processor-scaler/wrangler.jsonc        6 container classes, DO bindings, cron "*/1 * * * *"
+ deploy/cloudflare/processor-scaler/src/index.ts          fetch (/scale) + scheduled (cron) -> scaleAll()
+ deploy/cloudflare/processor-scaler/src/scale-pools.ts    backlog -> ensureRunning on slots 0..wanted-1
+ deploy/cloudflare/processor-scaler/src/pool-config.ts    pool -> class, start env, slot prefix
+ deploy/cloudflare/processor-scaler/src/pool-container.ts DO: ensureRunning, alarm keep-alive, monitor()
+ deploy/cloudflare/processor-scaler/src/api-container.ts  DO: always-on api, restart on exit, HTTP proxy
+ deploy/cloudflare/processor-scaler/src/api-proxy.ts      route non-/scale requests to an api slot
+ deploy/cloudflare/processor-scaler/src/api-crons.ts      cron -> cleanup-device, verify-bullmq-jobs
+ deploy/cloudflare/processor-scaler/README.md             secrets, deploy, smoke test
+ deploy/cloudflare/spike/                                 throwaway TCP egress test (CF-0)
```

`wrangler.jsonc` shape (one entry per class):

```jsonc
"containers": [
  { "class_name": "ProcessVideoContainer",
    "image": "../../../server/workers/process-video-worker/Dockerfile",
    "instance_type": "standard-4", "max_instances": 33 }
]
```

## 7. Env and secrets

| Name | Set on | Example |
|---|---|---|
| `API_BASE_URL` | scaler (var) | empty = call the api container directly (no public hop) |
| `API_REPLICAS` | scaler (var) | `1` |
| api env (Mongo URL, JWT secret, GenAI keys, all `BULL_*`, …) | scaler secret → api container env | same as today's `server/.env` |
| `INTERNAL_API_TOKEN` | scaler + api (secret) | bearer for `GET /internal/processors/backlog` |
| `SCALE_WEBHOOK_TOKEN` | scaler + api (secret) | bearer for `POST /scale` |
| `SCALE_WEBHOOK_URL` | api | `https://processor-scaler.<acct>.workers.dev/scale` |
| `REDIS_HOST/PORT/USERNAME/PASSWORD`, `REDIS_TLS=true` | scaler secret → container env | Upstash / Redis Cloud |
| `RABBIT_MQ_URL` (amqps) | scaler secret → container env | CloudAMQP |
| `STORAGE_PROVIDER=s3`, `S3_ENDPOINT`, keys, bucket | scaler secret → container env | `https://<acct>.r2.cloudflarestorage.com` |
| `WORKER_IDLE_EXIT_SEC=60` | container env | idle exit |
| all `BULL_*` queue names | container env | same values as the api |

The scaler passes the container env in `start({ env })`, built from its own secrets plus the pool's start env.

## 8. PR order (Cloudflare first)

| Step | PR | Done when |
|---|---|---|
| CF-0 | Spike: 1 container on `standard-1` connects to Redis TLS, CloudAMQP and Atlas | It logs a successful ping to all 3 |
| 0–6 | Main plan: stateless core + scale contract | 1 upload → `READY` on docker-compose with R2, no shared disk |
| CF-1 | Scaler + 1 pool (`transcode-720p`) | 3 uploads → 3 containers → 0 after idle |
| CF-2 | All 9 pools | Full pipeline on Cloudflare: upload → `READY` |
| CF-3 | Hardening: `durable_object` policy, size limit, logs | Deploying the scaler mid-encode doesn't lose the job |
| CF-4 | api container + proxy + crons (§9) | Frontend works against the Worker URL; VM switched off |
| later | Kubernetes + KEDA (`deploy/kubernetes`) | Reuses the same backlog endpoint |

## 9. API on Cloudflare

The api runs unchanged as `ApiContainer`. The same Worker proxies HTTP to it and keeps it on.

| Topic | Problem | Fix |
|---|---|---|
| Staying on | Container stops when its DO goes idle | DO alarm every 60 s, never exits; restarts the container if `monitor()` sees it stop |
| Status events | Pipeline only advances while the api consumes RabbitMQ events | Always on; durable queues hold events during a restart |
| Uploads (tus) | Worker request body limit (~100 MB on Free / Pro) | tus `chunkSize` ≤ 50 MB now; later: browser → R2 presigned multipart upload |
| ffmpeg in api | `splitAudio` uses local disk | Moved to audio-worker (main plan PR 4) |
| Local disk | Wiped on every restart | Removed from the api (main plan PR 5) |
| Deploys | New image restarts the container | Few seconds of downtime; fine once the api is stateless |
| Cron endpoints | Called by `server/scripts/*.sh` today | Worker `scheduled` handler calls them |
| Scale out | — | `API_REPLICAS` slots; Worker picks one per request |
| Cost | Billed while running | One `standard-1` running 24/7 |

Not an option: rewriting the api as a native Worker. NestJS, Mongoose and BullMQ need TCP and Node APIs, so the api stays a container.

## 10. Open questions

| # | Question | Default if no answer |
|---|---|---|
| 1 | ~~Where does the api run?~~ | Decided: always-on Cloudflare container (§9) |
| 2 | Managed Redis: Upstash or Redis Cloud? (BullMQ needs a regular TCP Redis, not Upstash REST) | Redis Cloud |
| 3 | Max source size we accept? | 8 GB |
| 4 | Is the 15-min SIGKILL on rollout acceptable for long encodes? | Yes, with BullMQ retry |

## 11. Checklist

- [ ] CF-0 spike passes (Redis, AMQP, Mongo over TCP).
- [ ] Set tus `chunkSize` ≤ 50 MB in the frontend Uppy config.
- [ ] Main plan PRs 0–6 merged.
- [ ] Create the R2 bucket and an S3 API token.
- [ ] Provision managed Redis, RabbitMQ and Mongo.
- [ ] `wrangler secret put` every secret in §7.
- [ ] `wrangler deploy` the scaler; set `SCALE_WEBHOOK_URL` on the api.
- [ ] Smoke test: 10 uploads → `wrangler containers list` shows 30 transcode containers → 0.
- [ ] CF-4: point the frontend at the Worker URL, check login + upload + playback, then switch off the VM.
