-- Migration: Summary Custom Data (Tax Savings, Asset Categories, Portfolio Funds, Allocations, Manual Broker Overrides)
CREATE TABLE IF NOT EXISTS tax_savings (
  year INTEGER PRIMARY KEY,
  ltf REAL DEFAULT 0,
  rmf REAL DEFAULT 0,
  ssf REAL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS asset_categories (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE,
  target_weight REAL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS portfolio_funds (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE,
  broker_name TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS fund_allocations (
  category_id INTEGER NOT NULL,
  fund_id INTEGER NOT NULL,
  amount REAL NOT NULL DEFAULT 0,
  PRIMARY KEY (category_id, fund_id),
  FOREIGN KEY (category_id) REFERENCES asset_categories(id) ON DELETE CASCADE,
  FOREIGN KEY (fund_id) REFERENCES portfolio_funds(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS manual_broker_balances (
  broker_name TEXT PRIMARY KEY,
  cost_override REAL DEFAULT 0,
  balance_override REAL DEFAULT 0
);

-- Add broker_name to holdings
ALTER TABLE holdings ADD COLUMN broker_name TEXT DEFAULT 'Common Stock';

-- Seed Tax Savings
INSERT OR REPLACE INTO tax_savings (year, ltf, rmf, ssf) VALUES
(2015, 24000, 0, 0),
(2016, 10500, 0, 0),
(2017, 25000, 40000, 0),
(2018, 73000, 75500, 0),
(2019, 90000, 110000, 0),
(2020, 0, 150000, 50000),
(2021, 0, 120000, 80000),
(2022, 0, 150000, 150000),
(2023, 0, 150000, 150000),
(2024, 0, 100000, 200000),
(2025, 0, 150000, 0);

-- Seed Asset Categories
INSERT OR REPLACE INTO asset_categories (name, target_weight) VALUES
('TH', 0.0407),
('IND', 0.0742),
('VN', 0.0336),
('Global', 0.1786),
('CASH', 0.1486);

-- Seed Funds
INSERT OR REPLACE INTO portfolio_funds (name, broker_name) VALUES
('One, PRINC R&SF', 'Finnomena'),
('B RMF', 'Krungsri'),
('KF RMF', 'Krungsri'),
('KF-NDQ RMF', 'Krungsri'),
('KFUSIND RMF', 'Krungsri'),
('KFSET50 SSF(DY)', 'Krungsri'),
('SCBNDQ SSF(DY)', 'Finnomena'),
('SCB-Semi SSF(DY)', 'Finnomena'),
('SCBSET50 SSF(DY)', 'Finnomena'),
('THB', 'Cash');

-- Seed Fund Allocations
INSERT OR REPLACE INTO fund_allocations (category_id, fund_id, amount) VALUES
((SELECT id FROM asset_categories WHERE name='TH'), (SELECT id FROM portfolio_funds WHERE name='One, PRINC R&SF'), 7000),
((SELECT id FROM asset_categories WHERE name='TH'), (SELECT id FROM portfolio_funds WHERE name='KFSET50 SSF(DY)'), 40000),
((SELECT id FROM asset_categories WHERE name='TH'), (SELECT id FROM portfolio_funds WHERE name='THB'), 148100),

((SELECT id FROM asset_categories WHERE name='IND'), (SELECT id FROM portfolio_funds WHERE name='B RMF'), 157500),
((SELECT id FROM asset_categories WHERE name='IND'), (SELECT id FROM portfolio_funds WHERE name='KF RMF'), 198500),

((SELECT id FROM asset_categories WHERE name='VN'), (SELECT id FROM portfolio_funds WHERE name='One, PRINC R&SF'), 49000),
((SELECT id FROM asset_categories WHERE name='VN'), (SELECT id FROM portfolio_funds WHERE name='B RMF'), 21000),
((SELECT id FROM asset_categories WHERE name='VN'), (SELECT id FROM portfolio_funds WHERE name='KF RMF'), 91400),

((SELECT id FROM asset_categories WHERE name='Global'), (SELECT id FROM portfolio_funds WHERE name='One, PRINC R&SF'), 5700),
((SELECT id FROM asset_categories WHERE name='Global'), (SELECT id FROM portfolio_funds WHERE name='KFUSIND RMF'), 45800),
((SELECT id FROM asset_categories WHERE name='Global'), (SELECT id FROM portfolio_funds WHERE name='SCBSET50 SSF(DY)'), 805500),

((SELECT id FROM asset_categories WHERE name='CASH'), (SELECT id FROM portfolio_funds WHERE name='B RMF'), 239400),
((SELECT id FROM asset_categories WHERE name='CASH'), (SELECT id FROM portfolio_funds WHERE name='KFUSIND RMF'), 271200),
((SELECT id FROM asset_categories WHERE name='CASH'), (SELECT id FROM portfolio_funds WHERE name='SCB-Semi SSF(DY)'), 0),
((SELECT id FROM asset_categories WHERE name='CASH'), (SELECT id FROM portfolio_funds WHERE name='SCBSET50 SSF(DY)'), 2400),
((SELECT id FROM asset_categories WHERE name='CASH'), (SELECT id FROM portfolio_funds WHERE name='THB'), 200300);

-- Seed Manual Broker Overrides
INSERT OR REPLACE INTO manual_broker_balances (broker_name, cost_override, balance_override) VALUES
('BNB + Bull', 65500, 2900);
