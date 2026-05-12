/**
 * One-shot backfill: 10y daily values for 6 indicators into D1 sentiment_history.
 *
 * Strategy: fetch each indicator as one FinMind range request (2016-05-12 → today),
 * aggregate locally, then bulk-POST to /api/admin/sentiment-backfill-bulk in batches.
 * This is much faster than one request per day.
 *
 * Usage:
 *   WORKER_URL=https://finance-dashboard-worker.nihongo.workers.dev \
 *   ADMIN_TOKEN=<token> \
 *     pnpm tsx scripts/backfill-sentiment-history.ts
 *
 * Pacing: 500ms between FinMind fetches to stay under free-tier ~600 req/hour limit.
 * Total FinMind calls: ~6 (one per indicator), so rate limit is not a concern.
 */
import type { IndicatorKey } from '@fd/shared';

const FINMIND_BASE = 'https://api.finmindtrade.com/api/v4/data';
const START_DATE = '2016-05-12';
const END_DATE = new Date().toISOString().slice(0, 10);
const WORKER_URL = process.env.WORKER_URL ?? 'https://finance-dashboard-worker.nihongo.workers.dev';
const ADMIN_TOKEN = process.env.ADMIN_TOKEN;

if (!ADMIN_TOKEN) {
  console.error('ADMIN_TOKEN env var required');
  process.exit(1);
}

const sleep = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));

type FinMindRow = Record<string, unknown>;

const finmindFetch = async (dataset: string, extraParams = ''): Promise<FinMindRow[]> => {
  const url = `${FINMIND_BASE}?dataset=${dataset}&start_date=${START_DATE}&end_date=${END_DATE}${extraParams}`;
  console.log(`  → GET ${url}`);
  const res = await fetch(url, { headers: { Accept: 'application/json' } });
  const json = (await res.json()) as { msg: string; status: number; data: FinMindRow[] };
  if (json.status !== 200) throw new Error(`FinMind error: ${json.msg}`);
  return json.data;
};

// Returns Record<date, value> for margin_maintenance (TodayBalance/YesBalance × 100)
const fetchMarginMaintenanceRange = async (): Promise<Record<string, number>> => {
  const rows = await finmindFetch('TaiwanStockTotalMarginPurchaseShortSale');
  const result: Record<string, number> = {};
  // Group MarginPurchase rows by date
  const byDate: Record<string, { today: number; yes: number }> = {};
  for (const row of rows) {
    if (row['name'] !== 'MarginPurchase') continue;
    const date = String(row['date']);
    byDate[date] = { today: Number(row['TodayBalance']), yes: Number(row['YesBalance']) };
  }
  for (const [date, { today, yes }] of Object.entries(byDate)) {
    if (yes > 0) result[date] = Number(((today / yes) * 100).toFixed(2));
  }
  return result;
};

// Returns Record<date, value> for short_long_ratio (ShortSale.TodayBalance / MarginPurchase.TodayBalance × 100)
const fetchShortLongRatioRange = async (): Promise<Record<string, number>> => {
  const rows = await finmindFetch('TaiwanStockTotalMarginPurchaseShortSale');
  const byDate: Record<string, { margin: number; short: number }> = {};
  for (const row of rows) {
    const date = String(row['date']);
    const entry = byDate[date] ?? { margin: 0, short: 0 };
    if (row['name'] === 'MarginPurchase') entry.margin = Number(row['TodayBalance']);
    if (row['name'] === 'ShortSale') entry.short = Number(row['TodayBalance']);
    byDate[date] = entry;
  }
  const result: Record<string, number> = {};
  for (const [date, { margin, short }] of Object.entries(byDate)) {
    if (margin > 0) result[date] = Number(((short / margin) * 100).toFixed(2));
  }
  return result;
};

// Returns Record<date, value> for institutional_5d (5-day rolling sum in 億)
const fetchInstitutional5dRange = async (): Promise<Record<string, number>> => {
  const rows = await finmindFetch('TaiwanStockTotalInstitutionalInvestors');
  const netByDate: Record<string, number> = {};
  for (const row of rows) {
    if (row['name'] !== 'total') continue;
    const date = String(row['date']);
    netByDate[date] = Number(row['buy']) - Number(row['sell']);
  }
  const sortedDates = Object.keys(netByDate).sort();
  const result: Record<string, number> = {};
  for (let i = 0; i < sortedDates.length; i++) {
    const windowDates = sortedDates.slice(Math.max(0, i - 4), i + 1);
    const sum5 = windowDates.reduce((acc, d) => acc + (netByDate[d] ?? 0), 0);
    result[sortedDates[i]!] = Number((sum5 / 1e8).toFixed(2));
  }
  return result;
};

