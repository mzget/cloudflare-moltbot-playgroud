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
