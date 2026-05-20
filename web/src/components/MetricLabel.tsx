import { useState } from 'react';
import { GLOSSARY } from '../lib/glossary';

type Props = { term: keyof typeof GLOSSARY; value?: number | null; className?: string };

export const MetricLabel = ({ term, value, className }: Props) => {
  const [open, setOpen] = useState(false);
  const t = GLOSSARY[term];
  if (!t) return null;
  const interp = t.interpret && value !== undefined ? t.interpret(value) : null;
  return (
    <span className={`inline-flex items-center gap-1 ${className ?? ''}`}>
      <span>{t.name.replace(/（.+?）/, '')}</span>
      <span
        className="relative inline-flex"
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={() => setOpen(false)}
        onClick={() => setOpen((o) => !o)}
      >
        <span className="cursor-help inline-flex items-center justify-center w-3.5 h-3.5 rounded-full bg-ink-700 text-[10px] text-slate-600 hover:bg-accent hover:text-white transition">
          i
        </span>
        {open && (
          <span className="absolute left-1/2 -translate-x-1/2 top-full mt-1 z-50 w-64 rounded-lg bg-ink-800 border border-ink-700 shadow-sm p-3 text-xs text-left shadow-xl">
            <span className="block font-medium text-slate-900 mb-1">{t.name}</span>
            <span className="block text-slate-600 mb-2 leading-relaxed">{t.definition}</span>
            {interp && (
              <span className="block pt-2 border-t border-ink-700 text-accent-soft">
                目前：{interp}
              </span>
            )}
          </span>
        )}
      </span>
    </span>
  );
};
