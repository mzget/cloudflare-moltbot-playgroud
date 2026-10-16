-- Migration: 0041_fundamental_intelligence.sql
-- Description: Create stock_fundamentals, theme_sector_contexts, and theme_symbol_mappings tables for Fundamental Intelligence subsystem (ADR 0010)

-- 1. Single-Stock Qualitative Company Profiles
CREATE TABLE IF NOT EXISTS stock_fundamentals (
    symbol TEXT PRIMARY KEY,
    business_model TEXT,
    moat TEXT,
    competitors TEXT, -- JSON array of strings: ["RISC-V", "x86", ...]
    guidance TEXT,    -- JSON object: { revenue_target, margin_target, timeframe, key_assumptions }
    key_risks TEXT,   -- JSON array of strings
    thesis_kpis TEXT, -- JSON array of strings
    as_of_date TEXT NOT NULL,
    notebook_id TEXT,
    source_count INTEGER DEFAULT 1,
    updated_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_stock_fundamentals_as_of_date ON stock_fundamentals(as_of_date);

-- 2. Multi-Stock Theme & Industry Dynamics Contexts
CREATE TABLE IF NOT EXISTS theme_sector_contexts (
    notebook_id TEXT PRIMARY KEY,
    theme_name TEXT NOT NULL,
    industry_dynamics TEXT,
    supply_chain_bottlenecks TEXT,
    competitive_landscape TEXT,
    macro_trends TEXT,
    updated_at TEXT DEFAULT (datetime('now'))
);

-- 3. Theme-to-Stock Symbol Mappings (Join table)
CREATE TABLE IF NOT EXISTS theme_symbol_mappings (
    notebook_id TEXT NOT NULL,
    symbol TEXT NOT NULL,
    created_at TEXT DEFAULT (datetime('now')),
    PRIMARY KEY (notebook_id, symbol),
    FOREIGN KEY (notebook_id) REFERENCES theme_sector_contexts(notebook_id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_theme_symbol_mappings_symbol ON theme_symbol_mappings(symbol);
