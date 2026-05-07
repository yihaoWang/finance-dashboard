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
  const url = `https://query1.finance.yahoo.com/v7/finance/quote?symbols=${symbol}.TW`;
  const res = await fetchWithRetry(
    url,
    { headers: headers(opts.userAgent ?? DEFAULT_UA) },
    { fetcher: opts.fetcher },
  );
  const json = await res.json() as {
    quoteResponse: { result: Array<Record<string, unknown>> };
  };
  const r = json.quoteResponse.result[0];
  if (!r) throw new Error('not_found');
  const num = (k: string): number | null => {
    const v = r[k];
    return typeof v === 'number' ? v : null;
  };
  return {
    symbol,
    name: String(r.shortName ?? r.longName ?? symbol),
    price: num('regularMarketPrice') ?? 0,
    change: num('regularMarketChange') ?? 0,
    changePct: num('regularMarketChangePercent') ?? 0,
    volume: num('regularMarketVolume') ?? 0,
    marketCap: num('marketCap'),
    high52w: num('fiftyTwoWeekHigh'),
    low52w: num('fiftyTwoWeekLow'),
    pe: num('trailingPE'),
    forwardPe: num('forwardPE'),
    ttmEps: num('epsTrailingTwelveMonths'),
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
