-- Migration to fix unique constraint on facebook_posts by making it a partial index
DROP INDEX IF EXISTS idx_facebook_posts_source;
CREATE UNIQUE INDEX IF NOT EXISTS idx_facebook_posts_source ON facebook_posts(source_type, source_id) WHERE source_type != 'custom';
