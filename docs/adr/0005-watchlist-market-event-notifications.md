# ADR 0005: Watchlist Market Event Notifications & UI Badging

- **Status**: Accepted
- **Date**: 2026-08-06
- **Deciders**: Oaktree Development Team & User

---

## Context & Problem Statement

Users tracking stock symbols in their Watchlist need timely, automatic notifications regarding critical corporate and market events occurring on the current trading day—specifically Earnings announcements, Dividend ex-dates, and Stock splits—so they can stay informed without having to manually inspect external calendars.

---

## Decision Drivers

- **Targeted Notification Channel**: Focus initial release on In-App Notifications (`in_app_notifications`) to keep the user informed within the web platform without external notification noise.
- **Automated Daily Trigger**: Integrate event detection seamlessly into the existing Cloudflare Worker sync workflow (`fetchAndStoreMarketEvents` / `OAKTREE_SYNC_WORKFLOW`).
- **Deduplication**: Guarantee that a given `(symbol, event_type, event_date)` pair generates at most one notification per day across hourly/6-hourly sync runs.
- **Enhanced UI Visibility**: Complement in-app notifications with visual "TODAY EVENT" badges in the Watchlist table and Event Calendar view.

---

## Considered Options

1. **Option 1: In-App Notifications + Morning Email Digest + Telegram Alerts**
   - *Drawback*: Increased complexity and email noise before in-app feature usage is validated.
2. **Option 2: In-App Notifications Only + Watchlist & Calendar UI Badges (Selected)**
   - *Advantage*: High-value, zero-clutter solution seamlessly integrated into the current frontend and backend architecture.
3. **Option 3: Pure UI Badging (No Notifications)**
   - *Drawback*: Fails to notify users who rely on the header notification bell.

---

## Decision Outcome

Selected **Option 2**.

### Consequences

- **Backend**:
  - `fetchAndStoreMarketEvents` (or attached step) queries today's `market_events` for active Watchlist symbols.
  - Inserts deduplicated notification rows into `in_app_notifications` with structured messages for `earnings`, `dividend`, and `split`.
- **Frontend**:
  - Notification drawer displays daily market event alerts with event icons.
  - Watchlist table and Event Calendar highlight symbols that have market events occurring today.
