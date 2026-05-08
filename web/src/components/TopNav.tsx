import { useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';

type Props = {
  currentSymbol?: string;
  input: string;
  onInputChange: (v: string) => void;
  onSubmit: () => void;
};

const SCROLL_TABS: { id: string; label: string }[] = [
  { id: 'overview', label: '總覽' },
  { id: 'fundamentals', label: '基本面' },
  { id: 'technicals', label: '技術面' },
  { id: 'chips', label: '籌碼' },
  { id: 'macro', label: '宏觀' },
];

const HEADER_OFFSET = 80;

const scrollToSection = (id: string) => {
  const el = document.getElementById(id);
  if (!el) return;
  const top = el.getBoundingClientRect().top + window.scrollY - HEADER_OFFSET;
  window.scrollTo({ top, behavior: 'smooth' });
};

export const TopNav = ({ currentSymbol, input, onInputChange, onSubmit }: Props) => {
  const [activeSection, setActiveSection] = useState('overview');
  const navigate = useNavigate();
  const location = useLocation();

  const isDigestPage = location.pathname.startsWith('/digest');
  const isFinancialsPage = location.pathname.startsWith('/financials');

  useEffect(() => {
    if (isDigestPage || isFinancialsPage) return;
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio);
        if (visible[0] !== undefined) setActiveSection(visible[0].target.id);
      },
      { rootMargin: `-${HEADER_OFFSET + 20}px 0px -50% 0px`, threshold: [0, 0.25, 0.5, 1] },
    );
    for (const tab of SCROLL_TABS) {
      const el = document.getElementById(tab.id);
      if (el) observer.observe(el);
    }
    return () => observer.disconnect();
  }, [isDigestPage]);

  const handleScrollTab = (id: string) => {
    if (isDigestPage || isFinancialsPage) {
      navigate(`/#${id}`);
    } else {
      scrollToSection(id);
    }
  };

  return (
    <header className="sticky top-0 z-20 backdrop-blur bg-ink-950/80 border-b border-ink-700">
      <div className="max-w-[1400px] mx-auto px-6 py-3 flex items-center gap-4 flex-wrap">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-accent to-accent-soft" />
          <span className="font-semibold text-zinc-100">Tickr</span>
        </div>
        <div className="flex-1 min-w-[240px] max-w-md ml-2">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              onSubmit();
            }}
            className="relative"
          >
            <input
              className="w-full bg-ink-900 border border-ink-700 rounded-lg pl-9 pr-3 py-2 text-sm text-zinc-200 placeholder-zinc-500 focus:outline-none focus:border-accent"
              placeholder="輸入股票代號或名稱（例：2330、台積電）"
              value={input}
              onChange={(e) => onInputChange(e.target.value)}
            />
            <svg
              className="absolute left-3 top-2.5 w-4 h-4 text-zinc-500"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              aria-hidden
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M21 21l-4.35-4.35M11 19a8 8 0 100-16 8 8 0 000 16z"
              />
            </svg>
          </form>
        </div>
        <nav className="flex items-center gap-1 text-sm text-zinc-400">
          {SCROLL_TABS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => handleScrollTab(tab.id)}
              className={`px-3 py-1.5 rounded-md transition-colors ${
                !isDigestPage && activeSection === tab.id
                  ? 'text-zinc-100 bg-ink-800'
                  : 'hover:bg-ink-800 hover:text-zinc-200'
              }`}
            >
              {tab.label}
            </button>
          ))}
          <button
            type="button"
            onClick={() => navigate('/digest')}
            className={`px-3 py-1.5 rounded-md transition-colors ${
              isDigestPage
                ? 'text-zinc-100 bg-ink-800'
                : 'hover:bg-ink-800 hover:text-zinc-200'
            }`}
          >
            AI 解讀
          </button>
          <button
            type="button"
            onClick={() => navigate(`/financials?symbol=${encodeURIComponent(currentSymbol ?? '2330')}`)}
            className={`px-3 py-1.5 rounded-md transition-colors ${
              isFinancialsPage
                ? 'text-zinc-100 bg-ink-800'
                : 'hover:bg-ink-800 hover:text-zinc-200'
            }`}
          >
            財報分析
          </button>
        </nav>
        <button
          type="button"
          onClick={onSubmit}
          className="ml-auto px-3 py-1.5 rounded-md bg-accent text-white text-sm"
        >
          查詢
        </button>
      </div>
    </header>
  );
};
