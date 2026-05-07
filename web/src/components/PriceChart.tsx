type Props = { price: number; high52w: number | null; low52w: number | null };

const RANGES = ['1D', '1W', '1M', '3M', '1Y', '5Y'];

export const PriceChart = ({ price, high52w, low52w }: Props) => {
  const hi = high52w ?? price * 1.2;
  const lo = low52w ?? price * 0.8;
  const pct = (price - lo) / (hi - lo);
  return (
    <div className="rounded-2xl bg-ink-900 border border-ink-700 p-5 lg:col-span-2">
      <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
        <h2 className="font-medium text-zinc-100">股價走勢</h2>
        <div className="flex gap-1 text-xs">
          {RANGES.map((r) => (
            <button
              key={r}
              type="button"
              className={`px-2 py-1 rounded ${
                r === '1M'
                  ? 'text-zinc-100 bg-accent/20 border border-accent/40'
                  : 'bg-ink-800 border border-ink-700 text-zinc-300'
              }`}
            >
              {r}
            </button>
          ))}
        </div>
      </div>
      <div className="h-48 flex items-center justify-center text-zinc-500 text-sm bg-ink-800/40 rounded-xl border border-ink-700">
        K 線圖（Phase 2 補上）
      </div>
      <div className="mt-4">
        <div className="flex items-center justify-between text-xs text-zinc-500 mb-2">
          <span>52W 低 {lo.toFixed(0)}</span>
          <span>現價 {price.toFixed(2)}</span>
          <span>52W 高 {hi.toFixed(0)}</span>
        </div>
        <div className="relative h-2 rounded-full bg-ink-800 overflow-hidden">
          <div
            className="absolute top-0 bottom-0 bg-gradient-to-r from-down via-accent to-up"
            style={{ width: '100%', opacity: 0.5 }}
          />
          <div
            className="absolute top-0 bottom-0 w-1 bg-zinc-100 rounded-full"
            style={{ left: `${Math.min(100, Math.max(0, pct * 100))}%`, transform: 'translateX(-50%)' }}
          />
        </div>
      </div>
    </div>
  );
};
