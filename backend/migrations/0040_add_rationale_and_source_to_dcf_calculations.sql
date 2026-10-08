-- Migration: Add rationale and source columns to dcf_calculations table
ALTER TABLE dcf_calculations ADD COLUMN rationale TEXT;
ALTER TABLE dcf_calculations ADD COLUMN source TEXT DEFAULT 'manual';

