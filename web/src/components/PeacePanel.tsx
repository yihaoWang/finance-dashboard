import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { usePeace } from '../hooks/usePeace';
import { useValuation } from '../hooks/useValuation';
import { postPeaceTags } from '../lib/api';
import type { MoatCategory, PeaceBundle, PeaceCriterion, RiskCategory, ValuationBundle } from '@fd/shared';
import { SectionCard } from './SectionCard';

const ALL_MOAT: MoatCategory[] = ['無形資產', '成本優勢', '網路效應', '高轉換成本', '有效規模'];
const ALL_RISK: RiskCategory[] = ['R 監管風險', 'I 通脹風險', 'S 科技風險', 'K 關鍵人物風險'];

const RISK_KEY_LABEL: Record<string, string> = {
  'R 監管風險': 'R 監管風險',
  'I 通脹風險': 'I 通膨風險（定價能力）',
  'S 科技風險': 'S 科技風險',
  'K 關鍵人物風險': 'K 關鍵人物風險',
};

const MOAT_DETAIL: Record<string, string> = {
  '無形資產': '品牌、專利、特許權等難以複製的優勢',
  '成本優勢': '規模經濟、獨家資源帶來的低成本',
  '網路效應': '用戶越多產品價值越高',
  '高轉換成本': '客戶離開要付出大量金錢／時間／學習成本',
  '有效規模': '利基市場中市場空間僅容納一兩家公司',
};

const RISK_DETAIL: Record<string, string> = {
  'R 監管風險': '政策、反壟斷或新法規帶來的負面影響',
  'I 通脹風險': '物料漲價時公司是否有定價能力轉嫁',
  'S 科技風險': '新技術讓現有產品或商業模式過時',
  'K 關鍵人物風險': '依賴創辦人／CEO，更替時營運會崩潰',
};

type Verdict = 'pass' | 'watch' | 'fail';

const VERDICT_SYMBOL: Record<Verdict, string> = { pass: 'V', watch: '△', fail: 'X' };
const VERDICT_CLASS: Record<Verdict, string> = {
  pass: 'text-emerald-400',
  watch: 'text-amber-400',
  fail: 'text-red-400',
};

const verdictFromPassed = (passed: boolean | null): Verdict =>
  passed === true ? 'pass' : passed === false ? 'fail' : 'watch';

const fmtNum = (v: number | null, digits = 2): string =>
  v === null ? '—' : v.toFixed(digits);

// ----- Tag edit modal -----
type TagEditModalProps = {
  symbol: string;
  kind: 'moat' | 'risk';
  current: string[];
  onClose: () => void;
};

const TagEditModal = ({ symbol, kind, current, onClose }: TagEditModalProps) => {
  const queryClient = useQueryClient();
  const options = kind === 'moat' ? ALL_MOAT : ALL_RISK;
  const [selected, setSelected] = useState<string[]>(current);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const toggle = (v: string) =>
    setSelected((prev) => (prev.includes(v) ? prev.filter((x) => x !== v) : [...prev, v]));

  const handleSave = async () => {
    setSaving(true);
    setSaveError(null);
    try {
      await postPeaceTags(symbol, kind, selected);
      await queryClient.invalidateQueries({ queryKey: ['peace', symbol] });
      onClose();
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : '儲存失敗');
    } finally {
      setSaving(false);
    }
  };

  const label = kind === 'moat' ? '護城河' : 'RISK';

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50" onClick={onClose}>
      <div
        className="bg-white border border-slate-300 rounded-xl p-6 min-w-[300px] shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="text-sm font-semibold text-slate-800 mb-4">編輯 {label}</h3>
        <div className="space-y-2">
          {options.map((opt) => (
            <label key={opt} className="flex items-center gap-2 cursor-pointer text-sm text-slate-700">
              <input
                type="checkbox"
                checked={selected.includes(opt)}
                onChange={() => toggle(opt)}
                className="accent-emerald-500"
              />
              {opt}
            </label>
          ))}
        </div>
        {saveError !== null && <p className="mt-3 text-xs text-red-400">{saveError}</p>}
        <div className="flex gap-2 mt-5">
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="flex-1 bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-400 text-xs font-semibold py-1.5 rounded disabled:opacity-50"
          >
            {saving ? '儲存中…' : '儲存'}
          </button>
          <button
            type="button"
            onClick={onClose}
            className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-600 text-xs py-1.5 rounded"
          >
            取消
          </button>
        </div>
      </div>
    </div>
  );
};

