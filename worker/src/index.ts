import { Hono } from 'hono';
import { health } from './routes/health';

export type Env = {
  DB: D1Database;
  KV: KVNamespace;
  YAHOO_USER_AGENT?: string;
};

const app = new Hono<{ Bindings: Env }>();

app.route('/api/health', health);

export default app;
