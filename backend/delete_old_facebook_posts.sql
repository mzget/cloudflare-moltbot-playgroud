-- SQL script to delete Facebook post logs older than today (local time)
DELETE FROM facebook_posts 
WHERE created_at < date('now', 'localtime');
