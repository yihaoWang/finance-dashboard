import type { Quote, Kpi } from '@fd/shared';

type Props = { quote: Quote; kpi: Kpi };

const TZ = 'Asia/Taipei';

const taipeiDateString = (ts: number): string =>
  new Date(ts).toLocaleDateString('en-CA', { timeZone: TZ });

const isToday = (ts: number): boolean => taipeiDateString(ts) === taipeiDateString(Date.now());

const fmtMarketTime = (ts: number | null): string => {
  if (ts === null) return '—';
  const d = new Date(ts);
  const sameDay = isToday(ts);
  const date = d.toLocaleDateString('zh-TW', { timeZone: TZ, month: 'numeric', day: 'numeric' });
  const time = d.toLocaleTimeString('zh-TW', { timeZone: TZ, hour: '2-digit', minute: '2-digit' });
  return sameDay ? time : `${date} ${time}`;
};

const fmtCap = (v: number | null): string => {
  if (v === null) return '—';
  if (v >= 1e12) return `${(v / 1e12).toFixed(2)}T`;
  if (v >= 1e8) return `${(v / 1e8).toFixed(0)}億`;
  return v.toLocaleString();
};

const fmtVol = (v: number): string => {
  const lots = Math.round(v / 1000);
  if (lots >= 10_000) return `${(lots / 10_000).toFixed(1)}萬張`;
  return `${lots.toLocaleString()} 張`;
};

const ledColor = (kind: 'good' | 'warn' | 'bad'): string =>
  kind === 'good'
    ? 'bg-emerald-500 shadow-[0_0_8px_#10b981]'
    : kind === 'warn'
      ? 'bg-amber-500 shadow-[0_0_8px_#f59e0b]'
      : 'bg-red-500 shadow-[0_0_8px_#ef4444]';

type Led = { kind: 'good' | 'warn' | 'bad'; label: string };

const buildLeds = (quote: Quote, kpi: Kpi): Led[] => {
  const leds: Led[] = [];
  if (kpi.pe !== null) {
    if (kpi.pe > 30) leds.push({ kind: 'warn', label: `估值偏高 P/E ${kpi.pe.toFixed(1)}` });
    else if (kpi.pe < 15) leds.push({ kind: 'good', label: `估值合理 P/E ${kpi.pe.toFixed(1)}` });
    else leds.push({ kind: 'good', label: `P/E ${kpi.pe.toFixed(1)}` });
  }
  if (kpi.ma20Deviation !== null) {
    const d = kpi.ma20Deviation;
    if (d > 10) leds.push({ kind: 'bad', label: `月線乖離 +${d.toFixed(1)}%` });
    else if (d < -10) leds.push({ kind: 'bad', label: `月線乖離 ${d.toFixed(1)}%` });
    else leds.push({ kind: 'good', label: `月線乖離 ${d.toFixed(1)}%` });
  }
  if (kpi.monthlyRevenueYoy !== null) {
    const y = kpi.monthlyRevenueYoy;
    if (y > 0) leds.push({ kind: 'good', label: `營收 YoY +${y.toFixed(1)}%` });
    else leds.push({ kind: 'bad', label: `營收 YoY ${y.toFixed(1)}%` });
  }
  if (quote.changePct >= 0) leds.push({ kind: 'good', label: `當日 +${quote.changePct.toFixed(2)}%` });
  else leds.push({ kind: 'bad', label: `當日 ${quote.changePct.toFixed(2)}%` });
  return leds;
};

export const Hero = ({ quote, kpi }: Props) => {
  const isUp = quote.change >= 0;
  const leds = buildLeds(quote, kpi);
  return (
    <section className="rounded-2xl bg-ink-900 border border-ink-700 p-6 mb-6">
      <div className="flex items-start justify-between gap-6 flex-wrap">
        <div>
          <div className="flex items-center gap-3 mb-2 flex-wrap">
            <h1 className="text-2xl font-semibold text-zinc-100">{quote.name}</h1>
            <span className="text-zinc-500 num text-sm">{quote.symbol}</span>
            <span className="rounded-md px-2 py-0.5 text-xs text-zinc-400 bg-ink-800 border border-ink-700">
              上市
            </span>
          </div>
          <div className="flex items-baseline gap-3 flex-wrap">
            <div className="text-5xl font-semibold num text-zinc-100">{quote.price.toFixed(2)}</div>
            <div className={`num text-lg ${isUp ? 'text-up' : 'text-down'}`}>
              {isUp ? '+' : ''}{quote.change.toFixed(2)} ({quote.changePct.toFixed(2)}%)
            </div>
            {quote.marketTime !== null && !isToday(quote.marketTime) && (
              <span className="text-[11px] text-amber-400 bg-amber-500/10 border border-amber-500/30 rounded px-1.5 py-0.5">
                盤前 · 顯示前一交易日
              </span>
            )}
          </div>
          <div className="text-xs text-zinc-500 mt-2 num">
            行情時間 {fmtMarketTime(quote.marketTime)} · 拉取於 {new Date(quote.updatedAt).toLocaleTimeString('zh-TW')}
          </div>
        </div>
        <div className="flex gap-6 text-sm flex-wrap">
          <div>
            <div className="text-zinc-500 text-xs mb-1">市值</div>
            <div className="num text-zinc-200">{fmtCap(quote.marketCap)}</div>
          </div>
          <div>
            <div className="text-zinc-500 text-xs mb-1">成交量</div>
            <div className="num text-zinc-200">{fmtVol(quote.volume)}</div>
          </div>
          <div>
            <div className="text-zinc-500 text-xs mb-1">52W 高低</div>
            <div className="num text-zinc-200">
              {quote.high52w?.toFixed(0) ?? '—'} / {quote.low52w?.toFixed(0) ?? '—'}
            </div>
          </div>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-2 mt-5 pt-5 border-t border-ink-700">
        <span className="text-xs text-zinc-500 mr-1">風險燈號</span>
        {leds.map((led) => (
          <div
            key={led.label}
            className="rounded-md px-2.5 py-1 flex items-center gap-2 text-xs bg-ink-800 border border-ink-700"
          >
            <span className={`w-2 h-2 rounded-full ${ledColor(led.kind)}`} />
            <span className="text-zinc-300">{led.label}</span>
          </div>
        ))}
      </div>
    </section>
  );
};
