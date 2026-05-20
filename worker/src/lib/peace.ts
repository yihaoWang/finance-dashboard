// PEACE framework computation
// WACC simplification: WACC ≈ 10Y US Treasury yield + 5%
// This is an intentional simplification agreed with the user.
// It does not account for capital structure or beta.
// ROIC = NOPAT / Invested Capital where:
//   NOPAT = Operating Income × (1 - effective tax rate)
//   Invested Capital = Total Equity + Total Debt (short + long term)
// Asset Turnover industry average fallback: 0.5 (v1 scope; proper peer grouping is out of scope)

import type { AnnualFinancialRow, FiveYearFinancials, MoatCategory, PeaceBundle, PeaceCriterion, RiskCategory } from '@fd/shared';

// ─── format helpers ───────────────────────────────────────────────────────────

const fmtNTD = (n: number): string => {
  const abs = Math.abs(n);
  if (abs >= 1e12) return `${(n / 1e12).toFixed(2)} 兆`;
  if (abs >= 1e8) return `${(n / 1e8).toFixed(0)} 億`;
  if (abs >= 1e4) return `${(n / 1e4).toFixed(0)} 萬`;
  return n.toFixed(0);
};

const pct = (n: number, dp = 1): string => `${n.toFixed(dp)}%`;

const findWorstYoY = (vals: number[]): { idx: number; yoy: number } | null => {
  if (vals.length < 2) return null;
  let worst = { idx: 1, yoy: Infinity };
  for (let i = 1; i < vals.length; i++) {
    const prev = vals[i - 1];
    if (prev === undefined || prev === 0) continue;
    const yoy = ((vals[i] - prev) / Math.abs(prev)) * 100;
    if (yoy < worst.yoy) worst = { idx: i, yoy };
  }
  return worst.yoy === Infinity ? null : worst;
};

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

const evalRevenueSteady = (rows: AnnualFinancialRow[]): Pick<PeaceCriterion, 'passed' | 'value' | 'detail'> => {
  const compactRows = rows.filter((r) => r.revenue !== null);
  const vals = compactRows.map((r) => r.revenue!);
  if (vals.length < 2) return { passed: null, value: null, detail: '資料不足，無法評估營收穩定性' };
  const declined = hasDeclineBeyond(vals, 10);
  const last = vals[vals.length - 1];
  const prev = vals[vals.length - 2];
  const lastYoy = prev !== undefined && prev !== 0 ? ((last - prev) / Math.abs(prev)) * 100 : null;
  const worst = findWorstYoY(vals);
  let detail: string;
  if (declined && worst !== null) {
    const worstYear = compactRows[worst.idx]?.year;
    const worstVal = vals[worst.idx];
    const worstPrev = vals[worst.idx - 1];
    if (worstYear !== undefined && worstVal !== undefined && worstPrev !== undefined) {
      detail = `${worstYear} 營收 YoY ${pct(worst.yoy)}（${fmtNTD(worstPrev)} → ${fmtNTD(worstVal)}），超過 10% 衰退門檻`;
    } else {
      detail = `存在單年 YoY ${worst !== null ? pct(worst.yoy) : '—'} 衰退，超過 10% 門檻`;
    }
  } else {
    const cagrVal = cagr(vals);
    detail = `5年 CAGR ${cagrVal !== null ? pct(cagrVal) : '—'}；最近 YoY ${lastYoy !== null ? pct(lastYoy) : '—'}，均未衰退超過 10%`;
  }
  return { passed: !declined, value: lastYoy !== undefined ? lastYoy : null, detail };
};

const evalGrossMarginSteady = (rows: AnnualFinancialRow[]): Pick<PeaceCriterion, 'passed' | 'value' | 'detail'> => {
  const compactRows = rows.filter((r) => r.revenue !== null && r.revenue !== 0 && r.grossProfit !== null);
  const margins = compactRows.map((r) => (r.grossProfit! / r.revenue!) * 100);
  if (margins.length < 2) return { passed: null, value: null, detail: '毛利率資料不足，無法評估' };
  const declined = hasDeclineBeyond(margins, 10);
  const worst = findWorstYoY(margins);
  let detail: string;
  if (declined && worst !== null) {
    const worstYear = compactRows[worst.idx]?.year;
    const worstMargin = margins[worst.idx];
    detail = `${worstYear ?? '某年'} 毛利率跌至 ${worstMargin !== undefined ? pct(worstMargin) : '—'}（YoY ${pct(worst.yoy)}），超過 10pp 衰退門檻`;
  } else {
    const lastMargin = margins[margins.length - 1];
    const minMargin = Math.min(...margins);
    detail = `毛利率最低 ${pct(minMargin)}，最近年度 ${lastMargin !== undefined ? pct(lastMargin) : '—'}，均未衰退超過 10pp`;
  }
  return { passed: !declined, value: lastValue(margins), detail };
};

