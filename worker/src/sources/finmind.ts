import { fetchWithRetry } from '../lib/http';
import { kvGetJson, kvPutJson } from '../cache/kv';
import type { QuarterRow, FinancialsBundle } from '@fd/shared';

export type QuarterlyFinancials = {
  code: string;
  date: string;
  grossMargin: number | null;
  opMargin: number | null;
  netMargin: number | null;
  roe: number | null;
  quarterlyEps: number | null;
};

type FinancialRecord = {
  date: string;
  stock_id: string;
  type: string;
  value: number;
};

type FinMindResponse = {
  msg: string;
  status: number;
  data: FinancialRecord[];
};

type BalanceRecord = {
  date: string;
  stock_id: string;
  type: string;
  value: number;
};

const FINMIND_BASE = 'https://api.finmindtrade.com/api/v4/data';
const KV_KEY_PREFIX = 'finmind:financials:';
const KV_HISTORY_PREFIX = 'finmind:history:';
const TTL = 12 * 3600;

type Opts = { fetcher?: typeof fetch };

const num = (v: number | undefined): number | null => {
  if (v === undefined || !Number.isFinite(v)) return null;
  return v;
};

const buildFetchOpts = (opts: Opts): Parameters<typeof fetchWithRetry>[2] =>
  opts.fetcher !== undefined ? { fetcher: opts.fetcher } : {};

const fetchFinancialStatements = async (
  code: string,
  opts: Opts = {},
): Promise<Record<string, Record<string, number>>> => {
  const startDate = '2022-01-01';
  const url = `${FINMIND_BASE}?dataset=TaiwanStockFinancialStatements&data_id=${code}&start_date=${startDate}&token=`;
  const res = await fetchWithRetry(
    url,
    { headers: { Accept: 'application/json' } },
    buildFetchOpts(opts),
  );
  const json = (await res.json()) as FinMindResponse;
  if (json.status !== 200 || !Array.isArray(json.data)) return {};

  const byDate: Record<string, Record<string, number>> = {};
  for (const r of json.data) {
    const bucket = byDate[r.date] ?? {};
    bucket[r.type] = r.value;
    byDate[r.date] = bucket;
  }
  return byDate;
};

const fetchBalanceSheet = async (
  code: string,
  opts: Opts = {},
): Promise<Record<string, Record<string, number>>> => {
  const startDate = '2022-01-01';
  const url = `${FINMIND_BASE}?dataset=TaiwanStockBalanceSheet&data_id=${code}&start_date=${startDate}&token=`;
  const res = await fetchWithRetry(
    url,
    { headers: { Accept: 'application/json' } },
    buildFetchOpts(opts),
  );
  const json = (await res.json()) as { msg: string; status: number; data: BalanceRecord[] };
  if (json.status !== 200 || !Array.isArray(json.data)) return {};

  const byDate: Record<string, Record<string, number>> = {};
  for (const r of json.data) {
    const bucket = byDate[r.date] ?? {};
    bucket[r.type] = r.value;
    byDate[r.date] = bucket;
  }
  return byDate;
};

// Parse YYYY-Q{n} quarter from a date string like "2024-06-30"
const dateToYearQuarter = (dateStr: string): { year: number; quarter: number } => {
  const month = parseInt(dateStr.slice(5, 7), 10);
  const year = parseInt(dateStr.slice(0, 4), 10);
  const quarter = Math.ceil(month / 3);
  return { year, quarter };
};

const computeQuarterRow = (
  dateStr: string,
  incomeByDate: Record<string, Record<string, number>>,
  balanceByDate: Record<string, Record<string, number>>,
): QuarterRow => {
  const q = incomeByDate[dateStr] ?? {};
  const { year, quarter } = dateToYearQuarter(dateStr);

  const revenue = q['Revenue'];
  const grossProfit = q['GrossProfit'];
  const operatingIncome = q['OperatingIncome'];
  const netIncome = q['IncomeAfterTaxes'];
  const eps = q['EPS'];

  const grossMargin =
    revenue !== undefined && revenue !== 0 && grossProfit !== undefined
      ? num((grossProfit / revenue) * 100)
      : null;

  const opMargin =
    revenue !== undefined && revenue !== 0 && operatingIncome !== undefined
      ? num((operatingIncome / revenue) * 100)
      : null;

  const netMargin =
    revenue !== undefined && revenue !== 0 && netIncome !== undefined
      ? num((netIncome / revenue) * 100)
      : null;

  let roe: number | null = null;
  // Find closest balance sheet date at or before this income date
  const balanceDates = Object.keys(balanceByDate).sort();
  const applicableBalance = balanceDates.filter((d) => d <= dateStr).at(-1);
  if (applicableBalance !== undefined && netIncome !== undefined) {
    const latestBalance = balanceByDate[applicableBalance];
    if (latestBalance !== undefined) {
      const equity =
        latestBalance['EquityAttributableToOwnersOfParent'] ?? latestBalance['Equity'];
      if (equity !== undefined && equity !== 0) {
        roe = num(((netIncome * 4) / equity) * 100);
      }
    }
  }

  return {
    year,
    quarter,
    eps: num(eps),
    grossMargin,
    opMargin,
    netMargin,
    roe,
    revenue: num(revenue),
  };
};

