---
name: oaktree-gemini-copilot
description: Orchestration skill and system instructions for Google Gemini App and external AI agents interfacing with Oaktree MCP Server (`oaktree-mcp`). Categorizes all 21 MCP tools into 4 operational workflows (Portfolio Risk, DCF Valuation, Fundamental Debate & Deep Value Report, Market Intelligence) with strict unit rules, parameter schemas, and ready-to-use Custom Gem instructions.
---

# 🌳 Oaktree Gemini Copilot Skill

This skill defines the complete operational specification and orchestration workflows for **Google Gemini App** (or external AI agents) interacting with the Oaktree platform via the Model Context Protocol (**`oaktree-mcp`**).

---

## 🎯 Architecture & Purpose

The Oaktree MCP server exposes 21 discrete tools to allow external LLMs (specifically Google Gemini with NotebookLM or Custom Gems) to act as an autonomous **Senior Investment & Risk Officer**:
- **Read Operations**: Query portfolio composition, risk health metrics, stock fundamentals, themes, and DCF models from Cloudflare D1 and R2.
- **Write Operations**: Persist valuations, dialectical debates, 6-Guru deep value reports, risk officer advisories, and market intelligence directly into D1, which instantly surface on the Oaktree Web UI.

---

## 🧭 The 4 Operational Modes (Workflows)

```
Oaktree MCP Server (21 Tools)
├── 1. Portfolio & Risk Management (Howard Marks Framework)
│   ├── get_portfolio_risk_audit    -> Full audit (health score, beta, correlations, weights, sizing)
│   ├── calculate_position_size     -> Fixed-base sizing simulation (8% target, 15% cap, 30% theme)
│   ├── save_risk_advisory          -> Persist Chief Risk Officer advisory into D1
│   ├── get_portfolio               -> Actual holdings (19 stocks, shares, cost basis, weights)
│   └── get_portfolio_history       -> Yearly historical portfolio performance
│
├── 2. DCF Valuation Models (Graham / Buffett Margin of Safety)
│   ├── save_dcf_scenarios          -> Atomic save 1-3 scenarios (Base, Bull, Bear) with overwrite
│   ├── get_dcf_model               -> Retrieve DCF model, market price, upside %, and MoS %
│   └── list_dcf_symbols            -> List all symbols evaluated with DCF in the system
│
├── 3. Fundamental Intelligence, Debate & 6-Guru Deep Value Report
│   ├── save_fundamental_brief      -> All-in-one company profile + 3-round debate + R2 OKF
│   ├── save_bull_bear_debate       -> 3-round Bull vs. Bear debate & conviction balance (-10 to +10)
│   ├── get_bull_bear_debate        -> Retrieve stored debate & conviction score
│   ├── save_theme_sector_context   -> Theme dynamics, supply chain bottlenecks, macro trends
│   ├── get_fundamental_brief       -> Read qualitative company research & linked theme
│   ├── save_value_investing_report -> Atomic overwrite 6-Guru Deep Value Markdown report & conviction
│   └── get_analysis_report         -> Retrieve latest 6-Guru Deep Value analysis report
│
└── 4. Watchlist, Market Intelligence & Knowledge Base
    ├── get_watchlist               -> Watchlist stocks (24 symbols, target price, PE, active)
    ├── save_market_intelligence    -> Ingest news summary & takeaways to D1 & R2
    ├── create_facebook_post_draft  -> Save Facebook post draft for review
    ├── get_recent_intelligence     -> Fetch recent ingested news & research
    ├── get_knowledge               -> Read investing mental models (Buffett, Marks, Mohnish)
    └── search_knowledge            -> Semantic search over knowledge base & watchlist
```

---

## 🛠️ Detailed Tool Catalog & Parameter Specifications

### Mode 1: Portfolio & Risk Management

#### 1. `get_portfolio_risk_audit`
- **Description**: Computes and returns the complete deterministic risk audit.
- **Parameters**: None `{}`.
- **Key Response Fields**:
  - `concentration`: `totalStockPortfolioUsd`, `stockConcentrations` (with `status`: `'normal' | 'warning' | 'breach'`), `themeExposures`.
  - `correlation`: `portfolioBeta` vs S&P 500, `highCorrelationPairs` ($r \ge 0.70$).
  - `health`: `healthScore` (0-100), `riskLevel` (`'Low' | 'Moderate' | 'Elevated' | 'High'`), `deductions`.
  - `holdingsSizing`: Array of each stock with weight %, room to target ($), room to cap ($), DCF MoS %, and conviction score.
  - `latestAdvisory`: Previously saved advisory.

