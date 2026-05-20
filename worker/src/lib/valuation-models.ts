import type {
  AnnualFinancialRow,
  ValuationGauge,
  ValuationMethodResult,
  ValuationVerdict,
} from '@fd/shared';

const clamp = (v: number, lo: number, hi: number): number => Math.max(lo, Math.min(hi, v));

const mean = (xs: number[]): number => xs.reduce((s, x) => s + x, 0) / xs.length;

const std = (xs: number[]): number => {
  if (xs.length < 2) return 0;
  const m = mean(xs);
  return Math.sqrt(mean(xs.map((x) => (x - m) ** 2)));
};

// percentile via linear interpolation; p in [0,1]
const percentile = (xs: number[], p: number): number => {
  const sorted = [...xs].sort((a, b) => a - b);
  if (sorted.length === 0) return NaN;
  if (sorted.length === 1) return sorted[0]!;
  const idx = p * (sorted.length - 1);
  const lo = Math.floor(idx);
  const hi = Math.ceil(idx);
  const frac = idx - lo;
  return sorted[lo]! * (1 - frac) + sorted[hi]! * frac;
};

const verdictOf = (price: number, low: number, high: number): ValuationVerdict => {
  if (price < low) return '便宜';
  const mid = (low + high) / 2;
  if (price < mid) return '合理偏低';
  if (price <= high) return '合理偏高';
  return '昂貴';
};

const verdictScore = (v: ValuationVerdict): number =>
  v === '便宜' ? -2 : v === '合理偏低' ? -1 : v === '合理偏高' ? 1 : 2;

// ---------- ROE 法 ----------
// BPS × (1+ROE)^N where N ∈ [5,10], ROE from p25..p75 of past 5y
export const roeValuation = (
  rows: AnnualFinancialRow[],
  price: number,
): ValuationMethodResult | null => {
  const usable = rows.filter(
    (r) =>
      r.eps !== null &&
      r.eps > 0 &&
      r.netIncome !== null &&
      r.netIncome > 0 &&
      r.totalEquity !== null &&
      r.totalEquity > 0,
  );
  if (usable.length < 3) return null;

  // ROE per year (decimal, e.g. 0.25)
  const roes = usable.map((r) => r.netIncome! / r.totalEquity!);
  // BPS via shares = netIncome / EPS, BPS = equity / shares = equity * eps / netIncome
  const latest = usable[usable.length - 1]!;
  const bps = (latest.totalEquity! * latest.eps!) / latest.netIncome!;

  const roeLow = percentile(roes, 0.25);
  const roeHigh = percentile(roes, 0.75);

  const low = bps * Math.pow(1 + roeLow, 5);
  const high = bps * Math.pow(1 + roeHigh, 10);

  const cv = std(roes) / Math.abs(mean(roes));
  const confidence = clamp(1 - cv, 0.4, 0.95);

  return {
    method: 'ROE',
    low,
    high,
    confidence,
    verdict: verdictOf(price, low, high),
    note: `BPS ${bps.toFixed(1)} × (1+ROE ${(roeLow * 100).toFixed(1)}~${(roeHigh * 100).toFixed(1)}%)^5~10`,
  };
};

// ---------- EPS 法 ----------
// EPS_ttm × industry PE band (or self 5y PE band fallback)
export const epsValuation = (
  rows: AnnualFinancialRow[],
  price: number,
  industryPe: number | null,
  industryPeerCount: number,
  self5yPes: number[],
): ValuationMethodResult | null => {
  const epsList = rows.map((r) => r.eps).filter((x): x is number => x !== null && x > 0);
  if (epsList.length < 2) return null;
  const epsTtm = epsList[epsList.length - 1]!;

  let peLow: number;
  let peHigh: number;
  let band: 'industry' | 'self';
  if (self5yPes.length >= 3) {
    peLow = percentile(self5yPes, 0.25);
    peHigh = percentile(self5yPes, 0.75);
    band = 'self';
  } else if (industryPe !== null && industryPe > 0) {
    peLow = industryPe * 0.8;
    peHigh = industryPe * 1.2;
    band = 'industry';
  } else {
    return null;
  }

  const low = epsTtm * peLow;
  const high = epsTtm * peHigh;

  // confidence: EPS YoY growth stability + sample size
  const yoy: number[] = [];
  for (let i = 1; i < epsList.length; i++) {
    yoy.push((epsList[i]! - epsList[i - 1]!) / epsList[i - 1]!);
  }
  const epsCv = yoy.length > 0 ? std(yoy) / Math.max(0.05, Math.abs(mean(yoy))) : 1;
  const sampleBonus = band === 'self' ? 1 : clamp(industryPeerCount / 20, 0, 1);
  const confidence = clamp((1 - Math.min(epsCv, 1)) * 0.7 + sampleBonus * 0.3, 0.4, 0.9);

  return {
    method: 'EPS',
    low,
    high,
    confidence,
    verdict: verdictOf(price, low, high),
    note: `EPS ${epsTtm.toFixed(2)} × PE ${peLow.toFixed(1)}~${peHigh.toFixed(1)} (${band})`,
  };
};

