# Oaktree Domain Context & Glossary

## Email Processing Subsystem

### Terms & Concepts

- **Email Ingestion (Sync)**: 
  The lightweight background operation that queries the Gmail API for subscribed newsletters and stores raw, sanitized email records into the `ingested_emails` database table. Runs continuously around the clock.

- **Email Digest (Summarization)**:
  The compute-intensive AI background operation that invokes Cloudflare Workers AI to analyze unprocessed ingested emails (`processed = 0`) and create Thai language structured summaries and Howard Marks-style takeaways in `email_digests`.

- **Daytime Window**:
  The defined operational window between 08:00 and 18:00 Asia/Bangkok time (01:00 - 11:00 UTC) reserved for running resource-heavy tasks like Email Digest, intentionally decoupled from nighttime US market trading hours.

- **Nighttime Window (US Market Hours)**:
  The window between 20:30/21:30 and 03:30/04:30 Asia/Bangkok time when the US stock market is open, reserved primarily for high-frequency stock price tracking and breakout alerting.
