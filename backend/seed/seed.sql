-- =============================================================================
-- CNC Cabinet Manufacturing Software - Seed Data
-- Feature 19: Seed Data Script
-- =============================================================================
-- This script is idempotent. Re-running it will not duplicate data.
-- It uses stable UUIDs so relationships between entities remain consistent
-- across multiple runs. All dimensions are in millimetres (mm).
-- =============================================================================

BEGIN;

-- =============================================================================
-- 1. TEXTURE GROUPS
-- =============================================================================

INSERT INTO texture_groups (id, name)
VALUES
    ('a1000000-0000-0000-0000-000000000001', 'Birch Plywood'),
    ('a1000000-0000-0000-0000-000000000002', 'Maple Plywood'),
    ('a1000000-0000-0000-0000-000000000003', 'Oak Plywood'),
    ('a1000000-0000-0000-0000-000000000004', 'Walnut Plywood'),
    ('a1000000-0000-0000-0000-000000000005', 'MDF'),
    ('a1000000-0000-0000-0000-000000000006', 'Melamine'),
    ('a1000000-0000-0000-0000-000000000007', 'Solid Maple'),
    ('a1000000-0000-0000-0000-000000000008', 'Solid Oak'),
    ('a1000000-0000-0000-0000-000000000009', 'Solid Walnut'),
    ('a1000000-0000-0000-0000-000000000010', 'Solid Cherry')
ON CONFLICT (id) DO NOTHING;

COMMIT;
