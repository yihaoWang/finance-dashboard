#!/usr/bin/env bash
# Tickr podcasts ingestion: fetch RSS / YouTube → transcribe → claude -p extract → POST to /api/insights/ingest
set -euo pipefail

WORKER_URL="${WORKER_URL:-https://finance-dashboard-worker.nihongo.workers.dev}"
DIGEST_TOKEN="${DIGEST_TOKEN:?DIGEST_TOKEN env var required}"
MODEL="${CLAUDE_MODEL:-sonnet}"
MAX_PER_FEED="${MAX_PER_FEED:-2}"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
FEEDS_JSON="$SCRIPT_DIR/feeds.json"
SYSTEM_PROMPT_FILE="$SCRIPT_DIR/system-prompt.md"
PARSE_RSS="$SCRIPT_DIR/parse-rss.py"

STATE_DIR="$HOME/.tickr/podcasts"
AUDIO_DIR="$STATE_DIR/audio"
TRANSCRIPT_DIR="$STATE_DIR/transcripts"
SEEN_FILE="$STATE_DIR/seen.json"
LOG="$HOME/Library/Logs/tickr-podcasts.log"

mkdir -p "$AUDIO_DIR" "$TRANSCRIPT_DIR" "$(dirname "$LOG")"
[ -f "$SEEN_FILE" ] || echo '{}' > "$SEEN_FILE"

log() { echo "[$(date -u +%FT%TZ)] $*" | tee -a "$LOG"; }

mark_seen() {
  local ep_id="$1"
  local tmp; tmp=$(mktemp)
  jq --arg k "$ep_id" --argjson ts "$(date +%s)" '. + {($k): $ts}' "$SEEN_FILE" > "$tmp" && mv "$tmp" "$SEEN_FILE"
}

is_seen() {
  local ep_id="$1"
  jq -e --arg k "$ep_id" '.[$k] != null' "$SEEN_FILE" > /dev/null 2>&1
}

stable_id() {
  # sha256 of source_id|episode_id, take first 32 chars
  printf '%s|%s' "$1" "$2" | shasum -a 256 | cut -c1-32
}

transcribe_youtube() {
  local video_id="$1"; local sub_lang="$2"; local out_txt="$3"
  local tmp_dir; tmp_dir=$(mktemp -d)
  if yt-dlp -q --write-auto-subs --sub-langs "$sub_lang,en-orig,en" --skip-download \
      --convert-subs srt -o "$tmp_dir/%(id)s.%(ext)s" \
      "https://www.youtube.com/watch?v=$video_id" 2>>"$LOG"; then
    local srt
    srt=$(find "$tmp_dir" -name "*.srt" | head -1)
    if [ -n "${srt:-}" ] && [ -f "$srt" ]; then
      # Strip SRT timestamps and indices, dedupe consecutive lines
      awk '/^[0-9]+$/{next} /^[0-9]{2}:[0-9]{2}:/{next} /^$/{next} {print}' "$srt" \
        | awk '!seen[$0]++' > "$out_txt"
      rm -rf "$tmp_dir"
      return 0
    fi
  fi
  rm -rf "$tmp_dir"
  return 1
}

transcribe_whisper() {
  local audio_url="$1"; local model="$2"; local out_txt="$3"; local ep_id="$4"
  local mp3="$AUDIO_DIR/$ep_id.mp3"
  curl -fsSL --max-time 600 -o "$mp3" "$audio_url" 2>>"$LOG" || return 1
  # whisper.cpp: ./main -m models/ggml-${model}.bin -f input.wav -otxt
  # Use whisper-cli (newer name) or whisper-cpp depending on install
  local bin
  if command -v whisper-cli >/dev/null 2>&1; then bin=whisper-cli
  elif command -v whisper-cpp >/dev/null 2>&1; then bin=whisper-cpp
  else log "ERROR: whisper-cli or whisper-cpp not found"; return 1; fi
  local model_path="${WHISPER_MODELS:-$HOME/.tickr/whisper-models}/ggml-${model}.bin"
  if [ ! -f "$model_path" ]; then log "ERROR: missing whisper model $model_path"; return 1; fi
  # Convert mp3 → wav 16k mono (whisper requirement)
  local wav="$AUDIO_DIR/$ep_id.wav"
  ffmpeg -y -loglevel error -i "$mp3" -ar 16000 -ac 1 -c:a pcm_s16le "$wav" 2>>"$LOG" || return 1
  "$bin" -m "$model_path" -f "$wav" -otxt -of "$AUDIO_DIR/$ep_id" 2>>"$LOG" || return 1
  mv "$AUDIO_DIR/$ep_id.txt" "$out_txt"
  rm -f "$mp3" "$wav"
}

extract_insight() {
  local transcript="$1"; local meta_json="$2"
  local input
  input=$(jq -n --arg meta "$meta_json" --rawfile t "$transcript" \
    '{metadata: ($meta | fromjson), transcript: $t}')
  echo "$input" | claude -p --append-system-prompt "$(cat "$SYSTEM_PROMPT_FILE")" --model "$MODEL" 2>>"$LOG"
}

post_ingest() {
  local body="$1"
  curl -fsS -X POST "$WORKER_URL/api/insights/ingest" \
    -H "Authorization: Bearer $DIGEST_TOKEN" \
    -H "Content-Type: application/json" \
    -d "$body" >>"$LOG" 2>&1
}

