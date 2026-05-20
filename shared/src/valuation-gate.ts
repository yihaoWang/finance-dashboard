// Shared valuation override logic.
// Used by both the per-stock decision panel (PeacePanel) and the screener
// to keep gating thresholds consistent.
//
// Strategy: peer-relative comparison in priority order
//   1. industry PE  (most fair — same sector cohort)
//   2. self 5Y avg  (fallback — own historical baseline)
//   3. PEG          (last resort — growth-normalized)
// Absolute PE thresholds (e.g. PE > 30) aren't used because reasonable PE varies
// hugely across industries (banks ~10, semi ~30).

export type ValuationGateInput = {
  currentPe: number | null;
  industryPe: number | null;
  pe5yAvg: number | null;
  peg: number | null;
};

export type ValuationGate = {
  downgrade: 'none' | 'watch' | 'fail';
  note: string | null;
  // Numeric severity used by screener to scale score penalty.
  // 0 = no concern, 1 = watch (1.5×), 2 = fail (2.0×).
  severity: 0 | 1 | 2;
};

export const computeValuationGate = (v: ValuationGateInput): ValuationGate => {
  const pe = v.currentPe;
  if (pe === null || pe <= 0) return { downgrade: 'none', note: null, severity: 0 };

  const fmt = (n: number) => n.toFixed(1);

  if (v.industryPe !== null && v.industryPe > 0) {
    const ratio = pe / v.industryPe;
    if (ratio >= 2.0) {
      return {
        downgrade: 'fail',
        note: `⚠ 估值否決：PE ${fmt(pe)} 為產業 PE ${fmt(v.industryPe)} 之 ${ratio.toFixed(1)}×，超過 2.0× 上限`,
        severity: 2,
      };
    }
    if (ratio >= 1.5) {
      return {
        downgrade: 'watch',
        note: `⚠ 估值偏貴：PE ${fmt(pe)} 為產業 PE ${fmt(v.industryPe)} 之 ${ratio.toFixed(1)}×，建議等回檔`,
        severity: 1,
      };
    }
    return { downgrade: 'none', note: null, severity: 0 };
  }

  if (v.pe5yAvg !== null && v.pe5yAvg > 0) {
    const ratio = pe / v.pe5yAvg;
    if (ratio >= 2.0) {
      return {
        downgrade: 'fail',
        note: `⚠ 估值否決：PE ${fmt(pe)} 為 5Y 均 ${fmt(v.pe5yAvg)} 之 ${ratio.toFixed(1)}×（無產業對照可用）`,
        severity: 2,
      };
    }
    if (ratio >= 1.5) {
      return {
        downgrade: 'watch',
        note: `⚠ 估值偏貴：PE ${fmt(pe)} 為 5Y 均 ${fmt(v.pe5yAvg)} 之 ${ratio.toFixed(1)}×，建議等回檔`,
        severity: 1,
      };
    }
    return { downgrade: 'none', note: null, severity: 0 };
  }

  if (v.peg !== null) {
    if (v.peg >= 3) {
      return {
        downgrade: 'fail',
        note: `⚠ 估值否決：PEG ${v.peg.toFixed(2)} ≥ 3（無產業與 5Y 對照）`,
        severity: 2,
      };
    }
    if (v.peg >= 2) {
      return {
        downgrade: 'watch',
        note: `⚠ 估值偏貴：PEG ${v.peg.toFixed(2)} ≥ 2，建議等回檔`,
        severity: 1,
      };
    }
  }

  return {
    downgrade: 'none',
    note: '無估值對照資料，請自行判斷價格合理性',
    severity: 0,
  };
};
