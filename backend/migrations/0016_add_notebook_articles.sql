-- Migration: Add notebook_articles table to store synced articles from NotebookLM
CREATE TABLE IF NOT EXISTS notebook_articles (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  symbol TEXT,
  summary TEXT,
  key_takeaways TEXT, -- Stored as JSON array of strings
  created_at DATETIME DEFAULT (CURRENT_TIMESTAMP),
  updated_at DATETIME DEFAULT (CURRENT_TIMESTAMP)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_notebook_articles_title_symbol ON notebook_articles(title, symbol);
