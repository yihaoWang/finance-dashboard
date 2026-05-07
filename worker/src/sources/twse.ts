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

type RawRow = {
  Code: string;
  Name: string;
  PEratio: string;
  PBratio: string;
  DividendYield: string;
  FiscalYearQuarter: string;
};

const BWIBBU_URL = 'https://openapi.twse.com.tw/v1/exchangeReport/BWIBBU_d';
const KV_KEY = 'twse:bwibbu';
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
