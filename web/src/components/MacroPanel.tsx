import type { FredObservation, MacroQuote } from '@fd/shared';
import { useMacro } from '../hooks/useMacro';

type CardData = {
  label: string;
  value: number | null;
  unit: string;
  date: string | null;
  decimals: number;
};

const formatDate = (dateStr: string | null): string => {
  if (!dateStr) return '—';
  const d = new Date(dateStr);
  if (!Number.isFinite(d.getTime())) return dateStr;
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  return `${y}/${m}/${day}`;
};

const formatValue = (value: number | null, decimals: number, unit: string): string => {
  if (value === null) return '—';
  if (unit === '千' || unit === '') {
    return decimals === 0 ? Math.round(value).toLocaleString() : value.toFixed(decimals);
  }
  return value.toFixed(decimals);
};

const MacroCard = ({ label, value, unit, date, decimals }: CardData) => {
  const hasValue = value !== null;
  const valueStr = formatValue(value, decimals, unit);
  const dateStr = formatDate(date);

  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-3">
      <div className="text-xs text-slate-400">{label}</div>
      <div className="mt-1 flex items-baseline gap-1">
        <span className={`text-2xl font-semibold ${hasValue ? 'text-slate-100' : 'text-slate-500'}`}>
          {valueStr}
        </span>
        {hasValue && unit !== '' && (
          <span className="text-xs text-slate-500">{unit}</span>
        )}
      </div>
      <div className="mt-1 text-[10px] text-slate-500">{dateStr}</div>
    </div>
  );
};

const fredCard = (
  label: string,
  obs: FredObservation | undefined,
  unit: string,
  decimals: number,
): CardData => ({
  label,
  value: obs?.latest ?? null,
  unit,
  date: obs?.date ?? null,
  decimals,
});

const yahooCard = (
  label: string,
  quote: MacroQuote | null | undefined,
  unit: string,
  decimals: number,
): CardData => ({
  label,
  value: quote?.value ?? null,
  unit,
  date: null,
  decimals,
});

export const MacroPanel = () => {
  const { data, isLoading } = useMacro();
  const bundle = data?.data;
  const fred = bundle?.fred;

  const cards: CardData[] = [
    fredCard('聯邦基準利率', fred?.fedFunds, '%', 2),
    yahooCard('10年期公債殖利率', bundle?.us10y, '%', 2),
    fredCard('非農就業月增', fred?.nfpChange, '千', 0),
    fredCard('失業率', fred?.unrate, '%', 1),
    fredCard('GDP年增率', fred?.gdpYoy, '%', 1),
    fredCard('CPI年增率', fred?.cpi, '%', 2),
    fredCard('PCE年增率', fred?.pce, '%', 2),
    fredCard('PPI年增率', fred?.ppi, '%', 2),
    fredCard('CCI (密大消費者信心)', fred?.umcsent, '', 1),
    yahooCard('美元指數', bundle?.dxy, '', 2),
    yahooCard('恐慌指數 (VIX)', bundle?.vix, '', 2),
  ];

  return (
    <div className="mb-6">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-lg font-semibold text-slate-100">美國重要總經指標</h2>
        {isLoading && <span className="text-[11px] text-slate-500">載入中…</span>}
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
        {cards.map((card) => (
          <MacroCard key={card.label} {...card} />
        ))}
      </div>
    </div>
  );
};
