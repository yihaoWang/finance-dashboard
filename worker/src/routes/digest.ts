import { Hono } from 'hono';
import type { Env } from '../index';
import type { ApiResponse, DigestBundle, DigestHistoryItem, DigestScope } from '@fd/shared';
import { validateSymbol } from '../lib/symbol';
import { getDigest, listDigestHistory } from '../cache/d1-digests';
import { runDigestPipeline } from '../lib/digest-runner';

export const digest = new Hono<{ Bindings: Env }>();

const todayUtc = (): string => new Date().toISOString().slice(0, 10);

// GET /api/digest?date=YYYY-MM-DD — market digest
digest.get('/', async (c) => {
  const date = c.req.query('date') ?? todayUtc();
  const row = await getDigest(c.env.DB, 'market', 'market', date);
  if (!row) {
    return c.json({ error: 'not_yet_generated' }, 404);
  }
  const body: ApiResponse<DigestBundle> = {
    data: row,
    freshness: { source: 'd1', ageSeconds: Math.floor((Date.now() - row.createdAt) / 1000) },
  };
  return c.json(body);
});

// GET /api/digest/history?scope=market|stock&symbol=XXXX&limit=30
digest.get('/history', async (c) => {
  const scopeRaw = c.req.query('scope');
  const symbolRaw = c.req.query('symbol');
  const limitRaw = c.req.query('limit');

  const scope: DigestScope = scopeRaw === 'stock' ? 'stock' : 'market';
  const limit = Math.min(100, Math.max(1, Number(limitRaw ?? '30') || 30));

  let symbol: string | undefined;
  if (symbolRaw !== undefined) {
    try {
      symbol = validateSymbol(symbolRaw);
    } catch {
      return c.json({ error: 'invalid_symbol' }, 400);
    }
  }

  const items = await listDigestHistory(c.env.DB, scope, symbol, limit);
  const body: ApiResponse<DigestHistoryItem[]> = {
    data: items,
    freshness: { source: 'd1', ageSeconds: 0 },
  };
  return c.json(body);
});

// POST /api/digest/regenerate — body { scope, symbol }
digest.post('/regenerate', async (c) => {
  let body: unknown;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: 'invalid_json' }, 400);
  }

  const parsed = body as Record<string, unknown>;
  const scope: DigestScope = parsed['scope'] === 'stock' ? 'stock' : 'market';
  const symbolRaw = parsed['symbol'];

  let symbol: string;
  if (scope === 'stock') {
    if (typeof symbolRaw !== 'string') {
      return c.json({ error: 'symbol_required_for_stock' }, 400);
    }
    try {
      symbol = validateSymbol(symbolRaw);
    } catch {
      return c.json({ error: 'invalid_symbol' }, 400);
    }
  } else {
    symbol = 'market';
  }

  const bundle = await runDigestPipeline(c.env, { scope, symbol });
  const responseBody: ApiResponse<DigestBundle> = {
    data: bundle,
    freshness: { source: 'fetch', ageSeconds: 0 },
  };
  return c.json(responseBody);
});

// GET /api/digest/:symbol?date=YYYY-MM-DD — stock digest
digest.get('/:symbol', async (c) => {
  let symbol: string;
  try {
    symbol = validateSymbol(c.req.param('symbol'));
  } catch {
    return c.json({ error: 'invalid_symbol' }, 400);
  }

  const date = c.req.query('date') ?? todayUtc();
  const row = await getDigest(c.env.DB, 'stock', symbol, date);
  if (!row) {
    return c.json({ error: 'not_yet_generated' }, 404);
  }
  const body: ApiResponse<DigestBundle> = {
    data: row,
    freshness: { source: 'd1', ageSeconds: Math.floor((Date.now() - row.createdAt) / 1000) },
  };
  return c.json(body);
});