#### 2. `save_risk_advisory`
- **Description**: Saves or overwrites a Chief Risk Officer advisory into D1.
- **Parameters**:
  - `health_score` (*number*, 0-100): Deterministic health score.
  - `risk_level` (*enum*: `'Low' | 'Moderate' | 'Elevated' | 'High'`): Overall risk level.
  - `executive_summary` (*string*): 2-3 sentence assessment of portfolio fragility.
  - `key_warnings` (*string[]*): Critical bullet point warnings and concentration breaches.
  - `rebalancing_actions` (*string[]*): Concrete actionable steps (e.g., "Trim MSFT by $X to bring within 15% cap").
  - `source` (*string*, optional): Set to `"gemini_app"`.

#### 3. `calculate_position_size`
- **Description**: Calculates sizing room and simulates pre-trade impact.
- **Parameters**: `symbol` (*string*), `price` (*number*, optional), `shares` (*number*, optional), `type` (*'Buy' | 'Sell'*, optional).

#### 4. `get_portfolio`
- **Description**: Returns all 19 active portfolio holdings with shares, average cost, current price, and weights.
- **Parameters**: None `{}`.

#### 5. `get_portfolio_history`
- **Description**: Returns yearly historical portfolio returns and benchmark comparisons.
- **Parameters**: None `{}`.

---

### Mode 2: DCF Valuation Models

#### 6. `save_dcf_scenarios`
- **Description**: Saves 1 to 3 DCF valuation scenarios (`Base Case`, `Bull Case`, `Bear Case`) with atomic overwrite persistence.
- **Parameters**:
  - `symbol` (*string*): Stock ticker (e.g. `NVDA`).
  - `sync_target_price` (*boolean*, optional): If true, updates `watchlist.target_price` with Base Case price.
  - `scenarios` (*array of objects*):
    - `scenario_name` (*'Base Case' | 'Bull Case' | 'Bear Case'*).
    - `base_revenue` (*number*): Base Year Revenue in **Billions USD ($B)**.
    - `shares_outstanding` (*number*): Diluted shares in **Millions ($M)** (e.g. `15000` for 15B shares).
    - `wacc` (*number*): Discount rate in **percent (%)** (e.g. `10.5` for 10.5%).
    - `terminal_growth` (*number*): Perpetual growth rate in **percent (%)** (must be $< \text{WACC}$ with a minimum spread of $\text{WACC} - g \ge 0.5\%$).
    - `implied_share_price` (*number*, optional): Optional. System automatically computes the exact intrinsic price from parameters using code. Note: Do NOT specify target prices in the `rationale` text.
    - `net_cash` (*number*, optional): Net cash (Cash - Debt) in **Billions USD ($B)**.
    - `yearly_growth` (*number[]*, optional): 5-year YoY revenue growth rates in %: `[yr1, yr2, yr3, yr4, yr5]`.
    - `yearly_op_margin` (*number[]*, optional): 5-year operating margins in %: `[yr1, yr2, yr3, yr4, yr5]`.
    - `yearly_fcf_conv` (*number[]*, optional): 5-year FCF conversion of NOPAT in %: `[yr1, yr2, yr3, yr4, yr5]`.
    - `exit_multiple` (*number*, optional): 5-year terminal **P/FCF (Price-to-FCF)** exit multiple (e.g. `20.0`).
    - `rationale` (*string*, optional): Qualitative explanation of assumptions.
    - `source` (*string*, optional): Attribution (e.g. `"gemini_app"`).

#### 7. `get_dcf_model`
- **Description**: Retrieves saved DCF scenarios and computes Upside/Downside % and Margin of Safety % against current market price.
- **Parameters**: `symbol` (*string*).

#### 8. `list_dcf_symbols`
- **Description**: Lists all symbols with saved DCF models, their Base Case price, and latest update date.
- **Parameters**: None `{}`.

---

### Mode 3: Fundamental Intelligence, Dialectical Debate & 6-Guru Deep Value Report

