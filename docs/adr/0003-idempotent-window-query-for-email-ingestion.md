# 3. Idempotent Window Query (`newer_than:2d`) for Email Ingestion

Date: 2026-10-01

## Status
Accepted

## Context
Previously, email ingestion appended `is:unread` to all Gmail search queries. If a user opened a newsletter on their mobile device or web client before the background sync ran, the message was marked as read by Gmail and silently omitted from query results, causing permanent data loss for newsletters.
The database already implements deduplication via `SELECT 1 FROM ingested_emails WHERE id = ?`.

## Decision
1. Remove the mandatory `is:unread` filter from Gmail ingestion queries.
2. Adopt a sliding time window filter: `newer_than:2d` (emails received within the last 48 hours matching subscription criteria).
3. If a subscription specifies a `raw_query`, honor it without blindly injecting `is:unread`.
4. Rely on database primary key check on `ingested_emails.id` for idempotency and duplicate rejection.

## Consequences
- Eliminates email loss caused by users opening emails on external devices.
- Ensures all newsletters within the 48-hour window are captured idempotently.
