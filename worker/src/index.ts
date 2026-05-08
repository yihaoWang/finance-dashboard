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
import { scheduled } from './cron';

export type Env = {
  AI: Ai;
  DB: D1Database;
  DIGEST_TOKEN?: string;
  FRED_API_KEY?: string;
  KV: KVNamespace;
  YAHOO_USER_AGENT?: string;
};

const app = new Hono<{ Bindings: Env }>();

app.use(
  '/api/*',
  cors({
    origin: [
      'http://localhost:5173',
      'https://finance-dashboard-6bb.pages.dev',
      /^https:\/\/[a-z0-9]+\.finance-dashboard-6bb\.pages\.dev$/,
    ],
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

export { app };
export default { fetch: app.fetch.bind(app), scheduled };
