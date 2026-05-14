export type Quote = {
  symbol: string;
  name: string;
  price: number;
  change: number;
  changePct: number;
  volume: number;
  marketCap: number | null;
  high52w: number | null;
  low52w: number | null;
  updatedAt: number;
  marketTime: number | null;
};

export type Kpi = {
  macd: number | null;
  macdSignal: 'bullish' | 'bearish' | 'neutral';
  ma20Deviation: number | null;
  grossMargin: number | null;
  forwardPe: number | null;
  monthlyRevenueYoy: number | null;
  netMargin: number | null;
  opMargin: number | null;
  pe: number | null;
  resistance: number | null;
  roe: number | null;
  rsi14: number | null;
  support: number | null;
  ttmEps: number | null;
};

export type PricePoint = { date: string; close: number };

export type Chips = {
  date: string;
  foreignNet: number;
  trustNet: number;
  dealerNet: number;
  financingBalance: number | null;
  shortBalance: number | null;
  foreignHoldingPct: number | null;
} | null;

export type StockBundle = { quote: Quote; kpi: Kpi; history: PricePoint[]; chips: Chips };

export type Freshness = {
  source: 'kv' | 'd1' | 'fetch';
  ageSeconds: number;
};

export type MacroQuote = { value: number; changePct: number };

export type FredObservation = { latest: number; prev: number; date: string } | null;

export type FredSnapshot = {
  dgs10: FredObservation;
  cpi: FredObservation;
  pce: FredObservation;
  unrate: FredObservation;
  fedFunds: FredObservation;
  nfpChange: FredObservation;
  gdpYoy: FredObservation;
  pmi: FredObservation;
  ppi: FredObservation;
  umcsent: FredObservation;
};

export type MacroBundle = {
  us10y: MacroQuote | null;
  vix: MacroQuote | null;
  sox: MacroQuote | null;
  dxy: MacroQuote | null;
  twd: MacroQuote | null;
  fred?: FredSnapshot;
};

export type ApiResponse<T> = {
  data: T;
  freshness: Freshness;
  warnings?: string[];
};

export type SentimentT = 'positive' | 'negative' | 'neutral';

export type NewsItem = {
  title: string;
  publisher: string;
  publishedAt: number;
  link: string;
  sentiment: SentimentT;
};

export type NewsBundle = { items: NewsItem[] };

export type DigestScope = 'market' | 'stock';
export type DigestSection = {
  hard_data: string;
  framework: string;
  action_plan: string;
  sentiment: string;
};

export type InsightSourceKind = 'podcast' | 'youtube';

export type Insight = {
  id: string;
  source: string;
  sourceKind: InsightSourceKind;
  episodeTitle: string;
  episodeUrl: string | null;
  audioUrl: string | null;
  publishedAt: number;
  mainThesis: string;
  validationSignals: string[];
  reversalSignals: string[];
  frameworkTags: string[];
  actionHorizon: string | null;
  actionSuggestion: string | null;
  model: string;
  createdAt: number;
};

export type InsightsBundle = { items: Insight[]; fetchedAt: number };

export type DigestSource = { name: string; url: string; timestamp: number };
export type DigestBundle = {
  date: string;
  scope: DigestScope;
  symbol: string;
  sections: DigestSection;
  sources: DigestSource[];
  model: string;
  createdAt: number;
};
export type DigestHistoryItem = { date: string; scope: DigestScope; symbol: string; createdAt: number };

export type QuarterRow = {
  year: number;
  quarter: number;
  eps: number | null;
  grossMargin: number | null;
  opMargin: number | null;
  netMargin: number | null;
  roe: number | null;
  revenue: number | null;
};

export type EventImpact = 'high' | 'medium' | 'low';
export type EventCategory = 'fomc' | 'cpi' | 'employment' | 'gdp' | 'central_bank' | 'geopolitics' | 'other';

export type EventItem = {
  id: string;
  eventTime: number;
  category: EventCategory;
  title: string;
  country: string;
  impact: EventImpact;
  source: string;
  url: string | null;
  forecast: string | null;
  previous: string | null;
  actual: string | null;
};

export type EventsBundle = {
  items: EventItem[];
  fetchedAt: number;
};

export type FinancialsBundle = {
  symbol: string;
  history: QuarterRow[];
  fetchedAt: number;
};

export type MoatCategory = '無形資產' | '成本優勢' | '網路效應' | '高轉換成本' | '有效規模';
export type RiskCategory = 'R 監管風險' | 'I 通脹風險' | 'S 科技風險' | 'K 關鍵人物風險';

export interface PeaceCriterion {
  id: number;
  group: 'P' | 'E' | 'A' | 'C' | 'E2';  // E2 = 效率 (second E group in code)
  label: string;
  priority: boolean;
  passed: boolean | null;
  value: number | null;
  threshold: string;
  detail: string;  // 人話一句解釋
  note?: string;
}

export interface PeaceBundle {
  symbol: string;
  score: number;          // 0-16 passed
  total: number;          // 16
  priorityScore: number;  // 0-6 passed among priority items
  criteria: PeaceCriterion[];
  moat: MoatCategory[];
  risk: RiskCategory[];
  wacc: number;           // computed WACC used for #16
  computedAt: string;
}

export interface AnnualFinancialRow {
  year: number;
  revenue: number | null;
  grossProfit: number | null;
  operatingIncome: number | null;
  netIncome: number | null;
  eps: number | null;
  ocf: number | null;
  icf: number | null;
  fcf: number | null;
  fcfCf: number | null;  // financing cash flow
  totalAssets: number | null;
  totalEquity: number | null;
  totalDebt: number | null;     // short + long term
  currentAssets: number | null;
  currentLiabilities: number | null;
  incomeTaxExpense: number | null;
  pretaxIncome: number | null;
  capex: number | null;
}

export interface FiveYearFinancials {
  symbol: string;
  rows: AnnualFinancialRow[];  // sorted oldest-first, length 1–5
  fetchedAt: number;
}

export type IndicatorKey =
  | 'breadth_adr'
  | 'foreign_futures_oi'
  | 'institutional_5d'
  | 'margin_balance'
  | 'margin_maintenance'
  | 'options_pcr'
  | 'short_long_ratio';

export type SentimentZone = 'healthy' | 'neutral' | 'caution' | 'danger';

export interface LandmarkPoint {
  event: string;
  value: number;
  date: string;
}

export interface SentimentIndicator {
  key: IndicatorKey;
  label: string;
  value: number;
  unit: string;
  change5d: number;
  percentile: number;
  zone: SentimentZone;
  nearestLandmark: (LandmarkPoint & { distance: number }) | null;
  landmarks: LandmarkPoint[];
  explanation: string;
}

export interface FearGreedSnapshot {
  value: number;
  label: 'Extreme Fear' | 'Fear' | 'Neutral' | 'Greed' | 'Extreme Greed';
  percentile: number;
}

export interface SentimentBundle {
  fearGreed: FearGreedSnapshot;
  indicators: SentimentIndicator[];
  updatedAt: string;
}
