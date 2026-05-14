import type { MoatCategory, RiskCategory } from '@fd/shared';

interface TagRow {
  kind: string;
  value: string;
}

export const getTags = async (
  db: D1Database,
  symbol: string,
): Promise<{ moat: MoatCategory[]; risk: RiskCategory[] }> => {
  const result = await db
    .prepare('SELECT kind, value FROM stock_tags WHERE symbol = ?1')
    .bind(symbol)
    .all<TagRow>();

  const moat: MoatCategory[] = [];
  const risk: RiskCategory[] = [];

  for (const row of result.results) {
    if (row.kind === 'moat') moat.push(row.value as MoatCategory);
    if (row.kind === 'risk') risk.push(row.value as RiskCategory);
  }

  return { moat, risk };
};

export const setTags = async (
  db: D1Database,
  symbol: string,
  kind: 'moat' | 'risk',
  values: string[],
): Promise<void> => {
  const deleteStmt = db
    .prepare('DELETE FROM stock_tags WHERE symbol = ?1 AND kind = ?2')
    .bind(symbol, kind);

  const insertStmts = values.map((v) =>
    db
      .prepare(
        'INSERT OR REPLACE INTO stock_tags (symbol, kind, value, updated_at) VALUES (?1, ?2, ?3, datetime(\'now\'))',
      )
      .bind(symbol, kind, v),
  );

  await db.batch([deleteStmt, ...insertStmts]);
};
