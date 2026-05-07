import { Hono } from 'hono';
import type { Env } from '../index';
import type { ApiResponse, StockBundle } from '@fd/shared';
import { validateSymbol } from '../lib/symbol';
import { kvGetJson, kvPutJson } from '../cache/kv';
import { upsertDailyPrices, recentCloses, recentDailyPrices } from '../cache/d1';
import { fetchYahooQuote, fetchYahooHistory } from '../sources/yahoo';
import { fetchTwseBwibbu, fetchTwseMonthlyRevenue } from '../sources/twse';
import { fetchTwseChips } from '../sources/twse-chips';
import { fetchQuarterlyFinancials } from '../sources/finmind';
import { sma } from '../indicators/ma';
import { deviation } from '../indicators/deviation';

const QUOTE_TTL = 60;

export const stock = new Hono<{ Bindings: Env }>();

stock.get('/:symbol', async (c) => {
  let symbol: string;
  try {
    symbol = validateSymbol(c.req.param('symbol'));
  } catch {
    return c.json({ error: 'invalid_symbol' }, 400);
  }

  const warnings: string[] = [];

  const cacheKey = `quote:${symbol}`;
  const cached = await kvGetJson<{ value: StockBundle; ts: number }>(c.env.KV, cacheKey);
  if (cached) {
    const ageSeconds = Math.floor((Date.now() - cached.ts) / 1000);
    const body: ApiResponse<StockBundle> = {
      data: cached.value,
      freshness: { source: 'kv', ageSeconds },
    };
    return c.json(body);
  }

  let quote;
  try {
    quote = await fetchYahooQuote(symbol);
  } catch (err) {
    console.warn('yahoo quote failed for symbol', symbol, err);
    return c.json({ error: 'upstream_failed' }, 502);
  }

  let closes = await recentCloses(c.env.DB, symbol, 20);
  if (closes.length < 20) {
    try {
      const history = await fetchYahooHistory(symbol, '3mo');
      await upsertDailyPrices(c.env.DB, symbol, history);
      closes = await recentCloses(c.env.DB, symbol, 20);
    } catch (err) {
      console.warn('yahoo history failed for symbol', symbol, err);
      warnings.push('history_unavailable');
    }
  }

  const priceHistory = await recentDailyPrices(c.env.DB, symbol, 60);

  const ma20 = sma(closes, 20);
  const ma20Deviation = deviation(quote.price, ma20);

  let twse = null;
  try {
    twse = await fetchTwseBwibbu(c.env.KV, symbol);
  } catch (err) {
    console.warn('twse bwibbu failed for symbol', symbol, err);
    warnings.push('twse_unavailable');
  }

  let revenue = null;
  try {
    revenue = await fetchTwseMonthlyRevenue(c.env.KV, symbol);
  } catch (err) {
    console.warn('twse revenue failed for symbol', symbol, err);
    warnings.push('revenue_unavailable');
  }

  let chips = null;
  try {
    chips = await fetchTwseChips(c.env.KV, symbol);
  } catch (err) {
    console.warn('twse chips failed for symbol', symbol, err);
    warnings.push('chips_unavailable');
  }

  let financials = null;
  try {
    financials = await fetchQuarterlyFinancials(c.env.KV, symbol);
  } catch (err) {
    console.warn('finmind financials failed for symbol', symbol, err);
    warnings.push('financials_unavailable');
  }

  const derivedEps =
    twse?.pe && twse.pe > 0 && quote.price > 0 ? quote.price / twse.pe : null;

  const bundle: StockBundle = {
    chips,
    history: priceHistory,
    quote: {
      symbol: quote.symbol,
      name: twse?.name ?? quote.name,
      price: quote.price,
      change: quote.change,
      changePct: quote.changePct,
      volume: quote.volume,
      marketCap: quote.marketCap,
      high52w: quote.high52w,
      low52w: quote.low52w,
      updatedAt: Date.now(),
    },
    kpi: {
      pe: twse?.pe ?? quote.pe,
      forwardPe: quote.forwardPe,
      ttmEps: quote.ttmEps ?? derivedEps,
      grossMargin: financials?.grossMargin ?? null,
      opMargin: financials?.opMargin ?? null,
      netMargin: financials?.netMargin ?? null,
      roe: financials?.roe ?? null,
      monthlyRevenueYoy: revenue?.yoy ?? null,
      ma20Deviation,
    },
  };

  await kvPutJson(c.env.KV, cacheKey, { value: bundle, ts: Date.now() }, QUOTE_TTL);

  const body: ApiResponse<StockBundle> = {
    data: bundle,
    freshness: { source: 'fetch', ageSeconds: 0 },
    ...(warnings.length > 0 ? { warnings } : {}),
  };
  return c.json(body);
});
