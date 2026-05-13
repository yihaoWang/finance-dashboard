import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { TopNav } from '../components/TopNav';
import { WatchlistStrip } from '../components/WatchlistStrip';
import { useFinancials } from '../hooks/useFinancials';
import { mopsLinks } from '../lib/mops';
import type { QuarterRow } from '@fd/shared';

const STORAGE_KEY = 'fd:watchlist';
const DEFAULT_WATCHLIST = ['2330', '2454', '2317', '3008', '2308'];

const SYMBOL_NAMES: Record<string, string> = {
  '2308': '台達電',
  '2317': '鴻海',
  '2330': '台積電',
  '2454': '聯發科',
  '3008': '大立光',
};

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

const fmt = (v: number | null, decimals = 1): string =>
  v === null ? '—' : v.toFixed(decimals);

const fmtRevenue = (v: number | null): string => {
  if (v === null) return '—';
  const yi = v / 100_000_000;
  if (yi >= 10_000) return `${(yi / 10_000).toFixed(2)}兆`;
  return `${yi.toFixed(0)}億`;
};

type MetricKey = keyof Omit<QuarterRow, 'year' | 'quarter'>;

type DeltaKind = 'pp' | 'pct' | 'abs2' | 'abs1';

const DELTA_KIND: Record<MetricKey, DeltaKind> = {
  revenue: 'pct',
  grossMargin: 'pp',
  opMargin: 'pp',
  netMargin: 'pp',
  roe: 'pp',
  eps: 'abs2',
};

const computeDelta = (
  key: MetricKey,
  current: number | null,
  prev: number | null,
): { text: string; up: boolean } | null => {
  if (current === null || prev === null) return null;
  const up = current >= prev;
  const sign = up ? '+' : '';
  const kind = DELTA_KIND[key];
  if (kind === 'pct') {
    if (prev === 0) return null;
    const pct = ((current - prev) / prev) * 100;
    return { text: `${pct >= 0 ? '+' : ''}${pct.toFixed(1)}%`, up };
  }
  const diff = current - prev;
  if (kind === 'pp') return { text: `${sign}${diff.toFixed(1)}pp`, up };
  if (kind === 'abs2') return { text: `${sign}${diff.toFixed(2)}`, up };
  return { text: `${sign}${diff.toFixed(1)}`, up };
};

const METRICS: { key: MetricKey; label: string; unit: string; formatFn?: (v: number | null) => string }[] = [
  { key: 'revenue', label: '營收', unit: '', formatFn: fmtRevenue },
  { key: 'grossMargin', label: '毛利率', unit: '%' },
  { key: 'opMargin', label: '營益率', unit: '%' },
  { key: 'netMargin', label: '淨利率', unit: '%' },
  { key: 'roe', label: 'ROE (年化)', unit: '%' },
  { key: 'eps', label: 'EPS', unit: '元', formatFn: (v) => fmt(v, 2) },
];

type Props = {
  watchlist?: string[];
  setWatchlist?: (v: string[]) => void;
};

