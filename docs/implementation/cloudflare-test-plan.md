# Cloudflare deployment — test plan

How to check that the Cloudflare deployment (`deploy/cloudflare/`) works: backend (processor-scaler + api + worker containers) and frontend (`vdio-touch-web`). Related: [cloudflare-containers-plan.md](./cloudflare-containers-plan.md), [frontend-deploy-plan.md](./frontend-deploy-plan.md), [deploy/cloudflare/README.md](../../deploy/cloudflare/README.md).

## TL;DR

- Test in four stages, in order; each only makes sense once the previous one passes.
- Stage 3 (one real video, from import to `READY` and back to 0 containers) is the test that proves it works.
- Keep `npm run scaler:tail` open from stage 2 on: almost every failure shows up there first.
- All four stages pass → the deployment works.

```
1. Connection test (CF-0)  ->  2. API + scaler  ->  3. One video end to end  ->  4. Frontend
   can containers reach        is the API up,        do containers start,         does the site load
   Redis / RabbitMQ / Mongo?   does scaling answer?  work, and stop again?        and talk to the API?
```

| Placeholder | Meaning |
|---|---|
| `<scaler>` | processor-scaler URL: `https://vdio-touch-processor-scaler.<account>.workers.dev` or `https://api.<domain>` |
| `<web>` | frontend URL: `https://vdio-touch-web.<account>.workers.dev` or `https://app.<domain>` |
| `$INTERNAL_API_KEY`, `$SCALE_WEBHOOK_TOKEN` | the secrets set on the scaler |

Run every `npm` / `npx` command from `deploy/cloudflare`.

## 1. Connection test (CF-0)

```bash
npm run spike:deploy
curl https://vdio-touch-connectivity-spike.<account>.workers.dev/
```

| Check | Pass |
|---|---|
| `redis` | `"ok": true`, reply contains `+PONG` |
| `rabbitmq` | `"ok": true`, reply `connected` |
| `mongodb` | `"ok": true`, reply `connected` |

Any `"ok": false` → stop; the backend can't work.

| Failure | Likely cause |
|---|---|
| Timeout | No public endpoint (e.g. AWS ElastiCache / Google Memorystore are private-only), or firewall / IP allow-list (Atlas: allow `0.0.0.0/0` while testing) |
| TLS / handshake error | `REDIS_TLS` wrong, or `amqp://` used where the broker needs `amqps://` |
| Redis `-NOAUTH` / `-WRONGPASS` | `REDIS_USERNAME` / `REDIS_PASSWORD` |

## 2. API and scaler

```bash
npm run scaler:tail        # keep this open for every stage from here on
```

| # | Test | Command | Pass |
|---|---|---|---|
| 2.1 | API container starts | `curl -i <scaler>/api-doc` (first call can take up to ~90 s) | Any HTTP answer (401 from Swagger basic auth is fine); logs show `api-0: container started` |
| 2.2 | Backlog endpoint | `curl <scaler>/api/v1/processors/backlog -H "x-internal-api-key: $INTERNAL_API_KEY"` | `{"pools":[…]}` with every pool, `wanted: 0` while idle |
| 2.3 | Endpoint is protected | Same, without the header | `401` |
| 2.4 | Scale webhook | `curl -X POST <scaler>/__scaler/scale -H "Authorization: Bearer $SCALE_WEBHOOK_TOKEN" -d '{"pool":"download"}'` | `{"pool":"download","wanted":0,"running":0,"started":[]}` |
| 2.5 | Webhook is protected | Same, with a wrong token | `401` |
| 2.6 | Cron runs | Watch the logs 1–2 minutes | One run per minute, no `cron step … failed` |
| 2.7 | Only the api runs | `npm run scaler:containers` | Only `api` instances |

## 3. One video end to end

Import a short video link (1–2 min, 720p or 1080p) from the frontend or the api; turn transcription on if you use it.

### 3.1 What to watch

