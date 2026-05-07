import { Hono } from 'hono';
import type { Env } from '../index';
import type { ApiResponse } from '@fd/shared';
import { validateSymbol } from '../lib/symbol';
import { kvGetJson, kvPutJson } from '../cache/kv';
import { fetchYahooNews } from '../sources/yahoo-news';
import { classifySentiment } from '../lib/sentiment';

const TTL = 30 * 60; // 30 min

export type NewsBundle = {
  items: Array<{
    title: string;
    publisher: string;
    publishedAt: number;
    link: string;
    sentiment: 'positive' | 'negative' | 'neutral';
  }>;
};

export const news = new Hono<{ Bindings: Env }>();

news.get('/:symbol', async (c) => {
  let symbol: string;
  try {
    symbol = validateSymbol(c.req.param('symbol'));
  } catch {
    return c.json({ error: 'invalid_symbol' }, 400);
  }
  const key = `news:${symbol}`;
  const cached = await kvGetJson<{ value: NewsBundle; ts: number }>(c.env.KV, key);
  if (cached) {
    const ageSeconds = Math.floor((Date.now() - cached.ts) / 1000);
    return c.json({ data: cached.value, freshness: { source: 'kv', ageSeconds } } satisfies ApiResponse<NewsBundle>);
  }
  try {
    const items = await fetchYahooNews(symbol);
    const enriched = items.map((i) => ({ ...i, sentiment: classifySentiment(i.title) }));
    const bundle: NewsBundle = { items: enriched };
    await kvPutJson(c.env.KV, key, { value: bundle, ts: Date.now() }, TTL);
    return c.json({ data: bundle, freshness: { source: 'fetch', ageSeconds: 0 } } satisfies ApiResponse<NewsBundle>);
  } catch (err) {
    console.warn('yahoo news failed for', symbol, err);
    return c.json({ data: { items: [] }, freshness: { source: 'fetch', ageSeconds: 0 }, warnings: ['news_unavailable'] } satisfies ApiResponse<NewsBundle>);
  }
});
