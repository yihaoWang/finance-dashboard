import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fetchForeignFuturesOI, fetchOptionsPCR } from '../src/sources/taifex';

beforeEach(() => {
  vi.restoreAllMocks();
});

const makeFinMindFetch = (data: unknown[]) =>
  vi.fn().mockResolvedValue({
    ok: true,
    json: async () => ({ msg: 'success', status: 200, data }),
  });

describe('fetchForeignFuturesOI', () => {
  it('sums TX open_interest for the latest date (regular session only)', async () => {
    vi.stubGlobal(
      'fetch',
      makeFinMindFetch([
        { date: '2026-05-11', futures_id: 'TX', contract_date: '202605', open_interest: 50000, volume: 10000, trading_session: 'day_trading' },
        { date: '2026-05-11', futures_id: 'TX', contract_date: '202606', open_interest: 12000, volume: 500, trading_session: 'day_trading' },
        { date: '2026-05-11', futures_id: 'TX', contract_date: '202605', open_interest: 50000, volume: 500, trading_session: 'after_market' },
        { date: '2026-05-10', futures_id: 'TX', contract_date: '202605', open_interest: 48000, volume: 9000, trading_session: 'day_trading' },
      ]),
    );
    const out = await fetchForeignFuturesOI();
    expect(out.netOi).toBe(62000); // 50000 + 12000, after_market excluded
    expect(out.date).toBe('2026-05-11');
  });
});

describe('fetchOptionsPCR', () => {
  it('computes put/call ratio from TXO volume for latest date', async () => {
    vi.stubGlobal(
      'fetch',
      makeFinMindFetch([
        { date: '2026-05-11', option_id: 'TXO', call_put: 'put', volume: 180000, open_interest: 0, trading_session: 'day_trading' },
        { date: '2026-05-11', option_id: 'TXO', call_put: 'call', volume: 150000, open_interest: 0, trading_session: 'day_trading' },
        { date: '2026-05-11', option_id: 'TXO', call_put: 'put', volume: 5000, open_interest: 0, trading_session: 'after_market' },
        { date: '2026-05-10', option_id: 'TXO', call_put: 'put', volume: 90000, open_interest: 0, trading_session: 'day_trading' },
        { date: '2026-05-10', option_id: 'TXO', call_put: 'call', volume: 80000, open_interest: 0, trading_session: 'day_trading' },
      ]),
    );
    const out = await fetchOptionsPCR();
    expect(out.pcr).toBeCloseTo(1.2, 2); // 180000 / 150000 = 1.2
    expect(out.date).toBe('2026-05-11');
  });
});
