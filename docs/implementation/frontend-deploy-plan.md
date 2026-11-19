# Frontend deploy plan — Cloudflare (VM stays manual)

## TL;DR

- The frontend is a static Vite + React single-page app (SPA): deploying it means serving `dist/` with an SPA fallback, plus one runtime file, `/runtime-env.js`.
- **VM (any cloud):** no new files. Run the existing `frontend/docker-compose.yml` and put your own nginx in front of it, by hand (§2).
- **Cloudflare (the focus):** Workers Static Assets serve `dist/`, and a tiny Worker answers only `/runtime-env.js`, built from Worker vars. New: `deploy/cloudflare/frontend/`.
- `frontend/` stays platform-neutral. The only file added there is `public/_headers`, which nginx ignores.
- One build serves every environment: the API URL and other settings are read at runtime, never baked into the build.

## 1. What exists today

| Piece | File | What it does |
|---|---|---|
| Build | `npm run build` → `frontend/dist/` | `tsc -b && vite build`; hashed files in `dist/assets/` |
| Runtime config | `src/shared/lib/config.ts` | Reads `window.__RUNTIME_CONFIG__` from `/runtime-env.js`, falls back to `VITE_*` in dev |
| `index.html` | `<script src="/runtime-env.js">` | Loads the runtime config before the app |
| Image + compose | `frontend/Dockerfile`, `frontend/docker-compose.yml` | nginx on port 3000, `3009:3000`; the entrypoint writes `runtime-env.js` from env |
| CI | `.github/workflows/release-images-ci.yml` | Builds and pushes the frontend image on a CalVer release |

Runtime settings, the same on every platform:

| Key (runtime name) | Example | Meaning |
|---|---|---|
| `NEXT_PUBLIC_VIDEO_TOUCH_API_URL` | `https://api.example.com` | API base URL (required) |
| `NEXT_PUBLIC_VIDEO_LIST_PAGE_SIZE` | `10` | Videos per page |
| `NEXT_PUBLIC_UPDATE_DATA_INTERVAL_IN_SECONDS` | `5` | Polling interval |
| `AUTH_COOKIE_REFRESH` | `false` | `true` once the API issues an httpOnly refresh cookie |
| `SUPPORT_EMAIL` | `support@example.com` | "Contact support" links |
| `MAX_VIDEO_SIZE_MB` | `113` | "Max file size" hint; match the API's `MAX_VIDEO_SIZE_IN_BYTES` |

## 2. VM (manual, no new files)

```
browser --HTTPS--> your nginx (host, TLS)  --proxy_pass-->  127.0.0.1:3009  (frontend/docker-compose.yml)
```

| Step | Action |
|---|---|
| 1 | `cd frontend && cp .env.example .env`, set the keys from §1 |
| 2 | `docker compose up -d --build` |
| 3 | Host nginx: `proxy_pass http://127.0.0.1:3009;` for `app.<domain>`, TLS as you already do |

The container already does the SPA fallback and the cache headers; the host nginx only proxies.

## 3. Cloudflare

### 3.0 Cloudflare components we use (and why)

The frontend is a folder of files (`index.html`, JS, CSS, logo) that has to reach browsers. Four Cloudflare pieces do that:

| # | Component | What it is, simply | What it does for us | Why we need it |
|---|---|---|---|---|
| 1 | **Workers Static Assets** | Cloudflare's file hosting | Stores the built `dist/` folder and sends the files to browsers from the nearest edge location | Replaces nginx: no VM, no container; free for static files |
| 2 | **Worker** (a few lines of code) | A small function Cloudflare runs on demand | Answers only `/runtime-env.js`, with the API URL and the other settings from its vars | The app reads its settings from that file; generating it keeps one build for dev / staging / prod (what `entrypoint.sh` does on the VM) |
| 3 | **Custom domain** | Your domain pointed at Cloudflare | Makes `app.<domain>` open this site | Real address, HTTPS certificate handled by Cloudflare |
| 4 | **Wrangler** | Cloudflare's CLI | `wrangler deploy` uploads the files and the Worker in one step | How we deploy; nothing to SSH into |

```
                 Cloudflare
              +-------------------------------------------+
browser ----> | app.<domain>  (3. custom domain)          |
              |    |                                      |
              |    |-- /runtime-env.js --> 2. Worker      |  "here are the settings"
              |    |                                      |
              |    '-- everything else --> 1. Static      |  "here are the app files"
              |                               Assets      |
              +-------------------------------------------+
                        ^
   4. wrangler deploy --'   (uploads dist/ + the Worker)
```

| On the VM | On Cloudflare |
|---|---|
| nginx serves the files | Static Assets serves the files |
| `entrypoint.sh` writes `runtime-env.js` | The Worker writes `runtime-env.js` |
| Your domain + nginx TLS | Custom domain, automatic HTTPS |
| `docker compose up` | `wrangler deploy` |

Not used: Cloudflare Pages (Cloudflare points new sites to Workers instead), Containers, databases, R2 — those are only for the backend.

### 3.1 The idea in one picture: same job as nginx, different machine