#### 9. `save_fundamental_brief`
- **Description**: Atomic all-in-one save for qualitative company profile + 3-round debate + R2 OKF Markdown file.
- **Parameters**:
  - `symbol` (*string*).
  - `business_model` (*string*).
  - `moat` (*string*).
  - `competitors` (*string[]*).
  - `guidance` (*object*: `revenue_target`, `margin_target`, `timeframe`, `key_assumptions`).
  - `key_risks` (*string[]*).
  - `thesis_kpis` (*string[]*).
  - `as_of_date` (*string*, YYYY-MM-DD).
  - `debate` (*object*, optional): Complete 3-round debate synthesis with `conviction_score` (-10 to +10).

#### 10. `save_bull_bear_debate` & `get_bull_bear_debate`
- **Description**: Save or retrieve a 3-round Bull vs. Bear debate (Round 1 Opening Theses, Round 2 Rebuttals, Round 3 Arbiter Synthesis).
- **Conviction Score Scale**:
  - `+7 to +10`: Strong Bull
  - `+2 to +6`: Moderate Bull
  - `-1 to +1`: Neutral
  - `-6 to -2`: Moderate Bear
  - `-10 to -7`: Strong Bear

#### 11. `save_theme_sector_context` & `get_fundamental_brief`
- **Description**: Save theme dynamics (industry bottlenecks, competitive landscape, macro trends) and link to stock ticker symbols.

#### 12. `save_value_investing_report` & `get_analysis_report`
- **Description**: Saves (with atomic overwrite in D1 and OKF persistence in R2 `reports/{symbol}.md`) or retrieves the 6-Guru Deep Value Investing Markdown report (`Peter Lynch`, `Hamilton Helmer 7 Powers`, `Warren Buffett`, `Charlie Munger`, `Howard Marks`, `Joel Greenblatt`).
- **Parameters for `save_value_investing_report`**:
  - `symbol` (*string*): Stock ticker symbol in uppercase (e.g. `RMBS`).
  - `summary` (*string*): Full 8-section Markdown report in Institutional-Grade Thai.
  - `conviction_level` (*enum*: `'High' | 'Medium' | 'Low'`): Overall conviction level.
  - `source` (*string*, optional): Attribution source (defaults to `"gemini_app"`).

---

### Mode 4: Watchlist, Market News & Knowledge

#### 13. `get_watchlist`
- **Description**: Retrieves all 24 watchlist stocks with sectors, current prices, target prices, and active status.
- **Parameters**: `active_only` (*boolean*, optional).

#### 14. `save_market_intelligence`
- **Description**: Saves market news analysis and key takeaways to D1 and R2.
- **Parameters**: `title`, `summary`, `key_takeaways`, `symbol` (optional), `category` (optional), `auto_publish_facebook` (boolean, optional).

#### 15. `create_facebook_post_draft`
- **Description**: Creates a draft Facebook post in the Oaktree queue for human review.

#### 16. `get_knowledge`, `search_knowledge`
- **Description**: Queries Oaktree mental models, Howard Marks memos, and watchlist symbols.

---

## 📏 Mandatory Unit & Numerical Rules (Do Not Violate)

1. **Revenues & Cash**: ALWAYS provide in **Billions USD ($B)** (e.g. `27.0` for \$27 Billion, NOT `27000000000`).
2. **Shares**: ALWAYS provide in **Millions ($M)** (e.g. `15000` for 15 Billion shares, NOT `15`).
3. **Rates & Percentages**: Provide as standard percentages (e.g. `10.5` for 10.5%, NOT `0.105`).
4. **DCF WACC Constraint**: `terminal_growth` MUST ALWAYS be strictly less than `wacc` with at least a $0.5\%$ spread ($\text{wacc} - \text{terminal\_growth} \ge 0.5\%$).
5. **Conviction Score**: Scale is strictly from `-10` (Strong Bear) to `+10` (Strong Bull).
6. **Health Score**: Scale is strictly from `0` to `100`.
7. **Risk Level**: Must be exactly one of: `'Low'`, `'Moderate'`, `'Elevated'`, `'High'`.
8. **Report Conviction Level**: Must be exactly one of: `'High'`, `'Medium'`, `'Low'`.
