# Technical Specification: Watchlist Breakout Scanner & Proximity Tracking

This document defines the architecture, database integration, API interaction, and frontend components of the **Watchlist Breakout Scanner** and **Proximity Matrix** features in the Oaktree Agent codebase.

---

## 1. Overview

To track extreme boundary price milestones (All-Time High/Low, 52-Week High/Low) and monitor proximity for active watchlist stocks without incurring high data-fetching overhead, the system queries the free, public TradingView Scanner API scoped specifically to the user's active Watchlist (`is_active = 1`).

* **Core Goal:** Scan active watchlist stocks in a single request, classify breakout events (`ath`, `52w_high`, `52w_low`, `atl`) using exclusive hierarchy, and generate a real-time proximity matrix.
* **Notification System:** Alert users via in-app notifications and record-breaker events when watchlisted stocks break confirmed lifetime or 52-week boundaries (deduplicated to at most once per symbol/event per day).
* **Horizon:** Real-time, Today-only live scope.

---

## 2. Architecture & Components

* **Backend Implementation:**
  * [marketScanner.ts](file:///c:/Users/natta/Documents/antigravity/oaktree-agent/backend/src/marketScanner.ts): Primary business logic for querying TradingView, classifying breakouts with exclusive precedence, calculating proximity distances, persisting records to D1, and triggering deduplicated in-app notifications.
  * [marketScanner.test.ts](file:///c:/Users/natta/Documents/antigravity/oaktree-agent/backend/src/marketScanner.test.ts): Unit tests verifying distance calculations, exclusive hierarchy (`ath` > `52w_high`, `atl` > `52w_low`), 3% near-breakout threshold detection, and matrix assembly.
  * [index.ts](file:///c:/Users/natta/Documents/antigravity/oaktree-agent/backend/src/index.ts): Defines `GET /api/watchlist-breakouts` (and `/api/market-breakouts`) and `POST /api/scan-watchlist` (and `/api/scan-market`).
  * [workflow.ts](file:///c:/Users/natta/Documents/antigravity/oaktree-agent/backend/src/workflow.ts): Background workflow step executing the watchlist breakout scanner.
* **Frontend Implementation:**
  * [Watchlist.tsx](file:///c:/Users/natta/Documents/antigravity/oaktree-agent/frontend/src/components/features/watchlist/Watchlist.tsx): Tabbed container hosting "My Watchlist" and "Watchlist Breakouts".
  * [MarketBreakouts.tsx](file:///c:/Users/natta/Documents/antigravity/oaktree-agent/frontend/src/components/features/watchlist/MarketBreakouts.tsx): Dual-view dashboard displaying Today's Active Breakouts cards, sentiment breadth bar, and the complete Watchlist Proximity Matrix.
  * [DebouncedInput.tsx](file:///c:/Users/natta/Documents/antigravity/oaktree-agent/frontend/src/components/common/DebouncedInput.tsx): Debounce wrapper for text input to smoothly filter matrix entries without UI lag.

---

## 3. Database Schema

### A. `market_breakouts`
Stores breakout events detected during scans for today.
```sql
CREATE TABLE market_breakouts (
  symbol TEXT NOT NULL,
  name TEXT,
  price REAL,
  percent_change REAL,
  year_high REAL,
  year_low REAL,
  breakout_type TEXT NOT NULL,   -- 'ath', '52w_high', '52w_low', 'atl'
  scan_date TEXT NOT NULL,       -- 'YYYY-MM-DD'
  all_time_high REAL,
  all_time_low REAL,
  PRIMARY KEY (symbol, breakout_type, scan_date)
);
```

### B. `in_app_notifications`
Stores in-app alerts when a stock hits a confirmed extreme.
```sql
CREATE TABLE in_app_notifications (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  symbol TEXT NOT NULL,
  metric TEXT NOT NULL,          -- 'ath', '52w_high', '52w_low', 'atl'
  condition_type TEXT NOT NULL,  -- 'breakout' | 'breakdown'
  target_value REAL,
  trigger_value REAL,
  message TEXT NOT NULL,
  is_read INTEGER DEFAULT 0,
  created_at INTEGER NOT NULL
);
```

### C. `record_breaker_events`
Tracks unique record-breaker logs to prevent duplicate notifications for the same symbol/event on the same day.
```sql
CREATE TABLE record_breaker_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  symbol TEXT NOT NULL,
  event_type TEXT NOT NULL,      -- 'ath', '52w_high', '52w_low', 'atl'
  price REAL NOT NULL,
  previous_record REAL NOT NULL,
  event_date DATE NOT NULL,
  is_notified INTEGER DEFAULT 0,
  created_at INTEGER NOT NULL
);
```

---

## 4. API Details

### TradingView Scanner Endpoint
* **URL:** `https://scanner.tradingview.com/america/scan`
* **Method:** `POST`
* **Headers:**
  ```json
  {
    "Content-Type": "application/json",
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
  }
  ```

### Watchlist Request Payload
```json
{
  "columns": [
    "name",
    "description",
    "close",
    "change",
    "price_52_week_high",
    "price_52_week_low",
    "High.All",
    "Low.All"
  ],
  "filter": [
    {
      "left": "name",
      "operation": "in_range",
      "right": ["NVDA", "AAPL", "MSFT"]
    }
  ]
}
```

---

## 5. Classification & Precedence Rules

### Exclusive Precedence
1. **ATH (`ath`)**: `price >= ath` (Takes strict precedence over 52W High; never double-counted).
2. **ATL (`atl`)**: `price <= atl` (Takes strict precedence over 52W Low; never double-counted).
3. **52W High (`52w_high`)**: `price >= year_high` (only if price < ath).
4. **52W Low (`52w_low`)**: `price <= year_low` (only if price > atl).

### Imminent Near-Breakout Buffer (3.0%)
Stocks within 3% of extreme levels are flagged visually in the Proximity Matrix:
* **Near ATH (`near_ath`)**: `-3.0% <= % From ATH < 0%`
* **Near 52W High (`near_52w_high`)**: `-3.0% <= % From 52W High < 0%` (and not Near ATH)
* **Near 52W Low (`near_52w_low`)**: `0% < % From 52W Low <= +3.0%` (and not Near ATL)
* **Near ATL (`near_atl`)**: `0% < % From ATL <= +3.0%`
* *Note:* Imminent candidates do NOT trigger In-App notifications.

---

## 6. Frontend Integration

* **Tab:** "Watchlist Breakouts" in the Watchlist view (`/watchlist`).
* **Components:**
  * **Today's Active Breakouts:** 4 summary cards (`ATH`, `52W High`, `52W Low`, `ATL`) + Market Breadth Bar + list of today's triggered stocks.
  * **Watchlist Proximity Matrix:** Full table of all active watchlist stocks with real-time `% From 52W High`, `% From ATH`, `% From 52W Low`, `% From ATL`, and status badges.
  * **Action Controls:** "Scan Watchlist" on-demand refresh button with loading state.
