-- Migration: Add net_cash column to dcf_calculations table
ALTER TABLE dcf_calculations ADD COLUMN net_cash REAL NOT NULL DEFAULT 0;
