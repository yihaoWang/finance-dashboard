import type { SentimentIndicator } from '@fd/shared';

const ZONE_BG: Record<SentimentIndicator['zone'], string> = {
  healthy: 'bg-emerald-500/10 border-emerald-500/40',
  neutral: 'bg-slate-500/10 border-slate-500/40',
  caution: 'bg-amber-500/10 border-amber-500/40',
  danger: 'bg-red-500/10 border-red-500/40',
};

const ZONE_DOT: Record<SentimentIndicator['zone'], string> = {
  healthy: 'bg-emerald-400',
  neutral: 'bg-slate-400',
  caution: 'bg-amber-400',
  danger: 'bg-red-400',
};

interface Props { indicator: SentimentIndicator; }

export const SentimentCard = ({ indicator }: Props) => {
  const change = indicator.change5d;
  const changeStr = `${change >= 0 ? '▲' : '▼'} ${Math.abs(change)}`;
  return (
    <div className={`rounded-lg border p-4 ${ZONE_BG[indicator.zone]}`}>
      <div className="flex items-center justify-between">
        <span className="text-sm text-slate-300">{indicator.label}</span>
        <span className={`h-2 w-2 rounded-full ${ZONE_DOT[indicator.zone]}`} />
      </div>
      <div className="mt-1 flex items-baseline gap-2">
        <span className="text-2xl font-semibold text-slate-100">
          {indicator.value}
          <span className="ml-0.5 text-sm text-slate-400">{indicator.unit}</span>
        </span>
        <span className="text-xs text-slate-400">{changeStr} (5D)</span>
      </div>
      <div className="mt-2 h-1.5 w-full rounded bg-slate-800">
        <div className="h-full rounded bg-slate-400" style={{ width: `${indicator.percentile}%` }} />
      </div>
      <div className="mt-1 text-xs text-slate-500">歷史百分位 {indicator.percentile}</div>
      <div className="mt-2 text-xs text-slate-300">{indicator.explanation}</div>
      {indicator.landmarks.length > 0 && (
        <ul className="mt-2 space-y-0.5 text-xs text-slate-400">
          {indicator.landmarks.map((lm) => (
            <li key={`${lm.event}-${lm.date}`}>• {lm.event} {lm.value}{indicator.unit}</li>
          ))}
        </ul>
      )}
    </div>
  );
};
