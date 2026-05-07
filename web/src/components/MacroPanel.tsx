export const MacroPanel = () => (
  <div className="rounded-2xl bg-ink-900 border border-ink-700 p-5">
    <div className="flex items-center justify-between mb-4">
      <h2 className="font-medium text-zinc-100">宏觀風險</h2>
      <span className="text-[11px] text-zinc-500">Phase 2</span>
    </div>
    <div className="space-y-3 text-sm">
      {[
        { k: 'US 10Y', v: '—' },
        { k: 'VIX', v: '—' },
        { k: 'SOX', v: '—' },
        { k: 'DXY', v: '—' },
        { k: 'USD/TWD', v: '—' },
      ].map((row) => (
        <div key={row.k} className="flex items-center justify-between">
          <span className="text-zinc-400">{row.k}</span>
          <span className="num text-zinc-500">{row.v}</span>
        </div>
      ))}
    </div>
    <div className="mt-4 pt-4 border-t border-ink-700 text-xs text-zinc-500">
      將以 FRED + Yahoo 串接
    </div>
  </div>
);
