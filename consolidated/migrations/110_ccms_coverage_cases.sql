-- ============================================================
-- Migration 110: CCMS Coverage Cases Tables
-- Coverage Cases, Eligibility Checks, Policy Captures,
-- Policy Coverage Items
-- ============================================================

BEGIN;

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ── Coverage Cases ───────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS ccms_coverage_cases (
    id                      UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id               UUID        NOT NULL,
    case_number             VARCHAR(30)  NOT NULL,            -- CCMS-2526-000001
    patient_id              UUID        NOT NULL,
    patient_name            VARCHAR(200),
    session_id              UUID,                             -- counselling session FK
    journey_id              UUID,                             -- ip patient journey FK
    financial_year_id       UUID        REFERENCES ccms_financial_years(id),
    branch_id               UUID,
    doctor_id               UUID,
    payer_type              VARCHAR(20) NOT NULL DEFAULT 'insurance',  -- insurance|tpa|govt|cashless
    insurance_provider_id   UUID        REFERENCES ccms_insurance_providers(id),
    tpa_provider_id         UUID        REFERENCES ccms_tpa_providers(id),
    government_scheme_id    UUID        REFERENCES ccms_government_schemes(id),
    coverage_package_id     UUID        REFERENCES ccms_coverage_packages(id),
    workflow_instance_id    UUID        REFERENCES ccms_workflow_instances(id),
    current_state           VARCHAR(50) NOT NULL DEFAULT 'DRAFT',
    approved_amount         NUMERIC(14,2) NOT NULL DEFAULT 0,
    room_class_approved     VARCHAR(30),
    pre_auth_number         VARCHAR(50),
    pre_auth_expiry         TIMESTAMPTZ,
    legacy_preauth_id       UUID,                             -- bridge: insurance_pre_authorizations.id
    session_preauth_id      UUID,                             -- bridge: insurance_preauth_requests.id
    emergency_fc_applied    BOOLEAN     NOT NULL DEFAULT FALSE,
    notes_json              JSONB,
    created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by_user_id      UUID,
    updated_by_user_id      UUID,
    deleted_at              TIMESTAMPTZ,
    status                  VARCHAR(20) NOT NULL DEFAULT 'active',
    row_version             INT         NOT NULL DEFAULT 1,
    CONSTRAINT uq_ccms_case_number UNIQUE (tenant_id, case_number)
);

-- ── Sequence for case numbers per tenant per financial year ──────────────────
-- Case number format: CCMS-{YYMM}-{SEQ:06d}
-- We use a PostgreSQL sequence scoped by tenant+fy via a separate tracking table.
CREATE TABLE IF NOT EXISTS ccms_case_number_sequences (
    tenant_id           UUID    NOT NULL,
    financial_year_id   UUID    NOT NULL,
    last_sequence       BIGINT  NOT NULL DEFAULT 0,
    PRIMARY KEY (tenant_id, financial_year_id)
);

-- Function to generate next case number atomically
CREATE OR REPLACE FUNCTION ccms_next_case_number(
    p_tenant_id UUID,
    p_fy_id     UUID,
    p_year_code VARCHAR
) RETURNS VARCHAR AS $$
DECLARE
    v_seq BIGINT;
BEGIN
    INSERT INTO ccms_case_number_sequences (tenant_id, financial_year_id, last_sequence)
    VALUES (p_tenant_id, p_fy_id, 1)
    ON CONFLICT (tenant_id, financial_year_id)
    DO UPDATE SET last_sequence = ccms_case_number_sequences.last_sequence + 1
    RETURNING last_sequence INTO v_seq;

    RETURN 'CCMS-' || p_year_code || '-' || LPAD(v_seq::TEXT, 6, '0');
END;
$$ LANGUAGE plpgsql;

-- ── Eligibility Checks ───────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS ccms_eligibility_checks (
    id                          UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id                   UUID        NOT NULL,
    coverage_case_id            UUID        NOT NULL REFERENCES ccms_coverage_cases(id),
    policy_number               VARCHAR(100),
    membership_id               VARCHAR(100),
    check_method                VARCHAR(20) NOT NULL DEFAULT 'manual',  -- manual|portal|api
    response_code               VARCHAR(30),
    is_eligible                 BOOLEAN     NOT NULL DEFAULT FALSE,
    eligibility_response_json   JSONB,
    checked_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by_user_id          UUID,
    updated_by_user_id          UUID,
    deleted_at                  TIMESTAMPTZ,
    status                      VARCHAR(20) NOT NULL DEFAULT 'active',
    row_version                 INT         NOT NULL DEFAULT 1
);

