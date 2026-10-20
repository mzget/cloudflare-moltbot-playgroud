-- Migration number: 0043 	 2026-10-19T16:30:00.000Z
CREATE TABLE IF NOT EXISTS portfolio_risk_advisories (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  health_score INTEGER NOT NULL,
  risk_level TEXT NOT NULL,
  executive_summary TEXT NOT NULL,
  key_warnings_json TEXT NOT NULL DEFAULT '[]',
  rebalancing_actions_json TEXT NOT NULL DEFAULT '[]',
  source TEXT NOT NULL DEFAULT 'workers_ai',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
