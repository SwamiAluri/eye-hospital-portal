-- ============================================================
-- Migration 111: CCMS Pre-Authorization Tables
-- Coverage Authorizations + Authorization Documents
-- ============================================================

BEGIN;

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ── Coverage Authorizations ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS ccms_coverage_authorizations (
    id                      UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id               UUID        NOT NULL,
    coverage_case_id        UUID        NOT NULL REFERENCES ccms_coverage_cases(id),
    authorization_type      VARCHAR(20) NOT NULL DEFAULT 'preauth',  -- preauth|enhancement|resubmission
    pre_auth_number         VARCHAR(50),
    requested_amount        NUMERIC(14,2) NOT NULL DEFAULT 0,
    approved_amount         NUMERIC(14,2) NOT NULL DEFAULT 0,
    room_class_requested    VARCHAR(30),
    room_class_approved     VARCHAR(30),
    diagnosis_json          JSONB,         -- [{code, description}]
    procedures_json         JSONB,         -- [{code, description, amount}]
    valid_from              TIMESTAMPTZ,
    valid_to                TIMESTAMPTZ,
    submitted_at            TIMESTAMPTZ,
    received_at             TIMESTAMPTZ,
    tpa_reference_number    VARCHAR(100),
    legacy_preauth_id       UUID,          -- bridge: insurance_pre_authorizations.id
    session_preauth_id      UUID,          -- bridge: insurance_preauth_requests.id
    rejection_reason        TEXT,
    created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by_user_id      UUID,
    updated_by_user_id      UUID,
    deleted_at              TIMESTAMPTZ,
    status                  VARCHAR(20) NOT NULL DEFAULT 'active',
    row_version             INT         NOT NULL DEFAULT 1
);

-- ── Authorization Documents ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS ccms_authorization_documents (
    id                  UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id           UUID        NOT NULL,
    authorization_id    UUID        NOT NULL REFERENCES ccms_coverage_authorizations(id),
    document_type       VARCHAR(50) NOT NULL,
    document_name       VARCHAR(200) NOT NULL,
    blob_url            TEXT,
    uploaded_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by_user_id  UUID,
    updated_by_user_id  UUID,
    deleted_at          TIMESTAMPTZ,
    status              VARCHAR(20) NOT NULL DEFAULT 'active',
    row_version         INT         NOT NULL DEFAULT 1
);

-- ── Indexes ──────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_ccms_auth_case        ON ccms_coverage_authorizations (coverage_case_id);
CREATE INDEX IF NOT EXISTS idx_ccms_auth_tenant      ON ccms_coverage_authorizations (tenant_id);
CREATE INDEX IF NOT EXISTS idx_ccms_auth_preauth_num ON ccms_coverage_authorizations (tenant_id, pre_auth_number);
CREATE INDEX IF NOT EXISTS idx_ccms_auth_legacy      ON ccms_coverage_authorizations (legacy_preauth_id);
CREATE INDEX IF NOT EXISTS idx_ccms_auth_session     ON ccms_coverage_authorizations (session_preauth_id);
CREATE INDEX IF NOT EXISTS idx_ccms_auth_doc_auth    ON ccms_authorization_documents (authorization_id);

-- ── Row-Level Security ───────────────────────────────────────────────────────
ALTER TABLE ccms_coverage_authorizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE ccms_authorization_documents ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='ccms_coverage_authorizations' AND policyname='tenant_isolation') THEN
        CREATE POLICY tenant_isolation ON ccms_coverage_authorizations FOR ALL USING (tenant_id::text = current_setting('app.current_tenant_id', true));
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='ccms_authorization_documents' AND policyname='tenant_isolation') THEN
        CREATE POLICY tenant_isolation ON ccms_authorization_documents FOR ALL USING (tenant_id::text = current_setting('app.current_tenant_id', true));
    END IF;
END $$;

COMMIT;
