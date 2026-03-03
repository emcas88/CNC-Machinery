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

-- =============================================================================
-- 2. TEXTURES  (5+ entries with UV / grain data)
-- =============================================================================

INSERT INTO textures (
    id, name, abbreviation, image_url,
    sheen, grain_orientation,
    transparency, metallicness,
    visual_width, visual_height, rotation_angle,
    texture_group_id
)
VALUES
    -- Birch
    ('b1000000-0000-0000-0000-000000000001',
     'Baltic Birch – Natural',       'BB-NAT',
     'https://assets.cnc-cabinet.app/textures/birch_natural.jpg',
     'satin',      'vertical',   0.0, 0.0, 1220.0, 2440.0, 0.0,
     'a1000000-0000-0000-0000-000000000001'),

    -- Maple
    ('b1000000-0000-0000-0000-000000000002',
     'Hard Maple Plywood – Clear',   'MP-CLR',
     'https://assets.cnc-cabinet.app/textures/maple_clear.jpg',
     'satin',      'vertical',   0.0, 0.0, 1220.0, 2440.0, 0.0,
     'a1000000-0000-0000-0000-000000000002'),

    -- Oak
    ('b1000000-0000-0000-0000-000000000003',
     'Red Oak Plywood – Rift Cut',   'RO-RIFT',
     'https://assets.cnc-cabinet.app/textures/oak_rift.jpg',
     'semi_gloss', 'vertical',   0.0, 0.0, 1220.0, 2440.0, 0.0,
     'a1000000-0000-0000-0000-000000000003'),

    -- Walnut
    ('b1000000-0000-0000-0000-000000000004',
     'American Walnut Plywood',      'WAL-PLY',
     'https://assets.cnc-cabinet.app/textures/walnut_ply.jpg',
     'satin',      'vertical',   0.0, 0.0, 1220.0, 2440.0, 0.0,
     'a1000000-0000-0000-0000-000000000004'),

    -- MDF
    ('b1000000-0000-0000-0000-000000000005',
     'MDF – Raw',                    'MDF-RAW',
     'https://assets.cnc-cabinet.app/textures/mdf_raw.jpg',
     'flat',       'none',       0.0, 0.0, 1220.0, 2440.0, 0.0,
     'a1000000-0000-0000-0000-000000000005'),

    -- Melamine White
    ('b1000000-0000-0000-0000-000000000006',
     'Melamine – Gloss White',       'MEL-WHT',
     'https://assets.cnc-cabinet.app/textures/melamine_white.jpg',
     'high_gloss',  'none',      0.0, 0.0, 1220.0, 2440.0, 0.0,
     'a1000000-0000-0000-0000-000000000006'),

    -- Melamine Dove Grey
    ('b1000000-0000-0000-0000-000000000007',
     'Melamine – Dove Grey',         'MEL-DGY',
     'https://assets.cnc-cabinet.app/textures/melamine_dove_grey.jpg',
     'semi_gloss',  'none',      0.0, 0.0, 1220.0, 2440.0, 0.0,
     'a1000000-0000-0000-0000-000000000006'),

    -- Solid Maple
    ('b1000000-0000-0000-0000-000000000008',
     'Solid Hard Maple – Select',    'SM-SEL',
     'https://assets.cnc-cabinet.app/textures/solid_maple.jpg',
     'satin',      'vertical',   0.0, 0.0,  100.0,  600.0, 0.0,
     'a1000000-0000-0000-0000-000000000007'),

    -- Solid Oak
    ('b1000000-0000-0000-0000-000000000009',
     'Solid White Oak – Quartersawn','SO-QS',
     'https://assets.cnc-cabinet.app/textures/solid_oak_qs.jpg',
     'satin',      'vertical',   0.0, 0.0,  100.0,  600.0, 0.0,
     'a1000000-0000-0000-0000-000000000008'),

    -- Solid Walnut
    ('b1000000-0000-0000-0000-000000000010',
     'Solid Walnut – #1 Common',     'SW-1C',
     'https://assets.cnc-cabinet.app/textures/solid_walnut.jpg',
     'satin',      'vertical',   0.0, 0.0,  100.0,  600.0, 0.0,
     'a1000000-0000-0000-0000-000000000009')
ON CONFLICT (id) DO NOTHING;

-- =============================================================================
-- 3. MATERIALS  (15+ entries)
-- Dimensions in mm; cost in USD.
-- Standard sheet = 1220 × 2440 mm (4×8 ft)
-- Oversize sheet  = 1525 × 3050 mm (5×10 ft) where applicable
-- =============================================================================

INSERT INTO materials (
    id, name, cutlist_name, abbreviation,
    category,
    default_width, default_length, thickness,
    cost_per_unit, cost_unit,
    texture_group_id
)
VALUES
    -- ── Sheet Goods: Plywood ────────────────────────────────────────────────────────

    ('c1000000-0000-0000-0000-000000000001',
     'Baltic Birch 18mm 4×8',        'BB 18',   'BB18',
     'sheet_good', 1220.0, 2440.0, 18.0,
     78.50, 'per_sheet',
     'a1000000-0000-0000-0000-000000000001'),

    ('c1000000-0000-0000-0000-000000000002',
     'Baltic Birch 12mm 4×8',        'BB 12',   'BB12',
     'sheet_good', 1220.0, 2440.0, 12.0,
     62.00, 'per_sheet',
     'a1000000-0000-0000-0000-000000000001'),

    ('c1000000-0000-0000-0000-000000000003',
     'Baltic Birch 6mm 4×8',         'BB 6',    'BB6',
     'sheet_good', 1220.0, 2440.0,  6.0,
     45.00, 'per_sheet',
     'a1000000-0000-0000-0000-000000000001'),

    ('c1000000-0000-0000-0000-000000000004',
     'Hard Maple Ply 19mm 4×8',      'MP 19',   'MP19',
     'sheet_good', 1220.0, 2440.0, 19.0,
     94.00, 'per_sheet',
     'a1000000-0000-0000-0000-000000000002'),

    ('c1000000-0000-0000-0000-000000000005',
     'Red Oak Ply 19mm 4×8',         'RO 19',   'RO19',
     'sheet_good', 1220.0, 2440.0, 19.0,
     88.00, 'per_sheet',
     'a1000000-0000-0000-0000-000000000003'),

    ('c1000000-0000-0000-0000-000000000006',
     'American Walnut Ply 19mm 4×8', 'WAL 19',  'WAL19',
     'sheet_good', 1220.0, 2440.0, 19.0,
     145.00, 'per_sheet',
     'a1000000-0000-0000-0000-000000000004'),

    -- ── Sheet Goods: MDF ─────────────────────────────────────────────────────────

    ('c1000000-0000-0000-0000-000000000007',
     'MDF 18mm 4×8',                 'MDF 18',  'MDF18',
     'sheet_good', 1220.0, 2440.0, 18.0,
     38.00, 'per_sheet',
     'a1000000-0000-0000-0000-000000000005'),

    ('c1000000-0000-0000-0000-000000000008',
     'MDF 12mm 4×8',                 'MDF 12',  'MDF12',
     'sheet_good', 1220.0, 2440.0, 12.0,
     28.00, 'per_sheet',
     'a1000000-0000-0000-0000-000000000005'),

    -- ── Sheet Goods: Melamine ──────────────────────────────────────────────────

    ('c1000000-0000-0000-0000-000000000009',
     'Melamine White 16mm 4×8',      'MEL-W 16','MEW16',
     'sheet_good', 1220.0, 2440.0, 16.0,
     52.00, 'per_sheet',
     'a1000000-0000-0000-0000-000000000006'),

    ('c1000000-0000-0000-0000-000000000010',
     'Melamine Dove Grey 16mm 4×8',  'MEL-DG 16','MEDG16',
     'sheet_good', 1220.0, 2440.0, 16.0,
     56.00, 'per_sheet',
     'a1000000-0000-0000-0000-000000000006'),

    ('c1000000-0000-0000-0000-000000000011',
     'Melamine Graphite 18mm 5×10',  'MEL-GR 18','MEGR18',
     'sheet_good', 1525.0, 3050.0, 18.0,
     87.00, 'per_sheet',
     'a1000000-0000-0000-0000-000000000006'),

    -- ── Solid Wood ──────────────────────────────────────────────────────────────────

    ('c1000000-0000-0000-0000-000000000012',
     'Hard Maple S4S',               'SM S4S',  'SMP',
     'solid_wood',  150.0, 2400.0,  19.0,
     9.50, 'per_board_ft',
     'a1000000-0000-0000-0000-000000000007'),

    ('c1000000-0000-0000-0000-000000000013',
     'White Oak S4S',                'SO S4S',  'SOK',
     'solid_wood',  150.0, 2400.0,  19.0,
     11.25, 'per_board_ft',
     'a1000000-0000-0000-0000-000000000008'),

    ('c1000000-0000-0000-0000-000000000014',
     'Walnut S4S',                   'SW S4S',  'SWL',
     'solid_wood',  150.0, 2400.0,  19.0,
     18.00, 'per_board_ft',
     'a1000000-0000-0000-0000-000000000009'),

    ('c1000000-0000-0000-0000-000000000015',
     'Cherry S4S',                   'SCH S4S', 'SCH',
     'solid_wood',  150.0, 2400.0,  19.0,
     12.50, 'per_board_ft',
     'a1000000-0000-0000-0000-000000000010'),

    -- ── Edge Banding ────────────────────────────────────────────────────────────────

    ('c1000000-0000-0000-0000-000000000016',
     'PVC Edge Banding White 23×0.4mm', 'PVC EB W',  'EBPW',
     'edge_banding',  23.0, 50000.0,  0.4,
     0.18, 'per_linear_ft',
     NULL),

    ('c1000000-0000-0000-0000-000000000017',
     'PVC Edge Banding White 23×2mm',   'PVC EB W2', 'EBPW2',
     'edge_banding',  23.0, 50000.0,  2.0,
     0.32, 'per_linear_ft',
     NULL),

    ('c1000000-0000-0000-0000-000000000018',
     'Real Wood Edge Banding Birch 22×0.6mm', 'RW EB BB', 'EBRB',
     'edge_banding',  22.0, 50000.0,  0.6,
     0.55, 'per_linear_ft',
     NULL),

    ('c1000000-0000-0000-0000-000000000019',
     'Real Wood Edge Banding Maple 22×0.6mm', 'RW EB MP', 'EBRM',
     'edge_banding',  22.0, 50000.0,  0.6,
     0.65, 'per_linear_ft',
     NULL),

    ('c1000000-0000-0000-0000-000000000020',
     'Real Wood Edge Banding Walnut 22×0.6mm','RW EB WL', 'EBRWL',
     'edge_banding',  22.0, 50000.0,  0.6,
     1.10, 'per_linear_ft',
     NULL)
ON CONFLICT (id) DO NOTHING;

-- =============================================================================
-- 4. CONSTRUCTION METHODS  (4 entries)
-- =============================================================================

