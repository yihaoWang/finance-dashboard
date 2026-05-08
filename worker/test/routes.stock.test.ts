import { describe, it, expect, beforeEach, vi } from 'vitest';
import { env, applyD1Migrations } from 'cloudflare:test';
import { app } from '../src/index';
import * as yahoo from '../src/sources/yahoo';
import * as twse from '../src/sources/twse';
import * as twseChips from '../src/sources/twse-chips';
import * as twseMargin from '../src/sources/twse-margin';
import * as twseMis from '../src/sources/twse-mis';
import * as finmind from '../src/sources/finmind';

describe('GET /api/stock/:symbol', () => {
  beforeEach(async () => {
    await applyD1Migrations(env.DB, env.TEST_MIGRATIONS);
    vi.restoreAllMocks();
    vi.spyOn(twse, 'fetchTwseBwibbu').mockResolvedValue(null);
    vi.spyOn(twse, 'fetchTwseMonthlyRevenue').mockResolvedValue(null);
    vi.spyOn(twseChips, 'fetchTwseChips').mockResolvedValue(null);
    vi.spyOn(twseMargin, 'fetchTwseMargin').mockResolvedValue(null);
    vi.spyOn(twseMargin, 'fetchTwseForeignHolding').mockResolvedValue(null);
    vi.spyOn(twseMis, 'fetchTwseMisQuote').mockResolvedValue(null);
    vi.spyOn(finmind, 'fetchQuarterlyFinancials').mockResolvedValue(null);
  });

  it('rejects invalid symbol', async () => {
    const res = await app.request('/api/stock/bad-id', {}, env);
    expect(res.status).toBe(400);
  });

  it('returns quote + kpi bundle', async () => {
    vi.spyOn(yahoo, 'fetchYahooQuote').mockResolvedValue({
      symbol: '2330', name: '台積電', price: 1085, change: 15, changePct: 1.42,
      volume: 100, marketCap: 1, high52w: 1120, low52w: 720,
      pe: 27.4, forwardPe: 21.8, ttmEps: 39.62,
    });
    vi.spyOn(yahoo, 'fetchYahooHistory').mockResolvedValue(
      Array.from({ length: 25 }, (_, i) => ({
        date: `2026-04-${String(i + 1).padStart(2, '0')}`,
        open: 1000 + i, high: 1010 + i, low: 990 + i, close: 1000 + i, volume: 1000,
      })),
    );

    const res = await app.request('/api/stock/2330', {}, env);
    expect(res.status).toBe(200);
    const body = await res.json() as {
      data: {
        quote: { symbol: string; price: number };
        kpi: {
          pe: number | null;
          ma20Deviation: number | null;
          rsi14: number | null;
          macd: number | null;
          macdSignal: string;
          support: number | null;
          resistance: number | null;
        };
        history: unknown[];
      };
      freshness: { source: string };
    };
    expect(body.data.quote.symbol).toBe('2330');
    expect(body.data.quote.price).toBe(1085);
    expect(body.data.kpi.pe).toBe(27.4);
    expect(body.data.kpi.ma20Deviation).not.toBeUndefined();
    expect(body.data.kpi.rsi14).not.toBeUndefined();
    expect(body.data.kpi.macd).not.toBeUndefined();
    expect(body.data.kpi.macdSignal).not.toBeUndefined();
    expect(body.data.kpi.support).not.toBeUndefined();
    expect(body.data.kpi.resistance).not.toBeUndefined();
    expect(Array.isArray(body.data.history)).toBe(true);
    expect(body.freshness.source).toBe('fetch');
  });

  it('serves cached quote on second call', async () => {
    const quoteSpy = vi.spyOn(yahoo, 'fetchYahooQuote').mockResolvedValue({
      symbol: '2330', name: '台積電', price: 1085, change: 15, changePct: 1.42,
      volume: 100, marketCap: 1, high52w: 1120, low52w: 720,
      pe: 27.4, forwardPe: 21.8, ttmEps: 39.62,
    });
    vi.spyOn(yahoo, 'fetchYahooHistory').mockResolvedValue([
      { date: '2026-05-01', open: 1, high: 2, low: 1, close: 1.5, volume: 100 },
    ]);

    await app.request('/api/stock/2330', {}, env);
    await app.request('/api/stock/2330', {}, env);
    expect(quoteSpy).toHaveBeenCalledTimes(1);
  });
});
