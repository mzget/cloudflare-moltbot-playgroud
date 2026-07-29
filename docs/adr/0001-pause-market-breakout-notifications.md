# ADR 0001: Pause Market Breakout Notifications

- **Status**: Accepted
- **Date**: 2026-07-29
- **Deciders**: Oaktree Development Team & User

---

## Context & Problem Statement

Users were receiving an excessive volume of in-app notifications whenever watchlisted stocks or market-wide stocks hit 52-week highs/lows or all-time highs/lows. This caused notification fatigue and degraded the core user experience.

However, the underlying market scanning functionality (`scanMarketBreakouts`) provides valuable data on price highs and lows for the UI dashboard tables (`market_breakouts`).

---

## Decision Drivers

- **User Experience**: Reduce notification noise while keeping real-time/batch market data visible in the application.
- **Dynamic Control**: Allow users to toggle notification sending ON/OFF on demand via the Command Center UI without requiring code redeployment.
- **Data Cleanup**: Provide an explicit mechanism to clear historic breakout notifications from the notification store.

---

## Considered Options

1. **Option 1: Complete Feature Shutdown**: Disable both market scanning and notification generation.
   - *Drawback*: UI dashboards lose breakout market statistics.
2. **Option 2: Stop Notifications Only with Dynamic Setting (Selected)**: Keep market scanning active, but check `system_settings` (`pause_market_breakout_notifications`) before inserting into `in_app_notifications` and `record_breaker_events`. Expose a toggle and clear action in Command Center.
3. **Option 3: Hardcoded Code Switch**: Hardcode a disable flag in TypeScript.
   - *Drawback*: Requires code deployment to re-enable or adjust.

---

## Decision Outcome

Selected **Option 2**.

### Consequences

- **Positive**:
  - Immediate stop of breakout notification clutter upon setting key `pause_market_breakout_notifications = '1'`.
  - Market data in `market_breakouts` table remains updated for display in UI tables/dashboards.
  - User can toggle notifications back ON anytime from the Command Center UI (`/command-center`).
  - Single-click cleanup endpoint `POST /api/settings/clear-breakout-notifications` removes historic breakout alerts.

- **Negative**:
  - Backend must execute a lightweight setting check during notification generation.
