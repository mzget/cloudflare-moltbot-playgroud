# ADR 0002: Add Last Update Column to Fundamentals Dashboard Table

- **Status**: Accepted
- **Date**: 2026-08-01
- **Deciders**: User & Oaktree Development Team

---

## Context & Problem Statement

Users viewing the Fundamentals dashboard (`/dashboard?tab=fundamentals`) need clear visibility into when market statistics for each watchlisted stock were last updated by the market intelligence data sync.

Currently, `market_stats.updated_at` exists in the Cloudflare D1 database table, but:
1. The backend endpoint `GET /api/market-intelligence` does not select `m.updated_at`.
2. The frontend `CompanyStats` TypeScript interface and `CompanyStatsTable` component do not include a column definition or formatter for `updated_at` / `last_update`.

---

## Decision Drivers

- **User Clarity**: Allow users to verify data recency at a glance.
- **UI Customization**: Maintain compatibility with user column toggles (`CompanyStatsToolbar`) and density modes.
- **Consistent UX**: Follow existing table styling (MUI Joy UI `<Table>`, glassmorphism, tabular numbers) and sorting behavior.

---

## Grilling & Design Decisions

Through an interactive grilling session, the following choices were agreed upon:

1. **Cell Formatting**: Relative time string (e.g. `2h ago`, `1d ago`, `5m ago`) displayed in the table cell with a native HTML `title` tooltip displaying the full ISO timestamp (e.g., `2026-08-01 11:50:33 UTC`) on hover.
2. **Column Placement**: Positioned as the last column on the far right of `CompanyStatsTable` (following `ATL` / All Time Low).
3. **Default Visibility**: Included in `ALL_COLUMNS` so it appears in the toolbar and can be toggled by the user.
4. **Missing Values & Sorting**:
   - Missing/null `updated_at` renders as em dash (`—`).
   - Sorting by `updated_at` supports ascending (oldest first) and descending (newest first), placing null/undefined values at the bottom in both sort directions.

---

## Decision Outcome

Selected **Relative Time as Far-Right Column with Tooltip**.

### Implementation Steps

1. **Backend (`backend/src/index.ts`)**:
   - Update `SELECT` in `GET /api/market-intelligence` to include `m.updated_at as updated_at`.
2. **Frontend Types (`frontend/src/types/companyStats.ts`)**:
   - Add `updated_at?: string;` to `CompanyStats` interface.
3. **Frontend Table (`frontend/src/components/features/watchlist/CompanyStatsTable.tsx`)**:
   - Add `{ id: 'updated_at', label: 'Last Update', format: 'relative_date' }` as the last item in `ALL_COLUMNS`.
   - Implement `formatRelativeTime(isoString)` utility helper.
   - Update `formatValue` and cell renderer to show relative time with `title` tooltip for full timestamp.
   - Update sorting logic to handle string date comparisons for `updated_at`.

### Consequences

- **Positive**:
  - Users can immediately see when market statistics were updated for each ticker.
  - Full timestamp remains accessible on hover without cluttering table cell width.
- **Negative**:
  - Requires small update to backend D1 `SELECT` query payload.
