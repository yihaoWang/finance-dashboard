-- Per-criterion pass bitmap + moat/risk tag arrays for granular screener filters.
ALTER TABLE screener_scores ADD COLUMN criteria_passed TEXT;   -- JSON: { "1": true, "2": false, ... 16 }
ALTER TABLE screener_scores ADD COLUMN moat_tags TEXT;          -- JSON: ["無形資產", "成本優勢", ...]
ALTER TABLE screener_scores ADD COLUMN risk_tags TEXT;          -- JSON: ["S 科技風險", ...]
