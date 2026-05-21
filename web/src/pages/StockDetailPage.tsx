import { useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { TopNav } from '../components/TopNav';
import { WatchlistStrip } from '../components/WatchlistStrip';
import { StockDetail } from './StockDetail';
import type { UseUserPrefs } from '../hooks/useUserPrefs';

type Props = { prefs: UseUserPrefs };

export const StockDetailPage = ({ prefs }: Props) => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const symbolParam = searchParams.get('symbol')?.trim().toUpperCase() ?? '';
  const symbol = symbolParam.length >= 4 ? symbolParam : prefs.watchlist[0] ?? '2330';

  useEffect(() => {
    if (symbolParam.length < 4 && symbol.length >= 4) {
      navigate(`/stock?symbol=${symbol}`, { replace: true });
    }
  }, [symbolParam, symbol, navigate]);

  useEffect(() => {
    if (symbol.length >= 4) prefs.pushRecent(symbol);
  }, [symbol, prefs]);

  const pick = (s: string) => navigate(`/stock?symbol=${s}`);
  const starred = prefs.isInWatchlist(symbol);

  return (
    <div>
      <TopNav onAddSymbol={prefs.addToWatchlist} />
      <main className="max-w-[1400px] mx-auto px-6 py-6">
        <WatchlistStrip
          current={symbol}
          watchlist={prefs.watchlist}
          recents={prefs.recents}
          onPick={pick}
          onRemove={prefs.removeFromWatchlist}
          onRemoveRecent={prefs.removeRecent}
          onStar={prefs.toggleWatchlist}
        />
        {symbol.length >= 4 ? (
          <>
            <div className="flex items-center justify-end mb-2">
              <button
                type="button"
                onClick={() => prefs.toggleWatchlist(symbol)}
                aria-pressed={starred}
                title={starred ? '從自選移除' : '加入自選'}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-sm transition-colors ${
                  starred
                    ? 'border-amber-400/40 bg-amber-400/10 text-amber-300'
                    : 'border-ink-700 bg-ink-800 text-slate-600 hover:text-amber-300 hover:border-amber-400/40'
                }`}
              >
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill={starred ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth={2} aria-hidden>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M11.48 3.5l2.34 4.74 5.23.76-3.78 3.69.89 5.21-4.68-2.46-4.68 2.46.89-5.21L4 9l5.23-.76 2.25-4.74z" />
                </svg>
                {starred ? '已加入自選' : '加入自選'}
              </button>
            </div>
            <StockDetail symbol={symbol} />
          </>
        ) : (
          <div className="text-center py-24 text-slate-600">
            請從 watchlist 選擇一檔股票，或在搜尋框輸入代號
          </div>
        )}
      </main>
      <footer className="text-center text-xs text-slate-500 py-8">
        Tickr · 資料來源：證交所 · Yahoo Finance · 僅供參考非投資建議
      </footer>
    </div>
  );
};
