DROP TABLE IF EXISTS watchlist;
CREATE TABLE watchlist (
  symbol TEXT PRIMARY KEY,
  created_at INTEGER DEFAULT (strftime('%s', 'now')),
  is_auto_suggested BOOLEAN DEFAULT FALSE
);

DROP TABLE IF EXISTS news;
CREATE TABLE news (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  symbol TEXT,
  title TEXT,
  summary TEXT,
  sentiment TEXT,
  url TEXT UNIQUE,
  created_at INTEGER DEFAULT (strftime('%s', 'now'))
);