const evalOpIncomeSteady = (rows: AnnualFinancialRow[]): Pick<PeaceCriterion, 'passed' | 'value' | 'detail'> => {
  const compactRows = rows.filter((r) => r.operatingIncome !== null);
  const vals = compactRows.map((r) => r.operatingIncome!);
  if (vals.length < 2) return { passed: null, value: null, detail: '營業利益資料不足，無法評估' };
  const allPos = allPositive(vals.map((v) => v));
  const declined = hasDeclineBeyond(vals, 10);
  const passed = allPos && !declined;
  let detail: string;
  if (!allPos) {
    const negIdx = vals.findIndex((v) => v <= 0);
    const negYear = compactRows[negIdx]?.year;
    const negVal = vals[negIdx];
    detail = `${negYear ?? '某年'} 營業利益 ${negVal !== undefined ? fmtNTD(negVal) : '—'}，跌至負值`;
  } else if (declined) {
    const worst = findWorstYoY(vals);
    if (worst !== null) {
      const worstYear = compactRows[worst.idx]?.year;
      detail = `${worstYear ?? '某年'} 營業利益 YoY ${pct(worst.yoy)}，超過 10% 衰退門檻`;
    } else {
      detail = '存在單年衰退超過 10% 門檻';
    }
  } else {
    const lastOp = lastValue(vals);
    detail = `最近年度營業利益 ${lastOp !== null ? fmtNTD(lastOp) : '—'}，5年均為正且未衰退超過 10%`;
  }
  return { passed, value: lastValue(vals), detail };
};

const evalEpsSteady = (rows: AnnualFinancialRow[]): Pick<PeaceCriterion, 'passed' | 'value' | 'detail'> => {
  // #4 純獲利性檢核：5 年 EPS 皆為正即過關。
  // YoY 衰退另由 #7（5年 EPS 正成長、不衰退）負責，避免雙重扣分。
  const compactRows = rows.filter((r) => r.eps !== null);
  const vals = compactRows.map((r) => r.eps!);
  if (vals.length < 2) return { passed: null, value: null, detail: 'EPS 資料不足，無法評估' };
  const passed = allPositive(vals);
  if (!passed) {
    const negIdx = vals.findIndex((v) => v <= 0);
    const negYear = compactRows[negIdx]?.year;
    return {
      passed,
      value: lastValue(vals),
      detail: `${negYear ?? '某年'} EPS ${vals[negIdx]?.toFixed(2) ?? '—'} 跌至負值`,
    };
  }
  const minEps = Math.min(...vals);
  const minYear = compactRows[vals.indexOf(minEps)]?.year;
  return {
    passed,
    value: lastValue(vals),
    detail: `5年皆獲利；最低 EPS ${minEps.toFixed(2)} (${minYear ?? '—'})`,
  };
};

const evalRevenueCagr = (rows: AnnualFinancialRow[]): Pick<PeaceCriterion, 'passed' | 'value' | 'detail'> => {
  const vals = compact(rows.map((r) => r.revenue));
  const c = cagr(vals);
  if (c === null) return { passed: null, value: null, detail: '營收資料不足，無法計算 CAGR' };
  const detail = c > 0
    ? `5年營收 CAGR ${pct(c)}，持續成長`
    : `5年營收 CAGR ${pct(c)}，未能正成長`;
  return { passed: c > 0, value: c, detail };
};

const evalOpIncomeGrowth = (rows: AnnualFinancialRow[]): Pick<PeaceCriterion, 'passed' | 'value' | 'detail'> => {
  const compactRows = rows.filter((r) => r.operatingIncome !== null);
  const vals = compactRows.map((r) => r.operatingIncome!);
  const c = cagr(vals);
  if (c === null) return { passed: null, value: null, detail: '營業利益資料不足，無法計算 CAGR' };
  const declined = hasDeclineBeyond(vals, 10);
  const passed = c > 0 && !declined;
  let detail: string;
  if (c <= 0) {
    detail = `5年營業利益 CAGR ${pct(c)}，未能正成長`;
  } else if (declined) {
    const worst = findWorstYoY(vals);
    if (worst !== null) {
      const worstYear = compactRows[worst.idx]?.year;
      detail = `CAGR ${pct(c)} 但 ${worstYear ?? '某年'} YoY ${pct(worst.yoy)} 衰退超過 10%`;
    } else {
      detail = `CAGR ${pct(c)} 但存在單年衰退超過 10%`;
    }
  } else {
    detail = `5年營業利益 CAGR ${pct(c)}，無單年衰退超過 10%`;
  }
  return { passed, value: c, detail };
};

