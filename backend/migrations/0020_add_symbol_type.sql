-- Migration: Add symbol type to watchlist
ALTER TABLE watchlist ADD COLUMN type TEXT DEFAULT 'stock';
