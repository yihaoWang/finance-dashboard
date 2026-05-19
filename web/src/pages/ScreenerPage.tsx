import { Link } from 'react-router-dom';
import { TopNav } from '../components/TopNav';
import { useScreener } from '../hooks/useScreener';
import type { ScreenerRow } from '@fd/shared';

type Props = {
  watchlist: string[];
  setWatchlist: (v: string[]) => void;
};

const decisionOf = (r: ScreenerRow): 'buy' | 'watch' | 'avoid' => {
  if (r.priorityScore >= 5 && r.score >= 11) return 'buy';
  if (r.score >= 8) return 'watch';
  return 'avoid';
};

const DECISION_LABEL = { buy: '買入', watch: '觀望', avoid: '不碰' } as const;
const DECISION_CLASS = {
  buy: 'text-emerald-400',
  watch: 'text-amber-400',
  avoid: 'text-red-400',
} as const;

const ScoreBar = ({ score, total }: { score: number; total: number }) => {
  const pct = total === 0 ? 0 : (score / total) * 100;
  const color = pct >= 70 ? 'bg-emerald-500' : pct >= 50 ? 'bg-amber-500' : 'bg-red-500';
  return (
    <div className="flex items-center gap-2 min-w-[120px]">
      <div className="flex-1 h-1.5 bg-zinc-800 rounded overflow-hidden">
        <div className={`h-full ${color}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-zinc-300 tabular-nums text-xs">
        {score}<span className="text-zinc-600">/{total}</span>
      </span>
    </div>
  );
};

export const ScreenerPage = ({ watchlist, setWatchlist }: Props) => {
  const { data, isLoading, error } = useScreener();

  return (
    <div>
      <TopNav watchlist={watchlist} setWatchlist={setWatchlist} />
      <main className="max-w-[1400px] mx-auto px-6 py-6">
        <header className="mb-6">
          <h1 className="text-2xl font-bold text-zinc-100">🎯 PEACE 選股</h1>
          <p className="text-sm text-zinc-500 mt-1">
            依 16 項量化指標排序，優先項 ≥ 5/6 且總分 ≥ 11/16 列入買入推薦。每日 08:00（台北）自動掃描更新。
          </p>
        </header>

        {isLoading ? (
          <div className="text-sm text-zinc-400 p-4">載入中…</div>
        ) : error !== null || data === undefined ? (
          <div className="text-sm text-red-400 p-4">載入失敗</div>
        ) : (
          <>
            <section className="mb-8 rounded-lg border border-emerald-600/30 bg-emerald-500/5 p-5">
              <h2 className="text-base font-semibold text-emerald-300 mb-3">
                ⭐ 推薦買入（{data.data.recommended.length} 檔）
              </h2>
              {data.data.recommended.length === 0 ? (
                <p className="text-sm text-zinc-500">尚無符合買入門檻的標的。</p>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                  {data.data.recommended.map((r) => (
                    <Link
                      key={r.symbol}
                      to={`/stock?symbol=${r.symbol}`}
                      className="rounded-lg border border-zinc-800 bg-zinc-900/60 p-3 hover:border-emerald-500/50 transition-colors"
                    >
                      <div className="flex items-baseline justify-between mb-1.5">
                        <span className="font-semibold text-zinc-100">{r.symbol}</span>
                        <span className="text-xs text-emerald-400 font-bold">
                          優先 {r.priorityScore}/{r.priorityTotal}
                        </span>
                      </div>
                      <ScoreBar score={r.score} total={r.total} />
                    </Link>
                  ))}
                </div>
              )}
            </section>

            <section className="rounded-lg border border-zinc-800 bg-zinc-900/40">
              <header className="px-4 py-2.5 border-b border-zinc-800 flex items-center justify-between">
                <h2 className="text-sm font-semibold text-zinc-200">
                  完整排行（{data.data.rows.length} 檔）
                </h2>
                <span className="text-xs text-zinc-500">
                  {data.data.updatedAt
                    ? `更新於 ${new Date(data.data.updatedAt).toLocaleString('zh-TW')}`
                    : '尚未掃描'}
                </span>
              </header>
              <table className="w-full text-xs">
                <thead className="text-[11px] text-zinc-500 border-b border-zinc-800">
                  <tr>
                    <th className="text-left px-4 py-2 font-medium">代號</th>
                    <th className="text-center px-4 py-2 font-medium">決策</th>
                    <th className="text-left px-4 py-2 font-medium">總分</th>
                    <th className="text-right px-4 py-2 font-medium">優先 (6 項)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-800/60">
                  {data.data.rows.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="px-4 py-6 text-center text-zinc-500">
                        尚無資料，每日 cron 跑完才會填入。
                      </td>
                    </tr>
                  ) : (
                    data.data.rows.map((r) => {
                      const d = decisionOf(r);
                      return (
                        <tr key={r.symbol} className="hover:bg-zinc-800/40">
                          <td className="px-4 py-2">
                            <Link
                              to={`/stock?symbol=${r.symbol}`}
                              className="text-zinc-100 font-medium hover:text-accent"
                            >
                              {r.symbol}
                            </Link>
                          </td>
                          <td className={`px-4 py-2 text-center font-medium ${DECISION_CLASS[d]}`}>
                            {DECISION_LABEL[d]}
                          </td>
                          <td className="px-4 py-2">
                            <ScoreBar score={r.score} total={r.total} />
                          </td>
                          <td className="px-4 py-2 text-right text-zinc-300 tabular-nums">
                            {r.priorityScore}<span className="text-zinc-600">/{r.priorityTotal}</span>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </section>
          </>
        )}
      </main>
    </div>
  );
};
