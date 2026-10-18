-- Migration: 0042_add_debate_to_stock_fundamentals.sql
-- Description: Add debate_json column to stock_fundamentals for storing Gemini-generated Bull vs. Bear Dialectical Debate (ADR 0011)

ALTER TABLE stock_fundamentals ADD COLUMN debate_json TEXT;
