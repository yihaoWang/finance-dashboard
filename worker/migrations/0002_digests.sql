CREATE TABLE IF NOT EXISTS digests (
  date TEXT NOT NULL,
  scope TEXT NOT NULL,
  symbol TEXT NOT NULL,
  hard_data TEXT NOT NULL,
  framework TEXT NOT NULL,
  sentiment TEXT NOT NULL,
  sources_json TEXT NOT NULL,
  model TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  PRIMARY KEY (date, scope, symbol)
);
CREATE INDEX IF NOT EXISTS idx_digests_date ON digests(date DESC);
CREATE INDEX IF NOT EXISTS idx_digests_symbol ON digests(symbol, date DESC);
