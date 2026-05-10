# SPEC: Oaktree Agent — Market Intelligence Dashboard

> **Sprint**: Market Intelligence v1.0  
> **Board**: https://github.com/users/mzget/projects/1  
> **Author**: Nattapon R.  
> **Status**: 🟢 Active

---

## 1. Goal

Elevate the Oaktree frontend from a news-feed reader into a **professional financial intelligence dashboard** by:
1. Renaming the "Dashboard" navigation item to **"Market Intelligence"**.
2. Adding a **Company Statistics Table** that shows fundamental financial metrics for each symbol in the user's watchlist — inspired by the prototype at `prototype/dashboard.png`.

---

## 2. Tech Stack (Do Not Change)

| Layer         | Technology                          |
|---------------|-------------------------------------|
| Framework     | Astro + React (island architecture) |
| UI Library    | MUI Joy UI                          |
| Router        | TanStack Router v1 (`@tanstack/react-router`) |
| Icons         | `lucide-react`                      |
| Styling       | MUI Joy `sx` prop (no Tailwind)     |
| Data Source   | Cloudflare Worker (`API_BASE_URL`)  |

---

## 3. Feature 1 — Rename Navigation Item

### Scope
- **File**: `frontend/src/components/Sidebar.tsx`
- **File**: `frontend/src/components/Dashboard.tsx`

### Acceptance Criteria
- [ ] Sidebar menu label changes from `"Dashboard"` → `"Market Intelligence"`.
- [ ] Sidebar icon changes from `LayoutDashboard` → `BarChart3` (lucide-react).
- [ ] Tab ID in `menuItems` changes from `'dashboard'` → `'market'`.
- [ ] The `dashboardSearchSchema` enum in `Dashboard.tsx` is updated to include `'market'` and the `.catch()` fallback changes to `'market'`.
- [ ] All `activeTab === 'dashboard'` conditionals in `Dashboard.tsx` are updated to `activeTab === 'market'`.
- [ ] Page title (`<Typography level="h2">`) remains `"Market Intelligence"` (already correct).
- [ ] URL query param `?tab=market` works correctly.

### Files to Modify
```
frontend/src/components/Sidebar.tsx       — change id, label, icon
frontend/src/components/Dashboard.tsx     — update schema enum, conditionals
```

---

## 4. Feature 2 — Company Statistics Table

### Overview
A scrollable, dark-themed data table showing key financial fundamentals for each company in the user's watchlist. The user can toggle which metric columns are visible, sort by any column, and switch number formats.

### UI Layout (Based on Prototype)

```
┌─────────────────────────────────────────────────────────────────────┐
│ [Filter Chips: Market Cap ×] [Revenues ×] [Revenue 3Y CAGR ×] ...  │
├─────────────────────────────────────────────────────────────────────┤
│ USD ▼  | Ownership ○  | Avg. Cost Basis ○  | [Add Custom] [K M B]  │
├──────────────────┬──────────────┬───────┬───────┬────────┬──────────┤
│ Ticker           │ Market Cap ↕ │ Rev ↕ │ ... ↕ │ ...  ↕ │ ...    ↕ │
├──────────────────┼──────────────┼───────┼───────┼────────┼──────────┤
│ 🔵 Meta / META   │ $1,565.72B   │ $214B │ 22.4% │ 26.2%  │ 81.9%  │
│ 🟦 MSFT          │ $3,125.66B   │ $318B │ 15.3% │ 17.9%  │ 68.3%  │
│ ...              │ ...          │ ...   │ ...   │ ...    │ ...    │
└──────────────────┴──────────────┴───────┴───────┴────────┴──────────┘
```

### Metric Columns (All Optional / Toggleable)

| Column ID         | Display Name        | Format    | Description                        |
|-------------------|---------------------|-----------|------------------------------------|
| `market_cap`      | Market Cap          | `$XB`     | Total market capitalization        |
| `revenues`        | Revenues            | `$XB`     | Trailing twelve months revenue     |
| `revenue_3y_cagr` | Revenue 3Y CAGR     | `X.X%`    | 3-year compound annual growth rate |
| `revenue_1y_growth`| Revenue 1Y Growth  | `X.X%`    | Year-over-year revenue growth      |
| `gross_profit`    | Gross Profit        | `X.X%`    | Gross profit margin %              |
| `operating_margin`| Operating Margin    | `X.X%`    | Operating income / Revenue         |
| `ev_ebit`         | EV/EBIT             | `X.X`     | Enterprise value / EBIT            |
| `ev_sales`        | EV/Sales            | `X.X`     | Enterprise value / Sales           |
| `p_ocf`           | P/OCF               | `X.X`     | Price / Operating cash flow        |
| `p_fcf`           | P/FCF               | `X.X`     | Price / Free cash flow             |
| `capex_to_ocf`    | CapEx to OCF        | `X.X`     | Capital expenditure / OCF          |
| `rd_to_revenue`   | R&D to Revenue      | `X.X%`    | R&D spend / Revenue                |
| `debt_equity`     | Debt / Equity       | `X.X`     | Total debt / Total equity          |

### Default Visible Columns (First Load)
`market_cap`, `revenues`, `revenue_3y_cagr`, `revenue_1y_growth`, `gross_profit`, `operating_margin`

### Toolbar Controls
| Control              | Behavior                                              |
|----------------------|-------------------------------------------------------|
| Column filter chips  | Each active column shown as a chip with `×` to hide  |
| USD currency toggle  | Display currency (v1: USD only, others greyed out)   |
| Ownership toggle     | Show/hide ownership % column (v1: UI only)           |
| Avg. Cost Basis      | Show/hide cost basis column (v1: UI only)            |
| K / M / B selector  | Switch number display format (Thousands/Millions/Billions) |
| Sort arrows on header| ASC/DESC sort by any column                          |

