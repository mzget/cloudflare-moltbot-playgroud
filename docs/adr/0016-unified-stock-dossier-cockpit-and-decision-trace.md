# 16. Unified Stock Dossier Cockpit and Hybrid Decision Trace UI

Date: 2026-10-24

## Status

Accepted

## Context

Following the completion of Phase 1 (Bull vs. Bear Dialectical Debate), Phase 2 (AI-Assisted DCF Valuation Scenarios & Margin of Safety), and Phase 4 (Portfolio Risk Audit & Position Sizing Advisor), stock analysis within Oaktree was distributed across multiple disconnected views:

1. **Information Fragmentation**:
   - `StockOverview.tsx`: Financial charts, multi-period quarterly/annual performance, and key valuation/health ratios.
   - `AnalysisReport.tsx` / `DebateCard.tsx`: Deep-value Markdown thesis and round-by-round Bull vs. Bear debate rebuttals.
   - `DCFModel.tsx`: DCF cash flow forecasts, sensitivity tables, and custom scenario parameter calculators.
   - `StockThesis.tsx`: Manual target buy/sell price, conviction ratings, and journal entries.
   - `RiskSizingTab.tsx` (under `/portfolio`): Howard Marks portfolio concentration risk, correlation matrix, and 8%/15%/30% position sizing capacity.

   An investor deciding whether to take an action on a stock had to switch back and forth between 4 separate tabs in `/analysis` and navigate to `/portfolio` to check portfolio sizing capacity.

2. **Opaque Multi-Agent Reasoning Chain (Auditability Gap)**:
   - The user had no unified timeline showing *how* raw inputs (FMP financial statements, Facebook/crawler news) fed into the Bull vs. Bear debate, how that debate parameterized the DCF model, and how the DCF Margin of Safety was constrained by portfolio risk caps.

## Decision

We establish **Phase 5: Unified Investment Dossier & Decision Trace UI (One-Page Stock Cockpit)** with three architectural design pillars agreed upon in the `/grill-with-docs` session:

### 1. UI Navigation & Hierarchy: "Dossier / Cockpit" as Default Tab 0
- Introduce a new master tab `"Dossier"` (or `"Cockpit"`) positioned as Tab 0 in `AnalysisReport.tsx` (`/analysis?tab=dossier&symbol=SYM`).
- Retain existing specialized tabs (`Overview`, `Report`, `DCF Model`, `Stock Thesis`) as granular deep-dive tools.
- The Dossier tab acts as an executive 1-page cockpit integrating:
  - **Hero Actionability Banner**: Current price, 52-week range, Base MoS %, Conviction badge, and Position Sizing Room (Max Dollar / Shares allowed under 8% target / 15% stock cap / 30% theme cap).
  - **4-Quadrant High-Density Grid**:
    - **Quadrant A: Valuation Anchor**: Scenario range bar (`[Bear — Base — Bull]`), MoS %, WACC, and Terminal Growth assumptions.
    - **Quadrant B: Adversarial Debate**: Bull growth thesis vs. Bear downside risks, key tension points, and dialectical synthesis score.
    - **Quadrant C: Portfolio Fit & Governance**: Room to target, room to stock/theme cap, correlation status, and Howard Marks risk note.
    - **Quadrant D: Investment Thesis & Catalysts**: User's target buy/sell range, active catalysts, and next review date.

### 2. Client-Side Multi-Fetch Orchestration
- Rather than introducing a monolithic backend endpoint, the Dossier Cockpit component leverages client-side `Promise.all` fetching existing endpoints in parallel:
  - `GET /api/stocks/:symbol/overview`
  - `GET /api/analysis/results?symbol=:symbol` (or `GET /api/stocks/:symbol/dialectical-debate`)
  - `GET /api/analysis/theses?symbol=:symbol`
  - `GET /api/portfolio/risk-audit`
- Reuses `@oaktree/shared` pure calculations (`calculateFixedBasePositionSize`, `calculateMarginOfSafety`) with zero backend query duplication.

### 3. Hybrid Real-Time Decision Trace Flow
- Instead of adding a heavy `decision_traces` database table with migrations, the Trace Timeline is synthesized on-demand on the client from timestamps and payloads already persisted in D1:
  - **Stage 1 (Data Ingestion)**: Financial statement period (`asOfDate`), news freshness date.
  - **Stage 2 (Adversarial Debate)**: Bull & Bear generation timestamps, conviction level, and tension topics.
  - **Stage 3 (DCF Valuation)**: DCF scenario computation date, intrinsic value base case, and MoS %.
  - **Stage 4 (Portfolio Risk Audit)**: Howard Marks 8%/15%/30% check, portfolio health impact, and position sizing verdict.
- **View Switcher Toggle**: Users can toggle between `"Executive Cockpit"` (compact visual cards) and `"Decision Trace Flow"` (expanded step-by-step reasoning tree).

## Consequences

- **Positive**:
  - Eliminates context switching: One unified view answers "What is the stock?", "What is the upside/downside?", "Is the valuation safe?", "Can my portfolio afford it?", and "Why does AI think so?".
  - Instant auditability without database migrations or schema alterations.
  - Preserves full backward compatibility with all existing tabs and workflows.
- **Negative**:
  - Initial load of the Dossier tab performs 4 parallel HTTP GET requests (mitigated by HTTP/2 multiplexing on Cloudflare Workers and client caching).
