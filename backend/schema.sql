DROP TABLE IF EXISTS watchlist;
CREATE TABLE watchlist (
  symbol TEXT PRIMARY KEY,
  created_at INTEGER DEFAULT (strftime('%s', 'now')),
  is_auto_suggested BOOLEAN DEFAULT FALSE
);

DROP TABLE IF EXISTS news_sources;
CREATE TABLE news_sources (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  url_pattern TEXT NOT NULL, -- e.g. https://finance.yahoo.com/quote/{symbol}/news
  selector TEXT NOT NULL,    -- CSS selector for links
  enabled BOOLEAN DEFAULT TRUE,
  created_at INTEGER DEFAULT (strftime('%s', 'now'))
);

-- Initial sources
INSERT INTO news_sources (id, name, url_pattern, selector) VALUES 
('yahoo', 'Yahoo Finance', 'https://finance.yahoo.com/quote/{symbol}/news', 'section[data-test="qsp-news"] a, #quoteNewsStream-0-Stream a'),
('google', 'Google News', 'https://news.google.com/search?q={symbol}%20stock&hl=en-US&gl=US&ceid=US%3Aen', 'article h3 a');

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
