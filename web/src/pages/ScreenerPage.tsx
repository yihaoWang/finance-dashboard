import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { TopNav } from '../components/TopNav';
import { useScreener } from '../hooks/useScreener';
import type { ScreenerRow, StyleTag } from '@fd/shared';

import type { UseUserPrefs } from '../hooks/useUserPrefs';

type Props = { prefs: UseUserPrefs };

// ───── Filter shape ─────
type SortKey = 'weighted' | 'priority' | 'pe' | 'yield' | 'roe' | 'eps_cagr';
type ValuationKey = 'peBelowAvg' | 'peUnder30' | 'forwardLowerThanCurrent' | 'pegUnder1' | 'nearFiveYearLow';

type Filters = {
  styleTags: Set<StyleTag>;
  criteriaRequired: Set<string>;          // id "1".."16" → must pass
  moatsRequired: Set<string>;             // moat name → must possess
  risksExcluded: Set<string>;             // risk name → must NOT possess
  valuation: Set<ValuationKey>;           // derived valuation checks
  sort: SortKey;
};

const DEFAULT_FILTERS: Filters = {
  styleTags: new Set(),
  criteriaRequired: new Set(),
  moatsRequired: new Set(),
  risksExcluded: new Set(),
  valuation: new Set(),
  sort: 'weighted',
};

// ───── Static metadata mirroring PEACE table ─────
const MOATS = ['無形資產', '成本優勢', '網路效應', '高轉換成本', '有效規模'];
const RISKS = ['R 監管風險', 'I 通脹風險', 'S 科技風險', 'K 關鍵人物風險'];

type Criterion = { id: string; label: string };
type Group = { key: string; title: string; mode: 'criterion' | 'moat' | 'risk' | 'valuation'; items: Criterion[] };

const GROUPS: Group[] = [
  {
    key: 'moat',
    title: '護城河（必須具備）',
    mode: 'moat',
    items: MOATS.map((m) => ({ id: m, label: m })),
  },
  {
    key: 'risk',
    title: '風險（必須沒有）',
    mode: 'risk',
    items: RISKS.map((r) => ({ id: r, label: r })),
  },
  {
    key: 'P',
    title: 'P 盈利',
    mode: 'criterion',
    items: [
      { id: '1', label: '5年總營收正成長、不衰退' },
      { id: '2', label: '5年毛利率正成長/維持、不衰退' },
      { id: '3', label: '5年營業利益為正、不衰退' },
      { id: '4', label: '5年 EPS 皆為正' },
    ],
  },
  {
    key: 'E',
    title: 'E 增長',
    mode: 'criterion',
    items: [
      { id: '5', label: '5年總營收正成長' },
      { id: '6', label: '5年營業利益正成長、不衰退' },
      { id: '7', label: '5年 EPS 正成長、不衰退' },
    ],
  },
  {
    key: 'A',
    title: 'A 現金',
    mode: 'criterion',
    items: [
      { id: '8', label: '營運/自由現金流持續增加且為正' },
      { id: '9', label: '營運現金流 > 融資 + 投資現金流' },
      { id: '10', label: '收益質量 OCF/淨利 > 0.8' },
    ],
  },
  {
    key: 'C',
    title: 'C 保守與安全',
    mode: 'criterion',
    items: [
      { id: '11', label: 'D/E ratio < 0.5' },
      { id: '12', label: '流動比率 > 100%' },
      { id: '13', label: '長期負債 / 淨利 < 4' },
    ],
  },
  {
    key: 'E2',
    title: 'E 效率與經營能力',
    mode: 'criterion',
    items: [
      { id: '14', label: '5年 ROE > 15%' },
      { id: '15', label: 'Asset Turnover > 同行平均' },
      { id: '16', label: 'ROIC > WACC' },
    ],
  },
  {
    key: 'val',
    title: '估值',
    mode: 'valuation',
    items: [
      { id: 'peBelowAvg', label: '目前 PE < 5 年均值（便宜）' },
      { id: 'peUnder30', label: '目前 PE < 30' },
      { id: 'forwardLowerThanCurrent', label: 'Forward PE < 目前 PE（獲利會增）' },
      { id: 'pegUnder1', label: 'PEG < 1' },
      { id: 'nearFiveYearLow', label: '接近 5 年最低 PE（地板價）' },
    ],
  },
];

