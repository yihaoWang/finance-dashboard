# Tickr — 台股投資 Dashboard

輸入台股代號，一頁看完估值、技術、籌碼、宏觀、消息面，並由 LLM 每日整理成 3 段式投資解讀。

部署於 Cloudflare（Workers + Pages + D1 + KV），純免費資料來源（TWSE OpenAPI、Yahoo Finance、FRED、FinMind），LLM 可走 Cloudflare Workers AI 或本機 `claude -p`。

> Live: <https://finance-dashboard-6bb.pages.dev>
>
> API:  <https://finance-dashboard-worker.nihongo.workers.dev>

## 功能總覽

- **Hero 區**：股價、漲跌、市值、52W 區間、4 顆風險燈號（估值 / 乖離 / 營收 / 當日）
- **6 顆 KPI 卡**：P/E、Forward P/E、TTM EPS、毛利率、月營收 YoY、月線乖離
- **K 線圖**：Recharts 折線、1M / 3M / 1Y / 5Y 切換
- **宏觀面板**：US 10Y、VIX、SOX、DXY、USD/TWD + VIX 風險偏好燈
- **基本面**：毛利率 / 營益率 / 淨利率 / ROE / 季 EPS（FinMind）
- **籌碼面**：三大法人買賣超 + 融資融券 + 外資持股 %
- **技術面**：RSI(14) / MACD / 支撐壓力 / 月線乖離
- **消息面**：Yahoo TW 中文新聞 + 利多/利空/中性 keyword 分類，可點原文
- **AI 每日解讀**：每天 08:00 自動產出 3 段（硬數據 / 框架解讀 / 情緒），含歷史頁
- **PEACE 決策面板**：P/E/A/C/E 五大評分 + 護城河 / 風險 tag，給「買入 / 觀望 / 不碰」判斷
- **估值否決**（[shared/src/valuation-gate.ts](shared/src/valuation-gate.ts)）：PEACE 優異但 PE 過貴自動降級。同業比較優先序：產業 PE 中位數 → 自身 5Y 均 → PEG。閾值 1.5×（觀望）/ 2.0×（不碰）。
- **選股**：全 TW universe（~1075 檔）每日重算 weighted score + style tags（value / growth / dividend / hiddenChampion），估值否決同步生效。
- **名詞 ⓘ Tooltip**：30+ 指標 hover 顯示定義 + 當前數值智慧解讀
- **自選股**：localStorage 持久化，TopNav 自動跳節
- **登入**：Cloudflare Access + Google OAuth，email allowlist；右上角登出按鈕走 `/cdn-cgi/access/logout`
- **完整測試**：worker 125 unit + web 27 E2E，全綠

## 架構

```
              Browser → Cloudflare Access (Google OAuth + email allowlist)
                               │
                  ┌────────────▼──────────────┐
                  │ Cloudflare Pages          │
                  │ React + Vite + Tailwind   │
                  │ + Pages Function /api/*   │  ←─ adds service token, proxies to worker
                  └────────────┬──────────────┘
                               │ same-origin /api/*
                  ┌────────────▼───────────┐
                  │ Cloudflare Workers     │  ←─ also gated by CF Access (bypassed by service token)
                  │ Hono + TypeScript       │
                  │ + Workers AI binding    │
                  └─┬─────────┬──────────┬──┘
                    │         │          │
              ┌─────▼──┐  ┌──▼──┐  ┌────▼────┐
              │   D1   │  │ KV  │  │  外部 API │
              └────────┘  └─────┘  └──────────┘
                               │
                ┌──────────────┼──────────────┐
                │              │              │
            TWSE OpenAPI   Yahoo (v8/RSS)    FRED + FinMind
```

CF Access 同時保護 Pages 與 Worker 兩個 hostname。瀏覽器只連 Pages 同源 `/api/*`，由 [Pages Function](web/functions/api/[[path]].ts) 用 service token 轉發到 Worker，避免跨網域 cookie 問題。

LLM 兩條路：

