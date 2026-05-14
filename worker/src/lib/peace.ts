// PEACE framework computation
// WACC simplification: WACC ≈ 10Y US Treasury yield + 5%
// This is an intentional simplification agreed with the user.
// It does not account for capital structure or beta.
// ROIC = NOPAT / Invested Capital where:
//   NOPAT = Operating Income × (1 - effective tax rate)
//   Invested Capital = Total Equity + Total Debt (short + long term)
// Asset Turnover industry average fallback: 0.5 (v1 scope; proper peer grouping is out of scope)

import type { AnnualFinancialRow, FiveYearFinancials, MoatCategory, PeaceBundle, PeaceCriterion, RiskCategory } from '@fd/shared';

// ─── helpers ─────────────────────────────────────────────────────────────────

const cagr = (values: number[]): number | null => {
  if (values.length < 2) return null;
  const first = values[0];
  const last = values[values.length - 1];
  if (first === undefined || last === undefined || first === 0) return null;
  if (first < 0 || last < 0) return null; // CAGR undefined for sign changes
  return (Math.pow(last / first, 1 / (values.length - 1)) - 1) * 100;
};

// Returns true if any consecutive YoY drop exceeds thresholdPct (positive number = drop)
const hasDeclineBeyond = (values: number[], thresholdPct: number): boolean => {
  for (let i = 1; i < values.length; i++) {
    const prev = values[i - 1];
    const curr = values[i];
    if (prev === undefined || curr === undefined || prev === 0) continue;
    const yoy = ((curr - prev) / Math.abs(prev)) * 100;
    if (yoy < -thresholdPct) return true;
  }
  return false;
};

const allPositive = (values: (number | null)[]): boolean =>
  values.every((v) => v !== null && v > 0);

const allAbove = (values: (number | null)[], threshold: number): boolean =>
  values.every((v) => v !== null && v > threshold);

const compact = (values: (number | null)[]): number[] =>
  values.filter((v): v is number => v !== null);

const lastValue = (values: (number | null)[]): number | null => {
  for (let i = values.length - 1; i >= 0; i--) {
    const v = values[i];
    if (v !== null) return v;
  }
  return null;
};

// ─── criterion evaluators ────────────────────────────────────────────────────

const evalRevenueSteady = (rows: AnnualFinancialRow[]): Pick<PeaceCriterion, 'passed' | 'value'> => {
  const vals = compact(rows.map((r) => r.revenue));
  if (vals.length < 2) return { passed: null, value: null };
  const declined = hasDeclineBeyond(vals, 10);
  // report last YoY as the value
  const last = vals[vals.length - 1];
  const prev = vals[vals.length - 2];
  const lastYoy = prev !== undefined && prev !== 0 ? ((last - prev) / Math.abs(prev)) * 100 : null;
  return { passed: !declined, value: lastYoy !== undefined ? lastYoy : null };
};

const evalGrossMarginSteady = (rows: AnnualFinancialRow[]): Pick<PeaceCriterion, 'passed' | 'value'> => {
  const margins = compact(rows.map((r) =>
    r.revenue !== null && r.revenue !== 0 && r.grossProfit !== null
      ? (r.grossProfit / r.revenue) * 100
      : null,
  ));
  if (margins.length < 2) return { passed: null, value: null };
  const declined = hasDeclineBeyond(margins, 10);
  return { passed: !declined, value: lastValue(margins) };
};

const evalOpIncomeSteady = (rows: AnnualFinancialRow[]): Pick<PeaceCriterion, 'passed' | 'value'> => {
  const vals = compact(rows.map((r) => r.operatingIncome));
  if (vals.length < 2) return { passed: null, value: null };
  const allPos = allPositive(vals.map((v) => v));
  const declined = hasDeclineBeyond(vals, 10);
  return { passed: allPos && !declined, value: lastValue(vals) };
};

const evalEpsSteady = (rows: AnnualFinancialRow[]): Pick<PeaceCriterion, 'passed' | 'value'> => {
  const vals = compact(rows.map((r) => r.eps));
  if (vals.length < 2) return { passed: null, value: null };
  const allPos = allPositive(vals.map((v) => v));
  const declined = hasDeclineBeyond(vals, 10);
  return { passed: allPos && !declined, value: lastValue(vals) };
};

