import { fetchWithRetry } from '../lib/http';
import { kvGetJson, kvPutJson } from '../cache/kv';

export type TwseBwibbu = {
  code: string;
  name: string;
  pe: number | null;
  pb: number | null;
  dividendYield: number | null;
  fiscalYearQuarter: string;
};

export type TwseMonthlyRevenue = {
  code: string;
  yearMonth: string;
  revenue: number | null;
  yoy: number | null;
  mom: number | null;
};

type RawRow = {
  Code: string;
  Name: string;
  PEratio: string;
  PBratio: string;
  DividendYield: string;
  FiscalYearQuarter: string;
};

type RawRevenueRow = Record<string, string>;

const BWIBBU_URL = 'https://openapi.twse.com.tw/v1/exchangeReport/BWIBBU_d';
const REVENUE_URL = 'https://openapi.twse.com.tw/v1/opendata/t187ap05_L';
const KV_KEY = 'twse:bwibbu';
const REVENUE_KV_KEY = 'twse:revenue';
const TTL = 12 * 3600;

const num = (s: string): number | null => {
  if (s === '' || s === null || s === undefined) return null;
  const v = Number(s);
  return Number.isFinite(v) ? v : null;
};

type Opts = { fetcher?: typeof fetch };

const fetchAll = async (opts: Opts = {}): Promise<Record<string, TwseBwibbu>> => {
  const res = await fetchWithRetry(
    BWIBBU_URL,
    { headers: { Accept: 'application/json' } },
    { fetcher: opts.fetcher },
  );
  const rows = (await res.json()) as RawRow[];
  const map: Record<string, TwseBwibbu> = {};
  for (const r of rows) {
    map[r.Code] = {
      code: r.Code,
      name: r.Name,
      pe: num(r.PEratio),
      pb: num(r.PBratio),
      dividendYield: num(r.DividendYield),
      fiscalYearQuarter: r.FiscalYearQuarter,
    };
  }
  return map;
};

export const fetchTwseBwibbu = async (
  kv: KVNamespace,
  symbol: string,
  opts: Opts = {},
): Promise<TwseBwibbu | null> => {
  let map = await kvGetJson<Record<string, TwseBwibbu>>(kv, KV_KEY);
  if (!map) {
    map = await fetchAll(opts);
    await kvPutJson(kv, KV_KEY, map, TTL);
  }
  return map[symbol] ?? null;
};

const fetchAllRevenue = async (opts: Opts = {}): Promise<Record<string, TwseMonthlyRevenue>> => {
  const res = await fetchWithRetry(
    REVENUE_URL,
    { headers: { Accept: 'application/json' } },
    { fetcher: opts.fetcher },
  );
  const rows = (await res.json()) as RawRevenueRow[];
  const map: Record<string, TwseMonthlyRevenue> = {};
  for (const r of rows) {
    const code = r['公司代號'];
    if (!code) continue;
    map[code] = {
      code,
      yearMonth: r['資料年月'] ?? '',
      revenue: num(r['營業收入-當月營收'] ?? ''),
      yoy: num(r['營業收入-去年同月增減(%)'] ?? ''),
      mom: num(r['營業收入-上月比較增減(%)'] ?? ''),
    };
  }
  return map;
};

export const fetchTwseMonthlyRevenue = async (
  kv: KVNamespace,
  symbol: string,
  opts: Opts = {},
): Promise<TwseMonthlyRevenue | null> => {
  let map = await kvGetJson<Record<string, TwseMonthlyRevenue>>(kv, REVENUE_KV_KEY);
  if (!map) {
    map = await fetchAllRevenue(opts);
    await kvPutJson(kv, REVENUE_KV_KEY, map, TTL);
  }
  return map[symbol] ?? null;
};
