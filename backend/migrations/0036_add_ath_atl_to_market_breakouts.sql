-- Migration 0036: Add all_time_high and all_time_low columns to market_breakouts table
ALTER TABLE market_breakouts ADD COLUMN all_time_high REAL;
ALTER TABLE market_breakouts ADD COLUMN all_time_low REAL;

