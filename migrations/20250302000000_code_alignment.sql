-- Migration: align database schema with Rust backend model expectations.
-- Converts certain enum columns to TEXT where Rust treats them as String,
-- adds missing columns, and creates missing tables.

-- 1. Convert enum columns to TEXT where Rust code uses String
ALTER TABLE jobs ALTER COLUMN status TYPE TEXT USING status::text;
ALTER TABLE machines ALTER COLUMN machine_type TYPE TEXT USING machine_type::text;
ALTER TABLE hardware ALTER COLUMN hardware_type TYPE TEXT USING hardware_type::text;
ALTER TABLE post_processors ALTER COLUMN output_format TYPE TEXT USING output_format::text;

-- parts: part_type and grain_direction
ALTER TABLE parts ALTER COLUMN part_type TYPE TEXT USING part_type::text;
ALTER TABLE parts ALTER COLUMN grain_direction TYPE TEXT USING grain_direction::text;

-- operations: operation_type and side
ALTER TABLE operations ALTER COLUMN operation_type TYPE TEXT USING operation_type::text;
ALTER TABLE operations ALTER COLUMN side TYPE TEXT USING side::text;
ALTER TABLE operations ALTER COLUMN side DROP NOT NULL;

-- 2. Add missing columns

-- users
ALTER TABLE users ADD COLUMN IF NOT EXISTS preferences JSONB DEFAULT '{}';

-- machines
ALTER TABLE machines ADD COLUMN IF NOT EXISTS model_number TEXT;
ALTER TABLE machines ADD COLUMN IF NOT EXISTS max_x_mm DOUBLE PRECISION;
ALTER TABLE machines ADD COLUMN IF NOT EXISTS max_y_mm DOUBLE PRECISION;
ALTER TABLE machines ADD COLUMN IF NOT EXISTS max_z_mm DOUBLE PRECISION;
ALTER TABLE machines ADD COLUMN IF NOT EXISTS settings JSONB NOT NULL DEFAULT '{}';

-- post_processors
ALTER TABLE post_processors ADD COLUMN IF NOT EXISTS controller_type TEXT NOT NULL DEFAULT '';
ALTER TABLE post_processors ADD COLUMN IF NOT EXISTS file_extension TEXT NOT NULL DEFAULT '';
ALTER TABLE post_processors ADD COLUMN IF NOT EXISTS template_config JSONB NOT NULL DEFAULT '{}';

-- parts
ALTER TABLE parts ADD COLUMN IF NOT EXISTS width_mm DOUBLE PRECISION NOT NULL DEFAULT 0;
ALTER TABLE parts ADD COLUMN IF NOT EXISTS height_mm DOUBLE PRECISION NOT NULL DEFAULT 0;
ALTER TABLE parts ADD COLUMN IF NOT EXISTS thickness_mm DOUBLE PRECISION NOT NULL DEFAULT 0;
ALTER TABLE parts ADD COLUMN IF NOT EXISTS quantity INTEGER NOT NULL DEFAULT 1;
ALTER TABLE parts ADD COLUMN IF NOT EXISTS edge_banding JSONB NOT NULL DEFAULT '{}';
ALTER TABLE parts ADD COLUMN IF NOT EXISTS machining_data JSONB;
ALTER TABLE parts ADD COLUMN IF NOT EXISTS notes TEXT;

-- hardware
ALTER TABLE hardware ADD COLUMN IF NOT EXISTS unit_cost DOUBLE PRECISION;

-- materials
ALTER TABLE materials ADD COLUMN IF NOT EXISTS sku TEXT;
ALTER TABLE materials ADD COLUMN IF NOT EXISTS material_type TEXT NOT NULL DEFAULT '';
ALTER TABLE materials ADD COLUMN IF NOT EXISTS thickness_mm DOUBLE PRECISION NOT NULL DEFAULT 0;
ALTER TABLE materials ADD COLUMN IF NOT EXISTS width_mm DOUBLE PRECISION;
ALTER TABLE materials ADD COLUMN IF NOT EXISTS length_mm DOUBLE PRECISION;
ALTER TABLE materials ADD COLUMN IF NOT EXISTS supplier TEXT;
ALTER TABLE materials ADD COLUMN IF NOT EXISTS cost_per_sheet DOUBLE PRECISION;
ALTER TABLE materials ADD COLUMN IF NOT EXISTS description TEXT;

-- operations: additional columns
ALTER TABLE operations ADD COLUMN IF NOT EXISTS machine_id UUID REFERENCES machines(id) ON DELETE SET NULL;
ALTER TABLE operations ADD COLUMN IF NOT EXISTS sequence_order INTEGER NOT NULL DEFAULT 0;
ALTER TABLE operations ADD COLUMN IF NOT EXISTS feed_rate_mm_min DOUBLE PRECISION;
ALTER TABLE operations ADD COLUMN IF NOT EXISTS spindle_speed_rpm INTEGER;
ALTER TABLE operations ADD COLUMN IF NOT EXISTS depth_mm DOUBLE PRECISION;
ALTER TABLE operations ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'pending';
ALTER TABLE operations ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
ALTER TABLE operations ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

-- drawing_templates: code references both orientation and layout
ALTER TABLE drawing_templates ADD COLUMN IF NOT EXISTS orientation TEXT NOT NULL DEFAULT 'landscape';

-- part_placements: code expects a boolean rotated column
ALTER TABLE part_placements ADD COLUMN IF NOT EXISTS rotated BOOLEAN NOT NULL DEFAULT FALSE;

-- 3. Create missing tables

CREATE TABLE IF NOT EXISTS part_scan_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    part_id UUID NOT NULL REFERENCES parts(id) ON DELETE CASCADE,
    action TEXT NOT NULL,
    operator TEXT,
    scanned_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_part_scan_events_part_id ON part_scan_events (part_id);