On a VM, one nginx container does three jobs. On Cloudflare, the same three jobs are split between Cloudflare's file hosting and a few lines of Worker code:

| Job | VM (nginx container) | Cloudflare |
|---|---|---|
| Serve the built files (`index.html`, `assets/*.js`, logo…) | nginx reads `/usr/share/nginx/html` | **Static Assets**: the `dist/` folder, uploaded once at deploy, served from Cloudflare's edge |
| Unknown path (e.g. `/videos/123`) → `index.html`, so a page reload works | `try_files $uri /index.html` | `not_found_handling: "single-page-application"` |
| Produce `/runtime-env.js` (API URL etc.) | `entrypoint.sh` writes the file at container start from env | **Worker code** builds it on each request from the Worker's vars |

Nothing about the app changes: the browser gets the same files and the same `runtime-env.js` either way.

### 3.2 What gets uploaded at deploy time

```
your laptop / CI
  1. npm run build            --> frontend/dist/
                                    index.html
                                    runtime-env.js        (placeholder, never served on Cloudflare)
                                    _headers              (cache rules, from public/)
                                    logo.svg, ...
                                    assets/index-a1b2c3.js, assets/index-d4e5f6.css
  2. wrangler deploy          --> uploads two things to Cloudflare:
                                    a) every file in dist/        -> "Static Assets"
                                    b) src/index.ts (bundled)     -> the Worker script, with its vars
  3. Cloudflare               --> app.<domain> now points at this Worker + its assets
```

No server, container or VM is involved: Cloudflare stores the files and runs the Worker on demand in its edge locations.

### 3.3 What happens when a user opens the site

```
Browser                           Cloudflare edge (app.<domain>)                  api.<domain>
   |                                     |                                              |
   |--1. GET /videos/123---------------->|  no file /videos/123 in dist/                 |
   |                                     |  SPA fallback -> index.html                   |
   |<---------- index.html (no-cache) ---|  (served from Static Assets, Worker not run)  |
   |                                     |                                              |
   |--2. GET /runtime-env.js------------>|  path is in run_worker_first                  |
   |                                     |  -> Worker runs: reads vars, writes           |
   |                                     |     window.__RUNTIME_CONFIG__ = {...}          |
   |<---- runtime-env.js (no-store) -----|                                              |
   |                                     |                                              |
   |--3. GET /assets/index-a1b2c3.js---->|  file exists -> Static Assets                 |
   |<---- JS bundle (cache 1 year) ------|  (Worker not run)                             |
   |                                     |                                              |
   |  4. React starts, router shows /videos/123, config.apiUrl = https://api.<domain>   |
   |                                                                                    |
   |--5. POST /graphql, /api/v1/... ---------------------------------------------------->|
   |<------------------------------------------------------------------ JSON -----------|
```

| Step | Served by | Runs Worker code? | Cached by browser |
|---|---|---|---|
| 1. Page (`index.html`, also for any app route) | Static Assets, SPA fallback | No | No (`no-cache`: always checks for a new deploy) |
| 2. `/runtime-env.js` | Worker | **Yes** (the only path that does) | No (`no-store`) |
| 3. `/assets/*` (JS, CSS) | Static Assets | No | 1 year (file names change on every build) |
| 4. App start | Browser | — | — |
| 5. API calls | `api.<domain>` (processor-scaler → API container) | Not this Worker | — |

### 3.4 Why a Worker just for `/runtime-env.js`

| Option | Problem |
|---|---|
| Bake the API URL into the build (`VITE_*`) | A new build per environment (dev / staging / prod) |
| Upload a hand-written `runtime-env.js` in `dist/` | Changing a setting means rebuilding and re-uploading the files |
| **Worker reads vars** (chosen) | Change a var in `wrangler.jsonc` or the dashboard → redeploy the Worker → new value live, same files |

This is the same "one build, settings at runtime" idea the Docker image's `entrypoint.sh` already uses.

### 3.5 What happens on a new deploy

```
deploy N+1
  index.html          -> new (points to assets/index-NEW.js)
  assets/index-NEW.js -> new file
  assets/index-OLD.js -> gone from the new version
browser with the site open
  next navigation / reload: index.html is no-cache -> gets the new one -> loads index-NEW.js
```

Users never mix old and new files: `index.html` is always re-checked, and each build's JS has a unique name.

### 3.6 Request routing summary

```
browser --HTTPS--> app.<domain>  (Worker "vdio-touch-web", custom domain)
                     |
                     |-- GET /runtime-env.js  --> Worker code: window.__RUNTIME_CONFIG__ from vars (no-store)
                     |-- GET /assets/*.js     --> static asset (cached 1 year, immutable)
                     |-- GET /videos/123      --> no file -> index.html (SPA fallback, no-cache)
                     v
app calls https://api.<domain>  --> processor-scaler Worker --> api container
```

| Cloudflare piece | What it does here | Cost |
|---|---|---|
| Workers Static Assets | Serves `frontend/dist/` | Free, no cap |
| Worker script | Only `/runtime-env.js` (`run_worker_first: ["/runtime-env.js"]`) | 1 Worker request per page load |
| `_headers` | Cache rules for static files | Free |
| Custom domain | `app.<domain>` | Free |

