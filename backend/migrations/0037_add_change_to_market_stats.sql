-- Migration 0037: Add change column to market_stats for daily percent change tracking
ALTER TABLE market_stats ADD COLUMN change REAL;
