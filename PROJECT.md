# Project: Fundamental Intelligence Subsystem (ADR 0010)

## Architecture
The Fundamental Intelligence subsystem connects qualitative fundamental research from Google Gemini Notebooks into the Oaktree Dialectical Debate Engine via Cloudflare Workers, D1 database, R2 object storage, and an observability dashboard in Astro + MUI Joy UI.

### Data Flow & System Boundaries
1. **Gemini Notebook Research**: User analyzes companies/themes in Google Gemini Notebooks.
2. **MCP Push Layer (`mcp-worker`)**: External Gemini agents or users invoke MCP tools (`save_fundamental_brief`, `save_theme_sector_context`) to ingest structured JSON into Cloudflare D1 and persist OKF Markdown to Cloudflare R2 (`KNOWLEDGE_BUCKET` / `fundamentals/{symbol}.md`).
3. **Dialectical Debate Engine (`backend`)**: `debateEngine.ts` fetches quantitative data (`market_stats`), qualitative company profile (`stock_fundamentals`), and macro/industry dynamics (`theme_sector_contexts` joined via `theme_symbol_mappings`). `formatDebateContext` packages this into 5 structured sections, grounding Bull/Bear LLM arguments in management guidance, moat mechanisms, and thesis KPIs.
4. **Observability Dashboard (`frontend`)**: Command Center (`SourceManager.tsx`) hosts a 4th tab "Fundamental Intelligence" displaying watchlist tickers with 90-day freshness status badges (🟢 Active < 90d, 🟡 Stale ≥ 90d, 🔴 Missing), linked theme tags, and a 1-click "Copy Prompt for Gemini" modal.

```
                    ┌──────────────────────────────┐
                    │ Google Gemini Notebook (User) │
                    └──────────────┬───────────────┘
                                   │ (MCP Tool Calls)
                                   ▼
                       ┌────────────────────────┐
                       │  mcp-worker (Cloudflare)│
                       └───────────┬────────────┘
                                   │
              ┌────────────────────┴────────────────────┐
              ▼                                         ▼
    ┌───────────────────┐                     ┌───────────────────┐
    │  Cloudflare D1    │                     │  Cloudflare R2    │
    │ stock_fundamentals│                     │ KNOWLEDGE_BUCKET  │
    │ theme_sector_ctx  │                     │ fundamentals/     │
    │ theme_symbol_maps │                     │   {symbol}.md     │
    └─────────┬─────────┘                     └───────────────────┘
              │
              ▼
    ┌────────────────────────┐                ┌────────────────────────┐
    │ backend (Cloudflare)   │                │ frontend (Astro+React) │
    │ - debateEngine.ts      │◄───(REST API)──┤ - SourceManager.tsx    │
    │ - formatDebateContext  │                │ - CopyPromptModal.tsx  │
    │ - /api/fundamentals/*  │                │ - Freshness Badges     │
    └────────────────────────┘                └────────────────────────┘
```

## Feature Inventory
Every feature is assigned to a milestone. All features derived from ADR 0010, `BULL_BEAR_DEBATE_SPEC.md`, `CONTEXT.md`, and Survey findings.

