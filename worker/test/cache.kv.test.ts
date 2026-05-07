import { describe, it, expect } from 'vitest';
import { env } from 'cloudflare:test';
import { kvGetJson, kvPutJson } from '../src/cache/kv';

describe('kv json helpers', () => {
  it('round-trips json', async () => {
    await kvPutJson(env.KV, 'k1', { a: 1 }, 60);
    const out = await kvGetJson<{ a: number }>(env.KV, 'k1');
    expect(out).toEqual({ a: 1 });
  });
  it('returns null when missing', async () => {
    const out = await kvGetJson(env.KV, 'missing');
    expect(out).toBeNull();
  });
});
