-- Migration: Add mode and per-year input arrays to dcf_calculations table
ALTER TABLE dcf_calculations ADD COLUMN mode TEXT DEFAULT 'detailed';
ALTER TABLE dcf_calculations ADD COLUMN yearly_growth TEXT;
ALTER TABLE dcf_calculations ADD COLUMN yearly_op_margin TEXT;
ALTER TABLE dcf_calculations ADD COLUMN yearly_fcf_conv TEXT;
