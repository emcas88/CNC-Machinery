-- =============================================================================
-- CNC Cabinet Manufacturing Software — Shop Floor Scan Tracking
-- Migration: 002_shop_floor_scans.sql
-- F21: Backend Compilation Fixes
--
-- Creates the shop_floor_scans table used by the ShopFloorScan model.
-- Tracks barcode/QR/RFID scans on the factory floor to monitor part
-- progress through machining stations.
-- =============================================================================

CREATE TABLE IF NOT EXISTS shop_floor_scans (
    id              UUID            PRIMARY KEY DEFAULT gen_random_uuid(),
    part_id         UUID            NOT NULL REFERENCES parts(id),
    machine_id      UUID            NOT NULL REFERENCES machines(id),
    operator_id     UUID            REFERENCES users(id),
    scan_type       VARCHAR(50)     NOT NULL,           -- 'barcode', 'qr', 'rfid', 'manual'
    scan_value      VARCHAR(255)    NOT NULL,
    station         VARCHAR(100),                       -- which station/machine scanned
    status          VARCHAR(50)     NOT NULL DEFAULT 'scanned',  -- 'scanned', 'in_progress', 'completed', 'rejected'
    quality_check   JSONB,                              -- quality check results
    notes           TEXT,
    scanned_at      TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    completed_at    TIMESTAMPTZ,
    created_at      TIMESTAMPTZ     NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_shop_floor_scans_part    ON shop_floor_scans(part_id);
CREATE INDEX idx_shop_floor_scans_machine ON shop_floor_scans(machine_id);
CREATE INDEX idx_shop_floor_scans_status  ON shop_floor_scans(status);
