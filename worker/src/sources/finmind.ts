import { fetchWithRetry } from '../lib/http';
import { kvGetJson, kvPutJson } from '../cache/kv';
import type { QuarterRow, FinancialsBundle, AnnualFinancialRow, FiveYearFinancials } from '@fd/shared';

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

// ─── 5-year annual financials for PEACE framework ───────────────────────────

const KV_5Y_PREFIX = 'finmind:5y:';
const TTL_5Y = 6 * 3600;

// FinMind cash flow dataset name: TaiwanStockCashFlowsStatement
// Fields include: CashFlowsFromOperatingActivities, CashFlowsFromInvestingActivities,
//                 CashFlowsFromFinancingActivities, plus line items for CapEx.
const fetchCashFlowStatement = async (
  code: string,
  startDate: string,
  opts: Opts = {},
): Promise<Record<string, Record<string, number>>> => {
  const url = `${FINMIND_BASE}?dataset=TaiwanStockCashFlowsStatement&data_id=${code}&start_date=${startDate}&token=`;
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

// Sum quarterly records by fiscal year (year = the calendar year of the quarter-end date).
// For annual-filed data the record date is already year-end (e.g. 2023-12-31), so this
// also handles the case where the API returns annual rows (one per year).
const sumByYear = (
  byDate: Record<string, Record<string, number>>,
  fields: string[],
): Record<number, Record<string, number>> => {
  const result: Record<number, Record<string, number>> = {};
  for (const [dateStr, vals] of Object.entries(byDate)) {
    const year = parseInt(dateStr.slice(0, 4), 10);
    const bucket: Record<string, number> = result[year] ?? {};
    for (const field of fields) {
      const v = vals[field];
      if (v !== undefined) {
        bucket[field] = (bucket[field] ?? 0) + v;
      }
    }
    result[year] = bucket;
  }
  return result;
};

// For balance sheet items, take the last date's values for each year.
const lastByYear = (
  byDate: Record<string, Record<string, number>>,
  fields: string[],
): Record<number, Record<string, number>> => {
  const sorted = Object.keys(byDate).sort();
  const result: Record<number, Record<string, number>> = {};
  for (const dateStr of sorted) {
    const year = parseInt(dateStr.slice(0, 4), 10);
    const vals = byDate[dateStr] ?? {};
    const bucket: Record<string, number> = result[year] ?? {};
    for (const field of fields) {
      const v = vals[field];
      if (v !== undefined) bucket[field] = v;
    }
    result[year] = bucket;
  }
  return result;
};

export const fetchFiveYearFinancials = async (
  kv: KVNamespace,
  symbol: string,
  opts: Opts = {},
): Promise<FiveYearFinancials> => {
  const cacheKey = `${KV_5Y_PREFIX}${symbol}`;
  const cached = await kvGetJson<FiveYearFinancials>(kv, cacheKey);
  if (cached !== null) return cached;

  // Fetch 6 years of data to ensure we get 5 complete fiscal years
  const currentYear = new Date().getFullYear();
  const startDate = `${currentYear - 6}-01-01`;

  let incomeByDate: Record<string, Record<string, number>> = {};
  let balanceByDate: Record<string, Record<string, number>> = {};
  let cashFlowByDate: Record<string, Record<string, number>> = {};

  try {
    incomeByDate = await fetchFinancialStatements(symbol, opts);
  } catch (err) {
    console.warn('[peace] income statement fetch failed for', symbol, err);
  }

  try {
    balanceByDate = await fetchBalanceSheet(symbol, opts);
  } catch (err) {
    console.warn('[peace] balance sheet fetch failed for', symbol, err);
  }

  try {
    cashFlowByDate = await fetchCashFlowStatement(symbol, startDate, opts);
  } catch (err) {
    console.warn('[peace] cash flow statement fetch failed for', symbol, err);
  }

  // Income statement fields to sum quarterly → annual
  const incomeFields = [
    'Revenue',
    'GrossProfit',
    'OperatingIncome',
    'IncomeAfterTaxes',
    'EPS',
    'IncomeTaxExpense',
    'NetIncomeBeforeTax',
  ];

  // Cash flow fields to sum quarterly → annual
  const cfFields = [
    'CashFlowsFromOperatingActivities',
    'CashProvidedByInvestingActivities',
    'CashFlowsProvidedFromFinancingActivities',
    // CapEx: FinMind 用 PropertyAndPlantAndEquipment (negative in cash flow statement)
    'PropertyAndPlantAndEquipment',
  ];

  // Balance sheet fields to take last-of-year snapshot
  const bsFields = [
    'TotalAssets',
    'TotalLiabilities',
    'Equity',
    'EquityAttributableToOwnersOfParent',
    'CurrentAssets',
    'CurrentLiabilities',
    'ShortTermBorrowings',
    'ShortTermLoansPayable',
    'LongTermBorrowings',
    'LongTermLoansPayable',
    'BondsPayable',
  ];

  const incomeByYear = sumByYear(incomeByDate, incomeFields);
  const cfByYear = sumByYear(cashFlowByDate, cfFields);
  const bsByYear = lastByYear(balanceByDate, bsFields);

  // Collect the 5 most recent years with at least some income data
  const allYears = [...new Set([
    ...Object.keys(incomeByYear),
    ...Object.keys(cfByYear),
    ...Object.keys(bsByYear),
  ])].map(Number).sort((a, b) => a - b);

  // Filter to years that have income data, last 5
  const yearsWithData = allYears.filter((y) => incomeByYear[y] !== undefined).slice(-5);

  const rows: AnnualFinancialRow[] = yearsWithData.map((year): AnnualFinancialRow => {
    const inc = incomeByYear[year] ?? {};
    const cf = cfByYear[year] ?? {};
    const bs = bsByYear[year] ?? {};

    const revenue = num(inc['Revenue']);
    const grossProfit = num(inc['GrossProfit']);
    const operatingIncome = num(inc['OperatingIncome']);
    const netIncome = num(inc['IncomeAfterTaxes']);
    // EPS: for annual, FinMind may report cumulative. Take as-is.
    const eps = num(inc['EPS']);

    const ocf = num(cf['CashFlowsFromOperatingActivities']);
    const icf = num(cf['CashProvidedByInvestingActivities']);
    const fcfCf = num(cf['CashFlowsProvidedFromFinancingActivities']);

    // CapEx: FinMind 用 PropertyAndPlantAndEquipment（負值）
    const capexRaw = cf['PropertyAndPlantAndEquipment'];
    // Make CapEx a positive number representing the cash outflow
    const capex = capexRaw !== undefined ? Math.abs(capexRaw) : null;

    // FCF = OCF - CapEx
    const fcf = ocf !== null && capex !== null ? ocf - capex : null;

    const totalAssets = num(bs['TotalAssets']);
    const totalEquity =
      num(bs['EquityAttributableToOwnersOfParent'] !== undefined
        ? bs['EquityAttributableToOwnersOfParent']
        : bs['Equity']);
    const shortTermDebt =
      bs['ShortTermBorrowings'] ?? bs['ShortTermLoansPayable'] ?? 0;
    const longTermDebt =
      bs['LongTermBorrowings'] ?? bs['LongTermLoansPayable'] ?? bs['BondsPayable'] ?? 0;
    const totalDebt = num(shortTermDebt + longTermDebt);

    const currentAssets = num(bs['CurrentAssets']);
    const currentLiabilities = num(bs['CurrentLiabilities']);

    const incomeTaxExpense = num(inc['IncomeTaxExpense']);
    const pretaxIncome = num(inc['NetIncomeBeforeTax']);

    return {
      year,
      revenue,
      grossProfit,
      operatingIncome,
      netIncome,
      eps,
      ocf,
      icf,
      fcf,
      fcfCf,
      totalAssets,
      totalEquity,
      totalDebt,
      currentAssets,
      currentLiabilities,
      incomeTaxExpense,
      pretaxIncome,
      capex,
    };
  });

  const bundle: FiveYearFinancials = { symbol, rows, fetchedAt: Date.now() };
  if (rows.length > 0) {
    await kvPutJson(kv, cacheKey, bundle, TTL_5Y);
  }
  return bundle;
};
