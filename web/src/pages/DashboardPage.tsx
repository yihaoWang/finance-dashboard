import { TopNav } from '../components/TopNav';
import { WatchlistStrip } from '../components/WatchlistStrip';
import { DigestCard } from '../components/DigestCard';
import { StockDetail } from './StockDetail';

type Props = {
  symbol: string;
  input: string;
  setInput: (v: string) => void;
  setSymbol: (v: string) => void;
  watchlist: string[];
  setWatchlist: (v: string[]) => void;
};

const STORAGE_KEY = 'fd:watchlist';

export const DashboardPage = ({ symbol, input, setInput, setSymbol, watchlist, setWatchlist }: Props) => {
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

  const remove = (s: string) => {
    const next = watchlist.filter((x) => x !== s);
    setWatchlist(next);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch (err) {
      console.warn('failed to persist watchlist', err);
    }
  };

  return (
    <div>
      <TopNav input={input} onInputChange={setInput} onSubmit={submit} />
      <main className="max-w-[1400px] mx-auto px-6 py-6">
        <WatchlistStrip current={symbol} watchlist={watchlist} onPick={pick} onRemove={remove} />
        <DigestCard symbol={symbol} />
        <StockDetail symbol={symbol} />
      </main>
      <footer className="text-center text-xs text-zinc-600 py-8">
        Tickr · 資料來源：證交所 · Yahoo Finance · 僅供參考非投資建議
      </footer>
    </div>
  );
};
