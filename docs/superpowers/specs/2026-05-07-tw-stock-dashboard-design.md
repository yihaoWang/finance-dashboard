# 台股 Dashboard 設計規格

**日期**：2026-05-07
**狀態**：Draft → Pending Review
**作者**：Brainstorming session

## 概述

一個輸入台股代號就能整理出完整投資判斷面板的 dashboard。涵蓋基本面、估值、技術面、籌碼、宏觀環境六大模組，並針對每個指標提供「結合當前數據的智慧名詞解釋」。

部署於 Cloudflare（Workers + Pages + D1 + KV），純免費資料來源（證交所、MOPS、Yahoo Finance、FRED）。供作者本人遠端使用，手機 / 桌機皆可。

## 目標與非目標

### 目標

- 輸入台股代號 → 在一個畫面內看完所有決策關鍵指標
- 名詞 tooltip：hover 顯示定義 + 當前數值解讀（例如「P/E 27.4，第 78 分位 → 偏高」）
- 智慧快取：on-demand 抓取 + 自動寫入 D1，自然累積歷史
- 自選股快速切換
- 全球 edge 部署，手機可遠端使用

### 非目標（V1）

- 新聞 / 法說摘要（V2，需 LLM）
- 同業對照（V2）
- 警報 / 推播（V2）
- 多使用者 / 登入（V3）
- 歷史 P/E 分位圖（V1.5，需累積數據）

## 使用者故事

- 作為投資人，輸入 `2330` 後在 3 秒內看到台積電的全部關鍵數據
- 看到陌生指標時 hover ⓘ 立即理解定義 + 當前數值是高是低
- 把常看的 5–10 檔股票加進自選，可一鍵切換
- 在手機上能正常瀏覽

## 技術架構

### 前端

- React + Vite + TypeScript
- Tailwind CSS + shadcn/ui（Notion / Linear 風）
- Recharts 做圖表
- TanStack Query 管 API 與快取
- React Router

### 後端（Cloudflare Workers）

- Hono（輕量 edge router）
- TypeScript
- 部署到 Cloudflare Workers + Pages

### 儲存

- **D1（SQLite）**：結構化長期資料 — 財報、月營收、籌碼歷史、watchlist、daily_prices
- **KV**：短時效快取 — 即時報價、技術指標計算結果、宏觀彙整

### 資料來源（純免費）

| 來源 | 用途 |
|---|---|
| 證交所 OpenAPI | 三大法人 T86、融資融券 MI_MARGN、外資持股 MI_QFIIS、大盤本益比 BWIBBU_d |
| 公開資訊觀測站 (MOPS) | 月營收 t146sb05、合併損益表 t164sb04 |
| Yahoo Finance（非官方） | 即時報價、歷史 K 線、Forward P/E、宏觀指數 ^VIX / ^SOX / DX-Y.NYB / TWD=X |
| FRED API | 美債 10Y DGS10、Fed 利率 |

## 資料模型（D1 Schema）

```sql
CREATE TABLE stocks (
  symbol TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  industry TEXT,
  market TEXT,
  updated_at INTEGER
);

CREATE TABLE daily_prices (
  symbol TEXT,
  date TEXT,
  open REAL, high REAL, low REAL, close REAL,
  volume INTEGER,
  PRIMARY KEY (symbol, date)
);

CREATE TABLE monthly_revenue (
  symbol TEXT,
  year_month TEXT,
  revenue REAL,
  yoy REAL, mom REAL,
  PRIMARY KEY (symbol, year_month)
);

CREATE TABLE quarterly_financials (
  symbol TEXT,
  quarter TEXT,
  eps REAL,
  gross_margin REAL, op_margin REAL, net_margin REAL,
  roe REAL, roa REAL,
  PRIMARY KEY (symbol, quarter)
);

CREATE TABLE chip_daily (
  symbol TEXT,
  date TEXT,
  foreign_net INTEGER,
  trust_net INTEGER,
  dealer_net INTEGER,
  foreign_holding REAL,
  PRIMARY KEY (symbol, date)
);

CREATE TABLE watchlist (
  symbol TEXT PRIMARY KEY,
  added_at INTEGER,
  sort_order INTEGER
);

CREATE TABLE macro_daily (
  date TEXT PRIMARY KEY,
  us10y REAL, vix REAL, sox REAL, dxy REAL, twd REAL
);
```

## 快取策略（KV）

