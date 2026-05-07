import { describe, it, expect, beforeEach, vi } from 'vitest';
import { env } from 'cloudflare:test';
import { app } from '../src/index';
import * as yahooNews from '../src/sources/yahoo-news';

const MOCK_ITEMS = [
  {
    title: '台積電訂單看好，利多消息',
    publisher: 'Yahoo Finance',
    link: 'https://finance.yahoo.com/article/1',
    publishedAt: 1714521600000,
  },
  {
    title: '台積電下修目標價',
    publisher: 'Reuters',
    link: 'https://finance.yahoo.com/article/2',
    publishedAt: 1714435200000,
  },
];

describe('GET /api/news/:symbol', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('rejects invalid symbol', async () => {
    const res = await app.request('/api/news/bad-id!', {}, env);
    expect(res.status).toBe(400);
    const body = await res.json() as { error: string };
    expect(body.error).toBe('invalid_symbol');
  });

  it('returns enriched news with sentiment on cache miss', async () => {
    vi.spyOn(yahooNews, 'fetchYahooNews').mockResolvedValue(MOCK_ITEMS);
    const res = await app.request('/api/news/2330', {}, env);
    expect(res.status).toBe(200);
    const body = await res.json() as {
      data: { items: Array<{ title: string; sentiment: string }> };
      freshness: { source: string; ageSeconds: number };
    };
    expect(body.freshness.source).toBe('fetch');
    expect(body.data.items).toHaveLength(2);
    expect(body.data.items[0].sentiment).toBe('positive');
    expect(body.data.items[1].sentiment).toBe('negative');
  });

  it('returns empty items with warning when fetch fails', async () => {
    vi.spyOn(yahooNews, 'fetchYahooNews').mockRejectedValue(new Error('network error'));
    const res = await app.request('/api/news/2330', {}, env);
    expect(res.status).toBe(200);
    const body = await res.json() as {
      data: { items: unknown[] };
      warnings: string[];
    };
    expect(body.data.items).toHaveLength(0);
    expect(body.warnings).toContain('news_unavailable');
  });

  it('serves from KV cache on second request', async () => {
    vi.spyOn(yahooNews, 'fetchYahooNews').mockResolvedValue(MOCK_ITEMS);
    await app.request('/api/news/2330', {}, env);
    const spy = vi.spyOn(yahooNews, 'fetchYahooNews');
    const res = await app.request('/api/news/2330', {}, env);
    expect(spy).not.toHaveBeenCalled();
    const body = await res.json() as { freshness: { source: string } };
    expect(body.freshness.source).toBe('kv');
  });
});