export const FinancialsPage = ({ watchlist: watchlistProp, setWatchlist: setWatchlistProp }: Props) => {
  const [searchParams, setSearchParams] = useSearchParams();

  const [watchlist, setWatchlistLocal] = useState<string[]>(watchlistProp ?? loadWatchlist);
  const [input, setInput] = useState(() => searchParams.get('symbol') ?? '2330');

  const symbol = searchParams.get('symbol') ?? '2330';

  const setWatchlist = setWatchlistProp ?? setWatchlistLocal;

  const financialsQuery = useFinancials(symbol);

  const history = financialsQuery.data?.data.history ?? [];
  const latestRow = history[0];
  const links = mopsLinks({
    symbol,
    ...(latestRow !== undefined ? { year: latestRow.year, quarter: latestRow.quarter } : {}),
  });

  const symbolName = SYMBOL_NAMES[symbol] ?? symbol;

  const headerText = latestRow !== undefined
    ? `FY${latestRow.year} Q${latestRow.quarter}`
    : '';

  const submit = () => {
    const v = input.trim().toUpperCase();
    if (v.length === 0) return;
    setSearchParams({ symbol: v });
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
    setSearchParams({ symbol: s });
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
    <div className="min-h-screen bg-ink-950">
      <TopNav />
      <main className="max-w-[1400px] mx-auto px-6 py-6">
        <WatchlistStrip current={symbol} watchlist={watchlist} onPick={pick} onRemove={remove} />

        <div className="bg-ink-900 border border-ink-700 rounded-2xl px-5 py-4 mb-4 flex items-baseline gap-4 flex-wrap">
          <h1 className="text-lg font-semibold text-zinc-100">
            {symbolName} · 財報分析
          </h1>
          {headerText && (
            <span className="text-sm text-zinc-400">{headerText}</span>
          )}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-4">
          <div className="lg:col-span-2 bg-ink-900 border border-ink-700 rounded-2xl p-5">
            <h2 className="text-base font-semibold text-zinc-100 mb-4">📊 近 8 季財務數據</h2>
            {financialsQuery.isLoading && (
              <p className="text-sm text-zinc-500">載入中…</p>
            )}
            {financialsQuery.isError && (
              <p className="text-sm text-zinc-500">無法載入財報資料</p>
            )}
            {!financialsQuery.isLoading && history.length === 0 && (
              <p className="text-sm text-zinc-500">尚無財報資料</p>
            )}
            {history.length > 0 && (
              <div className="overflow-x-auto -mx-5 px-5">
                <table className="text-sm border-collapse" style={{ minWidth: `${160 + history.length * 110}px` }}>
                  <thead>
                    <tr>
                      <th className="sticky left-0 z-10 text-left px-3 py-2 text-zinc-400 font-medium bg-ink-800 rounded-tl-lg whitespace-nowrap" style={{ minWidth: 110 }}>
                        指標
                      </th>
                      {history.map((row) => (
                        <th
                          key={`${row.year}-${row.quarter}`}
                          className="text-right px-3 py-2 text-zinc-300 font-medium bg-ink-800 last:rounded-tr-lg whitespace-nowrap"
                          style={{ minWidth: 100 }}
                        >
                          {row.year} Q{row.quarter}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {METRICS.map(({ key, label, unit, formatFn }) => (
                      <tr key={key} className="border-b border-ink-800 hover:bg-accent/5">
                        <td className="sticky left-0 z-10 bg-ink-900 px-3 py-2 text-zinc-400 whitespace-nowrap">
                          {label}
                        </td>
                        {history.map((row, i) => {
                          const val = row[key] as number | null;
                          const prevRow = history[i + 1];
                          const prev = prevRow !== undefined ? prevRow[key] as number | null : null;
                          const formatted = formatFn !== undefined ? formatFn(val) : `${fmt(val)}${val !== null ? unit : ''}`;
                          const delta = computeDelta(key, val, prev);
                          return (
                            <td
                              key={`${row.year}-${row.quarter}`}
                              className="px-3 py-2 text-right text-zinc-200 num whitespace-nowrap"
                            >
                              <div>{formatted}</div>
                              {delta !== null && (
                                <div className={`text-[10px] ${delta.up ? 'text-red-400' : 'text-emerald-400'}`}>
                                  {delta.text}
                                </div>
                              )}
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <div className="bg-ink-900 border border-ink-700 rounded-2xl p-5">
            <h2 className="text-base font-semibold text-zinc-100 mb-4">📁 最新財報下載</h2>
            <div className="flex flex-col gap-3">
              <a
                href={links.quarterReport}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-3 px-3 py-2.5 bg-ink-800 border border-ink-700 rounded-xl text-zinc-300 text-sm hover:border-accent/50 hover:text-accent-soft transition-colors"
              >
                <div className="w-8 h-8 rounded-lg bg-ink-700 grid place-items-center text-zinc-400 shrink-0">
                  📄
                </div>
                <div>
                  <div>三大財報（損益 / 資負 / 現金流）</div>
                  <div className="text-xs text-zinc-500 mt-0.5">Yahoo 財報 · 含季度與年度比較</div>
                </div>
              </a>
              <a
                href={links.legalPresentations}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-3 px-3 py-2.5 bg-ink-800 border border-ink-700 rounded-xl text-zinc-300 text-sm hover:border-accent/50 hover:text-accent-soft transition-colors"
              >
                <div className="w-8 h-8 rounded-lg bg-ink-700 grid place-items-center text-zinc-400 shrink-0">
                  📊
                </div>
                <div>
                  <div>歷年詳細財報分析</div>
                  <div className="text-xs text-zinc-500 mt-0.5">Goodinfo · 經營績效 + 比率歷史</div>
                </div>
              </a>
              <a
                href={links.reportsList}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-3 px-3 py-2.5 bg-ink-800 border border-ink-700 rounded-xl text-zinc-300 text-sm hover:border-accent/50 hover:text-accent-soft transition-colors"
              >
                <div className="w-8 h-8 rounded-lg bg-ink-700 grid place-items-center text-zinc-400 shrink-0">
                  📂
                </div>
                <div>
                  <div>公司基本資料</div>
                  <div className="text-xs text-zinc-500 mt-0.5">證交所官方公司資料頁</div>
                </div>
              </a>
              <a
                href={links.irPage}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-3 px-3 py-2.5 bg-ink-800 border border-ink-700 rounded-xl text-zinc-300 text-sm hover:border-accent/50 hover:text-accent-soft transition-colors"
              >
                <div className="w-8 h-8 rounded-lg bg-ink-700 grid place-items-center text-zinc-400 shrink-0">
                  🌐
                </div>
                <div>
                  <div>公司投資人關係 IR</div>
                  <div className="text-xs text-zinc-500 mt-0.5">官方 IR 頁面</div>
                </div>
              </a>
            </div>
          </div>
        </div>
      </main>
      <footer className="text-center text-xs text-zinc-600 py-8">
        Tickr · 資料來源：證交所 · Yahoo Finance · FinMind · 僅供參考非投資建議
      </footer>
    </div>
  );
};
