# ADR 0009: Gemini Spark DCF Valuation Scenarios MCP Integration

- **Status**: Accepted
- **Date**: 2026-10-08
- **Deciders**: Oaktree Development Team & User

---

## Context & Problem Statement

Value investors utilize Google Gemini Spark (and Gemini App) workflows to process SEC 10-K and 10-Q financial filings, formulating 5-year Discounted Cash Flow (DCF) models across 3 preset scenarios (`Base Case`, `Bull Case`, `Bear Case`). 

Previously:
1. The Oaktree DCF subsystem only supported manual UI slider adjustments and saves via `POST /api/analysis/dcf-save`.
2. External AI agents had no standardized MCP tool to ingest calculated DCF valuation parameters or retrieve existing models.
3. The `dcf_calculations` table lacked a dedicated column to store the underlying qualitative thesis/rationale (`rationale`) explaining *why* specific growth rates and margins were chosen.
4. There was no source attribution (`source`) to distinguish between human-adjusted scenarios and AI-generated valuations.

The system requires an MCP-driven bidirectional bridge to ingest, inspect, and safely persist 3-preset DCF models from external agents into Cloudflare D1.

---

## Decision Drivers

- **Batch Ingestion & Atomic Persistence**: Saving all 3 preset scenarios (`Base Case`, `Bull Case`, `Bear Case`) in a single MCP tool call (`save_dcf_scenarios`) prevents partial or incomplete state when LLMs fail midway.
- **Overwrite Protocol (ADR 0004)**: Each stock (`symbol`) maintains exactly at most 1 saved record per scenario name in `dcf_calculations`. Ingestion must execute atomic batch `DELETE` and `INSERT` statements in D1.
- **Smart Mathematical & Unit Guardrails**:
  - `shares_outstanding` and `target_shares` must strictly be in **Millions ($M$)** (e.g. `15000` for 15 Billion shares). Input values $< 50$ are blocked with clear actionable errors to prevent catastrophic 1,000x valuation errors.
  - Perpetual growth rate sanity check: enforce $\text{WACC} > \text{terminal\_growth}$ to prevent zero or negative denominators in the Gordon Growth terminal value formula.
- **Bi-directional Inspection**: External agents must be able to inspect existing DCF valuations (`get_dcf_model`) alongside current market price and upside/downside percentages, as well as discover all evaluated stocks (`list_dcf_symbols`).
- **Attribution & Qualitative Reasoning**: Persist `rationale` (thesis/assumptions) and `source` (`'gemini_spark'`, `'manual'`) in `dcf_calculations`, surfacing them directly on the Oaktree frontend DCF screen.
- **Optional Target Price Sync**: Provide an explicit opt-in parameter `sync_target_price` to automatically synchronize the Base Case intrinsic price to the user's `watchlist` table.

---

## Architecture & Implementation

### 1. Database Schema Extension (`dcf_calculations`)
Migration `0040_add_rationale_and_source_to_dcf_calculations.sql` introduces:
- `rationale TEXT`: Textual summary of business assumptions, catalysts, and reasoning behind the 5-year forecast.
- `source TEXT DEFAULT 'manual'`: Attribution tag identifying who created the scenario (`'gemini_spark'`, `'gemini_app'`, `'manual'`).

### 2. Cloudflare Worker MCP Tools (`mcp-worker`)
Registered in `OaktreeMCP` within `mcp-worker/src/mcpAgent.ts` backed by `mcp-worker/src/dcfTools.ts`:
- **`save_dcf_scenarios`**:
  - Validates array of 1-3 scenarios with Zod.
  - Applies unit guardrails and mathematical sanity checks.
  - Executes atomic D1 batch operations (`DELETE` old + `INSERT` new per scenario).
  - Conditionally syncs Base Case price to `watchlist.target_price` if `sync_target_price: true`.
- **`get_dcf_model`**:
  - Queries `dcf_calculations` for the given `symbol`.
  - Joins latest price from `market_stats`.
  - Computes `upside_downside_pct` and `margin_of_safety_pct` for each scenario.
- **`list_dcf_symbols`**:
  - Returns distinct symbols with saved DCF scenarios, their latest intrinsic prices, and last updated timestamps.

### 3. Backend REST API Alignment (`backend/src/routes/analysis.ts`)
- Updated `POST /api/analysis/dcf-save` to accept and persist `rationale` and `source`.
- `GET /api/analysis/dcf-history` automatically exposes `rationale` and `source` to the frontend.

### 4. Frontend DCF UX (`DCFModel.tsx`)
- Displays an AI Attribution Badge (e.g. `🤖 Gemini Spark` or `👤 Manual`).
- Renders an interactive **Scenario Rationale & Thesis Card** allowing the user to view AI insights and edit notes before re-saving.

---

## Consequences

- **Reliability**: LLM math and unit hallucinations are prevented at the API boundary before dirty data can reach D1.
- **Transparency**: Value investors can review both quantitative DCF sliders and qualitative thesis notes in one unified interface.
- **Interoperability**: Gemini Spark can perform end-to-end autonomous research: read 10-K filings, compute DCF, check existing valuations via `get_dcf_model`, and persist the result via `save_dcf_scenarios`.

