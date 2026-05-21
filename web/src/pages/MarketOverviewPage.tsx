import { TopNav } from '../components/TopNav';
import { DigestCard } from '../components/DigestCard';
import { SentimentPanel } from '../components/SentimentPanel';
import { MacroPanel } from '../components/MacroPanel';
import type { UseUserPrefs } from '../hooks/useUserPrefs';

type Props = { prefs: UseUserPrefs };

export const MarketOverviewPage = ({ prefs }: Props) => (
  <div>
    <TopNav onAddSymbol={prefs.addToWatchlist} />
    <main className="max-w-[1400px] mx-auto px-6 py-6">
      <MacroPanel />
      <DigestCard symbol="market" />
      <div className="mb-6">
        <SentimentPanel />
      </div>
    </main>
    <footer className="text-center text-xs text-slate-500 py-8">
      Tickr · 資料來源：證交所 · Yahoo Finance · FRED · 僅供參考非投資建議
    </footer>
  </div>
);
