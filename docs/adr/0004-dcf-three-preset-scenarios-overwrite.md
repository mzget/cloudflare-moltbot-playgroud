# 4. DCF Valuation Model: 3 Preset Scenarios with Overwrite Persistence

Date: 2026-08-03

## Status

Accepted

## Context

Previously, the Discounted Cash Flow (DCF) Valuation Model allowed users to type an arbitrary scenario name into a free-text input field and save it. Every save operation appended a new row to the `dcf_calculations` Cloudflare D1 table. This led to unbounded history rows per stock, ambiguity around preset scenarios (`Base Case`, `Bear Case`, `Bull Case`), and confusion regarding whether a specific scenario had already been evaluated.

## Decision

We decided to structure DCF scenario modeling around 3 fixed preset scenarios per stock symbol:
1. `Base Case` (Default)
2. `Bear Case`
3. `Bull Case`

Key architectural decisions:
- **Overwrite Persistence**: Each stock (`symbol`) maintains at most 1 saved record per scenario name in `dcf_calculations`. Saving a scenario executes a `DELETE` for `(symbol, scenario_name)` prior to inserting the updated parameter set.
- **Unvalued Zero-State UX**: If a scenario has not yet been saved for a stock, selecting it displays zeroed inputs and an "Unvalued" indicator rather than auto-populating arbitrary baseline defaults. This ensures users clearly distinguish between saved evaluations and unvalued states.
- **Bidirectional UI Synchronization**: Top Preset Switcher buttons and the bottom Save Scenario Dropdown (`<Select>`) are synchronized to control the active scenario.
- **Status Indicators**: Visual badges (e.g. `🟢 $245.50` vs `⚪ ยังไม่ได้ประเมิน`) indicate saved status at a glance.

## Consequences

- Prevents database bloat and simplifies scenario queries for each symbol.
- Improves UX clarity by guaranteeing users explicitly know which scenarios have been calculated and saved.
- Preserves clean API contracts for `GET /api/analysis/dcf-history` and `POST /api/analysis/dcf-save`.
