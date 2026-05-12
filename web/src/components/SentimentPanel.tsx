import { useSentiment } from '../hooks/useSentiment';
import { FearGreedGauge } from './FearGreedGauge';
import { SentimentCard } from './SentimentCard';

export const SentimentPanel = () => {
  const { data, isLoading, error } = useSentiment();
  if (isLoading) return <div className="text-sm text-slate-500">載入市場情緒…</div>;
  if (error !== null || data === undefined) return <div className="text-sm text-red-400">市場情緒載入失敗</div>;
  return (
    <section className="rounded-xl border border-slate-800 bg-slate-900/40 p-5">
      <h2 className="mb-4 text-lg font-semibold text-slate-100">市場情緒</h2>
      <div className="grid grid-cols-1 gap-5 md:grid-cols-[260px_1fr]">
        <FearGreedGauge snapshot={data.data.fearGreed} />
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {data.data.indicators.map((ind) => (
            <SentimentCard key={ind.key} indicator={ind} />
          ))}
        </div>
      </div>
    </section>
  );
};
