-- 1. Add 52-week and All-Time columns to market_stats (for watchlisted stocks)
ALTER TABLE market_stats ADD COLUMN fifty_two_week_high REAL;
ALTER TABLE market_stats ADD COLUMN fifty_two_week_high_date TEXT;
ALTER TABLE market_stats ADD COLUMN fifty_two_week_low REAL;
ALTER TABLE market_stats ADD COLUMN fifty_two_week_low_date TEXT;
ALTER TABLE market_stats ADD COLUMN all_time_high REAL;
ALTER TABLE market_stats ADD COLUMN all_time_high_date TEXT;
ALTER TABLE market_stats ADD COLUMN all_time_low REAL;
ALTER TABLE market_stats ADD COLUMN all_time_low_date TEXT;

-- 2. Create record_breaker_events table to log milestone crossovers
CREATE TABLE IF NOT EXISTS record_breaker_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  symbol TEXT NOT NULL,
  event_type TEXT NOT NULL,      -- '52w_high', '52w_low', 'ath', 'atl'
  price REAL NOT NULL,
  previous_record REAL,
  event_date TEXT NOT NULL,      -- 'YYYY-MM-DD'
  is_notified INTEGER DEFAULT 0,
  created_at INTEGER DEFAULT (strftime('%s', 'now'))
);

-- 3. Create market_breakouts table to store market-wide scan results
CREATE TABLE IF NOT EXISTS market_breakouts (
  symbol TEXT NOT NULL,
  name TEXT,
  price REAL,
  percent_change REAL,
  year_high REAL,
  year_low REAL,
  breakout_type TEXT NOT NULL,   -- '52w_high', '52w_low'
  scan_date TEXT NOT NULL,       -- 'YYYY-MM-DD'
  PRIMARY KEY (symbol, breakout_type, scan_date)
);

CREATE INDEX IF NOT EXISTS idx_record_events_symbol ON record_breaker_events(symbol);
CREATE INDEX IF NOT EXISTS idx_market_breakouts_date ON market_breakouts(scan_date DESC);