const STYLE_LABELS: Record<StyleTag, { emoji: string; label: string; bg: string; text: string }> = {
  value: { emoji: '💎', label: '價值', bg: 'bg-emerald-100', text: 'text-emerald-700' },
  growth: { emoji: '🚀', label: '成長', bg: 'bg-sky-100', text: 'text-sky-700' },
  dividend: { emoji: '💵', label: '股息', bg: 'bg-amber-100', text: 'text-amber-700' },
  hiddenChampion: { emoji: '🛡️', label: '隱形冠軍', bg: 'bg-violet-100', text: 'text-violet-700' },
  momentum: { emoji: '⚡', label: '動能', bg: 'bg-rose-100', text: 'text-rose-700' },
};

// ───── Filter / sort logic ─────
const sortRows = (rows: ScreenerRow[], key: SortKey): ScreenerRow[] => {
  const cmp = (a: ScreenerRow, b: ScreenerRow): number => {
    switch (key) {
      case 'weighted': return b.weightedScore - a.weightedScore;
      case 'priority': return b.priorityScore - a.priorityScore || b.weightedScore - a.weightedScore;
      case 'pe': return (a.currentPe ?? Infinity) - (b.currentPe ?? Infinity);
      case 'yield': return (b.yieldPct ?? -Infinity) - (a.yieldPct ?? -Infinity);
      case 'roe': return (b.roe5yMin ?? -Infinity) - (a.roe5yMin ?? -Infinity);
      case 'eps_cagr': return (b.epsCagr ?? -Infinity) - (a.epsCagr ?? -Infinity);
    }
  };
  return [...rows].sort(cmp);
};

const valuationCheck = (r: ScreenerRow, k: ValuationKey): boolean => {
  switch (k) {
    case 'peBelowAvg':
      return r.pePremium !== null && r.pePremium < 0;
    case 'peUnder30':
      return r.currentPe !== null && r.currentPe < 30;
    case 'forwardLowerThanCurrent':
      // forward EPS / forward PE not stored on row yet → approximate via epsCagr > 0
      return (r.epsCagr ?? -1) > 0;
    case 'pegUnder1':
      // peg not in row schema yet; if epsCagr > currentPe → peg < 1 (loose proxy)
      return r.currentPe !== null && r.epsCagr !== null && r.epsCagr > r.currentPe;
    case 'nearFiveYearLow':
      // pe5yLow not stored; use pePremium < -0.3 as "deeply below average" proxy
      return r.pePremium !== null && r.pePremium < -0.3;
  }
};

const applyFilters = (rows: ScreenerRow[], f: Filters): ScreenerRow[] => {
  const filtered = rows.filter((r) => {
    // Style tag any-match
    if (f.styleTags.size > 0 && !r.styleTags.some((t) => f.styleTags.has(t))) return false;
    // All required criteria must be passed
    for (const id of f.criteriaRequired) {
      if (r.criteriaPassed[id] !== true) return false;
    }
    // All required moats must be present
    for (const m of f.moatsRequired) {
      if (!r.moatTags.includes(m)) return false;
    }
    // All excluded risks must be absent
    for (const rk of f.risksExcluded) {
      if (r.riskTags.includes(rk)) return false;
    }
    // All valuation checks must pass
    for (const v of f.valuation) {
      if (!valuationCheck(r, v)) return false;
    }
    return true;
  });
  return sortRows(filtered, f.sort);
};

// ───── Subcomponents ─────
const StyleChip = ({
  tag, active, onToggle,
}: { tag: StyleTag; active: boolean; onToggle: () => void }) => {
  const s = STYLE_LABELS[tag];
  return (
    <button
      type="button"
      onClick={onToggle}
      className={`px-2.5 py-1 rounded-full text-xs font-medium border transition-colors ${
        active ? `${s.bg} ${s.text} border-current` : 'bg-white border-slate-200 text-slate-500 hover:border-slate-400'
      }`}
    >
      {s.emoji} {s.label}
    </button>
  );
};

