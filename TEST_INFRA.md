# E2E Test Infrastructure & Opaque-Box Specification: Fundamental Intelligence Subsystem (ADR 0010)

## 1. Executive Overview & Test Architecture

This document establishes the End-to-End (E2E) Test Infrastructure and Opaque-Box Test Suite specification for the **Fundamental Intelligence subsystem** (ADR 0010, Features F1–F14) in the Oaktree Agent workspace.

The Fundamental Intelligence subsystem connects qualitative fundamental equity research from Google Gemini Notebooks into the Oaktree Dialectical Debate Engine via Cloudflare Workers (`mcp-worker`, `backend`), Cloudflare D1 SQL database, Cloudflare R2 object storage (`KNOWLEDGE_BUCKET`), and an observability dashboard in Astro + MUI Joy UI.

### Test Architecture Principles
1. **Opaque-Box Contract Verification**: Tests evaluate system behavior exclusively against documented public interfaces, schema contracts, API endpoints, serialization formats, and UI helper logic defined in `PROJECT.md`, `ADR 0010`, `docs/CONTEXT.md`, and `specs/BULL_BEAR_DEBATE_SPEC.md`.
2. **Deterministic Isolation**: Tests run in an isolated environment without external cloud dependencies. Cloudflare D1 and R2 storage interfaces are exercised through deterministic contract harnesses matching Cloudflare Workers runtime behavior.
3. **Progressive Testability**: The test infrastructure verifies contracts independently of deployment sequencing, allowing milestone implementations (M1–M5) to be progressively verified against the test harness.
4. **4-Tier Test Pyramid**:
   - **Tier 1: Feature Coverage (Category-Partition Method)**: Functional equivalence partitions across all 14 features (≥5 tests/feature, ≥70 tests).
   - **Tier 2: Boundary & Corner Cases (Boundary Value Analysis)**: Extremes, nullability, character escaping, overflows, and malformed inputs (≥5 tests/feature, ≥70 tests).
   - **Tier 3: Pairwise Combinations (Orthogonal Interaction)**: Cross-subsystem interaction matrices across D1, R2, MCP, Debate Engine, and REST APIs (≥14 tests).
   - **Tier 4: Real-World Scenarios (End-to-End Workflows)**: Multi-step lifecycle simulations including quarterly refreshes, cold starts, and the ARM golden seed flow (≥7 scenarios).

---

## 2. Test Runner Commands & Configuration

The test suite is driven by **Vitest** and can be executed via npm scripts or direct CLI invocation.

### Primary Runner Commands

```bash
# Run the complete E2E Opaque-Box Test Suite (Tiers 1-4)
npm run test:e2e

# Direct Vitest command from workspace root
node backend/node_modules/vitest/vitest.mjs run --config tests/e2e/vitest.config.ts

# Run a specific tier
node backend/node_modules/vitest/vitest.mjs run tests/e2e/tier1-features.test.ts --config tests/e2e/vitest.config.ts
node backend/node_modules/vitest/vitest.mjs run tests/e2e/tier2-boundaries.test.ts --config tests/e2e/vitest.config.ts
node backend/node_modules/vitest/vitest.mjs run tests/e2e/tier3-combinations.test.ts --config tests/e2e/vitest.config.ts
node backend/node_modules/vitest/vitest.mjs run tests/e2e/tier4-scenarios.test.ts --config tests/e2e/vitest.config.ts

# Run in watch mode during development
node backend/node_modules/vitest/vitest.mjs --config tests/e2e/vitest.config.ts
```

### Directory Layout

```
tests/e2e/
├── vitest.config.ts            # Vitest configuration for the E2E track
├── contracts/
│   └── contracts.ts            # Opaque-box contract interfaces, schemas, and test harnesses
├── fixtures/
│   ├── armSeed.ts              # ARM golden seed and SemiAnalysis theme fixtures
│   └── mockData.ts             # Diverse stock fixtures, bad inputs, and edge data
├── tier1-features.test.ts      # Tier 1: Feature Coverage (Category-Partition: F1-F14)
├── tier2-boundaries.test.ts    # Tier 2: Boundary Value Analysis & Corner Cases (F1-F14)
├── tier3-combinations.test.ts  # Tier 3: Pairwise & Cross-Feature Interaction Combinations
└── tier4-scenarios.test.ts     # Tier 4: Real-World Multi-Step Scenarios & Golden Flows
```

