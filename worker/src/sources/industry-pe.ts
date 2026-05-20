import { fetchWithRetry } from '../lib/http';
import { kvGetJson, kvPutJson } from '../cache/kv';

// Data sources (free, no auth):
//   TWSE BWIBBU_ALL      — per-stock PE/PB/yield for listed (上市)
//   TWSE t187ap03_L      — company info incl. 產業別 for listed
//   TPEX peratio_analysis — per-stock PE/PB/yield for OTC (上櫃)
//   TPEX t187ap03_O      — company info incl. SecuritiesIndustryCode for OTC

const KV_KEY = 'industry-pe:map:v8';
const TTL = 12 * 3600;

type TwsePe = { Code: string; PEratio: string };
type TwseInfo = {
  公司代號: string;
  公司簡稱?: string;
  產業別: string;
  '已發行普通股數或TDR原股發行股數'?: string;
};
type TpexPe = { SecuritiesCompanyCode: string; PriceEarningRatio: string };
type TpexInfo = {
  SecuritiesCompanyCode: string;
  SecuritiesIndustryCode: string;
  CompanyAbbreviation?: string;
  IssueShares?: string;        // TPEX uses singular "Issue"; sometimes also IssuedShares
  IssuedShares?: string;
  OutstandingShares?: string;
};

type IndustryMap = {
  // symbol → industry key (namespaced "tw:01" / "tp:33")
  symbolIndustry: Record<string, string>;
  // industry key → { averagePe, peerCount, industryCode }
  industryAvg: Record<string, { averagePe: number; peerCount: number; industryCode: string }>;
  // market median PE (more robust than mean against tail outliers)
  marketPe: { tw: number | null; tp: number | null };
  // symbol → outstanding common shares (for market-cap computation)
  symbolShares: Record<string, number>;
  // symbol → Chinese company abbreviation
  symbolName: Record<string, string>;
};

const median = (values: number[]): number | null => {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1]! + sorted[mid]!) / 2 : sorted[mid]!;
};

const fetchJson = async <T>(url: string): Promise<T[]> => {
  // TWSE/TPEX OpenAPI quirk: Accept: */* returns a SCHEMA preview, not data.
  // Use application/json (or omit Accept entirely) to get the actual JSON array.
  const res = await fetchWithRetry(url, { headers: { Accept: 'application/json' } });
  const json = (await res.json()) as T[];
  return Array.isArray(json) ? json : [];
};

const parsePe = (s: string | undefined): number | null => {
  if (!s) return null;
  const n = parseFloat(s);
  return Number.isFinite(n) && n > 0 ? n : null;
};

const buildMap = async (): Promise<IndustryMap> => {
  // allSettled so one failing endpoint doesn't sink the whole map.
  // Especially important: TPEX endpoints occasionally redirect/HTML; we want partial TWSE data.
  const settled = await Promise.allSettled([
    fetchJson<TwsePe>('https://openapi.twse.com.tw/v1/exchangeReport/BWIBBU_ALL'),
    fetchJson<TwseInfo>('https://openapi.twse.com.tw/v1/opendata/t187ap03_L'),
    fetchJson<TpexPe>('https://www.tpex.org.tw/openapi/v1/tpex_mainboard_peratio_analysis'),
    fetchJson<TpexInfo>('https://www.tpex.org.tw/openapi/v1/mopsfin_t187ap03_O'),
  ]);
  const unwrap = <T>(r: PromiseSettledResult<T[]>, name: string): T[] => {
    if (r.status === 'fulfilled') {
      console.log(`[industry-pe] ${name}: ${r.value.length} rows`);
      return r.value;
    }
    console.warn(`[industry-pe] ${name} REJECTED:`, r.reason);
    return [];
  };
  const twsePe = unwrap(settled[0] as PromiseSettledResult<TwsePe[]>, 'BWIBBU_ALL');
  const twseInfo = unwrap(settled[1] as PromiseSettledResult<TwseInfo[]>, 't187ap03_L');
  const tpexPe = unwrap(settled[2] as PromiseSettledResult<TpexPe[]>, 'tpex_peratio');
  const tpexInfo = unwrap(settled[3] as PromiseSettledResult<TpexInfo[]>, 'tpex_t187ap03_O');

  const symbolIndustry: Record<string, string> = {};
  const symbolShares: Record<string, number> = {};
  const symbolName: Record<string, string> = {};
  // industry key → list of PE values
  const buckets: Record<string, { code: string; values: number[] }> = {};
  const twAllPe: number[] = [];
  const tpAllPe: number[] = [];

  const parseShares = (s: string | undefined): number | null => {
    if (s === undefined || s === '') return null;
    const n = parseInt(s.replace(/[^0-9]/g, ''), 10);
    return Number.isFinite(n) && n > 0 ? n : null;
  };

  // TWSE
  const twseCodeToIndustry = new Map<string, string>();
  for (const r of twseInfo) {
    if (r.公司代號 && r.產業別) twseCodeToIndustry.set(r.公司代號, r.產業別.trim());
    const shares = parseShares(r['已發行普通股數或TDR原股發行股數']);
    if (r.公司代號 && shares !== null) symbolShares[r.公司代號] = shares;
    if (r.公司代號 && r.公司簡稱) symbolName[r.公司代號] = r.公司簡稱.trim();
  }
  for (const r of twsePe) {
    const ind = twseCodeToIndustry.get(r.Code);
    if (!ind) continue;
    const key = `tw:${ind}`;
    symbolIndustry[r.Code] = key;
    const pe = parsePe(r.PEratio);
    if (pe !== null) {
      const bucket = buckets[key] ?? (buckets[key] = { code: ind, values: [] });
      bucket.values.push(pe);
      twAllPe.push(pe);
    }
  }

  // TPEX
  const tpexCodeToIndustry = new Map<string, string>();
  for (const r of tpexInfo) {
    if (r.SecuritiesCompanyCode && r.SecuritiesIndustryCode) {
      tpexCodeToIndustry.set(r.SecuritiesCompanyCode, r.SecuritiesIndustryCode.trim());
    }
    const shares =
      parseShares(r.IssueShares) ?? parseShares(r.IssuedShares) ?? parseShares(r.OutstandingShares);
    if (r.SecuritiesCompanyCode && shares !== null) symbolShares[r.SecuritiesCompanyCode] = shares;
    if (r.SecuritiesCompanyCode && r.CompanyAbbreviation) {
      symbolName[r.SecuritiesCompanyCode] = r.CompanyAbbreviation.trim();
    }
  }
  for (const r of tpexPe) {
    const ind = tpexCodeToIndustry.get(r.SecuritiesCompanyCode);
    if (!ind) continue;
    const key = `tp:${ind}`;
    symbolIndustry[r.SecuritiesCompanyCode] = key;
    const pe = parsePe(r.PriceEarningRatio);
    if (pe !== null) {
      const bucket = buckets[key] ?? (buckets[key] = { code: ind, values: [] });
      bucket.values.push(pe);
      tpAllPe.push(pe);
    }
  }

  const industryAvg: IndustryMap['industryAvg'] = {};
  for (const [key, { code, values }] of Object.entries(buckets)) {
    if (values.length === 0) continue;
    const avg = values.reduce((s, x) => s + x, 0) / values.length;
    industryAvg[key] = { averagePe: avg, peerCount: values.length, industryCode: code };
  }

  return {
    symbolIndustry,
    industryAvg,
    marketPe: { tw: median(twAllPe), tp: median(tpAllPe) },
    symbolShares,
    symbolName,
  };
};

