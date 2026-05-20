import type { Env } from './index';
import { runDigestPipeline } from './lib/digest-runner';
import { upsertEvents } from './cache/d1-events';
import { fetchEconomicEvents } from './sources/events';
import { fetchForeignFuturesOI, fetchOptionsPCR } from './sources/taifex';
import { fetchBreadthADR } from './sources/twse-breadth';
import { fetchMarginBalanceDaily, fetchMarginMaintenanceDaily, fetchShortLongRatioDaily } from './sources/twse-margin';
import { fetchInstitutional5dDaily } from './sources/twse-chips';
import { insertDailyValue } from './cache/d1-sentiment';
import { fetchFiveYearFinancials } from './sources/finmind';
import { fetchFredSnapshot } from './sources/fred';
import { computePeace } from './lib/peace';
import { getTags } from './cache/d1-tags';
import { upsertScreenerScore } from './cache/d1-screener';
import { fetchYahooQuote } from './sources/yahoo';
import { fetchTwseBwibbu, fetchTwseMonthlyRevenue } from './sources/twse';
import { fetchSharesOutstanding, fetchSymbolName, fetchUniverse } from './sources/industry-pe';
import { deriveMetrics, buildScreenerOutput } from './lib/screener-score';
import { setFinMindToken } from './lib/finmind-token';
import type { IndicatorKey } from '@fd/shared';

const WACC_FALLBACK = 9.5;
const WACC_PREMIUM = 5.0;

const scanOne = async (env: Env, symbol: string, wacc: number, now: number): Promise<boolean> => {
  const [financials, tags, quoteR, twseR, sharesR, revenueR, nameR] = await Promise.allSettled([
    fetchFiveYearFinancials(env.KV, symbol),
    getTags(env.DB, symbol),
    fetchYahooQuote(symbol),
    fetchTwseBwibbu(env.KV, symbol),
    fetchSharesOutstanding(env.KV, symbol),
    fetchTwseMonthlyRevenue(env.KV, symbol),
    fetchSymbolName(env.KV, symbol),
  ]);
  if (financials.status !== 'fulfilled') return false; // no 5y financials → skip silently
  if (tags.status !== 'fulfilled') return false;
  if (financials.value.rows.length < 2) return false;

  const bundle = computePeace(financials.value, wacc, tags.value.moat, tags.value.risk, {
    moatReasons: tags.value.moatReasons,
    riskReasons: tags.value.riskReasons,
    moatNote: tags.value.moatNote,
    riskNote: tags.value.riskNote,
  });
  const priorityTotal = bundle.criteria.filter((c) => c.priority).length;
  const criteriaPassed: Record<string, boolean> = {};
  for (const c of bundle.criteria) {
    if (c.passed !== null) criteriaPassed[String(c.id)] = c.passed;
  }

  const quote = quoteR.status === 'fulfilled' ? quoteR.value : null;
  const twse = twseR.status === 'fulfilled' ? twseR.value : null;
  const shares = sharesR.status === 'fulfilled' ? sharesR.value : null;
  const revenue = revenueR.status === 'fulfilled' ? revenueR.value : null;

  const currentPe = twse?.pe ?? null;
  const yieldPct = twse?.dividendYield ?? null;
  const marketCap =
    quote !== null && shares !== null && quote.price > 0 ? shares * quote.price : null;
  const tpexName = nameR.status === 'fulfilled' ? nameR.value : null;
  const name = twse?.name ?? tpexName ?? quote?.name ?? null;
  const monthlyRevYoy = revenue?.yoy ?? null;

  const metrics = deriveMetrics(financials.value, {
    currentPe,
    marketCap,
    name,
    yieldPct,
    monthlyRevYoy,
  });
  const out = buildScreenerOutput(bundle, metrics);

  await upsertScreenerScore(env.DB, {
    symbol,
    name,
    score: bundle.score,
    total: bundle.total,
    priorityScore: bundle.priorityScore,
    priorityTotal,
    weightedScore: out.weightedScore,
    moatCount: bundle.moat.length,
    riskCount: bundle.risk.length,
    styleTags: out.styleTags,
    highlights: out.highlights,
    concerns: out.concerns,
    criteriaPassed,
    moatTags: bundle.moat,
    riskTags: bundle.risk,
    marketCap,
    currentPe,
    pe5yAvg: metrics.pe5yAvg,
    pePremium: metrics.pePremium,
    yieldPct,
    roe5yMin: metrics.roe5yMin,
    epsCagr: metrics.epsCagr,
    revenueCagr: metrics.revenueCagr,
    monthlyRevYoy,
    deRatio: metrics.deRatio,
    grossMargin: metrics.grossMargin,
    opMargin: metrics.opMargin,
    netMargin: metrics.netMargin,
    updatedAt: now,
  });
  return true;
};

