-- SQL script to clear all portfolio-related tables in the database
-- This deletes all records but keeps the table structures intact.

DELETE FROM holdings;
DELETE FROM share_lots;
DELETE FROM transactions;
DELETE FROM dividends;
DELETE FROM portfolio_holdings;
DELETE FROM portfolio_history;
DELETE FROM portfolio_daily_history;

-- Reset SQLite auto-increment counters for these tables
DELETE FROM sqlite_sequence WHERE name IN (
  'holdings',
  'share_lots',
  'transactions',
  'dividends',
  'portfolio_holdings',
  'portfolio_history',
  'portfolio_daily_history'
);