---

## 3. Coverage Thresholds & Feature Matrix

| Tier | Methodology | Scope | Target Threshold | Actual Implemented |
|------|-------------|-------|------------------|--------------------|
| **Tier 1** | Category-Partition | Features F1–F14 Functional Equivalence Partitions | ≥ 5 tests / feature (≥ 70 tests) | **70 tests** (5 per feature × 14) |
| **Tier 2** | Boundary Value Analysis | Features F1–F14 Boundary, Limits & Corner Cases | ≥ 5 tests / feature (≥ 70 tests) | **70 tests** (5 per feature × 14) |
| **Tier 3** | Pairwise Combinations | Cross-Feature & Cross-Subsystem Interactions | ≥ 14 combinations | **15 tests** |
| **Tier 4** | Real-World Scenarios | End-to-End User Journeys & Golden Data Flows | ≥ 7 scenarios | **8 scenarios** |
| **TOTAL**| | **Complete Opaque-Box Suite** | **≥ 161 tests** | **163 tests** |

---

## 4. Feature-by-Feature Specification (F1 – F14)

### F1: D1 Migration 0041 (Database Schema)
- **Contract**: SQL DDL creating `stock_fundamentals`, `theme_sector_contexts`, and `theme_symbol_mappings` with foreign keys, cascade delete, and indices.
- **Tier 1 Partitions**:
  1. Primary key uniqueness and column nullability on `stock_fundamentals`.
  2. Index creation on `as_of_date` and `theme_symbol_mappings(symbol)`.
  3. Foreign key relationship from `theme_symbol_mappings(notebook_id)` to `theme_sector_contexts(notebook_id)`.
  4. Cascade deletion of mappings when a theme context is deleted.
  5. JSON string column storage (`competitors`, `guidance`, `key_risks`, `thesis_kpis`).
- **Tier 2 Boundaries**:
  1. Duplicate symbol insert rejected by primary key constraint.
  2. Symbol case handling and trimming.
  3. Default values applied when optional fields omitted (`source_count = 1`, `updated_at`).
  4. Orphan mapping insertion rejected when `notebook_id` does not exist in `theme_sector_contexts`.
  5. Composite primary key enforcement on `theme_symbol_mappings (notebook_id, symbol)`.

### F2: OKF Markdown Persistence
- **Contract**: Serialization of fundamental profiles into Oaktree Knowledge Format (OKF) with YAML frontmatter and structured Markdown sections saved to R2 at `fundamentals/{symbol}.md`.
- **Tier 1 Partitions**:
  1. Valid YAML frontmatter generation containing `symbol`, `as_of_date`, `notebook_id`, `source_count`.
  2. Section headers formatting: `# Fundamental Brief: {symbol}`, `## Business Model`, `## Economic Moat`.
  3. Guidance target bullet formatting with revenue, margin, and timeframe.
  4. List serialization for competitors, key risks, and thesis KPIs.
  5. Deterministic R2 key naming (`fundamentals/{symbol}.md`).
- **Tier 2 Boundaries**:
  1. Handling empty optional guidance fields in OKF without writing undefined/null text.
  2. Special Markdown characters and pipe/bracket escaping in business model strings.
  3. Single-line and multi-line risk item serialization.
  4. Large thesis KPI lists (10+ items) rendered cleanly.
  5. Symbols with symbols or hyphens (e.g., `BRK.B`, `BF-B`) sanitized for R2 key compatibility.

### F3: MCP `save_fundamental_brief`
- **Contract**: MCP tool accepting structured JSON, validating with Zod schema, upserting to D1 `stock_fundamentals`, and persisting to R2.
- **Tier 1 Partitions**:
  1. Full payload ingestion with all fields populated.
  2. Minimal valid payload ingestion (`symbol`, `as_of_date`).
  3. Upsert behavior: overwriting an existing symbol record updates all fields.
  4. R2 side-effect triggered upon successful D1 upsert.
  5. MCP output format adherence: `{ content: [{ type: "text", text: string }] }`.
