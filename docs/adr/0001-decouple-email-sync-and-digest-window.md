# 1. Decouple Email Sync (24/7) and Email Digest (Daytime Window)

Date: 2026-10-01

## Status
Accepted

## Context
During US stock market hours (approx. 20:30 - 04:30 Thai Time), the system's scheduler is heavily utilized running 15-minute price polling, breakout scans, and alert checks. 
Additionally, email newsletters from US financial sources arrive throughout the US morning/post-market close (equivalent to Thai nighttime).
Previously, both email synchronization and AI digest generation ran concurrently in the hourly cron trigger.

## Decision
Decouple the operational windows for Email Ingestion (Sync) and Email Digest (AI Summarization):
- **Email Ingestion (Sync)**: Runs 24/7 on an hourly cadence to continuously collect raw emails without backlog or missing emails.
- **Email Digest (AI Summarization)**: Restricted to run only within the Daytime Window (08:00 - 18:00 Asia/Bangkok time, 01:00 - 11:00 UTC).

## Consequences
- Protects Cloudflare Workers AI resources and CPU limits during active US market trading hours.
- Raw emails arriving overnight are queued cleanly in `ingested_emails` and processed once the morning window opens at 08:00 Thai Time.