1. **Cloudflare Workers AI**（預設 fallback）：`@cf/meta/llama-3.3-70b-instruct-fp8-fast`，每天 14:00 UTC 自動跑 cron
2. **本機 `claude -p`**（推薦，品質更佳）：Mac launchd 每日 08:00 跑 `scripts/run-digest.sh`，使用 Claude Sonnet/Opus

## 開發

```bash
pnpm install

# 後端 (Worker on http://127.0.0.1:8787)
pnpm --filter worker dev

# 前端 (Vite on http://localhost:5173)
pnpm --filter web dev

# 全部測試
pnpm --filter worker test         # 125 worker unit tests
pnpm --filter web e2e             # 27 Playwright E2E tests against production
pnpm --filter web typecheck
pnpm --filter web build
```

## 部署

```bash
cd worker

# 第一次：建 D1 + KV
pnpm exec wrangler d1 create finance_dashboard
pnpm exec wrangler kv namespace create KV
# → 把 ID 貼到 worker/wrangler.toml

# 套 migrations
pnpm exec wrangler d1 migrations apply finance_dashboard --remote

# 設密鑰（FinMind 不需要 key；以下兩個視需要設）
pnpm exec wrangler secret put FRED_API_KEY    # 美國總經（可選）
pnpm exec wrangler secret put DIGEST_TOKEN    # 本機 claude -p 寫回 D1 用

# 部署 worker
pnpm exec wrangler deploy

# 部署前端
cd ..
pnpm --filter web build
cd worker
pnpm exec wrangler pages deploy ../web/dist --project-name=finance-dashboard --branch=main
```

## 登入機制（Cloudflare Access + Google）

兩個 hostname 各掛一個 Access self-hosted application：

- `finance-dashboard-6bb.pages.dev`（前端）
- `finance-dashboard-worker.nihongo.workers.dev`（API）

IdP：Google（OAuth client 自行在 Google Cloud Console 申請），policy：email allowlist。

**Pages Function 代理**：browser 跨網域連 worker 會被 Access 擋（cookie 不跨域、XHR 跟不了 SSO redirect）。解法是 [web/functions/api/[[path]].ts](web/functions/api/[[path]].ts) 同源接 `/api/*`，server-side 用 service token 轉發到 worker（worker Access policy 加一條 Service Auth 放行）。前端 `.env.production` 的 `VITE_API_BASE` 留空即可。

Pages Secrets：`CF_ACCESS_CLIENT_ID` / `CF_ACCESS_CLIENT_SECRET` / `WORKER_ORIGIN`。

**新增使用者**：CF Zero Trust → Access → Applications → 兩個 app 各自編輯 Policy → Include emails 加新 email；非白名單 Google 登入後看到客製 deny 訊息（ASCII only，CF 限制）。

**登出**：TopNav 右上角「登出」連結指向 `/cdn-cgi/access/logout`，清掉兩邊 cookie。

## 每日重算 cron

兩條 cron：

1. **Cloudflare Worker built-in cron**（`0 0 * * *` UTC = 08:00 台北）— 自動跑 `runScreenerScan`、sentiment、digest pipeline，內部觸發不受 Access 影響。
2. **Local Mac crontab**（18:30 台北，盤後重算）— [scripts/cron-rescore.sh](scripts/cron-rescore.sh) 用 service token 打 `/api/admin/screener-scan`：

```cron
30 18 * * * /Users/yihao.wang/project/finance-dashboard/scripts/cron-rescore.sh >> ~/.local/var/log/finance-dashboard-rescore.log 2>&1
```

需在 `.env` 設 `ADMIN_TOKEN`、`CF_ACCESS_CLIENT_ID`、`CF_ACCESS_CLIENT_SECRET`。

## 本機 AI Digest 安裝（Mac）

讓每天 AI 解讀走你既有的 Claude Code 訂閱（Opus/Sonnet 品質 >> Llama）：

```bash
# 預設條件
brew install jq                       # JSON 處理
# claude CLI 安裝：https://docs.anthropic.com/en/docs/claude-code

# 一鍵註冊每天 08:00 launchd
DIGEST_TOKEN=<與 worker 上一致的 token> bash scripts/install.sh

# 立刻測試
DIGEST_TOKEN=<token> bash scripts/run-digest.sh
```

