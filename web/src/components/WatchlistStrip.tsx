import { useMemo } from 'react';
import { useStockNames } from '../hooks/useStockNames';

type Props = {
  current: string;
  watchlist: string[];
  recents?: string[];
  onPick: (symbol: string) => void;
  onRemove: (symbol: string) => void;
  onRemoveRecent?: (symbol: string) => void;
  onStar?: (symbol: string) => void;
};

type ChipProps = {
  symbol: string;
  name?: string;
  active: boolean;
  onPick: (s: string) => void;
  onRemove: (s: string) => void;
  showStar?: boolean;
  starred?: boolean;
  onStar?: (s: string) => void;
};

const Chip = ({ symbol, name, active, onPick, onRemove, showStar, starred, onStar }: ChipProps) => (
  <div
    className={`shrink-0 rounded-lg flex items-center border group transition-colors ${
      active
        ? 'bg-accent/10 border-accent/40 text-slate-900'
        : 'bg-ink-800 border-ink-700 text-slate-700 hover:border-ink-600'
    }`}
  >
    {showStar && onStar && (
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onStar(symbol);
        }}
        aria-label={starred ? `從自選移除 ${symbol}` : `加入自選 ${symbol}`}
        title={starred ? '從自選移除' : '加入自選'}
        className={`pl-2 pr-0.5 py-1.5 transition-colors ${
          starred ? 'text-amber-400' : 'text-slate-500 hover:text-amber-400'
        }`}
      >
        <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill={starred ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth={2} aria-hidden>
          <path strokeLinecap="round" strokeLinejoin="round" d="M11.48 3.5l2.34 4.74 5.23.76-3.78 3.69.89 5.21-4.68-2.46-4.68 2.46.89-5.21L4 9l5.23-.76 2.25-4.74z" />
        </svg>
      </button>
    )}
    <button
      type="button"
      onClick={() => onPick(symbol)}
      className={`${showStar ? 'pl-1.5' : 'pl-3'} pr-2 py-1.5 text-sm flex items-center gap-2 cursor-pointer`}
    >
      <span className="num font-medium">{symbol}</span>
      <span className="text-xs text-slate-600">{name ?? ''}</span>
    </button>
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        onRemove(symbol);
      }}
      aria-label={`移除 ${symbol}`}
      title={`移除 ${symbol}`}
      className="px-1.5 mr-1 text-slate-600 hover:text-red-400 transition-colors rounded"
    >
      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
      </svg>
    </button>
  </div>
);

export const WatchlistStrip = ({
  current,
  watchlist,
  recents = [],
  onPick,
  onRemove,
  onRemoveRecent,
  onStar,
}: Props) => {
  const recentsToShow = recents.filter((s) => !watchlist.includes(s));
  const allSymbols = useMemo(() => [...watchlist, ...recentsToShow], [watchlist, recentsToShow]);
  const names = useStockNames(allSymbols);
  return (
    <div className="mb-4 space-y-2">
      <div className="flex items-center gap-2 overflow-x-auto pb-1">
        <span className="text-xs text-slate-600 mr-2 shrink-0 w-12">自選</span>
        {watchlist.length === 0 && (
          <span className="text-xs text-slate-500">點 ★ 把股票加入自選</span>
        )}
        {watchlist.map((s) => (
          <Chip
            key={s}
            symbol={s}
            name={names[s] ?? ''}
            active={current === s}
            onPick={onPick}
            onRemove={onRemove}
            {...(onStar ? { showStar: true, starred: true, onStar } : {})}
          />
        ))}
      </div>
      {recentsToShow.length > 0 && (
        <div className="flex items-center gap-2 overflow-x-auto pb-1">
          <span className="text-xs text-slate-600 mr-2 shrink-0 w-12">最近</span>
          {recentsToShow.map((s) => (
            <Chip
              key={s}
              symbol={s}
              name={names[s] ?? ''}
              active={current === s}
              onPick={onPick}
              onRemove={onRemoveRecent ?? onRemove}
              {...(onStar ? { showStar: true, starred: false, onStar } : {})}
            />
          ))}
        </div>
      )}
    </div>
  );
};