const evalRevenueCagr = (rows: AnnualFinancialRow[]): Pick<PeaceCriterion, 'passed' | 'value'> => {
  const vals = compact(rows.map((r) => r.revenue));
  const c = cagr(vals);
  if (c === null) return { passed: null, value: null };
  return { passed: c > 0, value: c };
};

const evalOpIncomeGrowth = (rows: AnnualFinancialRow[]): Pick<PeaceCriterion, 'passed' | 'value'> => {
  const vals = compact(rows.map((r) => r.operatingIncome));
  const c = cagr(vals);
  if (c === null) return { passed: null, value: null };
  const declined = hasDeclineBeyond(vals, 10);
  return { passed: c > 0 && !declined, value: c };
};

const evalEpsGrowth = (rows: AnnualFinancialRow[]): Pick<PeaceCriterion, 'passed' | 'value'> => {
  const vals = compact(rows.map((r) => r.eps));
  const c = cagr(vals);
  if (c === null) return { passed: null, value: null };
  const declined = hasDeclineBeyond(vals, 10);
  return { passed: c > 0 && !declined, value: c };
};

const evalCashFlowPositive = (rows: AnnualFinancialRow[]): Pick<PeaceCriterion, 'passed' | 'value'> => {
  const ocfVals = compact(rows.map((r) => r.ocf));
  const fcfVals = compact(rows.map((r) => r.fcf));
  if (ocfVals.length < 2 || fcfVals.length < 2) return { passed: null, value: null };
  const ocfAllPos = allPositive(ocfVals.map((v) => v));
  const fcfAllPos = allPositive(fcfVals.map((v) => v));
  const ocfCagr = cagr(ocfVals);
  const fcfCagr = cagr(fcfVals);
  const ocfGrowing = ocfCagr !== null && ocfCagr > 0;
  const fcfGrowing = fcfCagr !== null && fcfCagr > 0;
  const lastOcf = lastValue(ocfVals);
  return { passed: ocfAllPos && fcfAllPos && ocfGrowing && fcfGrowing, value: lastOcf };
};

const evalOcfVsOtherCf = (rows: AnnualFinancialRow[]): Pick<PeaceCriterion, 'passed' | 'value'> => {
  const lastRow = rows[rows.length - 1];
  if (lastRow === undefined) return { passed: null, value: null };
  const { ocf, icf, fcfCf } = lastRow;
  if (ocf === null || icf === null || fcfCf === null) return { passed: null, value: null };
  // OCF > |financing| + |investing|
  const outflows = Math.abs(icf) + Math.abs(fcfCf);
  return { passed: ocf > outflows, value: ocf };
};

const evalEarningsQuality = (rows: AnnualFinancialRow[]): Pick<PeaceCriterion, 'passed' | 'value'> => {
  const lastRow = rows[rows.length - 1];
  if (lastRow === undefined) return { passed: null, value: null };
  const { ocf, netIncome } = lastRow;
  if (ocf === null || netIncome === null || netIncome === 0) return { passed: null, value: null };
  const ratio = ocf / netIncome;
  return { passed: ratio > 0.8, value: ratio };
};

const evalDebtToEquity = (rows: AnnualFinancialRow[]): Pick<PeaceCriterion, 'passed' | 'value'> => {
  const lastRow = rows[rows.length - 1];
  if (lastRow === undefined) return { passed: null, value: null };
  const { totalDebt, totalEquity } = lastRow;
  if (totalDebt === null || totalEquity === null || totalEquity === 0) return { passed: null, value: null };
  const de = totalDebt / totalEquity;
  return { passed: de < 0.5, value: de };
};

