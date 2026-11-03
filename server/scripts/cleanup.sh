#!/bin/bash

# Removes leftover temporary video files. Scheduled by crontab.
# Cron runs with an almost empty environment, so read INTERNAL_API_KEY and API_PORT from server/.env.

ENV_FILE="$(cd "$(dirname "$0")/.." && pwd)/.env"
env_value() {
  grep -E "^$1=" "$ENV_FILE" | tail -n 1 | cut -d= -f2- | tr -d '"'"'"
}

INTERNAL_API_KEY="${INTERNAL_API_KEY:-$(env_value INTERNAL_API_KEY)}"
API_PORT="${API_PORT:-$(env_value API_PORT)}"

curl --silent --show-error --fail \
  --request POST \
  --header "x-internal-api-key: ${INTERNAL_API_KEY}" \
  --url "http://localhost:${API_PORT:-3000}/api/v1/cron-jobs/cleanup-device" || exit $?
echo
