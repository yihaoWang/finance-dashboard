import { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';

const NAV_LINKS: { path: string; label: string }[] = [
  { path: '/', label: '📊 總體市場' },
  { path: '/stock', label: '📈 個股分析' },
  { path: '/financials', label: '📑 財報' },
  { path: '/screener', label: '🎯 選股' },
];

type Props = {
  watchlist?: string[];
  setWatchlist?: (v: string[]) => void;
  onAddSymbol?: (symbol: string) => void;
};

export const TopNav = ({ onAddSymbol }: Props) => {
  const [input, setInput] = useState('');
  const navigate = useNavigate();
  const location = useLocation();

  const isActive = (path: string) => {
    if (path === '/') return location.pathname === '/';
    return location.pathname.startsWith(path);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const v = input.trim().toUpperCase();
    if (v.length < 4) return;
    onAddSymbol?.(v);
    navigate(`/stock?symbol=${v}`);
    setInput('');
  };

  return (
    <header className="sticky top-0 z-20 backdrop-blur bg-ink-950/80 border-b border-ink-700">
      <div className="max-w-[1400px] mx-auto px-6 py-3 flex items-center gap-4 flex-wrap">
        <Link to="/" className="flex items-center gap-2 shrink-0">
          <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-accent to-accent-soft" />
          <span className="font-semibold text-slate-900">Tickr</span>
        </Link>
        <nav className="flex items-center gap-1 text-sm">
          {NAV_LINKS.map(({ path, label }) => (
            <Link
              key={path}
              to={path}
              className={`px-3 py-1.5 rounded-md transition-colors whitespace-nowrap ${
                isActive(path)
                  ? 'text-slate-900 border-b-2 border-accent'
                  : 'text-slate-600 hover:text-slate-800 hover:bg-ink-800'
              }`}
            >
              {label}
            </Link>
          ))}
        </nav>
        <div className="flex-1 min-w-[200px] max-w-sm ml-2">
          <form onSubmit={handleSubmit} className="relative">
            <input
              className="w-full bg-ink-900 border border-ink-700 shadow-sm rounded-lg pl-9 pr-3 py-2 text-sm text-slate-800 placeholder-slate-500 focus:outline-none focus:border-accent"
              placeholder="輸入股票代號（例：2330）"
              value={input}
              onChange={(e) => setInput(e.target.value)}
            />
            <svg
              className="absolute left-3 top-2.5 w-4 h-4 text-slate-600"
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
        <a
          href="/cdn-cgi/access/logout"
          className="ml-auto text-xs text-slate-600 hover:text-slate-900 px-3 py-1.5 rounded-md hover:bg-ink-800 whitespace-nowrap"
          title="登出"
        >
          登出
        </a>
      </div>
    </header>
  );
};
