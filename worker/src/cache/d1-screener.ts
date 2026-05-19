import type { ScreenerRow } from '@fd/shared';

type Row = {
  symbol: string;
  score: number;
  total: number;
  priority_score: number;
  priority_total: number;
  updated_at: number;
};

const toRow = (r: Row): ScreenerRow => ({
  symbol: r.symbol,
  score: r.score,
  total: r.total,
  priorityScore: r.priority_score,
  priorityTotal: r.priority_total,
  updatedAt: r.updated_at,
});

export const upsertScreenerScore = async (db: D1Database, row: ScreenerRow): Promise<void> => {
  await db
    .prepare(
      `INSERT OR REPLACE INTO screener_scores
        (symbol, score, total, priority_score, priority_total, updated_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
    )
    .bind(row.symbol, row.score, row.total, row.priorityScore, row.priorityTotal, row.updatedAt)
    .run();
};

export const listScreenerScores = async (db: D1Database, limit = 100): Promise<ScreenerRow[]> => {
  const res = await db
    .prepare(
      `SELECT symbol, score, total, priority_score, priority_total, updated_at
       FROM screener_scores
       ORDER BY priority_score DESC, score DESC, updated_at DESC
       LIMIT ?`,
    )
    .bind(limit)
    .all<Row>();
  return (res.results ?? []).map(toRow);
};
