import type { Kpi } from '@fd/shared';
import { KpiCard } from './KpiCard';
import { MetricLabel } from './MetricLabel';

type Props = { kpi: Kpi };

const yoyHint = (v: number | null): { hint?: string; tone: 'up' | 'down' | 'mute' } => {
  if (v === null) return { tone: 'mute' };
  if (v > 0) return { hint: `YoY +${v.toFixed(1)}%`, tone: 'up' };
  return { hint: `YoY ${v.toFixed(1)}%`, tone: 'down' };
};

const peHint = (v: number | null): { hint?: string; tone: 'up' | 'down' | 'mute' } => {
  if (v === null) return { tone: 'mute' };
  if (v > 30) return { hint: '偏高', tone: 'down' };
  if (v < 15) return { hint: '合理偏低', tone: 'up' };
  return { hint: '中性區間', tone: 'mute' };
};

const devHint = (v: number | null): { hint?: string; tone: 'up' | 'down' | 'mute' } => {
  if (v === null) return { tone: 'mute' };
  if (v > 10) return { hint: '注意過熱', tone: 'down' };
  if (v < -10) return { hint: '可能反彈', tone: 'up' };
  return { hint: '中性', tone: 'mute' };
};

export const KpiGrid = ({ kpi }: Props) => {
  const pe = peHint(kpi.pe);
  const yoy = yoyHint(kpi.monthlyRevenueYoy);
  const dev = devHint(kpi.ma20Deviation);
  return (
    <section className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 mb-6">
      <KpiCard label={<MetricLabel term="pe" value={kpi.pe} />} value={kpi.pe} hint={pe.hint} hintTone={pe.tone} />
      <KpiCard label={<MetricLabel term="forwardPe" value={kpi.forwardPe} />} value={kpi.forwardPe} />
      <KpiCard label={<MetricLabel term="ttmEps" value={kpi.ttmEps} />} value={kpi.ttmEps} />
      <KpiCard label={<MetricLabel term="grossMargin" value={kpi.grossMargin} />} value={kpi.grossMargin} unit="%" />
      <KpiCard
        label={<MetricLabel term="monthlyRevenueYoy" value={kpi.monthlyRevenueYoy} />}
        value={kpi.monthlyRevenueYoy}
        unit="%"
        digits={1}
        hint={yoy.hint}
        hintTone={yoy.tone}
      />
      <KpiCard
        label={<MetricLabel term="ma20Deviation" value={kpi.ma20Deviation} />}
        value={kpi.ma20Deviation}
        unit="%"
        hint={dev.hint}
        hintTone={dev.tone}
      />
    </section>
  );
};
