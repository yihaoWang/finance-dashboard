import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { usePeace } from '../hooks/usePeace';
import { postPeaceTags } from '../lib/api';
import type { MoatCategory, PeaceCriterion, RiskCategory } from '@fd/shared';

const ALL_MOAT: MoatCategory[] = ['無形資產', '成本優勢', '網路效應', '高轉換成本', '有效規模'];
const ALL_RISK: RiskCategory[] = ['R 監管風險', 'I 通脹風險', 'S 科技風險', 'K 關鍵人物風險'];

const GROUP_LABELS: Record<string, string> = {
  P: 'P 盈利',
  E: 'E 增長',
  A: 'A 現金',
  C: 'C 保守',
  E2: 'E 效率',
};

const scoreColor = (score: number, total: number): string => {
  const ratio = score / total;
  if (ratio >= 14 / 16) return 'text-up';
  if (ratio >= 11 / 16) return 'text-amber-400';
  return 'text-down';
};

const scoreBadgeBg = (score: number, total: number): string => {
  const ratio = score / total;
  if (ratio >= 14 / 16) return 'bg-up/10 border-up/30 text-up';
  if (ratio >= 11 / 16) return 'bg-amber-500/10 border-amber-500/30 text-amber-400';
  return 'bg-down/10 border-down/30 text-down';
};

const StatusIcon = ({ passed }: { passed: boolean | null }) => {
  if (passed === true) return <span className="text-up font-bold">✓</span>;
  if (passed === false) return <span className="text-down font-bold">✗</span>;
  return <span className="text-zinc-500">?</span>;
};

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

  const toggle = (v: string) => {
    setSelected((prev) =>
      prev.includes(v) ? prev.filter((x) => x !== v) : [...prev, v],
    );
  };

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
    <div
      className="fixed inset-0 bg-black/60 flex items-center justify-center z-50"
      onClick={onClose}
    >
      <div
        className="bg-zinc-900 border border-zinc-700 rounded-xl p-6 min-w-[280px] shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="text-sm font-semibold text-zinc-200 mb-4">編輯 {label}</h3>
        <div className="space-y-2">
          {options.map((opt) => (
            <label key={opt} className="flex items-center gap-2 cursor-pointer text-sm text-zinc-300">
              <input
                type="checkbox"
                checked={selected.includes(opt)}
                onChange={() => toggle(opt)}
                className="accent-up"
              />
              {opt}
            </label>
          ))}
        </div>
        {saveError !== null && (
          <p className="mt-3 text-xs text-down">{saveError}</p>
        )}
        <div className="flex gap-2 mt-5">
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="flex-1 bg-up/20 hover:bg-up/30 text-up text-xs font-semibold py-1.5 rounded disabled:opacity-50"
          >
            {saving ? '儲存中…' : '儲存'}
          </button>
          <button
            type="button"
            onClick={onClose}
            className="flex-1 bg-zinc-800 hover:bg-zinc-700 text-zinc-400 text-xs py-1.5 rounded"
          >
            取消
          </button>
        </div>
      </div>
    </div>
  );
};

type TagRowProps = {
  label: string;
  emoji: string;
  tags: string[];
  onEdit: () => void;
};

const TagRow = ({ label, emoji, tags, onEdit }: TagRowProps) => (
  <div className="flex items-center gap-2 flex-wrap text-xs">
    <span className="text-zinc-400 shrink-0">{emoji} {label}:</span>
    {tags.length > 0 ? (
      tags.map((t) => (
        <span key={t} className="bg-zinc-800 border border-zinc-600 text-zinc-300 px-2 py-0.5 rounded-full">
          {t}
        </span>
      ))
    ) : (
      <span className="text-zinc-600 italic">未設定</span>
    )}
    <button
      type="button"
      onClick={onEdit}
      className="ml-auto text-zinc-500 hover:text-zinc-300 text-xs"
    >
      [編輯]
    </button>
  </div>
);

type CriterionRowProps = { c: PeaceCriterion };

const fmt = (v: number | null, decimals = 2): string => {
  if (v === null) return '—';
  return v.toFixed(decimals);
};

