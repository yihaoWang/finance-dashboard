#!/usr/bin/env bash
set -euo pipefail

WORKER_URL="${WORKER_URL:-https://finance-dashboard-worker.nihongo.workers.dev}"
DIGEST_TOKEN="${DIGEST_TOKEN:?DIGEST_TOKEN env var required}"
MODEL="${CLAUDE_MODEL:-sonnet}"
SYMBOLS=(market 2330 2454 2317 3008 2308)
LOG="$HOME/Library/Logs/tickr-digest.log"

mkdir -p "$(dirname "$LOG")"
echo "=== $(date -u +%FT%TZ) digest run start ===" | tee -a "$LOG"

for s in "${SYMBOLS[@]}"; do
  scope=$([ "$s" = "market" ] && echo market || echo stock)
  echo "  -> $scope $s" | tee -a "$LOG"

  PAYLOAD=$(curl -fsS "$WORKER_URL/api/digest/payload?scope=$scope&symbol=$s") || {
    echo "    payload fetch FAILED" | tee -a "$LOG"; continue;
  }

  SYSTEM=$(echo "$PAYLOAD" | jq -r '.data.system')
  USER_MSG=$(echo "$PAYLOAD" | jq -r '.data.user')
  DATE=$(echo "$PAYLOAD" | jq -r '.data.date')
  SOURCES=$(echo "$PAYLOAD" | jq -c '.data.sources')

  RESPONSE=$(echo "$USER_MSG" | claude -p --append-system-prompt "$SYSTEM" --model "$MODEL" 2>>"$LOG") || {
    echo "    claude -p FAILED" | tee -a "$LOG"; continue;
  }

  BODY=$(jq -n --arg scope "$scope" --arg symbol "$s" --arg date "$DATE" --arg response "$RESPONSE" --arg model "claude-$MODEL" --argjson sources "$SOURCES" \
    '{scope:$scope, symbol:$symbol, date:$date, response:$response, model:$model, sources:$sources}')

  curl -fsS -X POST "$WORKER_URL/api/digest/upsert" \
    -H "Authorization: Bearer $DIGEST_TOKEN" \
    -H "Content-Type: application/json" \
    -d "$BODY" >>"$LOG" 2>&1 || {
    echo "    upsert FAILED" | tee -a "$LOG"; continue;
  }
  echo "    OK" | tee -a "$LOG"
done

echo "=== $(date -u +%FT%TZ) digest run done ===" | tee -a "$LOG"
