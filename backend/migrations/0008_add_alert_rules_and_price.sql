-- Migration number: 0008 	 2026-05-24T16:00:00.000Z

-- Add price column to market_stats if it doesn't exist
-- Note: SQLite does not support IF NOT EXISTS in ALTER TABLE ADD COLUMN, but D1 supports it if the table doesn't have it.
-- To make this safe, we just run the ADD COLUMN command.
ALTER TABLE market_stats ADD COLUMN price REAL;

-- Create alert rules table
CREATE TABLE IF NOT EXISTS alert_rules (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  symbol TEXT NOT NULL,
  metric TEXT NOT NULL,          -- 'market_cap', 'price', 'p_e', 'ev_ebit', 'ev_sales'
  condition_type TEXT NOT NULL,  -- 'cross_up', 'cross_down'
  target_value REAL NOT NULL,
  last_checked_value REAL,
  last_checked_state TEXT,       -- 'above' or 'below'
  is_active INTEGER DEFAULT 1,   -- 1 = active, 0 = inactive
  created_at INTEGER DEFAULT (strftime('%s', 'now')),
  updated_at INTEGER DEFAULT (strftime('%s', 'now'))
);

CREATE INDEX IF NOT EXISTS idx_alert_rules_symbol ON alert_rules(symbol);

-- Create in-app notifications table
CREATE TABLE IF NOT EXISTS in_app_notifications (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  symbol TEXT NOT NULL,
  metric TEXT NOT NULL,
  condition_type TEXT NOT NULL,
  target_value REAL NOT NULL,
  trigger_value REAL NOT NULL,
  message TEXT NOT NULL,
  is_read INTEGER DEFAULT 0,     -- 0 = unread, 1 = read
  created_at INTEGER DEFAULT (strftime('%s', 'now'))
);

CREATE INDEX IF NOT EXISTS idx_in_app_notifications_unread ON in_app_notifications(is_read, created_at DESC);
