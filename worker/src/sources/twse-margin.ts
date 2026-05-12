import { fetchWithRetry } from '../lib/http';
import { kvGetJson, kvPutJson } from '../cache/kv';

export type MarginInfo = {
  date: string;
  financingBalance: number;
  shortBalance: number;
};

export type ForeignHolding = {
  date: string;
  holdingPct: number;
};

const TTL = 12 * 3600;
const KV_KEY_MARGIN = 'twse:margin';
const KV_KEY_FOREIGN = 'twse:foreign-holding';

// MI_MARGN (selectType=ALL) field indices in the per-stock table
const MARGN_CODE = 0;
const MARGN_FINANCING_TODAY = 6;  // 融資今日餘額
const MARGN_SHORT_TODAY = 12;     // 融券今日餘額

// MI_QFIIS field indices
const QFIIS_CODE = 0;
const QFIIS_HOLDING_PCT = 7; // 全體外資及陸資持股比率

const parseNum = (s: string | undefined): number => {
  if (s === undefined || s === null) return 0;
  const clean = String(s).replace(/,/g, '').trim();
  const v = Number(clean);
  return Number.isFinite(v) ? v : 0;
};

const formatDate = (d: Date): string => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}${m}${day}`;
};

const prevBusinessDay = (dateStr: string): string => {
  const d = new Date(
    Number(dateStr.slice(0, 4)),
    Number(dateStr.slice(4, 6)) - 1,
    Number(dateStr.slice(6, 8)),
  );
  d.setDate(d.getDate() - 1);
  while (d.getDay() === 0 || d.getDay() === 6) {
    d.setDate(d.getDate() - 1);
  }
  return formatDate(d);
};

type MagnResponse = {
  stat: string;
  date: string;
  tables: Array<{
    title?: string;
    fields?: string[];
    data?: string[][];
  }>;
};

type QfiisResponse = {
  stat: string;
  date: string;
  fields: string[];
  data: Array<Array<string | number>>;
};

type Opts = { fetcher?: typeof fetch };

const fetchMarginForDate = async (
  date: string,
  opts: Opts,
): Promise<Record<string, MarginInfo> | null> => {
  const url = `https://www.twse.com.tw/rwd/zh/marginTrading/MI_MARGN?date=${date}&selectType=ALL&response=json`;
  let res: Response;
  try {
    res = await fetchWithRetry(url, { headers: { Accept: 'application/json' } }, { fetcher: opts.fetcher });
  } catch (err) {
    console.warn('MI_MARGN fetch failed for date', date, err);
    return null;
  }

  const body = (await res.json()) as MagnResponse;
  if (body.stat !== 'OK' || !Array.isArray(body.tables)) return null;

  // The per-stock table is the second table (index 1)
  const table = body.tables[1];
  if (!table || !Array.isArray(table.data) || table.data.length === 0) return null;

  const displayDate = body.date ?? date;
  const map: Record<string, MarginInfo> = {};
  for (const row of table.data) {
    const code = row[MARGN_CODE]?.trim();
    if (!code) continue;
    map[code] = {
      date: displayDate,
      financingBalance: parseNum(row[MARGN_FINANCING_TODAY]),
      shortBalance: parseNum(row[MARGN_SHORT_TODAY]),
    };
  }
  return map;
};

const fetchForeignForDate = async (
  date: string,
  opts: Opts,
): Promise<Record<string, ForeignHolding> | null> => {
  const url = `https://www.twse.com.tw/rwd/zh/fund/MI_QFIIS?date=${date}&selectType=ALLBUT0999&response=json`;
  let res: Response;
  try {
    res = await fetchWithRetry(url, { headers: { Accept: 'application/json' } }, { fetcher: opts.fetcher });
  } catch (err) {
    console.warn('MI_QFIIS fetch failed for date', date, err);
    return null;
  }

  const body = (await res.json()) as QfiisResponse;
  if (body.stat !== 'OK' || !Array.isArray(body.data) || body.data.length === 0) return null;

  const displayDate = body.date ?? date;
  const map: Record<string, ForeignHolding> = {};
  for (const row of body.data) {
    const code = String(row[QFIIS_CODE] ?? '').trim();
    if (!code) continue;
    const rawPct = row[QFIIS_HOLDING_PCT];
    const holdingPct = typeof rawPct === 'number' ? rawPct : parseNum(String(rawPct));
    map[code] = { date: displayDate, holdingPct };
  }
  return map;
};

const fetchAllMargin = async (opts: Opts): Promise<Record<string, MarginInfo>> => {
  const today = formatDate(new Date());
  let dateStr = today;
  for (let attempt = 0; attempt < 5; attempt++) {
    const map = await fetchMarginForDate(dateStr, opts);
    if (map !== null) return map;
    dateStr = prevBusinessDay(dateStr);
  }
  console.warn('MI_MARGN: no data found after 5 attempts');
  return {};
};

const fetchAllForeign = async (opts: Opts): Promise<Record<string, ForeignHolding>> => {
  const today = formatDate(new Date());
  let dateStr = today;
  for (let attempt = 0; attempt < 5; attempt++) {
    const map = await fetchForeignForDate(dateStr, opts);
    if (map !== null) return map;
    dateStr = prevBusinessDay(dateStr);
  }
  console.warn('MI_QFIIS: no data found after 5 attempts');
  return {};
};

export const fetchTwseMargin = async (
  kv: KVNamespace,
  symbol: string,
  opts: Opts = {},
): Promise<MarginInfo | null> => {
  let map = await kvGetJson<Record<string, MarginInfo>>(kv, KV_KEY_MARGIN);
  if (!map) {
    map = await fetchAllMargin(opts);
    await kvPutJson(kv, KV_KEY_MARGIN, map, TTL);
  }
  return map[symbol] ?? null;
};

export const fetchMarginMaintenanceDaily = async (): Promise<{ date: string; value: number }> => {
  throw new Error('not yet wired — see Task 9 follow-up');
};

export const fetchShortLongRatioDaily = async (): Promise<{ date: string; value: number }> => {
  throw new Error('not yet wired — see Task 9 follow-up');
};

export const fetchTwseForeignHolding = async (
  kv: KVNamespace,
  symbol: string,
  opts: Opts = {},
): Promise<ForeignHolding | null> => {
  let map = await kvGetJson<Record<string, ForeignHolding>>(kv, KV_KEY_FOREIGN);
  if (!map) {
    map = await fetchAllForeign(opts);
    await kvPutJson(kv, KV_KEY_FOREIGN, map, TTL);
  }
  return map[symbol] ?? null;
};
