/**
 * @oaktree/shared
 * Shared domain models, constants, and pure financial/portfolio utilities.
 */

// ─── 1. Domain Types & Constants ──────────────────────────────────────────

export interface CompanyStats {
  symbol: string;
  name: string;
  exchange: string;
  logo_url?: string;
  price?: number;
  market_cap?: number;
  revenues?: number;
  revenue_3y_cagr?: number;
  revenue_5y_cagr?: number;
  revenue_1y_growth?: number;
  gross_profit_margin?: number;
  operating_margin?: number;
  gross_margin_quarterly?: number;
  revenue_growth_quarterly_yoy?: number;
  ebit_margin_quarterly?: number;
  ev_ebit?: number;
  ev_sales?: number;
  p_ocf?: number;
  p_fcf?: number;
  capex_to_ocf?: number;
  rd_to_revenue?: number;
  debt_equity?: number;
  p_e?: number;
  fcf_margin?: number;
  total_cash?: number;
  net_debt?: number;
  total_debt?: number;
  dividend_yield?: number;
  fifty_two_week_high?: number;
  fifty_two_week_high_date?: string;
  fifty_two_week_low?: number;
  fifty_two_week_low_date?: string;
  all_time_high?: number;
  all_time_high_date?: string;
  all_time_low?: number;
  all_time_low_date?: string;
  updated_at?: string;
}

export interface AnalysisCoverage {
  report: boolean;
  dcf: boolean;
  thesis: boolean;
  count: number;
}

export type AnalysisCoverageMap = Map<string, AnalysisCoverage>;

export const DCF_SCENARIO_NAMES = ['Base Case', 'Bull Case', 'Bear Case'] as const;
export type DcfScenarioName = (typeof DCF_SCENARIO_NAMES)[number];

export interface DcfScenarioInput {
  scenario_name: DcfScenarioName;
  mode?: 'detailed' | 'uniform';
  base_revenue: number;
  shares_outstanding: number; // in Millions ($M)
  net_cash?: number;          // in Billions ($B)
  wacc: number;               // in percent (%)
  terminal_growth: number;    // in percent (%)
  tax_rate?: number;          // in percent (%)
  exit_multiple?: number;     // e.g. 20.0
  target_shares?: number;     // in Millions ($M)
  implied_share_price: number;
  yearly_growth?: number[];   // 5 numbers
  yearly_op_margin?: number[];// 5 numbers
  yearly_fcf_conv?: number[]; // 5 numbers
  revenue_growth?: number;
  operating_margin?: number;
  fcf_conversion?: number;
  rationale?: string;
  source?: string;
}

export interface GuidanceInfo {
  revenue_target?: string;
  margin_target?: string;
  timeframe?: string;
  key_assumptions?: string;
  near_term?: string;
  long_term?: string;
  [key: string]: unknown;
}

export interface StockFundamental {
  symbol: string;
  business_model?: string | null;
  moat?: string | null;
  competitors?: string[] | string | null;
  guidance?: GuidanceInfo | string | null;
  key_risks?: string[] | string | null;
  thesis_kpis?: string[] | string | null;
  as_of_date: string;
  notebook_id?: string | null;
  source_count?: number | null;
  updated_at?: string | null;
}

export interface PortfolioLot {
  id?: number;
  symbol?: string;
  date: string;
  shares: number;
  cost_per_share: number;
  total_cost?: number;
  market_value?: number | null;
  day_gain_pct?: number | null;
  day_gain_amt?: number | null;
  tot_gain_pct?: number | null;
  tot_gain_amt?: number | null;
  low_limit?: number | null;
  high_limit?: number | null;
  note?: string | null;
}

export interface PortfolioTransaction {
  id?: number;
  symbol?: string;
  date: string;
  type: 'Buy' | 'Sell';
  shares: number;
  cost_per_share: number;
  commission?: number;
  total_cost?: number;
  realized_gain_pct?: number | null;
  realized_gain_amt?: number | null;
  note?: string | null;
}

