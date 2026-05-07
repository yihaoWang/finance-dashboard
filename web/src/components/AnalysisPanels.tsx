import type { Kpi, Quote } from '@fd/shared';
import { MetricLabel } from './MetricLabel';

const Bar = ({ value, max, tone = 'mute' }: { value: number; max: number; tone?: 'up' | 'down' | 'mute' }) => {
  const pct = Math.min(100, Math.max(0, (value / max) * 100));
  const color = tone === 'up' ? 'bg-up' : tone === 'down' ? 'bg-down' : 'bg-accent';
  return (
    <div className="bg-ink-800 h-1 rounded">
      <div className={`h-1 rounded ${color}`} style={{ width: `${pct}%` }} />
    </div>
  );
};

type Props = { kpi: Kpi; quote: Quote };

export const AnalysisPanels = ({ kpi, quote }: Props) => (
  <section className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
    <div className="rounded-2xl bg-ink-900 border border-ink-700 p-5">
      <h2 className="font-medium text-zinc-100 mb-4">基本面</h2>
      <div className="space-y-4 text-sm">
        <div>
          <div className="flex justify-between mb-1">
            <MetricLabel term="grossMargin" value={kpi.grossMargin} className="text-zinc-400" />
            <span className="num text-zinc-200">{kpi.grossMargin === null ? '—' : `${kpi.grossMargin.toFixed(1)}%`}</span>
          </div>
          <Bar value={kpi.grossMargin ?? 0} max={80} />
        </div>
        <div>
          <div className="flex justify-between mb-1">
            <MetricLabel term="ttmEps" value={kpi.ttmEps} className="text-zinc-400" />
            <span className="num text-zinc-200">{kpi.ttmEps === null ? '—' : kpi.ttmEps.toFixed(2)}</span>
          </div>
          <Bar value={kpi.ttmEps ?? 0} max={100} />
        </div>
        <div className="pt-3 border-t border-ink-700 grid grid-cols-2 gap-3">
          <div>
            <div className="text-xs text-zinc-500">月營收 YoY</div>
            <div className={`num ${kpi.monthlyRevenueYoy === null ? 'text-zinc-500' : kpi.monthlyRevenueYoy >= 0 ? 'text-up' : 'text-down'}`}>
              {kpi.monthlyRevenueYoy === null ? '—' : `${kpi.monthlyRevenueYoy >= 0 ? '+' : ''}${kpi.monthlyRevenueYoy.toFixed(1)}%`}
            </div>
          </div>
          <div>
            <div className="text-xs text-zinc-500">P/E</div>
            <div className="num text-zinc-100">{kpi.pe === null ? '—' : kpi.pe.toFixed(2)}</div>
          </div>
        </div>
      </div>
    </div>

    <div className="rounded-2xl bg-ink-900 border border-ink-700 p-5">
      <h2 className="font-medium text-zinc-100 mb-4">籌碼面</h2>
      <div className="space-y-3 text-sm text-zinc-500">
        <div className="text-xs">三大法人 / 融資融券 / 外資持股</div>
        <div className="text-xs">將以 TWSE T86 + MARGN + QFIIS 串接（Phase 2）</div>
      </div>
      <div className="space-y-3 mt-4">
        {['外資', '投信', '自營商'].map((k) => (
          <div key={k} className="flex justify-between items-center text-sm">
            <span className="text-zinc-400">{k}</span>
            <span className="num text-zinc-500">— 張</span>
          </div>
        ))}
      </div>
    </div>

    <div className="rounded-2xl bg-ink-900 border border-ink-700 p-5">
      <h2 className="font-medium text-zinc-100 mb-4">技術面</h2>
      <div className="space-y-3 text-sm">
        <div>
          <div className="flex justify-between mb-1">
            <MetricLabel term="ma20Deviation" value={kpi.ma20Deviation} className="text-zinc-400" />
            <span className={`num ${kpi.ma20Deviation === null ? 'text-zinc-500' : kpi.ma20Deviation >= 0 ? 'text-up' : 'text-down'}`}>
              {kpi.ma20Deviation === null ? '—' : `${kpi.ma20Deviation >= 0 ? '+' : ''}${kpi.ma20Deviation.toFixed(2)}%`}
            </span>
          </div>
          <Bar
            value={Math.abs(kpi.ma20Deviation ?? 0)}
            max={20}
            tone={kpi.ma20Deviation !== null && Math.abs(kpi.ma20Deviation) > 10 ? 'down' : 'up'}
          />
        </div>
        <div className="pt-3 border-t border-ink-700">
          <div className="text-xs text-zinc-500 mb-1">52W 區間</div>
          <div className="flex justify-between text-sm">
            <span className="num text-down">{quote.low52w?.toFixed(0) ?? '—'}</span>
            <span className="text-zinc-500">···</span>
            <span className="num text-up">{quote.high52w?.toFixed(0) ?? '—'}</span>
          </div>
        </div>
        <div className="text-xs text-zinc-500 pt-2">RSI / MACD / 支撐壓力（Phase 2）</div>
      </div>
    </div>
  </section>
);
