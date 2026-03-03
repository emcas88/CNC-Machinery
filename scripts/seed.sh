#!/usr/bin/env bash
set -euo pipefail

# CNC Machinery - Database seed script
# Inserts representative sample data for development / demo purposes

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(dirname "$SCRIPT_DIR")"

cd "$ROOT_DIR"

DB_CONTAINER="cnc-machinery-db-1"
DB_USER="cnc_user"
DB_NAME="cnc_machinery"

run_sql() {
  docker compose exec -T db psql -U "$DB_USER" -d "$DB_NAME" <<< "$1"
}

echo "Seeding database with sample data..."

# ---------------------------------------------------------------------------
# Texture Groups
# ---------------------------------------------------------------------------
run_sql "
INSERT INTO texture_groups (name) VALUES
  ('Wood Grain'),
  ('Solid Colour'),
  ('Stone & Concrete'),
  ('Metallic')
ON CONFLICT DO NOTHING;
"

# ---------------------------------------------------------------------------
# Textures
# ---------------------------------------------------------------------------
run_sql "
INSERT INTO textures (name, abbreviation, sheen, grain_orientation) VALUES
  ('Oak Natural',          'OAK-N',   'satin',      'horizontal'),
  ('Walnut Dark',          'WAL-D',   'satin',      'horizontal'),
  ('White Matt',           'WHT-M',   'flat',       'none'),
  ('Anthracite Grey',      'ANT-G',   'satin',      'none'),
  ('Concrete Look',        'CON-L',   'flat',       'none'),
  ('Brushed Aluminium',    'ALU-B',   'semi_gloss',  'horizontal')
ON CONFLICT DO NOTHING;
"

# ---------------------------------------------------------------------------
# Materials
# ---------------------------------------------------------------------------
run_sql "
INSERT INTO materials (name, cutlist_name, abbreviation, category, default_width, default_length, thickness, cost_per_unit, cost_unit) VALUES
  ('18mm MDF',          '18MDF',   'MDF18',  'sheet_good',   1220, 2440, 18, 45.00,  'per_sheet'),
  ('16mm HMR MDF',      '16HMR',   'HMR16',  'sheet_good',   1220, 2440, 16, 55.00,  'per_sheet'),
  ('12mm Plywood BB',   '12PLY',   'PLY12',  'sheet_good',   1220, 2440, 12, 60.00,  'per_sheet'),
  ('18mm Plywood BB',   '18PLY',   'PLY18',  'sheet_good',   1220, 2440, 18, 75.00,  'per_sheet'),
  ('0.5mm ABS Edge',    'ABS05',   'ABS05',  'edge_banding', 0,    0,     0.5, 8.00, 'per_linear_ft'),
  ('2mm ABS Edge',      'ABS2',    'ABS2',   'edge_banding', 0,    0,     2,   12.00,'per_linear_ft')
ON CONFLICT DO NOTHING;
"

# ---------------------------------------------------------------------------
# Construction Methods
# ---------------------------------------------------------------------------
run_sql '
INSERT INTO construction_methods (name, joinery_type, fastener_specs) VALUES
  ($$Confirmat Screw$$,   ARRAY[$$dado$$,$$confirmat$$],   $${"size": "7x50mm", "pilot": 5}$$::jsonb),
  ($$Domino Joinery$$,    ARRAY[$$domino$$],               $${"size": "8x40mm"}$$::jsonb),
  ($$Dowel & Glue$$,      ARRAY[$$dowel$$],                $${"diameter": 8, "length": 35}$$::jsonb)
ON CONFLICT DO NOTHING;
'

# ---------------------------------------------------------------------------
# Hardware
# ---------------------------------------------------------------------------
run_sql '
INSERT INTO hardware (name, brand, model_name, hardware_type, drilling_pattern) VALUES
  ($$Clip-Top 110 Hinge$$, $$Blum$$, $$CLIP top 110°$$,  $$hinge$$,  $${"cup": 35, "boring": 9.5, "backset": 37}$$::jsonb),
  ($$Tandem 500mm Slide$$, $$Blum$$, $$Tandem 563H$$,    $$slide$$,  $${"height": 13, "spacing": 37}$$::jsonb),
  ($$Bar Handle 160mm$$,   $$Hafele$$,$$7083x$$,          $$handle$$, $${}$$::jsonb)
ON CONFLICT DO NOTHING;
'

# ---------------------------------------------------------------------------
# Post Processors
# ---------------------------------------------------------------------------
run_sql "
INSERT INTO post_processors (name, machine_type, output_format, template_content) VALUES
  ('Generic G-Code',   'nesting_router', 'g_code', ''),
  ('Homag MPR',        'point_to_point', 'mpr',    ''),
  ('SCM XCS',          'nesting_router', 'xcs',    '')
ON CONFLICT DO NOTHING;
"

# ---------------------------------------------------------------------------
# Tools
# ---------------------------------------------------------------------------
run_sql "
INSERT INTO tools (name, diameter, tool_type, rpm, feed_rate, plunge_rate, max_depth_per_pass) VALUES
  ('10mm Compression',  10, 'compression_cutter', 18000, 8000, 3000, 8),
  ('8mm Down-Shear',     8, 'down_shear',         20000, 6000, 2000, 6),
  ('5mm Drill Bit',      5, 'drill_bit',          4000,  1000,  800, 30)
ON CONFLICT DO NOTHING;
"

# ---------------------------------------------------------------------------
# Users
# ---------------------------------------------------------------------------
run_sql '
INSERT INTO users (email, name, password_hash, role) VALUES
  ($$admin@cnc.local$$,    $$Admin User$$,    $$\$2a\$10\$placeholder_hash_admin$$,    $$super_admin$$),
  ($$designer@cnc.local$$, $$Jane Designer$$, $$\$2a\$10\$placeholder_hash_designer$$, $$designer$$),
  ($$operator@cnc.local$$, $$John Operator$$, $$\$2a\$10\$placeholder_hash_operator$$, $$cnc_operator$$)
ON CONFLICT (email) DO NOTHING;
'

# ---------------------------------------------------------------------------
# Sample Job, Room, Products
# ---------------------------------------------------------------------------
docker compose exec -T db psql -U "$DB_USER" -d "$DB_NAME" <<'EOSQL'
DO $fn$
DECLARE
  v_job_id  UUID;
  v_room_id UUID;
BEGIN
  INSERT INTO jobs (name, client_name, address, status)
  VALUES ('Kitchen Reno - Smith', 'Smith Family', '12 Maple St, Auckland', 'active')
  RETURNING id INTO v_job_id;

  INSERT INTO rooms (job_id, name, width, height, depth)
  VALUES (v_job_id, 'Kitchen', 4200, 2400, 600)
  RETURNING id INTO v_room_id;

  INSERT INTO products (room_id, name, product_type, cabinet_style, width, height, depth)
  VALUES
    (v_room_id, 'Base Cabinet 600', 'base_cabinet', 'frameless', 600, 720, 580),
    (v_room_id, 'Wall Cabinet 600', 'wall_cabinet',  'frameless', 600, 720, 320),
    (v_room_id, 'Tall Pantry 600',  'tall_cabinet',  'frameless', 600, 2100, 580);
END;
$fn$;
EOSQL

echo "Seed complete."