const evalCurrentRatio = (rows: AnnualFinancialRow[]): Pick<PeaceCriterion, 'passed' | 'value'> => {
  const lastRow = rows[rows.length - 1];
  if (lastRow === undefined) return { passed: null, value: null };
  const { currentAssets, currentLiabilities } = lastRow;
  if (currentAssets === null || currentLiabilities === null || currentLiabilities === 0)
    return { passed: null, value: null };
  const ratio = (currentAssets / currentLiabilities) * 100;
  return { passed: ratio > 100, value: ratio };
};

const evalLtDebtToNetIncome = (rows: AnnualFinancialRow[]): Pick<PeaceCriterion, 'passed' | 'value'> => {
  // Use total debt as proxy for long-term debt (often no separate LT debt field)
  const lastRow = rows[rows.length - 1];
  if (lastRow === undefined) return { passed: null, value: null };
  const { totalDebt, netIncome } = lastRow;
  if (totalDebt === null || netIncome === null || netIncome === 0) return { passed: null, value: null };
  const ratio = totalDebt / netIncome;
  return { passed: ratio < 4, value: ratio };
};

const evalRoe = (rows: AnnualFinancialRow[]): Pick<PeaceCriterion, 'passed' | 'value'> => {
  // Compute ROE for each year: netIncome / totalEquity × 100
  const roeVals = compact(rows.map((r) => {
    if (r.netIncome === null || r.totalEquity === null || r.totalEquity === 0) return null;
    return (r.netIncome / r.totalEquity) * 100;
  }));
  if (roeVals.length === 0) return { passed: null, value: null };
  const allAbove15 = allAbove(roeVals.map((v) => v), 15);
  return { passed: allAbove15, value: lastValue(roeVals) };
};

const evalAssetTurnover = (rows: AnnualFinancialRow[]): Pick<PeaceCriterion, 'passed' | 'value'> => {
  // Asset Turnover = Revenue / Total Assets
  // Industry average comparison is out of scope for v1; fallback threshold = 0.5
  const lastRow = rows[rows.length - 1];
  if (lastRow === undefined) return { passed: null, value: null };
  const { revenue, totalAssets } = lastRow;
  if (revenue === null || totalAssets === null || totalAssets === 0) return { passed: null, value: null };
  const at = revenue / totalAssets;
  return { passed: at > 0.5, value: at };
};

const evalRoicVsWacc = (rows: AnnualFinancialRow[], wacc: number): Pick<PeaceCriterion, 'passed' | 'value'> => {
  const lastRow = rows[rows.length - 1];
  if (lastRow === undefined) return { passed: null, value: null };
  const { operatingIncome, incomeTaxExpense, pretaxIncome, totalEquity, totalDebt } = lastRow;
  if (operatingIncome === null) return { passed: null, value: null };

  // Effective tax rate = income tax expense / pre-tax income; fallback 20%
  let taxRate = 0.20;
  if (incomeTaxExpense !== null && pretaxIncome !== null && pretaxIncome !== 0) {
    const computed = incomeTaxExpense / pretaxIncome;
    if (Number.isFinite(computed) && computed >= 0 && computed < 1) {
      taxRate = computed;
    }
  }

  const nopat = operatingIncome * (1 - taxRate);
  const investedCapital =
    (totalEquity ?? 0) + (totalDebt ?? 0);
  if (investedCapital === 0) return { passed: null, value: null };

  const roic = (nopat / investedCapital) * 100;
  return { passed: roic > wacc, value: roic };
};

// ─── main export ─────────────────────────────────────────────────────────────

