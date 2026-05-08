import { Hono } from 'hono';
import type { Env } from '../index';
import type { ApiResponse, Insight, InsightsBundle, InsightSourceKind } from '@fd/shared';
import { listRecentInsights, upsertInsight } from '../cache/d1-insights';

const MAX_DAYS = 14;
const MAX_LIMIT = 50;

const ALLOWED_KINDS: InsightSourceKind[] = ['podcast', 'youtube'];

const parseDays = (raw: string | undefined): number => {
  const n = Number.parseInt(raw ?? '3', 10);
  if (!Number.isFinite(n) || n <= 0) return 3;
  return Math.min(n, MAX_DAYS);
};

const parseLimit = (raw: string | undefined): number => {
  const n = Number.parseInt(raw ?? '20', 10);
  if (!Number.isFinite(n) || n <= 0) return 20;
  return Math.min(n, MAX_LIMIT);
};

const isStringArray = (v: unknown): v is string[] =>
  Array.isArray(v) && v.every((x): x is string => typeof x === 'string');

const parseInsightBody = (body: Record<string, unknown>): Insight | { error: string } => {
  const id = body['id'];
  const source = body['source'];
  const sourceKind = body['sourceKind'];
  const episodeTitle = body['episodeTitle'];
  const publishedAt = body['publishedAt'];
  const mainThesis = body['mainThesis'];
  const validationSignals = body['validationSignals'];
  const reversalSignals = body['reversalSignals'];
  const frameworkTags = body['frameworkTags'];
  const model = body['model'];

  if (
    typeof id !== 'string' ||
    typeof source !== 'string' ||
    typeof sourceKind !== 'string' ||
    typeof episodeTitle !== 'string' ||
    typeof publishedAt !== 'number' ||
    typeof mainThesis !== 'string' ||
    typeof model !== 'string' ||
    !isStringArray(validationSignals) ||
    !isStringArray(reversalSignals) ||
    !isStringArray(frameworkTags)
  ) {
    return { error: 'invalid_body' };
  }

  if (!(ALLOWED_KINDS as string[]).includes(sourceKind)) {
    return { error: 'invalid_source_kind' };
  }

  const episodeUrl = body['episodeUrl'];
  const audioUrl = body['audioUrl'];
  const actionHorizon = body['actionHorizon'];
  const actionSuggestion = body['actionSuggestion'];

  return {
    id,
    source,
    sourceKind: sourceKind as InsightSourceKind,
    episodeTitle,
    episodeUrl: typeof episodeUrl === 'string' ? episodeUrl : null,
    audioUrl: typeof audioUrl === 'string' ? audioUrl : null,
    publishedAt,
    mainThesis,
    validationSignals,
    reversalSignals,
    frameworkTags,
    actionHorizon: typeof actionHorizon === 'string' ? actionHorizon : null,
    actionSuggestion: typeof actionSuggestion === 'string' ? actionSuggestion : null,
    model,
    createdAt: Date.now(),
  };
};

export const insights = new Hono<{ Bindings: Env }>();

insights.get('/', async (c) => {
  const days = parseDays(c.req.query('days'));
  const limit = parseLimit(c.req.query('limit'));
  const sinceTs = Date.now() - days * 86_400_000;

  const items = await listRecentInsights(c.env.DB, sinceTs, limit);
  const bundle: InsightsBundle = { items, fetchedAt: Date.now() };
  const body: ApiResponse<InsightsBundle> = {
    data: bundle,
    freshness: { source: 'd1', ageSeconds: 0 },
  };
  return c.json(body);
});

insights.post('/ingest', async (c) => {
  const authHeader = c.req.header('Authorization');
  const token = c.env.DIGEST_TOKEN;
  if (!token || authHeader !== `Bearer ${token}`) {
    return c.json({ error: 'unauthorized' }, 401);
  }

  let body: unknown;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: 'invalid_json' }, 400);
  }

  if (typeof body !== 'object' || body === null) {
    return c.json({ error: 'invalid_body' }, 400);
  }

  const parsed = body as Record<string, unknown>;
  const insightOrError = parseInsightBody(parsed);
  if ('error' in insightOrError) {
    return c.json({ error: insightOrError.error }, 400);
  }

  const rawTranscript = typeof parsed['rawTranscript'] === 'string' ? parsed['rawTranscript'] : null;

  await upsertInsight(c.env.DB, insightOrError, rawTranscript);

  const responseBody: ApiResponse<Insight> = {
    data: insightOrError,
    freshness: { source: 'fetch', ageSeconds: 0 },
  };
  return c.json(responseBody);
});
