export interface CompanyStats {
  symbol: string;              // "AAPL"
  name: string;                // "Apple Inc."
  exchange: string;            // "NasdaqGS"
  logo_url?: string;           // optional favicon/logo URL
  market_cap?: number;         // in USD
  revenues?: number;           // in USD
  revenue_3y_cagr?: number;    // decimal: 0.054 = 5.4%
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
}
