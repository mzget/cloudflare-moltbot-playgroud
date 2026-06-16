-- Migration: System Settings for Facebook Posting Pause
CREATE TABLE IF NOT EXISTS system_settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

-- Seed defaults
INSERT OR IGNORE INTO system_settings (key, value) VALUES
('pause_daily_report_facebook', '0'),
('pause_email_digest_facebook', '0');
