#!/bin/sh
set -eu

# Regenerate runtime-env.js at container startup so one image runs in any
# environment; values come from `docker run -e ...` / Compose, never the build.
# NEXT_PUBLIC_* names are kept for deploy compatibility with the previous app.
cat > /usr/share/nginx/html/runtime-env.js << EOF2
window.__RUNTIME_CONFIG__ = {
  "NEXT_PUBLIC_VIDEO_TOUCH_API_URL": "${NEXT_PUBLIC_VIDEO_TOUCH_API_URL:-}",
  "NEXT_PUBLIC_VIDEO_LIST_PAGE_SIZE": "${NEXT_PUBLIC_VIDEO_LIST_PAGE_SIZE:-10}",
  "NEXT_PUBLIC_UPDATE_DATA_INTERVAL_IN_SECONDS": "${NEXT_PUBLIC_UPDATE_DATA_INTERVAL_IN_SECONDS:-5}",
  "AUTH_COOKIE_REFRESH": "${AUTH_COOKIE_REFRESH:-false}",
  "SUPPORT_EMAIL": "${SUPPORT_EMAIL:-}",
  "MAX_VIDEO_SIZE_MB": "${MAX_VIDEO_SIZE_MB:-}"
};
EOF2

exec "$@"
