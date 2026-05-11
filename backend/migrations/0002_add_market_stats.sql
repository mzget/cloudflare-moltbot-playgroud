DROP TABLE IF EXISTS market_stats;
CREATE TABLE market_stats (
  symbol TEXT PRIMARY KEY,
  market_cap REAL,
  revenues REAL,
  revenue_3y_cagr REAL,
  revenue_1y_growth REAL,
  gross_profit_margin REAL,
  operating_margin REAL,
  ev_ebit REAL,
  ev_sales REAL,
  p_ocf REAL,
  p_fcf REAL,
  capex_to_ocf REAL,
  rd_to_revenue REAL,
  debt_equity REAL,
  p_e REAL,
  fcf_margin REAL,
  total_cash REAL,
  net_debt REAL,
  dividend_yield REAL,
  updated_at INTEGER DEFAULT (strftime('%s', 'now'))
);
