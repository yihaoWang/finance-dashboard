CREATE TABLE IF NOT EXISTS insights (
  id TEXT PRIMARY KEY,
  source TEXT NOT NULL,
  source_kind TEXT NOT NULL,
  episode_title TEXT NOT NULL,
  episode_url TEXT,
  audio_url TEXT,
  published_at INTEGER NOT NULL,
  main_thesis TEXT NOT NULL,
  validation_signals TEXT NOT NULL,
  reversal_signals TEXT NOT NULL,
  framework_tags TEXT NOT NULL,
  action_horizon TEXT,
  action_suggestion TEXT,
  raw_transcript TEXT,
  model TEXT NOT NULL,
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_insights_published ON insights(published_at);
CREATE INDEX IF NOT EXISTS idx_insights_source ON insights(source, published_at);
