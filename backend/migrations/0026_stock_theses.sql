-- Migration: Create stock_theses and thesis_journal_entries tables
CREATE TABLE IF NOT EXISTS stock_theses (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  symbol TEXT NOT NULL,
  title TEXT NOT NULL,
  buy_price REAL,
  sell_price REAL,
  conviction TEXT NOT NULL DEFAULT 'Medium',
  status TEXT NOT NULL DEFAULT 'Active',
  catalysts TEXT,
  risks TEXT,
  note TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_stock_theses_symbol ON stock_theses (symbol);

CREATE TABLE IF NOT EXISTS thesis_journal_entries (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  thesis_id INTEGER NOT NULL REFERENCES stock_theses(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_thesis_journal_thesis_id ON thesis_journal_entries (thesis_id);
