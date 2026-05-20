import type { MoatCategory, RiskCategory } from '@fd/shared';

interface TagRow {
  kind: string;
  value: string;
  reason: string | null;
}

export type Tags = {
  moat: MoatCategory[];
  risk: RiskCategory[];
  moatReasons: Record<string, string>;
  riskReasons: Record<string, string>;
  // Free-form research notes (Claude deep research summary). Shown even when no
  // moats/risks are tagged — to explain WHY no moat / risk was identified.
  moatNote: string | null;
  riskNote: string | null;
};

export const getTags = async (db: D1Database, symbol: string): Promise<Tags> => {
  const result = await db
    .prepare('SELECT kind, value, reason FROM stock_tags WHERE symbol = ?1')
    .bind(symbol)
    .all<TagRow>();

  const moat: MoatCategory[] = [];
  const risk: RiskCategory[] = [];
  const moatReasons: Record<string, string> = {};
  const riskReasons: Record<string, string> = {};
  let moatNote: string | null = null;
  let riskNote: string | null = null;

  for (const row of result.results) {
    if (row.kind === 'moat') {
      moat.push(row.value as MoatCategory);
      if (row.reason !== null && row.reason !== '') moatReasons[row.value] = row.reason;
    } else if (row.kind === 'risk') {
      risk.push(row.value as RiskCategory);
      if (row.reason !== null && row.reason !== '') riskReasons[row.value] = row.reason;
    } else if (row.kind === 'moat_note') {
      moatNote = row.reason ?? null;
    } else if (row.kind === 'risk_note') {
      riskNote = row.reason ?? null;
    }
  }

  return { moat, risk, moatReasons, riskReasons, moatNote, riskNote };
};

export const setTags = async (
  db: D1Database,
  symbol: string,
  kind: 'moat' | 'risk',
  values: string[],
): Promise<void> => {
  // Preserves existing reasons by NOT touching them — only re-aligns presence.
  // Deep-research tags (with reasons) are written via a separate bulk insert path.
  const deleteStmt = db
    .prepare('DELETE FROM stock_tags WHERE symbol = ?1 AND kind = ?2')
    .bind(symbol, kind);

  const insertStmts = values.map((v) =>
    db
      .prepare(
        "INSERT OR REPLACE INTO stock_tags (symbol, kind, value, updated_at) VALUES (?1, ?2, ?3, datetime('now'))",
      )
      .bind(symbol, kind, v),
  );

  await db.batch([deleteStmt, ...insertStmts]);
};
