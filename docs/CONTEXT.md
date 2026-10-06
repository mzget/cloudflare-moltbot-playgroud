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

## Market Intelligence & External AI Agents Subsystem

### Terms & Concepts

- **Market Intelligence Articles (`notebook_articles`)**:
  Long-form research and market analysis records generated either through NotebookLM or external agentic AI platforms (e.g., Gemini Spark). Stored with categorization, source tags, and optional source URLs.

- **Knowledge Vault (`KNOWLEDGE_BUCKET`)**:
  A Cloudflare R2 bucket (`oaktree-knowledge`) storing persistent raw Markdown files and documents for long-term intelligence retrieval.

- **Gemini Spark Ingestion**:
  Direct MCP-driven submission of deep-dive research articles by Google Gemini Spark Custom Apps via the `saveMarketArticle` tool call.

- **Auto-Publish vs. Draft Mode**:
  - `auto_publish = 1`: The article is eligible for automatic queueing and posting to the Facebook Page during scheduled Facebook background processing.
  - `auto_publish = 0` (Default / Draft): The article is saved in draft mode, awaiting manual review and explicit posting by an operator.

- **Immediate Article Publishing (`publishArticleNow`)**:
  An on-demand operation triggered from the frontend ("Publish Now") that immediately formats an article into a Howard Marks-style memo using Cloudflare Workers AI and posts it to the Facebook Page via the Graph API.

- **Pause Articles & Analyses (`pause_notebook_facebook`)**:
  A system-level kill switch in the Command Center (Facebook Page tab) that temporarily halts automated discovery and publishing of `notebook_articles` without interrupting general market news or custom post drafting.

