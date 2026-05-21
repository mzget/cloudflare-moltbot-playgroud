-- Migration number: 0005 	 2026-05-20T16:00:00.000Z
CREATE TABLE IF NOT EXISTS market_events (
  id TEXT PRIMARY KEY,
  symbol TEXT NOT NULL,
  event_type TEXT NOT NULL, -- 'news', 'dividend', 'split', 'earnings'
  event_date TEXT NOT NULL, -- YYYY-MM-DD or ISO timestamp
  title TEXT NOT NULL,
  description TEXT,
  url TEXT,
  metadata TEXT, -- JSON string containing extra details
  created_at INTEGER DEFAULT (strftime('%s', 'now'))
);