const evalEpsGrowth = (rows: AnnualFinancialRow[]): Pick<PeaceCriterion, 'passed' | 'value' | 'detail'> => {
  const compactRows = rows.filter((r) => r.eps !== null);
  const vals = compactRows.map((r) => r.eps!);
  const c = cagr(vals);
  if (c === null) return { passed: null, value: null, detail: 'EPS 資料不足，無法計算 CAGR' };
  const declined = hasDeclineBeyond(vals, 10);
  const passed = c > 0 && !declined;
  let detail: string;
  if (c <= 0) {
    detail = `5年 EPS CAGR ${pct(c)}，未能正成長`;
  } else if (declined) {
    const worst = findWorstYoY(vals);
    if (worst !== null) {
      const worstYear = compactRows[worst.idx]?.year;
      detail = `CAGR ${pct(c)} 但 ${worstYear ?? '某年'} EPS YoY ${pct(worst.yoy)} 衰退超過 10%`;
    } else {
      detail = `CAGR ${pct(c)} 但存在單年衰退超過 10%`;
    }
  } else {
    detail = `5年 EPS CAGR ${pct(c)}，無單年衰退超過 10%`;
  }
  return { passed, value: c, detail };
};

const evalCashFlowPositive = (rows: AnnualFinancialRow[]): Pick<PeaceCriterion, 'passed' | 'value' | 'detail'> => {
  const compactOcfRows = rows.filter((r) => r.ocf !== null);
  const compactFcfRows = rows.filter((r) => r.fcf !== null);
  const ocfVals = compactOcfRows.map((r) => r.ocf!);
  const fcfVals = compactFcfRows.map((r) => r.fcf!);
  if (ocfVals.length < 2 || fcfVals.length < 2) return { passed: null, value: null, detail: 'OCF/FCF 資料不足，無法評估現金流' };
  const ocfAllPos = allPositive(ocfVals.map((v) => v));
  const fcfAllPos = allPositive(fcfVals.map((v) => v));
  const ocfCagrVal = cagr(ocfVals);
  const fcfCagrVal = cagr(fcfVals);
  const ocfGrowing = ocfCagrVal !== null && ocfCagrVal > 0;
  const fcfGrowing = fcfCagrVal !== null && fcfCagrVal > 0;
  const lastOcf = lastValue(ocfVals);
  const passed = ocfAllPos && fcfAllPos && ocfGrowing && fcfGrowing;
  let detail: string;
  if (!ocfAllPos) {
    const negIdx = ocfVals.findIndex((v) => v <= 0);
    const negYear = compactOcfRows[negIdx]?.year;
    const negVal = ocfVals[negIdx];
    detail = `${negYear ?? '某年'} OCF ${negVal !== undefined ? fmtNTD(negVal) : '—'} 轉負`;
  } else if (!fcfAllPos) {
    const negIdx = fcfVals.findIndex((v) => v <= 0);
    const negYear = compactFcfRows[negIdx]?.year;
    const negVal = fcfVals[negIdx];
    detail = `${negYear ?? '某年'} FCF ${negVal !== undefined ? fmtNTD(negVal) : '—'} 轉負`;
  } else if (!ocfGrowing) {
    detail = `OCF 5年 CAGR ${ocfCagrVal !== null ? pct(ocfCagrVal) : '—'}，未能正成長`;
  } else if (!fcfGrowing) {
    detail = `FCF 5年 CAGR ${fcfCagrVal !== null ? pct(fcfCagrVal) : '—'}，未能正成長`;
  } else {
    detail = `OCF 5年 CAGR ${ocfCagrVal !== null ? pct(ocfCagrVal) : '—'}，FCF ${fcfCagrVal !== null ? pct(fcfCagrVal) : '—'}，均為正且成長`;
  }
  return { passed, value: lastOcf, detail };
};

