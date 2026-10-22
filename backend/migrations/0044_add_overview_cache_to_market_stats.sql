-- Migration: Add overview_json and overview_updated_at to market_stats table for caching financial overview data
ALTER TABLE market_stats ADD COLUMN overview_json TEXT;
ALTER TABLE market_stats ADD COLUMN overview_updated_at TEXT;
