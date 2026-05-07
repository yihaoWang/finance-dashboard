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
