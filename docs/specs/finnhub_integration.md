# Finnhub API Integration Details

The Finnhub API is used in this repository to fetch real-time and fundamental stock data for watchlisted symbols. Below are the details of how the integration is structured and processed.

## 1. Authentication & Configuration

The integration uses a Finnhub API token stored in the Cloudflare Worker bindings as `env.FINNHUB_API_KEY`. 
If the key is missing, a warning is logged and the fetching operations are skipped.

## 2. Market Stats & Quotes (`0 * * * *` Hourly Cron)

The `fetchAndStoreMarketStats` function in `backend/src/marketData.ts` runs every hour to retrieve quotes and key financial metrics:

* **Query Batching:** It selects all active watchlist symbols (up to 30) from the D1 database.
* **Split Update Logic:**
  * **Quotes (Price):** For every active watchlist symbol, it fetches the latest price (quote) every hour to keep the prices fresh.
  * **Financial Metrics:** It prioritizes symbols that are missing metrics or whose metrics haven't been updated in 24 hours. To stay well within Finnhub's rate limit of 60 requests/minute, it limits metrics fetches to a maximum of 5 symbols per run.
* **API Endpoints:**
  1. **Quotes:** `https://finnhub.io/api/v1/quote?symbol=${symbol}&token=${apiKey}`
     * Retrieves current price (`c`), previous close (`pc`), day high (`h`), day low (`l`), and open price (`o`).
  2. **Financial Metrics:** `https://finnhub.io/api/v1/stock/metric?symbol=${symbol}&metric=all&token=${apiKey}`
     * Retrieves valuation, margins, growth, and debt ratios.
* **Data Processing & Normalization (when metrics are fetched):**
  * **Margins & Growth Rates:** Converted from percentages to decimals (e.g., divided by 100).
  * **Calculated Metrics:** Finnhub doesn't always provide absolute values directly, so the worker derives them:
    * **TTM Revenue:** `marketCapitalization / psTTM`
    * **EV / EBIT:** `enterpriseValue / (revenues * operating_margin)`
    * **FCF Margin:** `psTTM / pfcfShareTTM`
    * **Total Cash:** `cashPerSharePerShareQuarterly * (revenues / revenuePerShareTTM)`
    * **Total Debt:** Converted from long-term and short-term debt metrics, or calculated via `netDebt + totalCash`.
* **Database Sync:** The metrics are upserted into the `market_stats` table in D1. If the metrics fetch is skipped for a symbol on a given run, the database preserves the existing metrics values and the `updated_at` timestamp.

## 3. Market Events Calendar (Every 6 Hours Cron)

The `fetchAndStoreMarketEvents` function in `backend/src/marketEvents.ts` is responsible for retrieving corporate event calendars:

* **API Endpoint:** `https://finnhub.io/api/v1/calendar/earnings?symbol=${symbol}&from=${from}&to=${to}&token=${apiKey}`
  * Fetches the earnings calendar for all active watchlist symbols.
  * The date range (`from` and `to`) is dynamically set to query **30 days in the past** through **30 days into the future**.
  * *(Note: Other corporate events like dividends and stock splits are retrieved from Yahoo Finance instead).*
* **Rate-Limit Safeguard:** A 100ms delay (`setTimeout`) is introduced between iterations to ensure we do not exceed Finnhub's API request limits.
* **Database Sync:** Results containing estimates and actual reports for EPS and Revenue are stored in the D1 `market_events` table under the event type `'earnings'`.

## 4. Alert Threshold Evaluation

The data fetched from Finnhub and saved in `market_stats` is consumed by the `checkAlertRules` function in `backend/src/alerts.ts`. It checks if current metrics (e.g., Price, P/E, EV/EBIT, EV/Sales, Market Cap) have crossed user-defined alert thresholds and generates in-app notifications and email alerts.
