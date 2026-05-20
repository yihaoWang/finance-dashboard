-- Rich metrics for client-side filter screener.
-- All columns nullable so cron can fail gracefully on per-metric basis.
ALTER TABLE screener_scores ADD COLUMN name TEXT;
ALTER TABLE screener_scores ADD COLUMN market_cap REAL;
ALTER TABLE screener_scores ADD COLUMN current_pe REAL;
ALTER TABLE screener_scores ADD COLUMN pe_5y_avg REAL;
ALTER TABLE screener_scores ADD COLUMN pe_premium REAL;       -- (current_pe / pe_5y_avg) - 1
ALTER TABLE screener_scores ADD COLUMN yield_pct REAL;
ALTER TABLE screener_scores ADD COLUMN roe_5y_min REAL;
ALTER TABLE screener_scores ADD COLUMN eps_cagr REAL;
ALTER TABLE screener_scores ADD COLUMN revenue_cagr REAL;
ALTER TABLE screener_scores ADD COLUMN monthly_rev_yoy REAL;
ALTER TABLE screener_scores ADD COLUMN d_e_ratio REAL;
ALTER TABLE screener_scores ADD COLUMN gross_margin REAL;
ALTER TABLE screener_scores ADD COLUMN op_margin REAL;
ALTER TABLE screener_scores ADD COLUMN net_margin REAL;
ALTER TABLE screener_scores ADD COLUMN moat_count INTEGER NOT NULL DEFAULT 0;
ALTER TABLE screener_scores ADD COLUMN risk_count INTEGER NOT NULL DEFAULT 0;
ALTER TABLE screener_scores ADD COLUMN weighted_score REAL NOT NULL DEFAULT 0;
ALTER TABLE screener_scores ADD COLUMN style_tags TEXT;        -- JSON array: ["value","growth",...]
ALTER TABLE screener_scores ADD COLUMN highlights TEXT;        -- JSON array of strings
ALTER TABLE screener_scores ADD COLUMN concerns TEXT;          -- JSON array of strings

CREATE INDEX IF NOT EXISTS idx_screener_weighted ON screener_scores(weighted_score DESC, priority_score DESC);
