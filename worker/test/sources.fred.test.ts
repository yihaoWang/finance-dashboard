import { describe, it, expect, vi, beforeEach } from 'vitest';
import { env } from 'cloudflare:test';
import { fetchFredSnapshot } from '../src/sources/fred';

const makeFredResponse = (value1: string, value2: string, date1: string) => ({
  observations: [
    { date: date1, value: value1 },
    { date: '2025-01-01', value: value2 },
  ],
});

const mockFetcher = (responses: Record<string, object>): typeof fetch => {
  return vi.fn(async (input: string | URL | Request) => {
    const url = input.toString();
    for (const [key, body] of Object.entries(responses)) {
      if (url.includes(key)) {
        return new Response(JSON.stringify(body), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }
    }
    return new Response('not found', { status: 404 });
  }) as unknown as typeof fetch;
};

// Generate 13 observations for YoY series (desc order: newest first)
const makeYoyObs = (latestVal: string, yearAgoVal: string): object => ({
  observations: Array.from({ length: 13 }, (_, i) => ({
    date: `2026-${String(Math.max(5 - i, 1)).padStart(2, '0')}-01`,
    value: i === 0 ? latestVal : i === 12 ? yearAgoVal : '100',
  })),
});

const allSeriesResponses = {
  'DGS10': makeFredResponse('4.36', '4.42', '2026-05-06'),
  'CPIAUCSL': makeYoyObs('315.2', '307.8'),
  'PCEPI': makeYoyObs('128.4', '125.0'),
  'UNRATE': makeFredResponse('4.2', '4.1', '2026-04-01'),
  'FEDFUNDS': makeFredResponse('4.33', '4.33', '2026-04-01'),
  'PAYEMS': makeFredResponse('159500', '159300', '2026-04-01'),
  'A191RL1Q225SBEA': makeFredResponse('2.8', '3.1', '2026-01-01'),
  'NAPM': makeFredResponse('49.0', '50.3', '2026-04-01'),
  'PPIACO': makeYoyObs('250.5', '240.0'),
  'UMCSENT': makeFredResponse('67.5', '70.2', '2026-04-01'),
};

describe('fetchFredSnapshot', () => {
  beforeEach(async () => {
    await env.KV.delete('fred:snapshot');
  });

  it('parses all series correctly', async () => {
    const fetcher = mockFetcher(allSeriesResponses);
    const testEnv = { KV: env.KV, FRED_API_KEY: 'test-key' };
    const snapshot = await fetchFredSnapshot(testEnv, { fetcher });

    expect(snapshot.dgs10).not.toBeNull();
    expect(snapshot.dgs10?.latest).toBe(4.36);
    expect(snapshot.dgs10?.date).toBe('2026-05-06');

    expect(snapshot.cpi).not.toBeNull();
    // YoY: (315.2 - 307.8) / 307.8 * 100 ≈ 2.404
    expect(snapshot.cpi?.latest).toBeCloseTo(2.404, 1);

    expect(snapshot.pce).not.toBeNull();
    expect(snapshot.pce?.latest).toBeCloseTo(2.72, 1);

    expect(snapshot.unrate).not.toBeNull();
    expect(snapshot.unrate?.latest).toBe(4.2);

    expect(snapshot.fedFunds).not.toBeNull();
    expect(snapshot.fedFunds?.latest).toBe(4.33);

    expect(snapshot.nfpChange).not.toBeNull();
    // MoM diff: 159500 - 159300 = 200 (thousands)
    expect(snapshot.nfpChange?.latest).toBe(200);

    expect(snapshot.gdpYoy).not.toBeNull();
    expect(snapshot.gdpYoy?.latest).toBe(2.8);

    expect(snapshot.pmi).not.toBeNull();
    expect(snapshot.pmi?.latest).toBe(49.0);

    expect(snapshot.ppi).not.toBeNull();
    expect(snapshot.ppi?.latest).toBeCloseTo(4.375, 1);

    expect(snapshot.umcsent).not.toBeNull();
    expect(snapshot.umcsent?.latest).toBe(67.5);
  });

  it('returns all nulls when FRED_API_KEY is missing', async () => {
    const testEnv = { KV: env.KV };
    const snapshot = await fetchFredSnapshot(testEnv);
    expect(snapshot.dgs10).toBeNull();
    expect(snapshot.cpi).toBeNull();
    expect(snapshot.pce).toBeNull();
    expect(snapshot.unrate).toBeNull();
    expect(snapshot.fedFunds).toBeNull();
    expect(snapshot.nfpChange).toBeNull();
    expect(snapshot.gdpYoy).toBeNull();
    expect(snapshot.pmi).toBeNull();
    expect(snapshot.ppi).toBeNull();
    expect(snapshot.umcsent).toBeNull();
  });

  it('caches result in KV on second call', async () => {
    const fetcher = mockFetcher(allSeriesResponses) as ReturnType<typeof vi.fn>;

    const testEnv = { KV: env.KV, FRED_API_KEY: 'test-key' };
    await fetchFredSnapshot(testEnv, { fetcher });
    await fetchFredSnapshot(testEnv, { fetcher });

    // fetcher called 10 times for first call only; second reads from KV
    expect((fetcher as ReturnType<typeof vi.fn>).mock.calls.length).toBe(10);
  });
});
