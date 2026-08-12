-- Migration: Add sector_label and sector_label_color columns to watchlist
ALTER TABLE watchlist ADD COLUMN sector_label TEXT DEFAULT NULL;
ALTER TABLE watchlist ADD COLUMN sector_label_color TEXT DEFAULT NULL;
