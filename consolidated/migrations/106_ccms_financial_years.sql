-- ============================================================
-- Migration 106: CCMS Financial Years
-- Coverage & Claims Management System (CCMS)
-- ============================================================
-- Standard columns: id, tenant_id, created_at, updated_at,
-- created_by_user_id, updated_by_user_id, deleted_at, status, row_version
-- ============================================================

BEGIN;

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ── Financial Years ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS ccms_financial_years (
    id                  UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id           UUID        NOT NULL,
    year_code           VARCHAR(10) NOT NULL,           -- e.g. "2526" (Apr 2025 – Mar 2026)
    year_label          VARCHAR(50) NOT NULL,           -- e.g. "FY 2025-26"
    start_date          DATE        NOT NULL,
    end_date            DATE        NOT NULL,
    is_current          BOOLEAN     NOT NULL DEFAULT FALSE,
    -- Standard audit columns
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by_user_id  UUID,
    updated_by_user_id  UUID,
    deleted_at          TIMESTAMPTZ,
    status              VARCHAR(20) NOT NULL DEFAULT 'active',
    row_version         INT         NOT NULL DEFAULT 1,
    CONSTRAINT uq_ccms_fy_tenant_code UNIQUE (tenant_id, year_code)
);

-- Ensure only one current financial year per tenant
CREATE UNIQUE INDEX IF NOT EXISTS uidx_ccms_fy_current
    ON ccms_financial_years (tenant_id)
    WHERE is_current = TRUE AND deleted_at IS NULL;

-- Indexes
CREATE INDEX IF NOT EXISTS idx_ccms_fy_tenant_id
    ON ccms_financial_years (tenant_id);
CREATE INDEX IF NOT EXISTS idx_ccms_fy_dates
    ON ccms_financial_years (tenant_id, start_date, end_date);

-- Row-Level Security
ALTER TABLE ccms_financial_years ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE tablename = 'ccms_financial_years' AND policyname = 'tenant_isolation'
    ) THEN
        CREATE POLICY tenant_isolation ON ccms_financial_years
            FOR ALL USING (
                tenant_id::text = current_setting('app.current_tenant_id', true)
            );
    END IF;
END $$;

-- Seed current financial year (2025-26) per tenant that already exists
-- Each tenant gets a row when they first use CCMS; seeded here for existing tenants.
INSERT INTO ccms_financial_years (
    id, tenant_id, year_code, year_label, start_date, end_date, is_current,
    created_at, updated_at, status
)
SELECT
    uuid_generate_v4(),
    id,                   -- tenant.id
    '2526',
    'FY 2025-26',
    '2025-04-01',
    '2026-03-31',
    TRUE,
    NOW(), NOW(), 'active'
FROM tenant
WHERE deleted_at IS NULL
  AND NOT EXISTS (
      SELECT 1 FROM ccms_financial_years fy
      WHERE fy.tenant_id = tenant.id AND fy.year_code = '2526'
  );

COMMIT;
