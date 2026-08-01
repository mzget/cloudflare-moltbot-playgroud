# ADR 0003: Manual Price Refresh & Force Market Stats Fetch

- **Status**: Accepted
- **Date**: 2026-08-01
- **Deciders**: User & Oaktree Development Team

---

## Context & Problem Statement

To validate the **"Last Update"** timestamp display in the portfolio holdings table, developers and users need a way to manually trigger market price synchronization on demand.

Previously, `fetchAndStoreMarketStats` checked `isUSMarketOpen()` and skipped fetching quotes when the market was closed (outside 9:30–16:30 ET Mon–Fri). This prevented testing and validating price/timestamp updates during weekends and off-market hours.

---

## Decision Drivers

- **Validation & Testing**: Allow instant manual price sync regardless of market opening hours.
- **Global Portfolio Control**: Provide an intuitive, right-aligned action button on the Portfolio page to refresh price data on demand.
- **API Guard Preservation**: Retain automatic cron market open logic while allowing explicit manual force-overrides.

---

## Grilling & Design Decisions

Through an interactive grilling session, the following choices were agreed upon:

1. **Backend Force Parameter**: `GET /api/test-market-stats` accepts a `?force=true` query parameter, which passes `{ force: true }` to `fetchAndStoreMarketStats`.
2. **Override Logic**: When `force` is `true`, `shouldFetchQuote` evaluates to `(marketOpen || force) && !metricsOnly`, bypassing the `isUSMarketOpen()` restriction.
3. **Global UI Placement**: Add a right-aligned **"Refresh Prices"** button on the top tab row of `YahooPortfolio.tsx` (aligned opposite the tab buttons).
4. **User Feedback**: The button displays a rotating `RotateCw` icon and loading state while the price sync request is in flight, then automatically reloads portfolio holdings.

---

## Decision Outcome

Selected **`?force=true` query parameter + Global Right-Aligned Refresh Prices Button**.

### Implementation Steps

1. **Backend (`backend/src/marketData.ts` & `backend/src/index.ts`)**:
   - Extend `MarketStatsOptions` with `force?: boolean`.
   - Allow quote fetching when `force` is true.
   - Update `/api/test-market-stats` endpoint to read `force` from request query.
2. **Frontend (`frontend/src/components/features/portfolio/YahooPortfolio.tsx`)**:
   - Render a right-aligned button in the tabs header section.
   - Execute `GET /api/test-market-stats?force=true` on click and trigger `fetchAll()`.

### Consequences

- **Positive**:
  - Instant manual price testing and validation during off-market hours.
  - Seamless UX for updating portfolio holdings on demand.
- **Negative**:
  - Finnhub API quota must be kept in mind during frequent manual force triggers.
