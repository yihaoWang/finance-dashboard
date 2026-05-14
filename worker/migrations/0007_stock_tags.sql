CREATE TABLE IF NOT EXISTS stock_tags (
  symbol TEXT NOT NULL,
  kind TEXT NOT NULL,        -- 'moat' | 'risk'
  value TEXT NOT NULL,        -- e.g. '無形資產' | 'R 監管風險'
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (symbol, kind, value)
);
CREATE INDEX IF NOT EXISTS idx_stock_tags_symbol ON stock_tags(symbol);
