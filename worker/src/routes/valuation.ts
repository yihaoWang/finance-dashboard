import { Hono } from 'hono';
import type { Env } from '../index';
import type { ApiResponse, ValuationBundle } from '@fd/shared';
import { kvGetJson, kvPutJson } from '../cache/kv';
import { fetchYahooKeyStats } from '../sources/yahoo-quotesummary';
import { fetchYahooHistory } from '../sources/yahoo';
import { fetchFiveYearFinancials } from '../sources/finmind';
import { fetchIndustryPe, fetchMarketPe } from '../sources/industry-pe';

const KV_PREFIX = 'valuation:v2:';
const TTL = 6 * 3600;

export const valuation = new Hono<{ Bindings: Env }>();

valuation.get('/:symbol', async (c) => {
  const symbol = c.req.param('symbol');
  const cacheKey = `${KV_PREFIX}${symbol}`;
  const cached = await kvGetJson<ValuationBundle>(c.env.KV, cacheKey);
  if (cached !== null) {
    return c.json({ data: cached, freshness: { source: 'kv', ageSeconds: 0 } } satisfies ApiResponse<ValuationBundle>);
  }

  const [stockStatsR, marketR, historyR, financialsR, industryR] = await Promise.allSettled([
    fetchYahooKeyStats(symbol),
    fetchMarketPe(c.env.KV, symbol),
    fetchYahooHistory(symbol, '5y'),
    fetchFiveYearFinancials(c.env.KV, symbol),
    fetchIndustryPe(c.env.KV, symbol),
  ]);

  const stockStats = stockStatsR.status === 'fulfilled' ? stockStatsR.value : null;
  const market = marketR.status === 'fulfilled' ? marketR.value : { value: null, label: null };
  const history = historyR.status === 'fulfilled' ? historyR.value : [];
  const financials = financialsR.status === 'fulfilled' ? financialsR.value : null;
  const industry = industryR.status === 'fulfilled' ? industryR.value : { industry: null, averagePe: null, peerCount: 0 };

  // Compute 5y avg / low PE from year-end close ÷ annual EPS
  let pe5yAvg: number | null = null;
  let pe5yLow: number | null = null;
  if (financials && history.length > 0) {
    const pes: number[] = [];
    for (const row of financials.rows) {
      if (row.eps === null || row.eps <= 0) continue;
      // Find the last close on or before year-end
      const yearEnd = `${row.year}-12-31`;
      const inYear = history.filter((p) => p.date <= yearEnd && p.date >= `${row.year}-01-01`);
      const last = inYear[inYear.length - 1];
      if (last && last.close > 0) {
        pes.push(last.close / row.eps);
      }
    }
    if (pes.length > 0) {
      pe5yAvg = pes.reduce((s, x) => s + x, 0) / pes.length;
      pe5yLow = Math.min(...pes);
    }
  }

  // Compute EPS CAGR from 5-year annual rows to derive PEG locally.
  let epsCagr: number | null = null;
  if (financials && financials.rows.length >= 2) {
    const epsList = financials.rows.map((r) => r.eps).filter((x): x is number => x !== null && x > 0);
    if (epsList.length >= 2) {
      const first = epsList[0]!;
      const last = epsList[epsList.length - 1]!;
      const years = epsList.length - 1;
      const cagr = Math.pow(last / first, 1 / years) - 1;
      if (Number.isFinite(cagr)) epsCagr = cagr * 100; // percent
    }
  }

  const currentPe = stockStats?.trailingPE ?? null;
  // PEG = PE / annual EPS growth %. If Yahoo provides peg directly use it, otherwise derive.
  let peg: number | null = stockStats?.pegRatio ?? null;
  if (peg === null && currentPe !== null && epsCagr !== null && epsCagr > 0) {
    peg = currentPe / epsCagr;
  }

  // Synthetic Forward PE for TW stocks (Yahoo doesn't provide consensus):
  // Forward PE ≈ current PE / (1 + EPS CAGR).  i.e. price stays, EPS grows.
  let forwardPe: number | null = stockStats?.forwardPE ?? null;
  if (forwardPe === null && currentPe !== null && epsCagr !== null) {
    const projected = 1 + epsCagr / 100;
    if (projected > 0) forwardPe = currentPe / projected;
  }

  // FinMind PER endpoint doesn't include EPS, so trailingEps/forwardEps come back null.
  // Derive from latest close ÷ PE (works whenever PE is set).
  const lastClose = history.length > 0 ? history[history.length - 1]?.close ?? null : null;
  const derivedTrailingEps =
    currentPe !== null && currentPe > 0 && lastClose !== null && lastClose > 0
      ? lastClose / currentPe
      : null;
  const derivedForwardEps =
    forwardPe !== null && forwardPe > 0 && lastClose !== null && lastClose > 0
      ? lastClose / forwardPe
      : null;

  const bundle: ValuationBundle = {
    marketPe: market.value,
    marketLabel: market.label,
    pe5yAvg,
    pe5yLow,
    pe15yLow: null, // not available — would need 15y EPS history
    currentPe,
    forwardPe,
    peg,
    trailingEps: stockStats?.trailingEps ?? derivedTrailingEps,
    forwardEps: stockStats?.forwardEps ?? derivedForwardEps,
    industryPe: industry.averagePe,
    computedAt: Date.now(),
  };

  await kvPutJson(c.env.KV, cacheKey, bundle, TTL);
  return c.json({ data: bundle, freshness: { source: 'fetch', ageSeconds: 0 } } satisfies ApiResponse<ValuationBundle>);
});
