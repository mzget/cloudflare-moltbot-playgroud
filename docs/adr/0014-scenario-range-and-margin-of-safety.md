# 14. Scenario Range Bar & Margin of Safety Screener

Date: 2026-10-24

## Status

Accepted

## Context

DCF scenarios (Bear/Base/Bull) are persisted per symbol (ADR-0004) but are only visible one at a time in the DCF tab. Users cannot see where the live price sits relative to all scenarios, and cannot screen Watchlist/Portfolio by valuation.

## Decision

1. **MoS definition**: `MoS % = (Intrinsic - Price) / Intrinsic * 100`, anchored on the saved Base Case `implied_share_price`. Upside % (`/ Price`) is unchanged.
2. **Unvalued**: no saved Base Case -> `mos_base = NULL` (never 0). Excluded from MoS filters except the "Unvalued" chip.
3. **Scenario Range Bar**: one bar with Bear/Base/Bull markers + current price, zone colors, and MoS per scenario. Shown in the DCF tab and Stock Detail.
4. **Screener**: no new page. Add an MoS column + mini-bar to the existing Watchlist and Portfolio Holdings tables, with filter chips (MoS >= 30%, >= 15%, Overvalued, Unvalued) and sorting.
5. **Persisted MoS (stored, not derived at read time)**: new columns on `market_stats`: `dcf_bear`, `dcf_base`, `dcf_bull`, `mos_base`, `price_zone`, `mos_updated_at`. A pure function `computeMarginOfSafety(price, bear, base, bull)` is the single source of truth. It is recomputed:
   - at the end of each price sync (`fetchAndStoreMarketStats`), using one batched `dcf_calculations` query for the synced symbols;
   - immediately after `POST /api/analysis/dcf-save`, for that symbol, using its last known price.

## Consequences

- List endpoints (Watchlist/Portfolio) just read columns: no joins or N+1 at read time, and SQL filtering/sorting by `mos_base` is possible.
- Denormalized data can go stale if a recompute path is missed (e.g. a symbol whose price never syncs). `mos_updated_at` makes staleness visible.
- Portfolio holdings that are not in the Watchlist display "n/a" for MoS; no extra `market_stats` rows are created for them. "n/a" is distinct from "Unvalued" (a Watchlist stock with no saved Base Case).
