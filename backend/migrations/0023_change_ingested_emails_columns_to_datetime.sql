-- Migration: Change ingested_emails columns received_at and created_at to DATETIME

-- Disable foreign keys check temporarily to allow table reconstruction
PRAGMA foreign_keys = OFF;

CREATE TABLE IF NOT EXISTS ingested_emails_new (
  id TEXT PRIMARY KEY,
  subscription_id INTEGER,
  sender TEXT,
  subject TEXT,
  body_text TEXT,
  received_at DATETIME,
  processed INTEGER DEFAULT 0,
  created_at DATETIME DEFAULT (CURRENT_TIMESTAMP),
  FOREIGN KEY(subscription_id) REFERENCES email_subscriptions(id) ON DELETE SET NULL
);

INSERT INTO ingested_emails_new (id, subscription_id, sender, subject, body_text, received_at, processed, created_at)
SELECT
  id,
  subscription_id,
  sender,
  subject,
  body_text,
  CASE 
    WHEN received_at IS NOT NULL THEN datetime(received_at / 1000, 'unixepoch')
    ELSE NULL
  END,
  processed,
  CASE 
    WHEN created_at IS NOT NULL THEN datetime(created_at, 'unixepoch')
    ELSE NULL
  END
FROM ingested_emails;

DROP TABLE ingested_emails;

ALTER TABLE ingested_emails_new RENAME TO ingested_emails;

PRAGMA foreign_keys = ON;
