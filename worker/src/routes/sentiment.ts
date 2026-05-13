import { Hono } from 'hono';
import type { Env } from '../index';
import type {
  ApiResponse,
  SentimentBundle,
  IndicatorKey,
  SentimentIndicator,
} from '@fd/shared';
import { kvGetJson, kvPutJson } from '../cache/kv';
import { getHistory } from '../cache/d1-sentiment';
import {
  computePercentile,
  findNearestLandmark,
  classifyZone,
  computeFearGreed,
} from '../lib/sentiment';
import { HISTORICAL_LANDMARKS } from '../data/historical-landmarks';

const TTL = 1800;
export const sentiment = new Hono<{ Bindings: Env }>();

const LABELS: Record<IndicatorKey, { label: string; unit: string }> = {
  breadth_adr: { label: '大盤騰落比 ADR', unit: '' },
  foreign_futures_oi: { label: '外資台指期淨未平倉', unit: '口' },
  institutional_5d: { label: '三大法人 5 日累計', unit: '億' },
  margin_balance: { label: '融資餘額', unit: '億' },
  margin_maintenance: { label: '融資維持率', unit: '%' },
  options_pcr: { label: '選擇權 PCR', unit: '' },
  short_long_ratio: { label: '券資比', unit: '%' },
};

const buildIndicator = (
  key: IndicatorKey,
  history: { date: string; value: number }[],
): SentimentIndicator => {
  const values = history.map((r) => r.value);
  const current = values[0] ?? 0;
  const past5 = values[5] ?? current;
  const change5d = Number((current - past5).toFixed(2));
  const percentile = computePercentile(values, current);
  const landmarks = HISTORICAL_LANDMARKS[key];
  const nearestLandmark = findNearestLandmark(landmarks, current);
  const zone = classifyZone(key, percentile);
  const meta = LABELS[key];
  return {
    key,
    label: meta.label,
    value: current,
    unit: meta.unit,
    change5d,
    percentile,
    zone,
    nearestLandmark,
    landmarks,
    explanation: nearestLandmark
      ? `目前接近 ${nearestLandmark.event}（${nearestLandmark.value}${meta.unit}）`
      : `歷史百分位 ${percentile}`,
  };
};

sentiment.get('/', async (c) => {
  const cached = await kvGetJson<{ value: SentimentBundle; ts: number }>(
    c.env.KV,
    'sentiment:bundle',
  );
  if (cached) {
    const ageSeconds = Math.floor((Date.now() - cached.ts) / 1000);
    return c.json({
      data: cached.value,
      freshness: { source: 'kv', ageSeconds },
    } satisfies ApiResponse<SentimentBundle>);
  }
  const keys: IndicatorKey[] = [
    'breadth_adr',
    'foreign_futures_oi',
    'institutional_5d',
    'margin_balance',
    'margin_maintenance',
    'options_pcr',
    'short_long_ratio',
  ];
  const indicators = await Promise.all(
    keys.map(async (k) => buildIndicator(k, await getHistory(c.env.DB, k))),
  );
  const fearGreed = computeFearGreed({
    breadthAdrPercentile: indicators[0].percentile,
    foreignFuturesOiPercentile: indicators[1].percentile,
    institutional5dPercentile: indicators[2].percentile,
    marginBalancePercentile: indicators[3].percentile,
    marginMaintenancePercentile: indicators[4].percentile,
    optionsPcrPercentile: indicators[5].percentile,
    shortLongRatioPercentile: indicators[6].percentile,
  });
  const bundle: SentimentBundle = {
    fearGreed,
    indicators,
    updatedAt: new Date().toISOString(),
  };
  await kvPutJson(
    c.env.KV,
    'sentiment:bundle',
    { value: bundle, ts: Date.now() },
    TTL,
  );
  return c.json({
    data: bundle,
    freshness: { source: 'fetch', ageSeconds: 0 },
  } satisfies ApiResponse<SentimentBundle>);
});