-- ── Policy Captures ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS ccms_policy_captures (
    id                      UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id               UUID        NOT NULL,
    coverage_case_id        UUID        NOT NULL REFERENCES ccms_coverage_cases(id),
    policy_number           VARCHAR(100) NOT NULL,
    member_name             VARCHAR(200),
    member_dob              DATE,
    policy_start_date       DATE        NOT NULL,
    policy_end_date         DATE        NOT NULL,
    sum_insured             NUMERIC(14,2) NOT NULL DEFAULT 0,
    balance_sum_insured     NUMERIC(14,2) NOT NULL DEFAULT 0,
    cumulative_bonus_amount NUMERIC(14,2) NOT NULL DEFAULT 0,
    room_entitlement        VARCHAR(50),
    policy_docs_json        JSONB,
    captured_at             TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by_user_id      UUID,
    updated_by_user_id      UUID,
    deleted_at              TIMESTAMPTZ,
    status                  VARCHAR(20) NOT NULL DEFAULT 'active',
    row_version             INT         NOT NULL DEFAULT 1
);

-- ── Policy Coverage Items ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS ccms_policy_coverage_items (
    id                  UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id           UUID        NOT NULL,
    policy_capture_id   UUID        NOT NULL REFERENCES ccms_policy_captures(id),
    item_type           VARCHAR(30) NOT NULL,   -- benefit|sub_limit|exclusion
    item_code           VARCHAR(50),
    item_description    VARCHAR(200) NOT NULL,
    limit_amount        NUMERIC(14,2) NOT NULL DEFAULT 0,
    used_amount         NUMERIC(14,2) NOT NULL DEFAULT 0,
    available_amount    NUMERIC(14,2) NOT NULL DEFAULT 0,
    is_excluded         BOOLEAN     NOT NULL DEFAULT FALSE,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by_user_id  UUID,
    updated_by_user_id  UUID,
    deleted_at          TIMESTAMPTZ,
    status              VARCHAR(20) NOT NULL DEFAULT 'active',
    row_version         INT         NOT NULL DEFAULT 1
);

-- ── Indexes ──────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_ccms_case_tenant         ON ccms_coverage_cases (tenant_id);
CREATE INDEX IF NOT EXISTS idx_ccms_case_patient        ON ccms_coverage_cases (patient_id);
CREATE INDEX IF NOT EXISTS idx_ccms_case_session        ON ccms_coverage_cases (session_id);
CREATE INDEX IF NOT EXISTS idx_ccms_case_journey        ON ccms_coverage_cases (journey_id);
CREATE INDEX IF NOT EXISTS idx_ccms_case_state          ON ccms_coverage_cases (tenant_id, current_state);
CREATE INDEX IF NOT EXISTS idx_ccms_case_fy             ON ccms_coverage_cases (financial_year_id);
CREATE INDEX IF NOT EXISTS idx_ccms_case_ins            ON ccms_coverage_cases (insurance_provider_id);
CREATE INDEX IF NOT EXISTS idx_ccms_case_preauth_num    ON ccms_coverage_cases (tenant_id, pre_auth_number);
CREATE INDEX IF NOT EXISTS idx_ccms_elig_case           ON ccms_eligibility_checks (coverage_case_id);
CREATE INDEX IF NOT EXISTS idx_ccms_policy_case         ON ccms_policy_captures (coverage_case_id);
CREATE INDEX IF NOT EXISTS idx_ccms_cov_item_policy     ON ccms_policy_coverage_items (policy_capture_id);

-- ── Row-Level Security ───────────────────────────────────────────────────────
ALTER TABLE ccms_coverage_cases           ENABLE ROW LEVEL SECURITY;
ALTER TABLE ccms_case_number_sequences    ENABLE ROW LEVEL SECURITY;
ALTER TABLE ccms_eligibility_checks       ENABLE ROW LEVEL SECURITY;
ALTER TABLE ccms_policy_captures          ENABLE ROW LEVEL SECURITY;
ALTER TABLE ccms_policy_coverage_items    ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='ccms_coverage_cases' AND policyname='tenant_isolation') THEN
        CREATE POLICY tenant_isolation ON ccms_coverage_cases FOR ALL USING (tenant_id::text = current_setting('app.current_tenant_id', true));
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='ccms_case_number_sequences' AND policyname='tenant_isolation') THEN
        CREATE POLICY tenant_isolation ON ccms_case_number_sequences FOR ALL USING (tenant_id::text = current_setting('app.current_tenant_id', true));
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='ccms_eligibility_checks' AND policyname='tenant_isolation') THEN
        CREATE POLICY tenant_isolation ON ccms_eligibility_checks FOR ALL USING (tenant_id::text = current_setting('app.current_tenant_id', true));
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='ccms_policy_captures' AND policyname='tenant_isolation') THEN
        CREATE POLICY tenant_isolation ON ccms_policy_captures FOR ALL USING (tenant_id::text = current_setting('app.current_tenant_id', true));
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='ccms_policy_coverage_items' AND policyname='tenant_isolation') THEN
        CREATE POLICY tenant_isolation ON ccms_policy_coverage_items FOR ALL USING (tenant_id::text = current_setting('app.current_tenant_id', true));
    END IF;
END $$;

COMMIT;
