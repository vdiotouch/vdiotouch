# Cloudflare Containers adapter

Runs the api and all six workers on Cloudflare Containers. Worker pools scale from 0 to a max set in env. Design: [docs/implementation/cloudflare-containers-plan.md](../../docs/implementation/cloudflare-containers-plan.md).

## TL;DR

- `spike/` (CF-0): a single throwaway container that checks outbound TCP to Redis, RabbitMQ and MongoDB. Run it first.
- `processor-scaler/` (CF-1 to CF-4): one Worker that is the api's public URL, starts worker containers when the api reports a backlog, and runs the api's cron jobs.
- `frontend/` (F-1): the dashboard on Workers Static Assets, plus a tiny Worker for `/runtime-env.js`. See "Frontend" below.
- `server/` stays cloud-neutral. The scaler only uses `GET /api/v1/processors/backlog` and the optional scale webhook.
- **Stateless:** since main plan PR 5 no container shares a disk; every file goes through the bucket (s3 or r2), so a video can go from import to `READY` here.

## Layout

| Path | What it is |
|---|---|
| `spike/container/connectivity-check.js` | Container: `GET /check` → TCP / TLS check to Redis (PING), RabbitMQ, MongoDB |
| `spike/src/index.ts` | Worker: `GET /` starts the container and returns its report |
| `processor-scaler/src/index.ts` | Worker entry: webhook route, api proxy, cron |
| `processor-scaler/src/env.ts` | Bindings, vars and secrets |
| `processor-scaler/src/pools.ts` | Pool name → image binding + extra env |
| `processor-scaler/src/scale-pools.ts` | Backlog → start free slots until `wanted` are running |
| `processor-scaler/src/pool-container.ts` | Durable Object per worker slot (`transcode-720p-3`) |
| `processor-scaler/src/api-container.ts` | Durable Object per api replica (`api-0`), always on, proxies HTTP |
| `processor-scaler/src/container-lifecycle.ts` | Start, keep-alive alarm, wait for port |
| `processor-scaler/src/container-env.ts` | Worker vars / secrets → container env |
| `processor-scaler/src/api-client.ts` | Calls the api through its container (no public hop) |
| `processor-scaler/src/crons.ts` | Every minute: scale; every 5 min: SLA + job verification; hourly: cleanup |

## How it works

```
                       Worker: processor-scaler
browser ---HTTPS---> | /__scaler/scale (POST) ---> scale one pool        |
                     | anything else ----------> ApiContainer "api-N"    |---> api container
api ---webhook-----> |                                                    |
cron (1 / 5 / 60m) > | GET /api/v1/processors/backlog (via api container) |
                     |   for each pool: start free slots until            |
                     |   running >= wanted                                |
                     +-----------------------+----------------------------+
                                             | start({ env })
                                             v
                     PoolContainer "transcode-720p-0..9" ---> worker container
                       alarm every 60 s: keep alive         | pull job (Redis), work,
                       container exits -> slot free         | idle 60 s -> exit 0
```

| Rule | Where |
|---|---|
| `wanted = min(waiting + active, max)` per pool | api `ProcessorBacklogService` |
| The scaler only **starts** containers; workers stop themselves when idle | `scale-pools.ts`, worker `WorkerIdleExitService` |
| Fixed slot names `<pool>-0 … <pool>-<max-1>` cap the pool at `max` | `scale-pools.ts` |
| The api never scales to 0; its alarm restarts it if it stops | `api-container.ts` |
| Container env = every Worker var / secret + the pool's overrides | `container-env.ts`, `pools.ts` |

## Pools

| Pool | Container (image) | Extra env | Max env (api) |
|---|---|---|---|
| download | `download` | — | `DOWNLOAD_MAX_PROCESSORS` |
| validate | `validate` | — | `VALIDATE_MAX_PROCESSORS` |
| thumbnail | `thumbnail` | — | `THUMBNAIL_MAX_PROCESSORS` |
| transcode-1080p / 720p / 540p / 480p / 360p | `process-video` | `WORKER_ROLE=transcode`, `BULL_PROCESS_VIDEO_JOB_QUEUE=<pool queue>` | `TRANSCODE_<H>P_MAX_PROCESSORS` |
| mp4 | `process-video` | `WORKER_ROLE=mp4` | `MP4_MAX_PROCESSORS` |
| upload | `upload` | — | `UPLOAD_MAX_PROCESSORS` |
| audio | `audio` | — | `AUDIO_MAX_PROCESSORS` |

`max_instances` of a container in `wrangler.jsonc` must be ≥ the sum of its pools' maxes.

## Settings

| Name | Where | Value |
|---|---|---|
| `API_REPLICAS` | var | `1` (api containers kept running) |
| `API_PORT` | var | `3000` |
| `WORKER_IDLE_EXIT_SEC` | var → containers | `60` |
| `REDIS_TLS` | var → containers | `true` |
| `INTERNAL_API_KEY` | secret → containers | Same key the api checks (`x-internal-api-key`) |
| `SCALE_WEBHOOK_TOKEN` | secret → containers | Bearer for `POST /__scaler/scale` |
| `SCALE_WEBHOOK_URL` | secret → api | `https://<scaler host>/__scaler/scale` |
| Everything in `server/.env` | secrets → containers | Mongo, RabbitMQ (`amqps://`), Redis, R2, JWT, GenAI, all `BULL_*`, … |
| `BULL_PROCESS_VIDEO_JOB_QUEUE` | secret → containers | Any queue name; process-video-worker's config requires it, transcode pools override it |

