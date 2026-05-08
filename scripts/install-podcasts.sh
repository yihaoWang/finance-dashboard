#!/usr/bin/env bash
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SCRIPT="$REPO_ROOT/scripts/podcasts/run.sh"
TEMPLATE="$REPO_ROOT/scripts/com.tickr.podcasts.plist.template"
PLIST="$HOME/Library/LaunchAgents/com.tickr.podcasts.plist"
LOG="$HOME/Library/Logs/tickr-podcasts.log"
WHISPER_MODELS="${WHISPER_MODELS:-$HOME/.tickr/whisper-models}"

echo "Tickr Podcasts Ingestion – installer"
echo "===================================="
echo

# 1. brew deps
need_brew=()
command -v jq >/dev/null 2>&1 || need_brew+=(jq)
command -v yt-dlp >/dev/null 2>&1 || need_brew+=(yt-dlp)
command -v ffmpeg >/dev/null 2>&1 || need_brew+=(ffmpeg)
command -v whisper-cli >/dev/null 2>&1 || command -v whisper-cpp >/dev/null 2>&1 || need_brew+=(whisper-cpp)
command -v claude >/dev/null 2>&1 || { echo "❌ claude CLI not found. Install from https://docs.anthropic.com/en/docs/claude-code"; exit 1; }
command -v python3 >/dev/null 2>&1 || { echo "❌ python3 required (macOS ships it)"; exit 1; }

if [ ${#need_brew[@]} -gt 0 ]; then
  echo "Installing via brew: ${need_brew[*]}"
  brew install "${need_brew[@]}"
fi

# 2. Whisper model
mkdir -p "$WHISPER_MODELS"
MODEL_FILE="$WHISPER_MODELS/ggml-small.en.bin"
if [ ! -f "$MODEL_FILE" ]; then
  echo "Downloading whisper small.en model (~466MB)..."
  curl -fL --max-time 600 -o "$MODEL_FILE" \
    "https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-small.en.bin"
fi
echo "✅ Whisper model: $MODEL_FILE"

# 3. Env vars
DIGEST_TOKEN="${DIGEST_TOKEN:-}"
if [ -z "$DIGEST_TOKEN" ]; then
  read -rsp "DIGEST_TOKEN (Bearer token used by worker): " DIGEST_TOKEN
  echo
fi
[ -n "$DIGEST_TOKEN" ] || { echo "❌ DIGEST_TOKEN required"; exit 1; }

WORKER_URL="${WORKER_URL:-https://finance-dashboard-worker.nihongo.workers.dev}"
CLAUDE_MODEL="${CLAUDE_MODEL:-sonnet}"
MAX_PER_FEED="${MAX_PER_FEED:-2}"

read -rp "WORKER_URL [$WORKER_URL]: " input && WORKER_URL="${input:-$WORKER_URL}"
read -rp "Claude model [$CLAUDE_MODEL]: " input && CLAUDE_MODEL="${input:-$CLAUDE_MODEL}"
read -rp "Max episodes per feed per run [$MAX_PER_FEED]: " input && MAX_PER_FEED="${input:-$MAX_PER_FEED}"

# 4. permissions + plist
chmod +x "$SCRIPT" "$REPO_ROOT/scripts/podcasts/parse-rss.py"
mkdir -p "$(dirname "$PLIST")" "$(dirname "$LOG")"

sed \
  -e "s|__SCRIPT_PATH__|$SCRIPT|g" \
  -e "s|__DIGEST_TOKEN__|$DIGEST_TOKEN|g" \
  -e "s|__WORKER_URL__|$WORKER_URL|g" \
  -e "s|__CLAUDE_MODEL__|$CLAUDE_MODEL|g" \
  -e "s|__WHISPER_MODELS__|$WHISPER_MODELS|g" \
  -e "s|__MAX_PER_FEED__|$MAX_PER_FEED|g" \
  -e "s|__LOG_PATH__|$LOG|g" \
  "$TEMPLATE" > "$PLIST"

# 5. Load
launchctl bootout gui/"$(id -u)" "$PLIST" 2>/dev/null || true
launchctl bootstrap gui/"$(id -u)" "$PLIST"
launchctl enable gui/"$(id -u)"/com.tickr.podcasts

echo
echo "✅ Installed. Daily at 05:30 local time (before digest 08:00)."
echo "   plist:  $PLIST"
echo "   log:    $LOG"
echo "   script: $SCRIPT"
echo
echo "Test now:  DIGEST_TOKEN=... WHISPER_MODELS=$WHISPER_MODELS bash \"$SCRIPT\""
echo "Disable:   launchctl bootout gui/\$(id -u) \"$PLIST\""
