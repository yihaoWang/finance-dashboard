import type { IndicatorKey } from '@fd/shared';

export interface SentimentRow {
  date: string;
  value: number;
}

export const getHistory = async (
  db: D1Database,
  indicator: IndicatorKey,
  days: number = 365 * 10,
): Promise<SentimentRow[]> => {
  const result = await db
    .prepare(
      'SELECT date, value FROM sentiment_history WHERE indicator = ?1 ORDER BY date DESC LIMIT ?2',
    )
    .bind(indicator, days)
    .all<SentimentRow>();
  return result.results ?? [];
};

export const insertDailyValue = async (
  db: D1Database,
  indicator: IndicatorKey,
  date: string,
  value: number,
): Promise<void> => {
  await db
    .prepare(
      'INSERT OR REPLACE INTO sentiment_history (indicator, date, value) VALUES (?1, ?2, ?3)',
    )
    .bind(indicator, date, value)
    .run();
};
