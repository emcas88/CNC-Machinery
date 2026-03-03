-- =============================================================================
-- CNC Cabinet Manufacturing Software - Schema Alignment Migration
-- Migration: 20250301000000_schema_alignment.sql
--
-- Adds missing columns and tables that the Rust API code expects but the
-- database schema does not yet have. All statements are idempotent.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. jobs.due_date
-- ---------------------------------------------------------------------------
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS due_date TIMESTAMP WITH TIME ZONE;

-- ---------------------------------------------------------------------------
-- 2. hardware - missing columns (sku, description, cost, unit_of_measure, supplier)
-- ---------------------------------------------------------------------------
ALTER TABLE hardware ADD COLUMN IF NOT EXISTS sku TEXT NOT NULL DEFAULT '';
ALTER TABLE hardware ADD COLUMN IF NOT EXISTS description TEXT;
ALTER TABLE hardware ADD COLUMN IF NOT EXISTS cost DOUBLE PRECISION NOT NULL DEFAULT 0.0;
ALTER TABLE hardware ADD COLUMN IF NOT EXISTS unit_of_measure TEXT NOT NULL DEFAULT 'each';
ALTER TABLE hardware ADD COLUMN IF NOT EXISTS supplier TEXT;

-- ---------------------------------------------------------------------------
-- 3. machines - missing columns (manufacturer, max_spindle_speed, max_feed_rate,
--    max_z_travel, atc_positions, firmware)
-- ---------------------------------------------------------------------------
ALTER TABLE machines ADD COLUMN IF NOT EXISTS manufacturer TEXT NOT NULL DEFAULT '';
ALTER TABLE machines ADD COLUMN IF NOT EXISTS max_spindle_speed INTEGER NOT NULL DEFAULT 24000;
ALTER TABLE machines ADD COLUMN IF NOT EXISTS max_feed_rate DOUBLE PRECISION NOT NULL DEFAULT 20000.0;
ALTER TABLE machines ADD COLUMN IF NOT EXISTS max_z_travel DOUBLE PRECISION NOT NULL DEFAULT 200.0;
ALTER TABLE machines ADD COLUMN IF NOT EXISTS atc_positions INTEGER NOT NULL DEFAULT 8;
ALTER TABLE machines ADD COLUMN IF NOT EXISTS firmware TEXT;

-- ---------------------------------------------------------------------------
-- 4. sheets - referenced by gcode.rs API
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS sheets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    optimization_run_id UUID REFERENCES optimization_runs(id) ON DELETE CASCADE,
    material_id UUID REFERENCES materials(id) ON DELETE SET NULL,
    width DOUBLE PRECISION NOT NULL,
    length DOUBLE PRECISION NOT NULL,
    material_thickness DOUBLE PRECISION NOT NULL DEFAULT 18.0,
    program_name TEXT,
    material TEXT,
    machine_id UUID REFERENCES machines(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sheets_optimization_run_id ON sheets(optimization_run_id);
CREATE INDEX IF NOT EXISTS idx_sheets_material_id ON sheets(material_id);
CREATE INDEX IF NOT EXISTS idx_sheets_machine_id ON sheets(machine_id);

-- ---------------------------------------------------------------------------
-- 5. part_placements - referenced by gcode.rs API
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS part_placements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sheet_id UUID REFERENCES sheets(id) ON DELETE CASCADE,
    part_id UUID REFERENCES parts(id) ON DELETE CASCADE,
    x DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    y DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    rotation DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    flipped BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_part_placements_sheet_id ON part_placements(sheet_id);
CREATE INDEX IF NOT EXISTS idx_part_placements_part_id ON part_placements(part_id);

-- ---------------------------------------------------------------------------
-- 6. operations - operation_type, operation_side enums and columns already exist
-- 7. output_format - enum type and post_processors.output_format already exist
-- No changes needed for items 6 and 7.
-- ---------------------------------------------------------------------------
