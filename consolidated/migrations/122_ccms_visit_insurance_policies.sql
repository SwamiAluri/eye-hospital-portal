-- ============================================================
-- Migration 122: CCMS Visit Insurance Policies
-- Supports multiple policies per counselling session / coverage
-- case. Replaces the single-policy counsellor_draft_json pattern
-- as the durable store for policy data.
-- ============================================================

BEGIN;

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE IF NOT EXISTS ccms_visit_insurance_policies (
    id                          UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id                   UUID        NOT NULL,

    -- Owning session / case (either or both may be set)
    session_id                  UUID,   -- counselling_sessions.id (auth DB, non-FK)
    coverage_case_id            UUID    REFERENCES ccms_coverage_cases(id),

    -- Core policy identifiers
    policy_number               VARCHAR(100) NOT NULL,
    card_number                 VARCHAR(100),
    membership_number           VARCHAR(100),

    -- Payer references
    insurance_provider_id       UUID    REFERENCES ccms_insurance_providers(id),
    tpa_provider_id             UUID    REFERENCES ccms_tpa_providers(id),

    -- Insured person
    insured_name                VARCHAR(200),
    relationship_to_insured     VARCHAR(50),   -- self|spouse|child|parent|other

    -- Employment block (reference parity)
    occupation                  VARCHAR(100),
    designation                 VARCHAR(100),
    company_name                VARCHAR(200),
    employee_id                 VARCHAR(100),
    vide_number                 VARCHAR(100),
    contact_number              VARCHAR(30),

    -- Referring / treating doctor (visit-specific)
    doctor_name                 VARCHAR(200),
    doctor_reg_number           VARCHAR(100),
    doctor_qualification        VARCHAR(100),
    doctor_contact              VARCHAR(30),

    -- Accommodation
    accommodation_class         VARCHAR(50),   -- general|semi-private|private|icu
    details_text                TEXT,

    -- TPA coordination
    tpa_coordinator_name        VARCHAR(200),

    -- Multi-policy ordering
    is_primary                  BOOLEAN     NOT NULL DEFAULT FALSE,
    sort_order                  INT         NOT NULL DEFAULT 0,

    -- Underwriting snapshot (chronic conditions + flags)
    -- JSON shape: { conditions: [{code, label, since}], alcoholUse: bool, hivRisk: bool, otherAilments: string }
    underwriting_snapshot_json  JSONB,

    -- Service tax override (NULL → inherit from payer default)
    service_tax_applicable      BOOLEAN,

    -- Status / audit
    status                      VARCHAR(20) NOT NULL DEFAULT 'active',
    created_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by_user_id          UUID,
    updated_by_user_id          UUID,
    deleted_at                  TIMESTAMPTZ,
    row_version                 INT         NOT NULL DEFAULT 1,

    CONSTRAINT chk_visit_policy_owner CHECK (
        session_id IS NOT NULL OR coverage_case_id IS NOT NULL
    )
);

-- Enforce at most one primary policy per case / session at DB level
CREATE UNIQUE INDEX IF NOT EXISTS uq_primary_policy_per_case
    ON ccms_visit_insurance_policies (coverage_case_id)
    WHERE is_primary = TRUE AND deleted_at IS NULL AND coverage_case_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_primary_policy_per_session
    ON ccms_visit_insurance_policies (session_id)
    WHERE is_primary = TRUE AND deleted_at IS NULL AND session_id IS NOT NULL AND coverage_case_id IS NULL;

CREATE INDEX IF NOT EXISTS idx_visit_policy_session      ON ccms_visit_insurance_policies (session_id);
CREATE INDEX IF NOT EXISTS idx_visit_policy_case         ON ccms_visit_insurance_policies (coverage_case_id);
CREATE INDEX IF NOT EXISTS idx_visit_policy_tenant_pnum  ON ccms_visit_insurance_policies (tenant_id, policy_number);

ALTER TABLE ccms_visit_insurance_policies ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE tablename = 'ccms_visit_insurance_policies' AND policyname = 'tenant_isolation'
    ) THEN
        CREATE POLICY tenant_isolation ON ccms_visit_insurance_policies
            FOR ALL USING (tenant_id::text = current_setting('app.current_tenant_id', true));
    END IF;
END $$;

COMMIT;