export const rescoreSymbols = async (env: Env, symbols: string[]): Promise<{ ok: number; failed: number }> => {
  setFinMindToken(env.FINMIND_API_TOKEN);
  let wacc = WACC_FALLBACK;
  try {
    const fred = await fetchFredSnapshot(env);
    if (fred.dgs10?.latest !== undefined) wacc = fred.dgs10.latest + WACC_PREMIUM;
  } catch {/* ignore */}
  const now = Date.now();
  let ok = 0, failed = 0;
  for (const symbol of symbols) {
    try {
      const success = await scanOne(env, symbol, wacc, now);
      if (success) ok++; else failed++;
    } catch (err) {
      failed++;
      console.warn('[rescoreSymbols] failed for', symbol, err);
    }
  }
  return { ok, failed };
};

export const runScreenerScan = async (
  env: Env,
  opts: { offset?: number; limit?: number } = {},
): Promise<{ ok: number; skipped: number; total: number; processed: number }> => {
  let wacc = WACC_FALLBACK;
  try {
    const fred = await fetchFredSnapshot(env);
    if (fred.dgs10?.latest !== undefined) wacc = fred.dgs10.latest + WACC_PREMIUM;
  } catch (err) {
    console.warn('[screener] FRED failed, using fallback WACC', err);
  }

  const universe = await fetchUniverse(env.KV);
  const offset = opts.offset ?? 0;
  const limit = opts.limit ?? universe.length;
  const slice = universe.slice(offset, offset + limit);
  console.log(`[screener] universe=${universe.length} processing offset=${offset} limit=${limit} slice=${slice.length}`);

  const now = Date.now();
  let ok = 0;
  let skipped = 0;
  // With FinMind token: ~1000 req/h. BATCH=4 + 300ms ≈ 13 req/s; per-stock 2-3 reqs.
  const BATCH = 4;
  const SLEEP_MS = 300;
  for (let i = 0; i < slice.length; i += BATCH) {
    const batch = slice.slice(i, i + BATCH);
    const results = await Promise.allSettled(batch.map((s) => scanOne(env, s, wacc, now)));
    for (let j = 0; j < results.length; j++) {
      const r = results[j];
      if (r === undefined) continue;
      if (r.status === 'fulfilled') {
        if (r.value) ok++; else skipped++;
      } else {
        skipped++;
        console.warn('[screener] scan failed', batch[j], r.reason);
      }
    }
    if (i + BATCH < slice.length) {
      await new Promise((res) => setTimeout(res, SLEEP_MS));
    }
  }
  console.log(`[screener] done: ok=${ok} skipped=${skipped} processed=${slice.length}/${universe.length}`);
  return { ok, skipped, total: universe.length, processed: slice.length };
};

const WATCHLIST = ['2330', '2454', '2317', '3008', '2308'];

export const runSentimentDaily = async (env: Env): Promise<void> => {
  const tasks: Array<{
    key: IndicatorKey;
    fetcher: () => Promise<{ date: string; value: number }>;
  }> = [
    { key: 'margin_balance', fetcher: fetchMarginBalanceDaily },
    { key: 'margin_maintenance', fetcher: fetchMarginMaintenanceDaily },
    { key: 'short_long_ratio', fetcher: fetchShortLongRatioDaily },
    { key: 'institutional_5d', fetcher: fetchInstitutional5dDaily },
    {
      key: 'foreign_futures_oi',
      fetcher: async () => {
        const r = await fetchForeignFuturesOI();
        return { date: r.date, value: r.netOi };
      },
    },
    {
      key: 'breadth_adr',
      fetcher: async () => {
        const r = await fetchBreadthADR();
        return { date: r.date, value: r.adr };
      },
    },
    {
      key: 'options_pcr',
      fetcher: async () => {
        const r = await fetchOptionsPCR();
        return { date: r.date, value: r.pcr };
      },
    },
  ];
  for (const t of tasks) {
    try {
      const { date, value } = await t.fetcher();
      await insertDailyValue(env.DB, t.key, date, value);
    } catch (error) {
      console.warn('sentiment daily failed', t.key, error);
    }
  }
  await env.KV.delete('sentiment:bundle');
};

export const scheduled: ExportedHandlerScheduledHandler<Env> = async (_event, env, ctx) => {
  setFinMindToken(env.FINMIND_API_TOKEN);
  ctx.waitUntil(
    (async (): Promise<void> => {
      try {
        await runSentimentDaily(env);
      } catch (err) {
        console.error('sentiment daily pipeline failed', err);
      }

      try {
        const items = await fetchEconomicEvents();
        await upsertEvents(env.DB, items, Date.now());
      } catch (err) {
        console.error('events refresh failed', err);
      }

      try {
        await runDigestPipeline(env, { scope: 'market', symbol: 'market' });
      } catch (err) {
        console.error('digest pipeline failed for market', err);
      }

      for (const symbol of WATCHLIST) {
        try {
          await runDigestPipeline(env, { scope: 'stock', symbol });
        } catch (err) {
          console.error('digest pipeline failed for symbol', symbol, err);
        }
      }

      try {
        await runScreenerScan(env);
      } catch (err) {
        console.error('screener scan failed', err);
      }
    })(),
  );
};
