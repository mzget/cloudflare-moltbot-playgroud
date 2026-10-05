# Context & Glossary: Oaktree Agent Domain Model

## Core Concepts

### Watchlist
A curated list of stock symbols tracked by a user. Each entry can be active (`is_active = 1`) or inactive.

### Market Event
A scheduled corporate or market activity associated with a stock symbol stored in `market_events`:
- **Earnings Release (`earnings`)**: Financial earnings report announcement for a given quarter/year (e.g. EPS & Revenue estimate vs actual).
- **Dividend (`dividend`)**: Dividend ex-date milestone and amount per share.
- **Stock Split (`split`)**: Stock split execution date and split ratio.

### In-App Notification
A persistent notification item stored in `in_app_notifications` for the user, presented via the header notification bell / notification list UI in the web application.

### Event Notification Alert (Today's Events)
An In-App Notification generated automatically during daily market sync for any active Watchlist stock that has a `Market Event` occurring on the current date (`event_date = CURRENT_DATE`).
- **Covered Event Types**: `earnings`, `dividend`, `split`.
- **Deduplication Rule**: Exactly one In-App Notification per `(symbol, event_type, event_date)` combination per day to prevent duplicate alerts across hourly sync runs.

### Today Event Badge (Watchlist UI)
A visual badge/chip indicator displayed next to the stock symbol in the Watchlist table and Event Calendar dashboard when a stock has a Market Event occurring today.

### Sector Label
A user-defined short text tag stored on a Watchlist entry (`sector_label`) that describes the business type or sector of a stock (e.g. "Tech Growth", "REIT", "Healthcare"). Displayed as the secondary label under the symbol in the Holdings table and WatchlistCard — replacing the company `name` in those UI surfaces. Falls back to `name` when not set. An optional accompanying `sector_label_color` (hex string) controls the font color of the label.

### Market Quote Sync (Price Recency)
The real-time or delayed price quote synchronization (`price_updated_at`) that updates live market prices (last price, previous close, day high/low, open) for active watchlist stocks during US market trading hours (Mon–Fri 9:30–16:30 ET).

### Fundamental Metrics Sync (Fundamentals Recency)
The financial statistics and valuation metrics synchronization (`updated_at`) that refreshes quarterly/annual financial ratios (P/E, Market Cap, Margins, Debt/Equity, 52-week High/Low) on a rolling 24-hour cycle during off-market hours.

### Watchlist Breakout
A price milestone triggered when an active Watchlist stock reaches or breaches key historical boundary price levels:
- **All-Time High Breakout (`ath`)**: Current price $\ge$ highest recorded price in company history.
- **52-Week High Breakout (`52w_high`)**: Current price $\ge$ highest recorded price over the trailing 52 weeks (and strictly below ATH).
- **52-Week Low Breakdown (`52w_low`)**: Current price $\le$ lowest recorded price over the trailing 52 weeks (and strictly above ATL).
- **All-Time Low Breakdown (`atl`)**: Current price $\le$ lowest recorded price in company history.

#### Precedence Rule (Exclusive Hierarchy)
When a price breach occurs, the extreme lifetime milestones take strict precedence over annual milestones to prevent double-counting:
- If a stock breaches both ATH and 52W High, it is exclusively classified as `ath`.
- If a stock breaches both ATL and 52W Low, it is exclusively classified as `atl`.
- `52w_high` is assigned only if price $\ge$ 52W High AND price $<$ ATH.
- `52w_low` is assigned only if price $\le$ 52W Low AND price $>$ ATL.

### Today's Active Breakouts
The aggregated summary and filtered lists of Watchlist stocks that triggered any of the 4 breakout/breakdown conditions today (current date). The feature operates strictly in a real-time today-only scope without historical date querying.

### Watchlist Proximity Matrix
A comprehensive table view of all active Watchlist stocks showing their real-time breakout status badge and percentage distance relative to key boundary thresholds (`% from 52W High`, `% from ATH`, `% from 52W Low`, `% from ATL`).


#### Proximity Formulas
- **Distance to High**: `% From High = ((Price - TargetHigh) / TargetHigh) * 100`
  - Zero or positive indicates a breakout. Negative values indicate how far below the high the stock is trading.
- **Distance to Low**: `% From Low = ((Price - TargetLow) / TargetLow) * 100`
  - Zero or negative indicates a breakdown. Positive values indicate how far above the low the stock is trading.

#### Near-Breakout Threshold (3% Buffer)
Stocks trading within a 3.0% margin of boundary records are flagged as imminent breakout/breakdown candidates:
- **Near ATH (`near_ath`)**: `-3.0% <= % From ATH < 0%`
- **Near 52W High (`near_52w_high`)**: `-3.0% <= % From 52W High < 0%` (and not Near ATH)
- **Near 52W Low (`near_52w_low`)**: `0% < % From 52W Low <= +3.0%` (and not Near ATL)
- **Near ATL (`near_atl`)**: `0% < % From ATL <= +3.0%`

#### Notification Deduplication Rule (Breakouts)
- In-App Notifications are generated strictly for confirmed boundary breakouts/breakdowns (`ath`, `52w_high`, `52w_low`, `atl`).
- Deduplication limit: At most one In-App Notification per `(symbol, event_type, today_date)` per day.
- Imminent candidates (`near_*`) are displayed exclusively as visual highlights in the Watchlist Proximity Matrix and never trigger In-App Notifications.

### MCP Access Token
A shared secret string required to authenticate requests to the Model Context Protocol (MCP) endpoints and agent tools. Transported either via the HTTP `Authorization: Bearer <token>` header or as a URL query parameter (`?token=<token>` or `?key=<token>`) to support external agent connectors that do not permit custom header configuration.
_Avoid_: Session ID, API Key, User Password