export type MarketPeResult = { value: number | null; label: 'TAIEX' | 'TPEX' | null };

const loadMap = async (kv: KVNamespace): Promise<IndustryMap | null> => {
  let map = await kvGetJson<IndustryMap>(kv, KV_KEY);
  if (map === null) {
    try {
      map = await buildMap();
      if (Object.keys(map.industryAvg).length > 0) {
        await kvPutJson(kv, KV_KEY, map, TTL);
      }
    } catch (err) {
      console.warn('[industry-pe] build map failed', err);
      return null;
    }
  }
  return map;
};

export const fetchMarketPe = async (
  kv: KVNamespace,
  symbol: string,
): Promise<MarketPeResult> => {
  const map = await loadMap(kv);
  if (map === null) return { value: null, label: null };
  const key = map.symbolIndustry[symbol];
  // Default to TAIEX when symbol is unknown — it's the dominant TW market reference
  if (!key) return { value: map.marketPe.tw, label: 'TAIEX' };
  if (key.startsWith('tp:')) return { value: map.marketPe.tp, label: 'TPEX' };
  return { value: map.marketPe.tw, label: 'TAIEX' };
};

export const fetchSharesOutstanding = async (
  kv: KVNamespace,
  symbol: string,
): Promise<number | null> => {
  const map = await loadMap(kv);
  if (map === null) return null;
  return map.symbolShares[symbol] ?? null;
};

export const fetchSymbolName = async (
  kv: KVNamespace,
  symbol: string,
): Promise<string | null> => {
  const map = await loadMap(kv);
  if (map === null) return null;
  return map.symbolName[symbol] ?? null;
};

/**
 * Returns every TW listed/OTC stock symbol that has an industry classification.
 * (Excludes warrants, ETFs, etc. that don't appear in t187ap03 datasets.)
 */
export const fetchUniverse = async (kv: KVNamespace): Promise<string[]> => {
  const map = await loadMap(kv);
  if (map === null) return [];
  return Object.keys(map.symbolIndustry);
};

export type IndustryPeResult = { industry: string | null; averagePe: number | null; peerCount: number };

export const fetchIndustryPe = async (
  kv: KVNamespace,
  symbol: string,
): Promise<IndustryPeResult> => {
  const map = await loadMap(kv);
  if (map === null) return { industry: null, averagePe: null, peerCount: 0 };
  const key = map.symbolIndustry[symbol];
  if (!key) return { industry: null, averagePe: null, peerCount: 0 };
  const entry = map.industryAvg[key];
  if (!entry) return { industry: key, averagePe: null, peerCount: 0 };
  return { industry: key, averagePe: entry.averagePe, peerCount: entry.peerCount };
};
