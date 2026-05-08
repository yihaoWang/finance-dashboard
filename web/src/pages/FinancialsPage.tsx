import { useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { TopNav } from '../components/TopNav';
import { WatchlistStrip } from '../components/WatchlistStrip';
import { useFinancials } from '../hooks/useFinancials';
import { useDigest } from '../hooks/useDigest';
import { useNews } from '../hooks/useNews';
import { useStock } from '../hooks/useStock';
import { mopsLinks } from '../lib/mops';
import type { QuarterRow, SentimentT } from '@fd/shared';

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
  const billions = v / 1_000_000_000;
  return `${billions.toFixed(0)}億`;
};

const deltaClass = (current: number | null, prev: number | null): string => {
  if (current === null || prev === null) return '';
  return current >= prev ? 'text-red-400' : 'text-emerald-400';
};

const deltaStr = (current: number | null, prev: number | null): string => {
  if (current === null || prev === null) return '';
  const d = current - prev;
  return `${d >= 0 ? '+' : ''}${d.toFixed(1)}`;
};

type MetricKey = keyof Omit<QuarterRow, 'year' | 'quarter'>;

const METRICS: { key: MetricKey; label: string; unit: string; formatFn?: (v: number | null) => string }[] = [
  { key: 'revenue', label: '營收', unit: '', formatFn: fmtRevenue },
  { key: 'grossMargin', label: '毛利率', unit: '%' },
  { key: 'opMargin', label: '營業利益率', unit: '%' },
  { key: 'netMargin', label: 'EBT淨利率', unit: '%' },
  { key: 'roe', label: 'ROE (年化)', unit: '%' },
  { key: 'eps', label: 'EPS', unit: '元', formatFn: (v) => fmt(v, 2) },
];

const SENTIMENT_DOT: Record<SentimentT, string> = {
  positive: 'bg-red-400',
  negative: 'bg-emerald-400',
  neutral: 'bg-amber-400',
};

type Props = {
  watchlist?: string[];
  setWatchlist?: (v: string[]) => void;
};

