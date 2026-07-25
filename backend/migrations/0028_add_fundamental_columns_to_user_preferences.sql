-- Migration to add fundamental_columns to user_preferences table
ALTER TABLE user_preferences ADD COLUMN fundamental_columns TEXT;