| # | Feature | Description | Milestone | Source |
|---|---------|-------------|-----------|--------|
| F1 | D1 Migration 0041 | Schema for `stock_fundamentals`, `theme_sector_contexts`, `theme_symbol_mappings` | M1 | ADR 0010 § 38-71 |
| F2 | OKF Markdown Persistence | Serialization to OKF format and persistence to R2 (`fundamentals/{symbol}.md`) | M1 | ADR 0010 § 49-62 |
| F3 | MCP `save_fundamental_brief` | Ingests structured JSON, validates Zod schema, upserts to D1 and R2 | M2 | ADR 0010 § 73-77 |
| F4 | MCP `save_theme_sector_context` | Ingests theme-level dynamics, upserts to D1, batch updates symbol mappings | M2 | ADR 0010 § 78-81 |
| F5 | MCP `get_fundamental_brief` | Retrieves stock fundamental brief with joined theme sector contexts | M2 | ADR 0010 § 82-84 |
| F6 | MCP Agent Registration & Test Update | Registers 3 tools in `mcpAgent.ts`, updates `mcpAgent.test.ts` tool list (12 -> 15) | M2 | Survey Explorer MCP |
| F7 | Qualitative Fetching in Debate | `fetchQualitativeData` queries `stock_fundamentals` and `theme_sector_contexts` | M3 | ADR 0010 § 85-88 |
| F8 | 5-Section Debate Context Formatter | `formatDebateContext` structures metrics, company brief, theme context, events, notes | M3 | ADR 0010 § 89-93 |
| F9 | Prompt Grounding Rules | Bull/Bear/Arbiter prompts require explicit grounding in guidance, moat, and KPIs | M3 | BULL_BEAR_DEBATE_SPEC § 73-113 |
| F10 | Graceful Grounding Fallbacks | Gracefully handles missing fundamental records or empty fields without throwing | M3 | ADR 0010 § 94-98 |
| F11 | Fundamentals API Routes | `GET /api/fundamentals/status` and `GET /api/fundamentals?symbol=XYZ` | M3 | ADR 0010 § 101-110 |
| F12 | Observability Tab in Command Center | 4th Tab in `SourceManager.tsx` with watchlist status table and freshness badges | M4 | ADR 0010 § 112-120 |
| F13 | Copy Prompt for Gemini Modal | 1-click modal with extraction markdown prompt template and clipboard feedback | M4 | ADR 0010 § 121-135 |
| F14 | ARM Seed Ingestion & E2E Validation | Ingest ARM brief + SemiAnalysis theme, verify E2E debate rich grounding | M5 | ADR 0010 § 140-165 |

## Milestones

| # | Name | Scope | Dependencies | Status |
|---|------|-------|-------------|--------|
| M1 | Schema Migration & OKF Serialization | `backend/migrations/0041_fundamental_intelligence.sql`, OKF serialization helper | none | DONE (`0041_`, `fundamentals.ts`, `okf.ts`, 251 backend tests pass) |
| M2 | MCP Worker Ingestion & Retrieval Tools | `mcp-worker/src/fundamentalTools.ts`, `mcpAgent.ts`, tool tests | M1 | DONE (`fundamentalTools.ts`, `mcpAgent.ts`, 216 mcp-worker tests pass, Gate PASS) |
| M3 | Debate Grounding Context Fusion & API | `backend/src/debateEngine.ts`, `analysisPrompts.ts`, `routes/fundamentals.ts`, tests | M1 | DONE (`debateEngine.ts`, `analysisPrompts.ts`, `routes/fundamentals.ts`, 313 backend tests pass, Gate PASS) |
| M4 | Frontend Observability Dashboard | `SourceManager.tsx`, `FundamentalIntelligenceTab.tsx`, `CopyPromptModal.tsx`, tests | M3 | DONE (`FundamentalFreshnessBadge.tsx`, `CopyPromptModal.tsx`, `FundamentalIntelligenceTab.tsx`, 76 frontend tests pass, 100% Joy UI + sx) |
| M5 | ARM Seed Ingestion & Acceptance E2E Pass | Ingest ARM seed brief, pass 100% E2E test suite (Tiers 1-5), confirm debate grounding | M1, M2, M3, M4 | DONE (`arm_full_grounding.test.ts` passes, ARM + SemiAnalysis joined, 5-section context verified, 163 E2E tests pass, 0 typecheck errors) |

In parallel:
- **E2E Testing Track (`test_orchestrator`)**: Requirements-driven opaque-box test suite (Tiers 1-4) created independently, publishing `TEST_READY.md`.

## Interface Contracts

### 1. Database Schema (`stock_fundamentals`, `theme_sector_contexts`, `theme_symbol_mappings`)
```sql
CREATE TABLE IF NOT EXISTS stock_fundamentals (
    symbol TEXT PRIMARY KEY,
    business_model TEXT,
    moat TEXT,
    competitors TEXT, -- JSON array of strings
    guidance TEXT,    -- JSON object { revenue_target, margin_target, timeframe, key_assumptions }
    key_risks TEXT,   -- JSON array of strings
    thesis_kpis TEXT, -- JSON array of strings
    as_of_date TEXT NOT NULL,
    notebook_id TEXT,
    source_count INTEGER DEFAULT 1,
    updated_at TEXT DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_stock_fundamentals_as_of_date ON stock_fundamentals(as_of_date);

CREATE TABLE IF NOT EXISTS theme_sector_contexts (
    notebook_id TEXT PRIMARY KEY,
    theme_name TEXT NOT NULL,
    industry_dynamics TEXT,
    supply_chain_bottlenecks TEXT,
    competitive_landscape TEXT,
    macro_trends TEXT,
    updated_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS theme_symbol_mappings (
    notebook_id TEXT NOT NULL,
    symbol TEXT NOT NULL,
    created_at TEXT DEFAULT (datetime('now')),
    PRIMARY KEY (notebook_id, symbol),
    FOREIGN KEY (notebook_id) REFERENCES theme_sector_contexts(notebook_id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_theme_symbol_mappings_symbol ON theme_symbol_mappings(symbol);
```

