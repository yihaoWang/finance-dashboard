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

describe('fetchFredSnapshot', () => {
  beforeEach(async () => {
    await env.KV.delete('fred:snapshot');
  });

  it('parses all 4 series correctly', async () => {
    const fetcher = mockFetcher({
      'DGS10': makeFredResponse('4.36', '4.42', '2026-05-06'),
      'CPIAUCSL': makeFredResponse('315.2', '314.5', '2026-04-01'),
      'PCEPI': makeFredResponse('128.4', '128.0', '2026-04-01'),
      'UNRATE': makeFredResponse('4.2', '4.1', '2026-04-01'),
    });

    const testEnv = { KV: env.KV, FRED_API_KEY: 'test-key' };
    const snapshot = await fetchFredSnapshot(testEnv, { fetcher });

    expect(snapshot.dgs10).not.toBeNull();
    expect(snapshot.dgs10?.latest).toBe(4.36);
    expect(snapshot.dgs10?.prev).toBe(4.42);
    expect(snapshot.dgs10?.date).toBe('2026-05-06');

    expect(snapshot.cpi).not.toBeNull();
    expect(snapshot.cpi?.latest).toBe(315.2);

    expect(snapshot.pce).not.toBeNull();
    expect(snapshot.pce?.latest).toBe(128.4);

    expect(snapshot.unrate).not.toBeNull();
    expect(snapshot.unrate?.latest).toBe(4.2);
  });

  it('returns all nulls when FRED_API_KEY is missing', async () => {
    const testEnv = { KV: env.KV };
    const snapshot = await fetchFredSnapshot(testEnv);
    expect(snapshot.dgs10).toBeNull();
    expect(snapshot.cpi).toBeNull();
    expect(snapshot.pce).toBeNull();
    expect(snapshot.unrate).toBeNull();
  });

  it('caches result in KV on second call', async () => {
    const fetcher = mockFetcher({
      'DGS10': makeFredResponse('4.36', '4.42', '2026-05-06'),
      'CPIAUCSL': makeFredResponse('315.2', '314.5', '2026-04-01'),
      'PCEPI': makeFredResponse('128.4', '128.0', '2026-04-01'),
      'UNRATE': makeFredResponse('4.2', '4.1', '2026-04-01'),
    }) as ReturnType<typeof vi.fn>;

    const testEnv = { KV: env.KV, FRED_API_KEY: 'test-key' };
    await fetchFredSnapshot(testEnv, { fetcher });
    await fetchFredSnapshot(testEnv, { fetcher });

    // fetcher called 4 times for first call only; second reads from KV
    expect((fetcher as ReturnType<typeof vi.fn>).mock.calls.length).toBe(4);
  });
});
