export type DailyPrice = {
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
};

export const upsertDailyPrices = async (
  db: D1Database,
  symbol: string,
  rows: DailyPrice[],
): Promise<void> => {
  if (rows.length === 0) return;
  const stmt = db.prepare(
    `INSERT INTO daily_prices(symbol,date,open,high,low,close,volume)
     VALUES(?,?,?,?,?,?,?)
     ON CONFLICT(symbol,date) DO UPDATE SET
       open=excluded.open,high=excluded.high,low=excluded.low,
       close=excluded.close,volume=excluded.volume`,
  );
  await db.batch(
    rows.map((r) => stmt.bind(symbol, r.date, r.open, r.high, r.low, r.close, r.volume)),
  );
};

export const recentCloses = async (
  db: D1Database,
  symbol: string,
  limit: number,
): Promise<number[]> => {
  const res = await db
    .prepare(
      `SELECT close FROM daily_prices WHERE symbol = ? ORDER BY date DESC LIMIT ?`,
    )
    .bind(symbol, limit)
    .all<{ close: number }>();
  return (res.results ?? []).map((r) => r.close);
};
