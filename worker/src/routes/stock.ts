import { Hono } from 'hono';
import type { Env } from '../index';
import type { ApiResponse, StockBundle } from '@fd/shared';
import { validateSymbol } from '../lib/symbol';
import { kvGetJson, kvPutJson } from '../cache/kv';
import { upsertDailyPrices, recentCloses, recentDailyPrices } from '../cache/d1';
import { fetchYahooQuote, fetchYahooHistory } from '../sources/yahoo';
import { fetchTwseMisQuote } from '../sources/twse-mis';
import { fetchTwseBwibbu, fetchTwseMonthlyRevenue } from '../sources/twse';
import { fetchTwseChips } from '../sources/twse-chips';
import { fetchTwseMargin, fetchTwseForeignHolding } from '../sources/twse-margin';
import { fetchQuarterlyFinancials } from '../sources/finmind';
import { sma } from '../indicators/ma';
import { deviation } from '../indicators/deviation';
import { rsi } from '../indicators/rsi';
import { macd } from '../indicators/macd';
import { supportResistance } from '../indicators/range';

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

  // Live intraday from TWSE MIS overrides Yahoo daily-candle when available.
  try {
    const mis = await fetchTwseMisQuote(symbol);
    if (mis && mis.price !== null && mis.prevClose !== null && mis.prevClose > 0) {
      const change = mis.price - mis.prevClose;
      const changePct = (change / mis.prevClose) * 100;
      quote = {
        ...quote,
        name: mis.name || quote.name,
        price: mis.price,
        change,
        changePct,
        volume: mis.volumeLots * 1000,
        marketTime: mis.marketTime ?? quote.marketTime,
      };
    }
  } catch (err) {
    console.warn('twse mis failed for symbol', symbol, err);
    warnings.push('mis_unavailable');
  }

  let closes = await recentCloses(c.env.DB, symbol, 60);
  if (closes.length < 20) {
    try {
      const history = await fetchYahooHistory(symbol, '3mo');
      await upsertDailyPrices(c.env.DB, symbol, history);
      closes = await recentCloses(c.env.DB, symbol, 60);
    } catch (err) {
      console.warn('yahoo history failed for symbol', symbol, err);
      warnings.push('history_unavailable');
    }
  }

  const priceHistory = await recentDailyPrices(c.env.DB, symbol, 60);

  const ma20 = sma(closes, 20);
  const ma20Deviation = deviation(quote.price, ma20);
  const rsi14 = rsi(closes, 14);
  const macdResult = macd(closes);
  const sr = supportResistance(closes, 20);

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

  const [chipsResult, marginResult, foreignResult] = await Promise.allSettled([
    fetchTwseChips(c.env.KV, symbol),
    fetchTwseMargin(c.env.KV, symbol),
    fetchTwseForeignHolding(c.env.KV, symbol),
  ]);

  let chips = null;
  if (chipsResult.status === 'fulfilled') {
    const base = chipsResult.value;
    const margin = marginResult.status === 'fulfilled' ? marginResult.value : null;
    const foreign = foreignResult.status === 'fulfilled' ? foreignResult.value : null;
    if (margin === null && marginResult.status === 'rejected') {
      console.warn('twse margin failed for symbol', symbol, marginResult.reason);
      warnings.push('margin_unavailable');
    }
    if (foreign === null && foreignResult.status === 'rejected') {
      console.warn('twse foreign holding failed for symbol', symbol, foreignResult.reason);
      warnings.push('foreign_holding_unavailable');
    }
    if (base !== null) {
      chips = {
        ...base,
        financingBalance: margin?.financingBalance ?? null,
        shortBalance: margin?.shortBalance ?? null,
        foreignHoldingPct: foreign?.holdingPct ?? null,
      };
    }
  } else {
    console.warn('twse chips failed for symbol', symbol, chipsResult.reason);
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
      marketTime: quote.marketTime,
    },
    kpi: {
      macd: macdResult.macd,
      macdSignal: macdResult.signal,
      ma20Deviation,
      grossMargin: financials?.grossMargin ?? null,
      forwardPe: quote.forwardPe,
      monthlyRevenueYoy: revenue?.yoy ?? null,
      netMargin: financials?.netMargin ?? null,
      opMargin: financials?.opMargin ?? null,
      pe: twse?.pe ?? quote.pe,
      resistance: sr?.resistance ?? null,
      roe: financials?.roe ?? null,
      rsi14,
      support: sr?.support ?? null,
      ttmEps: quote.ttmEps ?? derivedEps,
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
