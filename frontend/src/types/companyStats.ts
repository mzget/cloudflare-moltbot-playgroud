export interface CompanyStats {
  symbol: string;              // "AAPL"
  name: string;                // "Apple Inc."
  exchange: string;            // "NasdaqGS"
  logo_url?: string;           // optional favicon/logo URL
  price?: number;              // current share price in USD
  market_cap?: number;         // in USD
  revenues?: number;           // in USD
  revenue_3y_cagr?: number;    // decimal: 0.054 = 5.4%
  revenue_5y_cagr?: number;
  revenue_1y_growth?: number;  // decimal
  gross_profit_margin?: number;// decimal
  operating_margin?: number;   // decimal
  ev_ebit?: number;
  ev_sales?: number;
  p_ocf?: number;
  p_fcf?: number;
  capex_to_ocf?: number;
  rd_to_revenue?: number;      // decimal
  debt_equity?: number;
  p_e?: number;
  fcf_margin?: number;         // decimal
  total_cash?: number;         // in USD
  net_debt?: number;           // in USD
  total_debt?: number;         // in USD
  dividend_yield?: number;     // decimal
  fifty_two_week_high?: number;
  fifty_two_week_high_date?: string;
  fifty_two_week_low?: number;
  fifty_two_week_low_date?: string;
  all_time_high?: number;
  all_time_high_date?: string;
  all_time_low?: number;
  all_time_low_date?: string;
}
