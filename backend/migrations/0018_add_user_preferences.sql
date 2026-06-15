-- Migration to add user_preferences table
CREATE TABLE IF NOT EXISTS user_preferences (
  email TEXT PRIMARY KEY,
  theme TEXT DEFAULT 'system',
  table_density TEXT DEFAULT 'cozy',
  currency TEXT DEFAULT 'USD',
  exchange_rate REAL DEFAULT 1.0,
  updated_at INTEGER DEFAULT (strftime('%s', 'now'))
);