### 2. MCP Tools Contract
- `save_fundamental_brief`:
  - Input: `{ symbol: string, business_model?: string, moat?: string, competitors?: string[], guidance?: { revenue_target?: string, margin_target?: string, timeframe?: string, key_assumptions?: string }, key_risks?: string[], thesis_kpis?: string[], as_of_date: string (YYYY-MM-DD), notebook_id?: string, source_count?: number }`
  - Output: `{ content: [{ type: "text", text: string }] }`
  - Side effects: Upsert to D1 `stock_fundamentals`, write to R2 `fundamentals/{symbol}.md`.
- `save_theme_sector_context`:
  - Input: `{ notebook_id: string, theme_name: string, industry_dynamics?: string, supply_chain_bottlenecks?: string, competitive_landscape?: string, macro_trends?: string, symbols?: string[] }`
  - Output: `{ content: [{ type: "text", text: string }] }`
  - Side effects: Upsert to D1 `theme_sector_contexts`, batch update `theme_symbol_mappings`.
- `get_fundamental_brief`:
  - Input: `{ symbol: string }`
  - Output: `{ content: [{ type: "text", text: JSON stringified { fundamental: StockFundamental | null, themes: ThemeSectorContext[] } }] }`

### 3. Backend Debate Context Contract
`formatDebateContext` returns a 5-section string:
- `[QUANTITATIVE METRICS]`: PE, PB, Market Cap, Growth, etc.
- `[COMPANY FUNDAMENTAL BRIEF]`: Business Model, Moat, Guidance, Key Risks, Thesis KPIs, As-Of Date.
- `[SECTOR & COMPETITIVE DYNAMICS]`: Theme Name, Industry Dynamics, Supply Chain Bottlenecks, Macro Trends.
- `[RECENT MARKET EVENTS]`: Catalyst events, macro headlines.
- `[RESEARCH & NOTES]`: Related articles and notebook notes.

### 4. Frontend Observability API Contract
- `GET /api/fundamentals/status`:
  - Returns: `{ items: Array<{ symbol: string, company_name: string, as_of_date: string | null, status: 'active' | 'stale' | 'missing', source_count: number, theme_tags: string[], updated_at: string | null }> }`
  - Rules: `active` if `now - as_of_date < 90 days`, `stale` if `≥ 90 days`, `missing` if null.
- `GET /api/fundamentals?symbol=XYZ`:
  - Returns detailed fundamental brief and linked themes.

## Code Layout
- `backend/migrations/0041_fundamental_intelligence.sql`: D1 migration script.
- `mcp-worker/src/fundamentalTools.ts`: MCP tool handlers and Zod validation.
- `mcp-worker/src/fundamentalTools.test.ts`: Vitest test suite for fundamental MCP tools.
- `mcp-worker/src/mcpAgent.ts`: MCP tool registration.
- `mcp-worker/src/mcpAgent.test.ts`: Test suite verifying tool presence.
- `backend/src/debateEngine.ts`: `fetchQualitativeData` retrieval and debate execution.
- `backend/src/analysisPrompts.ts`: `formatDebateContext` 5-section formatting and Bull/Bear grounding prompts.
- `backend/src/routes/fundamentals.ts`: REST endpoints for dashboard status and brief lookup.
- `backend/src/debateEngine.test.ts`: Vitest test suite for debate grounding fusion.
- `frontend/src/components/features/sources/FundamentalIntelligenceTab.tsx`: Observability dashboard tab.
- `frontend/src/components/features/sources/FundamentalFreshnessBadge.tsx`: Freshness badge component (Joy UI).
- `frontend/src/components/features/sources/CopyPromptModal.tsx`: Joy UI modal with Gemini prompt copy button.
- `frontend/src/components/features/sources/SourceManager.tsx`: Tab integration in Command Center.
- `tests/e2e/`: Opaque-box E2E test runner and test suites (Tiers 1-4).
