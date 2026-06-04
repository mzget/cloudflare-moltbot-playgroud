-- Migration: Create portfolio_daily_history table to track daily historical portfolio performance
CREATE TABLE IF NOT EXISTS portfolio_daily_history (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  date TEXT NOT NULL UNIQUE, -- 'YYYY-MM-DD'
  total_market_value REAL NOT NULL,
  total_cost REAL NOT NULL,
  unrealized_gain REAL NOT NULL,
  realized_gain REAL NOT NULL,
  total_dividends REAL NOT NULL,
  created_at DATETIME DEFAULT (CURRENT_TIMESTAMP)
);
