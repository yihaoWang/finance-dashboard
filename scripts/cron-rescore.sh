#!/usr/bin/env bash
# Trigger a full screener rescan on the deployed worker.
# Runs nightly from crontab; complements the Cloudflare cron (which runs once at 00:00 UTC).
set -euo pipefail

PROJECT_DIR="/Users/yihao.wang/project/finance-dashboard"
WORKER_URL="https://finance-dashboard-worker.nihongo.workers.dev"

read_env() { grep "^$1=" "$PROJECT_DIR/.env" | cut -d= -f2-; }

TOKEN=$(read_env ADMIN_TOKEN)
CF_ID=$(read_env CF_ACCESS_CLIENT_ID)
CF_SECRET=$(read_env CF_ACCESS_CLIENT_SECRET)

if [ -z "$TOKEN" ]; then
  echo "[$(date -u +%FT%TZ)] ERROR: ADMIN_TOKEN not found in $PROJECT_DIR/.env" >&2
  exit 1
fi
if [ -z "$CF_ID" ] || [ -z "$CF_SECRET" ]; then
  echo "[$(date -u +%FT%TZ)] ERROR: CF_ACCESS_CLIENT_ID / CF_ACCESS_CLIENT_SECRET not found in $PROJECT_DIR/.env (needed to bypass Cloudflare Access)" >&2
  exit 1
fi

echo "[$(date -u +%FT%TZ)] starting screener rescan"
curl -sS --max-time 600 -X POST \
  -H "authorization: Bearer $TOKEN" \
  -H "CF-Access-Client-Id: $CF_ID" \
  -H "CF-Access-Client-Secret: $CF_SECRET" \
  "$WORKER_URL/api/admin/screener-scan"
echo ""
echo "[$(date -u +%FT%TZ)] done"
