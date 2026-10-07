-- Migration: Add is_readed column to notebook_articles
ALTER TABLE notebook_articles ADD COLUMN is_readed INTEGER DEFAULT 0;

