import { useEffect, useState } from 'react';
import { Routes, Route } from 'react-router-dom';
import { MarketOverviewPage } from './pages/MarketOverviewPage';
import { StockDetailPage } from './pages/StockDetailPage';
import { FinancialsPage } from './pages/FinancialsPage';
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
  const [watchlist, setWatchlist] = useState<string[]>(DEFAULT_WATCHLIST);

  useEffect(() => {
    setWatchlist(loadWatchlist());
  }, []);

  return (
    <Routes>
      <Route
        path="/"
        element={<MarketOverviewPage watchlist={watchlist} setWatchlist={setWatchlist} />}
      />
      <Route
        path="/stock"
        element={<StockDetailPage watchlist={watchlist} setWatchlist={setWatchlist} />}
      />
      <Route path="/digest" element={<DigestHistory watchlist={watchlist} />} />
      <Route
        path="/financials"
        element={<FinancialsPage watchlist={watchlist} setWatchlist={setWatchlist} />}
      />
    </Routes>
  );
};