export const computePeace = (
  data: FiveYearFinancials,
  wacc: number,
  moat: MoatCategory[],
  risk: RiskCategory[],
): PeaceBundle => {
  const rows = data.rows;

  const criteria: PeaceCriterion[] = [
    // ── P 盈利 ──────────────────────────────────────────────────────────────
    {
      id: 1,
      group: 'P',
      label: '5年總營收正成長、不衰退',
      priority: false,
      threshold: 'YoY ≥ -10% 每年',
      ...evalRevenueSteady(rows),
    },
    {
      id: 2,
      group: 'P',
      label: '5年毛利率正成長/維持、不衰退',
      priority: false,
      threshold: 'YoY ≥ -10pp',
      ...evalGrossMarginSteady(rows),
    },
    {
      id: 3,
      group: 'P',
      label: '5年營業利益為正、不衰退',
      priority: false,
      threshold: 'Op income > 0 & YoY ≥ -10%',
      ...evalOpIncomeSteady(rows),
    },
    {
      id: 4,
      group: 'P',
      label: '5年 EPS 為正、不衰退',
      priority: true,
      threshold: 'EPS > 0 & YoY ≥ -10%',
      ...evalEpsSteady(rows),
    },
    // ── E 增長 ──────────────────────────────────────────────────────────────
    {
      id: 5,
      group: 'E',
      label: '5年總營收正成長',
      priority: false,
      threshold: 'Revenue CAGR > 0%',
      ...evalRevenueCagr(rows),
    },
    {
      id: 6,
      group: 'E',
      label: '5年營業利益正成長、不衰退',
      priority: false,
      threshold: 'Op income CAGR > 0 & YoY ≥ -10%',
      ...evalOpIncomeGrowth(rows),
    },
    {
      id: 7,
      group: 'E',
      label: '5年 EPS 正成長、不衰退',
      priority: true,
      threshold: 'EPS CAGR > 0 & YoY ≥ -10%',
      ...evalEpsGrowth(rows),
    },
    // ── A 現金 ──────────────────────────────────────────────────────────────
    {
      id: 8,
      group: 'A',
      label: '營運/自由現金流持續增加且為正',
      priority: true,
      threshold: 'OCF > 0 & FCF > 0 & CAGR > 0',
      ...evalCashFlowPositive(rows),
    },
    {
      id: 9,
      group: 'A',
      label: '營運現金流 > 融資 + 投資現金流',
      priority: false,
      threshold: 'OCF > |FCF| + |ICF|',
      ...evalOcfVsOtherCf(rows),
    },
    {
      id: 10,
      group: 'A',
      label: '收益質量 OCF/淨利 > 0.8',
      priority: true,
      threshold: 'OCF / Net Income > 0.8',
      ...evalEarningsQuality(rows),
    },
    // ── C 保守 ──────────────────────────────────────────────────────────────
    {
      id: 11,
      group: 'C',
      label: 'D/E ratio < 0.5',
      priority: true,
      threshold: 'Total Debt / Equity < 0.5',
      ...evalDebtToEquity(rows),
    },
    {
      id: 12,
      group: 'C',
      label: '流動比率 > 100%',
      priority: false,
      threshold: 'Current Ratio > 100% (good > 200%)',
      ...evalCurrentRatio(rows),
    },
    {
      id: 13,
      group: 'C',
      label: '長期負債 / 淨利 < 4',
      priority: false,
      threshold: 'Total Debt / Net Income < 4',
      ...evalLtDebtToNetIncome(rows),
    },
    // ── E2 效率 ─────────────────────────────────────────────────────────────
    {
      id: 14,
      group: 'E2',
      label: '5年 ROE > 15%',
      priority: true,
      threshold: 'ROE > 15% every year',
      ...evalRoe(rows),
    },
    {
      id: 15,
      group: 'E2',
      label: 'Asset Turnover > 同行平均',
      priority: false,
      // v1 fallback: industry avg comparison out of scope; using 0.5 threshold
      threshold: '> 0.5 (v1 fallback; industry avg comparison out of scope)',
      ...evalAssetTurnover(rows),
    },
    {
      id: 16,
      group: 'E2',
      label: 'ROIC > WACC',
      priority: false,
      threshold: `ROIC > ${wacc.toFixed(1)}% (10Y UST + 5%)`,
      note: `WACC simplified as 10Y US Treasury yield + 5% = ${wacc.toFixed(1)}%. For reference only.`,
      ...evalRoicVsWacc(rows, wacc),
    },
  ];

  const score = criteria.filter((c) => c.passed === true).length;
  const priorityScore = criteria.filter((c) => c.priority && c.passed === true).length;

  return {
    symbol: data.symbol,
    score,
    total: 16,
    priorityScore,
    criteria,
    moat,
    risk,
    wacc,
    computedAt: new Date().toISOString(),
  };
};
