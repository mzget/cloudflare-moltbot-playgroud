-- Migration number: 0001 	 2026-04-30T15:39:00.000Z

-- Portfolio holdings from CSV
CREATE TABLE IF NOT EXISTS portfolio_holdings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  symbol TEXT NOT NULL UNIQUE,
  weight REAL,
  thesis TEXT,
  market_value REAL,
  category TEXT,
  updated_at TEXT DEFAULT (datetime('now'))
);

-- Yearly performance history
CREATE TABLE IF NOT EXISTS portfolio_history (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  year INTEGER NOT NULL UNIQUE,
  capital REAL,
  balance REAL,
  total_gain_pct REAL,
  remark TEXT
);

-- Investment knowledge base (philosophy, frameworks, strategies)
CREATE TABLE IF NOT EXISTS knowledge_base (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  category TEXT NOT NULL,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  source TEXT DEFAULT 'CSV Import'
);