Limits: Containers need the Workers Paid plan. A Worker has at most 128 vars + secrets, each ≤ 5 KB, so leave out keys you don't use (e.g. Bunny / Gotipath).

## Run it

```bash
cd deploy/cloudflare
npm install
npm run typecheck

# CF-0: connectivity spike
npx wrangler secret bulk spike-secrets.json --config spike/wrangler.jsonc   # REDIS_*, RABBIT_MQ_URL, MONGO_DB_URL
npm run spike:deploy
curl https://vdio-touch-connectivity-spike.<account>.workers.dev/          # every result needs "ok": true

# CF-1..4: scaler + api
npm run scaler:secrets -- secrets.json     # JSON object built from server/.env (never commit it)
npm run scaler:deploy
npm run scaler:tail                         # logs
npm run scaler:containers                   # running containers
```

## Checklist

- [ ] CF-0 spike: Redis, RabbitMQ and MongoDB all report `"ok": true`.
- [x] Main plan PRs 1–5 merged (workers stateless on R2).
- [ ] `secrets.json` has every key the api and workers read, plus `INTERNAL_API_KEY`, `SCALE_WEBHOOK_TOKEN`, `SCALE_WEBHOOK_URL`, `BULL_PROCESS_VIDEO_JOB_QUEUE`.
- [ ] After deploy: `GET https://<scaler host>/api/v1/processors/backlog` with `x-internal-api-key` returns all pools.
- [ ] Upload 1 video → `scaler:containers` shows the pools start → they go back to 0 after ~1–2 min idle.
- [ ] Point the frontend at the scaler URL; check login, upload, playback.

## Frontend

The dashboard (`frontend/`, a Vite single-page app) on Cloudflare. Plan and diagrams: [docs/implementation/frontend-deploy-plan.md](../../docs/implementation/frontend-deploy-plan.md).

```
browser --> app.<domain> (Worker "vdio-touch-web")
              |-- /runtime-env.js --> Worker code: settings from vars (no-store)
              '-- everything else --> Static Assets: frontend/dist/ (unknown path -> index.html)
```

| File | What it is |
|---|---|
| `frontend/wrangler.jsonc` | Static Assets (`../../../frontend/dist`, SPA fallback, Worker only for `/runtime-env.js`), the six runtime vars, optional custom domain |
| `frontend/src/index.ts` | Builds `window.__RUNTIME_CONFIG__` from a fixed list of vars; nothing else reaches the browser |
| `../../frontend/public/_headers` | Cache rules for Static Assets: `/assets/*` 1 year, everything else `no-cache` (nginx ignores it) |

| Var | Example |
|---|---|
| `NEXT_PUBLIC_VIDEO_TOUCH_API_URL` | `https://api.<domain>` (the processor-scaler URL) |
| `NEXT_PUBLIC_VIDEO_LIST_PAGE_SIZE` | `10` |
| `NEXT_PUBLIC_UPDATE_DATA_INTERVAL_IN_SECONDS` | `5` |
| `AUTH_COOKIE_REFRESH` | `false` |
| `SUPPORT_EMAIL` | `support@<domain>` |
| `MAX_VIDEO_SIZE_MB` | `113` (match the api's `MAX_VIDEO_SIZE_IN_BYTES`) |

These six keys are also listed in `frontend/src/shared/lib/config.ts` and `frontend/docker/entrypoint.sh`; add a new key to all three.

```bash
cd deploy/cloudflare
npm install
# edit frontend/wrangler.jsonc: vars (API URL…) and, once the zone is on Cloudflare, "routes"
npm run web:deploy        # builds frontend/ then uploads dist/ + the Worker
curl https://<site>/runtime-env.js   # shows your values
npm run web:rollback      # previous version, if needed
```

- [ ] `/runtime-env.js` shows the right API URL.
- [ ] Reload on a deep link (e.g. `/videos/<id>`) shows the page, not a 404.
- [ ] Log in, list videos, open one, play it.

### Deploy from CI (F-2)

`.github/workflows/deploy-frontend-cloudflare.yml` runs the same `web:build` + `wrangler deploy` on GitHub.

```
GitHub release 2026.11.1 (or "Run workflow")
  -> check CLOUDFLARE_FRONTEND_DEPLOY == "true"   (else skipped)
  -> check CalVer tag                             (release only)
  -> npm install (deploy/cloudflare), npm run web:build (frontend)
  -> wrangler deploy --config frontend/wrangler.jsonc [--var overrides] --message <tag>
```

| GitHub setting | Kind | Value |
|---|---|---|
| `CLOUDFLARE_FRONTEND_DEPLOY` | Repo variable | `true` to turn the job on |
| `CLOUDFLARE_API_TOKEN` | Secret | API token with "Edit Cloudflare Workers" permission |
| `CLOUDFLARE_ACCOUNT_ID` | Secret | Cloudflare account id |
| `NEXT_PUBLIC_VIDEO_TOUCH_API_URL`, … (the six vars above) | Repo variables, optional | Override the `wrangler.jsonc` value for CI deploys; empty = keep the file's value |

| Trigger | When |
|---|---|
| `release: published` | With every CalVer release, next to the Docker image build |
| `workflow_dispatch` | By hand from the Actions tab (redeploy after a var change) |

Rollback still works the same: `npm run web:rollback`, or pick an older deployment in the Cloudflare dashboard (each one is labelled with its release tag).
