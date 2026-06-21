-- Migration: Create analysis_results table for storing value investor analyses
CREATE TABLE IF NOT EXISTS analysis_results (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  symbol TEXT NOT NULL,
  summary TEXT NOT NULL,
  conviction_level TEXT NOT NULL,
  framework_results TEXT NOT NULL,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_analysis_results_symbol ON analysis_results (symbol);