// ----- Decision logic -----
type DecisionDetail = {
  label: string;
  verdict: Verdict;
  oneLine: string;
  groupScores: { group: string; passed: number; total: number }[];
  strengths: PeaceCriterion[];
  weaknesses: PeaceCriterion[];
  moatCount: number;
  riskCount: number;
  rationale: string;
};

const GROUP_KEYS = ['P', 'E', 'A', 'C', 'E2'] as const;
const GROUP_DISPLAY: Record<string, string> = {
  P: 'P 盈利',
  E: 'E 增長',
  A: 'A 現金',
  C: 'C 安全',
  E2: 'E 效率',
};

const buildDecision = (bundle: PeaceBundle): DecisionDetail => {
  const { score, total, priorityScore, criteria, moat, risk } = bundle;

  const groupScores = GROUP_KEYS.map((g) => {
    const items = criteria.filter((c) => c.group === g);
    return {
      group: GROUP_DISPLAY[g] ?? g,
      passed: items.filter((c) => c.passed === true).length,
      total: items.length,
    };
  });

  // Strengths: passed priority items first, then other passed; cap 4
  const strengths = [
    ...criteria.filter((c) => c.passed === true && c.priority),
    ...criteria.filter((c) => c.passed === true && !c.priority),
  ].slice(0, 4);

  // Weaknesses: failed priority items first, then other failed; cap 4
  const weaknesses = [
    ...criteria.filter((c) => c.passed === false && c.priority),
    ...criteria.filter((c) => c.passed === false && !c.priority),
  ].slice(0, 4);

  const moatCount = moat.length;
  const riskCount = risk.length;

  let label: string;
  let verdict: Verdict;
  let rationale: string;
  if (priorityScore >= 5 && score >= 11) {
    label = '買入';
    verdict = 'pass';
    rationale =
      `核心 6 項中過 ${priorityScore} 項、整體 ${score}/${total} 達買入門檻（核心 ≥5 且總分 ≥11）。` +
      (moatCount > 0 ? `具備 ${moatCount} 項護城河。` : '建議補登護城河 tag 加強質化判斷。') +
      (riskCount > 0 ? `留意 ${riskCount} 項主要風險。` : '');
  } else if (score >= 8) {
    label = '觀望';
    verdict = 'watch';
    const missingPriority = 6 - priorityScore;
    rationale =
      `總分 ${score}/${total} 達觀望門檻但未達買入（核心 ${priorityScore}/6，距買入差 ${Math.max(0, 5 - priorityScore)} 核心 + ${Math.max(0, 11 - score)} 總分）。` +
      (missingPriority > 0 ? `關注核心未達項是否轉好。` : '');
  } else {
    label = '不碰';
    verdict = 'fail';
    rationale =
      `總分僅 ${score}/${total}，核心過關項僅 ${priorityScore}/6，基本面偏弱不建議介入。` +
      (riskCount > 0 ? `另有 ${riskCount} 項風險。` : '');
  }

  return {
    label,
    verdict,
    oneLine: `核心 ${priorityScore}/6 · 總分 ${score}/${total}`,
    groupScores,
    strengths,
    weaknesses,
    moatCount,
    riskCount,
    rationale,
  };
};

// ----- Row types -----
type DataRow = {
  no: number | null;
  label: string;
  verdict: Verdict;
  value: string;
  threshold?: string;
  detail?: string;
};

type Section = {
  section: string;
  group: string;
  rows: DataRow[];
};

