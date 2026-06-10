-- ============================================================================
-- Migration 138: S4 — Form 3 PAC Assessment + Form 5 Anaesthesia Monitoring
-- Dependencies: 137_s3_ot_surgical_safety.sql
-- Date: 2026-06
-- ============================================================================

BEGIN;

-- ── Form 3: PAC Assessment ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS pac_assessment (
    id                          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id                   UUID NOT NULL REFERENCES tenant(id),
    patient_journey_id          UUID NOT NULL REFERENCES patient_journey(id) ON DELETE CASCADE,

    assessed_at                 TIMESTAMPTZ,
    pre_op_diagnosis            TEXT,

    bp                          VARCHAR(20),
    hr                          INTEGER,
    physical_status_asa         INTEGER,

    investigations              JSONB NOT NULL DEFAULT '{}'::jsonb,
    allergies                   TEXT,
    systemic_review             JSONB NOT NULL DEFAULT '{}'::jsonb,
    past_anaesthetic_history    TEXT,
    airway_exam                 JSONB NOT NULL DEFAULT '{}'::jsonb,

    anaesthesia_plan            VARCHAR(30),
    peri_op_explained           BOOLEAN NOT NULL DEFAULT FALSE,
    consent_type                VARCHAR(30),
    current_medications         JSONB NOT NULL DEFAULT '[]'::jsonb,
    pre_op_consultations        TEXT,
    medications_advised         TEXT,
    investigations_advised      TEXT,
    completed_by_designation    VARCHAR(100),

    assessment_status           VARCHAR(20) NOT NULL DEFAULT 'Draft',
    completed_by_user_id        UUID REFERENCES users(id),
    completed_at                TIMESTAMPTZ,

    created_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at                  TIMESTAMPTZ,
    status                      VARCHAR(20) NOT NULL DEFAULT 'active',

    CONSTRAINT uq_pac_assessment_journey UNIQUE (patient_journey_id),
    CONSTRAINT pac_assessment_status_check CHECK (assessment_status IN ('Draft', 'Completed'))
);

CREATE INDEX IF NOT EXISTS idx_pac_assessment_journey
    ON pac_assessment(patient_journey_id) WHERE deleted_at IS NULL;

ALTER TABLE pac_assessment ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON pac_assessment;
CREATE POLICY tenant_isolation ON pac_assessment
    FOR ALL USING (tenant_id::text = current_setting('app.current_tenant_id', true));

-- ── Form 5: Anaesthesia Monitoring ───────────────────────────────────────────
CREATE TABLE IF NOT EXISTS anaesthesia_monitoring (
    id                          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id                   UUID NOT NULL REFERENCES tenant(id),
    patient_journey_id          UUID NOT NULL REFERENCES patient_journey(id) ON DELETE CASCADE,

    pre_op_pulse                INTEGER,
    pre_op_bp                   VARCHAR(20),
    pre_op_spo2                 INTEGER,
    pre_op_consent_confirmed    BOOLEAN NOT NULL DEFAULT FALSE,
    pre_op_review_at            TIMESTAMPTZ,

    monitoring_readings         JSONB NOT NULL DEFAULT '[]'::jsonb,

    discharge_pr                INTEGER,
    discharge_bp                VARCHAR(20),
    general_condition_normal    BOOLEAN,
    discharge_remarks           TEXT,
    discharge_cleared_by        UUID REFERENCES users(id),
    discharge_cleared_at        TIMESTAMPTZ,

    created_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at                  TIMESTAMPTZ,
    status                      VARCHAR(20) NOT NULL DEFAULT 'active',

    CONSTRAINT uq_anaesthesia_monitoring_journey UNIQUE (patient_journey_id)
);

CREATE INDEX IF NOT EXISTS idx_anaesthesia_monitoring_journey
    ON anaesthesia_monitoring(patient_journey_id) WHERE deleted_at IS NULL;

ALTER TABLE anaesthesia_monitoring ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON anaesthesia_monitoring;
CREATE POLICY tenant_isolation ON anaesthesia_monitoring
    FOR ALL USING (tenant_id::text = current_setting('app.current_tenant_id', true));

COMMIT;
