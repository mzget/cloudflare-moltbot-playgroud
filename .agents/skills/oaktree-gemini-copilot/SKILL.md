---
name: oaktree-gemini-copilot
description: Orchestration skill and system instructions for Google Gemini App and external AI agents interfacing with Oaktree MCP Server (`oaktree-mcp`). Categorizes all 21 MCP tools into 4 operational workflows (Portfolio Risk, DCF Valuation, Fundamental Debate & Deep Value Report, Market Intelligence) with strict unit rules, parameter schemas, ADR-0020 Business Model & Unit Economics support, and ready-to-use Custom Gem extraction instructions.
---

# 🌳 Oaktree Gemini Copilot Skill

This skill defines the complete operational specification and orchestration workflows for **Google Gemini App** (or external AI agents) interacting with the Oaktree platform via the Model Context Protocol (**`oaktree-mcp`**).

---

## 🎯 Architecture & Purpose

The Oaktree MCP server exposes 21 discrete tools to allow external LLMs (specifically Google Gemini with NotebookLM or Custom Gems) to act as an autonomous **Senior Investment & Risk Officer**:
- **Read Operations**: Query portfolio composition, risk health metrics, stock fundamentals, themes, and DCF models from Cloudflare D1 and R2.
- **Write Operations**: Persist valuations, dialectical debates, unit economics matrices, 6-Guru deep value reports, risk officer advisories, and market intelligence directly into D1, which instantly surface on the Oaktree Web UI.

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
│   ├── save_fundamental_brief      -> All-in-one company profile + 3-round debate + unit economics (ADR-0020) + R2 OKF
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

#### 9. `save_fundamental_brief` (All-in-One Atomic Push)
- **Description**: Atomic single-call save for company profile, 3-round Bull vs. Bear debate, Business Model & Unit Economics matrix (ADR-0020), and R2 OKF Markdown file. Feeds both the **Overview Tab** (`unit_economics`) and the **Report Tab** (`debate`) simultaneously.
- **Parameters**:
  - `symbol` (*string*): Ticker symbol in uppercase (e.g. `"SHOP"`).
  - `business_model` (*string*): Qualitative business model, value generation mechanisms, and unit economics summary (in Institutional Thai).
  - `moat` (*string*): Economic moat analysis (Network Effects, Switching Costs, Cost Advantages, Intangibles/IP) with empirical metrics.
  - `competitors` (*string[]*): Major competitors or alternative architectures.
  - `guidance` (*object*): `{ revenue_target, margin_target, timeframe, key_assumptions }`.
  - `key_risks` (*string[]*): Array of structural risks or technological hurdles.
  - `thesis_kpis` (*string[]*): Array of quantitative thesis tracking KPIs (e.g. ASP, Penetration Rate %, ARR).
  - `as_of_date` (*string*, `YYYY-MM-DD`): Filing or earnings release date derived from the primary source.
  - `source_count` (*number*, optional): Number of uploaded source documents (defaults to 1).
  - `notebook_id` (*string*, optional): Notebook identifier.
  - `unit_economics` (*object*, optional) - **ADR-0020 Matrix Structure**:
    - `archetype` (*string*, optional): Business archetype (e.g. `"Unified Commerce Operating System"`, `"Pure-play Semiconductor IP"`).
    - `period_label` (*string*, optional): Reporting period (e.g. `"Q2 2026"`).
    - `segments` (*array of objects*, optional): Revenue segment breakdown:
      - `name` (*string*): Segment name (e.g. `"Subscription Solutions"`, `"Merchant Solutions"`).
      - `share_pct` (*number*, optional): Revenue share percentage (e.g. `22.4` for 22.4%).
      - `revenue_display` (*string*, optional): Formatted revenue string (e.g. `"$836M"`).
      - `yoy_growth_pct` (*number*, optional): YoY growth rate (e.g. `19.6` for +19.6%).
      - `margin_pct` (*number*, optional): Segment margin percentage (e.g. `79.7`).
      - `margin_type` (*enum*, optional): `'Gross Margin' | 'Operating Margin' | 'EBITDA Margin'`.
      - `drivers` (*string*, optional): Key growth, volume, or pricing drivers.
    - `unit_economics` (*array of objects*, optional): Company-specific hero KPIs:
      - `label` (*string*): Metric name (e.g. `"Gross Merchandise Volume (GMV)"`, `"Attach Rate"`).
      - `value` (*string*): Formatted metric value (e.g. `"$115.6B"`, `"3.45%"`).
      - `change_display` (*string*, optional): Growth/change badge text (e.g. `"+32% YoY"`).
      - `change_direction` (*enum*, optional): `'up' | 'down' | 'neutral'`.
      - `progress_pct` (*number*, optional): Visual gauge fill 0-100 (e.g. `68`).
      - `category` (*enum*, optional): `'volume' | 'monetization' | 'retention' | 'efficiency'`.
      - `context` (*string*, optional): Contextual benchmark or risk threshold.
  - `debate` (*object*, optional): Full 3-round dialectical debate structure:
    - `round1`: `{ bull: { bull_thesis, growth_catalysts[], competitive_advantages[], valuation_upside }, bear: { bear_thesis, downside_risks[], structural_headwinds[], valuation_stretch } }`.
    - `round2_rebuttal`: `{ bull_rebuttal: { rebuttal_arguments[], mitigating_factors[] }, bear_rebuttal: { rebuttal_arguments[], skeptical_counters[] } }`.
    - `synthesis`: `{ key_tensions: [{ topic, bull_argument, bear_argument, decisive_factor }], consensus_points[], conviction_score (-10 to +10), conviction_label, verdict_summary }`.

