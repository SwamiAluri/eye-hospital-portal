-- ============================================================================
-- Migration 145: Pre-op consent details — structured medico-legal capture
-- Purpose:
--   Add a 1:1 child table for Consent-category pre_op_completions capturing the
--   structured signatory record (patient/witness/surgeon), consent version,
--   method, signed-at and the capturing user. Revoke columns are added now so
--   the next-pass revoke flow needs no further migration.
-- Dependencies: pre_op_completions (91/142), users (auth-service)
-- Date: 2026-06
--
-- Rollback (manual — run only if reverting 145):
--   DROP TABLE IF EXISTS pre_op_consent_details;
-- ============================================================================

BEGIN;

CREATE TABLE IF NOT EXISTS pre_op_consent_details (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id           UUID NOT NULL,
    completion_id       UUID NOT NULL REFERENCES pre_op_completions(id) ON DELETE CASCADE,
    patient_signed      BOOLEAN NOT NULL DEFAULT FALSE,
    witness_name        VARCHAR(200),
    witness_relation    VARCHAR(100),
    surgeon_user_id     UUID REFERENCES users(id),
    consent_version     VARCHAR(50),
    method              VARCHAR(20) NOT NULL DEFAULT 'Upload',
    signed_at           TIMESTAMPTZ,
    captured_by_user_id UUID REFERENCES users(id),
    -- Reserved for the next-pass revoke flow (no UI wiring yet)
    revoked_at          TIMESTAMPTZ,
    revoked_reason      TEXT,
    revoked_by_user_id  UUID REFERENCES users(id),
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT pre_op_consent_details_method_check
        CHECK (method IN ('Upload', 'ESign', 'Verbal', 'Video'))
);

-- One consent-detail row per completion.
CREATE UNIQUE INDEX IF NOT EXISTS ux_preop_consent_details_completion
    ON pre_op_consent_details(completion_id);

COMMENT ON TABLE pre_op_consent_details IS
    'Structured medico-legal signatory record for a Consent-category pre_op_completion (1 row per completion).';

COMMIT;
