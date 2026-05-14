-- ============================================================
-- Migration 112: CCMS Approval Events + Clarifications
-- ============================================================

BEGIN;

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ── Approval Events (append-only) ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS ccms_approval_events (
    id                      UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id               UUID        NOT NULL,
    coverage_case_id        UUID        NOT NULL REFERENCES ccms_coverage_cases(id),
    authorization_id        UUID        REFERENCES ccms_coverage_authorizations(id),
    event_type              VARCHAR(80) NOT NULL,
    event_source            VARCHAR(20) NOT NULL DEFAULT 'manual',  -- manual|tpa_portal|api
    approval_status         VARCHAR(30) NOT NULL,  -- APPROVED|PARTIAL|REJECTED|CLARIFICATION
    approved_amount         NUMERIC(14,2) NOT NULL DEFAULT 0,
    partial_approval_reason TEXT,
    rejection_reason        TEXT,
    response_payload_json   JSONB,
    tpa_reference_number    VARCHAR(100),
    recorded_by_user_id     UUID,
    recorded_at             TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    -- Standard (but NO updated_at — strictly append-only)
    created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by_user_id      UUID,
    status                  VARCHAR(20) NOT NULL DEFAULT 'active'
    -- NO row_version — immutable rows
);

-- ── Clarification Items ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS ccms_clarification_items (
    id                      UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id               UUID        NOT NULL,
    authorization_id        UUID        NOT NULL REFERENCES ccms_coverage_authorizations(id),
    clarification_query     TEXT        NOT NULL,
    clarification_response  TEXT,
    requested_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    responded_at            TIMESTAMPTZ,
    created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by_user_id      UUID,
    updated_by_user_id      UUID,
    deleted_at              TIMESTAMPTZ,
    status                  VARCHAR(20) NOT NULL DEFAULT 'active',
    row_version             INT         NOT NULL DEFAULT 1
);

-- ── Indexes ──────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_ccms_appr_evt_case    ON ccms_approval_events (coverage_case_id);
CREATE INDEX IF NOT EXISTS idx_ccms_appr_evt_auth    ON ccms_approval_events (authorization_id);
CREATE INDEX IF NOT EXISTS idx_ccms_appr_evt_tenant  ON ccms_approval_events (tenant_id);
CREATE INDEX IF NOT EXISTS idx_ccms_clarif_auth      ON ccms_clarification_items (authorization_id);

-- ── Row-Level Security ───────────────────────────────────────────────────────
ALTER TABLE ccms_approval_events      ENABLE ROW LEVEL SECURITY;
ALTER TABLE ccms_clarification_items  ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='ccms_approval_events' AND policyname='tenant_isolation') THEN
        CREATE POLICY tenant_isolation ON ccms_approval_events FOR ALL USING (tenant_id::text = current_setting('app.current_tenant_id', true));
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='ccms_clarification_items' AND policyname='tenant_isolation') THEN
        CREATE POLICY tenant_isolation ON ccms_clarification_items FOR ALL USING (tenant_id::text = current_setting('app.current_tenant_id', true));
    END IF;
END $$;

COMMIT;
