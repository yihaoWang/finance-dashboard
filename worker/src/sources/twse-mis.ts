import { fetchWithRetry } from '../lib/http';

export type TwseMisQuote = {
  symbol: string;
  name: string;
  price: number | null;
  prevClose: number | null;
  open: number | null;
  high: number | null;
  low: number | null;
  volumeLots: number;
  marketTime: number | null;
};

type Opts = { fetcher?: typeof fetch };

const UA = 'Mozilla/5.0 (compatible; FinanceDashboard/0.1)';

const num = (s: string | undefined): number | null => {
  if (s === undefined || s === null || s === '' || s === '-') return null;
  const v = Number(s);
  return Number.isFinite(v) ? v : null;
};

type RawRow = {
  c?: string;
  n?: string;
  nf?: string;
  z?: string;
  y?: string;
  o?: string;
  h?: string;
  l?: string;
  v?: string;
  tlong?: string;
};

export const fetchTwseMisQuote = async (
  symbol: string,
  opts: Opts = {},
): Promise<TwseMisQuote | null> => {
  const url = `https://mis.twse.com.tw/stock/api/getStockInfo.jsp?ex_ch=tse_${symbol}.tw&json=1&delay=0&_=${Date.now()}`;
  const res = await fetchWithRetry(
    url,
    { headers: { 'User-Agent': UA, Referer: 'https://mis.twse.com.tw/stock/index.jsp' } },
    { fetcher: opts.fetcher },
  );
  const json = (await res.json()) as { msgArray?: RawRow[] };
  const row = json.msgArray?.[0];
  if (!row || row.c !== symbol) return null;

  // `z` is the most recent trade. During the gap between ticks it may be "-".
  // In that case fall back to today's last seen price (h or l, whichever is closer to o).
  let price = num(row.z);
  if (price === null) {
    // Use today's most recent traded price proxy: average of h/l or just o
    const h = num(row.h);
    const l = num(row.l);
    const o = num(row.o);
    price = h !== null && l !== null ? (h + l) / 2 : (o ?? null);
  }

  return {
    symbol,
    name: row.n ?? symbol,
    price,
    prevClose: num(row.y),
    open: num(row.o),
    high: num(row.h),
    low: num(row.l),
    volumeLots: num(row.v) ?? 0,
    marketTime: num(row.tlong),
  };
};