### Data Model

#### TypeScript Interface
```typescript
// frontend/src/types/companyStats.ts
export interface CompanyStats {
  symbol: string;              // "AAPL"
  name: string;                // "Apple Inc."
  exchange: string;            // "NasdaqGS"
  logo_url?: string;           // optional favicon/logo URL
  market_cap?: number;         // in USD
  revenues?: number;
  revenue_3y_cagr?: number;    // decimal: 0.054 = 5.4%
  revenue_1y_growth?: number;
  gross_profit_margin?: number;
  operating_margin?: number;
  ev_ebit?: number;
  ev_sales?: number;
  p_ocf?: number;
  p_fcf?: number;
  capex_to_ocf?: number;
  rd_to_revenue?: number;
  debt_equity?: number;
}
```

#### Data Source Strategy
- **Phase 1 (This Sprint)**: Mock/static data hardcoded for the watchlist symbols shown in the prototype (META, MSFT, GOOGL, AAPL, AMZN, NFLX, SHOP, COIN, RDDT, DDOG, NET, ARM, MRVL, LITE).
- **Phase 2 (Future)**: Fetch from `GET /api/company-stats?symbols=AAPL,MSFT` via the Cloudflare Worker backend.

### Component Architecture

```
Dashboard.tsx  (existing — add MarketIntelligencePage tab)
└── MarketIntelligencePage.tsx  (NEW — the full page wrapper)
    ├── CompanyStatsToolbar.tsx  (NEW — chips, toggles, K/M/B)
    └── CompanyStatsTable.tsx   (NEW — the scrollable data table)
        └── CompanyStatsRow.tsx  (NEW — one row per company)
```

### New Files to Create
```
frontend/src/components/MarketIntelligencePage.tsx
frontend/src/components/CompanyStatsToolbar.tsx
frontend/src/components/CompanyStatsTable.tsx
frontend/src/types/companyStats.ts
frontend/src/data/mockCompanyStats.ts
```

### Styling
- Follow existing `glassStyle` pattern from `Dashboard.tsx`.
- Table header: `bgcolor: 'rgba(255,255,255,0.03)'`, sticky on scroll.
- Row hover: `bgcolor: 'rgba(255,255,255,0.04)'`.
- Negative values (e.g., negative margins): color `#e74c3c`.
- Positive values above threshold: color `#2ecc71`.
- Neutral values: `rgba(255,255,255,0.8)`.
- Column chips: MUI Joy `<Chip variant="soft">` with `×` delete icon.

---

## 5. Implementation Phases

### Phase 1 — Navigation Rename (Atomic, No Dependencies)
- [ ] **TASK-01**: Rename sidebar "Dashboard" → "Market Intelligence" (`Sidebar.tsx`, `Dashboard.tsx`)

### Phase 2 — Company Stats Table (Depends on TASK-01)
- [ ] **TASK-02**: Create `CompanyStats` TypeScript interface and mock data file
- [ ] **TASK-03**: Build `CompanyStatsTable.tsx` — sortable table with hardcoded columns
- [ ] **TASK-04**: Build `CompanyStatsToolbar.tsx` — column chip filters + K/M/B toggle
- [ ] **TASK-05**: Build `MarketIntelligencePage.tsx` — compose Toolbar + Table
- [ ] **TASK-06**: Integrate `MarketIntelligencePage` into `Dashboard.tsx` under `activeTab === 'market'`

### Phase 3 — Live Data (Future Sprint, Out of Scope Now)
- [ ] **TASK-07**: Create backend endpoint `GET /api/company-stats`
- [ ] **TASK-08**: Connect frontend to live API replacing mock data

---

## 6. Acceptance Criteria (Definition of Done)

- [ ] Sidebar shows "Market Intelligence" with `BarChart3` icon.
- [ ] `?tab=market` URL param loads the Market Intelligence page.
- [ ] Company stats table is visible with ≥ 6 rows of mock data.
- [ ] All 13 metric columns are defined; 6 are visible by default.
- [ ] Clicking `×` on a column chip hides that column.
- [ ] Clicking a column header cycles through ASC → DESC → none sort.
- [ ] K/M/B toggle changes how large numbers are formatted.
- [ ] Table is horizontally scrollable on mobile (no overflow clip).
- [ ] `tsc` compiles with zero errors.
- [ ] No console errors in browser.

---

## 7. Non-Goals (This Sprint)

- No real-time price data or WebSocket feeds.
- No actual brokerage connection (UI button only, disabled).
- No backend API changes (mock data only).
- No user authentication or per-user watchlist persistence.
- No charting or sparklines inside the table.

---

## 8. File Change Summary

| File | Action | Reason |
|------|--------|--------|
| `frontend/src/components/Sidebar.tsx` | Modify | Rename menu item + icon |
| `frontend/src/components/Dashboard.tsx` | Modify | Update schema enum + tab conditional |
| `frontend/src/components/MarketIntelligencePage.tsx` | **Create** | New page wrapper |
| `frontend/src/components/CompanyStatsToolbar.tsx` | **Create** | Column filters + K/M/B toggle |
| `frontend/src/components/CompanyStatsTable.tsx` | **Create** | Main data table |
| `frontend/src/types/companyStats.ts` | **Create** | TypeScript interface |
| `frontend/src/data/mockCompanyStats.ts` | **Create** | Static mock data |

---

## 9. Reference

- Prototype image: `prototype/dashboard.png`
- Existing glass style pattern: `Dashboard.tsx` lines 179–184
- MUI Joy table docs: https://mui.com/joy-ui/react-table/
- Lucide icon `BarChart3`: https://lucide.dev/icons/bar-chart-3
