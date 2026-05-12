/**
 * One-shot backfill: 10y daily values for 6 indicators into D1 sentiment_history.
 *
 * Usage:
 *   WORKER_URL=https://tickr-worker.example.com ADMIN_TOKEN=... \
 *     pnpm tsx scripts/backfill-sentiment-history.ts
 *
 * Note: per-indicator `fetchDailyValue` impls are stubs — fill in real TWSE/TAIFEX
 *       endpoints when actually running backfill. Pacing: 1 req/sec.
 */
import type { IndicatorKey } from '@fd/shared';

const START = new Date(Date.now() - 365 * 10 * 86400_000);
const END = new Date();
const INDICATORS: IndicatorKey[] = [
  'margin_maintenance',
  'short_long_ratio',
  'institutional_5d',
  'foreign_futures_oi',
  'breadth_adr',
  'options_pcr',
];

const sleep = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));

const isoDates = (): string[] => {
  const out: string[] = [];
  for (let d = new Date(START); d <= END; d.setDate(d.getDate() + 1)) {
    const day = d.getDay();
    if (day === 0 || day === 6) continue;
    out.push(d.toISOString().slice(0, 10));
  }
  return out;
};

const fetchDailyValue = async (
  indicator: IndicatorKey,
  date: string,
): Promise<number | null> => {
  throw new Error(`fetchDailyValue not implemented for ${indicator} @ ${date}`);
};

const writeRow = async (
  indicator: IndicatorKey,
  date: string,
  value: number,
): Promise<void> => {
  const url = `${process.env.WORKER_URL}/api/admin/sentiment-backfill`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${process.env.ADMIN_TOKEN}`,
    },
    body: JSON.stringify({ indicator, date, value }),
  });
  if (!res.ok) {
    throw new Error(`write failed ${indicator} ${date}: ${res.status}`);
  }
};

const main = async (): Promise<void> => {
  const dates = isoDates();
  for (const indicator of INDICATORS) {
    console.log(`[${indicator}] backfilling ${dates.length} days`);
    for (const date of dates) {
      try {
        const value = await fetchDailyValue(indicator, date);
        if (value !== null) await writeRow(indicator, date, value);
      } catch (error) {
        console.warn('skip', indicator, date, error);
      }
      await sleep(1000);
    }
  }
};

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
