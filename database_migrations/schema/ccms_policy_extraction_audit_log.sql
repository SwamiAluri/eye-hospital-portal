-- ============================================================================
-- Migration: CCMS Policy Extraction Audit Log
-- Purpose  : Audit trail for insurance card OCR (front/back) on coverage cases.
-- ============================================================================

CREATE TABLE IF NOT EXISTS ccms_policy_extraction_audit_logs (
    id                      UUID         NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    tenant_id               UUID         NOT NULL,
    user_id                 UUID         NOT NULL,
    coverage_case_id        UUID         NOT NULL,
    session_id              VARCHAR(64)  NOT NULL,

    outcome                 VARCHAR(20)  NOT NULL DEFAULT 'Confirmed',

    original_filename       VARCHAR(255) NOT NULL DEFAULT '',
    front_document_url      TEXT,
    back_document_url       TEXT,
    blob_purge_at           TIMESTAMPTZ  NOT NULL,
    blob_purged             BOOLEAN      NOT NULL DEFAULT FALSE,

    provider_model          VARCHAR(100) NOT NULL DEFAULT '',
    processing_ms           INTEGER      NOT NULL DEFAULT 0,

    high_field_count        INTEGER      NOT NULL DEFAULT 0,
    review_field_count      INTEGER      NOT NULL DEFAULT 0,
    low_field_count         INTEGER      NOT NULL DEFAULT 0,
    field_override_count    INTEGER      NOT NULL DEFAULT 0,
    overridden_fields_json  TEXT,

    created_policy_id       UUID,

    created_at              TIMESTAMPTZ  NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ccms_policy_extraction_audit_session
    ON ccms_policy_extraction_audit_logs (tenant_id, session_id);

CREATE INDEX IF NOT EXISTS idx_ccms_policy_extraction_audit_case
    ON ccms_policy_extraction_audit_logs (coverage_case_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_ccms_policy_extraction_audit_purge
    ON ccms_policy_extraction_audit_logs (tenant_id, blob_purge_at, blob_purged)
    WHERE blob_purged = FALSE;