INSERT INTO construction_methods (
    id, name, joinery_type, fastener_specs, placement_rules
)
VALUES
    ('d1000000-0000-0000-0000-000000000001',
     'Frameless (32mm System)',
     ARRAY['dowel','cam_lock','confirmat'],
     '{
         "primary": {"type": "dowel",     "diameter_mm": 8,  "length_mm": 35, "spacing_mm": 32},
         "secondary":{"type": "cam_lock", "diameter_mm": 15, "depth_mm": 13.5}
     }'::JSONB,
     '{
         "door_overlay":      {"top_mm": 0, "bottom_mm": 0, "side_mm": 0},
         "door_gap_mm":       2,
         "shelf_pin_hole_dia_mm": 5,
         "shelf_pin_setback_mm": 37,
         "nailer_height_mm":  75,
         "toe_kick_height_mm":130
     }'::JSONB
    ),

    ('d1000000-0000-0000-0000-000000000002',
     'Face-Frame Traditional',
     ARRAY['confirmat','pocket_screw','glue'],
     '{
         "primary":  {"type": "confirmat",    "diameter_mm": 7, "length_mm": 50},
         "secondary":{"type": "pocket_screw", "size": "#8", "length_in": 1.25}
     }'::JSONB,
     '{
         "face_frame_width_mm":  38,
         "face_frame_overlap_mm": 0,
         "inset_reveal_mm":      3,
         "door_overlay_mm":      0,
         "toe_kick_height_mm":   90,
         "nailer_height_mm":     75
     }'::JSONB
    ),

    ('d1000000-0000-0000-0000-000000000003',
     'Inset Full-Overlay',
     ARRAY['dowel','confirmat'],
     '{
         "primary":{"type": "dowel", "diameter_mm": 8, "length_mm": 35, "spacing_mm": 64}
     }'::JSONB,
     '{
         "door_inset_gap_mm":  1.5,
         "drawer_inset_gap_mm":1.5,
         "face_frame_width_mm":38,
         "nailer_height_mm":   75,
         "toe_kick_height_mm": 90
     }'::JSONB
    ),

    ('d1000000-0000-0000-0000-000000000004',
     'Hybrid (Frameless + Face-Frame)',
     ARRAY['dowel','pocket_screw','cam_lock'],
     '{
         "primary":  {"type": "dowel",       "diameter_mm": 8,  "length_mm": 35, "spacing_mm": 32},
         "secondary":{"type": "pocket_screw","size": "#8",      "length_in": 1.25}
     }'::JSONB,
     '{
         "face_frame_width_mm":  25,
         "door_overlay_mm":      12,
         "toe_kick_height_mm":  130,
         "nailer_height_mm":     75
     }'::JSONB
    )
ON CONFLICT (id) DO NOTHING;

-- =============================================================================
-- 5. POST PROCESSORS  (3+ entries)
-- =============================================================================

