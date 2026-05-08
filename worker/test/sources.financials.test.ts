import { describe, it, expect, vi } from 'vitest';
import { env } from 'cloudflare:test';
import { fetchQuarterlyFinancials, fetchQuarterlyFinancialsHistory } from '../src/sources/finmind';

type FinancialRecord = { date: string; stock_id: string; type: string; value: number };

const makeIncomeResponse = (records: FinancialRecord[]): string =>
  JSON.stringify({ msg: 'success', status: 200, data: records });

const makeBalanceResponse = (records: FinancialRecord[]): string =>
  JSON.stringify({ msg: 'success', status: 200, data: records });

const makeIncomeRecords = (date: string, code: string): FinancialRecord[] => [
  { date, stock_id: code, type: 'Revenue', value: 592640000000 },
  { date, stock_id: code, type: 'GrossProfit', value: 348822000000 },
  { date, stock_id: code, type: 'OperatingIncome', value: 286866000000 },
  { date, stock_id: code, type: 'IncomeAfterTaxes', value: 254860000000 },
  { date, stock_id: code, type: 'EPS', value: 9.56 },
];

const makeBalanceRecords = (date: string, code: string): FinancialRecord[] => [
  { date, stock_id: code, type: 'EquityAttributableToOwnersOfParent', value: 3800000000000 },
];

describe('fetchQuarterlyFinancials', () => {
  it('parses margins and ROE from FinMind response', async () => {
    const mockFetcher = vi.fn().mockImplementation((url: string) => {
      const isBalance = url.includes('TaiwanStockBalanceSheet');
      const body = isBalance
        ? makeBalanceResponse(makeBalanceRecords('2024-06-30', '2330'))
        : makeIncomeResponse(makeIncomeRecords('2024-06-30', '2330'));
      return Promise.resolve(new Response(body, { status: 200 }));
    });

    const result = await fetchQuarterlyFinancials(env.KV, '2330', { fetcher: mockFetcher });

    expect(result).not.toBeNull();
    expect(result?.code).toBe('2330');
    expect(result?.date).toBe('2024-06-30');
    // grossMargin ≈ 348822 / 592640 * 100 ≈ 58.9%
    expect(result?.grossMargin).toBeCloseTo(58.9, 0);
    // opMargin ≈ 286866 / 592640 * 100 ≈ 48.4%
    expect(result?.opMargin).toBeCloseTo(48.4, 0);
    // netMargin ≈ 254860 / 592640 * 100 ≈ 43.0%
    expect(result?.netMargin).toBeCloseTo(43.0, 0);
    // ROE = (254860e9 * 4) / 3800e12 * 100 ≈ 26.8%
    expect(result?.roe).toBeCloseTo(26.8, 0);
    expect(result?.quarterlyEps).toBe(9.56);
  });

  it('returns null when upstream returns non-200 status', async () => {
    const mockFetcher = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ msg: 'error', status: 400, data: [] }), { status: 200 }),
    );

    const result = await fetchQuarterlyFinancials(env.KV, '9999', { fetcher: mockFetcher });
    expect(result).toBeNull();
  });

  it('returns partial result (null ROE) when balance sheet fetch fails', async () => {
    const mockFetcher = vi.fn().mockImplementation((url: string) => {
      if (url.includes('TaiwanStockBalanceSheet')) {
        return Promise.reject(new Error('balance_fetch_failed'));
      }
      return Promise.resolve(
        new Response(makeIncomeResponse(makeIncomeRecords('2024-06-30', '2330')), { status: 200 }),
      );
    });

    const result = await fetchQuarterlyFinancials(env.KV, '2330', { fetcher: mockFetcher });
    expect(result).not.toBeNull();
    expect(result?.grossMargin).not.toBeNull();
    expect(result?.roe).toBeNull();
  });

  it('serves cached result on second call', async () => {
    const mockFetcher = vi.fn().mockImplementation((url: string) => {
      const isBalance = url.includes('TaiwanStockBalanceSheet');
      const body = isBalance
        ? makeBalanceResponse(makeBalanceRecords('2024-09-30', '2454'))
        : makeIncomeResponse(makeIncomeRecords('2024-09-30', '2454'));
      return Promise.resolve(new Response(body, { status: 200 }));
    });

    await fetchQuarterlyFinancials(env.KV, '2454', { fetcher: mockFetcher });
    await fetchQuarterlyFinancials(env.KV, '2454', { fetcher: mockFetcher });

    // Each call hits both income + balance endpoints → 2 calls first time, 0 second time (cached)
    expect(mockFetcher).toHaveBeenCalledTimes(2);
  });
});