詳見 [scripts/README.md](./scripts/README.md)。

## 專案結構

```
finance_dashboard/
  shared/             # 共用 TypeScript 類型
  worker/             # Cloudflare Worker (Hono)
    src/
      sources/        # 外部資料源 adapters（yahoo, twse, fred, finmind, ...）
      indicators/     # 技術指標（SMA/RSI/MACD/Deviation/Range）
      lib/            # 工具（symbol/http/sentiment/digest-prompt/digest-runner）
      cache/          # KV / D1 helpers
      routes/         # /api/* endpoints
      cron.ts         # scheduled handler
      index.ts        # Hono app + scheduled export
    migrations/       # D1 schema migrations
    test/             # Vitest unit tests
    wrangler.toml     # CF Worker config（含 AI binding + cron）
  web/                # React + Vite frontend
    src/
      pages/          # DashboardPage, DigestHistory
      components/     # Hero, KpiGrid, PriceChart, MacroPanel, AnalysisPanels, NewsPanel, DigestCard, ...
      hooks/          # useStock, useMacro, useNews, useDigest, ...
      lib/            # api fetchers, glossary
    e2e/              # Playwright E2E
  scripts/            # 本機 claude -p 排程
    run-digest.sh
    install.sh
    com.tickr.digest.plist.template
    README.md
  docs/superpowers/   # 設計 spec 與 implementation plans
  mockup/             # 早期設計 mockup
```

## 資料來源對應表

| 區塊 | 資料來源 | Endpoint |
|---|---|---|
| 即時報價 / 52W / 量 | Yahoo Finance v8 | `query1.finance.yahoo.com/v8/finance/chart/{symbol}.TW` |
| K 線歷史 | Yahoo Finance v8 | 同上 + `range=` |
| 中文名 + P/E + P/B + 殖利率 | TWSE OpenAPI BWIBBU | `openapi.twse.com.tw/v1/exchangeReport/BWIBBU_d` |
| 月營收 + YoY | TWSE OpenAPI | `openapi.twse.com.tw/v1/opendata/t187ap05_L` |
| 三大法人 | TWSE | `www.twse.com.tw/rwd/zh/fund/T86` |
| 融資融券 | TWSE | `www.twse.com.tw/rwd/zh/marginTrading/MI_MARGN` |
| 外資持股比 | TWSE | `www.twse.com.tw/rwd/zh/fund/MI_QFIIS` |
| 季報（毛利/營益/淨利/ROE/EPS） | FinMind 免費 API | `api.finmindtrade.com/api/v4/data` |
| 中文新聞 RSS | Yahoo TW | `tw.stock.yahoo.com/rss?s={symbol}.TW` |
| 美國總經（10Y/CPI/PCE/失業） | FRED | `api.stlouisfed.org/fred/series/observations` |
| 宏觀指數（VIX/SOX/DXY/TWD） | Yahoo Finance v8 | chart endpoint with `^VIX` etc. |

## 路由

```
/                      Dashboard (個股 + AI 卡)
/digest                AI 每日解讀歷史頁

# Worker API
GET  /api/health
GET  /api/stock/:symbol            完整 dashboard bundle
GET  /api/history/:symbol?range=   K 線歷史
GET  /api/macro                    宏觀指標
GET  /api/news/:symbol             新聞 + 情緒
GET  /api/digest                   今日大盤 digest
GET  /api/digest/:symbol           今日個股 digest
GET  /api/digest/history?scope=    digest 歷史
GET  /api/digest/payload           本機 claude 用：取 prompt（不呼 LLM）
POST /api/digest/upsert            本機 claude 用：寫回 D1（Bearer auth）
POST /api/digest/regenerate        手動觸發 cloudflare AI 路徑
```

## License

私人專案，僅供參考。資料來源各有其使用條款；本站數據僅供研究，**不構成投資建議**。
