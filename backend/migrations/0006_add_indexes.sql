-- Migration number: 0006 	 2026-05-23T19:50:00.000Z

-- Indexes for news table to optimize query by symbol/time and duplicate checking
CREATE INDEX IF NOT EXISTS idx_news_symbol_created ON news (symbol, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_news_url ON news (url);
CREATE INDEX IF NOT EXISTS idx_news_created_at ON news (created_at DESC);

-- Indexes for daily_reports table to optimize partitioned window functions
CREATE INDEX IF NOT EXISTS idx_daily_reports_symbol_created ON daily_reports (symbol, created_at DESC);

-- Indexes for market_events table to optimize partitioned window functions and type filtering
CREATE INDEX IF NOT EXISTS idx_market_events_symbol_date ON market_events (symbol, event_date DESC);
CREATE INDEX IF NOT EXISTS idx_market_events_type_symbol_date ON market_events (event_type, symbol, event_date DESC);
