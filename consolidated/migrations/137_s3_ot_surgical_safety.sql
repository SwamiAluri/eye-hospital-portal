-- ============================================================================
-- Migration 137: S3 — Form 1 OT Surgical Safety Checklist
-- Dependencies: 136_s2_medication_log_postop.sql
-- Date: 2026-06
-- ============================================================================

BEGIN;

CREATE TABLE IF NOT EXISTS surgical_safety_checklist (
    id                              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id                       UUID NOT NULL REFERENCES tenant(id),
    patient_journey_id              UUID NOT NULL REFERENCES patient_journey(id) ON DELETE CASCADE,

    -- Before Anaesthesia (Form 1 OT)
    identity_confirmed              BOOLEAN NOT NULL DEFAULT FALSE,
    eye_re                          BOOLEAN NOT NULL DEFAULT FALSE,
    eye_le                          BOOLEAN NOT NULL DEFAULT FALSE,
    topical_antibiotics_used        BOOLEAN NOT NULL DEFAULT FALSE,
    surgery_type                    VARCHAR(50),
    billing_verified_override       BOOLEAN NOT NULL DEFAULT FALSE,
    ascan_verified                  BOOLEAN NOT NULL DEFAULT FALSE,
    allergy_known                   BOOLEAN NOT NULL DEFAULT FALSE,
    allergy_details                 TEXT,
    consent_form_checked            BOOLEAN NOT NULL DEFAULT FALSE,
    fitness_confirmed               BOOLEAN NOT NULL DEFAULT FALSE,
    before_anaesthesia_completed_at TIMESTAMPTZ,
    before_anaesthesia_completed_by UUID REFERENCES users(id),

    -- WHO Before Incision
    who_patient_identity            BOOLEAN NOT NULL DEFAULT FALSE,
    who_correct_eye                 BOOLEAN NOT NULL DEFAULT FALSE,
    who_correct_procedure           BOOLEAN NOT NULL DEFAULT FALSE,
    who_consent_confirmed           BOOLEAN NOT NULL DEFAULT FALSE,
    who_surgeon_user_id             UUID,
    who_nurse_user_id               UUID,
    who_completed_at                TIMESTAMPTZ,

    -- After Surgery
    procedure_name_recorded         BOOLEAN NOT NULL DEFAULT FALSE,
    postop_medication_instructed    BOOLEAN NOT NULL DEFAULT FALSE,
    postop_position_instructed      BOOLEAN NOT NULL DEFAULT FALSE,
    after_surgery_completed_at      TIMESTAMPTZ,
    after_surgery_completed_by      UUID REFERENCES users(id),

    created_at                      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at                      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at                      TIMESTAMPTZ,
    status                          VARCHAR(20) NOT NULL DEFAULT 'active',

    CONSTRAINT uq_surgical_safety_journey UNIQUE (patient_journey_id)
);

CREATE INDEX IF NOT EXISTS idx_surgical_safety_journey
    ON surgical_safety_checklist(patient_journey_id)
    WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_surgical_safety_tenant
    ON surgical_safety_checklist(tenant_id)
    WHERE deleted_at IS NULL;

ALTER TABLE surgical_safety_checklist ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON surgical_safety_checklist;
CREATE POLICY tenant_isolation ON surgical_safety_checklist
    FOR ALL
    USING (tenant_id::text = current_setting('app.current_tenant_id', true));

COMMIT;
