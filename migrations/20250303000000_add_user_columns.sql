-- Migration: add missing user columns for auth_api and users API compatibility.
-- Adds first_name, last_name, is_active to the users table.
-- Converts the role column from user_role enum to TEXT for string-based queries.

-- Add first_name and last_name (nullable)
ALTER TABLE users ADD COLUMN IF NOT EXISTS first_name TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS last_name TEXT;

-- Add is_active flag with default true
ALTER TABLE users ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT TRUE;

-- Convert role from user_role enum to TEXT so Rust can read it as String.
-- This is idempotent: if already TEXT it's a no-op; if enum it converts.
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'users' AND column_name = 'role'
        AND udt_name = 'user_role'
    ) THEN
        -- Drop the default first (it references the enum type)
        ALTER TABLE users ALTER COLUMN role DROP DEFAULT;
        -- Convert enum to text
        ALTER TABLE users ALTER COLUMN role TYPE TEXT USING role::text;
        -- Re-set default as plain text
        ALTER TABLE users ALTER COLUMN role SET DEFAULT 'designer';
    END IF;
END $$;