const GroupBlock = ({
  group,
  filters,
  toggleItem,
  defaultOpen,
}: {
  group: Group;
  filters: Filters;
  toggleItem: (group: Group, id: string) => void;
  defaultOpen: boolean;
}) => {
  const [open, setOpen] = useState(defaultOpen);
  const selected = (() => {
    switch (group.mode) {
      case 'criterion': return filters.criteriaRequired;
      case 'moat': return filters.moatsRequired;
      case 'risk': return filters.risksExcluded;
      case 'valuation': return filters.valuation;
    }
  })();
  const selectedCount = group.items.filter((it) => selected.has(it.id)).length;

  return (
    <div className="border-t border-slate-200 pt-2">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between text-xs font-semibold text-slate-700 hover:text-slate-900 py-1"
      >
        <span>
          {group.title}
          {selectedCount > 0 && (
            <span className="ml-1.5 text-emerald-600 tabular-nums">({selectedCount})</span>
          )}
        </span>
        <svg width="12" height="12" viewBox="0 0 16 16" fill="none" className={`transition-transform ${open ? 'rotate-180' : ''}`}>
          <path d="M4 6l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
      {open && (
        <ul className="mt-1 space-y-1.5">
          {group.items.map((it) => (
            <li key={it.id}>
              <label className="flex items-start gap-2 text-[11px] text-slate-700 leading-snug cursor-pointer hover:text-slate-900">
                <input
                  type="checkbox"
                  checked={selected.has(it.id)}
                  onChange={() => toggleItem(group, it.id)}
                  className="mt-0.5 accent-emerald-600 shrink-0"
                />
                <span>{it.label}</span>
              </label>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

const ResultCard = ({ row }: { row: ScreenerRow }) => {
  const passRatio = row.total === 0 ? 0 : row.score / row.total;
  const verdict =
    row.priorityScore >= 5 && row.score >= 11 ? 'buy' :
    row.score >= 8 ? 'watch' : 'avoid';
  const verdictClass = {
    buy: 'border-emerald-500/40 bg-emerald-50',
    watch: 'border-amber-500/40 bg-amber-50',
    avoid: 'border-slate-200 bg-slate-50',
  }[verdict];

  return (
    <Link
      to={`/stock?symbol=${row.symbol}`}
      className={`block rounded-xl border ${verdictClass} p-4 hover:shadow-md transition-shadow`}
    >
      <div className="flex items-baseline justify-between mb-2 gap-2">
        <div className="min-w-0">
          <div className="font-bold text-slate-900 truncate">
            {row.symbol} <span className="font-normal text-slate-600">{row.name ?? ''}</span>
          </div>
        </div>
        <div className="text-right shrink-0">
          <div className="text-lg font-bold text-slate-900 tabular-nums leading-none">
            {row.weightedScore.toFixed(1)}
          </div>
          <div className="text-[10px] text-slate-500">PEACE Score</div>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2 text-[11px] mb-2 tabular-nums">
        <div>
          <div className="text-slate-500">核心</div>
          <div className="text-slate-900 font-medium">{row.priorityScore}/{row.priorityTotal}</div>
        </div>
        <div>
          <div className="text-slate-500">P/E</div>
          <div className="text-slate-900 font-medium">{row.currentPe?.toFixed(1) ?? '—'}</div>
        </div>
        <div>
          <div className="text-slate-500">殖利率</div>
          <div className="text-slate-900 font-medium">{row.yieldPct?.toFixed(2) ?? '—'}%</div>
        </div>
      </div>

      <div className="h-1 bg-slate-200 rounded overflow-hidden mb-2">
        <div
          className={`h-full ${passRatio >= 0.7 ? 'bg-emerald-500' : passRatio >= 0.5 ? 'bg-amber-500' : 'bg-red-400'}`}
          style={{ width: `${passRatio * 100}%` }}
        />
      </div>

      {row.styleTags.length > 0 && (
        <div className="flex flex-wrap gap-1 mb-2">
          {row.styleTags.map((t) => {
            const s = STYLE_LABELS[t];
            return (
              <span key={t} className={`text-[10px] px-1.5 py-0.5 rounded ${s.bg} ${s.text}`}>
                {s.emoji} {s.label}
              </span>
            );
          })}
        </div>
      )}

      {row.highlights.length > 0 && (
        <ul className="space-y-0.5 mb-1">
          {row.highlights.slice(0, 3).map((h) => (
            <li key={h} className="text-[11px] text-slate-700 leading-snug flex gap-1">
              <span className="text-emerald-600 shrink-0">▸</span>
              <span className="line-clamp-1">{h}</span>
            </li>
          ))}
        </ul>
      )}
      {row.concerns.length > 0 && (
        <ul className="space-y-0.5">
          {row.concerns.slice(0, 2).map((c) => (
            <li key={c} className="text-[11px] text-slate-500 leading-snug flex gap-1">
              <span className="text-amber-600 shrink-0">⚠</span>
              <span className="line-clamp-1">{c}</span>
            </li>
          ))}
        </ul>
      )}
    </Link>
  );
};

// ───── Main page ─────
export const ScreenerPage = ({ prefs }: Props) => {
  const { data, isLoading, error } = useScreener();
  const [filters, setFilters] = useState<Filters>(DEFAULT_FILTERS);

  const rows = data?.data.rows ?? [];
  const filtered = useMemo(() => applyFilters(rows, filters), [rows, filters]);

  const toggleStyle = (t: StyleTag) => {
    setFilters((prev) => {
      const next = new Set(prev.styleTags);
      if (next.has(t)) next.delete(t); else next.add(t);
      return { ...prev, styleTags: next };
    });
  };

  const toggleItem = (group: Group, id: string) => {
    setFilters((prev) => {
      const key =
        group.mode === 'criterion' ? 'criteriaRequired' :
        group.mode === 'moat' ? 'moatsRequired' :
        group.mode === 'risk' ? 'risksExcluded' : 'valuation';
      const next = new Set(prev[key] as Set<string>);
      if (next.has(id)) next.delete(id); else next.add(id);
      return { ...prev, [key]: next };
    });
  };

  const activeCount =
    filters.styleTags.size +
    filters.criteriaRequired.size +
    filters.moatsRequired.size +
    filters.risksExcluded.size +
    filters.valuation.size;

  return (
    <div>
      <TopNav onAddSymbol={prefs.addToWatchlist} />
      <main className="max-w-[1400px] mx-auto px-6 py-6">
        <header className="mb-6 flex items-end justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">🎯 PEACE 選股</h1>
            <p className="text-sm text-slate-600 mt-1">
              逐項勾選你看重的 PEACE 條件，即時篩出符合的股票。Universe {rows.length} 檔。
            </p>
          </div>
          {activeCount > 0 && (
            <button
              type="button"
              onClick={() => setFilters(DEFAULT_FILTERS)}
              className="text-xs text-slate-600 hover:text-slate-900 underline"
            >
              清除全部（{activeCount}）
            </button>
          )}
        </header>

        {isLoading ? (
          <div className="text-sm text-slate-600 p-4">載入中…</div>
        ) : error !== null || data === undefined ? (
          <div className="text-sm text-red-400 p-4">載入失敗</div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-[260px_1fr] gap-6">
            {/* Filter panel */}
            <aside className="rounded-2xl border border-slate-200 bg-white shadow-sm p-4 space-y-3 self-start lg:sticky lg:top-20 max-h-[calc(100vh-6rem)] overflow-y-auto">
              <div>
                <h3 className="text-xs font-semibold text-slate-500 mb-2">風格快選</h3>
                <div className="flex flex-wrap gap-1.5">
                  {(['value', 'growth', 'dividend', 'hiddenChampion', 'momentum'] as StyleTag[]).map((t) => (
                    <StyleChip key={t} tag={t} active={filters.styleTags.has(t)} onToggle={() => toggleStyle(t)} />
                  ))}
                </div>
              </div>

              <div>
                <label className="flex flex-col gap-1 text-xs text-slate-700">
                  <span className="font-semibold text-slate-500">排序</span>
                  <select
                    value={filters.sort}
                    onChange={(e) => setFilters((prev) => ({ ...prev, sort: e.target.value as SortKey }))}
                    className="bg-white border border-slate-200 rounded px-2 py-1.5 text-slate-900"
                  >
                    <option value="weighted">PEACE 分數</option>
                    <option value="priority">核心通過數</option>
                    <option value="pe">P/E（低到高）</option>
                    <option value="yield">殖利率（高到低）</option>
                    <option value="roe">5Y ROE（高到低）</option>
                    <option value="eps_cagr">EPS CAGR（高到低）</option>
                  </select>
                </label>
              </div>

              {GROUPS.map((g) => (
                <GroupBlock
                  key={g.key}
                  group={g}
                  filters={filters}
                  toggleItem={toggleItem}
                  defaultOpen={false}
                />
              ))}
            </aside>

            {/* Result grid */}
            <section>
              <div className="flex items-center justify-between mb-3 text-sm">
                <span className="text-slate-700">
                  符合條件 <span className="font-bold text-slate-900">{filtered.length}</span> 檔
                  <span className="text-slate-500"> / {rows.length}</span>
                </span>
                <span className="text-xs text-slate-500">
                  {data.data.updatedAt
                    ? `更新於 ${new Date(data.data.updatedAt).toLocaleString('zh-TW')}`
                    : '尚未掃描'}
                </span>
              </div>

              {filtered.length === 0 ? (
                <div className="rounded-2xl border border-slate-200 bg-white p-12 text-center text-sm text-slate-500">
                  條件太嚴格，沒有符合的標的。試試取消一些勾選。
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
                  {filtered.map((r) => <ResultCard key={r.symbol} row={r} />)}
                </div>
              )}
            </section>
          </div>
        )}
      </main>
    </div>
  );
};
