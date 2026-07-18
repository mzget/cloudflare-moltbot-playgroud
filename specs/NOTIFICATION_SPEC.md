# Technical Specification: In-App Notifications & Alerts System

This document outlines the architecture, database tables, API routing, and frontend components of the **In-App Notifications and Custom Alert Rules** system within the Oaktree Agent codebase.

---

## 1. Overview

The notification system alerts users to key events:
1. **Technical Milestones (Breakouts/Breakdowns)**: Automatically detected 52-week highs/lows and All-Time Highs/Lows (ATH/ATL) for symbols on the user's watchlist.
2. **Custom Alert Rules**: Rules defined by the user for watchlist symbols on specific metrics (Price, Market Cap, P/E, EV/EBIT, EV/Sales) which trigger when crossing up or down.

---

## 2. Architecture & Components

*   **Backend Implementation:**
    *   [alerts.ts](file:///c:/Users/natta/Documents/oaktree-agent/backend/src/alerts.ts): Implements `checkAlertRules` evaluating custom metrics against the latest `market_stats` database records, generating notification logs when crossover occurs.
    *   [marketData.ts](file:///c:/Users/natta/Documents/oaktree-agent/backend/src/marketData.ts) & [marketScanner.ts](file:///c:/Users/natta/Documents/oaktree-agent/backend/src/marketScanner.ts): Detect technical breakouts and insert once-per-day notifications.
    *   [index.ts](file:///c:/Users/natta/Documents/oaktree-agent/backend/src/index.ts): Defines Hono routes to fetch, update, and clear notifications, as well as manage alert rules.
*   **Frontend Implementation:**
    *   [Header.tsx](file:///c:/Users/natta/Documents/oaktree-agent/frontend/src/components/layout/Header.tsx): Displays the notification bell, unread badge count, and notifications dropdown panel. Includes adaptive polling and GSAP-powered popover animations.
    *   [Watchlist.tsx](file:///c:/Users/natta/Documents/oaktree-agent/frontend/src/components/features/watchlist/Watchlist.tsx): Renders the Alert Manager Modal for creating, toggling, and deleting alert rules for specific symbols.

---

## 3. Database Schema

The notification feature depends on two main tables in the D1 SQLite database (defined in [0008_add_alert_rules_and_price.sql](file:///c:/Users/natta/Documents/oaktree-agent/backend/migrations/0008_add_alert_rules_and_price.sql)):

### A. `alert_rules`
Stores the customized alert thresholds configured by the user.
```sql
CREATE TABLE IF NOT EXISTS alert_rules (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  symbol TEXT NOT NULL,
  metric TEXT NOT NULL, -- 'price' | 'market_cap' | 'p_e' | 'ev_ebit' | 'ev_sales'
  condition_type TEXT NOT NULL, -- 'cross_up' | 'cross_down'
  target_value REAL NOT NULL,
  last_checked_value REAL,
  last_checked_state TEXT, -- 'above' | 'below'
  is_active INTEGER DEFAULT 1,
  created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
  updated_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now'))
);
```

### B. `in_app_notifications`
Stores individual triggered alerts and technical breakout notifications.
```sql
CREATE TABLE IF NOT EXISTS in_app_notifications (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  symbol TEXT NOT NULL,
  metric TEXT NOT NULL, -- e.g., 'price', '52w_high', 'ath'
  condition_type TEXT NOT NULL, -- 'breakout' | 'breakdown' | 'cross_up' | 'cross_down'
  target_value REAL,
  trigger_value REAL,
  message TEXT NOT NULL,
  is_read INTEGER DEFAULT 0,
  created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now'))
);

CREATE INDEX IF NOT EXISTS idx_in_app_notifications_unread ON in_app_notifications(is_read, created_at DESC);
```

---

## 4. API & Routing

To avoid ad-blockers (`net::ERR_CONNECTION_CLOSED` errors) in production environments, routing names have been modernized to avoid words matching `notifications` or `alerts`.

### Endpoints (Hono Router)

| Method | Route | Description |
| :--- | :--- | :--- |
| `GET` | `/api/triggered-alerts` | Retrieves the top 50 notifications sorted by creation date. |
| `PUT` | `/api/triggered-alerts` | Marks a notification as read (if `id` is supplied in body) or marks all as read. |
| `DELETE` | `/api/triggered-alerts` | Deletes all read notifications. |
| `GET` | `/api/alerts` | Fetches custom alert rules for a specific `symbol` (passed as query param). |
| `POST` | `/api/alerts` | Creates a new alert rule. |
| `PUT` | `/api/alerts/:id` | Toggles or updates an alert rule state. |
| `DELETE` | `/api/alerts/:id` | Deletes an alert rule. |

---

## 5. Key Design Principles & Frontend Solutions

### A. Ad-Blocker Resilience
Routes originally using `/api/notifications` or `/api/in-app-notifications` were blocked by ad-blocker lists in production. Changing the routes to `/api/triggered-alerts` bypassed these blockers.

### B. Header Z-Index Layering
To prevent the notifications dialog from rendering underneath sticky components, sidebars, or tables, the header container has positioning overrides:
- `position: 'relative'`
- `zIndex: 1100`

### C. Adaptive Polling Mechanism
To keep CPU/network resource consumption low, `Header.tsx` employs an adaptive polling interval:
- **Tab Hidden (`document.hidden`)**: Polling is completely paused.
- **Open Panel**: Polls once every 5 minutes (user is actively inspecting).
- **All Read (0 unread count)**: Polls once every 2 minutes.
- **Active Unread**: Polls once every 30 seconds to catch new alerts.
- **Visibility Transition**: Triggers an immediate catch-up fetch when switching tabs back to active.