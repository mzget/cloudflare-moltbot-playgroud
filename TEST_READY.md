# TEST_READY: Fundamental Intelligence Subsystem (ADR 0010)

- **Status**: READY
- **Date**: 2026-10-15
- **Test Architecture**: 4-Tier Opaque-Box E2E Testing Track (Vitest)
- **Test Configuration**: `tests/e2e/vitest.config.ts`
- **Execution Command**: `npm run test:e2e`

---

## 1. Executive Test Suite Summary

The End-to-End (E2E) Test Infrastructure and Opaque-Box Test Suite for the Fundamental Intelligence subsystem (Features F1–F14, ADR 0010) has been fully designed, implemented, and verified.

All **163 tests** across Tiers 1 through 4 pass cleanly with 100% success rate:

```
Test Files  4 passed (4)
     Tests  163 passed (163)
  Duration  3.52s
```

### Threshold Compliance Table

| Tier | Methodology | Minimum Threshold | Actual Implemented | Status |
|------|-------------|-------------------|--------------------|--------|
| **Tier 1** | Feature Coverage (Category-Partition) | ≥ 5 / feature (≥ 70 tests) | **70 tests** | **PASSED** (100%) |
| **Tier 2** | Boundary & Corner Cases (Boundary Value Analysis) | ≥ 5 / feature (≥ 70 tests) | **70 tests** | **PASSED** (100%) |
| **Tier 3** | Cross-Feature Pairwise Combinations | ≥ 14 combinations | **15 tests** | **PASSED** (100%) |
| **Tier 4** | Real-World End-to-End Scenarios | ≥ 7 scenarios | **8 scenarios** | **PASSED** (100%) |
| **TOTAL** | **Full Opaque-Box E2E Suite** | **≥ 161 tests** | **163 tests** | **PASSED (163/163)** |

---

## 2. Test Execution Commands

```bash
# Execute complete E2E test suite from repository root
npm run test:e2e

# Direct Vitest CLI invocation
node backend/node_modules/vitest/vitest.mjs run --config tests/e2e/vitest.config.ts

# Tier-by-tier execution
node backend/node_modules/vitest/vitest.mjs run tests/e2e/tier1-features.test.ts --config tests/e2e/vitest.config.ts
node backend/node_modules/vitest/vitest.mjs run tests/e2e/tier2-boundaries.test.ts --config tests/e2e/vitest.config.ts
node backend/node_modules/vitest/vitest.mjs run tests/e2e/tier3-combinations.test.ts --config tests/e2e/vitest.config.ts
node backend/node_modules/vitest/vitest.mjs run tests/e2e/tier4-scenarios.test.ts --config tests/e2e/vitest.config.ts

# Typecheck verification
npm run ci:typecheck
```

---

## 3. Scope of Verified Interface Contracts

The test suite enforces the public interface contracts defined in `PROJECT.md`, `ADR 0010`, `docs/CONTEXT.md`, and `docs/specs/BULL_BEAR_DEBATE_SPEC.md`:

1. **D1 Schema Contract (F1)**:
   - `stock_fundamentals`: Primary key `symbol`, JSON text columns (`competitors`, `guidance`, `key_risks`, `thesis_kpis`), date index `idx_stock_fundamentals_as_of_date`.
   - `theme_sector_contexts`: Primary key `notebook_id`, industry dynamics, supply chain bottlenecks, macro trends.
   - `theme_symbol_mappings`: Composite primary key `(notebook_id, symbol)`, foreign key with `ON DELETE CASCADE`, symbol index `idx_theme_symbol_mappings_symbol`.

2. **R2 Knowledge Vault OKF Contract (F2)**:
   - YAML frontmatter format with `symbol`, `as_of_date`, `notebook_id`, `source_count`, `type: fundamental_brief`.
   - Section headers: `# Fundamental Brief: {symbol}`, `## Business Model`, `## Economic Moat`, `## Guidance Targets`, `## Key Competitors`, `## Key Risks`, `## Thesis KPIs`.
   - Deterministic R2 key: `fundamentals/{symbol}.md`.

