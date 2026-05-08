CREATE TABLE IF NOT EXISTS events (
  id TEXT PRIMARY KEY,
  event_time INTEGER NOT NULL,
  category TEXT NOT NULL,
  title TEXT NOT NULL,
  country TEXT NOT NULL,
  impact TEXT NOT NULL,
  source TEXT NOT NULL,
  url TEXT,
  forecast TEXT,
  previous TEXT,
  actual TEXT,
  fetched_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_events_time ON events(event_time);
CREATE INDEX IF NOT EXISTS idx_events_category ON events(category, event_time);
