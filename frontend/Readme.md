# Video Touch dashboard

The web app for Video Touch: log in / sign up, import and manage videos, watch
them over HLS, and manage webhooks. It talks to the api in [`../server/api`](../server/api).

## Table Of Contents

- [Features](#features)
- [Tech Stack](#tech-stack)
- [Getting Started](#getting-started)
- [Run locally with the backend](#run-locally-with-the-backend)
- [Project Structure](#project-structure)
- [Environment Variables](#environment-variables)
- [Scripts](#scripts)

<a id="features"></a>

## Features

- Log in / sign up
- Import a video from a public link (upload from device is off until the api's tus server is back)
- Transcoding (720p, 540p, 480p, 360p) and optional transcript
- Videos list: search by title, page through results, select rows to re-process or copy IDs, delete
- Video details: HLS playback, copy playlist or resolution URL, edit title, description and tags
- Webhooks: list, add, edit and delete endpoints
- Works on phones (cards below 768px, navigation drawer below 992px)

<a id="tech-stack"></a>

## Tech Stack

- [Vite](https://vite.dev/) + [React](https://react.dev/): single-page app
- [TanStack Router](https://tanstack.com/router) + [Query](https://tanstack.com/query): routing and server state
- [graphql-request](https://github.com/graffle-js/graffle): GraphQL client
- [Ant Design 6](https://ant.design/): components, themed from `src/theme/antd-theme.ts`
- CSS Modules + design tokens in `src/styles/tokens.css` (Tailwind v4 for the base layer)
- [Plyr](https://plyr.io/) + [HLS.js](https://github.com/video-dev/hls.js/): video player
- [TypeScript](https://www.typescriptlang.org/)

<a id="getting-started"></a>

## Getting Started

### Prerequisites

- Node.js >= 20
- npm

### Setup

```bash
cd frontend
cp .env.example .env
npm install
npm run dev
```

The app runs on `http://localhost:3009`.

### Docker

```bash
cd frontend
cp .env.example .env
docker compose up -d
```

The app runs on `http://localhost:3009`. The image is nginx serving the built
app; env values are read when the container starts, so one image works in any
environment.

<a id="run-locally-with-the-backend"></a>

## Run locally with the backend

1. Start the backend first, following the [root Readme](../Readme.md#how-to-run). The api runs on `http://localhost:3000`.
2. Copy the env file and keep the defaults:

   ```bash
   cp .env.example .env
   ```

   - `VITE_VIDEO_TOUCH_API_URL=http://localhost:3000`
   - `VITE_AUTH_COOKIE_REFRESH=false` (the api has no refresh endpoint yet)
3. Install and start the dev server:

   ```bash
   npm install
   npm run dev
   ```

4. Open `http://localhost:3009`.

> **Note:** The app imports videos from a link only. Upload from device needs
> the api's tus server (`/upload/files`), which is turned off right now.

<a id="project-structure"></a>

## Project Structure

```
├── src/
│   ├── app/              # wiring only: providers, router, route guards
│   ├── components/       # reusable UI shared by features (no feature imports)
│   │   ├── actions/      #   CopyButton
│   │   ├── brand/        #   Logo
│   │   ├── data-display/ #   StatusTag
│   │   ├── feedback/     #   FullPageLoader, FormErrorAlert, LoadErrorAlert
│   │   ├── form/         #   PasswordInput
│   │   ├── layout/       #   app shell (sider, nav drawer, header, account menu), PageHeader, TwoColumnLayout
│   │   └── navigation/   #   TextLink, SupportLink, CursorPager
│   ├── features/         # one folder per feature: auth, assets, webhooks
│   │   └── <feature>/
│   │       ├── api.ts        # requests for this feature
│   │       ├── constants.ts  # values shared inside the feature
│   │       ├── components/   # UI used only by this feature
│   │       ├── hooks/        # React hooks used only by this feature
│   │       ├── pages/        # route components
│   │       └── lib/          # pure helpers (no React)
│   ├── shared/           # non-UI code used everywhere: api, hooks, lib
│   ├── theme/            # design tokens as values + the AntD theme
│   └── styles/           # Tailwind entry, tokens.css, AntD overrides, player
├── public/               # static assets, runtime-env.js placeholder
├── scripts/              # generate-tokens.mjs (writes src/styles/tokens.css)
└── docker/               # nginx config + runtime env entrypoint
```

Conventions:

- **Dependencies point one way:** `app` → `features` → `components` → `shared` / `theme`.
  A component in `src/components` gets data through props and never imports a feature.
- **One component per file**, file names in kebab-case, named exports.
- **Styles** go in a `*.module.css` next to the component and use the CSS
  variables from `src/styles/tokens.css`. Use inline `style` only for
  one-off values that come from props.
- A component moves from `features/<x>/components` to `src/components` once a
  second feature needs it.
- A page composes components; data fetching lives in `api.ts` hooks, and
  logic that has no React in it (formatting, status mapping) goes in `lib/`.
- Colours come from tokens. To change one, edit `scripts/generate-tokens.mjs`
  and run `npm run tokens:build`; don't hand-edit `tokens.css`.

<a id="environment-variables"></a>

## Environment Variables

See [`.env.example`](.env.example). `npm run dev` reads the `VITE_*` names.
Docker Compose reads the same `.env` and passes the values to the container
under the names below (an older `.env` that already uses these names still works).

| Container variable | Dev variable | Description |
|----------|----------|-------------|
| `NEXT_PUBLIC_VIDEO_TOUCH_API_URL` | `VITE_VIDEO_TOUCH_API_URL` | Api URL |
| `NEXT_PUBLIC_VIDEO_LIST_PAGE_SIZE` | `VITE_VIDEO_LIST_PAGE_SIZE` | Videos per page (default 10) |
| `NEXT_PUBLIC_UPDATE_DATA_INTERVAL_IN_SECONDS` | `VITE_UPDATE_DATA_INTERVAL_IN_SECONDS` | How often lists and details refresh |
| `AUTH_COOKIE_REFRESH` | `VITE_AUTH_COOKIE_REFRESH` | `true` to use the httpOnly refresh-cookie flow (needs `POST /api/v1/auth/refresh`) |
| `SUPPORT_EMAIL` | `VITE_SUPPORT_EMAIL` | Address behind "Contact support" (default `support@vdiotouch.com`) |
| `MAX_VIDEO_SIZE_MB` | `VITE_MAX_VIDEO_SIZE_MB` | "Max file size" hint in the import dialog; match the api's `MAX_VIDEO_SIZE_IN_BYTES`. Empty hides it |

<a id="scripts"></a>

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start the dev server |
| `npm run build` | Build for production |
| `npm run preview` | Serve the production build |
| `npm run lint` | Run ESLint |
| `npm run type-check` | Run the TypeScript check |
| `npm run format` | Format code with Prettier |
| `npm run tokens:build` | Regenerate `src/styles/tokens.css` |
