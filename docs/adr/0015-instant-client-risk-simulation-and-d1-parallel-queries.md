# 15. Instant 0ms Client-Side Position Sizing Simulation, Shared Risk Engine Deduplication, and D1 Parallel Queries

Date: 2026-10-24

## Status

Accepted

## Context

Following the completion of Phase 4 (`Risk Manager & Position Sizing Agent`), three technical and UX friction points were identified:

1. **Network Round-Trip on Every Simulator Keystroke**: In `RiskSizingTab.tsx`, changing the symbol, trade type (`Buy`/`Sell`), share count, or price in the Position Sizing & Pre-Trade Simulator triggered an asynchronous `POST /api/portfolio/position-sizing` request on every change. Because `@oaktree/shared` already encapsulates deterministic, side-effect-free pure functions (`calculateFixedBasePositionSize` and `simulatePreTradeImpact`), network round-trips for interactive UI simulation were unnecessary.
2. **Duplicate Risk Engine Implementation**: `backend/src/portfolioRisk.ts` maintained an ~800-line duplicate copy of `packages/shared/src/portfolioRisk.ts`, creating a risk of behavioral drift between `backend`, `mcp-worker`, and `frontend`.
3. **Sequential D1 Queries in Risk Audit Data Loading**: Both `loadPortfolioRiskData` (`backend/src/routes/portfolio/risk.ts`) and `queryPortfolioRiskData` (`mcp-worker/src/riskTools.ts`) executed 6 sequential D1 queries, even though 5 of the 6 queries (`holdings`, `themes`, `dcf_calculations`, `stock_fundamentals`, and `portfolio_risk_advisories`) are mutually independent.

## Decision

1. **Instant 0ms Client-Side Simulation via `@oaktree/shared`**:
   - `GET /api/portfolio/risk-audit` (and MCP `get_portfolio_risk_audit`) now includes `themeMappings` alongside `concentration`, `correlation`, `health`, `holdingsSizing`, and `latestAdvisory`.
   - `RiskSizingTab.tsx` computes `currentSizing` (`calculateFixedBasePositionSize`) and `currentSimulation` (`simulatePreTradeImpact`) synchronously at `0ms` inside `React.useMemo` using `auditData.concentration` and `auditData.themeMappings` (falling back to deriving symbol-to-theme mappings from `concentration.themeExposures` when `themeMappings` is omitted).
   - This ensures that even a custom/new ticker (`+ Enter Custom / New Ticker...`) not yet held in the portfolio—but already mapped to a Theme Notebook in `theme_symbol_mappings`—immediately respects the 30% Strictest Theme Cap at `0ms`.
   - The manual `"Calculate Sizing Room"` submit button in `RiskSizingTab.tsx` is replaced with a `"Reset"` button that restores default simulation inputs (`orderType = 'Buy'`, `orderShares = '10'`, and `orderPrice` to the selected symbol's `lastPrice`).
   - `POST /api/portfolio/position-sizing` remains supported on the backend for API compatibility.

2. **Single Source of Truth in `@oaktree/shared`**:
   - `backend/src/portfolioRisk.ts` is reduced to a thin barrel re-export (`export * from '@oaktree/shared';`), eliminating ~780 lines of duplicated code across workspaces.

3. **Two-Stage Parallel D1 Query Execution (`Promise.all`)**:
   - In both `backend/src/routes/portfolio/risk.ts` (`loadPortfolioRiskData`) and `mcp-worker/src/riskTools.ts` (`queryPortfolioRiskData`), the 5 independent queries (`holdings`, `themes`, `dcf_calculations`, `stock_fundamentals`, and `portfolio_risk_advisories`) execute concurrently via `Promise.all([...])` in Stage 1, followed by the `historical_prices` query in Stage 2 (which binds the open holding symbols returned from Stage 1).

## Consequences

- **Positive**: `0ms` instantaneous feedback on every keystroke in the Position Sizing & Pre-Trade Simulator; zero network chatter while adjusting share counts or prices; ~60% reduction in D1 query round-trips on `/api/portfolio/risk-audit` and MCP `get_portfolio_risk_audit`; single canonical risk engine in `@oaktree/shared`.
- **Negative**: `GET /api/portfolio/risk-audit` payload increases by a few hundred bytes to include `themeMappings`, which is negligible.