| Where | What you should see |
|---|---|
| Logs (`scaler:tail`) | `scaled download: wanted 1 … started [download-0]`, then validate, thumbnail, upload, transcode-720p / 540p / 480p, audio, mp4 |
| Backlog (`curl …/processors/backlog`) | `wanted` > 0 per pool while it works, back to 0 after |
| Containers (`npm run scaler:containers`) | Pool containers appear next to `api`, then disappear |
| R2 bucket (dashboard → R2 → bucket) | The keys below, in this order |

```
sources/{id}/source.mp4                      after download
videos/{id}/720/  540/  480/  (.m3u8 + .ts)  after each transcode
videos/{id}/main.m3u8                        first rendition READY; lists every READY rendition
videos/{id}/<thumbnail>, videos/{id}/<name>  thumbnail, source copy (upload), mp4
audio/{id}/chunks/*.mp3                      only with transcription
audio/{id}/transcripts/*.json                only with transcription
```

### 3.2 Pass criteria

| # | Pass |
|---|---|
| 3.1 | Asset reaches `READY`; every file reaches READY |
| 3.2 | Video plays; quality menu shows 720 / 540 / 480 (only rungs ≤ the source height) |
| 3.3 | MP4 download works; transcript exists if transcription was on |
| 3.4 | **Scale down:** ~1–2 min after the last job, `scaler:containers` shows only `api`; logs show `container exited` / `slot is free` |
| 3.5 | **Cleanup:** after the hourly cron, `sources/{id}/` and `audio/{id}/` are gone; `videos/{id}/` stays |

## 4. Frontend

| # | Test | Pass |
|---|---|---|
| 4.1 | `curl <web>/runtime-env.js` | Your settings; the API URL is complete (not cut at `https:`) |
| 4.2 | `curl -I <web>/runtime-env.js` | `cache-control: no-store` |
| 4.3 | `curl -I <web>/assets/<any file>.js` | `cache-control: public, max-age=31536000, immutable` |
| 4.4 | Open `<web>/videos/anything` and reload | The app loads, not a Cloudflare 404 |
| 4.5 | Browser dev tools → Network → log in | Requests go to the API URL from 4.1 and succeed; no CORS errors |
| 4.6 | Import, list and play a video from the UI | Same result as stage 3 |

## 5. If something fails

| Symptom | Likely cause | Where to look |
|---|---|---|
| First api request times out | api container still booting, or it can't reach Mongo / Redis / RabbitMQ | Logs; re-run stage 1 |
| `wanted` > 0 but nothing starts | Pool max is 0, `max_instances` too low, or an image failed to build / deploy | `processor-scaler/wrangler.jsonc`, deploy output |
| Container starts then exits at once | Missing setting (e.g. `BULL_PROCESS_VIDEO_JOB_QUEUE`, `TEMP_VIDEO_DIRECTORY`, `STORAGE_PROVIDER`) | Logs; `secrets.json` |
| Stuck at `VALIDATED` / `PROCESSING` | Worker can't reach R2 (keys / endpoint), or a job was lost | Logs; `POST <scaler>/api/v1/cron-jobs/verify-bullmq-jobs` |
| Asset READY but the player fails | `main.m3u8` missing (`error while writing master playlist`), or wrong CDN base URL | Logs; R2 `videos/{id}/` |
| Containers never go back to 0 | `WORKER_IDLE_EXIT_SEC` not reaching the containers (scaler var should be `60`) | `processor-scaler/wrangler.jsonc` vars |
| Frontend calls the wrong API / CORS errors | Wrong `NEXT_PUBLIC_VIDEO_TOUCH_API_URL`, or the CI `--var` override cut the URL at `:` | `<web>/runtime-env.js`; keep the URL in `frontend/wrangler.jsonc` |

## 6. Checklist

- [ ] Stage 1: Redis, RabbitMQ and MongoDB all `"ok": true`
- [ ] Stage 2: api up, backlog and webhook answer, both reject bad credentials, cron runs
- [ ] Stage 3: one video → `READY`, plays, MP4 / transcript, containers back to 0, working files cleaned
- [ ] Stage 4: `runtime-env.js` correct, cache headers, deep-link reload, login and playback from the UI
