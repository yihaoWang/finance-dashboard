# 市場情緒 / 籌碼指標面板 Design

## 目標

在 Tickr dashboard 加入 7 個台股市場情緒與籌碼指標，每個指標附 10 年動態 percentile + 經典歷史事件錨點，並將指標訊號整合進 digest 的 `action_plan` 段落。

## 7 個指標

| # | key | 中文 | 資料來源 | 計算 |
|---|---|---|---|---|
| 1 | `fear_greed` | 台股恐懼貪婪指數 | 自製 0–100 | 子指標加權平均（波動度 / 騰落 / 融資變化 / PCR / 法人多空 / 外資期貨） |
| 2 | `margin_maintenance` | 融資維持率 | `twse-margin.ts`（既有） | TWSE 公開 |
| 3 | `short_long_ratio` | 券資比 | `twse-margin.ts` | 融券餘額 / 融資餘額 |
| 4 | `institutional_5d` | 三大法人 5 日累計買賣超 | `twse-chips.ts`（既有） | 5 日 rolling sum |
| 5 | `foreign_futures_oi` | 外資台指期未平倉淨口數 | `taifex.ts`（新） | TAIFEX OpenAPI |
| 6 | `breadth_adr` | 大盤騰落比 ADR | `twse-breadth.ts`（新） | 上漲家數 / 下跌家數 |
| 7 | `options_pcr` | 選擇權 Put/Call Ratio | `taifex.ts` | TAIFEX |

## 架構

### 資料層
- 新 sources：`taifex.ts`、`twse-breadth.ts`
- 新 D1 migration `0006_sentiment_history.sql`：
  ```sql
  CREATE TABLE sentiment_history (
    indicator TEXT NOT NULL,
    date TEXT NOT NULL,
    value REAL NOT NULL,
    PRIMARY KEY (indicator, date)
  );
  CREATE INDEX idx_sentiment_indicator_date ON sentiment_history(indicator, date DESC);
  ```
- Backfill 一次性腳本 `scripts/backfill-sentiment-history.ts`：爬 10 年歷史寫入 D1
- 既有 daily cron 追加每日值

### 計算層
- `worker/src/lib/sentiment.ts`：
  - `computeFearGreed(inputs)` → 0–100
  - `computePercentile(indicator, value)` → 10 年百分位
  - `findNearestHistoricalEvent(indicator, value)` → 最接近的命名事件
- `worker/src/data/historical-landmarks.ts`：寫死的經典事件錨點（含 10 年外，如 2008 海嘯）。每指標 3–4 點：崩盤底 / 多頭頂 / 重大事件。

### API
`GET /api/sentiment` 回傳：
```ts
{
  fearGreed: { value: 38, label: 'Fear', percentile: 22 },
  indicators: [
    {
      key: 'margin_maintenance',
      label: '融資維持率',
      value: 142,
      unit: '%',
      change5d: -3.2,
      percentile: 12,
      zone: 'caution' | 'healthy' | 'danger',
      nearestLandmark: { event: '2022 升息熊市底', value: 138, date: '2022-10-25', distance: 4 },
      landmarks: [
        { event: '2008 金融海嘯底', value: 118, date: '2008-11-21' },
        { event: 'COVID-19 急跌底', value: 135, date: '2020-03-19' },
        { event: '2022 升息熊市底', value: 138, date: '2022-10-25' },
        { event: '2024 多頭高點', value: 168, date: '2024-07-11' }
      ],
      explanation: '目前接近 2022/10 熊市底水位，留意斷頭風險'
    }
    // ... 6 more
  ],
  updatedAt: '...'
}
```

### 前端
- `web/src/hooks/useSentiment.ts`（pattern: `useNews`）
- `web/src/components/SentimentPanel.tsx`：頂層容器
- `web/src/components/FearGreedGauge.tsx`：0–100 半圓 gauge
  - 0–25 極度恐懼（紅）/ 25–45 恐懼（橘）/ 45–55 中性（灰）/ 55–75 貪婪（淺綠）/ 75–100 極度貪婪（綠）
- `web/src/components/SentimentCard.tsx`：單一指標卡，含 percentile bar + 3 個歷史錨點清單
- 嵌入 `DashboardPage.tsx`：`MacroPanel` 與 `AnalysisPanels` 之間

### Digest 整合
`worker/src/routes/digest.ts` 的 prompt builder 注入 `<sentiment>` 區塊（含 7 指標的 `{label, value, percentile, zone, nearestLandmark}`），要求 LLM 在 `action_plan` 段結合情緒指標給出操作建議。

### 共用型別
`shared/src/types.ts` 新增 `SentimentIndicator`、`SentimentBundle`、`LandmarkPoint`、`FearGreedSnapshot`。

## Testing
- 每個新 source / lib 函式 vitest（mock fetch + D1）
- Route handler 三層 cache 測試（沿用 `routes/macro.ts` pattern）
- 前端 component vitest + RTL snapshot

## 部署順序
1. D1 migration 0006（local + remote）
2. Backfill 腳本跑一次（10 年歷史）
3. Deploy worker（cron 追加邏輯 + `/api/sentiment` + digest prompt 更新）
4. Deploy web（SentimentPanel + FearGreedGauge）

## 不在範圍
- 個股層級的情緒指標（僅大盤）
- 即時 streaming（沿用既有 daily cron + 5min stale 前端）
- 自訂指標權重 UI（恐懼貪婪指數權重寫死，後續需要再開新 spec）