| Key | 內容 | TTL |
|---|---|---|
| `quote:{symbol}` | 即時股價 + 漲跌 + 成交量 | 60s（盤中）/ 12h（盤後） |
| `pe:{symbol}` | P/E、Forward P/E、市值 | 5 min |
| `tech:{symbol}` | RSI、乖離率、均線（計算結果） | 5 min |
| `macro:summary` | 宏觀燈號 + 5 個指標 | 1h |

## On-Demand 抓取流程

```
GET /api/stock/2330
  ↓
1. KV.quote:2330        → 命中 → 用，否 → Yahoo → 寫 KV
2. D1.daily_prices       → 今日已有 → 算 MA / 乖離 → 寫 KV.tech
                          否 → 爬 TWSE 收盤 → 寫 D1
3. D1.monthly_revenue    → 本月已有 → 用，否 → MOPS
4. D1.quarterly_financials → 本季已有 → 用，否 → MOPS
5. D1.chip_daily         → 今日已有 → 用，否 → TWSE T86
6. KV.macro:summary      → 命中 → 用，否 → FRED + Yahoo
  ↓
組裝 response
```

## API Endpoints

```
GET  /api/stock/:symbol              # 完整 dashboard 資料
GET  /api/stock/:symbol/quote        # 即時報價
GET  /api/stock/:symbol/financials   # 財報 + 月營收
GET  /api/stock/:symbol/chips        # 籌碼面
GET  /api/stock/:symbol/technicals   # 技術指標
GET  /api/stock/:symbol/history?range=1M

GET  /api/macro                      # 宏觀燈號 + 指標
GET  /api/watchlist                  # 取得自選清單
POST /api/watchlist                  # 加入
DELETE /api/watchlist/:symbol        # 移除

GET  /api/glossary                   # 名詞字典（給 tooltip）
GET  /api/search?q=2330              # 模糊搜尋
GET  /api/health                     # 健康檢查
```

### 統一回應格式

```ts
{
  data: T,
  freshness: { source: 'kv'|'d1'|'fetch', age_seconds: number },
  warnings?: string[]
}
```

## UI 架構

### 版型（個股 dashboard）

1. **頂部 Nav**：搜尋、模組分頁、⌘K
2. **自選股 Strip**：橫向 chip
3. **Hero**：股價 + 市值 + 52W + 報酬 + 風險燈號 4 顆
4. **KPI Grid 6 卡**：P/E、Forward P/E、TTM EPS、毛利率、月營收 YoY、月線乖離
5. **主圖**（左 2/3）：股價 + MA20 + 時段切換
6. **宏觀面板**（右 1/3）：US 10Y、VIX、SOX、DXY、USD/TWD + 綜合燈號
7. **三欄底層**：基本面（進度條）/ 籌碼面（買賣超 bar）/ 技術面
8. **消息面**（V2）

### 風格

- 深色為主（V1 只做暗色）
- 紫色 accent（#7c5cff）
- Tabular 數字
- 卡片化、留白、圓角 14px

### 名詞 Tooltip 元件

```tsx
<MetricLabel term="pe" value={27.4} percentile={78} />
```

Hover 顯示：

```
[名詞] P/E（本益比）
[定義] 股價 ÷ 近四季 EPS，估值倍數
[當前] 27.4，位於 5Y 第 78 分位 → 偏高
[判讀] 多頭末段常見，需搭配獲利成長率觀察
```

名詞字典：約 35 個指標 const，含 `name` / `formula` / `thresholds`（區間 → 解讀規則）。

## 模組劃分

```
/src
  /worker
    /routes        # /api/stock/:id, /api/macro, /api/watchlist
    /sources       # twse.ts, yahoo.ts, fred.ts, mops.ts
    /cache         # kv.ts, d1.ts (含 TTL 邏輯)
    /indicators    # ma.ts, rsi.ts, deviation.ts, percentile.ts
    /glossary      # 名詞字典 + thresholds
  /web
    /components    # MetricCard, MetricLabel, RiskLed, PriceChart...
    /pages         # Dashboard, StockDetail
    /hooks         # useStock, useWatchlist, useMacro
  /shared          # 共用型別
```

## 指標 → 來源對應表

