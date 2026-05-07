import { fetchWithRetry } from '../lib/http';
import type { MacroBundle, MacroQuote } from '@fd/shared';

type Opts = { fetcher?: typeof fetch; userAgent?: string };

const DEFAULT_UA = 'Mozilla/5.0 (compatible; FinanceDashboard/0.1)';

const headers = (ua: string): HeadersInit => ({
  'User-Agent': ua,
  'Accept': 'application/json',
});

const fetchYahooMacro = async (
  symbol: string,
  opts: Opts,
): Promise<MacroQuote> => {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?range=1d&interval=1d`;
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
  const changePct = prevClose === 0 ? 0 : ((price - prevClose) / prevClose) * 100;
  return { value: price, changePct };
};

export const fetchMacroBundle = async (opts: Opts = {}): Promise<MacroBundle> => {
  const [us10yRes, vixRes, soxRes, dxyRes, twdRes] = await Promise.allSettled([
    fetchYahooMacro('^TNX', opts),
    fetchYahooMacro('^VIX', opts),
    fetchYahooMacro('^SOX', opts),
    fetchYahooMacro('DX-Y.NYB', opts),
    fetchYahooMacro('TWD=X', opts),
  ]);

  const resolve = (r: PromiseSettledResult<MacroQuote>): MacroQuote | null =>
    r.status === 'fulfilled' ? r.value : null;

  // ^TNX: Yahoo returns the yield already as a percentage (e.g. 4.32 = 4.32%).
  // If Yahoo ever returns it ×10 (e.g. 43.2), divide by 10 here.
  // Current Yahoo behaviour: value is already the percentage, no division needed.
  const us10yRaw = resolve(us10yRes);
  const us10y: MacroQuote | null = us10yRaw !== null
    ? { value: us10yRaw.value, changePct: us10yRaw.changePct }
    : null;

  return {
    us10y,
    vix: resolve(vixRes),
    sox: resolve(soxRes),
    dxy: resolve(dxyRes),
    twd: resolve(twdRes),
  };
};
