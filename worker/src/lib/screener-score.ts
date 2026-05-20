import type {
  AnnualFinancialRow,
  FiveYearFinancials,
  PeaceBundle,
  StyleTag,
} from '@fd/shared';

export type ScreenerMetrics = {
  currentPe: number | null;
  pe5yAvg: number | null;
  pePremium: number | null;        // (currentPe / pe5yAvg) - 1
  yieldPct: number | null;
  roe5yMin: number | null;
  epsCagr: number | null;          // percent
  revenueCagr: number | null;      // percent
  monthlyRevYoy: number | null;    // percent
  deRatio: number | null;
  grossMargin: number | null;
  opMargin: number | null;
  netMargin: number | null;
  marketCap: number | null;
  name: string | null;
};

type Output = {
  weightedScore: number;
  styleTags: StyleTag[];
  highlights: string[];
  concerns: string[];
};

const cagr = (values: number[]): number | null => {
  const positive = values.filter((v) => v > 0);
  if (positive.length < 2) return null;
  const first = positive[0]!;
  const last = positive[positive.length - 1]!;
  const years = positive.length - 1;
  const c = Math.pow(last / first, 1 / years) - 1;
  return Number.isFinite(c) ? c * 100 : null;
};

const safeDiv = (a: number | null, b: number | null): number | null =>
  a !== null && b !== null && b !== 0 ? a / b : null;

/**
 * Derive screener metrics from financials + already-fetched extras.
 * extras: { currentPe, marketCap, name, yieldPct, monthlyRevYoy } come from elsewhere (yahoo/twse).
 */
export const deriveMetrics = (
  financials: FiveYearFinancials,
  extras: {
    currentPe: number | null;
    marketCap: number | null;
    name: string | null;
    yieldPct: number | null;
    monthlyRevYoy: number | null;
  },
): ScreenerMetrics => {
  const rows = financials.rows;
  const latest: AnnualFinancialRow | undefined = rows[rows.length - 1];

  const epsList = rows.map((r) => r.eps).filter((x): x is number => x !== null && x > 0);
  const epsCagr = cagr(epsList);
  const revList = rows.map((r) => r.revenue).filter((x): x is number => x !== null && x > 0);
  const revenueCagr = cagr(revList);

  // 5Y ROE = netIncome / equity, take minimum across rows
  const roes = rows
    .map((r) =>
      r.netIncome !== null && r.totalEquity !== null && r.totalEquity > 0
        ? (r.netIncome / r.totalEquity) * 100
        : null,
    )
    .filter((x): x is number => x !== null);
  const roe5yMin = roes.length > 0 ? Math.min(...roes) : null;

  // 5Y avg PE — needs price history; we don't have it here. Caller may inject from valuation route.
  // For now, leave null — pePremium computed downstream if avg is provided separately.
  // (Future: fetch 5y close + EPS-by-year to compute.)
  const pe5yAvg = null;
  const pePremium =
    extras.currentPe !== null && pe5yAvg !== null && (pe5yAvg as number) > 0
      ? extras.currentPe / (pe5yAvg as number) - 1
      : null;

  const grossMargin = latest && safeDiv(latest.grossProfit, latest.revenue);
  const opMargin = latest && safeDiv(latest.operatingIncome, latest.revenue);
  const netMargin = latest && safeDiv(latest.netIncome, latest.revenue);
  const deRatio = latest && safeDiv(latest.totalDebt, latest.totalEquity);

  return {
    currentPe: extras.currentPe,
    pe5yAvg,
    pePremium,
    yieldPct: extras.yieldPct,
    roe5yMin,
    epsCagr,
    revenueCagr,
    monthlyRevYoy: extras.monthlyRevYoy,
    deRatio: deRatio ?? null,
    grossMargin: grossMargin !== null && grossMargin !== undefined ? grossMargin * 100 : null,
    opMargin: opMargin !== null && opMargin !== undefined ? opMargin * 100 : null,
    netMargin: netMargin !== null && netMargin !== undefined ? netMargin * 100 : null,
    marketCap: extras.marketCap,
    name: extras.name,
  };
};

/**
 * PEACE Weighted Score (max ≈ 30):
 *   core 6 × 2 (max 12)
 *   + non-core 10 × 1 (max 10)
 *   + moat × 1.5 (max 4.5)
 *   ± PE vs 5y avg (-2 to +3)
 *   + ROE bonus (max +2)
 *   - risk × 2
 */
