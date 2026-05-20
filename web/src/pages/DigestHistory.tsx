import { useSearchParams } from 'react-router-dom';
import { TopNav } from '../components/TopNav';
import { DigestSection } from '../components/DigestSection';
import { useDigestHistory } from '../hooks/useDigestHistory';
import { useDigest } from '../hooks/useDigest';
import type { DigestScope } from '@fd/shared';

type Props = { watchlist: string[] };

export const DigestHistory = ({ watchlist }: Props) => {
  const [searchParams, setSearchParams] = useSearchParams();
  const scope = (searchParams.get('scope') ?? 'market') as DigestScope;
  const symbol = searchParams.get('symbol') ?? undefined;
  const date = searchParams.get('date') ?? undefined;

  const historyQuery = useDigestHistory(scope, scope === 'stock' ? symbol : undefined);
  const digestQuery = useDigest(scope === 'market' ? 'market' : (symbol ?? 'market'), date);

  const setScope = (s: DigestScope) => {
    const next = new URLSearchParams({ scope: s });
    if (s === 'stock' && watchlist[0] !== undefined) {
      next.set('symbol', watchlist[0]);
    }
    setSearchParams(next);
  };

  const setSymbol = (s: string) => {
    setSearchParams({ scope: 'stock', symbol: s });
  };

  const selectDate = (d: string) => {
    const next = new URLSearchParams(searchParams);
    next.set('date', d);
    setSearchParams(next);
  };

  const historyItems = historyQuery.data?.data ?? [];

  return (
    <div className="min-h-screen bg-ink-950">
      <TopNav />
      <div className="max-w-[1400px] mx-auto px-6 py-6 flex gap-6">
        {/* Sidebar */}
        <aside className="w-64 shrink-0">
          {/* Scope selector */}
          <div className="mb-4 flex gap-2">
            <button
              type="button"
              onClick={() => setScope('market')}
              className={`flex-1 py-1.5 rounded-md text-sm transition-colors ${
                scope === 'market'
                  ? 'bg-accent text-white'
                  : 'bg-ink-800 text-slate-600 hover:text-slate-800'
              }`}
            >
              大盤
            </button>
            <button
              type="button"
              onClick={() => setScope('stock')}
              className={`flex-1 py-1.5 rounded-md text-sm transition-colors ${
                scope === 'stock'
                  ? 'bg-accent text-white'
                  : 'bg-ink-800 text-slate-600 hover:text-slate-800'
              }`}
            >
              個股
            </button>
          </div>

          {scope === 'stock' && (
            <select
              value={symbol ?? ''}
              onChange={(e) => setSymbol(e.target.value)}
              className="w-full mb-4 bg-ink-800 border border-ink-700 shadow-sm rounded-md px-3 py-2 text-sm text-slate-800 focus:outline-none focus:border-accent"
            >
              {watchlist.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          )}

          {/* Date list */}
          <div className="border border-ink-700 rounded-lg overflow-hidden">
            {historyQuery.isLoading && (
              <div className="p-4 text-sm text-slate-600">載入中…</div>
            )}
            {historyQuery.isError && (
              <div className="p-4 text-sm text-slate-600">無法載入歷史記錄</div>
            )}
            {historyItems.length === 0 && !historyQuery.isLoading && (
              <div className="p-4 text-sm text-slate-600">尚無歷史記錄</div>
            )}
            {historyItems.map((item) => (
              <button
                key={`${item.date}-${item.symbol}`}
                type="button"
                onClick={() => selectDate(item.date)}
                className={`w-full text-left px-4 py-3 text-sm border-b border-ink-700 last:border-0 transition-colors ${
                  date === item.date
                    ? 'bg-accent/20 text-slate-900'
                    : 'text-slate-600 hover:bg-ink-800 hover:text-slate-800'
                }`}
              >
                {item.date}
              </button>
            ))}
          </div>
        </aside>

        {/* Main content */}
        <main className="flex-1 min-w-0">
          {digestQuery.isLoading && (
            <div className="text-slate-600 text-sm">載入中…</div>
          )}
          {digestQuery.isError && (
            <div className="text-slate-600 text-sm">
              {date !== undefined ? `${date} 尚無摘要` : '請從左側選擇日期'}
            </div>
          )}
          {!digestQuery.isLoading && !digestQuery.isError && digestQuery.data === undefined && (
            <div className="text-slate-600 text-sm">請從左側選擇日期</div>
          )}
          {digestQuery.data !== undefined && (
            <div>
              <div className="flex items-center gap-3 mb-5">
                <span className="text-lg">🤖</span>
                <h1 className="text-lg font-semibold text-slate-900">
                  AI 解讀 · {digestQuery.data.data.date}
                </h1>
                <span className="text-xs text-slate-600">{digestQuery.data.data.model}</span>
              </div>
              <DigestSection sections={digestQuery.data.data.sections} />
              {digestQuery.data.data.sources.length > 0 && (
                <div className="mt-6 border-t border-ink-700 pt-4">
                  <p className="text-xs text-slate-600 mb-2">資料來源</p>
                  <ul className="flex flex-col gap-1">
                    {digestQuery.data.data.sources.map((src) => (
                      <li key={src.url}>
                        <a
                          href={src.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs text-accent hover:underline"
                        >
                          {src.name}
                        </a>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </main>
      </div>
    </div>
  );
};
