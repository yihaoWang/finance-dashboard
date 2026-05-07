import type { Kpi } from '@fd/shared';
import { KpiCard } from './KpiCard';

type Props = { kpi: Kpi };

export const KpiGrid = ({ kpi }: Props) => (
  <section className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
    <KpiCard label="P/E (TTM)" value={kpi.pe} />
    <KpiCard label="Forward P/E" value={kpi.forwardPe} />
    <KpiCard label="EPS (近四季)" value={kpi.ttmEps} />
    <KpiCard label="毛利率" value={kpi.grossMargin} unit="%" />
    <KpiCard label="月營收 YoY" value={kpi.monthlyRevenueYoy} unit="%" />
    <KpiCard label="月線乖離" value={kpi.ma20Deviation} unit="%" />
  </section>
);
