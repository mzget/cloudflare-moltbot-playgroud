-- Migration: 0047_add_unit_economics_to_stock_fundamentals.sql
-- Description: Add unit_economics_json column to stock_fundamentals for structured Business Model & Unit Economics Matrix charts (ADR-0020)

ALTER TABLE stock_fundamentals ADD COLUMN unit_economics_json TEXT;

