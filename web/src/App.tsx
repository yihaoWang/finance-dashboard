import { useEffect, useState } from 'react';
import { TopNav } from './components/TopNav';
import { WatchlistStrip } from './components/WatchlistStrip';
import { StockDetail } from './pages/StockDetail';

const STORAGE_KEY = 'fd:watchlist';
const DEFAULT_WATCHLIST = ['2330', '2454', '2317', '3008', '2308'];

const loadWatchlist = (): string[] => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_WATCHLIST;
    const parsed = JSON.parse(raw) as unknown;
    if (Array.isArray(parsed) && parsed.every((s) => typeof s === 'string')) return parsed;
    return DEFAULT_WATCHLIST;
  } catch (err) {
    console.warn('failed to load watchlist', err);
    return DEFAULT_WATCHLIST;
  }
};

export const App = () => {
  const [symbol, setSymbol] = useState('2330');
  const [input, setInput] = useState('2330');
  const [watchlist, setWatchlist] = useState<string[]>(DEFAULT_WATCHLIST);

  useEffect(() => {
    setWatchlist(loadWatchlist());
  }, []);

  const submit = () => {
    const v = input.trim().toUpperCase();
    if (v.length === 0) return;
    setSymbol(v);
    if (!watchlist.includes(v) && /^[A-Z0-9]{4,6}$/.test(v)) {
      const next = [v, ...watchlist].slice(0, 10);
      setWatchlist(next);
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      } catch (err) {
        console.warn('failed to persist watchlist', err);
      }
    }
  };

  const pick = (s: string) => {
    setSymbol(s);
    setInput(s);
  };

  return (
    <div>
      <TopNav input={input} onInputChange={setInput} onSubmit={submit} />
      <main className="max-w-[1400px] mx-auto px-6 py-6">
        <WatchlistStrip current={symbol} watchlist={watchlist} onPick={pick} />
        <StockDetail symbol={symbol} />
      </main>
      <footer className="text-center text-xs text-zinc-600 py-8">
        Tickr · 資料來源：證交所 · Yahoo Finance · 僅供參考非投資建議
      </footer>
    </div>
  );
};
