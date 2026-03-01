-- =============================================================================
-- CNC Cabinet Manufacturing Software - Initial Database Schema
-- Migration: 001_initial_schema.sql
-- =============================================================================

-- Enable UUID generation
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- =============================================================================
-- ENUM TYPES
-- =============================================================================

CREATE TYPE job_status AS ENUM ('active', 'completed', 'lost');

CREATE TYPE product_type AS ENUM (
    'base_cabinet', 'wall_cabinet', 'tall_cabinet',
    'vanity', 'closet', 'wardrobe', 'furniture'
);

CREATE TYPE cabinet_style AS ENUM ('frameless', 'face_frame');

CREATE TYPE part_type AS ENUM (
    'side', 'top', 'bottom', 'back', 'shelf', 'rail', 'stile',
    'drawer_front', 'drawer_side', 'drawer_back', 'drawer_bottom',
    'door', 'panel', 'edge_band', 'custom'
);

CREATE TYPE grain_direction AS ENUM ('horizontal', 'vertical', 'none');

CREATE TYPE operation_type AS ENUM (
    'drill', 'route', 'dado', 'tenon', 'pocket', 'profile', 'cutout'
);

CREATE TYPE operation_side AS ENUM ('top', 'bottom', 'left', 'right', 'front', 'back');

CREATE TYPE material_category AS ENUM (
    'sheet_good', 'solid_wood', 'edge_banding', 'hardware'
);

CREATE TYPE cost_unit AS ENUM (
    'per_sheet', 'per_sq_ft', 'per_board_ft', 'per_linear_ft'
);

CREATE TYPE texture_sheen AS ENUM (
    'none', 'flat', 'satin', 'semi_gloss', 'high_gloss', 'glass'
);

CREATE TYPE texture_grain_orientation AS ENUM ('horizontal', 'vertical', 'none');

CREATE TYPE hardware_type AS ENUM (
    'hinge', 'slide', 'handle', 'connector', 'fastener'
);

CREATE TYPE machine_type AS ENUM (
    'nesting_router', 'point_to_point', 'vertical_cnc',
    'drill_and_dowel', 'beam_saw'
);

CREATE TYPE tool_type AS ENUM (
    'compression_cutter', 'down_shear', 'up_cut',
    'dovetail', 'profile_bit', 'drill_bit'
);

CREATE TYPE output_format AS ENUM (
    'nc', 'g_code', 'tap', 'mpr', 'cix', 'xcs', 'csv'
);

CREATE TYPE optimization_status AS ENUM (
    'pending', 'running', 'completed', 'failed'
);

CREATE TYPE optimization_quality AS ENUM (
    'fast_estimate', 'good', 'better', 'best'
);

CREATE TYPE user_role AS ENUM (
    'super_admin', 'designer', 'cnc_operator', 'shop_floor'
);

CREATE TYPE machine_rule_type AS ENUM (
    'by_size', 'by_part_type', 'by_operations'
);

-- =============================================================================
-- CORE LIBRARY TABLES (no foreign key dependencies)
-- =============================================================================

