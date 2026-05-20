import { useStock } from '../hooks/useStock';
import { useValuation } from '../hooks/useValuation';
import { Hero } from '../components/Hero';
import { PeacePanel } from '../components/PeacePanel';
import { PriceChart } from '../components/PriceChart';
import { AnalysisPanels } from '../components/AnalysisPanels';
import { NewsPanel } from '../components/NewsPanel';
import { ValuationGaugePanel } from '../components/ValuationGaugePanel';

type Props = { symbol: string };

export const StockDetail = ({ symbol }: Props) => {
  const { data, isLoading, error } = useStock(symbol);
  const { data: valuationData } = useValuation(symbol);

  if (isLoading) return <div className="text-slate-600 p-6">載入中…</div>;
  if (error) return <div className="text-down p-6">錯誤：{(error as Error).message}</div>;
  if (!data) return null;

  const { quote, kpi, history, chips } = data.data;

  return (
    <>
      <div id="overview" className="scroll-mt-24">
        <Hero quote={quote} kpi={kpi} valuation={valuationData?.data ?? null} />
      </div>
      <PriceChart symbol={symbol} price={quote.price} high52w={quote.high52w} low52w={quote.low52w} defaultHistory={history} />
      <AnalysisPanels kpi={kpi} quote={quote} chips={chips} />
      <ValuationGaugePanel symbol={symbol} />
      <PeacePanel symbol={symbol} />
      <NewsPanel symbol={symbol} />
      {data.warnings && (
        <div className="mt-3 text-xs text-amber-400">注意：{data.warnings.join(', ')}</div>
      )}
    </>
  );
};
