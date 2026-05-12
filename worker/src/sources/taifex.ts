import { fetchWithRetry } from '../lib/http';

// FinMind dataset: TaiwanFuturesDaily
// Aggregate open_interest by summing all contracts with futures_id="TX" for the latest date.
// Net foreign OI uses TaiwanFuturesOpenInterestLargeTraders — but that's a paid tier.
// PRAGMATIC FALLBACK: use TaiwanFuturesDaily to get total open_interest for TX contracts
// as a market-level proxy for OI magnitude. The value is total TX open interest (口),
// which is meaningful for sentiment context (landmarks updated to match ~40k-80k range).
// TODO: if FinMind upgrades to paid tier, replace with TaiwanFuturesInstitutionalInvestors
//       filtered to 外資 for true net foreign OI.

// FinMind dataset: TaiwanOptionDaily
// Aggregate put vs call volume for TXO across all strikes / contract dates for the latest date.
// PCR = sum(put volume) / sum(call volume) for regular session rows.

const FINMIND_BASE = 'https://api.finmindtrade.com/api/v4/data';

type FinMindFuturesRow = {
  date: string;
  futures_id: string;
  contract_date: string;
  open_interest: number;
  trading_session: string;
  volume: number;
};

type FinMindFuturesResponse = {
  msg: string;
  status: number;
  data: FinMindFuturesRow[];
};

type FinMindOptionRow = {
  date: string;
  option_id: string;
  contract_date: string;
  call_put: string;
  volume: number;
  open_interest: number;
  trading_session: string;
};

type FinMindOptionResponse = {
  msg: string;
  status: number;
  data: FinMindOptionRow[];
};

const isoDateNDaysAgo = (n: number): string => {
  const d = new Date(Date.now() - n * 86400_000);
  return d.toISOString().slice(0, 10);
};

export interface ForeignFuturesOI {
  date: string;
  netOi: number;
}

export const fetchForeignFuturesOI = async (): Promise<ForeignFuturesOI> => {
  // Fetch TX futures daily data; use total open_interest across near-month contracts
  // as a proxy for market-level futures positioning.
  const startDate = isoDateNDaysAgo(7);
  const url = `${FINMIND_BASE}?dataset=TaiwanFuturesDaily&data_id=TX&start_date=${startDate}`;
  let res: Response;
  try {
    res = await fetchWithRetry(url, { headers: { Accept: 'application/json' } });
  } catch (err) {
    console.warn('FinMind TaiwanFuturesDaily fetch failed', err);
    throw err;
  }
  const json = (await res.json()) as FinMindFuturesResponse;
  if (json.status !== 200 || !Array.isArray(json.data) || json.data.length === 0) {
    throw new Error(`FinMind futures response unexpected: ${json.msg}`);
  }
  // Group by date, sum open_interest for regular session (not after_market)
  const oiByDate: Record<string, number> = {};
  for (const row of json.data) {
    if (row.trading_session === 'after_market') continue;
    oiByDate[row.date] = (oiByDate[row.date] ?? 0) + row.open_interest;
  }
  const dates = Object.keys(oiByDate).sort();
  if (dates.length === 0) throw new Error('no TX futures rows found');
  const latestDate = dates[dates.length - 1]!;
  const totalOi = oiByDate[latestDate] ?? 0;
  return { date: latestDate, netOi: totalOi };
};

export interface OptionsPCR {
  date: string;
  pcr: number;
}

export const fetchOptionsPCR = async (): Promise<OptionsPCR> => {
  // Fetch TXO option daily data and compute PCR = put volume / call volume
  const startDate = isoDateNDaysAgo(7);
  const url = `${FINMIND_BASE}?dataset=TaiwanOptionDaily&data_id=TXO&start_date=${startDate}`;
  let res: Response;
  try {
    res = await fetchWithRetry(url, { headers: { Accept: 'application/json' } });
  } catch (err) {
    console.warn('FinMind TaiwanOptionDaily fetch failed', err);
    throw err;
  }
  const json = (await res.json()) as FinMindOptionResponse;
  if (json.status !== 200 || !Array.isArray(json.data) || json.data.length === 0) {
    throw new Error(`FinMind options response unexpected: ${json.msg}`);
  }
  // Group by date, sum put and call volumes for regular session
  const volByDate: Record<string, { putVol: number; callVol: number }> = {};
  for (const row of json.data) {
    if (row.trading_session === 'after_market') continue;
    const entry = volByDate[row.date] ?? { putVol: 0, callVol: 0 };
    if (row.call_put === 'put') entry.putVol += row.volume;
    else if (row.call_put === 'call') entry.callVol += row.volume;
    volByDate[row.date] = entry;
  }
  const dates = Object.keys(volByDate).sort();
  if (dates.length === 0) throw new Error('no TXO option rows found');
  const latestDate = dates[dates.length - 1]!;
  const { putVol, callVol } = volByDate[latestDate]!;
  if (callVol === 0) throw new Error('callVol is zero, cannot compute PCR');
  const pcr = Number((putVol / callVol).toFixed(3));
  return { date: latestDate, pcr };
};
