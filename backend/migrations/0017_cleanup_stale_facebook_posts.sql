-- Migration to clean up stale pending facebook posts whose source daily reports or email digests have been deleted
UPDATE facebook_posts 
SET status = 'failed', 
    error_message = 'Daily report purged before processing', 
    updated_at = CURRENT_TIMESTAMP
WHERE status = 'pending' 
  AND source_type = 'daily_report'
  AND source_id NOT IN (SELECT id FROM daily_reports);

UPDATE facebook_posts 
SET status = 'failed', 
    error_message = 'Email digest purged before processing', 
    updated_at = CURRENT_TIMESTAMP
WHERE status = 'pending' 
  AND source_type = 'email_digest'
  AND source_id NOT IN (SELECT id FROM email_digests);
