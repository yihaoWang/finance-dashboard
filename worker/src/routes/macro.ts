import { Hono } from 'hono';
import type { Env } from '../index';
import type { ApiResponse, MacroBundle } from '@fd/shared';
import { kvGetJson, kvPutJson } from '../cache/kv';
import { fetchMacroBundle } from '../sources/macro';

const TTL = 3600;
export const macro = new Hono<{ Bindings: Env }>();

macro.get('/', async (c) => {
  const cached = await kvGetJson<{ value: MacroBundle; ts: number }>(c.env.KV, 'macro:summary');
  if (cached) {
    const ageSeconds = Math.floor((Date.now() - cached.ts) / 1000);
    return c.json({ data: cached.value, freshness: { source: 'kv', ageSeconds } } satisfies ApiResponse<MacroBundle>);
  }
  const bundle = await fetchMacroBundle();
  await kvPutJson(c.env.KV, 'macro:summary', { value: bundle, ts: Date.now() }, TTL);
  return c.json({ data: bundle, freshness: { source: 'fetch', ageSeconds: 0 } } satisfies ApiResponse<MacroBundle>);
});
