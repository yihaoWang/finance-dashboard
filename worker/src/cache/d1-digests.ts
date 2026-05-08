import type { DigestBundle, DigestHistoryItem, DigestScope, DigestSource } from '@fd/shared';

export const upsertDigest = async (db: D1Database, bundle: DigestBundle): Promise<void> => {
  await db
    .prepare(
      `INSERT OR REPLACE INTO digests
        (date, scope, symbol, hard_data, framework, sentiment, action_plan, sources_json, model, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .bind(
      bundle.date,
      bundle.scope,
      bundle.symbol,
      bundle.sections.hard_data,
      bundle.sections.framework,
      bundle.sections.sentiment,
      bundle.sections.action_plan,
      JSON.stringify(bundle.sources),
      bundle.model,
      bundle.createdAt,
    )
    .run();
};

export const getDigest = async (
  db: D1Database,
  scope: DigestScope,
  symbol: string,
  date: string,
): Promise<DigestBundle | null> => {
  const row = await db
    .prepare(
      `SELECT date, scope, symbol, hard_data, framework, sentiment, action_plan, sources_json, model, created_at
       FROM digests WHERE date = ? AND scope = ? AND symbol = ?`,
    )
    .bind(date, scope, symbol)
    .first<{
      date: string;
      scope: DigestScope;
      symbol: string;
      hard_data: string;
      framework: string;
      sentiment: string;
      action_plan: string | null;
      sources_json: string;
      model: string;
      created_at: number;
    }>();

  if (!row) return null;

  return {
    date: row.date,
    scope: row.scope,
    symbol: row.symbol,
    sections: {
      hard_data: row.hard_data,
      framework: row.framework,
      sentiment: row.sentiment,
      action_plan: row.action_plan ?? '',
    },
    sources: JSON.parse(row.sources_json) as DigestSource[],
    model: row.model,
    createdAt: row.created_at,
  };
};

export const listDigestHistory = async (
  db: D1Database,
  scope: DigestScope,
  symbol: string | undefined,
  limit: number,
): Promise<DigestHistoryItem[]> => {
  if (symbol !== undefined) {
    const res = await db
      .prepare(
        `SELECT date, scope, symbol, created_at FROM digests
         WHERE scope = ? AND symbol = ?
         ORDER BY date DESC LIMIT ?`,
      )
      .bind(scope, symbol, limit)
      .all<{ date: string; scope: DigestScope; symbol: string; created_at: number }>();
    return (res.results ?? []).map((r) => ({
      date: r.date,
      scope: r.scope,
      symbol: r.symbol,
      createdAt: r.created_at,
    }));
  }

  const res = await db
    .prepare(
      `SELECT date, scope, symbol, created_at FROM digests
       WHERE scope = ?
       ORDER BY date DESC LIMIT ?`,
    )
    .bind(scope, limit)
    .all<{ date: string; scope: DigestScope; symbol: string; created_at: number }>();
  return (res.results ?? []).map((r) => ({
    date: r.date,
    scope: r.scope,
    symbol: r.symbol,
    createdAt: r.created_at,
  }));
};
