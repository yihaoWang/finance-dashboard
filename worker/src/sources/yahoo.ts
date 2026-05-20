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
  marketTime: number | null;
};

type Opts = { fetcher?: typeof fetch; userAgent?: string };

const DEFAULT_UA = 'Mozilla/5.0 (compatible; FinanceDashboard/0.1)';

const headers = (ua: string): HeadersInit => ({
  'User-Agent': ua,
  'Accept': 'application/json',
});

// Try .TW (TWSE 上市) then .TWO (TPEX 上櫃). Yahoo gives 404/empty for the wrong suffix.
const fetchYahooChart = async (
  symbol: string,
  range: string,
  opts: Opts,
): Promise<{ json: { chart: { result: Array<{ meta: Record<string, unknown>; timestamp?: number[]; indicators?: { quote: Array<{ open: number[]; high: number[]; low: number[]; close: number[]; volume: number[] }> } }> | null } } }> => {
  const suffixes = ['.TW', '.TWO'];
  let lastErr: unknown;
  for (const suf of suffixes) {
    try {
      const url = `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}${suf}?range=${range}&interval=1d`;
      const res = await fetchWithRetry(
        url,
        { headers: headers(opts.userAgent ?? DEFAULT_UA) },
        { fetcher: opts.fetcher },
      );
      const json = (await res.json()) as { chart: { result: Array<{ meta: Record<string, unknown>; timestamp?: number[]; indicators?: { quote: Array<{ open: number[]; high: number[]; low: number[]; close: number[]; volume: number[] }> } }> | null } };
      if (json.chart.result?.[0]) return { json };
      // empty result → try next suffix
    } catch (err) {
      lastErr = err;
      // try next
    }
  }
  throw lastErr ?? new Error('not_found');
};

export const fetchYahooQuote = async (
  symbol: string,
  opts: Opts = {},
): Promise<YahooQuote> => {
  const { json } = await fetchYahooChart(symbol, '1d', opts);
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
    marketTime: (() => {
      const t = num('regularMarketTime');
      return t === null ? null : t * 1000;
    })(),
  };
};

export const fetchYahooHistory = async (
  symbol: string,
  range: '1mo' | '3mo' | '1y' | '5y',
  opts: Opts = {},
): Promise<DailyPrice[]> => {
  const { json: histJson } = await fetchYahooChart(symbol, range, opts);
  const r2 = histJson.chart.result?.[0];
  if (!r2 || !r2.timestamp || !r2.indicators) throw new Error('not_found');
  const q2 = r2.indicators.quote[0];
  if (!q2) throw new Error('not_found');
  return r2.timestamp.map((ts, i) => ({
    date: new Date(ts * 1000).toISOString().slice(0, 10),
    open: q2.open[i] ?? 0,
    high: q2.high[i] ?? 0,
    low: q2.low[i] ?? 0,
    close: q2.close[i] ?? 0,
    volume: q2.volume[i] ?? 0,
  }));
};

