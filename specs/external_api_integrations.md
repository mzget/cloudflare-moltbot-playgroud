# External API Integrations Specification

This specification documents all external API integrations within the Oaktree Agent backend. It details the target API hosts, the functions executing the requests, their calling schedules, and any manual on-demand triggers.

---

## Overview of External API Providers

The backend integrates with several external service providers to collect financial data, access user communication channels, and publish analytics:

| Host | Integration Domain | Primary Purpose |
|------|--------------------|-----------------|
| `api.nasdaq.com` | Nasdaq Developer Portal | Fetch ex-dividend history and declaration details. |
| `feeds.finance.yahoo.com` | Yahoo Finance RSS Feeds | Retrieve market news and corporate articles for watchlisted stocks. |
| `finnhub.io` | Finnhub Stock API | Query price quotes, fundamental metrics, and corporate earnings calendars. |
| `gmail.googleapis.com` | Google Gmail API | Synchronize subscriber newsletters and mail reports. |
| `graph.facebook.com` | Facebook Graph API | Automatically publish stock insights and newsletters to a Facebook Page. |
| `oauth2.googleapis.com` | Google OAuth Service | Handle user authentication and auto-refresh API access tokens. |

---

## 1. Nasdaq API (`api.nasdaq.com`)

Used to fetch ex-dividend dates, declaration dates, pay dates, and dividend amounts for watchlisted stocks.

