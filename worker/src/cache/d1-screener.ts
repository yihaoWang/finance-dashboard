import type { ScreenerRow, StyleTag } from '@fd/shared';

type Row = {
  symbol: string;
  name: string | null;
  score: number;
  total: number;
  priority_score: number;
  priority_total: number;
  weighted_score: number;
  moat_count: number;
  risk_count: number;
  style_tags: string | null;
  highlights: string | null;
  concerns: string | null;
  criteria_passed: string | null;
  moat_tags: string | null;
  risk_tags: string | null;
  market_cap: number | null;
  current_pe: number | null;
  pe_5y_avg: number | null;
  pe_premium: number | null;
  yield_pct: number | null;
  roe_5y_min: number | null;
  eps_cagr: number | null;
  revenue_cagr: number | null;
  monthly_rev_yoy: number | null;
  d_e_ratio: number | null;
  gross_margin: number | null;
  op_margin: number | null;
  net_margin: number | null;
  updated_at: number;
};

const parseJsonArray = <T>(s: string | null): T[] => {
  if (s === null || s === '') return [];
  try {
    const parsed = JSON.parse(s);
    return Array.isArray(parsed) ? (parsed as T[]) : [];
  } catch {
    return [];
  }
};

const parseJsonObject = <T>(s: string | null): Record<string, T> => {
  if (s === null || s === '') return {};
  try {
    const parsed = JSON.parse(s);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
      ? (parsed as Record<string, T>)
      : {};
  } catch {
    return {};
  }
};

const toRow = (r: Row): ScreenerRow => ({
  symbol: r.symbol,
  name: r.name,
  score: r.score,
  total: r.total,
  priorityScore: r.priority_score,
  priorityTotal: r.priority_total,
  weightedScore: r.weighted_score,
  moatCount: r.moat_count,
  riskCount: r.risk_count,
  styleTags: parseJsonArray<StyleTag>(r.style_tags),
  highlights: parseJsonArray<string>(r.highlights),
  concerns: parseJsonArray<string>(r.concerns),
  criteriaPassed: parseJsonObject<boolean>(r.criteria_passed),
  moatTags: parseJsonArray<string>(r.moat_tags),
  riskTags: parseJsonArray<string>(r.risk_tags),
  marketCap: r.market_cap,
  currentPe: r.current_pe,
  pe5yAvg: r.pe_5y_avg,
  pePremium: r.pe_premium,
  yieldPct: r.yield_pct,
  roe5yMin: r.roe_5y_min,
  epsCagr: r.eps_cagr,
  revenueCagr: r.revenue_cagr,
  monthlyRevYoy: r.monthly_rev_yoy,
  deRatio: r.d_e_ratio,
  grossMargin: r.gross_margin,
  opMargin: r.op_margin,
  netMargin: r.net_margin,
  updatedAt: r.updated_at,
});

export const upsertScreenerScore = async (db: D1Database, row: ScreenerRow): Promise<void> => {
  await db
    .prepare(
      `INSERT OR REPLACE INTO screener_scores
        (symbol, name, score, total, priority_score, priority_total,
         weighted_score, moat_count, risk_count, style_tags, highlights, concerns,
         criteria_passed, moat_tags, risk_tags,
         market_cap, current_pe, pe_5y_avg, pe_premium, yield_pct,
         roe_5y_min, eps_cagr, revenue_cagr, monthly_rev_yoy,
         d_e_ratio, gross_margin, op_margin, net_margin, updated_at)
       VALUES (?,?,?,?,?,?, ?,?,?,?,?,?, ?,?,?, ?,?,?,?,?, ?,?,?,?, ?,?,?,?, ?)`,
    )
    .bind(
      row.symbol,
      row.name,
      row.score,
      row.total,
      row.priorityScore,
      row.priorityTotal,
      row.weightedScore,
      row.moatCount,
      row.riskCount,
      JSON.stringify(row.styleTags),
      JSON.stringify(row.highlights),
      JSON.stringify(row.concerns),
      JSON.stringify(row.criteriaPassed),
      JSON.stringify(row.moatTags),
      JSON.stringify(row.riskTags),
      row.marketCap,
      row.currentPe,
      row.pe5yAvg,
      row.pePremium,
      row.yieldPct,
      row.roe5yMin,
      row.epsCagr,
      row.revenueCagr,
      row.monthlyRevYoy,
      row.deRatio,
      row.grossMargin,
      row.opMargin,
      row.netMargin,
      row.updatedAt,
    )
    .run();
};

export const listScreenerScores = async (db: D1Database, limit = 500): Promise<ScreenerRow[]> => {
  const res = await db
    .prepare(
      `SELECT * FROM screener_scores
       WHERE score > 0 OR priority_score > 0
       ORDER BY weighted_score DESC, priority_score DESC, score DESC
       LIMIT ?`,
    )
    .bind(limit)
    .all<Row>();
  return (res.results ?? []).map(toRow);
};