| 指標 | 來源 | 端點 / 計算 |
|---|---|---|
| 即時報價、漲跌、成交量、52W | Yahoo | `query1.finance.yahoo.com/v7/finance/quote` |
| 歷史 K 線 | Yahoo | `/v8/finance/chart/2330.TW?range=1y` |
| P/E、Forward P/E、市值 | Yahoo | quoteSummary |
| 月營收 + YoY/MoM | MOPS | `t146sb05`（POST + parse HTML） |
| 單季 EPS、毛利率等 | MOPS | `t164sb04` |
| 三大法人 | TWSE | `openapi.twse.com.tw/v1/exchangeReport/T86` |
| 融資融券 | TWSE | `MI_MARGN` |
| 外資持股 | TWSE | `MI_QFIIS` |
| 均線 / 乖離 / RSI | 後端自算 | TS indicator lib |
| 美債 10Y、Fed 利率 | FRED | `api.stlouisfed.org/fred/series/observations?series_id=DGS10` |
| VIX / SOX / DXY / USD-TWD | Yahoo | `^VIX`, `^SOX`, `DX-Y.NYB`, `TWD=X` |
| 大盤 P/E | TWSE | `BWIBBU_d` |
| 名詞字典 | 內建 const | 35 個指標 |

## 爬蟲策略

- 帶合理 `User-Agent`
- MOPS HTML：用 `HTMLRewriter` 或正則解析表格
- 失敗重試：3 次 + exponential backoff
- Rate limit：每來源每分鐘 N 次，超過走快取或回傳 `warnings`
- `FRED_API_KEY` 放 Workers Secrets

## 安全考量

- 所有外部 fetch 走 Cloudflare 出口，不直接從瀏覽器呼叫第三方
- 輸入驗證：股票代號限制為 4–6 位英數字（防 SSRF / injection）
- D1 全部用 prepared statement
- CORS：只允許自家 Pages domain
- 不存任何使用者敏感資訊（V1 無登入）

## V1 交付清單

1. 股票搜尋 + 切換
2. 自選股清單（D1 持久化）
3. Hero：股價、漲跌、市值、52W、近期報酬
4. 風險燈號 4 顆
5. KPI 6 卡
6. 股價走勢圖 + MA20（1M/3M/1Y）
7. 宏觀面板（5 指標 + 燈號）
8. 基本面區（進度條 + 數據）
9. 籌碼面區（三大法人 + 融資融券）
10. 技術面區（均線 + RSI + 乖離 + 支撐壓力）
11. 名詞 tooltip（hover 顯示定義 + 當前解讀）
12. 名詞字典（35 個指標）
13. Cloudflare 部署 + 健康檢查

## V2 路線

- 新聞爬蟲 + LLM 摘要（Cloudflare Workers AI）
- 自訂警報 + Email / Push
- 同業對照（半導體 / 電子 / 金融）
- 歷史 P/E 分位圖
- MACD + 爆量偵測
- 借券賣出

## V3 路線

- 多使用者 + 登入
- 投資組合追蹤（持股、損益、報酬率）
- 短 / 中 / 長線指標權重切換

## 實作順序

```
週 1: Cloudflare scaffold + D1 schema + KV + Hono 路由
週 2: 資料來源 adapters（Yahoo + TWSE 先做，MOPS 後做）
週 3: indicator lib + 快取邏輯 + /api/stock/:symbol 整合
週 4: 前端 scaffold + TanStack Query + Hero + KPI 卡
週 5: 主圖 + 宏觀 + 三欄底層
週 6: 名詞字典 + tooltip + 自選股 + 部署上線
```

## 風險與降級

| 風險 | 影響 | 緩解 |
|---|---|---|
| Yahoo Finance 非官方 API 變動 | 報價 / 估值失效 | 寫 adapter 抽象層，必要時切換到 Investing.com / Goodinfo 爬蟲 |
| MOPS HTML 結構變動 | 財報 / 月營收抓不到 | 解析邏輯隔離成單一檔案，error log + email 警告 |
| TWSE OpenAPI 限流 | 籌碼資料延遲 | 快取 + 重試 + warnings 顯示在 UI |
| FRED API key 用盡 | 宏觀資料缺 | 改用 Yahoo `^TNX`（10Y 替代）|
| Workers CPU 30s 限制 | 第一次抓全套超時 | 拆分多個並行 fetch，indicator 計算 < 100ms |

## 開放問題

- 名詞字典的 thresholds 規則需要逐個指標確認（會在實作時定）
- 是否要做亮色模式：V1 不做，視使用情況決定 V2 是否加