// ─── 2. Pure Utilities ────────────────────────────────────────────────────

/**
 * Sorts transactions chronologically to ensure FIFO lot matching behaves correctly.
 * If dates are identical, Buy transactions are processed before Sell transactions
 * so that open lots are created before they are deducted.
 * Does not mutate the input array.
 */
export function sortTransactions<T extends { date: string; type?: string }>(
  transactions: readonly T[] | T[]
): T[] {
  if (!Array.isArray(transactions)) return [];
  return [...transactions].sort((a, b) => {
    const timeA = new Date(a.date).getTime();
    const timeB = new Date(b.date).getTime();
    if (timeA !== timeB) {
      return timeA - timeB;
    }
    const typeA = a.type || 'Buy';
    const typeB = b.type || 'Buy';
    if (typeA === typeB) return 0;
    return typeA === 'Buy' ? -1 : 1;
  });
}

/**
 * Calculates Compound Annual Growth Rate (CAGR).
 * Formula: (endValue / startValue) ** (1 / years) - 1.
 * Returns decimal growth rate (e.g. 0.10 for 10%).
 * Gracefully returns 0 for non-positive start values, zero/negative years, or invalid inputs.
 */
export function calculateCAGR(
  startValue: number,
  endValue: number,
  years: number
): number {
  if (
    typeof startValue !== 'number' ||
    typeof endValue !== 'number' ||
    typeof years !== 'number' ||
    isNaN(startValue) ||
    isNaN(endValue) ||
    isNaN(years)
  ) {
    return 0;
  }
  if (years <= 0 || startValue <= 0 || endValue < 0) {
    return 0;
  }
  return Math.pow(endValue / startValue, 1 / years) - 1;
}

/**
 * Calculates the discount factor for a given discount rate and year period.
 * Formula: 1 / (1 + rate) ** year.
 * Returns 1 for year 0, and 0 for negative year or non-viable rate.
 */
export function calculateDiscountFactor(rate: number, year: number): number {
  if (
    typeof rate !== 'number' ||
    typeof year !== 'number' ||
    isNaN(rate) ||
    isNaN(year) ||
    year < 0
  ) {
    return 0;
  }
  if (year === 0) return 1;
  const base = 1 + rate;
  if (base <= 0) return 0;
  return 1 / Math.pow(base, year);
}

/**
 * Rounds a number to a fixed number of decimal places using exponential-safe rounding.
 */
export function roundTo(value: number, decimals: number = 2): number {
  if (typeof value !== 'number' || isNaN(value) || !isFinite(value)) return 0;
  const factor = Math.pow(10, decimals);
  return Math.round((value + Number.EPSILON) * factor) / factor;
}

/**
 * Formats a monetary number into standard comma-separated currency string (e.g. "$1,234.56" or "-$1,234.56").
 * Returns '--' for null, undefined, or NaN values.
 */
export function formatCurrency(
  value: number | null | undefined,
  currency: string = '$'
): string {
  if (value === null || value === undefined || typeof value !== 'number' || isNaN(value)) {
    return '--';
  }
  const isNegative = value < 0;
  const absVal = Math.abs(value);
  const formatted = absVal.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return isNegative ? `-${currency}${formatted}` : `${currency}${formatted}`;
}

/**
 * Formats a percentage value into fixed-decimal percent string (e.g. "12.35%").
 * Returns '--' for null, undefined, or NaN values.
 */
export function formatPercent(
  value: number | null | undefined,
  decimals: number = 2
): string {
  if (value === null || value === undefined || typeof value !== 'number' || isNaN(value)) {
    return '--';
  }
  return `${value.toFixed(decimals)}%`;
}

// ─── 3. Portfolio Risk & Sizing Engine ─────────────────────────────────────
export * from './portfolioRisk';
