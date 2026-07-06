-- Migration: Create dcf_calculations table for storing DCF model runs
CREATE TABLE IF NOT EXISTS dcf_calculations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  symbol TEXT NOT NULL,
  scenario_name TEXT NOT NULL DEFAULT 'Base Case',
  base_revenue REAL NOT NULL,
  revenue_growth REAL NOT NULL,
  base_gross_margin REAL NOT NULL,
  gross_margin_improvement REAL NOT NULL,
  opex_margin REAL NOT NULL,
  tax_rate REAL NOT NULL,
  fcf_conversion REAL NOT NULL,
  wacc REAL NOT NULL,
  terminal_growth REAL NOT NULL,
  shares_outstanding REAL NOT NULL,
  implied_share_price REAL NOT NULL,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_dcf_calculations_symbol ON dcf_calculations (symbol);
