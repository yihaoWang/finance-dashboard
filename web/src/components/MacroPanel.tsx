import type { MacroQuote } from '@fd/shared';
import { useMacro } from '../hooks/useMacro';

type RiskSignal = { label: string; color: string };

const getRiskSignal = (vix: MacroQuote | null | undefined): RiskSignal => {
  if (vix === null || vix === undefined) return { label: '—', color: 'text-zinc-500' };
  if (vix.value < 20) return { label: '偏多', color: 'text-emerald-400' };
  if (vix.value <= 30) return { label: '中性', color: 'text-yellow-400' };
  return { label: '偏空', color: 'text-red-400' };
};

type MacroRowProps = {
  label: string;
  quote: MacroQuote | null | undefined;
};

const MacroRow = ({ label, quote }: MacroRowProps) => {
  const hasData = quote !== null && quote !== undefined;
  const valueStr = hasData ? quote.value.toFixed(2) : '—';
  const changePctStr = hasData ? `${quote.changePct >= 0 ? '+' : ''}${quote.changePct.toFixed(2)}%` : '';
  const changeColor = hasData
    ? quote.changePct >= 0 ? 'text-emerald-400' : 'text-red-400'
    : 'text-zinc-500';

  return (
    <div className="flex items-center justify-between">
      <span className="text-zinc-400">{label}</span>
      <div className="flex items-center gap-2">
        {hasData && (
          <span className={`num text-xs ${changeColor}`}>{changePctStr}</span>
        )}
        <span className="num text-zinc-100">{valueStr}</span>
      </div>
    </div>
  );
};

export const MacroPanel = () => {
  const { data, isLoading } = useMacro();
  const bundle = data?.data;
  const risk = getRiskSignal(bundle?.vix);

  return (
    <div className="rounded-2xl bg-ink-900 border border-ink-700 p-5">
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-medium text-zinc-100">宏觀風險</h2>
        {isLoading && <span className="text-[11px] text-zinc-500">載入中…</span>}
      </div>
      <div className="space-y-3 text-sm">
        <MacroRow label="US 10Y" quote={bundle?.us10y} />
        <MacroRow label="VIX" quote={bundle?.vix} />
        <MacroRow label="SOX" quote={bundle?.sox} />
        <MacroRow label="DXY" quote={bundle?.dxy} />
        <MacroRow label="USD/TWD" quote={bundle?.twd} />
      </div>
      <div className="mt-4 pt-4 border-t border-ink-700 text-xs flex items-center justify-between">
        <span className="text-zinc-500">風險偏好燈號</span>
        <span className={`font-medium ${risk.color}`}>{risk.label}</span>
      </div>
    </div>
  );
};
