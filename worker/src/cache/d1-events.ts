import type { EventCategory, EventImpact, EventItem } from '@fd/shared';

export const upsertEvents = async (db: D1Database, items: EventItem[], fetchedAt: number): Promise<void> => {
  if (items.length === 0) return;
  const stmt = db.prepare(
    `INSERT INTO events (id, event_time, category, title, country, impact, source, url, forecast, previous, actual, fetched_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET
       event_time=excluded.event_time,
       impact=excluded.impact,
       forecast=excluded.forecast,
       previous=excluded.previous,
       actual=excluded.actual,
       fetched_at=excluded.fetched_at`,
  );
  const batch = items.map((it) =>
    stmt.bind(
      it.id,
      it.eventTime,
      it.category,
      it.title,
      it.country,
      it.impact,
      it.source,
      it.url,
      it.forecast,
      it.previous,
      it.actual,
      fetchedAt,
    ),
  );
  await db.batch(batch);
};

type Row = {
  id: string;
  event_time: number;
  category: string;
  title: string;
  country: string;
  impact: string;
  source: string;
  url: string | null;
  forecast: string | null;
  previous: string | null;
  actual: string | null;
};

const rowToItem = (r: Row): EventItem => ({
  id: r.id,
  eventTime: r.event_time,
  category: r.category as EventCategory,
  title: r.title,
  country: r.country,
  impact: r.impact as EventImpact,
  source: r.source,
  url: r.url,
  forecast: r.forecast,
  previous: r.previous,
  actual: r.actual,
});

export const queryUpcomingEvents = async (
  db: D1Database,
  fromTs: number,
  toTs: number,
  categories?: EventCategory[],
): Promise<EventItem[]> => {
  let sql = 'SELECT * FROM events WHERE event_time BETWEEN ? AND ?';
  const binds: unknown[] = [fromTs, toTs];
  if (categories && categories.length > 0) {
    sql += ` AND category IN (${categories.map(() => '?').join(',')})`;
    binds.push(...categories);
  }
  sql += ' ORDER BY event_time ASC LIMIT 200';
  const res = await db.prepare(sql).bind(...binds).all<Row>();
  return (res.results ?? []).map(rowToItem);
};
