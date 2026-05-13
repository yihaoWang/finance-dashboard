import { describe, it, expect } from 'vitest';
import { Hono } from 'hono';
import { sentiment } from '../src/routes/sentiment';

describe('GET /api/sentiment', () => {
  it('returns SentimentBundle with 6 indicators + fearGreed', async () => {
    const fakeDb = {
      prepare: () => ({
        bind: () => ({
          all: async () => ({
            results: Array.from({ length: 100 }, (_, i) => ({
              date: `2024-01-${(i % 28) + 1}`,
              value: 130 + i,
            })),
          }),
          run: async () => undefined,
        }),
      }),
    };
    const fakeKv = { get: async () => null, put: async () => undefined };
    const app = new Hono();
    app.route('/api/sentiment', sentiment);
    const res = await app.request('/api/sentiment', {}, {
      DB: fakeDb,
      KV: fakeKv,
    });
    expect(res.status).toBe(200);
    const body = await res.json() as { data: { indicators: unknown[]; fearGreed: { value: number } } };
    expect(body.data.indicators).toHaveLength(7);
    expect(body.data.fearGreed.value).toBeGreaterThanOrEqual(0);
  });
});
