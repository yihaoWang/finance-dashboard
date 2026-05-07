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
  <div className="rounded-xl bg-ink-900 border border-ink-700 p-4">
    <div className="text-xs text-zinc-500 mb-1">{label}</div>
    <div className="text-xl font-semibold num text-zinc-100">
      {value === null ? '—' : `${value.toFixed(digits)}${unit ?? ''}`}
    </div>
    {hint && (
      <div
        className={`text-[11px] mt-1 ${
          hintTone === 'up' ? 'text-up' : hintTone === 'down' ? 'text-down' : 'text-zinc-500'
        }`}
      >
        {hint}
      </div>
    )}
  </div>
);