On the free plan, `run_worker_first` requests count against the Worker free limit; once it is exceeded they return 429. That is one request per page load, so it only matters at very high traffic.

### 3.7 Files

```diff
+ deploy/cloudflare/frontend/wrangler.jsonc   name, assets (dir, SPA fallback, run_worker_first), vars, custom domain
+ deploy/cloudflare/frontend/src/index.ts     GET /runtime-env.js -> script from vars; else env.ASSETS.fetch
+ frontend/public/_headers                    cache rules (copied to dist/ by Vite; nginx ignores it)
~ deploy/cloudflare/package.json              + web:build, web:deploy scripts
~ deploy/cloudflare/tsconfig.json             + frontend/src
~ deploy/cloudflare/README.md                 + "Frontend" section
```

`wrangler.jsonc` shape:

```jsonc
{
  "name": "vdio-touch-web",
  "main": "src/index.ts",
  "compatibility_date": "2026-11-01",
  "assets": {
    "directory": "../../../frontend/dist",
    "binding": "ASSETS",
    "not_found_handling": "single-page-application",
    "run_worker_first": ["/runtime-env.js"]
  },
  "vars": {
    "NEXT_PUBLIC_VIDEO_TOUCH_API_URL": "https://api.example.com",
    "NEXT_PUBLIC_VIDEO_LIST_PAGE_SIZE": "10",
    "NEXT_PUBLIC_UPDATE_DATA_INTERVAL_IN_SECONDS": "5",
    "AUTH_COOKIE_REFRESH": "false",
    "SUPPORT_EMAIL": "",
    "MAX_VIDEO_SIZE_MB": ""
  },
  "routes": [{ "pattern": "app.example.com", "custom_domain": true }]
}
```

`frontend/public/_headers` (rules merge, so `!` drops the first value before setting the long one):

```txt
/*
  Cache-Control: no-cache
/assets/*
  ! Cache-Control
  Cache-Control: public, max-age=31536000, immutable
```

### 3.8 The Worker

| Rule | Why |
|---|---|
| Only the keys in a fixed list are written to `runtime-env.js` | Never leaks other vars / secrets to the browser |
| Values go through `JSON.stringify` | A value with quotes can't break the script |
| `Cache-Control: no-store`, `Content-Type: application/javascript` | `_headers` doesn't apply to Worker responses; a deploy must show new values at once |
| Any other path → `env.ASSETS.fetch(request)` | Safety net; normally never reached because of `run_worker_first` |

### 3.9 Deploy

| Step | Command / action |
|---|---|
| 1 | `cd frontend && npm ci && npm run build` |
| 2 | Edit `vars` and `routes` in `deploy/cloudflare/frontend/wrangler.jsonc` |
| 3 | `cd deploy/cloudflare && npm run web:deploy` |
| 4 | Check `https://app.<domain>/runtime-env.js` shows your values |
| 5 | Log in, list videos, open one, play it |
| Rollback | `npx wrangler rollback --config frontend/wrangler.jsonc` |

## 4. Rules for both targets

| Topic | Rule |
|---|---|
| API URL | Separate origin (`api.<domain>`); the API already allows CORS with credentials |
| Refresh cookie (`AUTH_COOKIE_REFRESH=true`) | Frontend and API on the same parent domain (`app.` + `api.<domain>`) so the cookie stays same-site |
| Runtime keys | Listed in three places: `config.ts`, `docker/entrypoint.sh`, the Cloudflare Worker. Add a new key to all three |
| Caching | `assets/*` immutable (hashed names); `index.html` and `runtime-env.js` never cached |
| Source maps | `vite build` emits them; they're served as today. Delete `dist/**/*.map` before deploy to hide them |

## 5. PR plan

| PR | Content | Done when |
|---|---|---|
| F-1 | `deploy/cloudflare/frontend/` + `frontend/public/_headers` + README | `app.<domain>` serves the app; `/runtime-env.js` shows the vars |
| F-2 | `.github/workflows/deploy-frontend-cloudflare.yml`: on release (CalVer) or by hand; opt-in via repo variable `CLOUDFLARE_FRONTEND_DEPLOY`; repo variables override `wrangler.jsonc` vars | A release deploys the frontend |

## 6. Open questions

| # | Question | Default |
|---|---|---|
| 1 | Frontend and API domains? | `app.<domain>`, `api.<domain>` |
| 2 | Vars in `wrangler.jsonc` (committed) or `wrangler secret` / dashboard? | `wrangler.jsonc`: none are secret, all reach the browser anyway |
| 3 | Hide source maps on Cloudflare? | No, serve them as today |
| 4 | CI deploy now? | Done in F-2 (opt-in) |

## 7. Checklist

- [ ] Answer §6
- [ ] F-1: Cloudflare Worker + static assets + `_headers`
- [ ] Deploy, check `/runtime-env.js`, log in, import a video, play it
- [ ] F-2: set `CLOUDFLARE_FRONTEND_DEPLOY`, `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`; run the workflow once by hand
