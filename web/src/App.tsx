import { useEffect, useState } from 'react';
import { Routes, Route } from 'react-router-dom';
import { DashboardPage } from './pages/DashboardPage';
import { DigestHistory } from './pages/DigestHistory';

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

  return (
    <Routes>
      <Route
        path="/"
        element={
          <DashboardPage
            symbol={symbol}
            input={input}
            setInput={setInput}
            setSymbol={setSymbol}
            watchlist={watchlist}
            setWatchlist={setWatchlist}
          />
        }
      />
      <Route path="/digest" element={<DigestHistory watchlist={watchlist} />} />
    </Routes>
  );
};