const tagRows = (
  kind: 'moat' | 'risk',
  all: readonly string[],
  active: string[],
  startNo: number,
  reasons: Record<string, string> = {},
): DataRow[] =>
  all.map((label, i) => {
    const hit = active.includes(label);
    const display = kind === 'risk' ? (RISK_KEY_LABEL[label] ?? label) : label;
    const genericDetail =
      kind === 'moat' ? (MOAT_DETAIL[label] ?? '') : (RISK_DETAIL[label] ?? '');
    // Prefer per-stock reason when tag is active; fall back to generic definition.
    const detail = hit && reasons[label] !== undefined && reasons[label] !== ''
      ? reasons[label]
      : genericDetail;
    const value =
      kind === 'moat' ? (hit ? '具備' : '未具備') : hit ? '有風險' : '無風險';
    return {
      no: startNo + i,
      label: display,
      verdict: kind === 'moat' ? (hit ? 'pass' : 'fail') : hit ? 'fail' : 'pass',
      value,
      detail,
    };
  });

const criterionToRow = (c: PeaceCriterion): DataRow => ({
  no: c.id,
  label: c.label,
  verdict: verdictFromPassed(c.passed),
  value: c.value === null ? '—' : fmtNum(c.value),
  threshold: c.threshold,
  detail: c.detail,
});

// ----- Main panel -----
type Props = { symbol: string };

const GROUP_LABEL: Record<string, string> = {
  P: 'P 盈利',
  E: 'E 增長',
  A: 'A 現金',
  C: 'C 保守與安全性',
  E2: 'E 效率與經營能力',
};

const valuationRows = (v: ValuationBundle | null): DataRow[] => {
  const pe = v?.currentPe ?? null;
  const fpe = v?.forwardPe ?? null;
  const peg = v?.peg ?? null;
  const avg5y = v?.pe5yAvg ?? null;
  const low5y = v?.pe5yLow ?? null;
  const ind = v?.industryPe ?? null;

  const peVerdict: Verdict =
    pe === null ? 'watch' : pe < 18 ? 'pass' : pe > 30 ? 'fail' : 'watch';
  // Forward PE 比目前 PE 低代表市場預期 EPS 將上升，視為正面
  const fpeVerdict: Verdict =
    fpe === null
      ? 'watch'
      : pe === null
        ? fpe < 20
          ? 'pass'
          : fpe > 30
            ? 'fail'
            : 'watch'
        : fpe < pe
          ? 'pass'
          : fpe > pe * 1.1
            ? 'fail'
            : 'watch';

  const avg5yVerdict: Verdict =
    pe !== null && avg5y !== null ? (pe < avg5y ? 'pass' : pe > avg5y * 1.2 ? 'fail' : 'watch') : 'watch';
  const low5yVerdict: Verdict =
    pe !== null && low5y !== null ? (pe < low5y * 1.1 ? 'pass' : 'watch') : 'watch';
  const pegVerdict: Verdict =
    peg === null ? 'watch' : peg < 1 ? 'pass' : peg > 2 ? 'fail' : 'watch';

  return [
    {
      no: null,
      label: '過去 5 年本益比平均',
      verdict: avg5yVerdict,
      value: avg5y === null ? '—' : avg5y.toFixed(2),
      detail:
        avg5y === null
          ? '無 5 年 EPS 或年末股價資料'
          : pe !== null && pe < avg5y
            ? `目前 PE ${pe.toFixed(1)} < 5 年均值 ${avg5y.toFixed(1)}，相對便宜`
            : pe !== null && pe > avg5y * 1.2
              ? `目前 PE ${pe.toFixed(1)} > 5 年均值 ${avg5y.toFixed(1)} 20% 以上，相對偏貴`
              : `5 年 PE 均值 ${avg5y.toFixed(1)}`,
    },
    {
      no: null,
      label: '所處產業本益比',
      verdict: 'watch',
      value: ind === null ? '—' : ind.toFixed(2),
      detail: ind === null ? '尚未建立產業 PE 對照表' : '同業平均',
    },
    {
      no: null,
      label: '目前本益比 (TTM)',
      verdict: peVerdict,
      value: pe === null ? '—' : pe.toFixed(2),
      detail:
        pe === null
          ? '無資料'
          : pe < 18
            ? '本益比 < 18，估值偏低'
            : pe > 30
              ? '本益比 > 30，估值偏高'
              : '本益比落在合理區間',
    },
    {
      no: null,
      label: 'Forward PE (估)',
      verdict: fpeVerdict,
      value: fpe === null ? '—' : fpe.toFixed(2),
      detail:
        fpe === null
          ? '無資料'
          : pe !== null && fpe < pe
            ? `Forward PE 估 ${fpe.toFixed(1)} < 目前 PE ${pe.toFixed(1)}，依 EPS CAGR 推估獲利會成長`
            : pe !== null && fpe > pe * 1.1
              ? `Forward PE 估 ${fpe.toFixed(1)} > 目前 PE ${pe.toFixed(1)}，依 EPS 趨勢獲利預期下滑`
              : '依 5 年 EPS CAGR 推估',
    },
    {
      no: null,
      label: '過去 5 年最低 PE',
      verdict: low5yVerdict,
      value: low5y === null ? '—' : low5y.toFixed(2),
      detail:
        low5y === null
          ? '需 5 年 EPS 或年末股價資料'
          : pe !== null && pe < low5y * 1.1
            ? `目前 PE 接近 5 年地板 ${low5y.toFixed(1)}，極具安全邊際`
            : `5 年地板 ${low5y.toFixed(1)}（15 年資料需另外建立）`,
    },
    {
      no: null,
      label: 'PEG < 1',
      verdict: pegVerdict,
      value: peg === null ? '—' : peg.toFixed(2),
      detail:
        peg === null
          ? '無資料（Yahoo 對部分台股不提供 PEG）'
          : peg < 1
            ? `PEG ${peg.toFixed(2)} < 1，成長相對於估值便宜`
            : peg > 2
              ? `PEG ${peg.toFixed(2)} > 2，成長無法支撐估值`
              : `PEG ${peg.toFixed(2)}`,
    },
  ];
};

