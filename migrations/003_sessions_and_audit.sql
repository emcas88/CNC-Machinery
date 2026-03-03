-- =============================================================================
-- CNC Cabinet Manufacturing Software — Sessions & Audit Logs
-- Migration: 003_sessions_and_audit.sql
-- F21: Backend Compilation Fixes
--
-- Creates the sessions table (JWT refresh-token storage) and the audit_logs
-- table (immutable record of every mutating API action).
-- =============================================================================

-- ---------------------------------------------------------------------------
-- SESSIONS — stores hashed refresh tokens for each active login
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS sessions (
    id                  UUID            PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id             UUID            NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    refresh_token_hash  VARCHAR(255)    NOT NULL,
    expires_at          TIMESTAMPTZ     NOT NULL,
    ip_address          INET,
    user_agent          TEXT,
    created_at          TIMESTAMPTZ     NOT NULL DEFAULT NOW()
);

-- ---------------------------------------------------------------------------
-- AUDIT LOGS — immutable record of every mutating action
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS audit_logs (
    id              UUID            PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID            REFERENCES users(id),
    action          VARCHAR(100)    NOT NULL,
    entity_type     VARCHAR(100)    NOT NULL,
    entity_id       UUID,
    old_value       JSONB,
    new_value       JSONB,
    ip_address      INET,
    created_at      TIMESTAMPTZ     NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_audit_logs_user    ON audit_logs(user_id);
CREATE INDEX idx_audit_logs_entity  ON audit_logs(entity_type, entity_id);
CREATE INDEX idx_audit_logs_created ON audit_logs(created_at);
