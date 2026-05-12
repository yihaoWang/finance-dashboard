import type { IndicatorKey, LandmarkPoint } from '@fd/shared';

export const HISTORICAL_LANDMARKS: Record<IndicatorKey, LandmarkPoint[]> = {
  margin_maintenance: [
    { event: '2008 金融海嘯底', value: 118, date: '2008-11-21' },
    { event: 'COVID-19 急跌底', value: 135, date: '2020-03-19' },
    { event: '2022 升息熊市底', value: 138, date: '2022-10-25' },
    { event: '2024 多頭高點', value: 168, date: '2024-07-11' },
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
  foreign_futures_oi: [
    { event: '2008 海嘯', value: -45000, date: '2008-11-21' },
    { event: '2020 COVID', value: -38000, date: '2020-03-19' },
    { event: '2022 熊市底', value: -35000, date: '2022-10-25' },
    { event: '2024 多頭高點', value: 32000, date: '2024-07-11' },
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
};
