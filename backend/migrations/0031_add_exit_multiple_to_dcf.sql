-- Migration: Add exit_multiple and target_shares columns to dcf_calculations table
ALTER TABLE dcf_calculations ADD COLUMN exit_multiple REAL DEFAULT 20.0;
ALTER TABLE dcf_calculations ADD COLUMN target_shares REAL;
