CREATE TABLE IF NOT EXISTS stocks (
  symbol TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  industry TEXT,
  market TEXT,
  updated_at INTEGER
);

CREATE TABLE IF NOT EXISTS daily_prices (
  symbol TEXT NOT NULL,
  date TEXT NOT NULL,
  open REAL,
  high REAL,
  low REAL,
  close REAL,
  volume INTEGER,
  PRIMARY KEY (symbol, date)
);

CREATE INDEX IF NOT EXISTS idx_daily_prices_symbol_date
  ON daily_prices(symbol, date DESC);
