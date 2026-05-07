#!/usr/bin/env bash
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SCRIPT="$REPO_ROOT/scripts/run-digest.sh"
TEMPLATE="$REPO_ROOT/scripts/com.tickr.digest.plist.template"
PLIST="$HOME/Library/LaunchAgents/com.tickr.digest.plist"
LOG="$HOME/Library/Logs/tickr-digest.log"

echo "Tickr Daily Digest – installer"
echo "==============================="
echo

# 1. Sanity checks
command -v claude >/dev/null 2>&1 || { echo "❌ claude CLI not found. Install from https://docs.anthropic.com/en/docs/claude-code"; exit 1; }
command -v jq >/dev/null 2>&1 || { echo "❌ jq not found. Run: brew install jq"; exit 1; }
command -v curl >/dev/null 2>&1 || { echo "❌ curl required."; exit 1; }
[ -x "$SCRIPT" ] || chmod +x "$SCRIPT"

# 2. Prompt for env vars (or accept from existing env)
DIGEST_TOKEN="${DIGEST_TOKEN:-}"
if [ -z "$DIGEST_TOKEN" ]; then
  read -rsp "DIGEST_TOKEN (will be stored in plist; obtain from worker secret): " DIGEST_TOKEN
  echo
fi
[ -n "$DIGEST_TOKEN" ] || { echo "❌ DIGEST_TOKEN required"; exit 1; }

WORKER_URL="${WORKER_URL:-https://finance-dashboard-worker.nihongo.workers.dev}"
CLAUDE_MODEL="${CLAUDE_MODEL:-sonnet}"

read -rp "WORKER_URL [$WORKER_URL]: " input && WORKER_URL="${input:-$WORKER_URL}"
read -rp "Claude model (sonnet/opus/haiku) [$CLAUDE_MODEL]: " input && CLAUDE_MODEL="${input:-$CLAUDE_MODEL}"

# 3. Generate plist from template
mkdir -p "$(dirname "$PLIST")"
mkdir -p "$(dirname "$LOG")"
sed \
  -e "s|__SCRIPT_PATH__|$SCRIPT|g" \
  -e "s|__DIGEST_TOKEN__|$DIGEST_TOKEN|g" \
  -e "s|__WORKER_URL__|$WORKER_URL|g" \
  -e "s|__CLAUDE_MODEL__|$CLAUDE_MODEL|g" \
  -e "s|__LOG_PATH__|$LOG|g" \
  "$TEMPLATE" > "$PLIST"

# 4. Load (re-load if already loaded)
launchctl bootout gui/$(id -u) "$PLIST" 2>/dev/null || true
launchctl bootstrap gui/$(id -u) "$PLIST"
launchctl enable gui/$(id -u)/com.tickr.digest

echo
echo "✅ Installed. Will run daily at 08:00 local time."
echo "   plist:  $PLIST"
echo "   log:    $LOG"
echo "   script: $SCRIPT"
echo
echo "Test now:  bash \"$SCRIPT\""
echo "Disable:   launchctl bootout gui/\$(id -u) \"$PLIST\""
