# ADR 0010: Fundamental Intelligence MCP Push & Status Dashboard

- **Status**: Accepted
- **Date**: 2026-10-15
- **Deciders**: Oaktree Development Team & User

---

## Context & Problem Statement

In the Bull vs. Bear Dialectical Debate Engine (Phase 1), testing with symbol `ARM` revealed a critical "Data Starvation" limitation:
1. The debate engine relied primarily on quantitative numbers from `market_stats` (P/E, margins, revenue growth) and sparse `market_events`.
2. The `notebook_articles` table contained 0 entries for ARM because the existing `notebookSync.ts` pulled from a single legacy `NOTEBOOKLM_DEFAULT_NOTEBOOK_ID` via a headless browser bridge (`/ask`).
3. The user maintains extensive fundamental research (quarterly reports, slide decks, call transcripts, thesis notes) organized into separate Google Gemini Notebooks (e.g., 25 distinct notebooks with random UUIDs, dedicated to single tickers like `ARM` or themes like `SemiAnalysis` and `AI Datacenter`).
4. Headless browser pull sync is brittle (susceptible to Google authentication/cookie expiry, DOM/URL redirections to `notebook.google.com`, and Cloudflare Worker subrequest timeouts).

A robust, maintenance-free, and high-fidelity mechanism is required to ingest qualitative fundamental research from Gemini Notebooks and supply it directly into the dialectical debate engine alongside quantitative market stats.

---

## Decision Drivers

- **Zero-Maintenance Ingestion (Push via MCP)**: Eliminate dependency on fragile headless browser scraping. When quarterly filings are uploaded to Gemini Notebook, the user instructs Gemini to extract structured JSON and invoke MCP tools directly.
- **Single-Stock + Theme Hierarchy (Best of Both Worlds)**:
  - **Single-Stock Notebook (`kind = 'single'`)**: Provides the core company profile (`business_model`, `moat`, `competitors`, `guidance`, `key_risks`, `thesis_kpis`).
  - **Theme Notebook (`kind = 'theme'`)**: Provides cross-stock industry synthesis (`industry_dynamics`, `supply_chain_bottlenecks`, `competitive_landscape`, `macro_trends`) mapped to multiple watchlist stocks.
- **Observability via Web UI Dashboard**: Provide a clean status overview in Oaktree App showing which stocks have up-to-date fundamental briefs, which are stale (> 90 days / quarter elapsed), and a 1-click "Copy Prompt for Gemini" helper.
- **Source As-Of Date Derivation**: Freshness dates (`as_of_date`) are validated and derived from filing timestamps (e.g. `2026-07-29` for Q1 FY27), avoiding hallucinations.
- **Debate Context Grounding**: `debateEngine.ts` injects both the fundamental brief and sector context into Round 1 (Bull/Bear Opening) and Round 3 (Arbiter Synthesis), grounding claims with verifiable metrics.

---

## Architecture & Implementation

### 1. Database Schema Extension (Cloudflare D1)

```sql
-- 1. Single-Stock Fundamental Profiles
CREATE TABLE IF NOT EXISTS stock_fundamentals (
  symbol TEXT PRIMARY KEY,
  notebook_id TEXT,
  business_model TEXT NOT NULL,
  moat TEXT NOT NULL,
  competitors TEXT, -- JSON array of strings
  guidance TEXT,    -- JSON object (near_term, long_term)
  key_risks TEXT,   -- JSON array of strings
  thesis_kpis TEXT, -- JSON array of strings
  as_of_date TEXT NOT NULL,
  source_count INTEGER DEFAULT 0,
  updated_at TEXT DEFAULT (datetime('now'))
);

-- 2. Multi-Stock Theme Industry Contexts
CREATE TABLE IF NOT EXISTS theme_sector_contexts (
  notebook_id TEXT PRIMARY KEY,
  theme_name TEXT NOT NULL,
  industry_dynamics TEXT NOT NULL,
  supply_chain_bottlenecks TEXT,
  competitive_landscape TEXT,
  macro_trends TEXT,
  updated_at TEXT DEFAULT (datetime('now'))
);

-- 3. Theme to Stock Symbol Mappings
CREATE TABLE IF NOT EXISTS theme_symbol_mappings (
  notebook_id TEXT NOT NULL,
  symbol TEXT NOT NULL,
  created_at TEXT DEFAULT (datetime('now')),
  PRIMARY KEY (notebook_id, symbol)
);
```

### 2. MCP Worker Tools (`mcp-worker`)

Registered in `mcp-worker/src/mcpAgent.ts`:
- **`save_fundamental_brief`**:
  - Validates and upserts structured fundamental profile into `stock_fundamentals`.
  - Saves corresponding OKF Markdown into Cloudflare R2 (`KNOWLEDGE_BUCKET` under `fundamentals/{symbol}.md`).
- **`save_theme_sector_context`**:
  - Validates and upserts macro/sector synthesis into `theme_sector_contexts`.
  - Links symbols via `theme_symbol_mappings`.
- **`get_fundamental_brief`**:
  - Fetches the stored fundamental profile and linked sector contexts for any symbol.

### 3. Debate Engine Integration (`backend/src/debateEngine.ts`)

- In `fetchQualitativeData`: Query `stock_fundamentals` and any linked `theme_sector_contexts` for the given symbol.
- In `formatDebateContext`: Structure the prompt with distinct sections:
  1. `[QUANTITATIVE METRICS]` (from `market_stats`)
  2. `[COMPANY FUNDAMENTAL BRIEF]` (Business model, Moat, Guidance targets, Risks, Thesis KPIs)
  3. `[SECTOR & COMPETITIVE DYNAMICS]` (from linked Theme Notebooks)
  4. `[RECENT MARKET EVENTS]` (from `market_events`)

### 4. Frontend Status Dashboard (`frontend`)

- Add a **"Fundamental Intelligence"** widget or view in Command Center / Analysis page.
- Displays:
  - Ticker symbol & company name
  - As-of date & Freshness badge (🟢 Active / 🟡 Stale > 90d / 🔴 Missing)
  - Linked Theme Notebook badge
  - "Copy Prompt for Gemini" button to quickly prompt Gemini in the notebook with one click.

---

## Consequences

### Positive
- **High Information Density**: Bull and Bear agents argue using real management guidance, Moat characteristics, and specific thesis KPIs rather than generic platitudes.
- **High Reliability**: No headless browser sessions or cookie expiration failures.
- **Industry Cohesion**: Theme notebooks (like SemiAnalysis) enrich multiple related tickers simultaneously with zero duplicate extraction effort.

### Negative / Trade-offs
- Manual step required once per quarter: User prompts Gemini in the notebook to execute the MCP tool when new quarterly earnings documents are added.