describe('fetchQuarterlyFinancialsHistory', () => {
  const makeMultiIncomeResponse = (dates: string[], code: string): string => {
    const records: FinancialRecord[] = dates.flatMap((date) => makeIncomeRecords(date, code));
    return JSON.stringify({ msg: 'success', status: 200, data: records });
  };

  it('returns history array with correct length and ordering (newest first)', async () => {
    const dates = ['2023-03-31', '2023-06-30', '2023-09-30', '2023-12-31', '2024-03-31', '2024-06-30'];
    const mockFetcher = vi.fn().mockImplementation((url: string) => {
      const isBalance = url.includes('TaiwanStockBalanceSheet');
      const body = isBalance
        ? makeBalanceResponse(makeBalanceRecords('2024-06-30', '2330'))
        : makeMultiIncomeResponse(dates, '2330');
      return Promise.resolve(new Response(body, { status: 200 }));
    });

    const result = await fetchQuarterlyFinancialsHistory(env.KV, '2330', 8, { fetcher: mockFetcher });

    expect(result.symbol).toBe('2330');
    expect(Array.isArray(result.history)).toBe(true);
    // Should have 6 quarters (all 6 dates)
    expect(result.history.length).toBe(6);
    // newest first: 2024-06-30 → Q2 2024
    expect(result.history[0]?.year).toBe(2024);
    expect(result.history[0]?.quarter).toBe(2);
    // last should be 2023-03-31 → Q1 2023
    expect(result.history[result.history.length - 1]?.year).toBe(2023);
    expect(result.history[result.history.length - 1]?.quarter).toBe(1);
  });

  it('respects the limit parameter', async () => {
    const dates = ['2023-03-31', '2023-06-30', '2023-09-30', '2023-12-31', '2024-03-31', '2024-06-30'];
    const mockFetcher = vi.fn().mockImplementation((url: string) => {
      const isBalance = url.includes('TaiwanStockBalanceSheet');
      const body = isBalance
        ? makeBalanceResponse(makeBalanceRecords('2024-06-30', '2330'))
        : makeMultiIncomeResponse(dates, '2330');
      return Promise.resolve(new Response(body, { status: 200 }));
    });

    const result = await fetchQuarterlyFinancialsHistory(env.KV, '2330', 3, { fetcher: mockFetcher });
    expect(result.history.length).toBe(3);
    expect(result.history[0]?.quarter).toBe(2); // most recent
  });

  it('returns empty history when upstream fails', async () => {
    const mockFetcher = vi.fn().mockRejectedValue(new Error('network_fail'));
    const result = await fetchQuarterlyFinancialsHistory(env.KV, '9999', 8, { fetcher: mockFetcher });
    expect(result.symbol).toBe('9999');
    expect(result.history).toHaveLength(0);
  });

  it('serves cached history on second call', async () => {
    const dates = ['2024-03-31', '2024-06-30'];
    const mockFetcher = vi.fn().mockImplementation((url: string) => {
      const isBalance = url.includes('TaiwanStockBalanceSheet');
      const body = isBalance
        ? makeBalanceResponse(makeBalanceRecords('2024-06-30', '3008'))
        : makeMultiIncomeResponse(dates, '3008');
      return Promise.resolve(new Response(body, { status: 200 }));
    });

    await fetchQuarterlyFinancialsHistory(env.KV, '3008', 8, { fetcher: mockFetcher });
    await fetchQuarterlyFinancialsHistory(env.KV, '3008', 8, { fetcher: mockFetcher });
    expect(mockFetcher).toHaveBeenCalledTimes(2); // 2 calls on first fetch (income+balance), 0 on second (cached)
  });
});
