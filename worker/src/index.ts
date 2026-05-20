import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { health } from './routes/health';
import { history } from './routes/history';
import { macro } from './routes/macro';
import { stock } from './routes/stock';
import { news } from './routes/news';
import { digest } from './routes/digest';
import { financials } from './routes/financials';
import { events } from './routes/events';
import { insights } from './routes/insights';
import { sentiment } from './routes/sentiment';
import { peace } from './routes/peace';
import { screener } from './routes/screener';
import { valuation } from './routes/valuation';
import { scheduled } from './cron';
import { insertDailyValue } from './cache/d1-sentiment';
import { runSentimentDaily, runScreenerScan, rescoreSymbols } from './cron';
import type { IndicatorKey } from '@fd/shared';

export type Env = {
  ADMIN_TOKEN: string;
  AI: Ai;
  DB: D1Database;
  DIGEST_TOKEN?: string;
  FRED_API_KEY?: string;
  FINMIND_API_TOKEN?: string;
  KV: KVNamespace;
  YAHOO_USER_AGENT?: string;
};

const app = new Hono<{ Bindings: Env }>();

// Plumb FinMind token to module-level config on every request.
app.use('/api/*', async (c, next) => {
  const { setFinMindToken } = await import('./lib/finmind-token');
  setFinMindToken(c.env.FINMIND_API_TOKEN);
  await next();
});

app.use(
  '/api/*',
  cors({
    origin: (origin) => {
      if (origin === 'http://localhost:5173') return origin;
      if (origin === 'https://finance-dashboard-6bb.pages.dev') return origin;
      if (/^https:\/\/[a-z0-9]+\.finance-dashboard-6bb\.pages\.dev$/.test(origin)) return origin;
      return null;
    },
    allowMethods: ['GET', 'POST', 'DELETE', 'OPTIONS'],
    maxAge: 86400,
  }),
);

app.route('/api/health', health);
app.route('/api/history', history);
app.route('/api/macro', macro);
app.route('/api/stock', stock);
app.route('/api/news', news);
app.route('/api/digest', digest);
app.route('/api/financials', financials);
app.route('/api/events', events);
app.route('/api/insights', insights);
app.route('/api/sentiment', sentiment);
app.route('/api/peace', peace);
app.route('/api/screener', screener);
app.route('/api/valuation', valuation);

app.post('/api/admin/sentiment-backfill', async (c) => {
  const auth = c.req.header('authorization');
  if (auth !== `Bearer ${c.env.ADMIN_TOKEN}`) {
    return c.json({ error: 'unauthorized' }, 401);
  }
  const { indicator, date, value } = await c.req.json<{
    indicator: IndicatorKey;
    date: string;
    value: number;
  }>();
  await insertDailyValue(c.env.DB, indicator, date, value);
  return c.json({ ok: true });
});

app.post('/api/admin/sentiment-backfill-bulk', async (c) => {
  const auth = c.req.header('authorization');
  if (auth !== `Bearer ${c.env.ADMIN_TOKEN}`) {
    return c.json({ error: 'unauthorized' }, 401);
  }
  const { rows } = await c.req.json<{
    rows: Array<{ indicator: IndicatorKey; date: string; value: number }>;
  }>();
  const stmts = rows.map((r) =>
    c.env.DB.prepare(
      'INSERT INTO sentiment_history (indicator, date, value) VALUES (?1, ?2, ?3) ON CONFLICT(indicator, date) DO UPDATE SET value=excluded.value',
    ).bind(r.indicator, r.date, r.value),
  );
  await c.env.DB.batch(stmts);
  return c.json({ ok: true, inserted: rows.length });
});

// Admin endpoint to trigger the sentiment daily pipeline on-demand (behind ADMIN_TOKEN).
// Kept for operational convenience; safe to leave in production.
app.post('/api/admin/sentiment-trigger-daily', async (c) => {
  const auth = c.req.header('authorization');
  if (auth !== `Bearer ${c.env.ADMIN_TOKEN}`) {
    return c.json({ error: 'unauthorized' }, 401);
  }
  await runSentimentDaily(c.env);
  return c.json({ ok: true });
});

app.post('/api/admin/screener-scan', async (c) => {
  const auth = c.req.header('authorization');
  if (auth !== `Bearer ${c.env.ADMIN_TOKEN}`) {
    return c.json({ error: 'unauthorized' }, 401);
  }
  const offset = Number(c.req.query('offset') ?? '0');
  const limitParam = c.req.query('limit');
  const opts: { offset?: number; limit?: number } = {};
  if (Number.isFinite(offset) && offset > 0) opts.offset = offset;
  if (limitParam !== undefined) {
    const lim = Number(limitParam);
    if (Number.isFinite(lim) && lim > 0) opts.limit = lim;
  }
  const stats = await runScreenerScan(c.env, opts);
  return c.json({ success: true, stats });
});

// Re-score a list of symbols on demand (KV cache busts → fresh FinMind fetch).
// Body: { symbols: ["2330","2618"] }
app.post('/api/admin/rescore', async (c) => {
  const auth = c.req.header('authorization');
  if (auth !== `Bearer ${c.env.ADMIN_TOKEN}`) {
    return c.json({ error: 'unauthorized' }, 401);
  }
  const body = await c.req.json<{ symbols?: string[] }>().catch(() => ({}));
  const symbols = Array.isArray(body.symbols) ? body.symbols.filter((s) => typeof s === 'string') : [];
  if (symbols.length === 0) return c.json({ error: 'symbols required' }, 400);
  const stats = await rescoreSymbols(c.env, symbols);
  return c.json({ success: true, ...stats });
});

export { app };
export default { fetch: app.fetch.bind(app), scheduled };
