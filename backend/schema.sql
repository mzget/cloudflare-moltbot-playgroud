-- Watchlist Table
CREATE TABLE IF NOT EXISTS watchlist (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    symbol TEXT NOT NULL UNIQUE,
    name TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- News Sources Table
CREATE TABLE IF NOT EXISTS news_sources (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    url_pattern TEXT NOT NULL UNIQUE, -- e.g. https://finance.yahoo.com/rss/2.0/headline?s={symbol}
    selector TEXT, -- CSS selector for WEB type
    type TEXT CHECK(type IN ('RSS', 'WEB')) NOT NULL DEFAULT 'RSS',
    enabled BOOLEAN DEFAULT TRUE,
    last_crawled_at DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- News Table (Raw Articles)
CREATE TABLE IF NOT EXISTS news (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    symbol TEXT NOT NULL,
    title TEXT NOT NULL,
    summary TEXT, -- Short AI summary of this specific article
    sentiment TEXT, -- Sentiment of this article (Positive/Negative/Neutral)
    source_url TEXT UNIQUE,
    published_at DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (symbol) REFERENCES watchlist(symbol)
);

-- Daily Reports Table (Aggregated Summaries)
CREATE TABLE IF NOT EXISTS daily_reports (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    symbol TEXT NOT NULL,
    summary TEXT NOT NULL,
    sentiment_score REAL, -- -1 to 1
    key_takeaways TEXT, -- JSON array
    report_date DATE DEFAULT (DATE('now')),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (symbol) REFERENCES watchlist(symbol)
);

-- Initial Watchlist
INSERT OR IGNORE INTO watchlist (symbol, name) VALUES ('AAPL', 'Apple Inc.');
INSERT OR IGNORE INTO watchlist (symbol, name) VALUES ('TSLA', 'Tesla, Inc.');
INSERT OR IGNORE INTO watchlist (symbol, name) VALUES ('NVDA', 'NVIDIA Corporation');

-- Initial Sources (RSS as default)
INSERT OR IGNORE INTO news_sources (name, url_pattern, type) VALUES 
('Yahoo Finance RSS', 'https://feeds.finance.yahoo.com/rss/2.0/headline?s={symbol}', 'RSS');

INSERT OR IGNORE INTO news_sources (name, url_pattern, selector, type, enabled) VALUES 
('Google News', 'https://news.google.com/search?q={symbol}%20stock&hl=en-US&gl=US&ceid=US%3Aen', 'article h3 a', 'WEB', 0); -- Disabled by default as requested
