import { Hono } from 'hono';
import type { Env } from '../index';
import type { ApiResponse, ScreenerBundle } from '@fd/shared';
import { listScreenerScores } from '../cache/d1-screener';

export const screener = new Hono<{ Bindings: Env }>();

screener.get('/', async (c) => {
  const rows = await listScreenerScores(c.env.DB, 100);
  // Recommended = priority pass ≥ 5 AND total score ≥ 11 (value-investing buy threshold)
  const recommended = rows.filter((r) => r.priorityScore >= 5 && r.score >= 11).slice(0, 10);
  const updatedAt = rows.length ? Math.max(...rows.map((r) => r.updatedAt)) : 0;

  const body: ApiResponse<ScreenerBundle> = {
    data: { rows, recommended, updatedAt },
    freshness: {
      source: 'd1',
      ageSeconds: updatedAt ? Math.floor((Date.now() - updatedAt) / 1000) : 0,
    },
  };
  return c.json(body);
});
