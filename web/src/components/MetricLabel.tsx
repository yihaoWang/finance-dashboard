import { GLOSSARY } from '../lib/glossary';
import { InfoTooltip } from './InfoTooltip';

type Props = { term: keyof typeof GLOSSARY; value?: number | null; className?: string };

export const MetricLabel = ({ term, value, className }: Props) => {
  const t = GLOSSARY[term];
  if (!t) return null;
  const interp = t.interpret && value !== undefined ? t.interpret(value) : null;
  return (
    <span className={`inline-flex items-center gap-1 ${className ?? ''}`}>
      <span>{t.name.replace(/（.+?）/, '')}</span>
      <InfoTooltip width={260}>
        <div className="font-semibold text-slate-900 mb-1">{t.name}</div>
        <div className="text-slate-600 leading-relaxed">{t.definition}</div>
        {interp && (
          <div className="pt-2 mt-2 border-t border-slate-200 text-violet-600">
            目前：{interp}
          </div>
        )}
      </InfoTooltip>
    </span>
  );
};
