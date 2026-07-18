# Technical Specification: TradingView Bulk Scanner & Stock Filtering

This document defines the architecture, database integration, API interaction, and frontend components of the **TradingView Bulk Scanner** and **Stock Filtering** features in the Oaktree Agent codebase.

---

## 1. Overview

To support tracking market breakouts (such as 52-week highs and lows) and seeding All-Time Highs (ATH) and All-Time Lows (ATL) without encountering rate-limit barriers or incurring costs, the system integrates the free, public TradingView Scanner API.
* **Core Goal:** Scan the US stock market (or watchlist) in a single request, filter out ETFs, mutual funds, and options, and persist breakout records in D1.
* **Notification System:** Alert users via in-app notifications and record-breaker events when watchlisted stocks hit new 52-week or all-time extremes.

---

## 2. Architecture & Components

* **Backend Implementation:**
  * [marketScanner.ts](file:///c:/Users/natta/Documents/oaktree-agent/backend/src/marketScanner.ts): The primary business logic for querying TradingView, filtering stock tickers, saving breakouts to D1, and triggering alerts.
  * [marketScanner.test.ts](file:///c:/Users/natta/Documents/oaktree-agent/backend/src/marketScanner.test.ts): Unit tests verifying scanner functionality, payload generation, and mock D1 insertions.
  * [index.ts](file:///c:/Users/natta/Documents/oaktree-agent/backend/src/index.ts): Defines the API endpoints for querying and running scans.
  * [workflow.ts](file:///c:/Users/natta/Documents/oaktree-agent/backend/src/workflow.ts): Schedules the scanner job to run automatically in background workflows.
* **Frontend Implementation:**
  * [MarketBreakouts.tsx](file:///c:/Users/natta/Documents/oaktree-agent/frontend/src/components/features/watchlist/MarketBreakouts.tsx): UI page displaying the breakdown of today's 52-week breakouts, including a gauge showing market breadth.
  * [DebouncedInput.tsx](file:///c:/Users/natta/Documents/oaktree-agent/frontend/src/components/common/DebouncedInput.tsx): Debounce wrapper for text input to prevent lags when filtering long lists of breakouts.

---

## 3. Database Schema

The feature utilizes three main tables in the D1 database:

### A. `market_breakouts`
Stores all breakout events detected during scans for historical view and frontend querying.
```sql
CREATE TABLE market_breakouts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  symbol TEXT NOT NULL,
  name TEXT,
  price REAL NOT NULL,
  percent_change REAL NOT NULL,
  year_high REAL NOT NULL,
  year_low REAL NOT NULL,
  breakout_type TEXT NOT NULL, -- '52w_high' | '52w_low'
  scan_date DATE NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

### B. `in_app_notifications`
Used to display alert banners in the frontend when a watchlisted stock triggers an event.
```sql
CREATE TABLE in_app_notifications (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  symbol TEXT NOT NULL,
  metric TEXT NOT NULL, -- e.g. '52w_high', '52w_low', 'ath', 'atl'
  condition_type TEXT NOT NULL, -- 'breakout' | 'breakdown'
  target_value REAL,
  trigger_value REAL,
  message TEXT NOT NULL,
  is_read INTEGER DEFAULT 0,
  created_at INTEGER NOT NULL
);
```

### C. `record_breaker_events`
Tracks unique record-breaker logs to prevent duplicate notifications for the same symbol on the same day.
```sql
CREATE TABLE record_breaker_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  symbol TEXT NOT NULL,
  event_type TEXT NOT NULL, -- '52w_high' | '52w_low' | 'ath' | 'atl'
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
  *(Note: A valid User-Agent header is required; requests lacking it are rejected with HTTP 403).*

### Request Payload Structures

1. **Watchlist Scope** (Queries only watchlisted symbols):
   ```json
   {
     "columns": ["name", "description", "close", "change", "price_52_week_high", "price_52_week_low"],
     "filter": [
       {
         "left": "name",
         "operation": "in_range",
         "right": ["AAPL", "TSLA", "MSFT"]
       }
     ]
   }
   ```

2. **Market Scope** (Queries the entire US market):
   ```json
   {
     "columns": ["name", "description", "close", "change", "price_52_week_high", "price_52_week_low"],
     "filter": [
       {
         "left": "type",
         "operation": "in_range",
         "right": ["stock", "dr"]
       }
     ],
     "range": [0, 25000]
   }
   ```

---

## 5. Filtering & Processing Logic

To ensure the scanner returns high-quality, actionable common stocks and excludes ETFs, funds, options, or foreign symbols, the backend applies the following filters:

1. **Exchange Restriction:** The symbol's exchange (extracted from the TradingView ticker prefix, e.g. `NASDAQ` in `NASDAQ:AAPL`) must strictly match `NASDAQ`, `NYSE`, or `AMEX`.
2. **Type Constraint:** When running in market scope, the TradingView request filter restricts types to `["stock", "dr"]` (Common Stock and Depositary Receipt).
3. **Symbol Structure Filtering (Market Scope):**
   * Skip symbols containing dots (`.`) or hyphens (`-`) to exclude class shares (e.g. `BRK.B`), warrants, or preferreds.
   * Skip symbols with length > 5 (typically indicating mutual funds or options).
   * **Rule:** `if (symbol.includes('.') || symbol.includes('-') || symbol.length > 5) continue;`

---

## 6. Execution Pipeline

When the scanner job is triggered:
1. **Fetch Scope:** If `watchlist` scope, retrieves all active watchlist symbols from the DB. If no active symbols exist, skips immediately.
2. **Execute Fetch:** POSTs to TradingView Scanner API.
3. **Filter and Parse:** Decodes response, filters symbols, and evaluates breakouts:
   * **52w High Breakout:** `price >= year_high`
   * **52w Low Breakdown:** `price <= year_low`
4. **Clean & Insert:** Deletes previous breakouts registered on `scan_date = today` to avoid duplicates, and batch-inserts the new list using chunks of 100 rows.
5. **Notify:** For each watchlisted stock hitting a new 52-week milestone, verifies if it was already notified today. If not, inserts an item into `in_app_notifications` and logs it in `record_breaker_events`.

---

## 7. Frontend Integration

* **Page URL:** `/market-breakouts`
* **Components:**
  * **Controls:** Allows querying historical breakouts by date and features a manual "Scan Watchlist" trigger.
  * **Market Breadth Gauge:** Visualizes the proportion of new 52-week highs vs. lows:
    * Highs $\ge$ 65%: 🔥 Strongly Bullish
    * Highs $\le$ 35%: ❄️ Strongly Bearish
    * 35% < Highs < 65%: ⚖️ Balanced Market
  * **Lists & Tables:** Shows "New 52-Week Highs" and "New 52-Week Lows" in separate tables.
  * **Performance Optimization:** Employs [DebouncedInput](file:///c:/Users/natta/Documents/oaktree-agent/frontend/src/components/common/DebouncedInput.tsx) for text search inputs. Rather than updating state on every keystroke, the list filter is debounced by 300ms, eliminating input stuttering and UI rendering lag when processing large data grids.
