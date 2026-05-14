-- ============================================================
-- Migration 117: CCMS Documents
-- ============================================================

BEGIN;

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE IF NOT EXISTS ccms_documents (
    id                      UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id               UUID        NOT NULL,
    coverage_case_id        UUID        NOT NULL REFERENCES ccms_coverage_cases(id),
    document_stage          VARCHAR(30) NOT NULL,  -- pre_auth|approval|billing|claim|settlement|general
    document_type           VARCHAR(50) NOT NULL,
    document_name           VARCHAR(200) NOT NULL,
    blob_url                TEXT,
    file_size_bytes         BIGINT,
    mime_type               VARCHAR(80),
    checksum_sha256         VARCHAR(64),
    is_patient_visible      BOOLEAN     NOT NULL DEFAULT FALSE,
    is_tpa_visible          BOOLEAN     NOT NULL DEFAULT TRUE,
    uploaded_at             TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by_user_id      UUID,
    updated_by_user_id      UUID,
    deleted_at              TIMESTAMPTZ,
    status                  VARCHAR(20) NOT NULL DEFAULT 'active',
    row_version             INT         NOT NULL DEFAULT 1
);

CREATE INDEX IF NOT EXISTS idx_ccms_doc_case    ON ccms_documents (coverage_case_id);
CREATE INDEX IF NOT EXISTS idx_ccms_doc_stage   ON ccms_documents (coverage_case_id, document_stage);

ALTER TABLE ccms_documents ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='ccms_documents' AND policyname='tenant_isolation') THEN
        CREATE POLICY tenant_isolation ON ccms_documents FOR ALL USING (tenant_id::text = current_setting('app.current_tenant_id', true));
    END IF;
END $$;

COMMIT;