export const computeWeightedScore = (peace: PeaceBundle, metrics: ScreenerMetrics): number => {
  let score = 0;
  for (const c of peace.criteria) {
    if (c.passed !== true) continue;
    score += c.priority ? 2 : 1;
  }
  score += peace.moat.length * 1.5;
  score -= peace.risk.length * 2;

  if (metrics.pePremium !== null) {
    if (metrics.pePremium < -0.2) score += 3;       // current PE < 5Y avg × 0.8
    else if (metrics.pePremium < 0) score += 1;     // below average
    else if (metrics.pePremium > 0.5) score -= 2;   // > 1.5× average
  }

  if (metrics.roe5yMin !== null) {
    if (metrics.roe5yMin > 20) score += 2;
    else if (metrics.roe5yMin > 15) score += 1;
  }

  return Math.round(score * 10) / 10;
};

export const classifyTags = (
  peace: PeaceBundle,
  metrics: ScreenerMetrics,
  weightedScore: number,
): StyleTag[] => {
  const tags: StyleTag[] = [];

  // Value: high score, below-avg PE
  const peg = peace.criteria.find((c) => c.id === 13)?.value ?? null;
  if (
    weightedScore >= 18 &&
    metrics.pePremium !== null &&
    metrics.pePremium < -0.1 &&
    (peg === null || peg < 1.5)
  ) {
    tags.push('value');
  }

  // Growth: EPS CAGR > 15%, ROE > 18%, recent rev YoY > 5%
  if (
    metrics.epsCagr !== null && metrics.epsCagr > 15 &&
    metrics.roe5yMin !== null && metrics.roe5yMin > 18 &&
    metrics.monthlyRevYoy !== null && metrics.monthlyRevYoy > 5
  ) {
    tags.push('growth');
  }

  // Dividend: yield > 4%, OCF/Net > 0.8 (criterion #10), D/E < 0.5 (#11)
  const c10Pass = peace.criteria.find((c) => c.id === 10)?.passed === true;
  const c11Pass = peace.criteria.find((c) => c.id === 11)?.passed === true;
  if (metrics.yieldPct !== null && metrics.yieldPct > 4 && c10Pass && c11Pass) {
    tags.push('dividend');
  }

  // Hidden champion: mid cap (10–50bn TWD), ROE > 15%, moat ≥ 2
  if (
    metrics.marketCap !== null &&
    metrics.marketCap >= 10_000_000_000 && metrics.marketCap <= 500_000_000_000 &&
    metrics.roe5yMin !== null && metrics.roe5yMin > 15 &&
    peace.moat.length >= 2
  ) {
    tags.push('hiddenChampion');
  }

  return tags;
};

export const deriveHighlights = (peace: PeaceBundle, metrics: ScreenerMetrics): string[] => {
  const out: string[] = [];
  if (metrics.epsCagr !== null && metrics.epsCagr > 10) {
    out.push(`5 年 EPS 持續成長（CAGR ${metrics.epsCagr.toFixed(1)}%）`);
  }
  if (metrics.roe5yMin !== null && metrics.roe5yMin > 15) {
    out.push(`5 年 ROE 最低 ${metrics.roe5yMin.toFixed(1)}%（連年 > 15%）`);
  }
  if (peace.moat.length >= 2) {
    out.push(`護城河 ●${'●'.repeat(peace.moat.length - 1)} ${peace.moat.join('、')}`);
  }
  if (peace.criteria.find((c) => c.id === 10)?.passed === true) {
    out.push('收益質量佳：OCF/淨利 > 0.8');
  }
  if (peace.criteria.find((c) => c.id === 11)?.passed === true) {
    out.push('財務穩健：D/E < 0.5');
  }
  if (metrics.pePremium !== null && metrics.pePremium < -0.1) {
    out.push(`目前 PE 比 5 年均值低 ${(Math.abs(metrics.pePremium) * 100).toFixed(0)}%`);
  }
  return out.slice(0, 5);
};

export const deriveConcerns = (peace: PeaceBundle, metrics: ScreenerMetrics): string[] => {
  const out: string[] = [];
  // Core criteria failed
  const corefails = peace.criteria.filter((c) => c.priority && c.passed === false);
  for (const f of corefails.slice(0, 2)) {
    out.push(`★ #${f.id} ${f.label} 未過`);
  }
  if (peace.risk.length > 0) {
    out.push(`${peace.risk.length} 項風險：${peace.risk.join('、')}`);
  }
  if (metrics.pePremium !== null && metrics.pePremium > 0.5) {
    out.push(`目前 PE 比 5 年均值高 ${(metrics.pePremium * 100).toFixed(0)}% — 估值偏貴`);
  }
  if (metrics.deRatio !== null && metrics.deRatio > 1) {
    out.push(`D/E ${metrics.deRatio.toFixed(2)} 偏高`);
  }
  return out.slice(0, 4);
};

export const buildScreenerOutput = (
  peace: PeaceBundle,
  metrics: ScreenerMetrics,
): Output => {
  const weightedScore = computeWeightedScore(peace, metrics);
  return {
    weightedScore,
    styleTags: classifyTags(peace, metrics, weightedScore),
    highlights: deriveHighlights(peace, metrics),
    concerns: deriveConcerns(peace, metrics),
  };
};
