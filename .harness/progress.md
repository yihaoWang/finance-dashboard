# Progress

## 當前已驗證狀態

- 倉庫根目錄: `/Users/yihao.wang/projects/finance_dashboard`
- 標準啟動: `pnpm --filter worker dev`（Worker on http://127.0.0.1:8787）+ `pnpm --filter web dev`（Vite on http://localhost:5173）
- 標準驗證: `pnpm --filter worker test`（vitest, 134/134 pass）
- 已部署: Worker version `4b5b8c4e`、Pages `7d5eef23`、D1 migrations 套到 0005
- 當前最高優先級未完成: 在新 Mac 跑 `install-podcasts.sh` → 驗證 insights 資料流 → 寫前端 action_plan + EventsPanel
- 當前 blocker: 無

## 未完成工作（依優先序）

### 1. insights-mac-pipeline（priority 7, missing）

`scripts/install-podcasts.sh` 已寫好但**尚未在任何 Mac 上跑過**。下次任一 Mac 開機後第一件事：

```bash
git pull
bash scripts/install-podcasts.sh
DIGEST_TOKEN=... bash scripts/podcasts/run.sh   # 立即驗證
curl -s $WORKER_URL/api/insights?days=3 | jq '.data.items | length'   # 應 > 0
```

驗收條件：上面 jq 回傳 > 0、`~/Library/LaunchAgents/com.tickr.podcasts.plist` 存在。

### 2. digest-action-plan-section（priority 8, in-progress）

Prompt + storage + parser 都就緒，等下一輪 digest cron 自然跑出第一筆含 action_plan 的 digest。可手動觸發驗證：

```bash
curl -fsS -X POST $WORKER_URL/api/digest/regenerate -H "Content-Type: application/json" -d '{"scope":"market"}' | jq '.data.sections.action_plan'
```

注意這會走 Cloudflare Workers AI（llama），品質不如 Mac claude -p；建議等 Mac 08:00 cron 跑完再看。

### 3. digest-action-plan-frontend（priority 9, missing）

`web/src/components/DigestSection.tsx` 和 `DigestCard.tsx` 仍只渲染舊三段。需要：

- 加 `action_plan` 區塊（建議用 highlight card 樣式：accent border + 較深背景，凸顯為「操作建議」）
- 處理 backward-compat：舊 digest 的 `action_plan === ''` 時不渲染整段
- 確認 `DigestBundle` 型別已更新（已在 shared/src/types.ts 加好 `action_plan: string`）

### 4. events-frontend（priority 5, missing）

後端 `/api/events` 已驗證 OK。需要：

- `web/src/hooks/useEvents.ts`（pattern 參考 useNews / useFinancials）
- `web/src/components/EventsPanel.tsx`：顯示未來 14 天 FOMC/CPI/employment/geopolitics 警示，按 impact 分色
- 嵌入 `DashboardPage.tsx` 的 overview 或 macro 區塊

### 5. insights-frontend-panel（priority 10, missing, 可選）

Dashboard 加「外部觀點」面板顯示最近 3 天 insight cards：

- 主敘事（截斷至 80 字 + 展開）
- frameworkTags chips（A–G）
- actionSuggestion preview
- 點擊跳到原 episode URL

資料來源 `GET /api/insights?days=3`，無需新 hook 模板，照 useNews 寫即可。

## 會話記錄

（每輪由 `/harness-handoff` 追加，使用 YAML frontmatter）

---
session: 2026-05-08T00:00:00Z
goal: 整合 future events 警示（FOMC / CPI / 國際情勢）+ 初始化 harness
commits: []
dirty_files:
  - shared/src/types.ts
  - worker/src/index.ts
  - worker/src/cron.ts
  - worker/src/sources/events.ts
  - worker/src/cache/d1-events.ts
  - worker/src/routes/events.ts
  - worker/migrations/0003_events.sql
  - worker/test/sources.events.test.ts
  - .harness/*
  - CLAUDE.md
test_status: "0 (134/134 pass)"
next_step: 套 D1 migration → curl /api/events 確認 → 寫前端 EventsPanel
---

---
session: 2026-05-08T14:00:00Z
goal: AI digest 框架升級（嵌入「早晨財經速解讀」A–G 框架）+ podcast/YouTube insight 萃取 pipeline + 操作建議段
commits:
  - "refactor(financials): drop sections that duplicate the overview"
  - "feat(events): future events alerts + Insight types"
  - "feat(insights): podcast/YouTube ingestion pipeline + 操作建議 section"
dirty_files: []
test_status: "0 (134/134 pass)"
deployed:
  worker_version: 4b5b8c4e
  pages_url: https://7d5eef23.finance-dashboard-6bb.pages.dev
  d1_migrations_applied: [0003, 0004, 0005]
next_step: 在新 Mac 跑 install-podcasts.sh → 等 Mac 08:00 cron 產出第一筆含 action_plan 的 digest → 寫前端 action_plan 區塊與 EventsPanel
---