- **Tier 2 Boundaries**:
  1. Zod rejection on invalid `as_of_date` format (e.g. `2026/07/29` or non-date string).
  2. Zod rejection on missing required `symbol`.
  3. Negative or zero `source_count` handling and default fallback.
  4. Extremely long string inputs (5000+ characters) in `business_model` and `moat`.
  5. Empty array inputs for `competitors`, `key_risks`, and `thesis_kpis`.

### F4: MCP `save_theme_sector_context`
- **Contract**: MCP tool accepting theme-level dynamics, upserting to D1 `theme_sector_contexts`, and batch updating `theme_symbol_mappings`.
- **Tier 1 Partitions**:
  1. Full theme ingestion with macro trends, industry dynamics, supply bottlenecks.
  2. Multi-symbol mapping: linking 3+ symbols to a single theme notebook.
  3. Overwriting existing theme updates content and refreshes symbol mappings.
  4. Ingesting theme with empty symbols array leaves existing or creates zero mappings.
  5. MCP output response returning confirmation text.
- **Tier 2 Boundaries**:
  1. Zod rejection on missing `notebook_id` or `theme_name`.
  2. Duplicate symbols in the input `symbols` list deduplicated before mapping.
  3. Symbol normalization to uppercase in mappings.
  4. Replacing symbol mappings removes unreferenced old symbols atomically.
  5. Large symbol list (50+ symbols) batch insertion.

### F5: MCP `get_fundamental_brief`
- **Contract**: MCP query tool retrieving single-stock brief joined with all linked theme sector contexts.
- **Tier 1 Partitions**:
  1. Retrieving symbol with both fundamental profile and linked theme contexts.
  2. Retrieving symbol with fundamental profile but no linked theme contexts.
  3. Retrieving symbol with no fundamental profile returns `null` for fundamental.
  4. Symbol linked to multiple theme notebooks returns all theme contexts.
  5. Response JSON shape contains `{ fundamental, themes }`.
- **Tier 2 Boundaries**:
  1. Case-insensitive symbol retrieval (e.g. querying `arm` retrieves `ARM`).
  2. Handling whitespace padded symbols (`" ARM "`).
  3. Parsing JSON columns (`competitors`, `guidance`, `key_risks`, `thesis_kpis`) safely into native objects.
  4. Corrupted/unparseable JSON in D1 columns falls back gracefully without throwing.
  5. Non-existent symbol query returns `{ fundamental: null, themes: [] }`.

### F6: MCP Agent Registration & Test Update
- **Contract**: Verification that all 3 fundamental tools (`save_fundamental_brief`, `save_theme_sector_context`, `get_fundamental_brief`) are registered in `mcpAgent.ts`, expanding tool inventory from 12 to 15.
- **Tier 1 Partitions**:
  1. `save_fundamental_brief` is present in the registered tools registry.
  2. `save_theme_sector_context` is present in the registered tools registry.
  3. `get_fundamental_brief` is present in the registered tools registry.
  4. Total registered MCP tool count is exactly 15.
  5. Tool execution dispatch invokes the corresponding tool handler.
- **Tier 2 Boundaries**:
  1. Calling registered tool with undefined arguments triggers validation error.
  2. Tool name lookup is case-sensitive and rejects unknown tool names.
  3. Tool descriptors contain non-empty descriptions and valid input schemas.
  4. Tool definitions conform to Model Context Protocol SDK standards.
  5. Handlers reject calls when environment bindings (D1, R2) are missing.

### F7: Qualitative Fetching in Debate
- **Contract**: `fetchQualitativeData(db, symbol)` queries `stock_fundamentals` and linked `theme_sector_contexts` for debate context preparation.
- **Tier 1 Partitions**:
  1. Successful retrieval of both fundamental profile and theme contexts for ticker.
  2. Symbol with fundamental profile but 0 themes returns populated fundamental and empty themes.
  3. Symbol with 0 fundamentals returns null profile.
  4. Verification of database query construction and bound parameters.
  5. Multiple themes correctly aggregated and returned in qualitative data result.
- **Tier 2 Boundaries**:
  1. Database query error / network blip handled gracefully without crashing debate.
  2. Symbol with null optional fields (`moat`, `guidance`) returned cleanly.
  3. Empty strings vs null fields handled consistently.
  4. Querying symbol with special characters (e.g. `BRK/B`).
  5. Timeout or slow D1 response fallback behavior.

