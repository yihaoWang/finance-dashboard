CREATE TABLE IF NOT EXISTS sentiment_history (
  indicator TEXT NOT NULL,
  date TEXT NOT NULL,
  value REAL NOT NULL,
  PRIMARY KEY (indicator, date)
);
CREATE INDEX IF NOT EXISTS idx_sentiment_indicator_date
  ON sentiment_history(indicator, date DESC);
