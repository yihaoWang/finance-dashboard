import { describe, it, expect, beforeEach, vi } from 'vitest';
import { env } from 'cloudflare:test';
import { app } from '../src/index';
import * as macroSource from '../src/sources/macro';
import type { MacroBundle } from '@fd/shared';

const mockBundle: MacroBundle = {
  us10y: { value: 4.32, changePct: 0.46 },
  vix: { value: 18.5, changePct: -2.63 },
  sox: { value: 5000, changePct: 2.04 },
  dxy: { value: 104.5, changePct: 1.45 },
  twd: { value: 32.5, changePct: 1.56 },
};

describe('GET /api/macro', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('fetches from source on cache miss and returns bundle', async () => {
    vi.spyOn(macroSource, 'fetchMacroBundle').mockResolvedValue(mockBundle);

    const res = await app.request('/api/macro', {}, env);
    expect(res.status).toBe(200);
    const body = await res.json() as { data: MacroBundle; freshness: { source: string; ageSeconds: number } };
    expect(body.data.us10y?.value).toBeCloseTo(4.32);
    expect(body.data.vix?.value).toBe(18.5);
    expect(body.freshness.source).toBe('fetch');
    expect(body.freshness.ageSeconds).toBe(0);
  });

  it('serves from KV cache on second call', async () => {
    const spy = vi.spyOn(macroSource, 'fetchMacroBundle').mockResolvedValue(mockBundle);

    await app.request('/api/macro', {}, env);
    const res2 = await app.request('/api/macro', {}, env);
    expect(spy).toHaveBeenCalledTimes(1);
    const body = await res2.json() as { freshness: { source: string } };
    expect(body.freshness.source).toBe('kv');
  });
});
