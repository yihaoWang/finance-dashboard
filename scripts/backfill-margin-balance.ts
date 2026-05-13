/**
 * Backfill 10y daily values for margin_balance (融資餘額, 億元) into D1 sentiment_history.
 *
 * Source: FinMind TaiwanStockTotalMarginPurchaseShortSale, name=MarginPurchaseMoney
 * Field: TodayBalance (NTD) → divide by 1e8 to get 億元
 *
 * FinMind free tier may limit to ~3y per query, so we iterate in 3-year chunks.
 *
 * Usage:
 *   WORKER_URL=https://finance-dashboard-worker.nihongo.workers.dev \
 *   ADMIN_TOKEN=<token> \
 *     pnpm tsx scripts/backfill-margin-balance.ts
 */
import type { IndicatorKey } from '@fd/shared';

const FINMIND_BASE = 'https://api.finmindtrade.com/api/v4/data';
const WORKER_URL = process.env.WORKER_URL ?? 'https://finance-dashboard-worker.nihongo.workers.dev';
const ADMIN_TOKEN = process.env.ADMIN_TOKEN;

if (!ADMIN_TOKEN) {
  console.error('ADMIN_TOKEN env var required');
  process.exit(1);
}

const sleep = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));

type FinMindRow = Record<string, unknown>;

const finmindFetch = async (startDate: string, endDate: string): Promise<FinMindRow[]> => {
  const url = `${FINMIND_BASE}?dataset=TaiwanStockTotalMarginPurchaseShortSale&start_date=${startDate}&end_date=${endDate}`;
  console.log(`  → GET ${url}`);
  const res = await fetch(url, { headers: { Accept: 'application/json' } });
  const json = (await res.json()) as { msg: string; status: number; data: FinMindRow[] };
  if (json.status !== 200) throw new Error(`FinMind error: ${json.msg}`);
  return json.data;
};

const fetchMarginBalanceRange = async (startDate: string, endDate: string): Promise<Record<string, number>> => {
  const rows = await finmindFetch(startDate, endDate);
  const result: Record<string, number> = {};
  for (const row of rows) {
    if (row['name'] !== 'MarginPurchaseMoney') continue;
    const date = String(row['date']);
    const todayBalance = Number(row['TodayBalance']);
    if (todayBalance > 0) {
      result[date] = Number((todayBalance / 1e8).toFixed(2));
    }
  }
  return result;
};

const bulkWrite = async (
  indicator: IndicatorKey,
  rowsMap: Record<string, number>,
): Promise<number> => {
  const rows = Object.entries(rowsMap).map(([date, value]) => ({ indicator, date, value }));
  if (rows.length === 0) return 0;
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
    console.log(`  → chunk ${i / CHUNK + 1}: ${result.inserted} rows written`);
    await sleep(200);
  }
  return total;
};

const main = async (): Promise<void> => {
  console.log(`Backfilling margin_balance (融資餘額) history`);
  console.log(`Worker: ${WORKER_URL}`);

  // Fetch in 3-year chunks to stay under FinMind free-tier limits
  const today = new Date().toISOString().slice(0, 10);
  const chunks: Array<{ start: string; end: string }> = [
    { start: '2016-05-12', end: '2019-05-11' },
    { start: '2019-05-12', end: '2022-05-11' },
    { start: '2022-05-12', end: today },
  ];

  const allData: Record<string, number> = {};

  for (const { start, end } of chunks) {
    console.log(`\nFetching ${start} → ${end}...`);
    try {
      const data = await fetchMarginBalanceRange(start, end);
      const count = Object.keys(data).length;
      console.log(`  → ${count} rows fetched`);
      Object.assign(allData, data);
    } catch (error) {
      console.error('Failed for range', start, '–', end, error);
    }
    await sleep(800); // pace between chunks
  }

  const totalFetched = Object.keys(allData).length;
  console.log(`\nTotal rows fetched: ${totalFetched}`);

  if (totalFetched > 0) {
    console.log('\nWriting to D1...');
    const inserted = await bulkWrite('margin_balance', allData);
    console.log(`\nBackfill complete: ${inserted} rows written to D1`);

    // Show a few sample values
    const dates = Object.keys(allData).sort();
    console.log('\nSample values:');
    for (const d of [dates[0], dates[Math.floor(dates.length / 2)], dates[dates.length - 1]]) {
      if (d) console.log(`  ${d}: ${allData[d]} 億`);
    }
  } else {
    console.log('No data fetched — nothing to write.');
  }
};

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
