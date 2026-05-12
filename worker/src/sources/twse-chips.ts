import { fetchWithRetry } from '../lib/http';
import { kvGetJson, kvPutJson } from '../cache/kv';

export type ChipDaily = {
  code: string;
  date: string;
  foreignNet: number;
  trustNet: number;
  dealerNet: number;
};

const KV_KEY = 'twse:chips';
const TTL = 12 * 3600;

// T86 field indices
const IDX_CODE = 0;
const IDX_FOREIGN_NET = 4; // 外陸資買賣超股數(不含外資自營商)
const IDX_TRUST_NET = 10; // 投信買賣超股數
const IDX_DEALER_NET = 11; // 自營商買賣超股數

const parseNet = (s: string): number => {
  const clean = s.replace(/,/g, '').trim();
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
  // Skip weekends
  while (d.getDay() === 0 || d.getDay() === 6) {
    d.setDate(d.getDate() - 1);
  }
  return formatDate(d);
};

type T86Response = {
  stat: string;
  date: string;
  fields: string[];
  data: string[][];
};

type Opts = { fetcher?: typeof fetch };

const fetchForDate = async (date: string, opts: Opts): Promise<Record<string, ChipDaily> | null> => {
  const url = `https://www.twse.com.tw/rwd/zh/fund/T86?date=${date}&selectType=ALLBUT0999&response=json`;
  let res: Response;
  try {
    res = await fetchWithRetry(url, { headers: { Accept: 'application/json' } }, { fetcher: opts.fetcher });
  } catch (err) {
    console.warn('T86 fetch failed for date', date, err);
    return null;
  }

  const body = (await res.json()) as T86Response;
  if (body.stat !== 'OK' || !Array.isArray(body.data) || body.data.length === 0) {
    return null;
  }

  const displayDate = body.date ?? date;
  const map: Record<string, ChipDaily> = {};
  for (const row of body.data) {
    const code = row[IDX_CODE]?.trim();
    if (!code) continue;
    map[code] = {
      code,
      date: displayDate,
      foreignNet: parseNet(row[IDX_FOREIGN_NET] ?? '0'),
      trustNet: parseNet(row[IDX_TRUST_NET] ?? '0'),
      dealerNet: parseNet(row[IDX_DEALER_NET] ?? '0'),
    };
  }
  return map;
};

const fetchAll = async (opts: Opts): Promise<Record<string, ChipDaily>> => {
  const today = formatDate(new Date());
  let dateStr = today;

  for (let attempt = 0; attempt < 5; attempt++) {
    const map = await fetchForDate(dateStr, opts);
    if (map !== null) return map;
    dateStr = prevBusinessDay(dateStr);
  }

  console.warn('T86: no data found after 5 attempts');
  return {};
};

// FinMind dataset: TaiwanStockTotalInstitutionalInvestors
// name="total" → buy - sell = net institutional buy/sell in NTD
// Sum the latest 5 trading days and divide by 1e8 to get 億
const FINMIND_BASE = 'https://api.finmindtrade.com/api/v4/data';

type FinMindChipsRow = {
  date: string;
  name: string;
  buy: number;
  sell: number;
};

type FinMindChipsResponse = {
  msg: string;
  status: number;
  data: FinMindChipsRow[];
};

type ChipsOpts = { fetcher?: typeof fetch };

export const fetchInstitutional5dDaily = async (
  opts: ChipsOpts = {},
): Promise<{ date: string; value: number }> => {
  const startDate = new Date(Date.now() - 14 * 86400_000).toISOString().slice(0, 10);
  const url = `${FINMIND_BASE}?dataset=TaiwanStockTotalInstitutionalInvestors&start_date=${startDate}`;
  let res: Response;
  try {
    res = await fetchWithRetry(url, { headers: { Accept: 'application/json' } }, { fetcher: opts.fetcher });
  } catch (err) {
    console.warn('FinMind TaiwanStockTotalInstitutionalInvestors fetch failed', err);
    throw err;
  }
  const json = (await res.json()) as FinMindChipsResponse;
  if (json.status !== 200 || !Array.isArray(json.data) || json.data.length === 0) {
    throw new Error(`FinMind institutional response unexpected: ${json.msg}`);
  }
  // Filter to "total" rows, group by date
  const netByDate: Record<string, number> = {};
  for (const row of json.data) {
    if (row.name === 'total') {
      netByDate[row.date] = row.buy - row.sell;
    }
  }
  const sortedDates = Object.keys(netByDate).sort();
  if (sortedDates.length === 0) throw new Error('no total rows found');
  const latestDate = sortedDates[sortedDates.length - 1]!;
  // Sum last 5 trading days
  const last5 = sortedDates.slice(-5);
  const sum5 = last5.reduce((acc, d) => acc + (netByDate[d] ?? 0), 0);
  // Convert from NTD to 億 (1e8)
  const value = Number((sum5 / 1e8).toFixed(2));
  return { date: latestDate, value };
};

export const fetchTwseChips = async (
  kv: KVNamespace,
  symbol: string,
  opts: Opts = {},
): Promise<ChipDaily | null> => {
  let map = await kvGetJson<Record<string, ChipDaily>>(kv, KV_KEY);
  if (!map) {
    map = await fetchAll(opts);
    await kvPutJson(kv, KV_KEY, map, TTL);
  }
  return map[symbol] ?? null;
};