export const PeacePanel = ({ symbol }: Props) => {
  const { data, isLoading, error } = usePeace(symbol);
  const { data: valuationData } = useValuation(symbol);
  const [editModal, setEditModal] = useState<'moat' | 'risk' | null>(null);

  if (isLoading) return <div className="text-slate-600 text-sm py-4">載入 PEACE 評分中…</div>;
  if (error) return <div className="text-red-400 text-xs py-2">PEACE 評分載入失敗：{error.message}</div>;
  if (!data) return null;

  const bundle = data.data;
  const decision = buildDecision(bundle);

  const criteriaByGroup = (g: string) => bundle.criteria.filter((c) => c.group === g);

  const sections: Section[] = [
    {
      section: '質化優勢分析',
      group: '護城河',
      rows: [
        ...(bundle.moatNote !== null && bundle.moatNote !== ''
          ? [{ no: null, label: '🔍 Claude 整體判斷', verdict: 'watch' as Verdict, value: '—', detail: bundle.moatNote }]
          : []),
        ...tagRows('moat', ALL_MOAT, bundle.moat, 1, bundle.moatReasons),
      ],
    },
    {
      section: '質化風險分析',
      group: 'RISK',
      rows: [
        ...(bundle.riskNote !== null && bundle.riskNote !== ''
          ? [{ no: null, label: '🔍 Claude 整體判斷', verdict: 'watch' as Verdict, value: '—', detail: bundle.riskNote }]
          : []),
        ...tagRows('risk', ALL_RISK, bundle.risk, 6, bundle.riskReasons),
      ],
    },
    { section: '量化風險潛力分析', group: GROUP_LABEL.P!, rows: criteriaByGroup('P').map(criterionToRow) },
    { section: '量化風險潛力分析', group: GROUP_LABEL.E!, rows: criteriaByGroup('E').map(criterionToRow) },
    { section: '量化風險潛力分析', group: GROUP_LABEL.A!, rows: criteriaByGroup('A').map(criterionToRow) },
    { section: '量化風險潛力分析', group: GROUP_LABEL.C!, rows: criteriaByGroup('C').map(criterionToRow) },
    { section: '量化風險潛力分析', group: GROUP_LABEL.E2!, rows: criteriaByGroup('E2').map(criterionToRow) },
    {
      section: '估值',
      group: 'PE / PEG / 公允價值',
      rows: valuationRows(valuationData?.data ?? null),
    },
  ];

  // Build a flat row list with rowspan info per section/group
  type FlatRow = {
    key: string;
    section: string | null;
    sectionSpan: number;
    group: string | null;
    groupSpan: number;
    row: DataRow;
  };

  const flat: FlatRow[] = [];
  let sectionCounts = new Map<string, number>();
  for (const s of sections) {
    sectionCounts.set(s.section, (sectionCounts.get(s.section) ?? 0) + s.rows.length);
  }
  const seenSection = new Set<string>();
  for (const s of sections) {
    const sectionSpan = sectionCounts.get(s.section) ?? 0;
    const groupSpan = s.rows.length;
    s.rows.forEach((row, idx) => {
      const isSectionStart = !seenSection.has(s.section);
      if (isSectionStart) seenSection.add(s.section);
      flat.push({
        key: `${s.section}-${s.group}-${row.no ?? idx}-${row.label}`,
        section: isSectionStart ? s.section : null,
        sectionSpan: isSectionStart ? sectionSpan : 0,
        group: idx === 0 ? s.group : null,
        groupSpan: idx === 0 ? groupSpan : 0,
        row,
      });
    });
  }

  return (
    <>
    <SectionCard
      title="企業體質檢核"
      subtitle={symbol}
      storageKey="peace"
      bodyPadding="none"
      actions={
        <div className="flex items-center gap-4 text-xs">
          <button
            type="button"
            onClick={() => setEditModal('moat')}
            className="text-slate-600 hover:text-slate-900"
          >
            編輯護城河
          </button>
          <button
            type="button"
            onClick={() => setEditModal('risk')}
            className="text-slate-600 hover:text-slate-900"
          >
            編輯 RISK
          </button>
          <span className="text-slate-600">
            得分 <span className="text-slate-900 font-semibold">{bundle.score}/{bundle.total}</span>
            <span className="text-slate-500 mx-1">·</span>
            核心 <span className="text-slate-900">{bundle.priorityScore}/6</span>
          </span>
        </div>
      }
    >
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead className="text-[11px] text-slate-600 bg-slate-100/60 border-b border-slate-200">
            <tr>
              <th className="text-left px-3 py-2 font-medium w-32">分析面向</th>
              <th className="text-left px-3 py-2 font-medium w-28">分類</th>
              <th className="text-center px-2 py-2 font-medium w-8">#</th>
              <th className="text-left px-3 py-2 font-medium">項目</th>
              <th className="text-center px-3 py-2 font-medium w-12">符合</th>
              <th className="text-right px-3 py-2 font-medium w-24">數據</th>
              <th className="text-left px-3 py-2 font-medium">說明</th>
            </tr>
          </thead>
          <tbody>
            {flat.map((f) => (
              <tr key={f.key} className="border-b border-slate-200/50 hover:bg-slate-100/20">
                {f.section !== null && (
                  <td
                    rowSpan={f.sectionSpan}
                    className="px-3 py-2 align-top text-slate-700 font-medium border-r border-slate-200 bg-slate-100/60"
                  >
                    {f.section}
                  </td>
                )}
                {f.group !== null && (
                  <td
                    rowSpan={f.groupSpan}
                    className="px-3 py-2 align-top text-slate-600 border-r border-slate-200"
                  >
                    {f.group}
                  </td>
                )}
                <td className="px-2 py-1.5 text-center text-slate-600 tabular-nums">
                  {f.row.no ?? ''}
                </td>
                <td className="px-3 py-1.5 text-slate-700">{f.row.label}</td>
                <td
                  className={`px-3 py-1.5 text-center font-bold ${VERDICT_CLASS[f.row.verdict]}`}
                >
                  {VERDICT_SYMBOL[f.row.verdict]}
                </td>
                <td className="px-3 py-1.5 text-right text-slate-700 tabular-nums">
                  {f.row.value}
                  {f.row.threshold !== undefined && (
                    <span className="text-slate-500"> ({f.row.threshold})</span>
                  )}
                </td>
                <td className="px-3 py-1.5 text-slate-600 text-[11px] leading-snug">
                  {f.row.detail ?? ''}
                </td>
              </tr>
            ))}
            <tr className="bg-slate-50 border-t-2 border-slate-300">
              <td
                colSpan={4}
                className="px-3 py-3 text-slate-700 font-medium border-r border-slate-200"
              >
                決策（買入、觀望、不碰）
              </td>
              <td
                className={`px-3 py-3 text-center font-bold text-base ${VERDICT_CLASS[decision.verdict]}`}
              >
                {VERDICT_SYMBOL[decision.verdict]}
              </td>
              <td className={`px-3 py-3 font-semibold ${VERDICT_CLASS[decision.verdict]}`}>
                {decision.label}
              </td>
              <td className="px-3 py-3 text-slate-600 text-[11px]">{decision.oneLine}</td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* Decision panel — verdict hero + two-column pros/cons */}
      {(() => {
        const coreGap = Math.max(0, 5 - bundle.priorityScore);
        const totalGap = Math.max(0, 11 - bundle.score);
        const verdictTone =
          decision.verdict === 'pass'
            ? {
                ring: 'ring-emerald-500/40 bg-emerald-500/10 border-emerald-500/30',
                accent: 'text-emerald-400',
              }
            : decision.verdict === 'watch'
              ? {
                  ring: 'ring-amber-500/40 bg-amber-500/10 border-amber-500/30',
                  accent: 'text-amber-400',
                }
              : {
                  ring: 'ring-red-500/40 bg-red-500/10 border-red-500/30',
                  accent: 'text-red-400',
                };
        return (
          <div className="border-t border-slate-200 bg-slate-100/60 px-4 py-5">
            {/* Hero header: verdict pill + PEACE strip + gap indicator */}
            <div className="grid grid-cols-1 lg:grid-cols-[auto_1fr_auto] gap-4 items-stretch mb-4">
              <div
                className={`rounded-xl border ring-1 ${verdictTone.ring} px-5 py-3 flex items-center gap-4 min-w-[200px]`}
              >
                <div className={`text-4xl font-bold leading-none ${verdictTone.accent}`}>
                  {VERDICT_SYMBOL[decision.verdict]}
                </div>
                <div>
                  <div className={`text-xl font-bold leading-tight ${verdictTone.accent}`}>
                    {decision.label}
                  </div>
                  <div className="text-[11px] text-slate-600 tabular-nums mt-0.5">
                    核心 {bundle.priorityScore}/6 · 總分 {bundle.score}/{bundle.total}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-5 gap-2">
                {decision.groupScores.map((g) => {
                  const pct = g.total === 0 ? 0 : (g.passed / g.total) * 100;
                  const color =
                    pct >= 80 ? 'bg-emerald-500' : pct >= 50 ? 'bg-amber-500' : 'bg-red-500';
                  const letter = g.group.charAt(0);
                  return (
                    <div
                      key={g.group}
                      className="rounded-lg bg-slate-100/60 border border-slate-200 px-2 py-2 flex flex-col items-center justify-between gap-1.5"
                    >
                      <div className="flex items-baseline gap-1">
                        <span className="text-base font-bold text-slate-800">{letter}</span>
                        <span className="text-[10px] text-slate-600 tabular-nums">
                          {g.passed}/{g.total}
                        </span>
                      </div>
                      <div className="w-full h-1.5 bg-slate-100 rounded overflow-hidden">
                        <div className={`h-full ${color}`} style={{ width: `${pct}%` }} />
                      </div>
                      <span className="text-[10px] text-slate-600 truncate w-full text-center">
                        {g.group.slice(2) || letter}
                      </span>
                    </div>
                  );
                })}
              </div>

              <div className="flex flex-col justify-center text-right min-w-[120px]">
                {decision.verdict === 'pass' ? (
                  <span className={`text-xs font-medium ${verdictTone.accent}`}>已達買入門檻</span>
                ) : (
                  <>
                    <span className="text-[10px] text-slate-600">距買入</span>
                    <span className="text-sm text-slate-700 tabular-nums">
                      +{coreGap} 核心 / +{totalGap} 總分
                    </span>
                  </>
                )}
              </div>
            </div>

            {/* Rationale single line */}
            <p className="text-xs text-slate-700 leading-relaxed mb-4">{decision.rationale}</p>

            {/* Two-column pros/cons */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/[0.04] p-3">
                <h4 className="text-[11px] font-semibold text-emerald-400 mb-2 flex items-baseline gap-1.5">
                  <span>✓ 主要優勢</span>
                  <span className="text-slate-600 font-normal tabular-nums">
                    ({decision.strengths.length})
                  </span>
                </h4>
                {decision.strengths.length === 0 ? (
                  <p className="text-[11px] text-slate-500 italic">無</p>
                ) : (
                  <ul className="space-y-1.5">
                    {decision.strengths.map((c) => (
                      <li key={c.id} className="text-[11px] text-slate-700 flex gap-1.5">
                        <span className="text-emerald-500 shrink-0 mt-px">▸</span>
                        <span className="leading-snug">
                          <span className="text-slate-600 tabular-nums">#{c.id}</span>{' '}
                          <span className="text-slate-800">{c.label}</span>
                          <span className="text-slate-600"> — {c.detail}</span>
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              <div className="rounded-lg border border-red-500/20 bg-red-500/[0.04] p-3">
                <h4 className="text-[11px] font-semibold text-red-400 mb-2 flex items-baseline gap-1.5">
                  <span>✗ 主要疑慮</span>
                  <span className="text-slate-600 font-normal tabular-nums">
                    ({decision.weaknesses.length})
                  </span>
                  <span className="text-slate-500 font-normal text-[10px]">
                    ★ = 核心未過
                  </span>
                </h4>
                {decision.weaknesses.length === 0 ? (
                  <p className="text-[11px] text-slate-500 italic">無</p>
                ) : (
                  <ul className="space-y-1.5">
                    {decision.weaknesses.map((c) => (
                      <li key={c.id} className="text-[11px] text-slate-700 flex gap-1.5">
                        <span className={`shrink-0 mt-px ${c.priority ? 'text-amber-400' : 'text-red-500'}`}>
                          {c.priority ? '★' : '▸'}
                        </span>
                        <span className="leading-snug">
                          <span className="text-slate-600 tabular-nums">#{c.id}</span>{' '}
                          <span className="text-slate-800">{c.label}</span>
                          <span className="text-slate-600"> — {c.detail}</span>
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>

            {/* Footer chip row: moat / risk on left, WACC + timestamp on right */}
            <div className="flex flex-wrap items-center justify-between gap-2 mt-4 pt-3 border-t border-slate-200 text-[11px]">
              <div className="flex flex-wrap items-center gap-2">
                <span
                  className={`rounded-md px-2 py-0.5 border ${
                    decision.moatCount > 0
                      ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
                      : 'bg-white border-slate-200 text-slate-600'
                  }`}
                >
                  護城河 · {decision.moatCount > 0 ? `${decision.moatCount} 項` : '尚未標記'}
                </span>
                <span
                  className={`rounded-md px-2 py-0.5 border ${
                    decision.riskCount > 0
                      ? 'bg-amber-500/10 border-amber-500/30 text-amber-300'
                      : 'bg-white border-slate-200 text-slate-600'
                  }`}
                >
                  風險 · {decision.riskCount > 0 ? `${decision.riskCount} 項` : '尚未標記'}
                </span>
              </div>
              <div className="text-slate-500 tabular-nums">
                WACC {bundle.wacc.toFixed(1)}% （10Y 美債 + 5%）
                <span className="mx-2">·</span>
                {new Date(bundle.computedAt).toLocaleString('zh-TW')}
              </div>
            </div>
          </div>
        );
      })()}
    </SectionCard>
    {editModal === 'moat' && (
      <TagEditModal
        symbol={symbol}
        kind="moat"
        current={bundle.moat}
        onClose={() => setEditModal(null)}
      />
    )}
    {editModal === 'risk' && (
      <TagEditModal
        symbol={symbol}
        kind="risk"
        current={bundle.risk}
        onClose={() => setEditModal(null)}
      />
    )}
    </>
  );
};
