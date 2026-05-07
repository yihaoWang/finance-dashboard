import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { health } from './routes/health';
import { history } from './routes/history';
import { macro } from './routes/macro';
import { stock } from './routes/stock';
import { news } from './routes/news';

export type Env = {
  DB: D1Database;
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

export default app;
