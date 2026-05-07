import type { Chips, Kpi, Quote } from '@fd/shared';
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

const formatLots = (shares: number): string => {
  const lots = shares / 1000;
  const sign = lots >= 0 ? '+' : '';
  return `${sign}${lots.toLocaleString('zh-TW', { maximumFractionDigits: 0 })} 張`;
};

type ChipRowProps = { label: string; net: number | undefined };

const ChipRow = ({ label, net }: ChipRowProps) => {
  if (net === undefined) {
    return (
      <div className="flex justify-between items-center text-sm">
        <span className="text-zinc-400">{label}</span>
        <span className="num text-zinc-500">— 張</span>
      </div>
    );
  }
  const isPositive = net >= 0;
  return (
    <div className="flex justify-between items-center text-sm">
      <span className="text-zinc-400">{label}</span>
      <span className={`num ${isPositive ? 'text-up' : 'text-down'}`}>{formatLots(net)}</span>
    </div>
  );
};

type Props = { kpi: Kpi; quote: Quote; chips: Chips };

export const AnalysisPanels = ({ kpi, quote, chips }: Props) => (
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
        {kpi.opMargin !== null && (
          <div>
            <div className="flex justify-between mb-1">
              <MetricLabel term="opMargin" value={kpi.opMargin} className="text-zinc-400" />
              <span className="num text-zinc-200">{`${kpi.opMargin.toFixed(1)}%`}</span>
            </div>
            <Bar value={kpi.opMargin} max={60} />
          </div>
        )}
        {kpi.netMargin !== null && (
          <div>
            <div className="flex justify-between mb-1">
              <MetricLabel term="netMargin" value={kpi.netMargin} className="text-zinc-400" />
              <span className="num text-zinc-200">{`${kpi.netMargin.toFixed(1)}%`}</span>
            </div>
            <Bar value={kpi.netMargin} max={60} />
          </div>
        )}
        {kpi.roe !== null && (
          <div>
            <div className="flex justify-between mb-1">
              <MetricLabel term="roe" value={kpi.roe} className="text-zinc-400" />
              <span className="num text-zinc-200">{`${kpi.roe.toFixed(1)}%`}</span>
            </div>
            <Bar value={kpi.roe} max={50} />
          </div>
        )}
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
      <div className="space-y-3 text-sm text-zinc-500 mb-1">
        <div className="text-xs">三大法人買賣超（張）</div>
      </div>
      <div className="space-y-3 mt-3">
        <ChipRow label="外資" net={chips?.foreignNet} />
        <ChipRow label="投信" net={chips?.trustNet} />
        <ChipRow label="自營商" net={chips?.dealerNet} />
      </div>
      <div className="mt-4 pt-3 border-t border-ink-700 grid grid-cols-2 gap-3 text-sm">
        <div>
          <MetricLabel term="financingBalance" className="text-xs text-zinc-500" />
          <div className="num text-zinc-200 mt-0.5">
            {chips?.financingBalance != null
              ? `${(chips.financingBalance / 1000).toLocaleString('zh-TW', { maximumFractionDigits: 0 })} 張`
              : '—'}
          </div>
        </div>
        <div>
          <MetricLabel term="shortBalance" className="text-xs text-zinc-500" />
          <div className="num text-zinc-200 mt-0.5">
            {chips?.shortBalance != null
              ? `${(chips.shortBalance / 1000).toLocaleString('zh-TW', { maximumFractionDigits: 0 })} 張`
              : '—'}
          </div>
        </div>
        <div className="col-span-2">
          <MetricLabel term="foreignHoldingPct" className="text-xs text-zinc-500" />
          <div className="num text-zinc-200 mt-0.5">
            {chips?.foreignHoldingPct != null ? `${chips.foreignHoldingPct.toFixed(1)}%` : '—'}
          </div>
        </div>
      </div>
      {chips && (
        <div className="mt-3 text-xs text-zinc-600">資料日期：{chips.date}</div>
      )}
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

        <div className="pt-3 border-t border-ink-700 space-y-3">
          <div>
            <div className="flex justify-between mb-1">
              <MetricLabel term="rsi14" value={kpi.rsi14} className="text-zinc-400" />
              <span className={`num ${kpi.rsi14 === null ? 'text-zinc-500' : kpi.rsi14 > 70 ? 'text-down' : kpi.rsi14 < 30 ? 'text-up' : 'text-zinc-200'}`}>
                {kpi.rsi14 === null ? '—' : kpi.rsi14.toFixed(1)}
              </span>
            </div>
            {kpi.rsi14 !== null && (
              <div className="relative bg-ink-800 h-1 rounded">
                <div className="absolute top-0 left-[30%] w-px h-1 bg-zinc-600" />
                <div className="absolute top-0 left-[70%] w-px h-1 bg-zinc-600" />
                <div
                  className={`h-1 rounded ${kpi.rsi14 > 70 ? 'bg-down' : kpi.rsi14 < 30 ? 'bg-up' : 'bg-accent'}`}
                  style={{ width: `${Math.min(100, kpi.rsi14)}%` }}
                />
              </div>
            )}
          </div>

          <div className="flex justify-between items-center">
            <MetricLabel term="macd" value={kpi.macd} className="text-zinc-400" />
            <div className="flex items-center gap-2">
              {kpi.macd !== null && (
                <span className="num text-zinc-300 text-xs">{kpi.macd.toFixed(2)}</span>
              )}
              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                kpi.macdSignal === 'bullish' ? 'bg-up/20 text-up' :
                kpi.macdSignal === 'bearish' ? 'bg-down/20 text-down' :
                'bg-zinc-700 text-zinc-400'
              }`}>
                {kpi.macdSignal === 'bullish' ? '偏多' : kpi.macdSignal === 'bearish' ? '偏空' : '中性'}
              </span>
            </div>
          </div>

          <div className="space-y-1">
            <div className="flex justify-between items-center">
              <MetricLabel term="support" value={kpi.support} className="text-zinc-400" />
              <span className="num text-up text-xs">{kpi.support === null ? '—' : kpi.support.toFixed(0)}</span>
            </div>
            <div className="flex justify-between items-center">
              <MetricLabel term="resistance" value={kpi.resistance} className="text-zinc-400" />
              <span className="num text-down text-xs">{kpi.resistance === null ? '—' : kpi.resistance.toFixed(0)}</span>
            </div>
            {kpi.support !== null && kpi.resistance !== null && kpi.support < kpi.resistance && (
              <div className="relative bg-ink-800 h-1 rounded mt-1">
                <div
                  className="absolute top-[-2px] w-1.5 h-1.5 rounded-full bg-zinc-100 -translate-x-1/2"
                  style={{ left: `${Math.min(100, Math.max(0, ((quote.price - kpi.support) / (kpi.resistance - kpi.support)) * 100))}%` }}
                />
              </div>
            )}
          </div>
        </div>

        <div className="pt-3 border-t border-ink-700">
          <div className="text-xs text-zinc-500 mb-1">52W 區間</div>
          <div className="flex justify-between text-sm">
            <span className="num text-down">{quote.low52w?.toFixed(0) ?? '—'}</span>
            <span className="text-zinc-500">···</span>
            <span className="num text-up">{quote.high52w?.toFixed(0) ?? '—'}</span>
          </div>
        </div>
      </div>
    </div>
  </section>
);
