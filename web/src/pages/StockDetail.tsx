import { useStock } from '../hooks/useStock';
import { Hero } from '../components/Hero';
import { KpiGrid } from '../components/KpiGrid';

type Props = { symbol: string };

export const StockDetail = ({ symbol }: Props) => {
  const { data, isLoading, error } = useStock(symbol);

  if (isLoading) return <div className="text-zinc-500">載入中…</div>;
  if (error) return <div className="text-down">錯誤：{(error as Error).message}</div>;
  if (!data) return null;

  return (
    <>
      <Hero quote={data.data.quote} />
      <KpiGrid kpi={data.data.kpi} />
      {data.warnings && (
        <div className="mt-3 text-xs text-amber-400">
          注意：{data.warnings.join(', ')}
        </div>
      )}
    </>
  );
};