// Returns Record<date, value> for foreign_futures_oi (total TX open interest)
const fetchForeignFuturesOiRange = async (): Promise<Record<string, number>> => {
  const rows = await finmindFetch('TaiwanFuturesDaily', '&data_id=TX');
  const oiByDate: Record<string, number> = {};
  for (const row of rows) {
    if (row['trading_session'] === 'after_market') continue;
    const date = String(row['date']);
    oiByDate[date] = (oiByDate[date] ?? 0) + Number(row['open_interest']);
  }
  return oiByDate;
};

// Returns Record<date, value> for breadth_adr — we use TWSE MI_INDEX which only returns latest day.
// For historical backfill, we approximate using TaiwanStockPrice to count gainers/losers.
// However, that would be extremely slow (10y × 1600 stocks × 1 call each).
// PRAGMATIC APPROACH: use TaiwanOptionDaily put/call volume as a proxy for market sentiment breadth
// for the backfill, but note this duplicates options_pcr.
// BETTER: FinMind doesn't have historical advance/decline data in free tier.
// For backfill, we'll skip breadth_adr (it stays with only live data from daily cron).
// The live cron will accumulate breadth_adr naturally over time.
// The backfill inserts a placeholder signal only for dates where we have TXO data.
const fetchBreadthAdrRange = async (): Promise<Record<string, number>> => {
  // We can't get historical advance/decline from free FinMind.
  // Return empty - breadth_adr will build up from daily cron going forward.
  console.log('  [breadth_adr] Skipping historical backfill (no free-tier FinMind source for adv/dec history)');
  return {};
};

// Returns Record<date, value> for options_pcr (put/call volume ratio for TXO)
const fetchOptionsPcrRange = async (): Promise<Record<string, number>> => {
  const rows = await finmindFetch('TaiwanOptionDaily', '&data_id=TXO');
  const volByDate: Record<string, { put: number; call: number }> = {};
  for (const row of rows) {
    if (row['trading_session'] === 'after_market') continue;
    const date = String(row['date']);
    const entry = volByDate[date] ?? { put: 0, call: 0 };
    if (row['call_put'] === 'put') entry.put += Number(row['volume']);
    else if (row['call_put'] === 'call') entry.call += Number(row['volume']);
    volByDate[date] = entry;
  }
  const result: Record<string, number> = {};
  for (const [date, { put, call }] of Object.entries(volByDate)) {
    if (call > 0) result[date] = Number((put / call).toFixed(3));
  }
  return result;
};

const bulkWrite = async (
  indicator: IndicatorKey,
  rowsMap: Record<string, number>,
): Promise<number> => {
  const rows = Object.entries(rowsMap).map(([date, value]) => ({ indicator, date, value }));
  if (rows.length === 0) return 0;
  // Send in chunks of 500 to stay under request size limits
  const CHUNK = 500;
  let total = 0;
  for (let i = 0; i < rows.length; i += CHUNK) {
    const chunk = rows.slice(i, i + CHUNK);
    const res = await fetch(`${WORKER_URL}/api/admin/sentiment-backfill-bulk`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${ADMIN_TOKEN}`,
      },
      body: JSON.stringify({ rows: chunk }),
    });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`bulk write failed for ${indicator}: ${res.status} ${text}`);
    }
    const result = (await res.json()) as { inserted: number };
    total += result.inserted;
    await sleep(200);
  }
  return total;
};

type IndicatorFetcher = () => Promise<Record<string, number>>;

const INDICATOR_FETCHERS: Array<{ key: IndicatorKey; fetcher: IndicatorFetcher }> = [
  { key: 'margin_maintenance', fetcher: fetchMarginMaintenanceRange },
  { key: 'short_long_ratio', fetcher: fetchShortLongRatioRange },
  { key: 'institutional_5d', fetcher: fetchInstitutional5dRange },
  { key: 'foreign_futures_oi', fetcher: fetchForeignFuturesOiRange },
  { key: 'breadth_adr', fetcher: fetchBreadthAdrRange },
  { key: 'options_pcr', fetcher: fetchOptionsPcrRange },
];

const main = async (): Promise<void> => {
  console.log(`Backfilling sentiment history: ${START_DATE} → ${END_DATE}`);
  console.log(`Worker: ${WORKER_URL}`);
  for (const { key, fetcher } of INDICATOR_FETCHERS) {
    console.log(`\n[${key}] fetching from FinMind...`);
    try {
      const rowsMap = await fetcher();
      const count = Object.keys(rowsMap).length;
      console.log(`  → ${count} rows fetched`);
      if (count > 0) {
        const inserted = await bulkWrite(key, rowsMap);
        console.log(`  → ${inserted} rows written to D1`);
      }
    } catch (error) {
      console.error('[backfill] indicator failed:', key, error);
    }
    await sleep(500); // FinMind rate limit pacing
  }
  console.log('\nBackfill complete.');
};

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
