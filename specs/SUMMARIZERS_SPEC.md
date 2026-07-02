# Technical Specification: News & Email Summarizers

This document outlines the design, architecture, database schemas, and execution pipelines of the **News Summarizer** and **Email Summarizer** systems within the Oaktree Agent backend.

---

## 1. News Summarizer

The **News Summarizer** monitors company-specific news articles, processes headlines and snippets retrieved over the last 24 hours, and uses a Large Language Model (LLM) to synthesize them into daily stock intelligence reports.

### Architecture & Components

*   **Implementation file:** [summarizer.ts](file:///C:/Users/natta/Documents/oaktree-agent/backend/src/summarizer.ts)
*   **Database Table:** `daily_reports` (defined in [schema.sql](file:///C:/Users/natta/Documents/oaktree-agent/backend/schema.sql#L34-L43))
*   **AI Model:** `@cf/google/gemma-4-26b-a4b-it` (running on Cloudflare Workers AI)

### Execution Pipeline

1.  **News Retrieval:** Queries the local D1 SQLite database for news articles related to a specific symbol that were ingested in the last 24 hours (`created_at > datetime("now", "-1 day")`).
2.  **Context Construction:** Slices the top 10 articles and formats their title and summary into a markdown text block.
3.  **LLM Prompting:**
    *   Instructs the model to write in the style of **Howard Marks' Oaktree memos** (cautious, insightful, long-term cycle-oriented).
    *   Enforces a strict constraint of **2 to 3 sentences** for the final summary.
    *   Requests a sentiment score and bullet points outlining key insights.
4.  **Parsing & Persistence:** Extracts the JSON response, validates its structure, and records a new entry in `daily_reports`.

### Database Schema (`daily_reports`)

```sql
CREATE TABLE daily_reports (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  symbol TEXT NOT NULL,
  summary TEXT NOT NULL,
  sentiment_score REAL,
  key_takeaways TEXT, -- JSON array of strings
  report_date DATE DEFAULT (DATE('now')),
  created_at DATETIME DEFAULT (CURRENT_TIMESTAMP)
);
```

### Trigger Mechanisms

*   **Scheduled Cron (Worker Event):** Triggers hourly in [index.ts](file:///C:/Users/natta/Documents/oaktree-agent/backend/src/index.ts#L600) to fetch market statistics and update summaries.
*   **API Trigger:** Exposes a manual endpoint `/api/summarize-all` (GET) to regenerate reports for all watchlist symbols.

---

## 2. Email Summarizer

The **Email Summarizer** integrates with Gmail using OAuth, polls unread newsletters based on user-defined subscriptions, and aggregates them into high-level thematic digests (e.g. 'Macroeconomy', 'Technology & AI').

### Architecture & Components

*   **Implementation file:** [emailSummarizer.ts](file:///C:/Users/natta/Documents/oaktree-agent/backend/src/emailSummarizer.ts)
*   **Database Tables:** `email_subscriptions`, `ingested_emails`, and `email_digests` (defined in [0009_email_summarizer.sql](file:///C:/Users/natta/Documents/oaktree-agent/backend/migrations/0009_email_summarizer.sql) and modified in [0010_add_is_readed_to_email_digests.sql](file:///C:/Users/natta/Documents/oaktree-agent/backend/migrations/0010_add_is_readed_to_email_digests.sql))
*   **AI Model:** `@cf/google/gemma-4-26b-a4b-it` (running on Cloudflare Workers AI)

### Execution Pipeline

1.  **Email Ingestion (`syncAndIngestEmails`):**
    *   Iterates through active subscriptions.
    *   Fetches matching unread emails (`is:unread`) via the Gmail API.
    *   Filters out previously ingested messages by ID.
    *   Strips HTML, script, and style tags before saving to `ingested_emails` with `processed = 0`.
2.  **Digest Generation (`generateEmailDigests`):**
    *   Collects unprocessed emails (`processed = 0`) for subscriptions due in the current run hour (based on frequencies: `hourly`, `daily`, `weekly`).
    *   Processes emails chronologically in batches of **`2`** to respect LLM token bounds.
    *   Truncates email body text to `8000` characters.
3.  **Thematic Synthesis (LLM Prompting):**
    *   Groups multiple news items into cohesive categories (e.g., 'Macroeconomy', 'Technology & AI').
    *   Writes Howard Marks-style category summaries (detailed, at least **5 to 8 sentences** long across 1-2 paragraphs).
    *   Provides **3 to 5 key takeaways** per category.
    *   Maps category outputs back to the original source email IDs.
4.  **Persistence & Mark Processed:**
    *   Saves compiled category summaries into the `email_digests` table (with `is_readed` set to `0` by default).
    *   Updates the batch's ingested emails to `processed = 1`.

### Database Schema (`email_subscriptions`, `ingested_emails`, `email_digests`)

```sql
CREATE TABLE email_subscriptions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  sender TEXT,
  subject_filter TEXT,
  label_filter TEXT,
  raw_query TEXT,
  frequency TEXT NOT NULL, -- 'hourly', 'daily', 'weekly'
  is_active INTEGER DEFAULT 1,
  created_at INTEGER DEFAULT (strftime('%s', 'now'))
);

CREATE TABLE ingested_emails (
  id TEXT PRIMARY KEY, -- Gmail Message ID
  subscription_id INTEGER,
  sender TEXT,
  subject TEXT,
  body_text TEXT,
  received_at DATETIME, -- Timestamp of receipt
  processed INTEGER DEFAULT 0,
  created_at DATETIME DEFAULT (CURRENT_TIMESTAMP),
  FOREIGN KEY(subscription_id) REFERENCES email_subscriptions(id) ON DELETE SET NULL
);

CREATE TABLE email_digests (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  category TEXT NOT NULL,
  summary TEXT NOT NULL,
  key_takeaways TEXT, -- JSON array of strings
  source_emails TEXT, -- JSON array of objects { id, subject, sender, received_at }
  digest_date DATE DEFAULT (DATE('now')),
  is_readed INTEGER DEFAULT 0, -- 0 = Unread, 1 = Read
  created_at DATETIME DEFAULT (CURRENT_TIMESTAMP)
);
```

### Trigger Mechanisms

*   **Hourly Cron Check:** The hourly scheduled worker runs `generateEmailDigests(env, false)`.
*   **Manual Trigger / Testing:** 
    *   `/api/email-sync` triggers immediate, full sync + digest generation.
    *   `/api/test-email-digest` manually forces a dry-run test of email digest generation.
    *   `/api/email-digests/mark-read` marks individual digests as read (`is_readed = 1`).