export const FinancialsPage = ({ watchlist: watchlistProp, setWatchlist: setWatchlistProp }: Props) => {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();

  const [watchlist, setWatchlistLocal] = useState<string[]>(watchlistProp ?? loadWatchlist);
  const [input, setInput] = useState(() => searchParams.get('symbol') ?? '2330');

  const symbol = searchParams.get('symbol') ?? '2330';

  const setWatchlist = setWatchlistProp ?? setWatchlistLocal;

  const financialsQuery = useFinancials(symbol);
  const digestQuery = useDigest(symbol);
  const newsQuery = useNews(symbol);
  const stockQuery = useStock(symbol);

  const history = financialsQuery.data?.data.history ?? [];
  const links = mopsLinks(symbol);

  const symbolName = SYMBOL_NAMES[symbol] ?? symbol;

  const latestQuarter = history[0];
  const headerText = latestQuarter !== undefined
    ? `FY${latestQuarter.year} Q${latestQuarter.quarter}`
    : '';

  const [newsFilter, setNewsFilter] = useState<SentimentT | 'all'>('all');
  const allNews = newsQuery.data?.data.items ?? [];
  const posCount = allNews.filter((n) => n.sentiment === 'positive').length;
  const negCount = allNews.filter((n) => n.sentiment === 'negative').length;
  const neuCount = allNews.filter((n) => n.sentiment === 'neutral').length;
  const filteredNews = newsFilter === 'all' ? allNews : allNews.filter((n) => n.sentiment === newsFilter);
  const displayNews = filteredNews.slice(0, 5);

  const chips = stockQuery.data?.data.chips;
  const digestData = digestQuery.data?.data;

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
      <TopNav
        input={input}
        onInputChange={setInput}
        onSubmit={submit}
        currentSymbol={symbol}
      />
      <main className="max-w-[1400px] mx-auto px-6 py-6">
        <WatchlistStrip current={symbol} watchlist={watchlist} onPick={pick} onRemove={remove} />

        {/* Header */}
        <div className="bg-ink-900 border border-ink-700 rounded-2xl px-5 py-4 mb-4 flex items-baseline gap-4 flex-wrap">
          <h1 className="text-lg font-semibold text-zinc-100">
            {symbolName} · 財報分析
          </h1>
          {headerText && (
            <span className="text-sm text-zinc-400">{headerText}</span>
          )}
        </div>

        {/* 2-col: table + downloads */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-4">
          {/* Quarterly table */}
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
              <div className="overflow-x-auto">
                <table className="w-full text-sm border-collapse">
                  <thead>
                    <tr>
                      <th className="text-left px-2 py-2 text-zinc-400 font-medium bg-ink-800 rounded-tl-lg">指標</th>
                      {history.map((row) => (
                        <th key={`${row.year}-${row.quarter}`} className="text-right px-2 py-2 text-zinc-300 font-medium bg-ink-800 last:rounded-tr-lg">
                          {row.year} Q{row.quarter}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {METRICS.map(({ key, label, unit, formatFn }) => (
                      <tr key={key} className="border-b border-ink-800 hover:bg-accent/5">
                        <td className="px-2 py-2 text-zinc-400">{label}</td>
                        {history.map((row, i) => {
                          const val = row[key] as number | null;
                          const prevRow = history[i + 1];
                          const prev = prevRow !== undefined ? prevRow[key] as number | null : null;
                          const formatted = formatFn !== undefined ? formatFn(val) : `${fmt(val)}${val !== null ? unit : ''}`;
                          return (
                            <td key={`${row.year}-${row.quarter}`} className="px-2 py-2 text-right text-zinc-200 num">
                              {formatted}
                              {val !== null && prev !== null && (
                                <span className={`ml-1 text-xs ${deltaClass(val, prev)}`}>
                                  {deltaStr(val, prev)}
                                </span>
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

          {/* Downloads */}
          <div className="bg-ink-900 border border-ink-700 rounded-2xl p-5">
            <h2 className="text-base font-semibold text-zinc-100 mb-4">📁 最新財報下載</h2>
            <div className="flex flex-col gap-3">
              <a
                href={links.latestQuarterReport}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-3 px-3 py-2.5 bg-ink-800 border border-ink-700 rounded-xl text-zinc-300 text-sm hover:border-accent/50 hover:text-accent-soft transition-colors"
              >
                <div className="w-8 h-8 rounded-lg bg-ink-700 grid place-items-center text-zinc-400 shrink-0">
                  📄
                </div>
                <div>
                  <div>最新季報</div>
                  <div className="text-xs text-zinc-500 mt-0.5">MOPS t164sb01</div>
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
                  <div>法說會簡報</div>
                  <div className="text-xs text-zinc-500 mt-0.5">MOPS t100sb02_1</div>
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
                  <div>歷史財報列表</div>
                  <div className="text-xs text-zinc-500 mt-0.5">MOPS t05st02</div>
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

        {/* AI digest */}
        <div className="bg-ink-900 border border-ink-700 rounded-2xl p-5 mb-4">
          <h2 className="text-base font-semibold text-zinc-100 mb-4">🤖 AI 財報分析</h2>
          {digestQuery.isLoading && <p className="text-sm text-zinc-500">載入中…</p>}
          {!digestQuery.isLoading && digestData === undefined && (
            <p className="text-sm text-zinc-500">今日 digest 尚未產生</p>
          )}
          {digestData !== undefined && (
            <div className="bg-gradient-to-b from-accent/5 to-transparent border border-accent/25 rounded-xl px-4 py-4">
              <div className="flex items-center gap-2 mb-3">
                <span className="text-xs px-2 py-0.5 bg-accent/15 border border-accent/30 rounded-full text-accent-soft font-medium">
                  框架解讀
                </span>
                <span className="text-xs text-zinc-500">{digestData.date} · {digestData.model}</span>
              </div>
              <p className="text-sm text-zinc-300 leading-relaxed">{digestData.sections.framework}</p>
            </div>
          )}
        </div>

        {/* 2-col: news + market view */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* News panel */}
          <div className="bg-ink-900 border border-ink-700 rounded-2xl p-5">
            <h2 className="text-base font-semibold text-zinc-100 mb-3">📰 近期新聞</h2>
            <div className="flex items-center gap-2 mb-3">
              {(
                [
                  { label: `全部 ${allNews.length}`, value: 'all' as const },
                  { label: `利多 ${posCount}`, value: 'positive' as const },
                  { label: `利空 ${negCount}`, value: 'negative' as const },
                  { label: `中性 ${neuCount}`, value: 'neutral' as const },
                ] as { label: string; value: SentimentT | 'all' }[]
              ).map(({ label, value }) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setNewsFilter(value)}
                  className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${
                    newsFilter === value
                      ? 'bg-accent/20 border-accent/40 text-accent-soft'
                      : 'bg-ink-800 border-ink-700 text-zinc-400 hover:text-zinc-200'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
            {newsQuery.isLoading && <p className="text-sm text-zinc-500">載入中…</p>}
            {displayNews.length === 0 && !newsQuery.isLoading && (
              <p className="text-sm text-zinc-500">暫無新聞</p>
            )}
            <div className="flex flex-col">
              {displayNews.map((item) => (
                <div key={item.link} className="flex gap-2.5 py-2.5 border-b border-ink-800 last:border-0">
                  <div className={`w-1.5 h-1.5 rounded-full mt-1.5 shrink-0 ${SENTIMENT_DOT[item.sentiment]}`} />
                  <div>
                    <a
                      href={item.link}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm text-zinc-300 hover:text-accent-soft leading-relaxed"
                    >
                      {item.title}
                    </a>
                    <p className="text-xs text-zinc-500 mt-0.5">
                      {item.publisher} · {new Date(item.publishedAt * 1000).toLocaleDateString('zh-TW')}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Market view panel */}
          <div className="bg-ink-900 border border-ink-700 rounded-2xl p-5">
            <h2 className="text-base font-semibold text-zinc-100 mb-3">📡 市場觀點</h2>

            {/* Digest sentiment */}
            {digestData !== undefined && (
              <div className="mb-4">
                <p className="text-xs text-zinc-500 mb-1.5">情緒分析</p>
                <p className="text-sm text-zinc-300 leading-relaxed">{digestData.sections.sentiment}</p>
              </div>
            )}
            {digestQuery.isLoading && <p className="text-sm text-zinc-500 mb-4">載入中…</p>}
            {!digestQuery.isLoading && digestData === undefined && (
              <p className="text-sm text-zinc-500 mb-4">今日 digest 尚未產生</p>
            )}

            {/* Chips signals */}
            <p className="text-xs text-zinc-500 mb-2">籌碼信號</p>
            {chips !== null && chips !== undefined ? (
              <div className="flex flex-col gap-2">
                {(
                  [
                    { label: '外資', value: chips.foreignNet },
                    { label: '投信', value: chips.trustNet },
                    { label: '自營商', value: chips.dealerNet },
                  ] as { label: string; value: number }[]
                ).map(({ label, value }) => (
                  <div key={label} className="flex items-center justify-between text-sm">
                    <span className="text-zinc-400">{label}</span>
                    <span className={`num font-medium ${value >= 0 ? 'text-red-400' : 'text-emerald-400'}`}>
                      {value >= 0 ? '+' : ''}{(value / 1000).toFixed(0)} 張
                    </span>
                  </div>
                ))}
                {chips.foreignHoldingPct !== null && (
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-zinc-400">外資持股比</span>
                    <span className="num text-zinc-200">{chips.foreignHoldingPct.toFixed(1)}%</span>
                  </div>
                )}
              </div>
            ) : (
              <p className="text-sm text-zinc-500">籌碼資料暫無</p>
            )}
          </div>
        </div>
      </main>
      <footer className="text-center text-xs text-zinc-600 py-8">
        Tickr · 資料來源：證交所 · Yahoo Finance · FinMind · 僅供參考非投資建議
      </footer>
    </div>
  );
};
