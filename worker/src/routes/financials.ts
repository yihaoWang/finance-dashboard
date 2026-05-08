import { Hono } from 'hono';
import type { Env } from '../index';
import type { ApiResponse, FinancialsBundle } from '@fd/shared';
import { validateSymbol } from '../lib/symbol';
import { fetchQuarterlyFinancialsHistory } from '../sources/finmind';

export const financials = new Hono<{ Bindings: Env }>();

financials.get('/:symbol', async (c) => {
  let symbol: string;
  try {
    symbol = validateSymbol(c.req.param('symbol'));
  } catch {
    return c.json({ error: 'invalid_symbol' }, 400);
  }

  const bundle = await fetchQuarterlyFinancialsHistory(c.env.KV, symbol);

  const body: ApiResponse<FinancialsBundle> = {
    data: bundle,
    freshness: { source: 'fetch', ageSeconds: 0 },
  };
  return c.json(body);
});
