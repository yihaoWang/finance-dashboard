import { Hono } from 'hono';
import type { Env } from '../index';
import { validateSymbol } from '../lib/symbol';
import { kvGetJson, kvPutJson } from '../cache/kv';
import { fetchYahooHistory } from '../sources/yahoo';
import type { ApiResponse, PricePoint } from '@fd/shared';

const TTL = 6 * 3600;
const VALID_RANGES = new Set(['1mo', '3mo', '1y', '5y']);

export const history = new Hono<{ Bindings: Env }>();

history.get('/:symbol', async (c) => {
  let symbol: string;
  try {
    symbol = validateSymbol(c.req.param('symbol'));
  } catch {
    return c.json({ error: 'invalid_symbol' }, 400);
  }
  const range = c.req.query('range') ?? '3mo';
  if (!VALID_RANGES.has(range)) return c.json({ error: 'invalid_range' }, 400);

  const key = `history:${symbol}:${range}`;
  const cached = await kvGetJson<{ value: PricePoint[]; ts: number }>(c.env.KV, key);
  if (cached) {
    const ageSeconds = Math.floor((Date.now() - cached.ts) / 1000);
    return c.json({ data: cached.value, freshness: { source: 'kv', ageSeconds } } satisfies ApiResponse<PricePoint[]>);
  }

  const rows = await fetchYahooHistory(symbol, range as '1mo' | '3mo' | '1y' | '5y');
  const points: PricePoint[] = rows.map((r) => ({ date: r.date, close: r.close }));
  await kvPutJson(c.env.KV, key, { value: points, ts: Date.now() }, TTL);
  return c.json({ data: points, freshness: { source: 'fetch', ageSeconds: 0 } } satisfies ApiResponse<PricePoint[]>);
});
