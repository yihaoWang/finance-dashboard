import type { ReactNode } from 'react';

type Props = {
  label: ReactNode;
  value: number | null;
  unit?: string;
  digits?: number;
  hint?: string | undefined;
  hintTone?: 'up' | 'down' | 'mute' | undefined;
};

export const KpiCard = ({ label, value, unit, digits = 2, hint, hintTone = 'mute' }: Props) => (
  <div className="rounded-xl bg-ink-900 border border-ink-700 shadow-sm p-4">
    <div className="text-xs text-slate-600 mb-1">{label}</div>
    <div className="text-xl font-semibold num text-slate-900">
      {value === null ? '—' : `${value.toFixed(digits)}${unit ?? ''}`}
    </div>
    {hint && (
      <div
        className={`text-[11px] mt-1 ${
          hintTone === 'up' ? 'text-up' : hintTone === 'down' ? 'text-down' : 'text-slate-600'
        }`}
      >
        {hint}
      </div>
    )}
  </div>
);
