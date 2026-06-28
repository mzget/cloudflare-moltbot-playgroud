-- Migration: Add is_readed column to daily_reports
ALTER TABLE daily_reports ADD COLUMN is_readed INTEGER DEFAULT 0;
