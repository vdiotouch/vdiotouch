// vdio-touch-web: the frontend on Cloudflare.
//   Static Assets (wrangler.jsonc "assets") serve frontend/dist/, with index.html for unknown paths (SPA).
//   This Worker runs only for /runtime-env.js ("run_worker_first") and builds it from its vars,
//   the same job frontend/docker/entrypoint.sh does in the nginx image.

// Must match frontend/src/shared/lib/config.ts and frontend/docker/entrypoint.sh. Only these vars reach the browser.
const RUNTIME_CONFIG_KEYS = [
  'NEXT_PUBLIC_VIDEO_TOUCH_API_URL',
  'NEXT_PUBLIC_VIDEO_LIST_PAGE_SIZE',
  'NEXT_PUBLIC_UPDATE_DATA_INTERVAL_IN_SECONDS',
  'AUTH_COOKIE_REFRESH',
  'SUPPORT_EMAIL',
  'MAX_VIDEO_SIZE_MB',
] as const;

type RuntimeConfigKey = (typeof RUNTIME_CONFIG_KEYS)[number];

interface Env extends Partial<Record<RuntimeConfigKey, string>> {
  ASSETS: Fetcher;
}

const RUNTIME_ENV_PATH = '/runtime-env.js';

// JSON.stringify escapes every value, so a quote in a var can't break the script.
const buildRuntimeEnvScript = (env: Env): string => {
  const config: Record<string, string> = {};
  for (const key of RUNTIME_CONFIG_KEYS) {
    config[key] = env[key] ?? '';
  }
  return `window.__RUNTIME_CONFIG__ = ${JSON.stringify(config, null, 2)};\n`;
};

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    if (new URL(request.url).pathname === RUNTIME_ENV_PATH) {
      return new Response(buildRuntimeEnvScript(env), {
        headers: {
          'content-type': 'application/javascript; charset=utf-8',
          // _headers rules don't apply to Worker responses; never cache, so a var change is live at once.
          'cache-control': 'no-store',
        },
      });
    }
    // Normally unreachable (only /runtime-env.js runs the Worker); serve the files as a safety net.
    return env.ASSETS.fetch(request);
  },
} satisfies ExportedHandler<Env>;
