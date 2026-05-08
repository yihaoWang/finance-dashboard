import { describe, it, expect, vi } from 'vitest';
import { env } from 'cloudflare:test';
import { app } from '../src/index';
import * as finmind from '../src/sources/finmind';
import type { FinancialsBundle } from '@fd/shared';

const mockBundle = (): FinancialsBundle => ({
  symbol: '2330',
  fetchedAt: Date.now(),
  history: [
    {
      year: 2024,
      quarter: 2,
      eps: 9.56,
      grossMargin: 58.9,
      opMargin: 48.4,
      netMargin: 43.0,
      roe: 26.8,
      revenue: 592640000000,
    },
    {
      year: 2024,
      quarter: 1,
      eps: 8.7,
      grossMargin: 56.1,
      opMargin: 46.0,
      netMargin: 40.5,
      roe: 25.0,
      revenue: 550000000000,
    },
  ],
});

describe('GET /api/financials/:symbol', () => {
  it('returns 400 for invalid symbol', async () => {
    const res = await app.request('/api/financials/bad-id', {}, env);
    expect(res.status).toBe(400);
    const body = await res.json() as { error: string };
    expect(body.error).toBe('invalid_symbol');
  });

  it('returns 200 with FinancialsBundle', async () => {
    vi.spyOn(finmind, 'fetchQuarterlyFinancialsHistory').mockResolvedValue(mockBundle());

    const res = await app.request('/api/financials/2330', {}, env);
    expect(res.status).toBe(200);
    const body = await res.json() as { data: FinancialsBundle; freshness: { source: string } };
    expect(body.data.symbol).toBe('2330');
    expect(Array.isArray(body.data.history)).toBe(true);
    expect(body.data.history.length).toBe(2);
    expect(body.freshness.source).toBe('fetch');
  });

  it('returns history ordered newest-first', async () => {
    vi.spyOn(finmind, 'fetchQuarterlyFinancialsHistory').mockResolvedValue(mockBundle());

    const res = await app.request('/api/financials/2330', {}, env);
    const body = await res.json() as { data: FinancialsBundle };
    const [first, second] = body.data.history;
    expect(first?.year).toBe(2024);
    expect(first?.quarter).toBe(2);
    expect(second?.quarter).toBe(1);
  });
});
