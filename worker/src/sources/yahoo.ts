import { fetchWithRetry } from '../lib/http';
import type { DailyPrice } from '../cache/d1';

export type YahooQuote = {
  symbol: string;
  name: string;
  price: number;
  change: number;
  changePct: number;
  volume: number;
  marketCap: number | null;
  high52w: number | null;
  low52w: number | null;
  pe: number | null;
  forwardPe: number | null;
  ttmEps: number | null;
};

type Opts = { fetcher?: typeof fetch; userAgent?: string };

const DEFAULT_UA = 'Mozilla/5.0 (compatible; FinanceDashboard/0.1)';

const headers = (ua: string): HeadersInit => ({
  'User-Agent': ua,
  'Accept': 'application/json',
});

export const fetchYahooQuote = async (
  symbol: string,
  opts: Opts = {},
): Promise<YahooQuote> => {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}.TW?range=1d&interval=1d`;
  const res = await fetchWithRetry(
    url,
    { headers: headers(opts.userAgent ?? DEFAULT_UA) },
    { fetcher: opts.fetcher },
  );
  const json = await res.json() as {
    chart: { result: Array<{ meta: Record<string, unknown> }> | null };
  };
  const r = json.chart.result?.[0];
  if (!r) throw new Error('not_found');
  const m = r.meta;
  const num = (k: string): number | null => {
    const v = m[k];
    return typeof v === 'number' ? v : null;
  };
  const price = num('regularMarketPrice') ?? 0;
  const prevClose = num('chartPreviousClose') ?? price;
  const change = price - prevClose;
  const changePct = prevClose === 0 ? 0 : (change / prevClose) * 100;
  return {
    symbol,
    name: String(m.shortName ?? m.longName ?? symbol),
    price,
    change,
    changePct,
    volume: num('regularMarketVolume') ?? 0,
    marketCap: null,
    high52w: num('fiftyTwoWeekHigh'),
    low52w: num('fiftyTwoWeekLow'),
    pe: null,
    forwardPe: null,
    ttmEps: null,
  };
};

export const fetchYahooHistory = async (
  symbol: string,
  range: '1mo' | '3mo' | '1y' | '5y',
  opts: Opts = {},
): Promise<DailyPrice[]> => {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}.TW?range=${range}&interval=1d`;
  const res = await fetchWithRetry(
    url,
    { headers: headers(opts.userAgent ?? DEFAULT_UA) },
    { fetcher: opts.fetcher },
  );
  const json = await res.json() as {
    chart: { result: Array<{
      timestamp: number[];
      indicators: { quote: Array<{ open: number[]; high: number[]; low: number[]; close: number[]; volume: number[] }> };
    }> };
  };
  const r = json.chart.result[0];
  if (!r) throw new Error('not_found');
  const q = r.indicators.quote[0];
  return r.timestamp.map((ts, i) => ({
    date: new Date(ts * 1000).toISOString().slice(0, 10),
    open: q.open[i] ?? 0,
    high: q.high[i] ?? 0,
    low: q.low[i] ?? 0,
    close: q.close[i] ?? 0,
    volume: q.volume[i] ?? 0,
  }));
};
