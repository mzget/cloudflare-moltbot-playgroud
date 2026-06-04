-- Migration: Portfolio management tables
-- Holdings: tracks how many shares you own and at what cost
CREATE TABLE IF NOT EXISTS holdings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  symbol TEXT NOT NULL,
  shares REAL NOT NULL DEFAULT 0,
  avg_cost REAL,
  total_cost REAL,
  status TEXT DEFAULT 'Open',
  created_at INTEGER DEFAULT (strftime('%s', 'now')),
  updated_at INTEGER DEFAULT (strftime('%s', 'now')),
  UNIQUE(symbol)
);

-- Share Lots: individual purchase lots
CREATE TABLE IF NOT EXISTS share_lots (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  symbol TEXT NOT NULL,
  date TEXT NOT NULL,
  shares REAL NOT NULL,
  cost_per_share REAL NOT NULL,
  total_cost REAL,
  low_limit REAL,
  high_limit REAL,
  note TEXT,
  created_at INTEGER DEFAULT (strftime('%s', 'now'))
);

-- Transactions: buy/sell log
CREATE TABLE IF NOT EXISTS transactions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  symbol TEXT NOT NULL,
  date TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'Buy',
  shares REAL NOT NULL,
  cost_per_share REAL NOT NULL,
  commission REAL DEFAULT 0,
  total_cost REAL,
  realized_gain_pct REAL,
  realized_gain_amt REAL,
  note TEXT,
  created_at INTEGER DEFAULT (strftime('%s', 'now'))
);

-- Dividends
CREATE TABLE IF NOT EXISTS dividends (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  symbol TEXT NOT NULL,
  date TEXT NOT NULL,
  amount REAL NOT NULL,
  per_share REAL,
  note TEXT,
  created_at INTEGER DEFAULT (strftime('%s', 'now'))
);

-- Add quote fields to market_stats
-- Use separate statements; D1 will skip if column exists
ALTER TABLE market_stats ADD COLUMN previous_close REAL;
ALTER TABLE market_stats ADD COLUMN day_high REAL;
ALTER TABLE market_stats ADD COLUMN day_low REAL;
ALTER TABLE market_stats ADD COLUMN open_price REAL;