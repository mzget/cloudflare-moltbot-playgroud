---
name: dcf-valuation-model
description: Guidelines and procedures for performing Discounted Cash Flow (DCF) stock valuations, handling both Basic (Uniform) and Detailed (Per-Year) input modes, D1 database persistence, and frontend DCFModel integration. Load when working on stock valuation, DCF calculations, or DCF UI data entry.
---

# 📈 DCF Valuation Model Skill

Guidelines for performing Discounted Cash Flow (DCF) stock valuations and managing DCF model parameters across the backend database and frontend UI.

---

## 🎛️ Dual-Mode Input Specifications

### 1. Basic Mode (Uniform)
Use when input assumptions are specified as overall averages across the 5-year forecast period (FY+1 to FY+5).
- **Base Revenue ($B)**: Starting revenue (e.g. FY2026 Base Revenue).
- **Revenue Growth %**: Single annual YoY growth rate applied equally across all 5 forecast years.
- **Operating Margin %**: Fixed EBIT margin applied equally across all 5 forecast years.
- **FCF Conversion %**: Fixed Free Cash Flow conversion percentage of NOPAT applied across all 5 forecast years.

### 2. Detailed Mode (Per-Year)
Use when year-by-year granular projections (FY+1, FY+2, FY+3, FY+4, FY+5) are provided.
- **Yearly Revenue Growth Array**: `[growth_yr1, growth_yr2, growth_yr3, growth_yr4, growth_yr5]` (in %).
- **Yearly Operating Margin Array**: `[opMargin_yr1, opMargin_yr2, opMargin_yr3, opMargin_yr4, opMargin_yr5]` (in %).
  - *Formula (if given as Base GM + GM Improvement - OpEx Margin)*:
    $$\text{OpMargin}_i = \text{Base Gross Margin} + (i \times \text{GM Improvement}) - \text{OpEx Margin}$$
- **Yearly FCF Conversion Array**: `[fcfConv_yr1, fcfConv_yr2, fcfConv_yr3, fcfConv_yr4, fcfConv_yr5]` (in %).

---

## 📐 Core DCF Mathematical Formulas

1. **Revenue Projection**:
   $$\text{Revenue}_i = \text{Revenue}_{i-1} \times (1 + \text{Growth}_i)$$
2. **Operating Income (EBIT)**:
   $$\text{EBIT}_i = \text{Revenue}_i \times \text{OpMargin}_i$$
3. **Net Operating Profit After Tax (NOPAT)**:
   $$\text{NOPAT}_i = \text{EBIT}_i \times (1 - \text{Tax Rate})$$
4. **Free Cash Flow (FCF)**:
   $$\text{FCF}_i = \text{NOPAT}_i \times \text{FCF Conversion}_i$$
5. **Present Value of FCF (PV of FCF)**:
   $$\text{PV of FCF}_i = \frac{\text{FCF}_i}{(1 + \text{WACC})^i}$$
6. **Terminal Value (TV - Gordon Growth Model)**:
   $$\text{TV} = \frac{\text{FCF}_5 \times (1 + g)}{\text{WACC} - g}$$
7. **PV of Terminal Value**:
   $$\text{PV of TV} = \frac{\text{TV}}{(1 + \text{WACC})^5}$$
8. **Enterprise Value (EV)**:
   $$\text{EV} = \sum_{i=1}^5 \text{PV of FCF}_i + \text{PV of TV}$$
9. **Implied Intrinsic Share Price**:
   $$\text{Implied Price} = \frac{\text{EV} + \text{Net Cash}}{\text{Diluted Shares Outstanding (in Billions)}}$$

---

## 💾 Database Persistence Protocol

When saving a DCF calculation run to Cloudflare D1:
- **API Endpoint**: `POST /api/analysis/dcf-save`
- **CLI Command**:
  ```bash
  npx wrangler d1 execute moltbot-db --remote --command="INSERT INTO dcf_calculations (symbol, scenario_name, base_revenue, revenue_growth, base_gross_margin, gross_margin_improvement, opex_margin, tax_rate, fcf_conversion, wacc, terminal_growth, shares_outstanding, implied_share_price) VALUES ('SYMBOL', 'Scenario Name', ...);"
  ```

---

## 🖥️ Frontend UX Rules

- **Unvalued Stocks**: Stocks without saved calculations in D1 **MUST** start with zero/blank inputs and display an "Unvalued" banner rather than showing fake hardcoded defaults.
- **Saved History**: When saved calculations exist for a symbol, automatically load the latest saved calculation from D1 on initial view.
- **Input Field Dimensions**: Projection table input fields must maintain a minimum width of `85px` to prevent text truncation/ellipsis.
