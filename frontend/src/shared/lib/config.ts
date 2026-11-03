const KEYS = {
  API_URL: { runtime: "NEXT_PUBLIC_VIDEO_TOUCH_API_URL", env: "VITE_VIDEO_TOUCH_API_URL" },
  VIDEO_LIST_PAGE_SIZE: { runtime: "NEXT_PUBLIC_VIDEO_LIST_PAGE_SIZE", env: "VITE_VIDEO_LIST_PAGE_SIZE" },
  UPDATE_INTERVAL_SEC: { runtime: "NEXT_PUBLIC_UPDATE_DATA_INTERVAL_IN_SECONDS", env: "VITE_UPDATE_DATA_INTERVAL_IN_SECONDS" },
  AUTH_COOKIE_REFRESH: { runtime: "AUTH_COOKIE_REFRESH", env: "VITE_AUTH_COOKIE_REFRESH" },
  SUPPORT_EMAIL: { runtime: "SUPPORT_EMAIL", env: "VITE_SUPPORT_EMAIL" },
  MAX_VIDEO_SIZE_MB: { runtime: "MAX_VIDEO_SIZE_MB", env: "VITE_MAX_VIDEO_SIZE_MB" },
} as const;

type ConfigKey = keyof typeof KEYS;

// Runtime values come from /runtime-env.js (written by the container
// entrypoint) so one image runs in any environment; VITE_* is the dev fallback.
function read(key: ConfigKey): string {
  const { runtime, env } = KEYS[key];
  const runtimeValue = window.__RUNTIME_CONFIG__?.[runtime];
  if (runtimeValue) return runtimeValue;
  return (import.meta.env[env] as string | undefined) ?? "";
}

export const config = {
  get apiUrl() {
    return read("API_URL").replace(/\/$/, "");
  },
  get pageSize() {
    return Number(read("VIDEO_LIST_PAGE_SIZE")) || 10;
  },
  get pollIntervalMs() {
    return (Number(read("UPDATE_INTERVAL_SEC")) || 10) * 1000;
  },
  get cookieRefresh() {
    return read("AUTH_COOKIE_REFRESH") === "true";
  },
  get supportEmail() {
    return read("SUPPORT_EMAIL") || "support@vdiotouch.com";
  },
  /**
   * Largest video the api accepts, in MB, for the "Max file size" hint.
   * Keep it in step with the api's MAX_VIDEO_SIZE_IN_BYTES. Null hides the hint.
   */
  get maxVideoSizeMb(): number | null {
    const value = Number(read("MAX_VIDEO_SIZE_MB"));
    return value > 0 ? value : null;
  },
};
