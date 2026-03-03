-- Migration: add first_name, last_name, is_active columns and convert role to TEXT
-- This migration is idempotent; columns are added only if they do not already exist.

-- Add first_name column
ALTER TABLE users ADD COLUMN IF NOT EXISTS first_name TEXT;

-- Add last_name column
ALTER TABLE users ADD COLUMN IF NOT EXISTS last_name TEXT;

-- Add is_active column with a default of TRUE
ALTER TABLE users ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT TRUE;

-- Backfill is_active for existing rows
UPDATE users SET is_active = TRUE WHERE is_active IS NULL;

-- Convert role column from enum to TEXT if it is still stored as the user_role enum type.
-- Using a safe two-step approach: add a new TEXT column, copy data, drop old, rename.
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'users'
          AND column_name = 'role'
          AND data_type = 'USER-DEFINED'
    ) THEN
        ALTER TABLE users ADD COLUMN role_text TEXT;
        UPDATE users SET role_text = role::text;
        ALTER TABLE users DROP COLUMN role;
        ALTER TABLE users RENAME COLUMN role_text TO role;
    END IF;
END
$$;