#### 10. `save_bull_bear_debate` & `get_bull_bear_debate`
- **Description**: Save or retrieve a standalone 3-round Bull vs. Bear debate (Round 1 Opening Theses, Round 2 Rebuttals, Round 3 Arbiter Synthesis).
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

## 📋 Canonical Gemini Extraction Prompt Template (`save_fundamental_brief`)

This is the exact prompt template used in the Oaktree Web UI (`CopyPromptModal.tsx`) across both the **Overview** and **Report** tabs. Users can paste this prompt directly into Google Gemini App (with NotebookLM sources attached):

```markdown
# Fundamental Intelligence & Bull vs. Bear Debate Extraction: {SYMBOL}

You are a Senior Equity Research Analyst conducting a comprehensive fundamental deep-dive using all primary documents uploaded in this notebook (10-K, 10-Q, Earnings Call Transcripts, Investor Presentation Slides, and Thesis Notes).

## Mandatory Instructions:
1. **Language**: Write all qualitative explanations, arguments, and summaries in **Institutional-Grade Thai (ภาษาไทยระดับนักวิเคราะห์สถาบัน)**. Professional technical/financial terms may be transliterated in English where appropriate.
2. **Evidence Grounding**: Every single claim, catalyst, risk, and rebuttal **MUST** cite real figures, growth percentages, margins, or KPIs disclosed in the notebook sources. Never generalize without numbers.
3. **Dialectical Debate**: Conduct a rigorous 3-Round Bull vs. Bear debate (Opening Theses -> Cross-Examination Rebuttals -> Dialectical Arbiter Synthesis with conviction score from -10 to +10).
4. **Single Atomic Tool Call**: Invoke the MCP tool `save_fundamental_brief` **once** with both the fundamental research profile, the unit economics matrix, and the full `debate` object:

```json
{
  "symbol": "{SYMBOL}",
  "business_model": "สรุปโครงสร้างรายได้ กลไกการสร้างมูลค่า และหน่วยเศรษฐกิจ (Unit Economics) 2-3 ประโยคในภาษาไทยระดับนักวิเคราะห์",
  "moat": "วิเคราะห์ปราการทางเศรษฐกิจ (Network Effects, Switching Costs, Cost Advantages, Intangibles/IP) พร้อมตัวเลขและข้อเท็จจริงสนับสนุน",
  "competitors": ["ชื่อคู่แข่ง/สถาปัตยกรรม A", "ชื่อคู่แข่ง B"],
  "guidance": {
    "revenue_target": "เป้าหมายการเติบโตของรายได้ (เช่น 20-25% YoY หรือ $1.2B ใน FY27)",
    "margin_target": "เป้าหมายอัตรากำไรขั้นต้นหรืออัตรากำไรจากการดำเนินงาน",
    "timeframe": "กรอบเวลาของ Guidance (เช่น FY27 หรือ Q2 FY27)",
    "key_assumptions": "สมมติฐานหลักที่ผู้บริหารเปิดเผยในการประชุมผลประกอบการ"
  },
  "key_risks": [
    "ความเสี่ยงเชิงโครงสร้างหรืออุปสรรคทางเทคโนโลยี พร้อมผลกระทบต่อผลการดำเนินงาน",
    "ความเสี่ยงด้านการกระจุกตัวของลูกค้า หรือความไม่แน่นอนทางกฎระเบียบและเศรษฐกิจมหภาค"
  ],
  "thesis_kpis": [
    "ตัวชี้วัดเชิงปริมาณหลักในการติดตามวิทยานิพนธ์การลงทุน (เช่น ASP, Penetration Rate %, Volume Adoption, ARR)",
    "ตัวชี้วัดรอง (เช่น Gross Retention %, Net Expansion Rate)"
  ],
  "unit_economics": {
    "archetype": "เช่น Unified Commerce Operating System หรือ Pure-play Semiconductor IP",
    "period_label": "เช่น Q2 2026 หรือ Q3 2026",
    "segments": [
      {
        "name": "ชื่อกลุ่มธุรกิจ เช่น Subscription Solutions",
        "share_pct": 22.4,
        "revenue_display": "$836M",
        "yoy_growth_pct": 19.6,
        "margin_pct": 79.7,
        "margin_type": "Gross Margin",
        "drivers": "เช่น Basic $29/mo ถึง Plus $2,300/mo"
      }
    ],
    "unit_economics": [
      {
        "label": "ชื่อ KPI เช่น Gross Merchandise Volume (GMV)",
        "value": "$115.6B",
        "change_display": "+32% YoY",
        "change_direction": "up",
        "progress_pct": 68,
        "category": "volume",
        "context": "คำอธิบายบริบทและเกณฑ์เฝ้าระวัง"
      }
    ]
  },
  "debate": {
    "round1": {
      "bull": {
        "bull_thesis": "วิทยานิพนธ์ฝั่งกระทิง 2-3 ประโยค เน้นศักยภาพการเติบโตและการขยาย Moat",
        "growth_catalysts": ["ปัจจัยเร่งการเติบโตข้อ 1 พร้อมตัวเลขจริงจากเอกสาร", "ปัจจัยเร่งข้อ 2"],
        "competitive_advantages": ["ความได้เปรียบทางการแข่งขันเชิงโครงสร้างข้อ 1", "ข้อ 2"],
        "valuation_upside": "การประเมินส่วนต่างราคาและโอกาสปรับเพิ่มประมาณการกำไร"
      },
      "bear": {
        "bear_thesis": "วิทยานิพนธ์ฝั่งหมี 2-3 ประโยค เน้นจุดตาย ความเสี่ยงขาลง และ Inversion Thinking",
        "downside_risks": ["ความเสี่ยงขาลงข้อ 1 พร้อมตัวเลขชี้วัดความเปราะบาง", "ความเสี่ยงข้อ 2"],
        "structural_headwinds": ["อุปสรรคเชิงโครงสร้างและการแข่งขันที่รุนแรงขึ้น", "ข้อ 2"],
        "valuation_stretch": "ความตึงตัวของ Valuation และความเสี่ยงในการถูก Multiple Compression"
      }
    },
    "round2_rebuttal": {
      "bull_rebuttal": {
        "rebuttal_arguments": ["ข้อโต้แย้งหักล้างความเสี่ยงของฝั่ง Bear ด้วยหลักฐานและงบการเงิน"],
        "mitigating_factors": ["ปัจจัยบรรเทาความเสี่ยงและสภาพคล่องรองรับ"]
      },
      "bear_rebuttal": {
        "rebuttal_arguments": ["การชี้จุดบกพร่องในมุมมองฝั่ง Bull ว่ามองโลกในแง่ดีเกินจริง"],
        "skeptical_counters": ["ข้อสังเกตและสมมติฐานที่ฝั่ง Bull มองข้าม"]
      }
    },
    "synthesis": {
      "key_tensions": [
        {
          "topic": "ประเด็นข้อถกเถียงชี้ขาด (เช่น อัตราการนำเทคโนโลยีไปใช้ vs. การถูกแทนที่)",
          "bull_argument": "ข้ออ้างฝั่ง Bull พร้อมตัวเลขสนับสนุน",
          "bear_argument": "ข้ออ้างฝั่ง Bear พร้อมตัวเลขความเสี่ยง",
          "decisive_factor": "ตัวชี้วัดหรือรายงานที่จะเป็นจุดตัดสินในอนาคต"
        }
      ],
      "consensus_points": ["จุดที่ทั้งฝ่าย Bull และ Bear เห็นพ้องตรงกัน"],
      "conviction_score": 4,
      "conviction_label": "Moderate Bull",
      "verdict_summary": "บทสรุปดุลยภาพความเสี่ยงและผลตอบแทน 3-4 ประโยคเป็นภาษาไทยระดับนักวิเคราะห์"
    }
  },
  "as_of_date": "YYYY-MM-DD (MUST be derived from the filing or earnings release date, e.g. 2026-07-29)"
}
```

**Strict Requirement**: Derive `as_of_date` strictly from the document publication date. Do NOT invent dates.
```

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
9. **Unit Economics & Segments (ADR-0020)**: `share_pct`, `yoy_growth_pct`, and `margin_pct` MUST be standard percentages (e.g. `22.4` for 22.4%, NOT `0.224`). Dollar amounts should be formatted in `revenue_display` (e.g. `"$836M"`, `"$2.9B"`).
