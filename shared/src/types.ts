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
  pe: number | null;
  forwardPe: number | null;
  ttmEps: number | null;
  grossMargin: number | null;
  monthlyRevenueYoy: number | null;
  ma20Deviation: number | null;
};

export type PricePoint = { date: string; close: number };

export type Chips = {
  date: string;
  foreignNet: number;
  trustNet: number;
  dealerNet: number;
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