-- Texture Groups
CREATE TABLE texture_groups (
    id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    name        TEXT        NOT NULL,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_texture_groups_name ON texture_groups (name);

-- Textures
CREATE TABLE textures (
    id                  UUID                        PRIMARY KEY DEFAULT gen_random_uuid(),
    name                TEXT                        NOT NULL,
    abbreviation        TEXT                        NOT NULL,
    image_url           TEXT,
    sheen               texture_sheen               NOT NULL DEFAULT 'none',
    grain_orientation   texture_grain_orientation   NOT NULL DEFAULT 'none',
    transparency        DOUBLE PRECISION            NOT NULL DEFAULT 0.0,
    metallicness        DOUBLE PRECISION            NOT NULL DEFAULT 0.0,
    visual_width        DOUBLE PRECISION            NOT NULL DEFAULT 2400.0,
    visual_height       DOUBLE PRECISION            NOT NULL DEFAULT 1200.0,
    rotation_angle      DOUBLE PRECISION            NOT NULL DEFAULT 0.0,
    texture_group_id    UUID                        REFERENCES texture_groups (id) ON DELETE SET NULL,
    created_at          TIMESTAMPTZ                 NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ                 NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_textures_texture_group_id ON textures (texture_group_id);
CREATE INDEX idx_textures_name ON textures (name);

-- Materials
CREATE TABLE materials (
    id                  UUID                PRIMARY KEY DEFAULT gen_random_uuid(),
    name                TEXT                NOT NULL,
    cutlist_name        TEXT                NOT NULL,
    abbreviation        TEXT                NOT NULL,
    category            material_category   NOT NULL,
    default_width       DOUBLE PRECISION    NOT NULL DEFAULT 1220.0,
    default_length      DOUBLE PRECISION    NOT NULL DEFAULT 2440.0,
    thickness           DOUBLE PRECISION    NOT NULL,
    cost_per_unit       DOUBLE PRECISION    NOT NULL DEFAULT 0.0,
    cost_unit           cost_unit           NOT NULL DEFAULT 'per_sheet',
    texture_group_id    UUID                REFERENCES texture_groups (id) ON DELETE SET NULL,
    created_at          TIMESTAMPTZ         NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ         NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_materials_category ON materials (category);
CREATE INDEX idx_materials_texture_group_id ON materials (texture_group_id);

-- Material Templates
CREATE TABLE material_templates (
    id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    name        TEXT        NOT NULL,
    assignments JSONB       NOT NULL DEFAULT '{}',
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Construction Methods
CREATE TABLE construction_methods (
    id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    name            TEXT        NOT NULL,
    joinery_type    TEXT[]      NOT NULL DEFAULT '{}',
    fastener_specs  JSONB       NOT NULL DEFAULT '{}',
    placement_rules JSONB       NOT NULL DEFAULT '{}',
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Hardware
CREATE TABLE hardware (
    id                  UUID            PRIMARY KEY DEFAULT gen_random_uuid(),
    name                TEXT            NOT NULL,
    brand               TEXT            NOT NULL,
    model_name          TEXT            NOT NULL,
    hardware_type       hardware_type   NOT NULL,
    drilling_pattern    JSONB           NOT NULL DEFAULT '{}',
    parameters          JSONB           NOT NULL DEFAULT '{}',
    created_at          TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ     NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_hardware_brand ON hardware (brand);
CREATE INDEX idx_hardware_hardware_type ON hardware (hardware_type);

-- Tools
CREATE TABLE tools (
    id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    name                TEXT        NOT NULL,
    diameter            DOUBLE PRECISION NOT NULL,
    tool_type           tool_type   NOT NULL,
    rpm                 INTEGER     NOT NULL,
    feed_rate           DOUBLE PRECISION NOT NULL,
    plunge_rate         DOUBLE PRECISION NOT NULL,
    max_depth_per_pass  DOUBLE PRECISION NOT NULL,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_tools_tool_type ON tools (tool_type);

-- Post Processors
CREATE TABLE post_processors (
    id               UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
    name             TEXT          NOT NULL,
    machine_type     TEXT          NOT NULL,
    output_format    output_format NOT NULL,
    template_content TEXT          NOT NULL DEFAULT '',
    variables        JSONB         NOT NULL DEFAULT '{}',
    created_at       TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
    updated_at       TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

-- Label Templates
CREATE TABLE label_templates (
    id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    name        TEXT        NOT NULL,
    width       DOUBLE PRECISION NOT NULL DEFAULT 100.0,
    height      DOUBLE PRECISION NOT NULL DEFAULT 50.0,
    fields      JSONB       NOT NULL DEFAULT '[]',
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Drawing Templates
CREATE TABLE drawing_templates (
    id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    name        TEXT        NOT NULL,
    page_size   TEXT        NOT NULL DEFAULT 'A3',
    layout      JSONB       NOT NULL DEFAULT '{}',
    title_block JSONB       NOT NULL DEFAULT '{}',
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Users
CREATE TABLE users (
    id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    email         TEXT        NOT NULL UNIQUE,
    name          TEXT        NOT NULL,
    password_hash TEXT        NOT NULL,
    role          user_role   NOT NULL DEFAULT 'designer',
    permissions   JSONB       NOT NULL DEFAULT '{}',
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_users_email ON users (email);
CREATE INDEX idx_users_role ON users (role);

-- =============================================================================
-- MACHINE TABLES
-- =============================================================================

-- Machines (references post_processors)
CREATE TABLE machines (
    id                  UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    name                TEXT         NOT NULL,
    brand               TEXT         NOT NULL,
    model_name          TEXT         NOT NULL,
    machine_type        machine_type NOT NULL,
    post_processor_id   UUID         REFERENCES post_processors (id) ON DELETE SET NULL,
    spoilboard_width    DOUBLE PRECISION NOT NULL DEFAULT 1220.0,
    spoilboard_length   DOUBLE PRECISION NOT NULL DEFAULT 2440.0,
    spoilboard_thickness DOUBLE PRECISION NOT NULL DEFAULT 18.0,
    tool_magazine       JSONB        NOT NULL DEFAULT '[]',
    created_at          TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_machines_machine_type ON machines (machine_type);

-- ATC Tool Sets
CREATE TABLE atc_tool_sets (
    id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    name        TEXT        NOT NULL,
    machine_id  UUID        NOT NULL REFERENCES machines (id) ON DELETE CASCADE,
    tool_ids    UUID[]      NOT NULL DEFAULT '{}',
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_atc_tool_sets_machine_id ON atc_tool_sets (machine_id);

-- Machine Template Rules
CREATE TABLE machine_template_rules (
    id          UUID                PRIMARY KEY DEFAULT gen_random_uuid(),
    machine_id  UUID                NOT NULL REFERENCES machines (id) ON DELETE CASCADE,
    rule_type   machine_rule_type   NOT NULL,
    conditions  JSONB               NOT NULL DEFAULT '{}',
    priority    INTEGER             NOT NULL DEFAULT 100,
    created_at  TIMESTAMPTZ         NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_machine_template_rules_machine_id ON machine_template_rules (machine_id);
CREATE INDEX idx_machine_template_rules_priority ON machine_template_rules (priority);

-- =============================================================================
-- JOB HIERARCHY
-- =============================================================================

-- Jobs
CREATE TABLE jobs (
    id                              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    name                            TEXT        NOT NULL,
    client_name                     TEXT        NOT NULL,
    address                         TEXT        NOT NULL DEFAULT '',
    status                          job_status  NOT NULL DEFAULT 'active',
    tags                            TEXT[]      NOT NULL DEFAULT '{}',
    assigned_designer               TEXT,
    notes                           TEXT,
    default_construction_method_id  UUID        REFERENCES construction_methods (id) ON DELETE SET NULL,
    default_material_template_id    UUID        REFERENCES material_templates (id) ON DELETE SET NULL,
    created_at                      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at                      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_jobs_status ON jobs (status);
CREATE INDEX idx_jobs_client_name ON jobs (client_name);
CREATE INDEX idx_jobs_assigned_designer ON jobs (assigned_designer);

-- Rooms
CREATE TABLE rooms (
    id                      UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    job_id                  UUID        NOT NULL REFERENCES jobs (id) ON DELETE CASCADE,
    name                    TEXT        NOT NULL,
    width                   DOUBLE PRECISION NOT NULL DEFAULT 3000.0,
    height                  DOUBLE PRECISION NOT NULL DEFAULT 2400.0,
    depth                   DOUBLE PRECISION NOT NULL DEFAULT 600.0,
    notes                   TEXT,
    material_overrides      JSONB,
    construction_overrides  JSONB,
    created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_rooms_job_id ON rooms (job_id);

-- Products (Cabinets)
CREATE TABLE products (
    id                      UUID            PRIMARY KEY DEFAULT gen_random_uuid(),
    room_id                 UUID            NOT NULL REFERENCES rooms (id) ON DELETE CASCADE,
    name                    TEXT            NOT NULL,
    product_type            product_type    NOT NULL,
    cabinet_style           cabinet_style   NOT NULL DEFAULT 'frameless',
    width                   DOUBLE PRECISION NOT NULL,
    height                  DOUBLE PRECISION NOT NULL,
    depth                   DOUBLE PRECISION NOT NULL,
    position_x              DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    position_y              DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    position_z              DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    rotation                DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    wall_id                 UUID,
    face_definition         JSONB           NOT NULL DEFAULT '{}',
    interior_definition     JSONB           NOT NULL DEFAULT '{}',
    material_overrides      JSONB,
    construction_overrides  JSONB,
    library_entry_id        UUID,
    created_at              TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    updated_at              TIMESTAMPTZ     NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_products_room_id ON products (room_id);
CREATE INDEX idx_products_product_type ON products (product_type);
CREATE INDEX idx_products_library_entry_id ON products (library_entry_id);

-- Parts
CREATE TABLE parts (
    id                UUID            PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id        UUID            NOT NULL REFERENCES products (id) ON DELETE CASCADE,
    name              TEXT            NOT NULL,
    part_type         part_type       NOT NULL,
    length            DOUBLE PRECISION NOT NULL,
    width             DOUBLE PRECISION NOT NULL,
    thickness         DOUBLE PRECISION NOT NULL,
    material_id       UUID            NOT NULL REFERENCES materials (id),
    texture_id        UUID            REFERENCES textures (id) ON DELETE SET NULL,
    grain_direction   grain_direction NOT NULL DEFAULT 'none',
    edge_band_top     INTEGER,
    edge_band_bottom  INTEGER,
    edge_band_left    INTEGER,
    edge_band_right   INTEGER,
    operations        JSONB           NOT NULL DEFAULT '[]',
    created_at        TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    updated_at        TIMESTAMPTZ     NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_parts_product_id ON parts (product_id);
CREATE INDEX idx_parts_part_type ON parts (part_type);
CREATE INDEX idx_parts_material_id ON parts (material_id);

-- Operations (normalized table - operations can also be embedded in parts.operations JSONB)
CREATE TABLE operations (
    id              UUID            PRIMARY KEY DEFAULT gen_random_uuid(),
    part_id         UUID            NOT NULL REFERENCES parts (id) ON DELETE CASCADE,
    operation_type  operation_type  NOT NULL,
    position_x      DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    position_y      DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    position_z      DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    width           DOUBLE PRECISION,
    height          DOUBLE PRECISION,
    depth           DOUBLE PRECISION NOT NULL,
    tool_id         UUID            REFERENCES tools (id) ON DELETE SET NULL,
    side            operation_side  NOT NULL DEFAULT 'top',
    parameters      JSONB           NOT NULL DEFAULT '{}'
);

CREATE INDEX idx_operations_part_id ON operations (part_id);
CREATE INDEX idx_operations_operation_type ON operations (operation_type);

-- =============================================================================
-- OPTIMIZATION & MANUFACTURING
-- =============================================================================

-- Optimization Runs
CREATE TABLE optimization_runs (
    id                  UUID                    PRIMARY KEY DEFAULT gen_random_uuid(),
    job_id              UUID                    NOT NULL REFERENCES jobs (id) ON DELETE CASCADE,
    name                TEXT                    NOT NULL,
    status              optimization_status     NOT NULL DEFAULT 'pending',
    quality             optimization_quality    NOT NULL DEFAULT 'good',
    settings            JSONB                   NOT NULL DEFAULT '{}',
    sheets              JSONB                   NOT NULL DEFAULT '[]',
    yield_percentage    DOUBLE PRECISION,
    created_at          TIMESTAMPTZ             NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ             NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_optimization_runs_job_id ON optimization_runs (job_id);
CREATE INDEX idx_optimization_runs_status ON optimization_runs (status);

-- Nested Sheets
CREATE TABLE nested_sheets (
    id                      UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    optimization_run_id     UUID        NOT NULL REFERENCES optimization_runs (id) ON DELETE CASCADE,
    material_id             UUID        NOT NULL REFERENCES materials (id),
    sheet_index             INTEGER     NOT NULL,
    width                   DOUBLE PRECISION NOT NULL,
    length                  DOUBLE PRECISION NOT NULL,
    parts_layout            JSONB       NOT NULL DEFAULT '[]',
    waste_percentage        DOUBLE PRECISION,
    gcode_file              TEXT,
    created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_nested_sheets_optimization_run_id ON nested_sheets (optimization_run_id);
CREATE INDEX idx_nested_sheets_material_id ON nested_sheets (material_id);

-- Remnants
CREATE TABLE remnants (
    id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    material_id     UUID        NOT NULL REFERENCES materials (id) ON DELETE CASCADE,
    width           DOUBLE PRECISION NOT NULL,
    length          DOUBLE PRECISION NOT NULL,
    thickness       DOUBLE PRECISION NOT NULL,
    source_sheet    TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_remnants_material_id ON remnants (material_id);

-- =============================================================================
-- QUOTES
-- =============================================================================

CREATE TABLE quotes (
    id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    job_id              UUID        NOT NULL REFERENCES jobs (id) ON DELETE CASCADE,
    quote_number        TEXT        NOT NULL UNIQUE,
    material_cost       DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    hardware_cost       DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    labor_cost          DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    markup_percentage   DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    total               DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    line_items          JSONB       NOT NULL DEFAULT '[]',
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_quotes_job_id ON quotes (job_id);
CREATE INDEX idx_quotes_quote_number ON quotes (quote_number);

-- =============================================================================
-- VISUALIZATION & ANNOTATIONS
-- =============================================================================

-- Saved Views
CREATE TABLE saved_views (
    id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    room_id         UUID        NOT NULL REFERENCES rooms (id) ON DELETE CASCADE,
    name            TEXT        NOT NULL,
    camera_position JSONB       NOT NULL DEFAULT '{}',
    layer_visibility JSONB      NOT NULL DEFAULT '{}',
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_saved_views_room_id ON saved_views (room_id);

-- Annotation Layers
CREATE TABLE annotation_layers (
    id       UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    room_id  UUID        NOT NULL REFERENCES rooms (id) ON DELETE CASCADE,
    name     TEXT        NOT NULL,
    color    TEXT        NOT NULL DEFAULT '#FF5500',
    visible  BOOLEAN     NOT NULL DEFAULT TRUE,
    items    JSONB       NOT NULL DEFAULT '[]',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_annotation_layers_room_id ON annotation_layers (room_id);

-- =============================================================================
-- UPDATED_AT TRIGGER FUNCTION
-- =============================================================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply updated_at trigger to all tables that have the column
CREATE TRIGGER trg_jobs_updated_at
    BEFORE UPDATE ON jobs
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trg_rooms_updated_at
    BEFORE UPDATE ON rooms
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trg_products_updated_at
    BEFORE UPDATE ON products
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trg_parts_updated_at
    BEFORE UPDATE ON parts
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trg_materials_updated_at
    BEFORE UPDATE ON materials
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trg_textures_updated_at
    BEFORE UPDATE ON textures
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trg_hardware_updated_at
    BEFORE UPDATE ON hardware
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trg_tools_updated_at
    BEFORE UPDATE ON tools
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trg_machines_updated_at
    BEFORE UPDATE ON machines
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trg_optimization_runs_updated_at
    BEFORE UPDATE ON optimization_runs
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trg_quotes_updated_at
    BEFORE UPDATE ON quotes
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trg_users_updated_at
    BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trg_post_processors_updated_at
    BEFORE UPDATE ON post_processors
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trg_construction_methods_updated_at
    BEFORE UPDATE ON construction_methods
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trg_material_templates_updated_at
    BEFORE UPDATE ON material_templates
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trg_label_templates_updated_at
    BEFORE UPDATE ON label_templates
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trg_drawing_templates_updated_at
    BEFORE UPDATE ON drawing_templates
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