const computeQuarterlyFinancials = (
  code: string,
  incomeByDate: Record<string, Record<string, number>>,
  balanceByDate: Record<string, Record<string, number>>,
): QuarterlyFinancials | null => {
  const dates = Object.keys(incomeByDate).sort();
  if (dates.length === 0) return null;

  const latestDate = dates[dates.length - 1];
  if (latestDate === undefined) return null;

  const q = incomeByDate[latestDate];
  if (q === undefined) return null;

  const revenue = q['Revenue'];
  const grossProfit = q['GrossProfit'];
  const operatingIncome = q['OperatingIncome'];
  const netIncome = q['IncomeAfterTaxes'];
  const eps = q['EPS'];

  const grossMargin =
    revenue !== undefined && revenue !== 0 && grossProfit !== undefined
      ? num((grossProfit / revenue) * 100)
      : null;

  const opMargin =
    revenue !== undefined && revenue !== 0 && operatingIncome !== undefined
      ? num((operatingIncome / revenue) * 100)
      : null;

  const netMargin =
    revenue !== undefined && revenue !== 0 && netIncome !== undefined
      ? num((netIncome / revenue) * 100)
      : null;

  // ROE = annualised net income / equity (equity from most recent available balance sheet quarter)
  let roe: number | null = null;
  const balanceDates = Object.keys(balanceByDate).sort();
  const lastBalanceDate = balanceDates[balanceDates.length - 1];
  if (lastBalanceDate !== undefined && netIncome !== undefined) {
    const latestBalance = balanceByDate[lastBalanceDate];
    if (latestBalance !== undefined) {
      const equity =
        latestBalance['EquityAttributableToOwnersOfParent'] ?? latestBalance['Equity'];
      if (equity !== undefined && equity !== 0) {
        // Annualise quarterly net income for ROE
        roe = num(((netIncome * 4) / equity) * 100);
      }
    }
  }

  return {
    code,
    date: latestDate,
    grossMargin,
    opMargin,
    netMargin,
    roe,
    quarterlyEps: num(eps),
  };
};

export const fetchQuarterlyFinancialsHistory = async (
  kv: KVNamespace,
  symbol: string,
  limit = 8,
  opts: Opts = {},
): Promise<FinancialsBundle> => {
  const cacheKey = `${KV_HISTORY_PREFIX}${symbol}`;
  const cached = await kvGetJson<FinancialsBundle>(kv, cacheKey);
  if (cached) return cached;

  let incomeByDate: Record<string, Record<string, number>> = {};
  let balanceByDate: Record<string, Record<string, number>> = {};

  try {
    incomeByDate = await fetchFinancialStatements(symbol, opts);
  } catch (err) {
    console.warn('FinMind financial statements failed for symbol', symbol, err);
  }

  try {
    balanceByDate = await fetchBalanceSheet(symbol, opts);
  } catch (err) {
    console.warn('FinMind balance sheet failed for symbol', symbol, err);
  }

  const dates = Object.keys(incomeByDate).sort().reverse().slice(0, limit);
  const history: QuarterRow[] = dates.map((d) =>
    computeQuarterRow(d, incomeByDate, balanceByDate),
  );

  const bundle: FinancialsBundle = { symbol, history, fetchedAt: Date.now() };
  await kvPutJson(kv, cacheKey, bundle, TTL);
  return bundle;
};

export const fetchQuarterlyFinancials = async (
  kv: KVNamespace,
  symbol: string,
  opts: Opts = {},
): Promise<QuarterlyFinancials | null> => {
  const cacheKey = `${KV_KEY_PREFIX}${symbol}`;
  const cached = await kvGetJson<QuarterlyFinancials>(kv, cacheKey);
  if (cached) return cached;

  let incomeByDate: Record<string, Record<string, number>> = {};
  let balanceByDate: Record<string, Record<string, number>> = {};

  try {
    incomeByDate = await fetchFinancialStatements(symbol, opts);
  } catch (err) {
    console.warn('FinMind financial statements failed for symbol', symbol, err);
    return null;
  }

  try {
    balanceByDate = await fetchBalanceSheet(symbol, opts);
  } catch (err) {
    console.warn('FinMind balance sheet failed for symbol', symbol, err);
    // Continue without balance sheet — ROE will be null
  }

  const result = computeQuarterlyFinancials(symbol, incomeByDate, balanceByDate);
  if (result !== null) {
    await kvPutJson(kv, cacheKey, result, TTL);
  }
  return result;
};