3. **MCP Ingestion & Retrieval Contract (F3, F4, F5, F6)**:
   - `save_fundamental_brief`: Validates Zod schema, upserts to D1, persists OKF to R2, returns `{ content: [{ type: "text", text: string }] }`.
   - `save_theme_sector_context`: Validates Zod schema, upserts to D1, batch updates `theme_symbol_mappings` with uppercase normalization and deduplication.
   - `get_fundamental_brief`: Case-insensitive symbol retrieval, returns JSON payload `{ fundamental, themes }`.
   - MCP Agent Registry: 15 registered tools with non-empty descriptors and execution dispatch.

4. **Debate Context Grounding Fusion Contract (F7, F8, F9, F10)**:
   - `fetchQualitativeData`: Retrieves fundamental profile and joined theme contexts for a symbol.
   - `formatDebateContext`: Generates canonical 5-section debate prompt:
     - Section 1: `[QUANTITATIVE METRICS]`
     - Section 2: `[COMPANY FUNDAMENTAL BRIEF]`
     - Section 3: `[SECTOR & COMPETITIVE DYNAMICS]`
     - Section 4: `[RECENT MARKET EVENTS]`
     - Section 5: `[RESEARCH & NOTES]`
   - Prompt Grounding Rules: Mandates that Bull agents cite management guidance and thesis KPIs; Bear agents cite key risks and structural headwinds; Arbiter weighs tensions and balances conviction scores (-10 to +10).
   - Graceful Fallbacks: Unseeded or partially populated symbols degrade gracefully without throwing runtime errors.

5. **Observability & Fundamentals Dashboard Contract (F11, F12, F13)**:
   - `GET /api/fundamentals/status`: Watchlist status calculation returning active, stale, or missing status.
   - Freshness Rules: `< 90 days` => Active (🟢), `≥ 90 days` => Stale (🟡), `null` / unseeded => Missing (🔴).
   - `GET /api/fundamentals?symbol=XYZ`: Detailed brief and theme context lookup with 400 Bad Request on empty parameter.
   - Copy Prompt Generator: Generates markdown prompt for Gemini Notebook instructing the extraction of `save_fundamental_brief` parameters with document-derived `as_of_date`.

6. **ARM Golden Seed Flow (F14)**:
   - End-to-end ingestion and retrieval of ARM Q1 FY27 brief (`as_of_date: 2026-07-29`) and SemiAnalysis AI & Compute Dynamics theme (`theme_semianalysis_01`).
   - Verified rich grounding in 5-section context including v9 architecture royalty KPIs, operating margin expansion targets (>45%), and advanced packaging bottlenecks (TSMC CoWoS).

---

## 4. Test Suite Architecture & File Layout

```
tests/e2e/
├── vitest.config.ts            # Vitest config with Node environment and alias resolution
├── contracts/
│   └── contracts.ts            # Opaque-box contracts, Zod schemas, in-memory D1/R2 harnesses
├── fixtures/
│   ├── armSeed.ts              # ARM golden brief and SemiAnalysis theme fixtures
│   └── mockData.ts             # Diverse stock fixtures (NVDA, INTC, MarketStats)
├── tier1-features.test.ts      # 70 tests: F1-F14 Feature Coverage (Category-Partition)
├── tier2-boundaries.test.ts    # 70 tests: F1-F14 Boundary Value Analysis & Corner Cases
├── tier3-combinations.test.ts  # 15 tests: Cross-Feature Pairwise Combinations
└── tier4-scenarios.test.ts     # 8 tests: Real-World Scenarios & Multi-Step Lifecycles
```

The test harness is self-contained, isolated, and deterministic, ready to validate implementation code as milestone implementations (M1–M5) progress.
