import { useState } from 'react';
import type { SentimentT } from '@fd/shared';
import { useNews } from '../hooks/useNews';

type Props = { symbol: string };

type FilterT = 'all' | SentimentT;

const ago = (ts: number): string => {
  const diff = (Date.now() - ts) / 1000;
  if (diff < 3600) return `${Math.floor(diff / 60)} 分鐘前`;
  if (diff < 86400) return `${Math.floor(diff / 3600)} 小時前`;
  return `${Math.floor(diff / 86400)} 天前`;
};

const SENTIMENT_DOT: Record<SentimentT, string> = {
  positive: 'bg-up',
  negative: 'bg-down',
  neutral: 'bg-amber-400',
};

const FILTER_LABELS: Record<FilterT, string> = {
  all: '全部',
  positive: '利多',
  negative: '利空',
  neutral: '中性',
};

export const NewsPanel = ({ symbol }: Props) => {
  const { data, isLoading } = useNews(symbol);
  const [filter, setFilter] = useState<FilterT>('all');

  const items = data?.data.items ?? [];
  const counts: Record<SentimentT, number> = { positive: 0, negative: 0, neutral: 0 };
  for (const item of items) counts[item.sentiment]++;

  const filtered = filter === 'all' ? items : items.filter((i) => i.sentiment === filter);

  return (
    <section className="bg-zinc-900 rounded-xl p-4 mb-6">
      <h2 className="text-base font-semibold text-zinc-100 mb-3">消息面（近 30 天）</h2>

      <div className="flex gap-2 flex-wrap mb-4">
        {(['all', 'positive', 'negative', 'neutral'] as FilterT[]).map((f) => {
          const label = f === 'all'
            ? `${FILTER_LABELS.all} ${items.length}`
            : `${FILTER_LABELS[f]} ${counts[f]}`;
          return (
            <button
              key={f}
              type="button"
              onClick={() => setFilter(f)}
              className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                filter === f
                  ? 'bg-zinc-100 text-zinc-900'
                  : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700 hover:text-zinc-200'
              }`}
            >
              {label}
            </button>
          );
        })}
      </div>

      {isLoading && <p className="text-zinc-500 text-sm">載入中…</p>}

      {!isLoading && filtered.length === 0 && (
        <p className="text-zinc-500 text-sm">暫無資料</p>
      )}

      <ul className="divide-y divide-zinc-800">
        {filtered.map((item) => (
          <li key={item.link}>
            <a
              href={item.link}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-start gap-3 group py-3 -mx-2 px-2 rounded-lg hover:bg-zinc-800/50 transition-colors"
            >
              <span
                className={`mt-1.5 flex-shrink-0 w-2 h-2 rounded-full ${SENTIMENT_DOT[item.sentiment]}`}
              />
              <div className="min-w-0 flex-1">
                <p className="text-sm text-zinc-100 group-hover:text-accent-soft group-hover:underline underline-offset-2 decoration-accent/40 line-clamp-2 leading-snug">
                  {item.title}
                </p>
                <p className="text-xs text-zinc-500 mt-1">
                  {item.publisher} · {ago(item.publishedAt)}
                </p>
              </div>
              <svg
                className="mt-1 flex-shrink-0 w-3.5 h-3.5 text-zinc-600 group-hover:text-accent-soft"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                aria-hidden
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
                />
              </svg>
            </a>
          </li>
        ))}
      </ul>
    </section>
  );
};