INSERT INTO post_processors (
    id, name, machine_type, output_format,
    template_content, variables
)
VALUES
    -- Mach3 (G-code)
    ('e1000000-0000-0000-0000-000000000001',
     'Mach3 Nesting Router',
     'nesting_router',
     'g_code',
     E'%\nO{program_number}\n(PROGRAM: {program_name})\n(DATE: {date})\n(MATERIAL: {material_name} {thickness}mm)\n(SHEET: {sheet_index} of {sheet_total})\nG21         (Metric)\nG90         (Absolute)\nG17         (XY Plane)\nF{feed_rate}\nS{spindle_speed} M03\nG00 Z{safe_z}\n{toolpaths}\nG00 Z{safe_z}\nM05\nM30\n%\n',
     '{
         "program_number":  {"type": "integer",  "default": 1000},
         "program_name":    {"type": "string",   "default": "CABINET_PART"},
         "safe_z":          {"type": "float",    "default": 10.0},
         "feed_rate":       {"type": "float",    "default": 6000.0},
         "spindle_speed":   {"type": "integer",  "default": 18000},
         "plunge_rate":     {"type": "float",    "default": 1500.0},
         "date":            {"type": "datetime", "format": "YYYY-MM-DD"},
         "material_name":   {"type": "string"},
         "thickness":       {"type": "float"},
         "sheet_index":     {"type": "integer"},
         "sheet_total":     {"type": "integer"},
         "toolpaths":       {"type": "toolpath_block"}
     }'::JSONB
    ),

    -- Fanuc (NC tape format)
    ('e1000000-0000-0000-0000-000000000002',
     'Fanuc 0i-MD Panel Saw',
     'beam_saw',
     'nc',
     E'%\nO{program_number}\nN10 G21 G90 G94\nN20 G28 Z0.0\nN30 T{tool_number} M06\nN40 S{spindle_speed} M03\nN50 G00 X{start_x} Y{start_y}\nN60 G43 H{tool_number} Z{safe_z}\n{toolpaths}\nN{last_seq} G91 G28 Z0.0 M05\nN{last_seq+10} M30\n%\n',
     '{
         "program_number":  {"type": "integer",  "default": 100},
         "tool_number":     {"type": "integer",  "default": 1},
         "spindle_speed":   {"type": "integer",  "default": 16000},
         "safe_z":          {"type": "float",    "default": 50.0},
         "feed_rate":       {"type": "float",    "default": 5000.0},
         "start_x":         {"type": "float",    "default": 0.0},
         "start_y":         {"type": "float",    "default": 0.0},
         "sequence_start":  {"type": "integer",  "default": 70},
         "sequence_step":   {"type": "integer",  "default": 10},
         "toolpaths":       {"type": "toolpath_block"}
     }'::JSONB
    ),

    -- ShopBot OpenSBP
    ('e1000000-0000-0000-0000-000000000003',
     'ShopBot PRSalpha Nesting',
     'nesting_router',
     'tap',
     E'''ShopBot OpenSBP Post-Processor\nVS,{spindle_speed}\nVD,,{plunge_rate}\nVD,{feed_rate},\nSF\nJZ,{safe_z}\n{toolpaths}\nJZ,{safe_z}\nEND\n',
     '{
         "spindle_speed":   {"type": "integer",  "default": 18000},
         "feed_rate":       {"type": "float",    "default": 150.0,  "unit": "in/min"},
         "plunge_rate":     {"type": "float",    "default": 60.0,   "unit": "in/min"},
         "safe_z":          {"type": "float",    "default": 0.4,    "unit": "inches"},
         "units":           {"type": "string",   "default": "inches"},
         "toolpaths":       {"type": "toolpath_block"}
     }'::JSONB
    ),

    -- Biesse Rover (CIX / MPR)
    ('e1000000-0000-0000-0000-000000000004',
     'Biesse Rover Point-to-Point',
     'point_to_point',
     'cix',
     E'[HEADER]\nProgramName={program_name}\nWorkpieceLength={length}\nWorkpieceWidth={width}\nWorkpieceThickness={thickness}\nNumFaces=6\n[OPERATIONS]\n{operations}\n[END]\n',
     '{
         "program_name":   {"type": "string"},
         "length":         {"type": "float"},
         "width":          {"type": "float"},
         "thickness":      {"type": "float"},
         "operations":     {"type": "operation_block"},
         "tool_prefix":    {"type": "string", "default": "T"},
         "face_mapping":   {"type": "object",
                            "value": {"top":1,"bottom":2,"front":3,"back":4,"left":5,"right":6}}
     }'::JSONB
    )
ON CONFLICT (id) DO NOTHING;

-- =============================================================================
-- 6. MACHINES  (5 entries)
-- spoilboard dimensions in mm
-- =============================================================================

INSERT INTO machines (
    id, name, brand, model_name,
    machine_type, post_processor_id,
    spoilboard_width, spoilboard_length, spoilboard_thickness,
    tool_magazine
)
VALUES
    -- 3-axis Nesting Router
    ('f1000000-0000-0000-0000-000000000001',
     'CNC Nesting Router #1',
     'Thermwood',
     'Model 45 – 5×10',
     'nesting_router',
     'e1000000-0000-0000-0000-000000000001',
     1525.0, 3050.0, 18.0,
     '[
         {"slot": 1, "tool_id": null, "label": "1/4\" Compression"},
         {"slot": 2, "tool_id": null, "label": "1/2\" Compression"},
         {"slot": 3, "tool_id": null, "label": "5mm Drill Bit"},
         {"slot": 4, "tool_id": null, "label": "8mm Drill Bit"},
         {"slot": 5, "tool_id": null, "label": "35mm Forstner"},
         {"slot": 6, "tool_id": null, "label": "1/4\" Flush Trim"},
         {"slot": 7, "tool_id": null, "label": "V-Groove 90°"},
         {"slot": 8, "tool_id": null, "label": "Spare"}
     ]'::JSONB
    ),

    -- 5-axis Nesting Router
    ('f1000000-0000-0000-0000-000000000002',
     'CNC 5-Axis Router #2',
     'SCM',
     'Accord 40 FX',
     'nesting_router',
     'e1000000-0000-0000-0000-000000000001',
     1525.0, 3100.0, 18.0,
     '[
         {"slot": 1, "tool_id": null, "label": "1/4\" Compression"},
         {"slot": 2, "tool_id": null, "label": "1/2\" Compression"},
         {"slot": 3, "tool_id": null, "label": "5mm Drill Bit"},
         {"slot": 4, "tool_id": null, "label": "8mm Drill Bit"},
         {"slot": 5, "tool_id": null, "label": "10mm Drill Bit"},
         {"slot": 6, "tool_id": null, "label": "35mm Forstner"},
         {"slot": 7, "tool_id": null, "label": "Profile Bit Roundover 1/4\""},
         {"slot": 8, "tool_id": null, "label": "Profile Bit Chamfer 45°"},
         {"slot": 9, "tool_id": null, "label": "Flush Trim Solid Carbide"},
         {"slot":10, "tool_id": null, "label": "Spare"}
     ]'::JSONB
    ),

    -- Point-to-Point Boring Machine
    ('f1000000-0000-0000-0000-000000000003',
     'Boring Machine #1',
     'Biesse',
     'Rover B FT 1232',
     'point_to_point',
     'e1000000-0000-0000-0000-000000000004',
     1200.0, 3200.0, 18.0,
     '[
         {"slot": 1, "tool_id": null, "label": "5mm Vertical Drill"},
         {"slot": 2, "tool_id": null, "label": "8mm Vertical Drill"},
         {"slot": 3, "tool_id": null, "label": "35mm Forstner Hinge"},
         {"slot": 4, "tool_id": null, "label": "Horizontal Drill 8mm"},
         {"slot": 5, "tool_id": null, "label": "Saw Blade 100mm"}
     ]'::JSONB
    ),

    -- Beam (Panel) Saw
    ('f1000000-0000-0000-0000-000000000004',
     'Panel Saw #1',
     'HOLZHER',
     'Linea 6015 Dynamic',
     'beam_saw',
     'e1000000-0000-0000-0000-000000000002',
     2100.0, 4400.0, 18.0,
     '[
         {"slot": 1, "tool_id": null, "label": "Main Saw 350mm 72T"},
         {"slot": 2, "tool_id": null, "label": "Scoring Saw 120mm"}
     ]'::JSONB
    ),

    -- Drill & Dowel
    ('f1000000-0000-0000-0000-000000000005',
     'Drill & Dowel Inserter #1',
     'Ligmatech',
     'ZET 1 Centateq',
     'drill_and_dowel',
     NULL,
     1200.0, 2440.0, 18.0,
     '[
         {"slot": 1, "tool_id": null, "label": "8mm Dowel Drill"},
         {"slot": 2, "tool_id": null, "label": "Glue Injector"}
     ]'::JSONB
    )
ON CONFLICT (id) DO NOTHING;

-- =============================================================================
-- 7. TOOLS  (15+ entries – router bits, drill bits, saw blades)
-- diameter in mm, feed_rate & plunge_rate in mm/min
-- =============================================================================

INSERT INTO tools (
    id, name, diameter,
    tool_type, rpm, feed_rate, plunge_rate, max_depth_per_pass
)
VALUES
    -- ── Compression Cutters ────────────────────────────────────────────────────────
    ('g1000000-0000-0000-0000-000000000001',
     '1/4" (6.35mm) Compression Cutter – Solid Carbide',
     6.35, 'compression_cutter', 18000, 4000.0, 1200.0, 6.0),

    ('g1000000-0000-0000-0000-000000000002',
     '3/8" (9.525mm) Compression Cutter – Solid Carbide',
     9.525, 'compression_cutter', 16000, 5000.0, 1500.0, 8.0),

    ('g1000000-0000-0000-0000-000000000003',
     '1/2" (12.7mm) Compression Cutter – Solid Carbide',
     12.7, 'compression_cutter', 14000, 6000.0, 1800.0, 10.0),

    -- ── Down-Shear Bits ───────────────────────────────────────────────────────────
    ('g1000000-0000-0000-0000-000000000004',
     '1/4" Down-Shear Spiral – Solid Carbide',
     6.35, 'down_shear', 18000, 3500.0, 1000.0, 5.0),

    ('g1000000-0000-0000-0000-000000000005',
     '1/2" Down-Shear Spiral – Solid Carbide',
     12.7, 'down_shear', 14000, 5500.0, 1500.0, 8.0),

    -- ── Up-Cut Spiral ─────────────────────────────────────────────────────────────────
    ('g1000000-0000-0000-0000-000000000006',
     '1/4" Up-Cut Spiral – Solid Carbide',
     6.35, 'up_cut', 18000, 4000.0, 1200.0, 6.0),

    -- ── Profile Bits ────────────────────────────────────────────────────────────────
    ('g1000000-0000-0000-0000-000000000007',
     '1/4" Roundover Bit – 1/4" Radius',
     12.7, 'profile_bit', 18000, 3000.0,  800.0, 3.0),

    ('g1000000-0000-0000-0000-000000000008',
     '45° Chamfer Bit – 1/2" Shank',
     25.4, 'profile_bit', 16000, 4000.0, 1000.0, 4.0),

    ('g1000000-0000-0000-0000-000000000009',
     'Ogee Profile Bit – Classical – 1/2" Shank',
     31.75, 'profile_bit', 14000, 2500.0,  600.0, 2.0),

    ('g1000000-0000-0000-0000-000000000010',
     'Flush Trim Bit – 1/2" Diameter – 1" Cut Length',
     12.7, 'profile_bit', 18000, 4500.0, 1200.0, 10.0),

    -- ── Dovetail ──────────────────────────────────────────────────────────────────
    ('g1000000-0000-0000-0000-000000000011',
     '14° Dovetail Bit – 1/2" Shank – 10mm Dia',
     10.0, 'dovetail', 16000, 2000.0,  600.0, 4.0),

    -- ── Drill Bits ───────────────────────────────────────────────────────────────────
    ('g1000000-0000-0000-0000-000000000012',
     '5mm Shelf Pin Drill Bit – Solid Carbide',
     5.0, 'drill_bit', 4000, 1200.0, 600.0, 35.0),

    ('g1000000-0000-0000-0000-000000000013',
     '8mm Dowel Drill Bit – Solid Carbide',
     8.0, 'drill_bit', 3500, 1000.0, 500.0, 38.0),

    ('g1000000-0000-0000-0000-000000000014',
     '10mm Confirmat Bit – Step Drill',
     10.0, 'drill_bit', 3000,  900.0, 450.0, 50.0),

    ('g1000000-0000-0000-0000-000000000015',
     '35mm Forstner Hinge Boring Bit',
     35.0, 'drill_bit', 1200,  600.0, 300.0, 14.0),

    -- ── Saw Blade ──────────────────────────────────────────────────────────────────
    ('g1000000-0000-0000-0000-000000000016',
     'Panel Saw Blade 350mm 72T TCG',
     350.0, 'profile_bit', 3800, 8000.0, 200.0, 80.0),

    ('g1000000-0000-0000-0000-000000000017',
     'Scoring Saw Blade 120mm 24T',
     120.0, 'profile_bit', 8000, 6000.0, 200.0, 4.0)
ON CONFLICT (id) DO NOTHING;

-- =============================================================================
-- 8. HARDWARE  (20+ entries)
-- =============================================================================

INSERT INTO hardware (
    id, name, brand, model_name,
    hardware_type, drilling_pattern, parameters
)
VALUES
    -- ── Hinges ───────────────────────────────────────────────────────────────────
    ('h1000000-0000-0000-0000-000000000001',
     'Soft-Close Concealed Hinge – Full Overlay',
     'Blum', 'CLIP top BLUMOTION 110°',
     'hinge',
     '{"holes": [{"x":0,"y":0,"dia":35,"depth":13.5,"type":"cup"},
                 {"x":0,"y":48,"dia":8,"depth":12,"type":"mounting"}]}'::JSONB,
     '{"overlay_mm":0,"inset_mm":0,"opening_angle":110,
       "soft_close":true,"opening_force":"medium",
       "cup_bore_dia_mm":35,"cup_bore_depth_mm":13.5,
       "arm_setback_mm":3.5}'::JSONB
    ),

    ('h1000000-0000-0000-0000-000000000002',
     'Soft-Close Concealed Hinge – Half Overlay',
     'Blum', 'CLIP top BLUMOTION 110° Half',
     'hinge',
     '{"holes": [{"x":0,"y":0,"dia":35,"depth":13.5,"type":"cup"},
                 {"x":0,"y":48,"dia":8,"depth":12,"type":"mounting"}]}'::JSONB,
     '{"overlay_mm":-9.5,"opening_angle":110,
       "soft_close":true,"arm_setback_mm":3.5}'::JSONB
    ),

    ('h1000000-0000-0000-0000-000000000003',
     'Soft-Close Concealed Hinge – Inset',
     'Blum', 'CLIP top BLUMOTION 110° Inset',
     'hinge',
     '{"holes": [{"x":0,"y":0,"dia":35,"depth":13.5,"type":"cup"},
                 {"x":0,"y":48,"dia":8,"depth":12,"type":"mounting"}]}'::JSONB,
     '{"overlay_mm":-18,"opening_angle":110,
       "soft_close":true,"arm_setback_mm":3.5}'::JSONB
    ),

    ('h1000000-0000-0000-0000-000000000004',
     'Standard Euro Hinge – Full Overlay (No Damper)',
     'Grass', 'TIOMOS 110° Full',
     'hinge',
     '{"holes": [{"x":0,"y":0,"dia":35,"depth":12,"type":"cup"},
                 {"x":0,"y":48,"dia":8,"depth":11,"type":"mounting"}]}'::JSONB,
     '{"overlay_mm":0,"opening_angle":110,"soft_close":false}'::JSONB
    ),

    ('h1000000-0000-0000-0000-000000000005',
     'Wide-Angle Hinge 170° – Full Overlay',
     'Blum', 'CLIP top 170°',
     'hinge',
     '{"holes": [{"x":0,"y":0,"dia":35,"depth":13.5,"type":"cup"},
                 {"x":0,"y":48,"dia":8,"depth":12,"type":"mounting"}]}'::JSONB,
     '{"overlay_mm":0,"opening_angle":170,"soft_close":false}'::JSONB
    ),

    -- ── Drawer Slides ────────────────────────────────────────────────────────────
    ('h1000000-0000-0000-0000-000000000006',
     'Side-Mount Under-Mount Slide 450mm – Soft-Close Full Extension',
     'Blum', 'TANDEM 563H – 450mm',
     'slide',
     '{"mounting": "under_mount",
       "holes": [{"x":0,"y":0,"dia":5,"depth":8,"type":"mounting"},
                 {"x":450,"y":0,"dia":5,"depth":8,"type":"mounting"}]}'::JSONB,
     '{"length_mm":450,"extension":"full","soft_close":true,
       "load_capacity_kg":30,"side_clearance_mm":0}'::JSONB
    ),

    ('h1000000-0000-0000-0000-000000000007',
     'Side-Mount Under-Mount Slide 500mm – Soft-Close Full Extension',
     'Blum', 'TANDEM 563H – 500mm',
     'slide',
     '{"mounting": "under_mount",
       "holes": [{"x":0,"y":0,"dia":5,"depth":8,"type":"mounting"},
                 {"x":500,"y":0,"dia":5,"depth":8,"type":"mounting"}]}'::JSONB,
     '{"length_mm":500,"extension":"full","soft_close":true,
       "load_capacity_kg":30,"side_clearance_mm":0}'::JSONB
    ),

    ('h1000000-0000-0000-0000-000000000008',
     'Side-Mount Slide 400mm – Soft-Close Full Extension',
     'King Slide', 'KS3832 – 400mm',
     'slide',
     '{"mounting": "side_mount",
       "holes": [{"x":0,"y":0,"dia":4,"depth":7,"type":"mounting"},
                 {"x":400,"y":0,"dia":4,"depth":7,"type":"mounting"}]}'::JSONB,
     '{"length_mm":400,"extension":"full","soft_close":true,
       "load_capacity_kg":35,"side_clearance_mm":12.7}'::JSONB
    ),

    ('h1000000-0000-0000-0000-000000000009',
     'Heavy-Duty Side Mount Slide 600mm – Full Extension',
     'Accuride', '3832-EC – 600mm',
     'slide',
     '{"mounting": "side_mount",
       "holes": [{"x":0,"y":0,"dia":4,"depth":7,"type":"mounting"},
                 {"x":600,"y":0,"dia":4,"depth":7,"type":"mounting"}]}'::JSONB,
     '{"length_mm":600,"extension":"full","soft_close":false,
       "load_capacity_kg":68,"side_clearance_mm":12.7}'::JSONB
    ),

    -- ── Handles ───────────────────────────────────────────────────────────────────
    ('h1000000-0000-0000-0000-000000000010',
     'Bar Handle Stainless – 128mm CC',
     'Berenson', 'Metro 128mm CC',
     'handle',
     '{"holes": [{"x":0,"y":0,"dia":5,"depth":20,"type":"through"},
                 {"x":128,"y":0,"dia":5,"depth":20,"type":"through"}]}'::JSONB,
     '{"center_to_center_mm":128,"finish":"brushed_stainless",
       "style":"bar","projection_mm":32}'::JSONB
    ),

    ('h1000000-0000-0000-0000-000000000011',
     'Cup Pull Satin Brass – 64mm CC',
     'Liberty', 'Twist Cup Pull',
     'handle',
     '{"holes": [{"x":0,"y":0,"dia":5,"depth":20,"type":"through"},
                 {"x":64,"y":0,"dia":5,"depth":20,"type":"through"}]}'::JSONB,
     '{"center_to_center_mm":64,"finish":"satin_brass",
       "style":"cup","projection_mm":22}'::JSONB
    ),

    ('h1000000-0000-0000-0000-000000000012',
     'Round Knob Matte Black – 1-1/4" Dia',
     'Amerock', 'Blackrock 31.75mm',
     'handle',
     '{"holes": [{"x":0,"y":0,"dia":4.7,"depth":18,"type":"through"}]}'::JSONB,
     '{"center_to_center_mm":0,"finish":"matte_black","style":"knob",
       "diameter_mm":31.75,"projection_mm":25}'::JSONB
    ),

    ('h1000000-0000-0000-0000-000000000013',
     'Finger Pull Integrated Aluminum – 900mm',
     'Sugatsune', 'HGN-15',
     'handle',
     '{"holes": [{"x":0,"y":0,"dia":4,"depth":12,"type":"mounting"},
                 {"x":900,"y":0,"dia":4,"depth":12,"type":"mounting"}]}'::JSONB,
     '{"length_mm":900,"finish":"anodized_aluminum","style":"edge_pull",
       "projection_mm":0}'::JSONB
    ),

    -- ── Connectors ──────────────────────────────────────────────────────────────────
    ('h1000000-0000-0000-0000-000000000014',
     'Cam Lock 15mm – 2-Piece',
     'Häfele', 'Rafix 15',
     'connector',
     '{"holes": [{"x":0,"y":0,"dia":15,"depth":13.5,"type":"cam"},
                 {"x":0,"y":0,"dia":5,"depth":28,"type":"pin"}]}'::JSONB,
     '{"cam_dia_mm":15,"pin_dia_mm":5,"assembled_thickness_mm":32}'::JSONB
    ),

    ('h1000000-0000-0000-0000-000000000015',
     'Cam Lock 20mm – Heavy-Duty',
     'Häfele', 'Rafix 20',
     'connector',
     '{"holes": [{"x":0,"y":0,"dia":20,"depth":16,"type":"cam"},
                 {"x":0,"y":0,"dia":5,"depth":32,"type":"pin"}]}'::JSONB,
     '{"cam_dia_mm":20,"pin_dia_mm":5,"assembled_thickness_mm":38}'::JSONB
    ),

    -- ── Fasteners ─────────────────────────────────────────────────────────────────
    ('h1000000-0000-0000-0000-000000000016',
     'Confirmat Screw 7×50mm – Zinc',
     'Häfele', 'Confirmat 7×50',
     'fastener',
     '{"holes": [{"x":0,"y":0,"dia":7,"depth":50,"type":"pilot"}]}'::JSONB,
     '{"diameter_mm":7,"length_mm":50,"drive":"hex4",
       "material":"zinc_plated_steel"}'::JSONB
    ),

    ('h1000000-0000-0000-0000-000000000017',
     'Confirmat Screw 7×70mm – Zinc',
     'Häfele', 'Confirmat 7×70',
     'fastener',
     '{"holes": [{"x":0,"y":0,"dia":7,"depth":70,"type":"pilot"}]}'::JSONB,
     '{"diameter_mm":7,"length_mm":70,"drive":"hex4",
       "material":"zinc_plated_steel"}'::JSONB
    ),

    ('h1000000-0000-0000-0000-000000000018',
     'Shelf Pin 5mm – Nickel Plated Steel',
     'Knape & Vogt', 'N256-S',
     'fastener',
     '{"holes": [{"x":0,"y":0,"dia":5,"depth":16,"type":"shelf_pin"}]}'::JSONB,
     '{"diameter_mm":5,"stem_length_mm":16,"shelf_support_mm":8,
       "finish":"nickel"}'::JSONB
    ),

    ('h1000000-0000-0000-0000-000000000019',
     '8mm Wood Dowel Pin 35mm – Grooved',
     'Häfele', 'Connecting Dowel 8×35',
     'fastener',
     '{"holes": [{"x":0,"y":0,"dia":8,"depth":17,"type":"dowel"}]}'::JSONB,
     '{"diameter_mm":8,"length_mm":35,"groove":true,
       "material":"beech"}'::JSONB
    ),

    ('h1000000-0000-0000-0000-000000000020',
     'Minifix Cam Lock T15 – Zinc',
     'Häfele', 'Minifix 15',
     'connector',
     '{"holes": [{"x":0,"y":0,"dia":15,"depth":12.5,"type":"cam"},
                 {"x":0,"y":0,"dia":5,"depth":24,"type":"bolt"}]}'::JSONB,
     '{"cam_dia_mm":15,"bolt_dia_mm":5,"panel_thickness_min_mm":16,
       "tightening_torque_nm":2.5}'::JSONB
    ),

    ('h1000000-0000-0000-0000-000000000021',
     'Drawer-to-Cabinet Soft-Close Lift Up Mechanism',
     'Blum', 'AVENTOS HS',
     'hinge',
     '{"holes": [{"x":0,"y":0,"dia":5,"depth":12,"type":"mounting"},
                 {"x":64,"y":0,"dia":5,"depth":12,"type":"mounting"}]}'::JSONB,
     '{"lift_up":true,"soft_close":true,"weight_capacity_kg":15,
       "door_height_range_mm":[400,700]}'::JSONB
    )
ON CONFLICT (id) DO NOTHING;

-- =============================================================================
-- 9. USERS (sample shop staff)
-- =============================================================================

INSERT INTO users (
    id, email, name, password_hash, role, permissions
)
VALUES
    ('u1000000-0000-0000-0000-000000000001',
     'admin@cabinet-shop.com', 'Alex Martinez',
     '$argon2id$v=19$m=65536,t=3,p=4$example_hash_do_not_use_1',
     'super_admin', '{}'::JSONB),

    ('u1000000-0000-0000-0000-000000000002',
     'designer@cabinet-shop.com', 'Jordan Lee',
     '$argon2id$v=19$m=65536,t=3,p=4$example_hash_do_not_use_2',
     'designer', '{"can_approve_quotes": true}'::JSONB),

    ('u1000000-0000-0000-0000-000000000003',
     'cnc@cabinet-shop.com', 'Riley Thompson',
     '$argon2id$v=19$m=65536,t=3,p=4$example_hash_do_not_use_3',
     'cnc_operator', '{}'::JSONB),

    ('u1000000-0000-0000-0000-000000000004',
     'floor@cabinet-shop.com', 'Casey Williams',
     '$argon2id$v=19$m=65536,t=3,p=4$example_hash_do_not_use_4',
     'shop_floor', '{}'::JSONB)
ON CONFLICT (id) DO NOTHING;

-- =============================================================================
-- 10. MATERIAL TEMPLATE
-- =============================================================================

INSERT INTO material_templates (id, name, assignments)
VALUES
    ('mt000000-0000-0000-0000-000000000001',
     'Standard Kitchen – Birch/Melamine',
     '{
         "side":          "c1000000-0000-0000-0000-000000000001",
         "top":           "c1000000-0000-0000-0000-000000000001",
         "bottom":        "c1000000-0000-0000-0000-000000000001",
         "back":          "c1000000-0000-0000-0000-000000000002",
         "shelf":         "c1000000-0000-0000-0000-000000000001",
         "door":          "c1000000-0000-0000-0000-000000000001",
         "drawer_front":  "c1000000-0000-0000-0000-000000000001",
         "drawer_side":   "c1000000-0000-0000-0000-000000000009",
         "drawer_bottom": "c1000000-0000-0000-0000-000000000003",
         "edge_band":     "c1000000-0000-0000-0000-000000000018"
     }'::JSONB
    )
ON CONFLICT (id) DO NOTHING;

-- =============================================================================
-- 11. SAMPLE JOB: Kitchen Renovation
-- =============================================================================

INSERT INTO jobs (
    id, name, client_name, address,
    status, tags, assigned_designer, notes,
    default_construction_method_id,
    default_material_template_id
)
VALUES
    ('j1000000-0000-0000-0000-000000000001',
     'Kitchen Renovation – Johnson Residence',
     'Michael & Sarah Johnson',
     '742 Evergreen Terrace, Springfield, IL 62701',
     'active',
     ARRAY['kitchen','bath','laundry','2026'],
     'Jordan Lee',
     'Full gut renovation. Client prefers natural birch with brushed-stainless hardware. '
     'Upper cabinets to ceiling with crown moulding. Island requires waterfall detail.',
     'd1000000-0000-0000-0000-000000000001',
     'mt000000-0000-0000-0000-000000000001'
    )
ON CONFLICT (id) DO NOTHING;

-- =============================================================================
-- 12. ROOMS  (3 rooms)
-- =============================================================================

INSERT INTO rooms (
    id, job_id, name,
    width, height, depth,
    notes
)
VALUES
    ('r1000000-0000-0000-0000-000000000001',
     'j1000000-0000-0000-0000-000000000001',
     'Kitchen',
     4800.0, 2700.0, 620.0,
     'Open-plan kitchen. Island 1200×900mm. Ceiling soffit to 2700mm.'),

    ('r1000000-0000-0000-0000-000000000002',
     'j1000000-0000-0000-0000-000000000001',
     'Master Bath',
     2400.0, 2400.0, 550.0,
     'Double vanity, his-and-hers. Floating wall cabinet above mirror.'),

    ('r1000000-0000-0000-0000-000000000003',
     'j1000000-0000-0000-0000-000000000001',
     'Laundry Room',
     2100.0, 2400.0, 600.0,
     'Built-in above washer/dryer. Drop zone locker unit on end wall.')
ON CONFLICT (id) DO NOTHING;

-- =============================================================================
-- 13. PRODUCTS  (8 cabinets across the 3 rooms)
-- All dimensions in mm.
-- =============================================================================

INSERT INTO products (
    id, room_id, name,
    product_type, cabinet_style,
    width, height, depth,
    position_x, position_y, position_z,
    face_definition, interior_definition
)
VALUES
    -- Kitchen ─────────────────────────────────────────────────────────────────────

    ('p1000000-0000-0000-0000-000000000001',
     'r1000000-0000-0000-0000-000000000001',
     'Base Cabinet – 3 Drawer',
     'base_cabinet', 'frameless',
     600.0, 870.0, 580.0,
     0.0, 0.0, 0.0,
     '{"doors": 0, "drawers": 3, "drawer_heights": [150, 150, 550]}'::JSONB,
     '{"shelves": 0, "dividers": 0}'::JSONB
    ),

    ('p1000000-0000-0000-0000-000000000002',
     'r1000000-0000-0000-0000-000000000001',
     'Base Cabinet – 2 Door 1 Drawer',
     'base_cabinet', 'frameless',
     900.0, 870.0, 580.0,
     600.0, 0.0, 0.0,
     '{"doors": 2, "drawers": 1, "drawer_heights": [150]}'::JSONB,
     '{"shelves": 1, "adjustable": true}'::JSONB
    ),

    ('p1000000-0000-0000-0000-000000000003',
     'r1000000-0000-0000-0000-000000000001',
     'Wall Cabinet – 2 Door',
     'wall_cabinet', 'frameless',
     900.0, 720.0, 320.0,
     600.0, 1980.0, 0.0,
     '{"doors": 2, "drawers": 0}'::JSONB,
     '{"shelves": 2, "adjustable": true}'::JSONB
    ),

    ('p1000000-0000-0000-0000-000000000004',
     'r1000000-0000-0000-0000-000000000001',
     'Wall Cabinet – Corner (Blind)',
     'wall_cabinet', 'frameless',
     600.0, 720.0, 320.0,
     0.0, 1980.0, 0.0,
     '{"doors": 1, "drawers": 0, "corner": "blind_left"}'::JSONB,
     '{"shelves": 2, "adjustable": true}'::JSONB
    ),

    ('p1000000-0000-0000-0000-000000000005',
     'r1000000-0000-0000-0000-000000000001',
     'Tall Pantry Cabinet',
     'tall_cabinet', 'frameless',
     600.0, 2400.0, 580.0,
     1500.0, 0.0, 0.0,
     '{"doors": 2, "drawers": 0}'::JSONB,
     '{"shelves": 5, "adjustable": true, "pull_out_shelves": 2}'::JSONB
    ),

    -- Master Bath ────────────────────────────────────────────────────────────────

    ('p1000000-0000-0000-0000-000000000006',
     'r1000000-0000-0000-0000-000000000002',
     'Vanity Double – 4 Drawer 2 Door',
     'vanity', 'frameless',
     1500.0, 860.0, 530.0,
     0.0, 0.0, 0.0,
     '{"doors": 2, "drawers": 4, "drawer_heights": [120,120,120,120]}'::JSONB,
     '{"sink_cutout": true, "sink_positions": [375, 1125], "shelves": 0}'::JSONB
    ),

    ('p1000000-0000-0000-0000-000000000007',
     'r1000000-0000-0000-0000-000000000002',
     'Wall Mirror Cabinet – Double',
     'wall_cabinet', 'frameless',
     1500.0, 750.0, 150.0,
     0.0, 1250.0, 0.0,
     '{"doors": 2, "mirror_doors": true}'::JSONB,
     '{"shelves": 3, "adjustable": false}'::JSONB
    ),

    -- Laundry ───────────────────────────────────────────────────────────────────

    ('p1000000-0000-0000-0000-000000000008',
     'r1000000-0000-0000-0000-000000000003',
     'Laundry Locker Unit – 3 Door',
     'tall_cabinet', 'frameless',
     900.0, 2100.0, 580.0,
     0.0, 0.0, 0.0,
     '{"doors": 3, "drawers": 1, "drawer_heights": [180]}'::JSONB,
     '{"shelves": 6, "adjustable": false, "coat_rod": true}'::JSONB
    )
ON CONFLICT (id) DO NOTHING;

-- =============================================================================
-- 14. PARTS  (30+ parts – one per structural member per cabinet)
-- All dimensions in mm.
-- =============================================================================

INSERT INTO parts (
    id, product_id, name,
    part_type, length, width, thickness,
    material_id, texture_id,
    grain_direction,
    edge_band_top, edge_band_bottom, edge_band_left, edge_band_right
)
VALUES

-- ── Product 1: Base Cabinet 3-Drawer (600 × 870 × 580) ────────────────────────
-- Carcass: sides 870−36=834 tall, depth 580-18=562, back dado 6mm

    ('pt000000-0000-0000-0000-000000000001',
     'p1000000-0000-0000-0000-000000000001', 'Left Side',
     'side', 834.0, 562.0, 18.0,
     'c1000000-0000-0000-0000-000000000001',
     'b1000000-0000-0000-0000-000000000001',
     'vertical', 1, NULL, 1, NULL),

    ('pt000000-0000-0000-0000-000000000002',
     'p1000000-0000-0000-0000-000000000001', 'Right Side',
     'side', 834.0, 562.0, 18.0,
     'c1000000-0000-0000-0000-000000000001',
     'b1000000-0000-0000-0000-000000000001',
     'vertical', 1, NULL, NULL, 1),

    ('pt000000-0000-0000-0000-000000000003',
     'p1000000-0000-0000-0000-000000000001', 'Bottom',
     'bottom', 564.0, 562.0, 18.0,
     'c1000000-0000-0000-0000-000000000001',
     'b1000000-0000-0000-0000-000000000001',
     'horizontal', NULL, 1, NULL, NULL),

    ('pt000000-0000-0000-0000-000000000004',
     'p1000000-0000-0000-0000-000000000001', 'Top Rail',
     'rail', 564.0,  96.0, 18.0,
     'c1000000-0000-0000-0000-000000000001',
     'b1000000-0000-0000-0000-000000000001',
     'horizontal', 1, NULL, NULL, NULL),

    ('pt000000-0000-0000-0000-000000000005',
     'p1000000-0000-0000-0000-000000000001', 'Back Panel',
     'back', 834.0, 564.0, 6.0,
     'c1000000-0000-0000-0000-000000000003',
     'b1000000-0000-0000-0000-000000000001',
     'none', NULL, NULL, NULL, NULL),

    ('pt000000-0000-0000-0000-000000000006',
     'p1000000-0000-0000-0000-000000000001', 'Drawer Front – Top',
     'drawer_front', 564.0, 140.0, 18.0,
     'c1000000-0000-0000-0000-000000000001',
     'b1000000-0000-0000-0000-000000000001',
     'vertical', 1, 1, 1, 1),

    ('pt000000-0000-0000-0000-000000000007',
     'p1000000-0000-0000-0000-000000000001', 'Drawer Front – Mid',
     'drawer_front', 564.0, 140.0, 18.0,
     'c1000000-0000-0000-0000-000000000001',
     'b1000000-0000-0000-0000-000000000001',
     'vertical', 1, 1, 1, 1),

    ('pt000000-0000-0000-0000-000000000008',
     'p1000000-0000-0000-0000-000000000001', 'Drawer Front – Bottom',
     'drawer_front', 564.0, 530.0, 18.0,
     'c1000000-0000-0000-0000-000000000001',
     'b1000000-0000-0000-0000-000000000001',
     'vertical', 1, 1, 1, 1),

-- ── Product 2: Base Cabinet 2-Door 1-Drawer (900 × 870 × 580) ──────────────────

    ('pt000000-0000-0000-0000-000000000009',
     'p1000000-0000-0000-0000-000000000002', 'Left Side',
     'side', 834.0, 562.0, 18.0,
     'c1000000-0000-0000-0000-000000000001',
     'b1000000-0000-0000-0000-000000000001',
     'vertical', 1, NULL, 1, NULL),

    ('pt000000-0000-0000-0000-000000000010',
     'p1000000-0000-0000-0000-000000000002', 'Right Side',
     'side', 834.0, 562.0, 18.0,
     'c1000000-0000-0000-0000-000000000001',
     'b1000000-0000-0000-0000-000000000001',
     'vertical', 1, NULL, NULL, 1),

    ('pt000000-0000-0000-0000-000000000011',
     'p1000000-0000-0000-0000-000000000002', 'Bottom',
     'bottom', 864.0, 562.0, 18.0,
     'c1000000-0000-0000-0000-000000000001',
     'b1000000-0000-0000-0000-000000000001',
     'horizontal', NULL, 1, NULL, NULL),

    ('pt000000-0000-0000-0000-000000000012',
     'p1000000-0000-0000-0000-000000000002', 'Shelf',
     'shelf', 864.0, 543.0, 18.0,
     'c1000000-0000-0000-0000-000000000001',
     'b1000000-0000-0000-0000-000000000001',
     'horizontal', 1, NULL, NULL, NULL),

    ('pt000000-0000-0000-0000-000000000013',
     'p1000000-0000-0000-0000-000000000002', 'Back Panel',
     'back', 834.0, 864.0, 6.0,
     'c1000000-0000-0000-0000-000000000003',
     'b1000000-0000-0000-0000-000000000001',
     'none', NULL, NULL, NULL, NULL),

    ('pt000000-0000-0000-0000-000000000014',
     'p1000000-0000-0000-0000-000000000002', 'Door Left',
     'door', 828.0, 432.0, 18.0,
     'c1000000-0000-0000-0000-000000000001',
     'b1000000-0000-0000-0000-000000000001',
     'vertical', 1, 1, 1, 1),

    ('pt000000-0000-0000-0000-000000000015',
     'p1000000-0000-0000-0000-000000000002', 'Door Right',
     'door', 828.0, 432.0, 18.0,
     'c1000000-0000-0000-0000-000000000001',
     'b1000000-0000-0000-0000-000000000001',
     'vertical', 1, 1, 1, 1),

-- ── Product 3: Wall Cabinet 2-Door (900 × 720 × 320) ────────────────────────

    ('pt000000-0000-0000-0000-000000000016',
     'p1000000-0000-0000-0000-000000000003', 'Left Side',
     'side', 684.0, 302.0, 18.0,
     'c1000000-0000-0000-0000-000000000001',
     'b1000000-0000-0000-0000-000000000001',
     'vertical', 1, 1, 1, NULL),

    ('pt000000-0000-0000-0000-000000000017',
     'p1000000-0000-0000-0000-000000000003', 'Right Side',
     'side', 684.0, 302.0, 18.0,
     'c1000000-0000-0000-0000-000000000001',
     'b1000000-0000-0000-0000-000000000001',
     'vertical', 1, 1, NULL, 1),

    ('pt000000-0000-0000-0000-000000000018',
     'p1000000-0000-0000-0000-000000000003', 'Top',
     'top', 864.0, 302.0, 18.0,
     'c1000000-0000-0000-0000-000000000001',
     'b1000000-0000-0000-0000-000000000001',
     'horizontal', 1, NULL, NULL, NULL),

    ('pt000000-0000-0000-0000-000000000019',
     'p1000000-0000-0000-0000-000000000003', 'Bottom',
     'bottom', 864.0, 302.0, 18.0,
     'c1000000-0000-0000-0000-000000000001',
     'b1000000-0000-0000-0000-000000000001',
     'horizontal', 1, 1, NULL, NULL),

    ('pt000000-0000-0000-0000-000000000020',
     'p1000000-0000-0000-0000-000000000003', 'Shelf 1',
     'shelf', 864.0, 283.0, 18.0,
     'c1000000-0000-0000-0000-000000000001',
     'b1000000-0000-0000-0000-000000000001',
     'horizontal', 1, NULL, NULL, NULL),

    ('pt000000-0000-0000-0000-000000000021',
     'p1000000-0000-0000-0000-000000000003', 'Shelf 2',
     'shelf', 864.0, 283.0, 18.0,
     'c1000000-0000-0000-0000-000000000001',
     'b1000000-0000-0000-0000-000000000001',
     'horizontal', 1, NULL, NULL, NULL),

    ('pt000000-0000-0000-0000-000000000022',
     'p1000000-0000-0000-0000-000000000003', 'Door Left',
     'door', 680.0, 432.0, 18.0,
     'c1000000-0000-0000-0000-000000000001',
     'b1000000-0000-0000-0000-000000000001',
     'vertical', 1, 1, 1, 1),

    ('pt000000-0000-0000-0000-000000000023',
     'p1000000-0000-0000-0000-000000000003', 'Door Right',
     'door', 680.0, 432.0, 18.0,
     'c1000000-0000-0000-0000-000000000001',
     'b1000000-0000-0000-0000-000000000001',
     'vertical', 1, 1, 1, 1),

    ('pt000000-0000-0000-0000-000000000024',
     'p1000000-0000-0000-0000-000000000003', 'Back Panel',
     'back', 684.0, 864.0, 6.0,
     'c1000000-0000-0000-0000-000000000003',
     'b1000000-0000-0000-0000-000000000001',
     'none', NULL, NULL, NULL, NULL),

-- ── Product 5: Tall Pantry (600 × 2400 × 580) ─────────────────────────────

    ('pt000000-0000-0000-0000-000000000025',
     'p1000000-0000-0000-0000-000000000005', 'Left Side',
     'side', 2364.0, 562.0, 18.0,
     'c1000000-0000-0000-0000-000000000001',
     'b1000000-0000-0000-0000-000000000001',
     'vertical', 1, 1, 1, NULL),

    ('pt000000-0000-0000-0000-000000000026',
     'p1000000-0000-0000-0000-000000000005', 'Right Side',
     'side', 2364.0, 562.0, 18.0,
     'c1000000-0000-0000-0000-000000000001',
     'b1000000-0000-0000-0000-000000000001',
     'vertical', 1, 1, NULL, 1),

    ('pt000000-0000-0000-0000-000000000027',
     'p1000000-0000-0000-0000-000000000005', 'Top',
     'top', 564.0, 562.0, 18.0,
     'c1000000-0000-0000-0000-000000000001',
     'b1000000-0000-0000-0000-000000000001',
     'horizontal', 1, NULL, NULL, NULL),

    ('pt000000-0000-0000-0000-000000000028',
     'p1000000-0000-0000-0000-000000000005', 'Bottom',
     'bottom', 564.0, 562.0, 18.0,
     'c1000000-0000-0000-0000-000000000001',
     'b1000000-0000-0000-0000-000000000001',
     'horizontal', NULL, 1, NULL, NULL),

    ('pt000000-0000-0000-0000-000000000029',
     'p1000000-0000-0000-0000-000000000005', 'Shelf 1',
     'shelf', 564.0, 543.0, 18.0,
     'c1000000-0000-0000-0000-000000000001',
     'b1000000-0000-0000-0000-000000000001',
     'horizontal', 1, NULL, NULL, NULL),

    ('pt000000-0000-0000-0000-000000000030',
     'p1000000-0000-0000-0000-000000000005', 'Shelf 2',
     'shelf', 564.0, 543.0, 18.0,
     'c1000000-0000-0000-0000-000000000001',
     'b1000000-0000-0000-0000-000000000001',
     'horizontal', 1, NULL, NULL, NULL),

    ('pt000000-0000-0000-0000-000000000031',
     'p1000000-0000-0000-0000-000000000005', 'Shelf 3',
     'shelf', 564.0, 543.0, 18.0,
     'c1000000-0000-0000-0000-000000000001',
     'b1000000-0000-0000-0000-000000000001',
     'horizontal', 1, NULL, NULL, NULL),

    ('pt000000-0000-0000-0000-000000000032',
     'p1000000-0000-0000-0000-000000000005', 'Shelf 4',
     'shelf', 564.0, 543.0, 18.0,
     'c1000000-0000-0000-0000-000000000001',
     'b1000000-0000-0000-0000-000000000001',
     'horizontal', 1, NULL, NULL, NULL),

    ('pt000000-0000-0000-0000-000000000033',
     'p1000000-0000-0000-0000-000000000005', 'Shelf 5',
     'shelf', 564.0, 543.0, 18.0,
     'c1000000-0000-0000-0000-000000000001',
     'b1000000-0000-0000-0000-000000000001',
     'horizontal', 1, NULL, NULL, NULL),

    ('pt000000-0000-0000-0000-000000000034',
     'p1000000-0000-0000-0000-000000000005', 'Door Upper',
     'door', 1260.0, 564.0, 18.0,
     'c1000000-0000-0000-0000-000000000001',
     'b1000000-0000-0000-0000-000000000001',
     'vertical', 1, 1, 1, 1),

    ('pt000000-0000-0000-0000-000000000035',
     'p1000000-0000-0000-0000-000000000005', 'Door Lower',
     'door', 1068.0, 564.0, 18.0,
     'c1000000-0000-0000-0000-000000000001',
     'b1000000-0000-0000-0000-000000000001',
     'vertical', 1, 1, 1, 1),

    ('pt000000-0000-0000-0000-000000000036',
     'p1000000-0000-0000-0000-000000000005', 'Back Panel',
     'back', 2364.0, 564.0, 6.0,
     'c1000000-0000-0000-0000-000000000003',
     'b1000000-0000-0000-0000-000000000001',
     'none', NULL, NULL, NULL, NULL),

-- ── Product 6: Vanity Double (1500 × 860 × 530) ─────────────────────────────

    ('pt000000-0000-0000-0000-000000000037',
     'p1000000-0000-0000-0000-000000000006', 'Left Side',
     'side', 824.0, 512.0, 18.0,
     'c1000000-0000-0000-0000-000000000001',
     'b1000000-0000-0000-0000-000000000001',
     'vertical', 1, 1, 1, NULL),

    ('pt000000-0000-0000-0000-000000000038',
     'p1000000-0000-0000-0000-000000000006', 'Right Side',
     'side', 824.0, 512.0, 18.0,
     'c1000000-0000-0000-0000-000000000001',
     'b1000000-0000-0000-0000-000000000001',
     'vertical', 1, 1, NULL, 1),

    ('pt000000-0000-0000-0000-000000000039',
     'p1000000-0000-0000-0000-000000000006', 'Centre Divider',
     'panel', 824.0, 512.0, 18.0,
     'c1000000-0000-0000-0000-000000000001',
     'b1000000-0000-0000-0000-000000000001',
     'vertical', 1, 1, NULL, NULL),

    ('pt000000-0000-0000-0000-000000000040',
     'p1000000-0000-0000-0000-000000000006', 'Bottom',
     'bottom', 1464.0, 512.0, 18.0,
     'c1000000-0000-0000-0000-000000000001',
     'b1000000-0000-0000-0000-000000000001',
     'horizontal', NULL, 1, NULL, NULL),

    ('pt000000-0000-0000-0000-000000000041',
     'p1000000-0000-0000-0000-000000000006', 'Drawer Front 1',
     'drawer_front', 714.0, 110.0, 18.0,
     'c1000000-0000-0000-0000-000000000001',
     'b1000000-0000-0000-0000-000000000001',
     'vertical', 1, 1, 1, 1),

    ('pt000000-0000-0000-0000-000000000042',
     'p1000000-0000-0000-0000-000000000006', 'Drawer Front 2',
     'drawer_front', 714.0, 110.0, 18.0,
     'c1000000-0000-0000-0000-000000000001',
     'b1000000-0000-0000-0000-000000000001',
     'vertical', 1, 1, 1, 1),

    ('pt000000-0000-0000-0000-000000000043',
     'p1000000-0000-0000-0000-000000000006', 'Drawer Front 3',
     'drawer_front', 714.0, 110.0, 18.0,
     'c1000000-0000-0000-0000-000000000001',
     'b1000000-0000-0000-0000-000000000001',
     'vertical', 1, 1, 1, 1),

    ('pt000000-0000-0000-0000-000000000044',
     'p1000000-0000-0000-0000-000000000006', 'Drawer Front 4',
     'drawer_front', 714.0, 110.0, 18.0,
     'c1000000-0000-0000-0000-000000000001',
     'b1000000-0000-0000-0000-000000000001',
     'vertical', 1, 1, 1, 1),

    ('pt000000-0000-0000-0000-000000000045',
     'p1000000-0000-0000-0000-000000000006', 'Back Panel',
     'back', 824.0, 1464.0, 6.0,
     'c1000000-0000-0000-0000-000000000003',
     'b1000000-0000-0000-0000-000000000001',
     'none', NULL, NULL, NULL, NULL)

ON CONFLICT (id) DO NOTHING;

-- =============================================================================
-- 15. OPERATIONS  (50+ CNC operations across key parts)
-- position_x / position_y are in mm from part origin (bottom-left)
-- depth in mm
-- =============================================================================

INSERT INTO operations (
    id, part_id,
    operation_type,
    position_x, position_y, position_z,
    width, height, depth,
    tool_id, side, parameters
)
VALUES

    ('op000000-0000-0000-0000-000000000001',
     'pt000000-0000-0000-0000-000000000001',
     'drill', 37.0, 96.0, 0.0, NULL, NULL, 13.0,
     'g1000000-0000-0000-0000-000000000012', 'front',
     '{"hole_dia_mm":5,"pattern":"shelf_pin","row":"front"}'::JSONB),

    ('op000000-0000-0000-0000-000000000002',
     'pt000000-0000-0000-0000-000000000001',
     'drill', 37.0, 128.0, 0.0, NULL, NULL, 13.0,
     'g1000000-0000-0000-0000-000000000012', 'front',
     '{"hole_dia_mm":5,"pattern":"shelf_pin","row":"front"}'::JSONB),

    ('op000000-0000-0000-0000-000000000003',
     'pt000000-0000-0000-0000-000000000001',
     'drill', 37.0, 160.0, 0.0, NULL, NULL, 13.0,
     'g1000000-0000-0000-0000-000000000012', 'front',
     '{"hole_dia_mm":5,"pattern":"shelf_pin","row":"front"}'::JSONB),

    ('op000000-0000-0000-0000-000000000004',
     'pt000000-0000-0000-0000-000000000001',
     'drill', 37.0, 192.0, 0.0, NULL, NULL, 13.0,
     'g1000000-0000-0000-0000-000000000012', 'front',
     '{"hole_dia_mm":5,"pattern":"shelf_pin","row":"front"}'::JSONB),

    ('op000000-0000-0000-0000-000000000005',
     'pt000000-0000-0000-0000-000000000001',
     'drill', 100.0, 9.0, 0.0, NULL, NULL, 17.5,
     'g1000000-0000-0000-0000-000000000013', 'left',
     '{"hole_dia_mm":8,"type":"dowel_receive"}'::JSONB),

    ('op000000-0000-0000-0000-000000000006',
     'pt000000-0000-0000-0000-000000000001',
     'drill', 400.0, 9.0, 0.0, NULL, NULL, 17.5,
     'g1000000-0000-0000-0000-000000000013', 'left',
     '{"hole_dia_mm":8,"type":"dowel_receive"}'::JSONB),

    ('op000000-0000-0000-0000-000000000007',
     'pt000000-0000-0000-0000-000000000001',
     'drill', 22.5, 96.0, 0.0, NULL, NULL, 13.5,
     'g1000000-0000-0000-0000-000000000015', 'front',
     '{"hole_dia_mm":35,"type":"hinge_cup"}'::JSONB),

    ('op000000-0000-0000-0000-000000000008',
     'pt000000-0000-0000-0000-000000000001',
     'drill', 22.5, 608.0, 0.0, NULL, NULL, 13.5,
     'g1000000-0000-0000-0000-000000000015', 'front',
     '{"hole_dia_mm":35,"type":"hinge_cup"}'::JSONB),

    ('op000000-0000-0000-0000-000000000009',
     'pt000000-0000-0000-0000-000000000001',
     'dado', 553.0, 0.0, 0.0, 6.0, 834.0, 9.0,
     'g1000000-0000-0000-0000-000000000004', 'top',
     '{"dado_type":"back_panel","groove_width_mm":6}'::JSONB),

    ('op000000-0000-0000-0000-000000000010',
     'pt000000-0000-0000-0000-000000000002',
     'drill', 37.0, 96.0, 0.0, NULL, NULL, 13.0,
     'g1000000-0000-0000-0000-000000000012', 'front',
     '{"hole_dia_mm":5,"pattern":"shelf_pin","row":"front"}'::JSONB),

    ('op000000-0000-0000-0000-000000000011',
     'pt000000-0000-0000-0000-000000000002',
     'drill', 37.0, 128.0, 0.0, NULL, NULL, 13.0,
     'g1000000-0000-0000-0000-000000000012', 'front',
     '{"hole_dia_mm":5,"pattern":"shelf_pin","row":"front"}'::JSONB),

    ('op000000-0000-0000-0000-000000000012',
     'pt000000-0000-0000-0000-000000000002',
     'drill', 100.0, 9.0, 0.0, NULL, NULL, 17.5,
     'g1000000-0000-0000-0000-000000000013', 'right',
     '{"hole_dia_mm":8,"type":"dowel_receive"}'::JSONB),

    ('op000000-0000-0000-0000-000000000013',
     'pt000000-0000-0000-0000-000000000002',
     'drill', 400.0, 9.0, 0.0, NULL, NULL, 17.5,
     'g1000000-0000-0000-0000-000000000013', 'right',
     '{"hole_dia_mm":8,"type":"dowel_receive"}'::JSONB),

    ('op000000-0000-0000-0000-000000000014',
     'pt000000-0000-0000-0000-000000000002',
     'drill', 22.5, 96.0, 0.0, NULL, NULL, 13.5,
     'g1000000-0000-0000-0000-000000000015', 'front',
     '{"hole_dia_mm":35,"type":"hinge_cup"}'::JSONB),

    ('op000000-0000-0000-0000-000000000015',
     'pt000000-0000-0000-0000-000000000002',
     'drill', 22.5, 608.0, 0.0, NULL, NULL, 13.5,
     'g1000000-0000-0000-0000-000000000015', 'front',
     '{"hole_dia_mm":35,"type":"hinge_cup"}'::JSONB),

    ('op000000-0000-0000-0000-000000000016',
     'pt000000-0000-0000-0000-000000000002',
     'dado', 553.0, 0.0, 0.0, 6.0, 834.0, 9.0,
     'g1000000-0000-0000-0000-000000000004', 'top',
     '{"dado_type":"back_panel","groove_width_mm":6}'::JSONB),

    ('op000000-0000-0000-0000-000000000017',
     'pt000000-0000-0000-0000-000000000003',
     'drill', 9.0, 100.0, 0.0, NULL, NULL, 17.5,
     'g1000000-0000-0000-0000-000000000013', 'left',
     '{"hole_dia_mm":8,"type":"dowel_pin"}'::JSONB),

    ('op000000-0000-0000-0000-000000000018',
     'pt000000-0000-0000-0000-000000000003',
     'drill', 9.0, 400.0, 0.0, NULL, NULL, 17.5,
     'g1000000-0000-0000-0000-000000000013', 'left',
     '{"hole_dia_mm":8,"type":"dowel_pin"}'::JSONB),

    ('op000000-0000-0000-0000-000000000019',
     'pt000000-0000-0000-0000-000000000003',
     'drill', 555.0, 100.0, 0.0, NULL, NULL, 17.5,
     'g1000000-0000-0000-0000-000000000013', 'right',
     '{"hole_dia_mm":8,"type":"dowel_pin"}'::JSONB),

    ('op000000-0000-0000-0000-000000000020',
     'pt000000-0000-0000-0000-000000000003',
     'drill', 555.0, 400.0, 0.0, NULL, NULL, 17.5,
     'g1000000-0000-0000-0000-000000000013', 'right',
     '{"hole_dia_mm":8,"type":"dowel_pin"}'::JSONB),

    ('op000000-0000-0000-0000-000000000021',
     'pt000000-0000-0000-0000-000000000001',
     'drill', 37.0, 720.0, 0.0, NULL, NULL, 8.0,
     'g1000000-0000-0000-0000-000000000012', 'front',
     '{"hole_dia_mm":5,"type":"drawer_slide_mount"}'::JSONB),

    ('op000000-0000-0000-0000-000000000022',
     'pt000000-0000-0000-0000-000000000001',
     'drill', 487.0, 720.0, 0.0, NULL, NULL, 8.0,
     'g1000000-0000-0000-0000-000000000012', 'front',
     '{"hole_dia_mm":5,"type":"drawer_slide_mount"}'::JSONB),

    ('op000000-0000-0000-0000-000000000023',
     'pt000000-0000-0000-0000-000000000001',
     'drill', 37.0, 560.0, 0.0, NULL, NULL, 8.0,
     'g1000000-0000-0000-0000-000000000012', 'front',
     '{"hole_dia_mm":5,"type":"drawer_slide_mount"}'::JSONB),

    ('op000000-0000-0000-0000-000000000024',
     'pt000000-0000-0000-0000-000000000001',
     'drill', 487.0, 560.0, 0.0, NULL, NULL, 8.0,
     'g1000000-0000-0000-0000-000000000012', 'front',
     '{"hole_dia_mm":5,"type":"drawer_slide_mount"}'::JSONB),

    ('op000000-0000-0000-0000-000000000025',
     'pt000000-0000-0000-0000-000000000016',
     'drill', 37.0, 96.0, 0.0, NULL, NULL, 13.0,
     'g1000000-0000-0000-0000-000000000012', 'front',
     '{"hole_dia_mm":5,"pattern":"shelf_pin"}'::JSONB),

    ('op000000-0000-0000-0000-000000000026',
     'pt000000-0000-0000-0000-000000000016',
     'drill', 37.0, 128.0, 0.0, NULL, NULL, 13.0,
     'g1000000-0000-0000-0000-000000000012', 'front',
     '{"hole_dia_mm":5,"pattern":"shelf_pin"}'::JSONB),

    ('op000000-0000-0000-0000-000000000027',
     'pt000000-0000-0000-0000-000000000016',
     'drill', 37.0, 160.0, 0.0, NULL, NULL, 13.0,
     'g1000000-0000-0000-0000-000000000012', 'front',
     '{"hole_dia_mm":5,"pattern":"shelf_pin"}'::JSONB),

    ('op000000-0000-0000-0000-000000000028',
     'pt000000-0000-0000-0000-000000000016',
     'drill', 37.0, 192.0, 0.0, NULL, NULL, 13.0,
     'g1000000-0000-0000-0000-000000000012', 'front',
     '{"hole_dia_mm":5,"pattern":"shelf_pin"}'::JSONB),

    ('op000000-0000-0000-0000-000000000029',
     'pt000000-0000-0000-0000-000000000016',
     'drill', 22.5, 64.0, 0.0, NULL, NULL, 13.5,
     'g1000000-0000-0000-0000-000000000015', 'front',
     '{"hole_dia_mm":35,"type":"hinge_cup"}'::JSONB),

    ('op000000-0000-0000-0000-000000000030',
     'pt000000-0000-0000-0000-000000000016',
     'drill', 22.5, 560.0, 0.0, NULL, NULL, 13.5,
     'g1000000-0000-0000-0000-000000000015', 'front',
     '{"hole_dia_mm":35,"type":"hinge_cup"}'::JSONB),

    ('op000000-0000-0000-0000-000000000031',
     'pt000000-0000-0000-0000-000000000025',
     'drill', 22.5, 96.0, 0.0, NULL, NULL, 13.5,
     'g1000000-0000-0000-0000-000000000015', 'front',
     '{"hole_dia_mm":35,"type":"hinge_cup"}'::JSONB),

    ('op000000-0000-0000-0000-000000000032',
     'pt000000-0000-0000-0000-000000000025',
     'drill', 22.5, 400.0, 0.0, NULL, NULL, 13.5,
     'g1000000-0000-0000-0000-000000000015', 'front',
     '{"hole_dia_mm":35,"type":"hinge_cup"}'::JSONB),

    ('op000000-0000-0000-0000-000000000033',
     'pt000000-0000-0000-0000-000000000025',
     'drill', 22.5, 1500.0, 0.0, NULL, NULL, 13.5,
     'g1000000-0000-0000-0000-000000000015', 'front',
     '{"hole_dia_mm":35,"type":"hinge_cup"}'::JSONB),

    ('op000000-0000-0000-0000-000000000034',
     'pt000000-0000-0000-0000-000000000025',
     'drill', 22.5, 1900.0, 0.0, NULL, NULL, 13.5,
     'g1000000-0000-0000-0000-000000000015', 'front',
     '{"hole_dia_mm":35,"type":"hinge_cup"}'::JSONB),

    ('op000000-0000-0000-0000-000000000035',
     'pt000000-0000-0000-0000-000000000025',
     'drill', 37.0, 320.0, 0.0, NULL, NULL, 13.0,
     'g1000000-0000-0000-0000-000000000012', 'front',
     '{"hole_dia_mm":5,"pattern":"shelf_pin"}'::JSONB),

    ('op000000-0000-0000-0000-000000000036',
     'pt000000-0000-0000-0000-000000000025',
     'drill', 37.0, 640.0, 0.0, NULL, NULL, 13.0,
     'g1000000-0000-0000-0000-000000000012', 'front',
     '{"hole_dia_mm":5,"pattern":"shelf_pin"}'::JSONB),

    ('op000000-0000-0000-0000-000000000037',
     'pt000000-0000-0000-0000-000000000025',
     'drill', 37.0, 960.0, 0.0, NULL, NULL, 13.0,
     'g1000000-0000-0000-0000-000000000012', 'front',
     '{"hole_dia_mm":5,"pattern":"shelf_pin"}'::JSONB),

    ('op000000-0000-0000-0000-000000000038',
     'pt000000-0000-0000-0000-000000000014',
     'drill', 64.0, 414.0, 0.0, NULL, NULL, 22.0,
     'g1000000-0000-0000-0000-000000000012', 'front',
     '{"hole_dia_mm":5,"type":"handle_pilot"}'::JSONB),

    ('op000000-0000-0000-0000-000000000039',
     'pt000000-0000-0000-0000-000000000015',
     'drill', 368.0, 414.0, 0.0, NULL, NULL, 22.0,
     'g1000000-0000-0000-0000-000000000012', 'front',
     '{"hole_dia_mm":5,"type":"handle_pilot"}'::JSONB),

    ('op000000-0000-0000-0000-000000000040',
     'pt000000-0000-0000-0000-000000000029',
     'profile', 0.0, 0.0, 0.0, 564.0, NULL, 6.35,
     'g1000000-0000-0000-0000-000000000007', 'front',
     '{"profile":"roundover","radius_mm":6.35}'::JSONB),

    ('op000000-0000-0000-0000-000000000041',
     'pt000000-0000-0000-0000-000000000030',
     'profile', 0.0, 0.0, 0.0, 564.0, NULL, 6.35,
     'g1000000-0000-0000-0000-000000000007', 'front',
     '{"profile":"roundover","radius_mm":6.35}'::JSONB),

    ('op000000-0000-0000-0000-000000000042',
     'pt000000-0000-0000-0000-000000000031',
     'profile', 0.0, 0.0, 0.0, 564.0, NULL, 6.35,
     'g1000000-0000-0000-0000-000000000007', 'front',
     '{"profile":"roundover","radius_mm":6.35}'::JSONB),

    ('op000000-0000-0000-0000-000000000043',
     'pt000000-0000-0000-0000-000000000040',
     'cutout', 200.0, 112.0, 0.0, 350.0, 290.0, 18.0,
     'g1000000-0000-0000-0000-000000000003', 'top',
     '{"cutout_type":"sink","radius_corners_mm":10}'::JSONB),

    ('op000000-0000-0000-0000-000000000044',
     'pt000000-0000-0000-0000-000000000040',
     'cutout', 950.0, 112.0, 0.0, 350.0, 290.0, 18.0,
     'g1000000-0000-0000-0000-000000000003', 'top',
     '{"cutout_type":"sink","radius_corners_mm":10}'::JSONB),

    ('op000000-0000-0000-0000-000000000045',
     'pt000000-0000-0000-0000-000000000040',
     'drill', 9.0, 100.0, 0.0, NULL, NULL, 13.5,
     'g1000000-0000-0000-0000-000000000012', 'left',
     '{"hole_dia_mm":15,"type":"cam_lock_bore"}'::JSONB),

    ('op000000-0000-0000-0000-000000000046',
     'pt000000-0000-0000-0000-000000000040',
     'drill', 9.0, 400.0, 0.0, NULL, NULL, 13.5,
     'g1000000-0000-0000-0000-000000000012', 'left',
     '{"hole_dia_mm":15,"type":"cam_lock_bore"}'::JSONB),

    ('op000000-0000-0000-0000-000000000047',
     'pt000000-0000-0000-0000-000000000040',
     'drill', 1455.0, 100.0, 0.0, NULL, NULL, 13.5,
     'g1000000-0000-0000-0000-000000000012', 'right',
     '{"hole_dia_mm":15,"type":"cam_lock_bore"}'::JSONB),

    ('op000000-0000-0000-0000-000000000048',
     'pt000000-0000-0000-0000-000000000040',
     'drill', 1455.0, 400.0, 0.0, NULL, NULL, 13.5,
     'g1000000-0000-0000-0000-000000000012', 'right',
     '{"hole_dia_mm":15,"type":"cam_lock_bore"}'::JSONB),

    ('op000000-0000-0000-0000-000000000049',
     'pt000000-0000-0000-0000-000000000004',
     'pocket', 32.0, 48.0, 0.0, 18.0, 18.0, 14.0,
     'g1000000-0000-0000-0000-000000000006', 'top',
     '{"pocket_type":"pocket_screw","angle_deg":15}'::JSONB),

    ('op000000-0000-0000-0000-000000000050',
     'pt000000-0000-0000-0000-000000000004',
     'pocket', 514.0, 48.0, 0.0, 18.0, 18.0, 14.0,
     'g1000000-0000-0000-0000-000000000006', 'top',
     '{"pocket_type":"pocket_screw","angle_deg":15}'::JSONB),

    ('op000000-0000-0000-0000-000000000051',
     'pt000000-0000-0000-0000-000000000018',
     'dado', 293.0, 0.0, 0.0, 6.0, 864.0, 9.0,
     'g1000000-0000-0000-0000-000000000004', 'top',
     '{"dado_type":"back_panel","groove_width_mm":6}'::JSONB),

    ('op000000-0000-0000-0000-000000000052',
     'pt000000-0000-0000-0000-000000000004',
     'tenon', 0.0, 0.0, 0.0, 96.0, 18.0, 9.0,
     'g1000000-0000-0000-0000-000000000001', 'left',
     '{"tenon_width_mm":96,"tenon_depth_mm":9}'::JSONB),

    ('op000000-0000-0000-0000-000000000053',
     'pt000000-0000-0000-0000-000000000004',
     'tenon', 546.0, 0.0, 0.0, 96.0, 18.0, 9.0,
     'g1000000-0000-0000-0000-000000000001', 'right',
     '{"tenon_width_mm":96,"tenon_depth_mm":9}'::JSONB)

ON CONFLICT (id) DO NOTHING;

-- =============================================================================
-- 16. QUOTE  (realistic pricing for the Johnson Kitchen job)
-- =============================================================================

INSERT INTO quotes (
    id, job_id, quote_number,
    material_cost, hardware_cost, labor_cost,
    markup_percentage, total,
    line_items
)
VALUES
    ('q1000000-0000-0000-0000-000000000001',
     'j1000000-0000-0000-0000-000000000001',
     'Q-2026-0001',
     1683.00,
     1900.30,
     7696.00,
     22.0,
     13760.75,
     '[
         {"item": "Baltic Birch 18mm",          "qty": 18, "unit": "sheet",   "unit_price": 78.50,  "total": 1413.00},
         {"item": "Baltic Birch 6mm (backs)",    "qty":  6, "unit": "sheet",   "unit_price": 45.00,  "total":  270.00},
         {"item": "Blum CLIP top Hinge Pairs",   "qty": 14, "unit": "pair",    "unit_price": 18.50,  "total":  259.00},
         {"item": "Blum TANDEM Slides 450mm",    "qty":  8, "unit": "pair",    "unit_price": 52.00,  "total":  416.00},
         {"item": "Blum TANDEM Slides 500mm",    "qty":  4, "unit": "pair",    "unit_price": 58.00,  "total":  232.00},
         {"item": "Bar Handle 128mm CC",         "qty": 22, "unit": "each",    "unit_price": 14.75,  "total":  324.50},
         {"item": "Shelf Pins 5mm Nickel",       "qty": 80, "unit": "each",    "unit_price": 0.45,   "total":   36.00},
         {"item": "8mm Dowel Pins",              "qty":200, "unit": "each",    "unit_price": 0.18,   "total":   36.00},
         {"item": "Confirmat Screws 7×50mm",     "qty":100, "unit": "each",    "unit_price": 0.22,   "total":   22.00},
         {"item": "PVC Edge Banding White 23mm", "qty":200, "unit": "linear_ft","unit_price": 0.18,  "total":   36.00},
         {"item": "RW Edge Banding Birch 22mm",  "qty": 80, "unit": "linear_ft","unit_price": 0.55,  "total":   44.00},
         {"item": "Cam Locks Rafix 15",          "qty": 40, "unit": "each",    "unit_price": 1.12,   "total":   44.80},
         {"item": "Delivery & Installation",     "qty":  1, "unit": "job",     "unit_price": 450.00, "total":  450.00},
         {"item": "Design & Drafting",           "qty": 16, "unit": "hour",    "unit_price": 95.00,  "total": 1520.00},
         {"item": "CNC Machining",               "qty": 32, "unit": "hour",    "unit_price": 85.00,  "total": 2720.00},
         {"item": "Assembly & Finishing",        "qty": 72, "unit": "hour",    "unit_price": 48.00,  "total": 3456.00}
     ]'::JSONB
    )
ON CONFLICT (id) DO NOTHING;

-- =============================================================================
-- 17. OPTIMIZATION RUN  (sample nesting for the job)
-- =============================================================================

INSERT INTO optimization_runs (
    id, job_id, name,
    status, quality, settings,
    sheets, yield_percentage
)
VALUES
    ('or000000-0000-0000-0000-000000000001',
     'j1000000-0000-0000-0000-000000000001',
     'Kitchen – Initial Nest',
     'completed', 'best',
     '{
         "kerf_mm": 3.175,
         "grain_match": true,
         "allow_rotation": false,
         "edge_trim_mm": 10,
         "part_gap_mm": 5,
         "fallback_allow_rotation": true
     }'::JSONB,
     '[]'::JSONB,
     87.4
    )
ON CONFLICT (id) DO NOTHING;

-- =============================================================================
-- 18. ATC TOOL SET  (Thermwood machine #1)
-- =============================================================================

INSERT INTO atc_tool_sets (
    id, name, machine_id, tool_ids
)
VALUES
    ('at000000-0000-0000-0000-000000000001',
     'Standard Kitchen Set',
     'f1000000-0000-0000-0000-000000000001',
     ARRAY[
         'g1000000-0000-0000-0000-000000000001'::UUID,
         'g1000000-0000-0000-0000-000000000003'::UUID,
         'g1000000-0000-0000-0000-000000000012'::UUID,
         'g1000000-0000-0000-0000-000000000013'::UUID,
         'g1000000-0000-0000-0000-000000000015'::UUID,
         'g1000000-0000-0000-0000-000000000010'::UUID,
         'g1000000-0000-0000-0000-000000000007'::UUID,
         'g1000000-0000-0000-0000-000000000008'::UUID
     ]
    )
ON CONFLICT (id) DO NOTHING;

COMMIT;
