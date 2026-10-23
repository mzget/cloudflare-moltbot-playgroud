# 13. Portfolio Risk Manager, Position Sizing Engine, and Analysis Navigation

Date: 2026-10-23

## Status

Accepted

## Context

Phase 4 of the Oaktree Multi-Agent Roadmap introduces an institutional-grade **Risk Manager & Position Sizing Agent** inspired by Howard Marks' risk control philosophy. Because Oaktree tracks both US equities (`holdings` in USD) and Thai mutual funds/cash (`fund_allocations` in THB), and maps equities to multiple research themes via `theme_symbol_mappings`, clear architectural rules were required for:

1. **Portfolio Denominator & Sizing Math**: Determining whether concentration percentages and buyable room use the USD stock portfolio or total multi-currency assets, and whether new buy simulations use a fixed or expanding denominator.
2. **Theme Concentration & Multi-Theme Binding**: Handling stocks mapped to multiple themes in `theme_symbol_mappings` as well as stocks without any assigned theme (`Unassigned`).
3. **Cross-Module Navigation Consistency**: Allowing investors inspecting the `Holdings Risk Concentration & Sizing Capacity` table to jump directly into the stock's deep analysis report (`/analysis?symbol=XYZ&tab=report`) with visual visibility into existing analysis coverage (Report, DCF, Thesis count), matching the UX of `HoldingsTable` and `CompanyStatsTable`.

## Decision

1. **Stocks Only (USD) Fixed Denominator**:
   - All concentration weights and position sizing capacities are calculated strictly against the current **Stocks Only (USD)** market value (`totalStockPortfolioUsd`).
   - Sizing room uses the **Fixed Current Portfolio Value** formula (`Target = 8.0%`, `Single-Stock Warning = 10.0%`, `Max Single-Stock Cap = 15.0%`, `Theme Warning = 25.0%`, `Max Theme Cap = 30.0%`).

2. **Multi-Theme Exposure & Strictest Theme Binding**:
   - Theme concentration uses `theme_symbol_mappings` joined with `theme_sector_contexts`.
   - A stock mapped to multiple themes contributes its weight to each mapped theme.
   - Maximum buyable capacity (`maxAllowedBuyUsd`) is constrained by the **Strictest Theme** (the mapped theme with the highest current portfolio weight %). Stocks in `Unassigned` are exempt from the 30% Theme Cap.

3. **1-Year (252 Trading Days) Correlation & Beta**:
   - Pairwise Pearson correlations ($r \ge 0.70$) and stock/portfolio Beta vs. `^GSPC` are computed from cached daily closes in `historical_prices` over a 252-trading-day window.

4. **Symbol Link & Analysis Coverage Badge in Risk Concentration Table**:
   - In `RiskSizingTab.tsx`, the `Symbol` column of the `Holdings Risk Concentration & Sizing Capacity` table renders an interactive MUI Joy UI `<Link component="button">` alongside the `useAnalysisCoverage` `<Chip>` badge (`<FileBarChart />`), navigating directly to `/analysis?symbol=XYZ&tab=report`.

## Consequences

- **Positive**: Predictable, currency-neutral position sizing in USD; thematic concentration awareness directly connected to Gemini Notebook themes; seamless one-click navigation from portfolio risk monitoring into stock-level fundamental & DCF analysis.
- **Negative**: Multi-theme percentages intentionally sum to more than 100% when holdings belong to overlapping themes, which is clarified in the UI and chart views.
