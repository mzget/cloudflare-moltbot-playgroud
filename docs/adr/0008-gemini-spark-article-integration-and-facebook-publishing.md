# ADR 0008: Gemini Spark Market Intelligence Integration & Facebook Publishing Pipeline

- **Status**: Accepted
- **Date**: 2026-10-06
- **Deciders**: Oaktree Development Team & User

---

## Context & Problem Statement

Previously, the Market Intelligence subsystem only displayed research generated through the NotebookLM bridge in the `notebook_articles` table. As external agentic AI workflows (specifically Google Gemini Spark Custom Apps) were introduced to perform automated deep-dive financial analysis, earnings breakdown, and macroeconomic syntheses, the system needed a standardized, resilient mechanism to:

1. Ingest external research articles into Oaktree directly through the Model Context Protocol (MCP) server.
2. Persist long-form Markdown analyses in durable object storage (Cloudflare R2) alongside database records.
3. Allow external AI agents to create and publish Facebook Page posts safely without risking runaway social media spam.
4. Provide operators with immediate manual publishing, retry mechanisms, and a dedicated emergency pause toggle in the Command Center.

---

## Decision Drivers

- **Zero-Friction Ingestion**: External AI agents (Gemini Spark) interact purely via standard MCP tool calls (`saveMarketArticle`, `createFacebookDraft`, `getRecentArticles`).
- **Safety First & Anti-Spam Guardrails**: External articles must not be auto-published to Facebook by default unless explicitly flagged (`auto_publish = 1`) and permitted by system-wide controls.
- **Operator Autonomy**: The operator must be able to review drafts in the UI and trigger immediate publishing ("Publish Now") or queue for scheduled distribution ("Post to FB") with 1-click.
- **Operational Kill Switch**: Provide an independent toggle in Command Center (`pause_notebook_facebook`) without affecting existing news crawler, draft processing, or general Facebook queues.

---

## Architecture & Implementation

### 1. Database Schema Extension (`notebook_articles`)
Migration `0038_add_gemini_spark_columns_to_notebook_articles.sql` extends `notebook_articles` with:
- `source`: Origin identifier (`'gemini_spark'`, `'notebooklm'`, `'manual'`).
- `category`: Classification tag (e.g., `'deep_dive'`, `'earnings'`, `'macro'`, `'market_recap'`).
- `url`: Canonical source or reference URL.
- `auto_publish`: Integer flag (`0` = manual review draft, `1` = eligible for automated Facebook queueing).

### 2. Cloudflare R2 Knowledge Vault (`KNOWLEDGE_BUCKET`)
- Bound `KNOWLEDGE_BUCKET` (`oaktree-knowledge`) to `mcp-worker`.
- Full-text Markdown content is persisted at `articles/{id}_{slug}.md` for durable archive and retrieval.

### 3. MCP Worker Tools
Registered 3 resilient tools in `mcp-worker/src/mcpAgent.ts` backed by `mcp-worker/src/knowledge.ts`:
- `saveMarketArticle`: Inserts article record into D1, saves Markdown in R2, and optionally queues to Facebook if `auto_publish` is true.
- `createFacebookDraft`: Creates a standalone Facebook draft in `facebook_posts` with `status = 'draft'`.
- `getRecentArticles`: Retrieves recent articles for context and cross-referencing.

### 4. Facebook Publishing Pipeline (`backend/src/facebook.ts`)
- `source_type = 'notebook_article'` supported in `facebook_posts`.
- `syncAndProcessFacebookPosts()` gates automatic discovery of articles to:
  $$\text{auto\_publish} = 1 \quad \land \quad \text{pause\_notebook\_facebook} == 0$$
- `publishArticleNow()` endpoint (`POST /api/facebook/publish-article-now`) formats the article into an engaging Howard Marks-style Thai memo using Cloudflare Workers AI (`@cf/google/gemma-4-26b-a4b-it` with fallback to `@cf/meta/llama-4-scout-17b-16e-instruct`) and posts directly to the Facebook Graph API.

### 5. Frontend & Command Center Controls
- **Articles & Analyses Feed** (`NotebookArticleCard.tsx`): Displays source badges (`Gemini Spark` vs `NotebookLM`), source links, and instant action buttons ("Publish Now", "Post to FB", "Retry").
- **Command Center Tab 3 (Facebook Page)** (`SourceManager.tsx`): Adds **`Pause Articles & Analyses`** switch bound to `pause_notebook_facebook`, displayed in a clean 4-column control grid alongside existing pause switches.

---

## Consequences

- **Extensibility**: Any external agent (Gemini Spark, Claude, local agents) can publish structured research into Oaktree simply by invoking the MCP tool.
- **Safety**: Complete isolation between automatic publication and draft states prevents unreviewed posts from publishing unexpectedly.
- **Resilience**: The system supports both real-time synchronous publication (`publishArticleNow`) and asynchronous queue workers with AI model retry fallbacks.
- **Testing**: Covered by comprehensive Vitest unit tests in `backend` and `mcp-worker`, plus full Playwright E2E coverage across all 3 Command Center tabs (`command-center-all-tabs.spec.ts`).

