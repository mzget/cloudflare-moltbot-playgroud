# Watchlist Breakouts: Watchlist-Only Scope, Today-Only Horizon, and Proximity Matrix

We decided to restrict the Market Breakouts subsystem strictly to the user's active Watchlist symbols, constrain the operational horizon to a live Today-only scope (removing arbitrary historical date queries), and introduce a dual-view UI consisting of Today's Active Breakouts and a Watchlist Proximity Matrix.

## Context
Previously, the system attempted to support full US market scans across 25,000+ tickers and historical date queries. This introduced high data processing overhead, API rate limiting risks, and clutter without aligning with the user's actual workflow. Additionally, breakout detection was limited to 52-week High/Low, neglecting All-Time Highs (ATH) and All-Time Lows (ATL).

## Decision & Trade-offs
1. **Watchlist-Only Scope**: Breakout scanning and tracking are strictly confined to active Watchlist stocks (`is_active = 1`). We consciously reject scanning the broader market to preserve performance, reduce network payload, and avoid noise from penny stocks or irrelevant tickers.
2. **Today-Only Horizon**: The UI operates exclusively as a live, real-time dashboard for today. We remove the historical date picker to keep the interface focused and eliminate the need for storing daily proximity snapshots for every stock.
3. **Four-Tier Boundary Classification & Exclusive Hierarchy**: The system detects `ath`, `52w_high`, `52w_low`, and `atl`. Lifetime milestones take strict precedence over 52-week milestones (`ath` > `52w_high`, `atl` > `52w_low`) to avoid double counting.
4. **Watchlist Proximity Matrix**: A full matrix of all active watchlist stocks calculates `% From High` and `% From Low`. Any stock trading within a 3.0% buffer of an extreme boundary is flagged as a "Near Breakout" (`near_ath`, `near_52w_high`, `near_52w_low`, `near_atl`).
