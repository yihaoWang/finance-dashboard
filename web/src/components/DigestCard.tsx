import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useDigest } from '../hooks/useDigest';
import { DigestSection } from './DigestSection';
import type { DigestBundle } from '@fd/shared';

type Props = { symbol: string };

const formatDate = (dateStr: string): string => dateStr;

const FreshnessChip = ({ ageSeconds }: { ageSeconds: number }) => {
  const hours = Math.floor(ageSeconds / 3600);
  const label = hours < 1 ? '剛更新' : `${hours}h 前`;
  const colorClass = hours < 6 ? 'text-green-400' : 'text-amber-400';
  return <span className={`text-xs px-2 py-0.5 rounded-full border border-ink-600 ${colorClass}`}>{label}</span>;
};

const PREVIEW_CHARS = 200;

type DigestBodyProps = { bundle: DigestBundle; isFallback: boolean };

const DigestBody = ({ bundle, isFallback }: DigestBodyProps) => {
  const [expanded, setExpanded] = useState(false);
  const fullText = bundle.sections.hard_data + bundle.sections.framework + bundle.sections.sentiment;
  const isLong = fullText.length > PREVIEW_CHARS;

  return (
    <div className="mt-4">
      {isFallback && (
        <p className="text-xs text-amber-400 mb-3 border border-amber-400/30 rounded px-2 py-1">
          （暫顯示大盤總結，個股摘要尚未產生）
        </p>
      )}
      {expanded || !isLong ? (
        <DigestSection sections={bundle.sections} />
      ) : (
        <div>
          <p className="text-sm text-slate-600 whitespace-pre-line">
            {fullText.slice(0, PREVIEW_CHARS)}…
          </p>
          <button
            type="button"
            onClick={() => setExpanded(true)}
            className="mt-2 text-xs text-accent hover:underline"
          >
            展開全文
          </button>
        </div>
      )}
    </div>
  );
};

export const DigestCard = ({ symbol }: Props) => {
  const stockQuery = useDigest(symbol === 'market' ? '' : symbol);
  const isStockError = stockQuery.isError && stockQuery.error.message.includes('api_error_404');
  const marketQuery = useDigest('market');

  const isLoading = stockQuery.isLoading || (isStockError && marketQuery.isLoading);

  if (isLoading) {
    return (
      <div className="rounded-xl border border-ink-700 bg-ink-900 p-4 mb-6 animate-pulse">
        <div className="h-4 bg-ink-700 rounded w-1/3 mb-2" />
        <div className="h-3 bg-ink-700 rounded w-full mt-2" />
      </div>
    );
  }

  const bundle = isStockError ? marketQuery.data?.data : stockQuery.data?.data;
  const freshness = isStockError ? marketQuery.data?.freshness : stockQuery.data?.freshness;
  const isFallback = isStockError;

  if (!bundle) {
    if (stockQuery.isError && !isStockError) {
      return (
        <div className="rounded-xl border border-ink-700 bg-ink-900 p-4 mb-6 text-sm text-slate-600">
          今日 AI 解讀暫時無法載入
        </div>
      );
    }
    return null;
  }

  return (
    <div className="rounded-xl border border-accent/30 bg-ink-900 p-5 mb-6 shadow-sm">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <span className="text-lg">🤖</span>
          <span className="font-semibold text-slate-900 text-sm">今日 AI 解讀</span>
          <span className="text-xs text-slate-600">{formatDate(bundle.date)}</span>
          <span className="text-xs text-slate-600">{bundle.model}</span>
        </div>
        {freshness !== undefined && <FreshnessChip ageSeconds={freshness.ageSeconds} />}
      </div>
      <DigestBody bundle={bundle} isFallback={isFallback} />
      <div className="mt-4 pt-3 border-t border-ink-700">
        <Link to="/digest" className="text-xs text-accent hover:underline">
          查看 30 日歷史 →
        </Link>
      </div>
    </div>
  );
};
