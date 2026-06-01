-- Migration: Add is_readed flag to email_digests
ALTER TABLE email_digests ADD COLUMN is_readed INTEGER DEFAULT 0;
