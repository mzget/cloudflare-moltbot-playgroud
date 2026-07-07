-- Migration: Add missing indexes on symbol search columns to optimize performance
CREATE INDEX IF NOT EXISTS idx_share_lots_symbol ON share_lots (symbol);
CREATE INDEX IF NOT EXISTS idx_transactions_symbol ON transactions (symbol);
CREATE INDEX IF NOT EXISTS idx_dividends_symbol ON dividends (symbol);
