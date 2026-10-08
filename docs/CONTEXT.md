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

## DCF Valuation Subsystem (MCP Integration)

### Terms & Concepts

- **3 Preset Scenarios**:
  The canonical three valuation scenarios managed per stock symbol: `Base Case` (primary baseline), `Bull Case` (optimistic forecast), and `Bear Case` (conservative downside margin). Each stock maintains at most 1 saved record per scenario name in `dcf_calculations`.

- **Batch Scenario Ingestion (`save_dcf_scenarios`)**:
  Atomic submission of 1 to 3 DCF preset scenarios from external agents (such as Google Gemini Spark) via Model Context Protocol. Replaces existing records using an atomic batch `DELETE` and `INSERT` protocol in Cloudflare D1.

- **Detailed Forecast Mode**:
  Granular year-by-year 5-year forecast arrays: `yearly_growth`, `yearly_op_margin`, and `yearly_fcf_conv` (representing FY+1 through FY+5), mapped to the Gordon Growth intrinsic valuation model.

- **Scenario Rationale (`rationale`)**:
  Qualitative thesis and narrative justifications explaining the strategic assumptions behind the growth projections, margins, and terminal exit multiples.

- **Share Count Unit Standard**:
  Strict requirement where `shares_outstanding` and `target_shares` must always be stated in **Millions ($M$)** (e.g., 15,000 for 15 Billion shares). Input values $< 50$ trigger automated validation rejection to eliminate 1,000x calculation errors.

- **Valuation Inspection (`get_dcf_model` & `list_dcf_symbols`)**:
  MCP query tools allowing AI agents to read back stored valuation metrics, compare intrinsic share prices against real-time market prices, and compute margin of safety metrics.


