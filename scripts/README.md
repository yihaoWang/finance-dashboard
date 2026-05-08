# Tickr Daily Digest — Local Mac Pipeline

Runs the AI digest pipeline locally using `claude -p` (Claude Code CLI) instead of Workers AI, so digests use Anthropic Opus/Sonnet via your Claude subscription. The Cloudflare Worker handles data gathering and storage; the Mac runs the LLM step.

## One-click install

```bash
bash scripts/install.sh
```

The script will prompt for:

- `DIGEST_TOKEN` — a secret you set on the Worker (see below)
- `WORKER_URL` — defaults to the deployed worker URL
- Claude model — `sonnet`, `opus`, or `haiku` (default: `sonnet`)

After install, a launchd agent fires daily at **08:00 local time** and loops over `market 2330 2454 2317 3008 2308`.

Logs: `~/Library/Logs/tickr-digest.log`

## Set DIGEST_TOKEN on the Worker

Run once after deploying the worker:

```bash
pnpm exec wrangler secret put DIGEST_TOKEN
```

Enter the same token you used during install. This authorizes the Mac script to POST digests to the worker.

> **Note:** The `/upsert` endpoint uses a simple string equality check (`===`) for the Bearer token. This is sufficient for a personal project but is not constant-time. Avoid using this token for anything beyond this pipeline.

## Manual test

```bash
DIGEST_TOKEN=<your-token> bash scripts/run-digest.sh
```

## Disable the schedule

```bash
launchctl bootout gui/$(id -u) ~/Library/LaunchAgents/com.tickr.digest.plist
```

## Cloudflare cron fallback

The `wrangler.toml` `[triggers]` crons block is preserved. If the Mac is off, Cloudflare will still run the digest via Workers AI as a fallback.

## Prerequisites

- `claude` CLI authenticated (`claude --version` should work)
- `jq` (`brew install jq`)
- `curl` (pre-installed on macOS)

---

# Tickr Podcasts Ingestion — Local Mac Pipeline

Daily extraction of investment insights from podcasts and YouTube channels. Transcribes audio (whisper.cpp for English podcasts, YouTube auto-captions for Chinese videos), runs `claude -p` to extract structured insights (main thesis / validation signals / reversal signals / framework tags / action suggestion), and POSTs them to the Worker so the next morning's digest can integrate them into the **操作建議** section.

## Sources (`scripts/podcasts/feeds.json`)

| ID | 名稱 | Type | Transcript |
|---|---|---|---|
| `shi-yin-zhe` | 股市隱者 | YouTube channel | YouTube auto-captions (zh-Hant) |
| `cnbc-closing-bell` | CNBC Closing Bell | Podcast RSS | whisper.cpp `small.en` |
| `cnbc-squawk-pod` | CNBC Squawk Pod | Podcast RSS | whisper.cpp `small.en` |
| `cnbc-squawk-on-the-street` | CNBC Squawk on the Street | Podcast RSS | whisper.cpp `small.en` |

Edit `feeds.json` to add / remove sources. Each source can switch between `transcribeMode: youtube-subs` and `transcribeMode: whisper`.

## One-click install (new Mac)

```bash
git clone <repo>
cd finance_dashboard
pnpm install                  # only needed if you also run worker/web locally
bash scripts/install-podcasts.sh
```

Installer will:

1. `brew install` missing deps: `jq`, `yt-dlp`, `ffmpeg`, `whisper-cpp`
2. Download `ggml-small.en.bin` (~466 MB) into `$WHISPER_MODELS` (default `~/.tickr/whisper-models`)
3. Prompt for `DIGEST_TOKEN`, `WORKER_URL`, Claude model, max episodes per feed per run
4. Generate `~/Library/LaunchAgents/com.tickr.podcasts.plist`
5. Bootstrap the launchd agent (daily **05:30 local**, 2.5 hr before the digest at 08:00)

Logs: `~/Library/Logs/tickr-podcasts.log`

State: `~/.tickr/podcasts/` (audio cache, transcripts, `seen.json` deduplication).

## Prerequisites (new Mac)

Same as the digest pipeline above, plus:

- Homebrew (`brew`)
- `python3` (macOS 12+ ships it; `python3 --version` should work)
- The same `DIGEST_TOKEN` already set on the Worker via `wrangler secret put DIGEST_TOKEN`

## Manual test

```bash
DIGEST_TOKEN=<your-token> \
  WHISPER_MODELS=$HOME/.tickr/whisper-models \
  MAX_PER_FEED=1 \
  bash scripts/podcasts/run.sh
```

The first real run downloads + transcribes audio, so expect:

- 股市隱者: < 1 min per episode (auto-captions only)
- CNBC podcasts: ~ 0.3× realtime per episode on Apple Silicon (`small.en`); a 45 min Closing Bell ≈ 15 min CPU. Squawk Pod is short (~30 min); Squawk on the Street up to 3 hr.

To skip Squawk on the Street's long episodes, drop it from `feeds.json` or lower its `MAX_PER_FEED`.

## Verify ingestion

```bash
curl -s "$WORKER_URL/api/insights?days=3" | jq '.data.items | length'
curl -s "$WORKER_URL/api/insights?days=3" | jq '.data.items[0]'
```

## Disable the schedule

```bash
launchctl bootout gui/$(id -u) ~/Library/LaunchAgents/com.tickr.podcasts.plist
```

## How it integrates with the digest

`worker/src/lib/digest-runner.ts` automatically queries the last 3 days of insights from D1 and injects them into the digest prompt as an **【外部觀點】** block. The Claude system prompt asks for a four-section output:

1. 硬數據 — raw numbers
2. 框架解讀 — A–G framework analysis cross-referenced with external insights
3. 操作建議 — short/mid-term action plan with conditional triggers
4. 情緒 — short-term sentiment

Each digest's `sections.action_plan` field is stored in the new `digests.action_plan` column (migration `0005_digest_action_plan.sql`).

## Troubleshooting

- **`whisper-cli not found`**: `brew install whisper-cpp` then re-run the installer. Older brew installs ship the binary as `whisper-cpp`; the script tries both names.
- **`extract returned non-JSON`**: Check the log — usually means Claude returned a markdown code fence. Tweak `scripts/podcasts/system-prompt.md` to be stricter.
- **Empty `episodes`**: The RSS may have moved. Test directly: `python3 scripts/podcasts/parse-rss.py podcast <rss-url> 2`.
- **YouTube auto-captions missing**: Some videos publish before captions are generated. The script logs `transcribe FAILED` and skips; the next run picks them up.
