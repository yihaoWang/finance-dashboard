import { describe, it, expect, beforeEach, vi } from 'vitest';
import { env, applyD1Migrations } from 'cloudflare:test';
import * as digestRunner from '../src/lib/digest-runner';
import { upsertDigest } from '../src/cache/d1-digests';
import type { Env } from '../src/index';
import type { DigestBundle } from '@fd/shared';

const makeEnv = (): Env => ({
  ...env,
  AI: { run: vi.fn() } as unknown as Ai,
  FRED_API_KEY: 'test-key',
});

const TODAY = new Date().toISOString().slice(0, 10);

const SAMPLE_BUNDLE: DigestBundle = {
  date: TODAY,
  scope: 'stock',
  symbol: '2330',
  sections: { hard_data: '硬數據段', framework: '框架解讀段', sentiment: '情緒段' },
  sources: [{ name: 'FRED', url: 'https://fred.stlouisfed.org', timestamp: Date.now() }],
  model: '@cf/meta/llama-3.1-8b-instruct',
  createdAt: Date.now(),
};

const MARKET_BUNDLE: DigestBundle = {
  ...SAMPLE_BUNDLE,
  scope: 'market',
  symbol: 'market',
};

// We need to pass a custom env to app.request since AI binding isn't in miniflare
// Instead import the app directly and test via fetch
const getApp = async () => {
  const mod = await import('../src/index');
  return mod.default;
};

describe('GET /api/digest (market)', () => {
  beforeEach(async () => {
    await applyD1Migrations(env.DB, env.TEST_MIGRATIONS);
    vi.restoreAllMocks();
  });

  it('returns 404 when no digest for today', async () => {
    const app = await getApp();
    const res = await app.fetch(new Request('http://localhost/api/digest'), makeEnv());
    expect(res.status).toBe(404);
    const body = await res.json() as { error: string };
    expect(body.error).toBe('not_yet_generated');
  });

  it('returns 200 with existing market digest', async () => {
    await upsertDigest(env.DB, MARKET_BUNDLE);
    const app = await getApp();
    const res = await app.fetch(new Request('http://localhost/api/digest'), makeEnv());
    expect(res.status).toBe(200);
    const body = await res.json() as { data: DigestBundle };
    expect(body.data.scope).toBe('market');
    expect(body.data.sections.hard_data).toBe('硬數據段');
  });
});

describe('GET /api/digest/:symbol', () => {
  beforeEach(async () => {
    await applyD1Migrations(env.DB, env.TEST_MIGRATIONS);
    vi.restoreAllMocks();
  });

  it('returns 400 for invalid symbol', async () => {
    const app = await getApp();
    const res = await app.fetch(new Request('http://localhost/api/digest/bad-symbol'), makeEnv());
    expect(res.status).toBe(400);
    const body = await res.json() as { error: string };
    expect(body.error).toBe('invalid_symbol');
  });

  it('returns 404 when no digest for symbol', async () => {
    const app = await getApp();
    const res = await app.fetch(new Request('http://localhost/api/digest/2330'), makeEnv());
    expect(res.status).toBe(404);
  });

  it('returns 200 with existing stock digest', async () => {
    await upsertDigest(env.DB, SAMPLE_BUNDLE);
    const app = await getApp();
    const res = await app.fetch(new Request('http://localhost/api/digest/2330'), makeEnv());
    expect(res.status).toBe(200);
    const body = await res.json() as { data: DigestBundle };
    expect(body.data.symbol).toBe('2330');
    expect(body.data.sections.sentiment).toBe('情緒段');
  });
});

describe('GET /api/digest/history', () => {
  beforeEach(async () => {
    await applyD1Migrations(env.DB, env.TEST_MIGRATIONS);
    vi.restoreAllMocks();
  });

  it('returns empty list when no history', async () => {
    const app = await getApp();
    const res = await app.fetch(new Request('http://localhost/api/digest/history?scope=stock&symbol=2330'), makeEnv());
    expect(res.status).toBe(200);
    const body = await res.json() as { data: unknown[] };
    expect(body.data).toEqual([]);
  });

  it('returns history items after upsert', async () => {
    await upsertDigest(env.DB, SAMPLE_BUNDLE);
    const app = await getApp();
    const res = await app.fetch(new Request('http://localhost/api/digest/history?scope=stock&symbol=2330'), makeEnv());
    expect(res.status).toBe(200);
    const body = await res.json() as { data: Array<{ date: string; symbol: string }> };
    expect(body.data.length).toBe(1);
    expect(body.data[0].symbol).toBe('2330');
  });

  it('returns 400 for invalid symbol in history', async () => {
    const app = await getApp();
    const res = await app.fetch(new Request('http://localhost/api/digest/history?scope=stock&symbol=bad!!'), makeEnv());
    expect(res.status).toBe(400);
  });
});

describe('POST /api/digest/regenerate', () => {
  beforeEach(async () => {
    await applyD1Migrations(env.DB, env.TEST_MIGRATIONS);
    vi.restoreAllMocks();
  });

  it('runs pipeline and returns bundle', async () => {
    vi.spyOn(digestRunner, 'runDigestPipeline').mockResolvedValue(MARKET_BUNDLE);
    const app = await getApp();
    const res = await app.fetch(
      new Request('http://localhost/api/digest/regenerate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scope: 'market' }),
      }),
      makeEnv(),
    );
    expect(res.status).toBe(200);
    const body = await res.json() as { data: DigestBundle };
    expect(body.data.scope).toBe('market');
  });

  it('returns 400 for invalid symbol on stock scope', async () => {
    const app = await getApp();
    const res = await app.fetch(
      new Request('http://localhost/api/digest/regenerate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scope: 'stock', symbol: 'bad!!' }),
      }),
      makeEnv(),
    );
    expect(res.status).toBe(400);
  });
});
