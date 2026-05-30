-- Migration: Add Email Summarizer tables

CREATE TABLE IF NOT EXISTS gmail_oauth (
  id TEXT PRIMARY KEY, -- 'default'
  access_token TEXT NOT NULL,
  refresh_token TEXT NOT NULL,
  expiry_date INTEGER NOT NULL, -- Timestamp in ms
  created_at INTEGER DEFAULT (strftime('%s', 'now')),
  updated_at INTEGER DEFAULT (strftime('%s', 'now'))
);

CREATE TABLE IF NOT EXISTS email_subscriptions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  sender TEXT,
  subject_filter TEXT,
  label_filter TEXT,
  raw_query TEXT,
  frequency TEXT NOT NULL, -- 'hourly', 'daily', 'weekly'
  is_active INTEGER DEFAULT 1,
  created_at INTEGER DEFAULT (strftime('%s', 'now'))
);

CREATE TABLE IF NOT EXISTS ingested_emails (
  id TEXT PRIMARY KEY, -- Gmail Message ID
  subscription_id INTEGER,
  sender TEXT,
  subject TEXT,
  body_text TEXT,
  received_at INTEGER, -- Timestamp of receipt
  processed INTEGER DEFAULT 0,
  created_at INTEGER DEFAULT (strftime('%s', 'now')),
  FOREIGN KEY(subscription_id) REFERENCES email_subscriptions(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS email_digests (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  category TEXT NOT NULL, -- e.g., 'Macro', 'Tech', 'Crypto'
  summary TEXT NOT NULL,
  key_takeaways TEXT, -- JSON array of strings
  source_emails TEXT, -- JSON array of objects { subject, sender, received_at }
  digest_date DATE DEFAULT (DATE('now')),
  created_at DATETIME DEFAULT (CURRENT_TIMESTAMP)
);
