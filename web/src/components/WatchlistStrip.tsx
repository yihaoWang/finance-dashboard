type Props = {
  current: string;
  watchlist: string[];
  onPick: (symbol: string) => void;
  onRemove: (symbol: string) => void;
};

const PRESETS: Record<string, string> = {
  '2330': '台積電',
  '2454': '聯發科',
  '2317': '鴻海',
  '3008': '大立光',
  '2308': '台達電',
};

export const WatchlistStrip = ({ current, watchlist, onPick, onRemove }: Props) => (
  <div className="flex items-center gap-2 overflow-x-auto pb-1 mb-4">
    <span className="text-xs text-zinc-500 mr-2 shrink-0">自選</span>
    {watchlist.map((s) => {
      const isActive = current === s;
      return (
        <div
          key={s}
          className={`shrink-0 rounded-lg flex items-center border group transition-colors ${
            isActive
              ? 'bg-accent/10 border-accent/40 text-zinc-100'
              : 'bg-ink-800 border-ink-700 text-zinc-300 hover:border-ink-600'
          }`}
        >
          <button
            type="button"
            onClick={() => onPick(s)}
            className="pl-3 pr-2 py-1.5 text-sm flex items-center gap-2 cursor-pointer"
          >
            <span className="num font-medium">{s}</span>
            <span className="text-xs text-zinc-500">{PRESETS[s] ?? ''}</span>
          </button>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onRemove(s);
            }}
            aria-label={`移除 ${s}`}
            title={`移除 ${s}`}
            className="px-1.5 mr-1 text-zinc-600 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity rounded"
          >
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      );
    })}
  </div>
);