const CriterionRow = ({ c }: CriterionRowProps) => (
  <div className={`flex items-start gap-2 py-1 border-b border-zinc-800/50 last:border-0 text-xs ${c.passed === false ? 'opacity-70' : ''}`}>
    <StatusIcon passed={c.passed} />
    <span className={`shrink-0 w-4 text-center ${c.priority ? 'text-amber-400' : 'text-zinc-600'}`}>
      {c.priority ? '★' : ' '}
    </span>
    <span className="text-zinc-300 flex-1">{c.id}. {c.label}</span>
    <span className="text-zinc-500 shrink-0">{fmt(c.value)} <span className="text-zinc-700">({c.threshold})</span></span>
  </div>
);

type GroupSectionProps = { group: string; criteria: PeaceCriterion[] };

const GroupSection = ({ group, criteria }: GroupSectionProps) => {
  const passed = criteria.filter((c) => c.passed === true).length;
  return (
    <div className="border border-zinc-800 rounded-lg mb-3">
      <div className="flex items-center gap-2 px-3 py-2 bg-zinc-800/40 rounded-t-lg">
        <span className="text-xs font-semibold text-zinc-300">{GROUP_LABELS[group] ?? group}</span>
        <span className={`ml-auto text-xs font-mono ${passed === criteria.length ? 'text-up' : 'text-amber-400'}`}>
          {passed}/{criteria.length}
        </span>
      </div>
      <div className="px-3 py-1">
        {criteria.map((c) => (
          <CriterionRow key={c.id} c={c} />
        ))}
      </div>
    </div>
  );
};

type Props = { symbol: string };

export const PeacePanel = ({ symbol }: Props) => {
  const { data, isLoading, error } = usePeace(symbol);
  const [editModal, setEditModal] = useState<'moat' | 'risk' | null>(null);

  if (isLoading) return <div className="text-zinc-500 text-sm py-4">載入 PEACE 評分中…</div>;
  if (error) return <div className="text-down text-xs py-2">PEACE 評分載入失敗：{error.message}</div>;
  if (!data) return null;

  const bundle = data.data;

  const groups = ['P', 'E', 'A', 'C', 'E2'] as const;
  const criteriaByGroup = (g: string) => bundle.criteria.filter((c) => c.group === g);

  const wacc16 = bundle.criteria.find((c) => c.id === 16);

  return (
    <section className="mb-6 border border-zinc-700 rounded-xl overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 bg-zinc-800/60 border-b border-zinc-700">
        <span className="text-sm font-semibold text-zinc-200">PEACE 評分卡</span>
        <span
          className={`ml-2 border rounded-full px-3 py-0.5 text-sm font-mono font-bold ${scoreBadgeBg(bundle.score, bundle.total)}`}
        >
          {bundle.score}/{bundle.total}
        </span>
        <span className={`text-xs ${scoreColor(bundle.priorityScore, 6)}`}>
          核心項 {bundle.priorityScore}/6
        </span>
      </div>

      <div className="px-4 py-3 space-y-2">
        {/* Tag rows */}
        <TagRow
          emoji=""
          label="護城河"
          tags={bundle.moat}
          onEdit={() => setEditModal('moat')}
        />
        <TagRow
          emoji=""
          label="RISK"
          tags={bundle.risk}
          onEdit={() => setEditModal('risk')}
        />
      </div>

      {/* Criteria groups */}
      <div className="px-4 pb-3">
        {groups.map((g) => {
          const items = criteriaByGroup(g);
          if (items.length === 0) return null;
          return <GroupSection key={g} group={g} criteria={items} />;
        })}
      </div>

      {/* WACC footnote */}
      <div className="px-4 pb-3 text-xs text-zinc-600">
        {wacc16 !== undefined && wacc16.note !== undefined
          ? wacc16.note
          : `WACC 採用簡化模型 (10Y 美債殖利率 + 5% = ${bundle.wacc.toFixed(1)}%)，僅供參考`}
      </div>

      {/* Tag edit modals */}
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
    </section>
  );
};
