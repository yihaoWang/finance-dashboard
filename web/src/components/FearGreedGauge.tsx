import type { FearGreedSnapshot } from '@fd/shared';

interface Props { snapshot: FearGreedSnapshot; }

const zoneColor = (value: number): string => {
  if (value < 20) return '#dc2626';
  if (value < 45) return '#f97316';
  if (value < 55) return '#94a3b8';
  if (value < 80) return '#84cc16';
  return '#22c55e';
};

export const FearGreedGauge = ({ snapshot }: Props) => {
  const { value, label } = snapshot;
  const angle = (value / 100) * 180 - 90;
  const color = zoneColor(value);
  return (
    <div className="flex flex-col items-center gap-2">
      <svg viewBox="0 0 200 110" className="w-48">
        <path d="M 10 100 A 90 90 0 0 1 190 100" fill="none" stroke="#1f2937" strokeWidth="16" strokeLinecap="round" />
        <path d="M 10 100 A 90 90 0 0 1 190 100" fill="none" stroke={color} strokeWidth="16" strokeLinecap="round" strokeDasharray={`${(value / 100) * 283} 283`} />
        <line x1="100" y1="100" x2={100 + 80 * Math.cos(((angle - 90) * Math.PI) / 180)} y2={100 + 80 * Math.sin(((angle - 90) * Math.PI) / 180)} stroke="#f1f5f9" strokeWidth="3" strokeLinecap="round" />
        <circle cx="100" cy="100" r="5" fill="#f1f5f9" />
      </svg>
      <div className="text-center">
        <div className="text-3xl font-bold" style={{ color }}>{value}</div>
        <div className="text-sm text-slate-600">{label}</div>
      </div>
    </div>
  );
};