process_episode() {
  local feed_json="$1"; local ep_json="$2"
  local source_id; source_id=$(echo "$feed_json" | jq -r '.id')
  local source_name; source_name=$(echo "$feed_json" | jq -r '.name')
  local kind; kind=$(echo "$feed_json" | jq -r '.kind')
  local mode; mode=$(echo "$feed_json" | jq -r '.transcribeMode')
  local ep_orig_id; ep_orig_id=$(echo "$ep_json" | jq -r '.id')
  local insight_id; insight_id=$(stable_id "$source_id" "$ep_orig_id")

  if is_seen "$insight_id"; then return 0; fi

  local title; title=$(echo "$ep_json" | jq -r '.title')
  local episode_url; episode_url=$(echo "$ep_json" | jq -r '.episodeUrl // empty')
  local audio_url; audio_url=$(echo "$ep_json" | jq -r '.audioUrl // empty')
  local published_at; published_at=$(echo "$ep_json" | jq -r '.publishedAt')

  log "  -> $source_name: $title"

  local transcript_file="$TRANSCRIPT_DIR/$insight_id.txt"

  if [ "$mode" = "youtube-subs" ]; then
    local video_id; video_id=$(echo "$ep_json" | jq -r '.videoId')
    local sub_lang; sub_lang=$(echo "$feed_json" | jq -r '.subLang // "en"')
    transcribe_youtube "$video_id" "$sub_lang" "$transcript_file" || {
      log "    transcribe FAILED ($source_name)"; return 1; }
  elif [ "$mode" = "whisper" ]; then
    local whisper_model; whisper_model=$(echo "$feed_json" | jq -r '.whisperModel')
    transcribe_whisper "$audio_url" "$whisper_model" "$transcript_file" "$insight_id" || {
      log "    transcribe FAILED ($source_name)"; return 1; }
  else
    log "    unknown mode: $mode"; return 1
  fi

  if [ ! -s "$transcript_file" ]; then log "    empty transcript"; return 1; fi

  local meta
  meta=$(jq -n --arg s "$source_name" --arg t "$title" --arg u "$episode_url" \
                --arg k "$kind" '{source:$s, title:$t, url:$u, kind:$k}')

  local extracted
  extracted=$(extract_insight "$transcript_file" "$meta") || {
    log "    claude -p FAILED"; return 1; }

  # Validate JSON
  if ! echo "$extracted" | jq -e . >/dev/null 2>&1; then
    log "    extract returned non-JSON, skipping"
    log "    raw output: $(echo "$extracted" | head -c 200)"
    return 1
  fi

  local source_kind="podcast"
  [ "$kind" = "youtube" ] && source_kind="youtube"

  local body
  body=$(jq -n \
    --arg id "$insight_id" \
    --arg source "$source_name" \
    --arg sourceKind "$source_kind" \
    --arg episodeTitle "$title" \
    --arg episodeUrl "$episode_url" \
    --arg audioUrl "$audio_url" \
    --argjson publishedAt "$published_at" \
    --arg model "claude-$MODEL" \
    --argjson e "$extracted" \
    '{
       id:$id, source:$source, sourceKind:$sourceKind,
       episodeTitle:$episodeTitle,
       episodeUrl:(if $episodeUrl=="" then null else $episodeUrl end),
       audioUrl:(if $audioUrl=="" then null else $audioUrl end),
       publishedAt:$publishedAt,
       mainThesis:($e.mainThesis // ""),
       validationSignals:($e.validationSignals // []),
       reversalSignals:($e.reversalSignals // []),
       frameworkTags:($e.frameworkTags // []),
       actionHorizon:($e.actionHorizon // null),
       actionSuggestion:($e.actionSuggestion // null),
       model:$model
     }')

  if post_ingest "$body"; then
    mark_seen "$insight_id"
    log "    OK"
  else
    log "    ingest POST FAILED"
    return 1
  fi
}

process_feed() {
  local feed_json="$1"
  local kind; kind=$(echo "$feed_json" | jq -r '.kind')
  local episodes_json
  if [ "$kind" = "podcast" ]; then
    local rss; rss=$(echo "$feed_json" | jq -r '.rssUrl')
    episodes_json=$(python3 "$PARSE_RSS" podcast "$rss" "$MAX_PER_FEED" 2>>"$LOG") || {
      log "  RSS parse FAILED"; return 1; }
  elif [ "$kind" = "youtube" ]; then
    local cid; cid=$(echo "$feed_json" | jq -r '.channelId')
    episodes_json=$(python3 "$PARSE_RSS" youtube "$cid" "$MAX_PER_FEED" 2>>"$LOG") || {
      log "  YouTube parse FAILED"; return 1; }
  else
    log "  unknown kind: $kind"; return 1
  fi
  local count; count=$(echo "$episodes_json" | jq 'length')
  log "[$(echo "$feed_json" | jq -r '.name')] $count episodes"
  for i in $(seq 0 $((count - 1))); do
    local ep; ep=$(echo "$episodes_json" | jq -c ".[$i]")
    process_episode "$feed_json" "$ep" || true
  done
}

log "=== podcasts run start ==="
feeds_count=$(jq 'length' "$FEEDS_JSON")
for i in $(seq 0 $((feeds_count - 1))); do
  feed=$(jq -c ".[$i]" "$FEEDS_JSON")
  process_feed "$feed" || true
done
log "=== podcasts run done ==="
