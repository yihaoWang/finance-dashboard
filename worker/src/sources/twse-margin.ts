import { fetchWithRetry } from '../lib/http';
import { finMindToken } from '../lib/finmind-token';
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

// FinMind dataset: TaiwanStockTotalMarginPurchaseShortSale
// Fields:
//   name="MarginPurchase"  → TodayBalance = 融資餘額 (千股)
//   name="ShortSale"       → TodayBalance = 融券餘額 (千股)
//
// margin_maintenance: defined as (融資餘額今日 / 融資餘額昨日) × 100
//   This gives a value around 100 reflecting daily change momentum.
//   Redefined from the original 118–168 landmark scale to a ≈97–103 range;
//   landmarks in historical-landmarks.ts updated accordingly.
//   (TaiwanTotalExchangeMarginMaintenance requires a paid FinMind tier.)
//
// short_long_ratio: (融券餘額千股 / 融資餘額千股) × 100
//   Produces values 1.5–4 typically, consistent with landmark scale.

const FINMIND_BASE = 'https://api.finmindtrade.com/api/v4/data';

type FinMindMarginRow = {
  date: string;
  name: string;
  TodayBalance: number;
  YesBalance: number;
};

type FinMindMarginResponse = {
  msg: string;
  status: number;
  data: FinMindMarginRow[];
};

const isoDateNDaysAgo = (n: number): string => {
  const d = new Date(Date.now() - n * 86400_000);
  return d.toISOString().slice(0, 10);
};

export const fetchMarginMaintenanceDaily = async (
  opts: Opts = {},
): Promise<{ date: string; value: number }> => {
  const startDate = isoDateNDaysAgo(7);
  const url = `${FINMIND_BASE}?dataset=TaiwanStockTotalMarginPurchaseShortSale&start_date=${startDate}&token=${finMindToken()}`;
  let res: Response;
  try {
    res = await fetchWithRetry(url, { headers: { Accept: 'application/json' } }, { fetcher: opts.fetcher });
  } catch (err) {
    console.warn('FinMind TaiwanStockTotalMarginPurchaseShortSale fetch failed', err);
    throw err;
  }
  const json = (await res.json()) as FinMindMarginResponse;
  if (json.status !== 200 || !Array.isArray(json.data) || json.data.length === 0) {
    throw new Error(`FinMind margin response unexpected: ${json.msg}`);
  }
  // Group by date, pick latest
  const byDate: Record<string, { marginToday: number; marginYes: number }> = {};
  for (const row of json.data) {
    if (row.name === 'MarginPurchase') {
      const entry = byDate[row.date] ?? { marginToday: 0, marginYes: 0 };
      entry.marginToday = row.TodayBalance;
      entry.marginYes = row.YesBalance;
      byDate[row.date] = entry;
    }
  }
  const dates = Object.keys(byDate).sort();
  const latestDate = dates[dates.length - 1];
  if (latestDate === undefined) throw new Error('no MarginPurchase rows found');
  const { marginToday, marginYes } = byDate[latestDate]!;
  if (marginYes === 0) throw new Error('marginYes is zero, cannot compute ratio');
  // value = today / yesterday × 100 (e.g. 101.5 means +1.5% vs prior day)
  const value = Number(((marginToday / marginYes) * 100).toFixed(2));
  return { date: latestDate, value };
};

// FinMind MarginPurchaseMoney.TodayBalance is in NTD.
// Divide by 1e8 to convert to 億元.
export const fetchMarginBalanceDaily = async (
  opts: Opts = {},
): Promise<{ date: string; value: number }> => {
  const startDate = isoDateNDaysAgo(7);
  const url = `${FINMIND_BASE}?dataset=TaiwanStockTotalMarginPurchaseShortSale&start_date=${startDate}&token=${finMindToken()}`;
  let res: Response;
  try {
    res = await fetchWithRetry(url, { headers: { Accept: 'application/json' } }, { fetcher: opts.fetcher });
  } catch (err) {
    console.warn('FinMind TaiwanStockTotalMarginPurchaseShortSale (MarginPurchaseMoney) fetch failed', err);
    throw err;
  }
  const json = (await res.json()) as FinMindMarginResponse;
  if (json.status !== 200 || !Array.isArray(json.data) || json.data.length === 0) {
    throw new Error(`FinMind margin response unexpected: ${json.msg}`);
  }
  // Group by date, pick latest with MarginPurchaseMoney row
  const byDate: Record<string, number> = {};
  for (const row of json.data) {
    if (row.name === 'MarginPurchaseMoney') {
      byDate[row.date] = row.TodayBalance;
    }
  }
  const dates = Object.keys(byDate).sort();
  const latestDate = dates[dates.length - 1];
  if (latestDate === undefined) throw new Error('no MarginPurchaseMoney rows found');
  // Convert NTD → 億元 (1 億 = 1e8 NTD)
  const value = Number((byDate[latestDate]! / 1e8).toFixed(2));
  return { date: latestDate, value };
};

export const fetchShortLongRatioDaily = async (
  opts: Opts = {},
): Promise<{ date: string; value: number }> => {
  const startDate = isoDateNDaysAgo(7);
  const url = `${FINMIND_BASE}?dataset=TaiwanStockTotalMarginPurchaseShortSale&start_date=${startDate}&token=${finMindToken()}`;
  let res: Response;
  try {
    res = await fetchWithRetry(url, { headers: { Accept: 'application/json' } }, { fetcher: opts.fetcher });
  } catch (err) {
    console.warn('FinMind TaiwanStockTotalMarginPurchaseShortSale fetch failed', err);
    throw err;
  }
  const json = (await res.json()) as FinMindMarginResponse;
  if (json.status !== 200 || !Array.isArray(json.data) || json.data.length === 0) {
    throw new Error(`FinMind margin response unexpected: ${json.msg}`);
  }
  // Find latest date with both MarginPurchase and ShortSale
  const byDate: Record<string, { marginBalance: number; shortBalance: number }> = {};
  for (const row of json.data) {
    const entry = byDate[row.date] ?? { marginBalance: 0, shortBalance: 0 };
    if (row.name === 'MarginPurchase') entry.marginBalance = row.TodayBalance;
    if (row.name === 'ShortSale') entry.shortBalance = row.TodayBalance;
    byDate[row.date] = entry;
  }
  const dates = Object.keys(byDate).sort();
  const latestDate = dates[dates.length - 1];
  if (latestDate === undefined) throw new Error('no margin rows found');
  const { marginBalance, shortBalance } = byDate[latestDate]!;
  if (marginBalance === 0) throw new Error('marginBalance is zero, cannot compute ratio');
  // value = (融券餘額 / 融資餘額) × 100 → typically 1.5–4 range
  const value = Number(((shortBalance / marginBalance) * 100).toFixed(2));
  return { date: latestDate, value };
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
