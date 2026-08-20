-- Add quarterly fundamental metrics columns to market_stats
ALTER TABLE market_stats ADD COLUMN gross_margin_quarterly REAL;
ALTER TABLE market_stats ADD COLUMN revenue_growth_quarterly_yoy REAL;
ALTER TABLE market_stats ADD COLUMN ebit_margin_quarterly REAL;
