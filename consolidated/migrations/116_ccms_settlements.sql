-- ============================================================
-- Migration 116: CCMS Settlements
-- ============================================================

BEGIN;

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE IF NOT EXISTS ccms_settlements (
    id                      UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id               UUID        NOT NULL,
    coverage_case_id        UUID        NOT NULL REFERENCES ccms_coverage_cases(id),
    claim_packet_id         UUID        REFERENCES ccms_claim_packets(id),
    settlement_number       VARCHAR(50) NOT NULL,
    settlement_type         VARCHAR(20) NOT NULL DEFAULT 'full',  -- full|partial
    settled_amount          NUMERIC(14,2) NOT NULL DEFAULT 0,
    claim_amount            NUMERIC(14,2) NOT NULL DEFAULT 0,
    outstanding_amount      NUMERIC(14,2) NOT NULL DEFAULT 0,
    payment_reference       VARCHAR(100),
    payment_mode            VARCHAR(30),
    payment_date            DATE,
    bank_reference          VARCHAR(100),
    remarks                 TEXT,
    created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by_user_id      UUID,
    updated_by_user_id      UUID,
    deleted_at              TIMESTAMPTZ,
    status                  VARCHAR(20) NOT NULL DEFAULT 'active',
    row_version             INT         NOT NULL DEFAULT 1,
    CONSTRAINT uq_ccms_settlement_number UNIQUE (tenant_id, settlement_number)
);

CREATE TABLE IF NOT EXISTS ccms_settlement_line_items (
    id                  UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id           UUID        NOT NULL,
    settlement_id       UUID        NOT NULL REFERENCES ccms_settlements(id),
    line_type           VARCHAR(50) NOT NULL,
    description         VARCHAR(200) NOT NULL,
    claimed_amount      NUMERIC(14,2) NOT NULL DEFAULT 0,
    settled_amount      NUMERIC(14,2) NOT NULL DEFAULT 0,
    disallowed_amount   NUMERIC(14,2) NOT NULL DEFAULT 0,
    disallowed_reason   TEXT,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by_user_id  UUID,
    updated_by_user_id  UUID,
    deleted_at          TIMESTAMPTZ,
    status              VARCHAR(20) NOT NULL DEFAULT 'active',
    row_version         INT         NOT NULL DEFAULT 1
);

CREATE INDEX IF NOT EXISTS idx_ccms_settle_case     ON ccms_settlements (coverage_case_id);
CREATE INDEX IF NOT EXISTS idx_ccms_settle_claim    ON ccms_settlements (claim_packet_id);
CREATE INDEX IF NOT EXISTS idx_ccms_settle_li_set   ON ccms_settlement_line_items (settlement_id);

ALTER TABLE ccms_settlements           ENABLE ROW LEVEL SECURITY;
ALTER TABLE ccms_settlement_line_items ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='ccms_settlements' AND policyname='tenant_isolation') THEN
        CREATE POLICY tenant_isolation ON ccms_settlements FOR ALL USING (tenant_id::text = current_setting('app.current_tenant_id', true));
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='ccms_settlement_line_items' AND policyname='tenant_isolation') THEN
        CREATE POLICY tenant_isolation ON ccms_settlement_line_items FOR ALL USING (tenant_id::text = current_setting('app.current_tenant_id', true));
    END IF;
END $$;

COMMIT;
