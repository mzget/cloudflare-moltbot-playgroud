-- Migration: Create historical_prices table to cache Yahoo Finance closing prices
CREATE TABLE IF NOT EXISTS historical_prices (
  symbol TEXT NOT NULL,
  date TEXT NOT NULL, -- 'YYYY-MM-DD'
  close REAL NOT NULL,
  PRIMARY KEY (symbol, date)
);