### F8: 5-Section Debate Context Formatter
- **Contract**: `formatDebateContext` returns a 5-section string: `[QUANTITATIVE METRICS]`, `[COMPANY FUNDAMENTAL BRIEF]`, `[SECTOR & COMPETITIVE DYNAMICS]`, `[RECENT MARKET EVENTS]`, `[RESEARCH & NOTES]`.
- **Tier 1 Partitions**:
  1. All 5 sections present when full data (metrics, fundamentals, themes, events, articles) is supplied.
  2. Company brief section displays Business Model, Moat, Guidance, Key Risks, Thesis KPIs.
  3. Sector dynamics section displays Theme Name, Industry Dynamics, Bottlenecks, Macro Trends.
  4. Financial metrics formatted with Thai/English labels and unit conversions.
  5. As-of date prominently formatted in the company brief header.
- **Tier 2 Boundaries**:
  1. Formatter called with only quantitative metrics (fundamentals, themes, events, articles empty).
  2. Guidance object containing only partial targets (e.g. revenue target only, no margin target).
  3. Empty arrays for risks and thesis KPIs omitted or formatted with clean placeholder.
  4. Markdown formatting integrity: no unclosed brackets or mangled table delimiters.
  5. Extremely long text fields truncated or cleanly wrapped without breaking prompt structure.

### F9: Prompt Grounding Rules
- **Contract**: Prompt generation for Bull, Bear, and Arbiter agents requiring explicit qualitative grounding in management guidance, moat mechanisms, unit economics, and risks.
- **Tier 1 Partitions**:
  1. `getBullOpeningPrompt` includes instructions mandating citations of guidance and moat mechanisms.
  2. `getBearOpeningPrompt` includes instructions mandating citations of key risks and structural headwinds.
  3. `getBullRebuttalPrompt` includes context and instructions to counter Bear arguments with fundamental mitigations.
  4. `getBearRebuttalPrompt` includes context and instructions to critique Bull projections with guidance assumptions.
  5. `getArbiterSynthesisPrompt` includes instructions to evaluate consensus and score conviction balance (-10 to +10).
- **Tier 2 Boundaries**:
  1. Prompt generation for symbol with missing fundamental brief instructs agents to rely on available metrics.
  2. Strict JSON output instructions: forbidding unescaped double quotes.
  3. Conviction label thresholds mapped accurately (+7 to +10 Strong Bull, -10 to -7 Strong Bear).
  4. Prompt generation preserves Unicode characters (Thai descriptions and financial symbols).
  5. Oversized context strings handled without truncating required JSON output schemas.

### F10: Graceful Grounding Fallbacks
- **Contract**: When qualitative data is partially or entirely absent, system degrades gracefully without runtime exceptions.
- **Tier 1 Partitions**:
  1. Symbol with no fundamental brief produces valid debate context with quantitative metrics only.
  2. Symbol with fundamental brief but no theme contexts formats brief section and skips theme section.
  3. Fundamental brief with missing guidance targets skips guidance subsection without error.
  4. Empty market events array gracefully skipped.
  5. Empty research articles array gracefully skipped.
- **Tier 2 Boundaries**:
  1. Completely empty/null qualitative data object passed to debate engine.
  2. Corrupted JSON strings in database columns handled without throwing JSON parse error.
  3. Missing as_of_date falls back to "Unknown" or updated_at date.
  4. All quantitative metrics null while qualitative brief is present.
  5. Both quantitative metrics and qualitative brief empty/null.

### F11: Fundamentals API Routes
- **Contract**: `GET /api/fundamentals/status` and `GET /api/fundamentals?symbol=XYZ`.
- **Tier 1 Partitions**:
  1. `GET /api/fundamentals/status` returns watchlist array with `symbol`, `as_of_date`, `status`, `theme_tags`.
  2. Freshness rule: `as_of_date` < 90 days returns `status: 'active'`.
  3. Freshness rule: `as_of_date` ≥ 90 days returns `status: 'stale'`.
  4. Freshness rule: `as_of_date` null or no record returns `status: 'missing'`.
  5. `GET /api/fundamentals?symbol=XYZ` returns detailed brief and linked themes.
