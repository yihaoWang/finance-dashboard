import { useStock } from '../hooks/useStock';
import { Hero } from '../components/Hero';
import { KpiGrid } from '../components/KpiGrid';
import { PriceChart } from '../components/PriceChart';
import { MacroPanel } from '../components/MacroPanel';
import { AnalysisPanels } from '../components/AnalysisPanels';

type Props = { symbol: string };

export const StockDetail = ({ symbol }: Props) => {
  const { data, isLoading, error } = useStock(symbol);

  if (isLoading) return <div className="text-zinc-500 p-6">載入中…</div>;
  if (error) return <div className="text-down p-6">錯誤：{(error as Error).message}</div>;
  if (!data) return null;

  const { quote, kpi } = data.data;

  return (
    <>
      <Hero quote={quote} kpi={kpi} />
      <KpiGrid kpi={kpi} />
      <section className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
        <PriceChart price={quote.price} high52w={quote.high52w} low52w={quote.low52w} />
        <MacroPanel />
      </section>
      <AnalysisPanels kpi={kpi} quote={quote} />
      {data.warnings && (
        <div className="mt-3 text-xs text-amber-400">注意：{data.warnings.join(', ')}</div>
      )}
    </>
  );
};