* **Primary Function:** [fetchAndStoreMarketEvents](file:///c:/Users/natta/Documents/oaktree-agent/backend/src/marketEvents.ts#L3) in [marketEvents.ts](file:///c:/Users/natta/Documents/oaktree-agent/backend/src/marketEvents.ts)
* **API Endpoint:** `https://api.nasdaq.com/api/quote/${symbol}/dividends?assetclass=stocks`
* **Trigger & Frequency:**
  * **Scheduled:** Runs **every 6 hours** as part of the hourly cron job (specifically when UTC `hour % 6 === 0`).
  * **On-Demand:** Can be manually triggered by requesting the GET endpoint `/api/crawl-events` (implemented in [index.ts#L548](file:///c:/Users/natta/Documents/oaktree-agent/backend/src/index.ts#L548)), which invokes the synchronization workflow with `fetchMarketEvents: true`.

---

## 2. Yahoo Finance RSS (`feeds.finance.yahoo.com`)

Used to crawl news headlines and descriptions for watchlisted assets.

* **Primary Function:** [runCrawler](file:///c:/Users/natta/Documents/oaktree-agent/backend/src/crawler.ts#L4) (which calls [crawlRSS](file:///c:/Users/natta/Documents/oaktree-agent/backend/src/crawler.ts#L93)) in [crawler.ts](file:///c:/Users/natta/Documents/oaktree-agent/backend/src/crawler.ts)
* **API Endpoint:** `https://feeds.finance.yahoo.com/rss/2.0/headline?s={symbol}` (dynamic URL pattern configured in the `news_sources` D1 table).
* **Trigger & Frequency:**
  * **Scheduled:** Runs **every 6 hours** inside the hourly cron job (when UTC `hour % 6 === 0`).
  * **On-Demand:** Can be manually triggered by requesting the GET endpoint `/api/crawl` (implemented in [index.ts#L503](file:///c:/Users/natta/Documents/oaktree-agent/backend/src/index.ts#L503)), which runs the crawler workflow with `runCrawler: true`.

---

## 3. Finnhub API (`finnhub.io`)

Used for multiple purposes including stock quote updates, fundamental metric caching, and corporate earnings calendars.

### 3.1 Market Statistics & Quotes
* **Primary Function:** [fetchAndStoreMarketStats](file:///c:/Users/natta/Documents/oaktree-agent/backend/src/marketData.ts#L10) in [marketData.ts](file:///c:/Users/natta/Documents/oaktree-agent/backend/src/marketData.ts)
* **API Endpoints:**
  * Quotes: `https://finnhub.io/api/v1/quote?symbol=${symbol}&token=${apiKey}`
  * Financial Metrics: `https://finnhub.io/api/v1/stock/metric?symbol=${symbol}&metric=all&token=${apiKey}`
* **Trigger & Frequency:**
  * **Scheduled:** Runs **hourly** via the `0 * * * *` cron trigger.
  * **On-Demand:** Can be manually triggered by requesting the GET endpoint `/api/test-market-stats` (implemented in [index.ts#L538](file:///c:/Users/natta/Documents/oaktree-agent/backend/src/index.ts#L538)).

### 3.2 Earnings Calendars
* **Primary Function:** [fetchAndStoreMarketEvents](file:///c:/Users/natta/Documents/oaktree-agent/backend/src/marketEvents.ts#L3) in [marketEvents.ts](file:///c:/Users/natta/Documents/oaktree-agent/backend/src/marketEvents.ts)
* **API Endpoint:** `https://finnhub.io/api/v1/calendar/earnings?symbol=${symbol}&from=${from}&to=${to}&token=${apiKey}`
* **Trigger & Frequency:**
  * **Scheduled:** Runs **every 6 hours** (when UTC `hour % 6 === 0`).
  * **On-Demand:** Can be manually triggered by requesting the GET endpoint `/api/crawl-events` (implemented in [index.ts#L548](file:///c:/Users/natta/Documents/oaktree-agent/backend/src/index.ts#L548)).

### 3.3 Dynamic Analysis Fetching
* **Primary Function:** [getOrUpdateMarketStats](file:///c:/Users/natta/Documents/oaktree-agent/backend/src/analysisEngine.ts#L58) in [analysisEngine.ts](file:///c:/Users/natta/Documents/oaktree-agent/backend/src/analysisEngine.ts)
* **Trigger & Frequency:**
  * **On-Demand:** Invoked when running a full stock analysis via the POST endpoint `/api/analysis/run` (implemented in [index.ts#L2099](file:///c:/Users/natta/Documents/oaktree-agent/backend/src/index.ts#L2099)). It checks the D1 `market_stats` table first; if the data is missing or older than **24 hours**, it calls the Finnhub API to fetch fresh quotes and metrics.

---

## 4. Gmail API (`gmail.googleapis.com`)

Used to search and fetch content of financial subscriber emails/newsletters.

* **Primary Functions:**
  * [fetchGmailMessages](file:///c:/Users/natta/Documents/oaktree-agent/backend/src/gmail.ts#L130) in [gmail.ts](file:///c:/Users/natta/Documents/oaktree-agent/backend/src/gmail.ts) (lists message IDs matching queries).
  * [fetchGmailMessageDetail](file:///c:/Users/natta/Documents/oaktree-agent/backend/src/gmail.ts#L157) in [gmail.ts](file:///c:/Users/natta/Documents/oaktree-agent/backend/src/gmail.ts) (retrieves full email contents).
* **API Endpoints:**
  * Messages List: `https://gmail.googleapis.com/gmail/v1/users/me/messages?q=...`
  * Message Detail: `https://gmail.googleapis.com/gmail/v1/users/me/messages/${messageId}`
* **Trigger & Frequency:**
  * **Scheduled:** Runs **hourly** via the `0 * * * *` cron trigger.
  * **On-Demand:** Can be manually triggered by requesting the GET endpoint `/api/email-sync` (implemented in [index.ts#L831](file:///c:/Users/natta/Documents/oaktree-agent/backend/src/index.ts#L831)), which executes the `OaktreeSyncWorkflow` with `syncEmails: true`.

---

## 5. Facebook Graph API (`graph.facebook.com`)

Used to publish daily summaries, email digests, and custom posts directly to the configured Facebook Page.

### 5.1 Automated Posting Queue
* **Primary Function:** [processPendingFacebookPosts](file:///c:/Users/natta/Documents/oaktree-agent/backend/src/facebook.ts#L25) in [facebook.ts](file:///c:/Users/natta/Documents/oaktree-agent/backend/src/facebook.ts)
* **API Endpoint:** `https://graph.facebook.com/v20.0/${pageId}/feed`
* **Trigger & Frequency:**
  * **Scheduled:** Runs **every 30 minutes** via the `*/30 * * * *` cron trigger.
  * **On-Demand:** Can be manually triggered during a full email sync by requesting the GET endpoint `/api/email-sync` (implemented in [index.ts#L831](file:///c:/Users/natta/Documents/oaktree-agent/backend/src/index.ts#L831)) which sets `syncFacebookPosts: true`.

### 5.2 Direct UI Publishing
* **Primary Handler:** Hono route [app.post('/api/facebook/posts/:id/post-now', ...)](file:///c:/Users/natta/Documents/oaktree-agent/backend/src/index.ts#L983) in [index.ts](file:///c:/Users/natta/Documents/oaktree-agent/backend/src/index.ts)
* **API Endpoint:** `https://graph.facebook.com/v20.0/${pageId}/feed`
* **Trigger & Frequency:**
  * **On-Demand:** Executes immediately when a user clicks the "Post Now" button for a custom post on the frontend dashboard.

---

## 6. Google OAuth (`oauth2.googleapis.com`)

Used to manage access tokens for secure calls to the Gmail APIs.

* **Primary Functions:**
  * [exchangeCodeForTokens](file:///c:/Users/natta/Documents/oaktree-agent/backend/src/gmail.ts#L22) in [gmail.ts](file:///c:/Users/natta/Documents/oaktree-agent/backend/src/gmail.ts) (acquires initial tokens).
  * [refreshAccessToken](file:///c:/Users/natta/Documents/oaktree-agent/backend/src/gmail.ts#L50) in [gmail.ts](file:///c:/Users/natta/Documents/oaktree-agent/backend/src/gmail.ts) (exchanges refresh tokens for new access tokens).
* **API Endpoint:** `https://oauth2.googleapis.com/token`
* **Trigger & Frequency:**
  * **On-Demand (Authentication):** Triggered when a user completes the Google OAuth login flow and redirects to [app.post('/api/auth/google/callback', ...)](file:///c:/Users/natta/Documents/oaktree-agent/backend/src/index.ts#L750).
  * **On-Demand (Token Expiration Check):** Checked automatically before starting email synchronization. If the stored access token has expired, `refreshAccessToken` is triggered to obtain a new one.