- **Tier 2 Boundaries**:
  1. Freshness boundary at exactly 89 days (active), 90 days (stale), 91 days (stale).
  2. `GET /api/fundamentals` with missing `symbol` query param returns 400 Bad Request.
  3. `GET /api/fundamentals` for unknown symbol returns 404 or `{ fundamental: null, themes: [] }`.
  4. Watchlist with 0 records returns empty items array `{ items: [] }`.
  5. Invalid date string in database falls back to `missing` or `stale` safely.

### F12: Observability Tab in Command Center
- **Contract**: 4th Tab in `SourceManager.tsx` displaying watchlist stocks with status badges, theme tags, and action triggers.
- **Tier 1 Partitions**:
  1. Tab item rendering: "Fundamental Intelligence" labeled tab with source count indicator.
  2. Watchlist table rendering: columns for Symbol, Company, As-Of Date, Freshness, Themes, Actions.
  3. Freshness badge color mapping: 🟢 Active (<90d), 🟡 Stale (≥90d), 🔴 Missing.
  4. Theme tags chip rendering: chips for each linked theme (e.g. "SemiAnalysis").
  5. Row action click opens Gemini Prompt copy modal.
- **Tier 2 Boundaries**:
  1. Empty watchlist displays friendly empty state illustration and message.
  2. Long theme tag lists truncated with overflow indicator (+2 more).
  3. Extremely old date (e.g. 500+ days) rendered with stale badge and humanized elapsed time.
  4. Missing company name falls back to ticker symbol.
  5. Loading and error states render gracefully without layout shift.

### F13: Copy Prompt for Gemini Modal
- **Contract**: Joy UI Modal displaying pre-filled extraction markdown prompt for Gemini Notebook with 1-click clipboard copy.
- **Tier 1 Partitions**:
  1. Modal opens with selected symbol populated in prompt template.
  2. Extraction prompt contains structured JSON schema for `save_fundamental_brief`.
  3. Extraction prompt instructs Gemini to derive `as_of_date` from source filing date.
  4. Copy button writes markdown prompt to system clipboard.
  5. Visual feedback (e.g. "Copied!" checkmark) shown upon successful copy.
- **Tier 2 Boundaries**:
  1. Clipboard API failure / permission denied displays accessible fallback textarea.
  2. Modal opens cleanly when symbol has no existing fundamental brief (seed prompt).
  3. Modal opens cleanly when symbol has existing stale brief (refresh prompt).
  4. Prompt template includes target guidance, moat, and KPI extraction guidelines.
  5. Modal close via Escape key, close button, or backdrop click.

### F14: ARM Seed Ingestion & E2E Validation
- **Contract**: End-to-end golden verification using the actual ARM Q1 FY27 fundamental brief and SemiAnalysis theme context.
- **Tier 1 Partitions**:
  1. ARM fundamental brief payload validation with Zod.
  2. ARM brief upsert into D1 `stock_fundamentals` with `as_of_date: "2026-07-29"`.
  3. ARM OKF Markdown saved to R2 bucket under `fundamentals/ARM.md`.
  4. SemiAnalysis theme context ingestion and mapping to `ARM`.
  5. Complete 5-section debate context generation for `ARM` containing v9 architecture KPIs and SemiAnalysis dynamics.
- **Tier 2 Boundaries**:
  1. ARM status evaluation against current date: active (<90d) or stale (≥90d).
  2. ARM guidance targets verification: mid-20s % CAGR, >45% operating margin.
  3. ARM key risks verification: SoftBank ownership, RISC-V threat, China JV.
  4. OKF markdown verification: frontmatter parseable and sections intact.
  5. Full round-trip retrieval: `get_fundamental_brief("ARM")` returns brief + SemiAnalysis theme.

---

## 5. Tier 3: Pairwise Combinations (15 Interaction Tests)