// ---------- 股利法 ----------
// price = dividend / yield. Use TW typical 3%..6% band (no per-stock yield history in v1).
export const dividendValuation = (
  cashDividend: number | null,
  currentYield: number | null,
  price: number,
): ValuationMethodResult | null => {
  if (cashDividend === null || cashDividend <= 0) return null;
  const yLow = 0.03;
  const yHigh = 0.06;
  const low = cashDividend / yHigh; // higher required yield → lower fair price
  const high = cashDividend / yLow;

  // confidence: low because using static market bands instead of self-history
  let confidence = 0.55;
  if (currentYield !== null && currentYield > 0) confidence = 0.65;

  return {
    method: '股利',
    low,
    high,
    confidence,
    verdict: verdictOf(price, low, high),
    note: `現金股利 ${cashDividend.toFixed(2)} / 殖利率 ${(yLow * 100).toFixed(0)}~${(yHigh * 100).toFixed(0)}%`,
  };
};

// ---------- 淨值法 ----------
// BPS × PB band. v1: use rough TW PB band 1.0~2.0 if no industry PB; future: industry PB.
export const bookValuation = (
  rows: AnnualFinancialRow[],
  price: number,
  marketPb: number | null,
): ValuationMethodResult | null => {
  const latest = rows[rows.length - 1];
  if (
    !latest ||
    latest.eps === null ||
    latest.eps <= 0 ||
    latest.netIncome === null ||
    latest.netIncome <= 0 ||
    latest.totalEquity === null ||
    latest.totalEquity <= 0
  )
    return null;
  const bps = (latest.totalEquity * latest.eps) / latest.netIncome;

  let pbLow: number;
  let pbHigh: number;
  if (marketPb !== null && marketPb > 0) {
    pbLow = marketPb * 0.7;
    pbHigh = marketPb * 1.3;
  } else {
    pbLow = 1.0;
    pbHigh = 2.0;
  }

  const low = bps * pbLow;
  const high = bps * pbHigh;

  // BPS growth stability
  const bpsSeries = rows
    .filter(
      (r) =>
        r.totalEquity !== null &&
        r.totalEquity > 0 &&
        r.eps !== null &&
        r.eps > 0 &&
        r.netIncome !== null &&
        r.netIncome > 0,
    )
    .map((r) => (r.totalEquity! * r.eps!) / r.netIncome!);
  let confidence = 0.6;
  if (bpsSeries.length >= 3) {
    const growths: number[] = [];
    for (let i = 1; i < bpsSeries.length; i++) {
      growths.push((bpsSeries[i]! - bpsSeries[i - 1]!) / bpsSeries[i - 1]!);
    }
    const cv = std(growths) / Math.max(0.02, Math.abs(mean(growths)));
    confidence = clamp(1 - Math.min(cv, 1) * 0.5, 0.5, 0.85);
  }

  return {
    method: '淨值',
    low,
    high,
    confidence,
    verdict: verdictOf(price, low, high),
    note: `BPS ${bps.toFixed(1)} × PB ${pbLow.toFixed(2)}~${pbHigh.toFixed(2)}`,
  };
};

// ---------- 綜合 ----------
export const compositeValuation = (
  symbol: string,
  price: number,
  methods: ValuationMethodResult[],
): ValuationGauge => {
  const totalW = methods.reduce((s, m) => s + m.confidence, 0);
  const low = methods.reduce((s, m) => s + m.low * m.confidence, 0) / totalW;
  const high = methods.reduce((s, m) => s + m.high * m.confidence, 0) / totalW;

  const scores = methods.map((m) => verdictScore(m.verdict));
  const agreement = 1 - Math.min(std(scores) / 2, 1);
  const confidence = clamp(mean(methods.map((m) => m.confidence)) * agreement, 0.3, 0.95);

  return {
    symbol,
    price,
    methods,
    composite: { low, high, confidence, verdict: verdictOf(price, low, high) },
    computedAt: Date.now(),
  };
};
