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
export type MacroBundle = {
  us10y: MacroQuote | null;
  vix: MacroQuote | null;
  sox: MacroQuote | null;
  dxy: MacroQuote | null;
  twd: MacroQuote | null;
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
