import { Routes, Route } from 'react-router-dom';
import { MarketOverviewPage } from './pages/MarketOverviewPage';
import { StockDetailPage } from './pages/StockDetailPage';
import { FinancialsPage } from './pages/FinancialsPage';
import { DigestHistory } from './pages/DigestHistory';
import { ScreenerPage } from './pages/ScreenerPage';
import { useUserPrefs } from './hooks/useUserPrefs';

export const App = () => {
  const prefs = useUserPrefs();

  return (
    <Routes>
      <Route path="/" element={<MarketOverviewPage prefs={prefs} />} />
      <Route path="/stock" element={<StockDetailPage prefs={prefs} />} />
      <Route path="/digest" element={<DigestHistory watchlist={prefs.watchlist} />} />
      <Route path="/financials" element={<FinancialsPage prefs={prefs} />} />
      <Route path="/screener" element={<ScreenerPage prefs={prefs} />} />
    </Routes>
  );
};
