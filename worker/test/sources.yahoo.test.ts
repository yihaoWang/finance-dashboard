import { describe, it, expect, vi } from 'vitest';
import { fetchYahooQuote, fetchYahooHistory } from '../src/sources/yahoo';

const quotePayload = {
  quoteResponse: {
    result: [{
      symbol: '2330.TW',
      shortName: '台積電',
      regularMarketPrice: 1085,
      regularMarketChange: 15,
      regularMarketChangePercent: 1.42,
      regularMarketVolume: 42100000,
      marketCap: 28140000000000,
      fiftyTwoWeekHigh: 1120,
      fiftyTwoWeekLow: 720,
      trailingPE: 27.4,
      forwardPE: 21.8,
      epsTrailingTwelveMonths: 39.62,
    }],
  },
};

describe('fetchYahooQuote', () => {
  it('parses quote response', async () => {
    const fetcher = vi.fn().mockResolvedValue(
      new Response(JSON.stringify(quotePayload), { status: 200 }),
    );
    const q = await fetchYahooQuote('2330', { fetcher });
    expect(q.symbol).toBe('2330');
    expect(q.name).toBe('台積電');
    expect(q.price).toBe(1085);
    expect(q.changePct).toBeCloseTo(1.42);
    expect(q.high52w).toBe(1120);
    expect(q.pe).toBe(27.4);
    expect(q.forwardPe).toBe(21.8);
    expect(q.ttmEps).toBeCloseTo(39.62);
  });
  it('throws not_found on empty result', async () => {
    const fetcher = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ quoteResponse: { result: [] } }), { status: 200 }),
    );
    await expect(fetchYahooQuote('9999', { fetcher })).rejects.toThrow('not_found');
  });
});

describe('fetchYahooHistory', () => {
  it('parses history response', async () => {
    const payload = {
      chart: {
        result: [{
          timestamp: [1714521600, 1714608000],
          indicators: {
            quote: [{
              open: [100, 101],
              high: [102, 103],
              low: [99, 100],
              close: [101, 102],
              volume: [1000, 1100],
            }],
          },
        }],
      },
    };
    const fetcher = vi.fn().mockResolvedValue(
      new Response(JSON.stringify(payload), { status: 200 }),
    );
    const rows = await fetchYahooHistory('2330', '1mo', { fetcher });
    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({ open: 100, close: 101, volume: 1000 });
    expect(rows[0].date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});
