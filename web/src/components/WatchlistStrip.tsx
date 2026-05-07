type Props = {
  current: string;
  watchlist: string[];
  onPick: (symbol: string) => void;
};

const PRESETS: Record<string, string> = {
  '2330': '台積電',
  '2454': '聯發科',
  '2317': '鴻海',
  '3008': '大立光',
  '2308': '台達電',
};

export const WatchlistStrip = ({ current, watchlist, onPick }: Props) => (
  <div className="flex items-center gap-2 overflow-x-auto pb-1 mb-4">
    <span className="text-xs text-zinc-500 mr-2 shrink-0">自選</span>
    {watchlist.map((s) => (
      <button
        key={s}
        type="button"
        onClick={() => onPick(s)}
        className={`shrink-0 rounded-lg px-3 py-1.5 text-sm flex items-center gap-2 border ${
          current === s
            ? 'bg-accent/10 border-accent/40 text-zinc-100'
            : 'bg-ink-800 border-ink-700 text-zinc-300'
        }`}
      >
        <span className="num font-medium">{s}</span>
        <span className="text-xs text-zinc-500">{PRESETS[s] ?? ''}</span>
      </button>
    ))}
  </div>
);
