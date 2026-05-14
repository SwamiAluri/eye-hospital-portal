-- ============================================================
-- Migration 115: CCMS Claims
-- ============================================================

BEGIN;

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE IF NOT EXISTS ccms_claim_packets (
    id                          UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id                   UUID        NOT NULL,
    coverage_case_id            UUID        NOT NULL REFERENCES ccms_coverage_cases(id),
    claim_number                VARCHAR(50) NOT NULL,
    claimed_amount              NUMERIC(14,2) NOT NULL DEFAULT 0,
    claim_type                  VARCHAR(20) NOT NULL DEFAULT 'cashless', -- cashless|reimbursement
    submission_mode             VARCHAR(20) NOT NULL DEFAULT 'manual',
    submitted_at                TIMESTAMPTZ,
    acknowledged_at             TIMESTAMPTZ,
    tpa_claim_number            VARCHAR(100),
    expected_settlement_date    DATE,
    claim_packet_json           JSONB,
    created_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by_user_id          UUID,
    updated_by_user_id          UUID,
    deleted_at                  TIMESTAMPTZ,
    status                      VARCHAR(20) NOT NULL DEFAULT 'active',
    row_version                 INT         NOT NULL DEFAULT 1,
    CONSTRAINT uq_ccms_claim_number UNIQUE (tenant_id, claim_number)
);

CREATE TABLE IF NOT EXISTS ccms_claim_documents (
    id                  UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id           UUID        NOT NULL,
    claim_packet_id     UUID        NOT NULL REFERENCES ccms_claim_packets(id),
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

CREATE INDEX IF NOT EXISTS idx_ccms_claim_case     ON ccms_claim_packets (coverage_case_id);
CREATE INDEX IF NOT EXISTS idx_ccms_claim_doc      ON ccms_claim_documents (claim_packet_id);

ALTER TABLE ccms_claim_packets   ENABLE ROW LEVEL SECURITY;
ALTER TABLE ccms_claim_documents ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='ccms_claim_packets' AND policyname='tenant_isolation') THEN
        CREATE POLICY tenant_isolation ON ccms_claim_packets FOR ALL USING (tenant_id::text = current_setting('app.current_tenant_id', true));
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='ccms_claim_documents' AND policyname='tenant_isolation') THEN
        CREATE POLICY tenant_isolation ON ccms_claim_documents FOR ALL USING (tenant_id::text = current_setting('app.current_tenant_id', true));
    END IF;
END $$;

COMMIT;