Cross-subsystem interactions verified across matrix pairs:
1. **F1 (D1 Schema) × F3 (save_fundamental_brief) × F5 (get_fundamental_brief)**: Ingestion through schema into D1 with full retrieval round-trip.
2. **F1 (D1 Schema) × F4 (save_theme_sector_context) × F5 (get_fundamental_brief)**: Theme ingestion, symbol mapping, and joined retrieval.
3. **F3 (save_fundamental_brief) × F2 (OKF Markdown) × R2 Bucket**: MCP push triggers automatic OKF serialization and R2 storage write.
4. **F3 (save_fundamental_brief) × F7 (Qualitative Fetch) × F8 (5-Section Context)**: Ingested single-stock brief queried and formatted into 5-section debate prompt.
5. **F4 (save_theme_sector_context) × F7 (Qualitative Fetch) × F8 (5-Section Context)**: Ingested theme context joined and formatted into Sector Dynamics section.
6. **F7 (Qualitative Fetch) × F10 (Graceful Fallback)**: Missing database records return graceful empty structures without throwing.
7. **F8 (5-Section Formatter) × F9 (Prompt Grounding Rules)**: 5-section context injected into Bull/Bear/Arbiter prompts with qualitative grounding mandates.
8. **F1 (D1 Schema) × F11 (API Routes) × Freshness Calculation**: `/api/fundamentals/status` queries D1 and computes active/stale/missing status.
9. **F3 (save_fundamental_brief) × F11 (API Status Refresh)**: Ingesting a new brief updates `/api/fundamentals/status` from missing/stale to active.
10. **F12 (Observability UI) × F13 (Copy Prompt Modal)**: Clicking a watchlist row in the UI opens modal with ticker-specific extraction prompt.
11. **F3 (save_fundamental_brief) × F4 (save_theme_sector_context) × F14 (ARM Golden Seed)**: Dual ingestion of ARM brief and SemiAnalysis theme verified in unified query.
12. **F3 (save_fundamental_brief) Upsert Idempotency**: Successive calls with updated fields overwrite D1 and R2 without duplicate records.
13. **F4 (save_theme_sector_context) Mapping Cascade**: Updating a theme's symbol list cleans up orphaned mappings via foreign key cascade.
14. **F10 (Graceful Fallbacks) × F11 (API Route Lookup)**: Querying `/api/fundamentals?symbol=NONEXISTENT` handles null results cleanly.
15. **F6 (MCP Registry) × F3/F4/F5 Execution**: Registered MCP tools execute through the MCP agent router and return valid MCP response structures.

---

## 6. Tier 4: Real-World Scenarios (8 End-to-End Scenarios)

1. **Scenario 1: Quarterly Earnings Refresh Lifecycle**
   User copies extraction prompt from Command Center → runs extraction on Q1 FY27 report in Gemini Notebook → calls MCP `save_fundamental_brief` → D1 and R2 updated → Dashboard status badge flips from Stale to Active.
2. **Scenario 2: Multi-Stock Thematic Dynamics Ingestion**
   Analyst publishes "SemiAnalysis" industry brief covering semiconductor supply chains → calls MCP `save_theme_sector_context` with symbols `["ARM", "NVDA", "AVGO"]` → all three tickers automatically inherit the sector context in future debates.
3. **Scenario 3: Zero-Data Cold-Start Dialectical Debate**
   User initiates debate for a newly added ticker (`PLTR`) with no existing qualitative brief → system detects missing brief → falls back gracefully to quantitative metrics and recent market events without crashing.
4. **Scenario 4: High-Conviction Adversarial Dialectical Debate**
   Full dialectical debate executed for `ARM` → 5-section context injected → Bull cites v9 royalty rates and CSS adoption → Bear cites RISC-V edge computing threat and smartphone saturation → Arbiter weighs tensions and outputs balanced conviction score (+4 Moderate Bull).
5. **Scenario 5: Multi-Quarter Stale Flagging & Aging Lifecycle**
   Brief ingested with `as_of_date` 120 days ago → status endpoint evaluates as Stale (🟡) → UI displays warning → new brief submitted with current filing date → status endpoint evaluates as Active (🟢).
6. **Scenario 6: Malformed External Agent Injection & Resilience**
   Adversarial agent attempts to inject malformed JSON, SQL injection payloads in guidance, and invalid date formats → Zod schema rejects malformed payload with descriptive errors → D1 and R2 remain uncorrupted.
7. **Scenario 7: Full Golden Flow for ARM (ADR 0010 Reference Implementation)**
   Complete end-to-end simulation from ARM seed ingestion to R2 OKF verification, status API verification, and debate context fusion.
8. **Scenario 8: Orphan Theme Cleanup & Symbol Re-mapping**
   Theme notebook originally mapped to `["ARM", "INTC"]` updated to `["ARM", "QCOM"]` → old `INTC` mapping removed, `QCOM` mapping added, `ARM` mapping preserved.
