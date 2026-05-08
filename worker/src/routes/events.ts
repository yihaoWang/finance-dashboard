import { Hono } from 'hono';
import type { Env } from '../index';
import type { ApiResponse, EventCategory, EventsBundle } from '@fd/shared';
import { kvGetJson, kvPutJson } from '../cache/kv';
import { queryUpcomingEvents, upsertEvents } from '../cache/d1-events';
import { fetchEconomicEvents } from '../sources/events';

const TTL = 1800;
const ALLOWED_CATEGORIES: EventCategory[] = ['fomc', 'cpi', 'employment', 'gdp', 'central_bank', 'geopolitics', 'other'];
const MAX_DAYS = 60;

const parseCategories = (raw: string | undefined): EventCategory[] | undefined => {
  if (!raw) return undefined;
  const parts = raw.split(',').map((p) => p.trim()).filter(Boolean);
  const filtered = parts.filter((p): p is EventCategory => (ALLOWED_CATEGORIES as string[]).includes(p));
  return filtered.length > 0 ? filtered : undefined;
};

const parseDays = (raw: string | undefined): number => {
  const n = Number.parseInt(raw ?? '14', 10);
  if (!Number.isFinite(n) || n <= 0) return 14;
  return Math.min(n, MAX_DAYS);
};

export const events = new Hono<{ Bindings: Env }>();

events.get('/', async (c) => {
  const days = parseDays(c.req.query('days'));
  const categories = parseCategories(c.req.query('category'));
  const cacheKey = `events:${days}:${categories?.join(',') ?? 'all'}`;

  const cached = await kvGetJson<{ value: EventsBundle; ts: number }>(c.env.KV, cacheKey);
  if (cached) {
    const ageSeconds = Math.floor((Date.now() - cached.ts) / 1000);
    return c.json({ data: cached.value, freshness: { source: 'kv', ageSeconds } } satisfies ApiResponse<EventsBundle>);
  }

  const now = Date.now();
  const to = now + days * 86_400_000;
  let items = await queryUpcomingEvents(c.env.DB, now, to, categories);
  let source: 'd1' | 'fetch' = 'd1';

  if (items.length === 0) {
    const fresh = await fetchEconomicEvents();
    await upsertEvents(c.env.DB, fresh, now);
    items = await queryUpcomingEvents(c.env.DB, now, to, categories);
    source = 'fetch';
  }

  const bundle: EventsBundle = { items, fetchedAt: now };
  await kvPutJson(c.env.KV, cacheKey, { value: bundle, ts: now }, TTL);
  return c.json({ data: bundle, freshness: { source, ageSeconds: 0 } } satisfies ApiResponse<EventsBundle>);
});
