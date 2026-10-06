-- Migration: Add columns to notebook_articles for Gemini Spark intelligence ingestion and Facebook publishing control
ALTER TABLE notebook_articles ADD COLUMN source TEXT DEFAULT 'notebooklm';
ALTER TABLE notebook_articles ADD COLUMN category TEXT;
ALTER TABLE notebook_articles ADD COLUMN url TEXT;
ALTER TABLE notebook_articles ADD COLUMN auto_publish INTEGER DEFAULT 0;

