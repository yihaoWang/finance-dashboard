import type { IndicatorKey, LandmarkPoint } from '@fd/shared';

export const HISTORICAL_LANDMARKS: Record<IndicatorKey, LandmarkPoint[]> = {
  // margin_maintenance is redefined as (融資餘額今日 / 融資餘額昨日) × 100.
  // This ratio hovers near 100; < 100 means balance shrinking (bearish), > 100 growing (bullish).
  // Landmark values updated to realistic range observed in FinMind TaiwanStockTotalMarginPurchaseShortSale.
  // (Original 118–168 scale assumed a direct 融資維持率 % field, which requires paid FinMind tier.)
  margin_maintenance: [
    { event: '2020 COVID 急跌底（融資快速縮減）', value: 97.5, date: '2020-03-19' },
    { event: '2022 升息熊市底（融資持續萎縮）', value: 98.2, date: '2022-10-25' },
    { event: '2023 反彈（融資回溫）', value: 100.5, date: '2023-01-16' },
    { event: '2024 多頭高峰（融資快速擴張）', value: 101.8, date: '2024-07-11' },
  ],
  short_long_ratio: [
    { event: '2008 金融海嘯', value: 0.8, date: '2008-10-28' },
    { event: '2020 COVID', value: 1.2, date: '2020-03-19' },
    { event: '2022 熊市底', value: 2.1, date: '2022-10-25' },
    { event: '2024 多頭高點', value: 4.5, date: '2024-07-11' },
  ],
  institutional_5d: [
    { event: '2020 COVID 急跌', value: -1500, date: '2020-03-19' },
    { event: '2022 熊市底', value: -1200, date: '2022-10-25' },
    { event: '2024 多頭高點', value: 1800, date: '2024-07-11' },
  ],
  // foreign_futures_oi is redefined as total TX open interest (口) from TaiwanFuturesDaily.
  // True net foreign OI requires paid FinMind tier (TaiwanFuturesInstitutionalInvestors).
  // Total TX OI typically ranges 40k–100k; landmarks updated to reflect this.
  foreign_futures_oi: [
    { event: '2020 COVID 急跌（市場萎縮）', value: 40000, date: '2020-03-19' },
    { event: '2022 熊市底（低量整理）', value: 45000, date: '2022-10-25' },
    { event: '2023 反彈（OI 回升）', value: 65000, date: '2023-06-01' },
    { event: '2024 多頭高峰（OI 高點）', value: 90000, date: '2024-07-11' },
  ],
  breadth_adr: [
    { event: '2020 COVID 急跌', value: 0.18, date: '2020-03-19' },
    { event: '2022 熊市底', value: 0.25, date: '2022-10-25' },
    { event: '2024 多頭高點', value: 2.8, date: '2024-07-11' },
  ],
  options_pcr: [
    { event: '2020 COVID 急跌', value: 1.85, date: '2020-03-19' },
    { event: '2022 熊市底', value: 1.62, date: '2022-10-25' },
    { event: '2024 多頭高點', value: 0.65, date: '2024-07-11' },
  ],
  // margin_balance: 融資餘額（億元），來源 FinMind MarginPurchaseMoney.TodayBalance / 1e8
  // 台股歷史區間約 2500–6000 億（2016年後）。極端低點 = 恐慌去槓桿；極端高點 = 過度槓桿警訊。
  margin_balance: [
    { event: '2020 COVID 急跌底', value: 2800, date: '2020-03-19' },
    { event: '2022 升息熊市底', value: 3200, date: '2022-10-25' },
    { event: '2024 多頭高點', value: 5500, date: '2024-07-11' },
    { event: '2025 高槓桿', value: 5800, date: '2025-06-15' },
  ],
};
