import { useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { TopNav } from '../components/TopNav';
import { WatchlistStrip } from '../components/WatchlistStrip';
import { StockDetail } from './StockDetail';

const STORAGE_KEY = 'fd:watchlist';

type Props = {
  watchlist: string[];
  setWatchlist: (v: string[]) => void;
};

export const StockDetailPage = ({ watchlist, setWatchlist }: Props) => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const symbolParam = searchParams.get('symbol')?.trim().toUpperCase() ?? '';
  const symbol = symbolParam.length >= 4 ? symbolParam : watchlist[0] ?? '2330';

  // If no symbol in URL, redirect to the default
  useEffect(() => {
    if (symbolParam.length < 4 && symbol.length >= 4) {
      navigate(`/stock?symbol=${symbol}`, { replace: true });
    }
  }, [symbolParam, symbol, navigate]);

  const pick = (s: string) => {
    navigate(`/stock?symbol=${s}`);
  };

  const addToWatchlist = (s: string) => {
    if (!watchlist.includes(s) && /^[A-Z0-9]{4,6}$/.test(s)) {
      const next = [s, ...watchlist].slice(0, 10);
      setWatchlist(next);
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      } catch (err) {
        console.warn('failed to persist watchlist', err);
      }
    }
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
      <TopNav watchlist={watchlist} setWatchlist={setWatchlist} onAddSymbol={addToWatchlist} />
      <main className="max-w-[1400px] mx-auto px-6 py-6">
        <WatchlistStrip current={symbol} watchlist={watchlist} onPick={pick} onRemove={remove} />
        {symbol.length >= 4 ? (
          <StockDetail symbol={symbol} />
        ) : (
          <div className="text-center py-24 text-zinc-500">
            請從 watchlist 選擇一檔股票，或在搜尋框輸入代號
          </div>
        )}
      </main>
      <footer className="text-center text-xs text-zinc-600 py-8">
        Tickr · 資料來源：證交所 · Yahoo Finance · 僅供參考非投資建議
      </footer>
    </div>
  );
};
