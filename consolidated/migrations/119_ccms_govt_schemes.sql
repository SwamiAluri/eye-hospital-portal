-- ============================================================
-- Migration 119: CCMS Government Scheme Applications
-- ============================================================

BEGIN;

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE IF NOT EXISTS ccms_govt_scheme_applications (
    id                          UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id                   UUID        NOT NULL,
    coverage_case_id            UUID        NOT NULL REFERENCES ccms_coverage_cases(id),
    government_scheme_id        UUID        NOT NULL REFERENCES ccms_government_schemes(id),
    application_number          VARCHAR(50),
    beneficiary_id              VARCHAR(100),
    beneficiary_name            VARCHAR(200),
    approved_amount             NUMERIC(14,2) NOT NULL DEFAULT 0,
    actual_benefit              NUMERIC(14,2) NOT NULL DEFAULT 0,
    scheme_preauth_reference    VARCHAR(100),
    applied_at                  TIMESTAMPTZ,
    approved_at                 TIMESTAMPTZ,
    disbursed_at                TIMESTAMPTZ,
    rejection_reason            TEXT,
    application_payload_json    JSONB,
    created_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by_user_id          UUID,
    updated_by_user_id          UUID,
    deleted_at                  TIMESTAMPTZ,
    status                      VARCHAR(20) NOT NULL DEFAULT 'active',
    row_version                 INT         NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS ccms_govt_scheme_documents (
    id                      UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id               UUID        NOT NULL,
    application_id          UUID        NOT NULL REFERENCES ccms_govt_scheme_applications(id),
    document_type           VARCHAR(50) NOT NULL,
    document_name           VARCHAR(200) NOT NULL,
    blob_url                TEXT,
    uploaded_at             TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by_user_id      UUID,
    updated_by_user_id      UUID,
    deleted_at              TIMESTAMPTZ,
    status                  VARCHAR(20) NOT NULL DEFAULT 'active',
    row_version             INT         NOT NULL DEFAULT 1
);

CREATE INDEX IF NOT EXISTS idx_ccms_gs_app_case   ON ccms_govt_scheme_applications (coverage_case_id);
CREATE INDEX IF NOT EXISTS idx_ccms_gs_app_scheme ON ccms_govt_scheme_applications (government_scheme_id);
CREATE INDEX IF NOT EXISTS idx_ccms_gs_doc_app    ON ccms_govt_scheme_documents (application_id);

ALTER TABLE ccms_govt_scheme_applications ENABLE ROW LEVEL SECURITY;
ALTER TABLE ccms_govt_scheme_documents    ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='ccms_govt_scheme_applications' AND policyname='tenant_isolation') THEN
        CREATE POLICY tenant_isolation ON ccms_govt_scheme_applications FOR ALL USING (tenant_id::text = current_setting('app.current_tenant_id', true));
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='ccms_govt_scheme_documents' AND policyname='tenant_isolation') THEN
        CREATE POLICY tenant_isolation ON ccms_govt_scheme_documents FOR ALL USING (tenant_id::text = current_setting('app.current_tenant_id', true));
    END IF;
END $$;

COMMIT;
