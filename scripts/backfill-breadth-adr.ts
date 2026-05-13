/**
 * Backfill script: fetch 10y of TWSE MI_INDEX breadth data and upsert into prod D1.
 *
 * Usage:
 *   ADMIN_TOKEN="..." WORKER_URL="https://finance-dashboard-worker.nihongo.workers.dev" \
 *     pnpm tsx scripts/backfill-breadth-adr.ts
 */

const WORKER_URL = process.env.WORKER_URL ?? 'https://finance-dashboard-worker.nihongo.workers.dev';
const ADMIN_URL = `${WORKER_URL}/api/admin/sentiment-backfill-bulk`;
const TOKEN = process.env.ADMIN_TOKEN;

if (!TOKEN) {
  console.error('ADMIN_TOKEN env var required');
  process.exit(1);
}

const START = new Date(Date.now() - 365 * 10 * 86400_000);
const END = new Date();

interface BulkRow {
  indicator: 'breadth_adr';
  date: string;
  value: number;
}

const toTwseDate = (d: Date): string =>
  `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;

const toIso = (d: Date): string => d.toISOString().slice(0, 10);

const isWeekend = (d: Date): boolean => d.getDay() === 0 || d.getDay() === 6;

const sleep = (ms: number): Promise<void> => new Promise<void>((r) => setTimeout(r, ms));

const parseInt2 = (s: string): number => {
  const m = s.match(/^([\d,]+)/);
  return m ? Number(m[1].replace(/,/g, '')) : 0;
};

const fetchAdr = async (date: Date): Promise<number | null> => {
  const url = `https://www.twse.com.tw/rwd/zh/afterTrading/MI_INDEX?date=${toTwseDate(date)}&type=MS&response=json`;
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`status ${res.status}`);
      const json = (await res.json()) as {
        stat?: string;
        tables?: Array<{ title?: string; data?: string[][] }>;
      };
      if (json.stat && json.stat.startsWith('很抱歉')) return null;
      const table = json.tables?.find((t) => t.title === '漲跌證券數合計');
      if (!table || !table.data) return null;
      const up = table.data.find((r) => r[0]?.startsWith('上漲'));
      const down = table.data.find((r) => r[0]?.startsWith('下跌'));
      if (!up || !down) return null;
      const upN = parseInt2(up[1]);
      const downN = parseInt2(down[1]);
      if (downN === 0) return null;
      return Number((upN / downN).toFixed(2));
    } catch (error) {
      if (attempt === 0) {
        await sleep(5000);
        continue;
      }
      console.warn('fetchAdr failed', toIso(date), error);
      return null;
    }
  }
  return null;
};

const flush = async (rows: BulkRow[]): Promise<void> => {
  const res = await fetch(ADMIN_URL, {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${TOKEN}` },
    body: JSON.stringify({ rows }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`flush failed ${res.status}: ${text}`);
  }
  console.log('flushed', rows.length, 'rows');
};

const main = async (): Promise<void> => {
  const rows: BulkRow[] = [];
  let processed = 0;
  let totalFlushed = 0;

  for (let d = new Date(START); d <= END; d.setDate(d.getDate() + 1)) {
    if (isWeekend(d)) continue;
    const value = await fetchAdr(new Date(d));
    processed += 1;
    if (value !== null) {
      rows.push({ indicator: 'breadth_adr', date: toIso(d), value });
    }
    if (processed % 50 === 0) {
      console.log(`processed=${processed} buffered=${rows.length} at ${toIso(d)}`);
    }
    await sleep(1000);

    // Flush every 500 rows to avoid oversized payloads
    if (rows.length >= 500) {
      const batch = rows.splice(0, rows.length);
      await flush(batch);
      totalFlushed += batch.length;
    }
  }

  if (rows.length > 0) {
    await flush(rows);
    totalFlushed += rows.length;
  }

  console.log(`done. total processed=${processed} total inserted=${totalFlushed}`);
};

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
