type Props = {
  label: string;
  value: number | null;
  unit?: string;
  digits?: number;
};

export const KpiCard = ({ label, value, unit, digits = 2 }: Props) => (
  <div className="rounded-xl bg-ink-900 border border-ink-700 p-4">
    <div className="text-xs text-zinc-500 mb-1">{label}</div>
    <div className="text-xl font-semibold num text-zinc-100">
      {value === null ? '—' : `${value.toFixed(digits)}${unit ?? ''}`}
    </div>
  </div>
);
