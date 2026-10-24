-- Migration: Persist DCF scenario range and Margin of Safety on market_stats (ADR-0014)
ALTER TABLE market_stats ADD COLUMN dcf_bear REAL;
ALTER TABLE market_stats ADD COLUMN dcf_base REAL;
ALTER TABLE market_stats ADD COLUMN dcf_bull REAL;
ALTER TABLE market_stats ADD COLUMN mos_base REAL;
ALTER TABLE market_stats ADD COLUMN price_zone TEXT;
ALTER TABLE market_stats ADD COLUMN mos_updated_at TEXT;
