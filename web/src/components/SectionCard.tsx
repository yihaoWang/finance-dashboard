import { useEffect, useState, type ReactNode } from 'react';

type Props = {
  title: ReactNode;
  subtitle?: ReactNode;
  actions?: ReactNode;
  id?: string;
  storageKey?: string;
  defaultOpen?: boolean;
  collapsible?: boolean;
  className?: string;
  bodyClassName?: string;
  bodyPadding?: 'none' | 'sm' | 'md';
  /** Set to true when card sits inside a parent grid — drops the default mb-6 spacing */
  inGrid?: boolean;
  children: ReactNode;
};

const KEY_PREFIX = 'fd:section:';

const readInitial = (key: string | undefined, defaultOpen: boolean): boolean => {
  if (key === undefined || typeof window === 'undefined') return defaultOpen;
  try {
    const raw = window.localStorage.getItem(KEY_PREFIX + key);
    if (raw === null) return defaultOpen;
    return raw === '1';
  } catch {
    return defaultOpen;
  }
};

export const SectionCard = ({
  title,
  subtitle,
  actions,
  id,
  storageKey,
  defaultOpen = true,
  collapsible = true,
  className,
  bodyClassName,
  bodyPadding = 'md',
  inGrid = false,
  children,
}: Props) => {
  const persistKey = storageKey ?? id;
  const [open, setOpen] = useState<boolean>(() => readInitial(persistKey, defaultOpen));

  useEffect(() => {
    if (persistKey === undefined || typeof window === 'undefined') return;
    try {
      window.localStorage.setItem(KEY_PREFIX + persistKey, open ? '1' : '0');
    } catch {
      // ignore quota / private-mode errors
    }
  }, [open, persistKey]);

  const padClass = bodyPadding === 'none' ? '' : bodyPadding === 'sm' ? 'p-4' : 'p-5';

  return (
    <section
      id={id}
      className={`rounded-2xl bg-ink-900 border border-ink-700 shadow-sm ${inGrid ? '' : 'mb-6'} overflow-hidden scroll-mt-24 ${className ?? ''}`}
    >
      <header
        className={`flex items-center justify-between gap-3 px-5 py-3 ${open ? 'border-b border-ink-700' : ''}`}
      >
        <div className="flex items-baseline gap-3 min-w-0">
          <h2 className="text-sm font-semibold text-slate-900 truncate">{title}</h2>
          {subtitle !== undefined && (
            <span className="text-xs text-slate-500 truncate">{subtitle}</span>
          )}
        </div>
        <div className="flex items-center gap-3 shrink-0">
          {actions}
          {collapsible && (
            <button
              type="button"
              onClick={() => setOpen((o) => !o)}
              aria-label={open ? '收起' : '展開'}
              aria-expanded={open}
              className="text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-md p-1 transition-colors"
            >
              <svg
                width="16"
                height="16"
                viewBox="0 0 16 16"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
                className={`transition-transform ${open ? '' : '-rotate-90'}`}
                aria-hidden="true"
              >
                <path d="M4 6l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
          )}
        </div>
      </header>
      {open && (
        <div className={`${padClass} ${bodyClassName ?? ''}`}>{children}</div>
      )}
    </section>
  );
};
