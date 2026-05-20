CREATE TABLE IF NOT EXISTS screener_scores (
  symbol TEXT PRIMARY KEY,
  score INTEGER NOT NULL,
  total INTEGER NOT NULL,
  priority_score INTEGER NOT NULL,
  priority_total INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_screener_priority ON screener_scores(priority_score DESC, score DESC, updated_at DESC);
