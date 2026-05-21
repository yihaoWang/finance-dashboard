import { Hono } from 'hono';
import type { Env } from '../index';

export const prefs = new Hono<{ Bindings: Env }>();

const DEFAULT_WATCHLIST = ['2330', '2454', '2317', '3008', '2308'];
const MAX_WATCHLIST = 30;
const MAX_RECENTS = 12;
const SYMBOL_RE = /^[A-Z0-9]{4,6}$/;

const sanitize = (arr: unknown, max: number): string[] => {
  if (!Array.isArray(arr)) return [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const v of arr) {
    if (typeof v !== 'string') continue;
    const s = v.trim().toUpperCase();
    if (!SYMBOL_RE.test(s)) continue;
    if (seen.has(s)) continue;
    seen.add(s);
    out.push(s);
    if (out.length >= max) break;
  }
  return out;
};

const parseJson = (raw: unknown, fallback: string[]): string[] => {
  if (typeof raw !== 'string') return fallback;
  try {
    const v = JSON.parse(raw);
    return Array.isArray(v) ? sanitize(v, Math.max(MAX_WATCHLIST, MAX_RECENTS)) : fallback;
  } catch {
    return fallback;
  }
};

const getEmail = (h: Headers): string | null => {
  // X-End-User-Email is forwarded by the Pages Function proxy (the service
  // token used worker-side overwrites CF Access's user-identity headers).
  const e =
    h.get('X-End-User-Email') ??
    h.get('x-end-user-email') ??
    h.get('Cf-Access-Authenticated-User-Email') ??
    h.get('cf-access-authenticated-user-email');
  if (!e) return null;
  const s = e.trim().toLowerCase();
  return s.length > 0 && s.length < 320 ? s : null;
};

prefs.get('/', async (c) => {
  const email = getEmail(c.req.raw.headers);
  if (!email) {
    return c.json({ email: null, watchlist: DEFAULT_WATCHLIST, recents: [] satisfies string[] });
  }
  const row = await c.env.DB.prepare(
    'SELECT watchlist, recents FROM user_prefs WHERE email = ?1',
  )
    .bind(email)
    .first<{ watchlist: string; recents: string }>();
  if (!row) {
    return c.json({ email, watchlist: DEFAULT_WATCHLIST, recents: [] satisfies string[] });
  }
  return c.json({
    email,
    watchlist: parseJson(row.watchlist, DEFAULT_WATCHLIST),
    recents: parseJson(row.recents, []),
  });
});

prefs.get('/names', async (c) => {
  const raw = c.req.query('symbols') ?? '';
  const symbols = raw
    .split(',')
    .map((s) => s.trim().toUpperCase())
    .filter((s) => SYMBOL_RE.test(s))
    .slice(0, 50);
  if (symbols.length === 0) return c.json({ names: {} as Record<string, string> });
  const placeholders = symbols.map((_, i) => `?${i + 1}`).join(',');
  const result = await c.env.DB.prepare(
    `SELECT symbol, name FROM screener_scores WHERE symbol IN (${placeholders})`,
  )
    .bind(...symbols)
    .all<{ symbol: string; name: string | null }>();
  const names: Record<string, string> = {};
  for (const row of result.results ?? []) {
    if (row.name) names[row.symbol] = row.name;
  }
  return c.json({ names });
});

prefs.put('/', async (c) => {
  const email = getEmail(c.req.raw.headers);
  if (!email) return c.json({ error: 'no_identity' }, 401);
  const body = await c.req.json<{ watchlist?: unknown; recents?: unknown }>().catch(() => ({}));
  const watchlist = sanitize(body.watchlist, MAX_WATCHLIST);
  const recents = sanitize(body.recents, MAX_RECENTS);
  const now = Date.now();
  await c.env.DB.prepare(
    `INSERT INTO user_prefs (email, watchlist, recents, updated_at) VALUES (?1, ?2, ?3, ?4)
     ON CONFLICT(email) DO UPDATE SET watchlist = excluded.watchlist, recents = excluded.recents, updated_at = excluded.updated_at`,
  )
    .bind(email, JSON.stringify(watchlist), JSON.stringify(recents), now)
    .run();
  return c.json({ email, watchlist, recents });
});
