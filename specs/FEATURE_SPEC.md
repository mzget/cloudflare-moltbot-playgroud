
---

### 1. Project Overview (`/?tab=about`)
As described in the localization resources ([i18n.ts](file:///C:/Users/natta/.gemini/antigravity/worktrees/oaktree-agent/list-schedule-llm-tasks/frontend/src/i18n.ts#L49-L53)) and rendered in the frontend's [RoutesLayout.tsx](file:///C:/Users/natta/.gemini/antigravity/worktrees/oaktree-agent/list-schedule-llm-tasks/frontend/src/components/layout/RoutesLayout.tsx#L288-L299):
* **Core Philosophy**: Inspired by the investment philosophy of Howard Marks (Oaktree Capital). The agent synthesizes raw market data, news, and email newsletters into cohesive narratives focusing on market cycles, risk assessment, and long-term value.
* **Technology Stack**: Powered by Cloudflare Workers, Cloudflare D1 (SQLite database), Cloudflare R2 bucket, Cloudflare Workers AI, and Puppeteer-based Browser Rendering.

---

### 2. Scheduled Jobs & Workflow Triggers
Scheduled tasks are registered as a cron trigger in [wrangler.toml](file:///C:/Users/natta/.gemini/antigravity/worktrees/oaktree-agent/list-schedule-llm-tasks/backend/wrangler.toml#L22-L23):
* **Cron Expression**: `0 * * * *` (Runs at minute 0 of every hour).
* **Cron Handler**: Intercepted by the `scheduled` function inside [index.ts](file:///C:/Users/natta/.gemini/antigravity/worktrees/oaktree-agent/list-schedule-llm-tasks/backend/src/index.ts#L1219-L1248), which spawns a new instance of [OaktreeSyncWorkflow](file:///C:/Users/natta/.gemini/antigravity/worktrees/oaktree-agent/list-schedule-llm-tasks/backend/src/workflow.ts#L28) with hourly and 6-hourly parameters depending on the hour of the day.

| Parameter Name | Trigger Frequency | Linked Function & File | Description |
| :--- | :--- | :--- | :--- |
| **`fetchMarketStats`** | Hourly | [fetchAndStoreMarketStats](file:///C:/Users/natta/.gemini/antigravity/worktrees/oaktree-agent/list-schedule-llm-tasks/backend/src/marketData.ts#L10) | Pulls active watchlist metrics & current quotes from Finnhub, updating price/valuation tables. |
| **`checkAlertRules`** | Hourly | [checkAlertRules](file:///C:/Users/natta/.gemini/antigravity/worktrees/oaktree-agent/list-schedule-llm-tasks/backend/src/alerts.ts#L8) | Evaluates active stock price alert rules and stores triggered notifications in the database. |
| **`syncEmails`** | Hourly | [syncAndIngestEmails](file:///C:/Users/natta/.gemini/antigravity/worktrees/oaktree-agent/list-schedule-llm-tasks/backend/src/emailSummarizer.ts#L25) | Polls the Gmail inbox via Google OAuth tokens using custom subscription query filters to ingest unread financial newsletters. |
| **`generateEmailDigests`** | Hourly | [generateEmailDigests](file:///C:/Users/natta/.gemini/antigravity/worktrees/oaktree-agent/list-schedule-llm-tasks/backend/src/emailSummarizer.ts#L108) | Synthesizes ingested unprocessed emails into theme-based digests (batch size of 2). |
| **`syncFacebookPosts`** | Hourly | [syncAndProcessFacebookPosts](file:///C:/Users/natta/.gemini/antigravity/worktrees/oaktree-agent/list-schedule-llm-tasks/backend/src/facebook.ts#L142) | Detects new daily reports or email digests, queues them, formats them using LLM, and posts them to Facebook. |
| **`runCrawler`** | Every 6 hours | [runCrawler](file:///C:/Users/natta/.gemini/antigravity/worktrees/oaktree-agent/list-schedule-llm-tasks/backend/src/crawler.ts#L4) | Crawls Google News and Yahoo Finance for active watchlist symbols. Falls back from RSS to Puppeteer Browser Rendering if RSS returns no results. |
| **`generateDailySummaries`**| Every 6 hours | [generateDailySummary](file:///C:/Users/natta/.gemini/antigravity/worktrees/oaktree-agent/list-schedule-llm-tasks/backend/src/summarizer.ts#L3) | Runs the daily news synthesis LLM task for active watchlist symbols. |
| **`fetchMarketEvents`** | Every 6 hours | [fetchAndStoreMarketEvents](file:///C:/Users/natta/.gemini/antigravity/worktrees/oaktree-agent/list-schedule-llm-tasks/backend/src/marketEvents.ts#L3) | Gathers dividend, split, and earnings calendar events for watchlist symbols from Finnhub. |
| **`sendDailyEmailReport`** | Every 6 hours | [sendDailyEmailReport](file:///C:/Users/natta/.gemini/antigravity/worktrees/oaktree-agent/list-schedule-llm-tasks/backend/src/email.ts#L3) | Formats today's generated reports into an HTML summary and emails it via Cloudflare's email sending binding. |
| **`purgeOldData`** | Every 6 hours | Inline D1 statements in [workflow.ts](file:///C:/Users/natta/.gemini/antigravity/worktrees/oaktree-agent/list-schedule-llm-tasks/backend/src/workflow.ts#L89-L99) | Deletes expired data to keep the D1 database size lean (reports & news > 3 days; events > 30 days). |

---

### 3. LLM Tasks (Workers AI Integration)
The system leverages Cloudflare Workers AI models for background synthesis and interactive agents:

#### A. Background Tasks (Cron/Workflow-driven)

1. **Daily Stock News Synthesis** ([summarizer.ts](file:///C:/Users/natta/.gemini/antigravity/worktrees/oaktree-agent/list-schedule-llm-tasks/backend/src/summarizer.ts#L43))
   * **Model**: `@cf/google/gemma-4-26b-a4b-it`
   * **Description**: Takes raw titles/summaries (up to 10 latest articles in the last 24h) for a given symbol and compiles them into a 2-to-3 sentence professional report.
   * **Format/Tone**: Howard Marks memo style (insightful, long-term oriented, risk-aware). Output is a JSON object in **Thai** containing the `summary`, `sentiment_score`, and bullet-pointed `key_takeaways`.

2. **Email Newsletter Digest Synthesis** ([emailSummarizer.ts](file:///C:/Users/natta/.gemini/antigravity/worktrees/oaktree-agent/list-schedule-llm-tasks/backend/src/emailSummarizer.ts#L205))
   * **Model**: `@cf/google/gemma-4-26b-a4b-it`
   * **Description**: Groups batch-ingested emails into macroeconomic or financial categories (e.g., *Macroeconomy*, *Corporate Earnings*, *Geopolitics*) and writes a thorough 1-to-2 paragraph synthesis for each.
   * **Format/Tone**: Written in **Thai** in the style of Howard Marks' memos, accompanied by 3 to 5 key takeaways per category.

3. **Facebook Post Formatting and Styling** ([facebook.ts](file:///C:/Users/natta/.gemini/antigravity/worktrees/oaktree-agent/list-schedule-llm-tasks/backend/src/facebook.ts#L195))
   * **Model**: `@cf/google/gemma-3-12b-it`
   * **Description**: Refines raw daily reports or email digests into highly engaging, structured, emoji-decorated Facebook posts tailored for a Thai audience.
   * **Format/Tone**: Howard Marks style. Employs a critical filter rule prohibiting hashtags that mention investor names (e.g., no `#HowardMarks`, `#Buffett`, or `#Munger`).

#### B. Interactive Chat Agents (Interactive UI-driven)
Defined in [mcp-worker/src/index.ts](file:///C:/Users/natta/.gemini/antigravity/worktrees/oaktree-agent/list-schedule-llm-tasks/mcp-worker/src/index.ts#L78):

1. **Oaktree Knowledge Agent** (`/chat` POST route)
   * **Model**: `@cf/meta/llama-3-8b-instruct`
   * **Purpose**: Serves the **Agent Chat** tab. It acts as an investment portfolio manager with function calling capabilities.
   * **Available Tools**:
     * `getPortfolio`: Pulls holdings, weights, and theses.
     * `getPortfolioHistory`: Fetches historical performance stats.
     * `getKnowledge`: Queries investment frameworks by category.
     * `searchKnowledge`: Searches the database knowledge records.
     * `queryNotebookLM`: Integrates with the `notebooklm-bridge` to query external documents, filings, and notes.

2. **Cloudflare Database Agent** (`/database-chat` POST route)
   * **Model**: `@cf/meta/llama-3-8b-instruct`
   * **Purpose**: Serves the **Database Agent** tab (enabled via `ENABLE_DATABASE_AGENT`).
   * **Available Tools**:
     * `list_d1_tables` / `get_d1_table_schema`: Inspect D1 schema.
     * `execute_d1_sql`: Execute arbitrary SQL commands (SQLite) with responses capped at 100 rows.
     * `list_r2_objects` / `get_r2_object` / `put_r2_object` / `delete_r2_object`: CRUD actions on the bound R2 bucket.

---

