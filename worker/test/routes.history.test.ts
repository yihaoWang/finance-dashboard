import { describe, it, expect, vi, beforeEach } from 'vitest';
import { env } from 'cloudflare:test';
import { app } from '../src/index';
import * as yahoo from '../src/sources/yahoo';

const mockRows = Array.from({ length: 20 }, (_, i) => ({
  date: `2025-${String(i + 1).padStart(2, '0')}-01`,
  open: 1000 + i,
  high: 1010 + i,
  low: 990 + i,
  close: 1005 + i,
  volume: 5000,
}));

describe('GET /api/history/:symbol', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('returns 400 for invalid symbol', async () => {
    const res = await app.request('/api/history/bad-id', {}, env);
    expect(res.status).toBe(400);
    const body = await res.json() as { error: string };
    expect(body.error).toBe('invalid_symbol');
  });

  it('returns 400 for invalid range', async () => {
    vi.spyOn(yahoo, 'fetchYahooHistory').mockResolvedValue(mockRows);
    const res = await app.request('/api/history/2330?range=1w', {}, env);
    expect(res.status).toBe(400);
    const body = await res.json() as { error: string };
    expect(body.error).toBe('invalid_range');
  });

  it('returns price points on cache miss', async () => {
    const spy = vi.spyOn(yahoo, 'fetchYahooHistory').mockResolvedValue(mockRows);
    const res = await app.request('/api/history/2330?range=1y', {}, env);
    expect(res.status).toBe(200);
    const body = await res.json() as { data: Array<{ date: string; close: number }>; freshness: { source: string } };
    expect(body.freshness.source).toBe('fetch');
    expect(body.data.length).toBe(20);
    expect(body.data[0]).toHaveProperty('date');
    expect(body.data[0]).toHaveProperty('close');
    expect(spy).toHaveBeenCalledTimes(1);
  });

  it('serves from KV cache on second call', async () => {
    const spy = vi.spyOn(yahoo, 'fetchYahooHistory').mockResolvedValue(mockRows);
    await app.request('/api/history/2330?range=3mo', {}, env);
    const res2 = await app.request('/api/history/2330?range=3mo', {}, env);
    expect(res2.status).toBe(200);
    const body = await res2.json() as { freshness: { source: string } };
    expect(body.freshness.source).toBe('kv');
    expect(spy).toHaveBeenCalledTimes(1);
  });
});