const evalOcfVsOtherCf = (rows: AnnualFinancialRow[]): Pick<PeaceCriterion, 'passed' | 'value' | 'detail'> => {
  const lastRow = rows[rows.length - 1];
  if (lastRow === undefined) return { passed: null, value: null, detail: '現金流資料缺失，無法評估' };
  const { ocf, icf, fcfCf } = lastRow;
  if (ocf === null || icf === null || fcfCf === null) return { passed: null, value: null, detail: 'OCF/ICF/融資現金流資料缺失' };
  // OCF > |financing| + |investing|
  const outflows = Math.abs(icf) + Math.abs(fcfCf);
  const passed = ocf > outflows;
  const year = lastRow.year;
  const detail = passed
    ? `${year} OCF ${fmtNTD(ocf)} > |融資 ${fmtNTD(fcfCf)}| + |投資 ${fmtNTD(icf)}| = ${fmtNTD(outflows)}`
    : `${year} OCF ${fmtNTD(ocf)} < 投融資合計 ${fmtNTD(outflows)}，自由現金流不足`;
  return { passed, value: ocf, detail };
};

const evalEarningsQuality = (rows: AnnualFinancialRow[]): Pick<PeaceCriterion, 'passed' | 'value' | 'detail'> => {
  const lastRow = rows[rows.length - 1];
  if (lastRow === undefined) return { passed: null, value: null, detail: '資料缺失，無法評估收益質量' };
  const { ocf, netIncome } = lastRow;
  if (ocf === null || netIncome === null || netIncome === 0) return { passed: null, value: null, detail: 'OCF 或淨利資料缺失' };
  const ratio = ocf / netIncome;
  const year = lastRow.year;
  const detail = ratio > 0.8
    ? `${year} OCF/淨利比率 ${ratio.toFixed(2)}，賺到的錢大量轉成現金`
    : `${year} OCF/淨利比率 ${ratio.toFixed(2)}，${((1 - ratio) * 100).toFixed(0)}% 淨利未轉成現金，疑似應收帳款積壓`;
  return { passed: ratio > 0.8, value: ratio, detail };
};

const evalDebtToEquity = (rows: AnnualFinancialRow[]): Pick<PeaceCriterion, 'passed' | 'value' | 'detail'> => {
  const lastRow = rows[rows.length - 1];
  if (lastRow === undefined) return { passed: null, value: null, detail: '資產負債資料缺失' };
  const { totalDebt, totalEquity } = lastRow;
  if (totalDebt === null || totalEquity === null || totalEquity === 0) return { passed: null, value: null, detail: '負債或股東權益資料缺失' };
  const de = totalDebt / totalEquity;
  const year = lastRow.year;
  const detail = de < 0.5
    ? `${year} D/E = ${de.toFixed(2)}，財務結構穩健`
    : `${year} D/E = ${de.toFixed(2)}，槓桿偏高`;
  return { passed: de < 0.5, value: de, detail };
};

const evalCurrentRatio = (rows: AnnualFinancialRow[]): Pick<PeaceCriterion, 'passed' | 'value' | 'detail'> => {
  const lastRow = rows[rows.length - 1];
  if (lastRow === undefined) return { passed: null, value: null, detail: '流動資產/負債資料缺失' };
  const { currentAssets, currentLiabilities } = lastRow;
  if (currentAssets === null || currentLiabilities === null || currentLiabilities === 0)
    return { passed: null, value: null, detail: '流動資產或流動負債資料缺失' };
  const ratio = (currentAssets / currentLiabilities) * 100;
  const year = lastRow.year;
  const detail = ratio > 100
    ? `${year} 流動比率 ${ratio.toFixed(0)}%（流動資產為流動負債 ${(ratio / 100).toFixed(1)} 倍），短期償債能力強`
    : `${year} 流動比率 ${ratio.toFixed(0)}%，可能面臨短期償債壓力`;
  return { passed: ratio > 100, value: ratio, detail };
};

const evalLtDebtToNetIncome = (rows: AnnualFinancialRow[]): Pick<PeaceCriterion, 'passed' | 'value' | 'detail'> => {
  // Use total debt as proxy for long-term debt (often no separate LT debt field)
  const lastRow = rows[rows.length - 1];
  if (lastRow === undefined) return { passed: null, value: null, detail: '負債/淨利資料缺失' };
  const { totalDebt, netIncome } = lastRow;
  if (totalDebt === null || netIncome === null || netIncome === 0) return { passed: null, value: null, detail: '總負債或淨利資料缺失' };
  const ratio = totalDebt / netIncome;
  const year = lastRow.year;
  const detail = ratio < 4
    ? `${year} 長期負債 ${fmtNTD(totalDebt)} / 淨利 ${fmtNTD(netIncome)} = ${ratio.toFixed(1)}，${(ratio * 12).toFixed(0)} 個月淨利可清償`
    : `${year} 長期負債 ${fmtNTD(totalDebt)} / 淨利 ${fmtNTD(netIncome)} = ${ratio.toFixed(1)}，超過 4 年淨利`;
  return { passed: ratio < 4, value: ratio, detail };
};

