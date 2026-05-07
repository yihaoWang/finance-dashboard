export type Term = {
  name: string;
  definition: string;
  interpret?: (value: number | null) => string;
};

const fmt = (v: number | null, digits = 2, suffix = ''): string =>
  v === null ? '—' : `${v.toFixed(digits)}${suffix}`;

export const GLOSSARY: Record<string, Term> = {
  pe: {
    name: 'P/E（本益比）',
    definition: '股價 ÷ 近四季 EPS。代表市場願意付幾倍年盈餘買股票，是估值核心指標。',
    interpret: (v) => {
      if (v === null) return '尚無資料';
      if (v > 30) return `${fmt(v)} 偏高，多頭末段常見，需搭配獲利成長率觀察`;
      if (v < 15) return `${fmt(v)} 偏低，可能是價值區或成長放緩`;
      return `${fmt(v)} 中性區間`;
    },
  },
  forwardPe: {
    name: 'Forward P/E（預估本益比）',
    definition: '股價 ÷ 未來一年預估 EPS。比 TTM 更前瞻，但仰賴分析師估值準確度。',
    interpret: (v) => (v === null ? '免費資料來源不易取得，Phase 2 補上' : fmt(v)),
  },
  ttmEps: {
    name: 'TTM EPS（近四季每股盈餘）',
    definition: '最近 12 個月每股盈餘，等同近四季稅後淨利 ÷ 流通股數。',
    interpret: (v) => (v === null ? '尚無資料' : `${fmt(v)} 元`),
  },
  grossMargin: {
    name: '毛利率',
    definition: '(營收 − 營業成本) ÷ 營收。產品定價力與成本控制的綜合指標，越高代表產品越有議價力。',
    interpret: (v) => (v === null ? '尚無資料' : fmt(v, 1, '%')),
  },
  opMargin: {
    name: '營益率（營業利益率）',
    definition: '營業利益 ÷ 營收。扣除銷售與管理費用後的本業獲利能力，反映公司日常經營效率。',
    interpret: (v) => {
      if (v === null) return '尚無資料';
      if (v > 20) return `${fmt(v, 1, '%')} 優異`;
      if (v > 10) return `${fmt(v, 1, '%')} 良好`;
      return `${fmt(v, 1, '%')} 偏低，需關注費用控制`;
    },
  },
  netMargin: {
    name: '淨利率（稅後純益率）',
    definition: '稅後淨利 ÷ 營收。最終留存給股東的利潤比率，包含業外損益與稅務影響。',
    interpret: (v) => (v === null ? '尚無資料' : fmt(v, 1, '%')),
  },
  roe: {
    name: 'ROE（股東權益報酬率）',
    definition: '年化稅後淨利 ÷ 股東權益。衡量公司用股東資本創造獲利的效率，巴菲特最重視的指標之一。',
    interpret: (v) => {
      if (v === null) return '尚無資料';
      if (v > 20) return `${fmt(v, 1, '%')} 優異`;
      if (v > 10) return `${fmt(v, 1, '%')} 良好`;
      return `${fmt(v, 1, '%')} 偏低`;
    },
  },
  monthlyRevenueYoy: {
    name: '月營收 YoY',
    definition: '當月營業收入 vs 去年同月的成長率。台股財報延遲，月營收是最即時的成長指標。',
    interpret: (v) => {
      if (v === null) return '尚無資料';
      if (v > 20) return `${v > 0 ? '+' : ''}${fmt(v, 1, '%')} 強勁成長`;
      if (v > 0) return `+${fmt(v, 1, '%')} 溫和成長`;
      if (v > -10) return `${fmt(v, 1, '%')} 微幅衰退`;
      return `${fmt(v, 1, '%')} 明顯衰退`;
    },
  },
  ma20Deviation: {
    name: '月線乖離率',
    definition: '(現價 − 20 日均線) ÷ 20 日均線。短線過熱 / 過冷指標，常作為超買超賣判斷。',
    interpret: (v) => {
      if (v === null) return '尚無資料';
      if (v > 10) return `+${fmt(v, 2, '%')} 過熱，注意短線回檔`;
      if (v < -10) return `${fmt(v, 2, '%')} 過冷，可能反彈`;
      return `${v > 0 ? '+' : ''}${fmt(v, 2, '%')} 中性`;
    },
  },
  macd: {
    name: 'MACD（指數平滑異同移動平均）',
    definition: '12 日 EMA − 26 日 EMA。正值偏多，負值偏空。',
    interpret: (v) => {
      if (v === null) return '尚無資料';
      if (v > 0.5) return `${fmt(v)} 偏多`;
      if (v < -0.5) return `${fmt(v)} 偏空`;
      return `${fmt(v)} 中性`;
    },
  },
  resistance: {
    name: '壓力',
    definition: '近 20 日最高收盤，上檔可能遇阻。',
    interpret: (v) => (v === null ? '尚無資料' : `${fmt(v, 0)} 元`),
  },
  rsi14: {
    name: 'RSI(14)',
    definition: '14 日相對強弱指標，0~100。>70 超買，<30 超賣。',
    interpret: (v) => {
      if (v === null) return '尚無資料';
      if (v > 70) return `${fmt(v, 1)} 超買，注意短線回檔`;
      if (v < 30) return `${fmt(v, 1)} 超賣，可能反彈`;
      return `${fmt(v, 1)} 中性`;
    },
  },
  support: {
    name: '支撐',
    definition: '近 20 日最低收盤，下檔可能反彈點。',
    interpret: (v) => (v === null ? '尚無資料' : `${fmt(v, 0)} 元`),
  },
  marketCap: {
    name: '市值',
    definition: '股價 × 流通股數。代表整家公司在市場上的總價值，直接看公司規模。',
  },
  volume: {
    name: '成交量',
    definition: '當日交易股數，台股慣用「張」（1 張 = 1000 股）為單位。量能反映市場關注度。',
  },
  high52w: {
    name: '52 週高點 / 低點',
    definition: '近一年內的最高與最低成交價，看現價在年度區間的相對位置。',
  },
};
