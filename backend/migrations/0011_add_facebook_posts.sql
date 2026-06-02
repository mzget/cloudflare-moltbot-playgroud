-- Migration: Add facebook_posts table to track publishing status and translations

CREATE TABLE IF NOT EXISTS facebook_posts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  source_type TEXT NOT NULL, -- 'daily_report' or 'email_digest'
  source_id INTEGER NOT NULL,
  thai_title TEXT,
  thai_content TEXT,
  status TEXT DEFAULT 'pending', -- 'pending', 'processing', 'posted', 'failed'
  facebook_post_id TEXT,
  error_message TEXT,
  created_at DATETIME DEFAULT (CURRENT_TIMESTAMP),
  updated_at DATETIME DEFAULT (CURRENT_TIMESTAMP)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_facebook_posts_source ON facebook_posts(source_type, source_id);
