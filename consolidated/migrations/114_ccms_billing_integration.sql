-- ============================================================
-- Migration 114: CCMS Billing Integration
-- Billing Summaries + Coverage Allocations
-- ============================================================

BEGIN;

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE IF NOT EXISTS ccms_billing_summaries (
    id                      UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id               UUID        NOT NULL,
    coverage_case_id        UUID        NOT NULL REFERENCES ccms_coverage_cases(id),
    bill_id                 UUID,                    -- FK to opd_bill or ip_billing_transaction
    bill_date               TIMESTAMPTZ NOT NULL,
    total_bill_amount       NUMERIC(14,2) NOT NULL DEFAULT 0,
    insurance_share_amount  NUMERIC(14,2) NOT NULL DEFAULT 0,
    patient_share_amount    NUMERIC(14,2) NOT NULL DEFAULT 0,
    copay_amount            NUMERIC(14,2) NOT NULL DEFAULT 0,
    deductible_amount       NUMERIC(14,2) NOT NULL DEFAULT 0,
    disallowed_amount       NUMERIC(14,2) NOT NULL DEFAULT 0,
    bill_items_json         JSONB,
    created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by_user_id      UUID,
    updated_by_user_id      UUID,
    deleted_at              TIMESTAMPTZ,
    status                  VARCHAR(20) NOT NULL DEFAULT 'active',
    row_version             INT         NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS ccms_coverage_allocations (
    id                      UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id               UUID        NOT NULL,
    billing_summary_id      UUID        NOT NULL REFERENCES ccms_billing_summaries(id),
    line_item_type          VARCHAR(50) NOT NULL,
    line_item_code          VARCHAR(50),
    line_item_description   VARCHAR(200) NOT NULL,
    billed_amount           NUMERIC(14,2) NOT NULL DEFAULT 0,
    covered_amount          NUMERIC(14,2) NOT NULL DEFAULT 0,
    disallowed_amount       NUMERIC(14,2) NOT NULL DEFAULT 0,
    disallowed_reason       TEXT,
    patient_payable         NUMERIC(14,2) NOT NULL DEFAULT 0,
    created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by_user_id      UUID,
    updated_by_user_id      UUID,
    deleted_at              TIMESTAMPTZ,
    status                  VARCHAR(20) NOT NULL DEFAULT 'active',
    row_version             INT         NOT NULL DEFAULT 1
);

CREATE INDEX IF NOT EXISTS idx_ccms_bill_sum_case      ON ccms_billing_summaries (coverage_case_id);
CREATE INDEX IF NOT EXISTS idx_ccms_bill_sum_bill_id   ON ccms_billing_summaries (bill_id);
CREATE INDEX IF NOT EXISTS idx_ccms_cov_alloc_sum      ON ccms_coverage_allocations (billing_summary_id);

ALTER TABLE ccms_billing_summaries   ENABLE ROW LEVEL SECURITY;
ALTER TABLE ccms_coverage_allocations ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='ccms_billing_summaries' AND policyname='tenant_isolation') THEN
        CREATE POLICY tenant_isolation ON ccms_billing_summaries FOR ALL USING (tenant_id::text = current_setting('app.current_tenant_id', true));
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='ccms_coverage_allocations' AND policyname='tenant_isolation') THEN
        CREATE POLICY tenant_isolation ON ccms_coverage_allocations FOR ALL USING (tenant_id::text = current_setting('app.current_tenant_id', true));
    END IF;
END $$;

COMMIT;
