import { describe, it, expect, beforeEach, vi } from 'vitest';
import { env, applyD1Migrations } from 'cloudflare:test';
import * as fred from '../src/sources/fred';
import * as twse from '../src/sources/twse';
import * as twseChips from '../src/sources/twse-chips';
import * as yahooNews from '../src/sources/yahoo-news';
import * as yahoo from '../src/sources/yahoo';
import { gatherDigestPayload, runDigestPipeline } from '../src/lib/digest-runner';
import { getDigest } from '../src/cache/d1-digests';
import type { Env } from '../src/index';

const makeEnv = (): Env => ({
  ...env,
  AI: {
    run: vi.fn().mockResolvedValue({ response: '## 硬數據\n數據段。\n## 框架解讀\n解讀段。\n## 情緒\n情緒段。' }),
  } as unknown as Ai,
  FRED_API_KEY: 'test-key',
});

describe('runDigestPipeline', () => {
  beforeEach(async () => {
    await applyD1Migrations(env.DB, env.TEST_MIGRATIONS);
    vi.restoreAllMocks();
  });

  it('runs market pipeline and writes D1 row', async () => {
    vi.spyOn(fred, 'fetchFredSnapshot').mockResolvedValue({
      dgs10: { latest: 4.36, prev: 4.42, date: '2026-05-06' },
      cpi: null,
      pce: null,
      unrate: null,
    });
    vi.spyOn(twse, 'fetchTwseBwibbu').mockResolvedValue(null);
    vi.spyOn(twseChips, 'fetchTwseChips').mockResolvedValue(null);
    vi.spyOn(yahooNews, 'fetchYahooNews').mockResolvedValue([]);
    vi.spyOn(yahoo, 'fetchYahooQuote').mockResolvedValue({
      symbol: '2330', name: '台積電', price: 1085, change: 15, changePct: 1.4,
      volume: 100000, marketCap: null, high52w: null, low52w: null, pe: null, forwardPe: null, ttmEps: null,
    });

    const testEnv = makeEnv();
    const bundle = await runDigestPipeline(testEnv, { scope: 'market', symbol: 'market' });

    expect(bundle.scope).toBe('market');
    expect(bundle.symbol).toBe('market');
    expect(bundle.sections.hard_data).toContain('數據段');
    expect(bundle.sections.framework).toContain('解讀段');
    expect(bundle.sections.sentiment).toContain('情緒段');
    expect(bundle.model).toBe('@cf/meta/llama-3.3-70b-instruct-fp8-fast');
    expect(bundle.sources.length).toBeGreaterThan(0);

    // Verify D1 row was created
    const today = new Date().toISOString().slice(0, 10);
    const row = await getDigest(env.DB, 'market', 'market', today);
    expect(row).not.toBeNull();
    expect(row?.sections.hard_data).toContain('數據段');
  });

  it('runs stock pipeline and writes D1 row', async () => {
    vi.spyOn(fred, 'fetchFredSnapshot').mockResolvedValue({ dgs10: null, cpi: null, pce: null, unrate: null });
    vi.spyOn(twse, 'fetchTwseBwibbu').mockResolvedValue(null);
    vi.spyOn(twseChips, 'fetchTwseChips').mockResolvedValue(null);
    vi.spyOn(yahooNews, 'fetchYahooNews').mockResolvedValue([]);
    vi.spyOn(yahoo, 'fetchYahooQuote').mockResolvedValue({
      symbol: '2330', name: '台積電', price: 1085, change: 15, changePct: 1.4,
      volume: 100000, marketCap: null, high52w: null, low52w: null, pe: null, forwardPe: null, ttmEps: null,
    });

    const testEnv = makeEnv();
    const bundle = await runDigestPipeline(testEnv, { scope: 'stock', symbol: '2330' });

    expect(bundle.scope).toBe('stock');
    expect(bundle.symbol).toBe('2330');

    const today = new Date().toISOString().slice(0, 10);
    const row = await getDigest(env.DB, 'stock', '2330', today);
    expect(row).not.toBeNull();
  });

  it('calls env.AI.run with correct model', async () => {
    vi.spyOn(fred, 'fetchFredSnapshot').mockResolvedValue({ dgs10: null, cpi: null, pce: null, unrate: null });
    vi.spyOn(twse, 'fetchTwseBwibbu').mockResolvedValue(null);
    vi.spyOn(twseChips, 'fetchTwseChips').mockResolvedValue(null);
    vi.spyOn(yahooNews, 'fetchYahooNews').mockResolvedValue([]);

    const testEnv = makeEnv();
    await runDigestPipeline(testEnv, { scope: 'market', symbol: 'market' });

    expect((testEnv.AI.run as ReturnType<typeof vi.fn>)).toHaveBeenCalledWith(
      '@cf/meta/llama-3.3-70b-instruct-fp8-fast',
      expect.objectContaining({ messages: expect.any(Array), max_tokens: 1024 }),
    );
  });
});

describe('gatherDigestPayload', () => {
  beforeEach(async () => {
    await applyD1Migrations(env.DB, env.TEST_MIGRATIONS);
    vi.restoreAllMocks();
  });

  const makeKvEnv = (): Pick<Env, 'KV' | 'FRED_API_KEY'> => ({
    KV: env.KV,
    FRED_API_KEY: 'test-key',
  });

  it('returns payload for market scope without calling AI', async () => {
    vi.spyOn(fred, 'fetchFredSnapshot').mockResolvedValue({
      dgs10: { latest: 4.36, prev: 4.42, date: '2026-05-06' },
      cpi: null,
      pce: null,
      unrate: null,
    });
    vi.spyOn(twse, 'fetchTwseBwibbu').mockResolvedValue(null);
    vi.spyOn(yahooNews, 'fetchYahooNews').mockResolvedValue([]);

    const payload = await gatherDigestPayload(makeKvEnv(), { scope: 'market', symbol: 'market' });

    expect(payload.scope).toBe('market');
    expect(payload.symbol).toBe('market');
    expect(typeof payload.system).toBe('string');
    expect(payload.system.length).toBeGreaterThan(0);
    expect(typeof payload.user).toBe('string');
    expect(payload.user.length).toBeGreaterThan(0);
    expect(Array.isArray(payload.sources)).toBe(true);
    expect(payload.sources.length).toBeGreaterThan(0);
    expect(typeof payload.date).toBe('string');
    expect(payload.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('returns payload for stock scope with correct sources', async () => {
    vi.spyOn(fred, 'fetchFredSnapshot').mockResolvedValue({ dgs10: null, cpi: null, pce: null, unrate: null });
    vi.spyOn(twse, 'fetchTwseBwibbu').mockResolvedValue(null);
    vi.spyOn(twseChips, 'fetchTwseChips').mockResolvedValue(null);
    vi.spyOn(yahooNews, 'fetchYahooNews').mockResolvedValue([]);
    vi.spyOn(yahoo, 'fetchYahooQuote').mockResolvedValue({
      symbol: '2330', name: '台積電', price: 1085, change: 15, changePct: 1.4,
      volume: 100000, marketCap: null, high52w: null, low52w: null, pe: null, forwardPe: null, ttmEps: null,
    });

    const payload = await gatherDigestPayload(makeKvEnv(), { scope: 'stock', symbol: '2330' });

    expect(payload.scope).toBe('stock');
    expect(payload.symbol).toBe('2330');
    expect(payload.sources.some(s => s.name.includes('2330'))).toBe(true);
    expect(payload.user).toContain('2330');
  });
});
