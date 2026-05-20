import { Hono } from 'hono';
import type { Env } from '../index';
import type { MoatCategory, PeaceBundle, RiskCategory } from '@fd/shared';
import { kvGetJson, kvPutJson } from '../cache/kv';
import { fetchFiveYearFinancials } from '../sources/finmind';
import { fetchFredSnapshot } from '../sources/fred';
import { computePeace } from '../lib/peace';
import { getTags, setTags } from '../cache/d1-tags';

const KV_PREFIX = 'peace:v10:';
const TTL = 6 * 3600;

// WACC = 10Y US Treasury yield + 5% (simplified model agreed with user)
const WACC_PREMIUM = 5.0;
const WACC_FALLBACK = 9.5; // fallback if FRED unavailable (as of mid-2025)

export const peace = new Hono<{ Bindings: Env }>();

peace.get('/', async (c) => {
  const symbol = c.req.query('symbol');
  if (!symbol) return c.json({ error: 'symbol required' }, 400);

  const cacheKey = `${KV_PREFIX}${symbol}`;
  const cached = await kvGetJson<PeaceBundle>(c.env.KV, cacheKey);
  if (cached !== null) {
    return c.json({ data: cached, freshness: { source: 'kv', ageSeconds: 0 } });
  }

  // Fetch FRED for current 10Y yield
  let wacc = WACC_FALLBACK;
  try {
    const fredSnapshot = await fetchFredSnapshot(c.env);
    if (fredSnapshot.dgs10?.latest !== undefined) {
      wacc = fredSnapshot.dgs10.latest + WACC_PREMIUM;
    }
  } catch (err) {
    console.warn('[peace] FRED fetch failed, using fallback WACC', err);
  }

  const [financials, tags] = await Promise.all([
    fetchFiveYearFinancials(c.env.KV, symbol),
    getTags(c.env.DB, symbol),
  ]);

  const bundle = computePeace(financials, wacc, tags.moat, tags.risk, {
    moatReasons: tags.moatReasons,
    riskReasons: tags.riskReasons,
    moatNote: tags.moatNote,
    riskNote: tags.riskNote,
  });

  await kvPutJson(c.env.KV, cacheKey, bundle, TTL);
  return c.json({ data: bundle, freshness: { source: 'fetch', ageSeconds: 0 } });
});

peace.post('/tags', async (c) => {
  const body = await c.req.json<{ symbol: string; kind: 'moat' | 'risk'; values: string[] }>();
  const { symbol, kind, values } = body;

  if (!symbol || !kind || !Array.isArray(values)) {
    return c.json({ error: 'symbol, kind, and values required' }, 400);
  }
  if (kind !== 'moat' && kind !== 'risk') {
    return c.json({ error: 'kind must be moat or risk' }, 400);
  }

  console.log('[peace] tag update', symbol, kind, values);

  if (kind === 'moat') {
    await setTags(c.env.DB, symbol, 'moat', values as MoatCategory[]);
  } else {
    await setTags(c.env.DB, symbol, 'risk', values as RiskCategory[]);
  }

  // Invalidate KV cache so next GET recomputes with new tags
  await c.env.KV.delete(`${KV_PREFIX}${symbol}`);

  return c.json({ ok: true });
});
