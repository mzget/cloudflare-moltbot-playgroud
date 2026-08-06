---
name: dcf-valuation-model
description: Guidelines and procedures for performing Discounted Cash Flow (DCF) stock valuations, handling both Basic (Uniform) and Detailed (Per-Year) input modes, 3 preset scenario management (Base Case, Bear Case, Bull Case) with overwrite D1 persistence, and frontend DCFModel integration. Load when working on stock valuation, DCF calculations, or DCF UI data entry.
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

## 🎭 3 Preset Scenarios & Overwrite Protocol

The system manages exactly 3 fixed preset scenarios per stock symbol:
1. `Base Case` (Default)
2. `Bear Case`
3. `Bull Case`

### 💾 Database Persistence Protocol
- **API Endpoint**: `POST /api/analysis/dcf-save`
- **Overwrite Behavior**: Each stock (`symbol`) maintains at most 1 saved record per scenario name in `dcf_calculations`. Saving a scenario executes a `DELETE` for `(symbol, scenario_name)` prior to `INSERT`ing the updated parameter set.
- **Max Rows Per Symbol**: Exactly 3 rows max (`Base Case`, `Bear Case`, `Bull Case`).

### 🔄 Staged Database Execution Protocol (Local-First Validation)
When executing CLI/SQL database operations or seeding DCF scenario data:
1. **Step 1 (Local First)**: Always run the SQL execution command against the local D1 database first:
   ```bash
   npx wrangler d1 execute DB --local --command "<SQL_COMMAND>"
   ```
2. **Step 2 (Verification)**: Verify that the local command completed with exit code `0` and returned clean execution results without schema/table errors.
3. **Step 3 (Remote Execution)**: ONLY if Step 1 succeeds completely, run the exact same operation against the remote D1 database:
   ```bash
   npx wrangler d1 execute DB --remote --command "<SQL_COMMAND>"
   ```
4. **Error Handling**: If Step 1 fails (e.g. missing table, migration error, constraint violation), **STOP IMMEDIATELY**. Diagnose and fix the root cause locally before attempting any remote database command.

---

## 🖥️ Frontend UX Rules

- **Bidirectional Sync**: The Top Preset Switcher buttons (`Bear Case`, `Base Case`, `Bull Case`) and the Save Scenario Dropdown (`<Select>`) MUST remain synchronized to control the active scenario.
- **Unvalued Zero-State UX**: Selecting an unsaved scenario **MUST** display zeroed inputs (`0`) and an "Unvalued (ยังไม่ได้ประเมิน)" indicator so users clearly know it has not been calculated yet. Do NOT auto-populate fake arbitrary default numbers.
- **Saved Scenario Loading**: When switching to a scenario that has a saved calculation in D1, auto-populate the sliders and recalculate intrinsic price immediately.
- **Status Badges**: Render visual status indicators (e.g. `🟢 ($245.50)` for saved vs `⚪ (ยังไม่ได้ประเมิน)` for unsaved) on preset buttons and inside dropdown options.
- **Input Field Dimensions**: Projection table input fields must maintain a minimum width of `85px` to prevent text truncation/ellipsis.
