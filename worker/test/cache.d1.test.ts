import { describe, it, expect, beforeEach } from 'vitest';
import { env, applyD1Migrations } from 'cloudflare:test';
import { upsertDailyPrices, recentCloses } from '../src/cache/d1';

describe('daily_prices helpers', () => {
  beforeEach(async () => {
    await applyD1Migrations(env.DB, env.TEST_MIGRATIONS);
  });
  it('upserts and reads recent closes', async () => {
    await upsertDailyPrices(env.DB, '2330', [
      { date: '2026-05-01', open: 1, high: 2, low: 1, close: 1.5, volume: 100 },
      { date: '2026-05-02', open: 1.5, high: 2.5, low: 1.5, close: 2, volume: 200 },
    ]);
    const closes = await recentCloses(env.DB, '2330', 5);
    expect(closes).toEqual([2, 1.5]);
  });
  it('upsert overwrites same date', async () => {
    await upsertDailyPrices(env.DB, '2330', [
      { date: '2026-05-01', open: 1, high: 2, low: 1, close: 1.5, volume: 100 },
    ]);
    await upsertDailyPrices(env.DB, '2330', [
      { date: '2026-05-01', open: 1, high: 2, low: 1, close: 9.9, volume: 100 },
    ]);
    const closes = await recentCloses(env.DB, '2330', 5);
    expect(closes).toEqual([9.9]);
  });
});
