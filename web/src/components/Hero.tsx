import type { Quote } from '@fd/shared';

type Props = { quote: Quote };

export const Hero = ({ quote }: Props) => {
  const isUp = quote.change >= 0;
  return (
    <section className="rounded-2xl bg-ink-900 border border-ink-700 p-6 mb-6">
      <div className="flex items-center gap-3 mb-2">
        <h1 className="text-2xl font-semibold text-zinc-100">{quote.name}</h1>
        <span className="text-zinc-500 num text-sm">{quote.symbol}</span>
      </div>
      <div className="flex items-baseline gap-3">
        <div className="text-5xl font-semibold num text-zinc-100">{quote.price.toFixed(2)}</div>
        <div className={`num text-lg ${isUp ? 'text-up' : 'text-down'}`}>
          {isUp ? '+' : ''}{quote.change.toFixed(2)} ({quote.changePct.toFixed(2)}%)
        </div>
      </div>
      <div className="text-xs text-zinc-500 mt-2 num">
        最後更新 {new Date(quote.updatedAt).toLocaleTimeString('zh-TW')}
      </div>
    </section>
  );
};