const evalRoe = (rows: AnnualFinancialRow[]): Pick<PeaceCriterion, 'passed' | 'value' | 'detail'> => {
  // Compute ROE for each year: netIncome / totalEquity × 100
  const compactRows = rows.filter((r) => r.netIncome !== null && r.totalEquity !== null && r.totalEquity !== 0);
  const roeVals = compactRows.map((r) => (r.netIncome! / r.totalEquity!) * 100);
  if (roeVals.length === 0) return { passed: null, value: null, detail: 'ROE 計算所需資料缺失' };
  const allAbove15 = allAbove(roeVals.map((v) => v), 15);
  let detail: string;
  if (allAbove15) {
    const minRoe = Math.min(...roeVals);
    const minYear = compactRows[roeVals.indexOf(minRoe)]?.year;
    detail = `5年最低 ROE ${pct(minRoe)} (${minYear ?? '—'})，全期均 ≥ 15%`;
  } else {
    const failIdx = roeVals.findIndex((v) => v <= 15);
    const failYear = compactRows[failIdx]?.year;
    const failRoe = roeVals[failIdx];
    detail = `${failYear ?? '某年'} ROE ${failRoe !== undefined ? pct(failRoe) : '—'}，低於 15% 門檻`;
  }
  return { passed: allAbove15, value: lastValue(roeVals), detail };
};

const evalAssetTurnover = (rows: AnnualFinancialRow[]): Pick<PeaceCriterion, 'passed' | 'value' | 'detail'> => {
  // Asset Turnover = Revenue / Total Assets
  // Industry average comparison is out of scope for v1; fallback threshold = 0.5
  const lastRow = rows[rows.length - 1];
  if (lastRow === undefined) return { passed: null, value: null, detail: '資產/營收資料缺失' };
  const { revenue, totalAssets } = lastRow;
  if (revenue === null || totalAssets === null || totalAssets === 0) return { passed: null, value: null, detail: '總資產或營收資料缺失' };
  const at = revenue / totalAssets;
  const year = lastRow.year;
  const detail = at > 0.5
    ? `${year} 資產周轉率 ${at.toFixed(2)} > 0.5 基準`
    : `${year} 資產周轉率 ${at.toFixed(2)}，低於通用基準 0.5；註：未做產業同儕比較`;
  return { passed: at > 0.5, value: at, detail };
};

const evalRoicVsWacc = (rows: AnnualFinancialRow[], wacc: number): Pick<PeaceCriterion, 'passed' | 'value' | 'detail'> => {
  const lastRow = rows[rows.length - 1];
  if (lastRow === undefined) return { passed: null, value: null, detail: '資料缺失，無法計算 ROIC' };
  const { operatingIncome, incomeTaxExpense, pretaxIncome, totalEquity, totalDebt } = lastRow;
  if (operatingIncome === null) return { passed: null, value: null, detail: '營業利益資料缺失，無法計算 ROIC' };

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
  if (investedCapital === 0) return { passed: null, value: null, detail: '投入資本為 0，無法計算 ROIC' };

  const roic = (nopat / investedCapital) * 100;
  const year = lastRow.year;
  const spread = roic - wacc;
  const detail = roic > wacc
    ? `${year} ROIC ${pct(roic)} > WACC ${pct(wacc)}，創造 ${pct(spread)} 超額報酬`
    : `${year} ROIC ${pct(roic)} < WACC ${pct(wacc)}，未創造價值`;
  return { passed: roic > wacc, value: roic, detail };
};

// ─── main export ─────────────────────────────────────────────────────────────

export const computePeace = (
  data: FiveYearFinancials,
  wacc: number,
  moat: MoatCategory[],
  risk: RiskCategory[],
  reasons: {
    moatReasons?: Record<string, string>;
    riskReasons?: Record<string, string>;
    moatNote?: string | null;
    riskNote?: string | null;
  } = {},
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
      label: '5年 EPS 皆為正',
      priority: true,
      threshold: 'EPS > 0（5年皆獲利）',
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
    moatReasons: reasons.moatReasons ?? {},
    riskReasons: reasons.riskReasons ?? {},
    moatNote: reasons.moatNote ?? null,
    riskNote: reasons.riskNote ?? null,
    wacc,
    computedAt: new Date().toISOString(),
  };
};
