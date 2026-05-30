-- ============================================================
-- Migration 124: CCMS Authorization Clinical & Financial extensions
--   Adds clinical details, financial breakdown, and process_status
--   tracking to ccms_coverage_authorizations and
--   ccms_coverage_cases.
-- ============================================================

BEGIN;

-- ── ccms_coverage_authorizations: clinical details ────────────────────────

ALTER TABLE ccms_coverage_authorizations
    ADD COLUMN IF NOT EXISTS clinical_summary         TEXT,
    ADD COLUMN IF NOT EXISTS treating_doctor_name     VARCHAR(200),
    ADD COLUMN IF NOT EXISTS treating_doctor_reg      VARCHAR(100),
    ADD COLUMN IF NOT EXISTS admission_date           DATE,
    ADD COLUMN IF NOT EXISTS expected_discharge_date  DATE,
    ADD COLUMN IF NOT EXISTS actual_discharge_date    DATE,
    ADD COLUMN IF NOT EXISTS length_of_stay_days      INT,
    ADD COLUMN IF NOT EXISTS room_type_requested      VARCHAR(50),   -- general|semi-private|private|icu
    ADD COLUMN IF NOT EXISTS procedures_json          JSONB,         -- [{code, name, icd10, estimatedCost}]
    ADD COLUMN IF NOT EXISTS diagnosis_json           JSONB,         -- [{icd10, description, isPrimary}]
    ADD COLUMN IF NOT EXISTS estimated_total_cost     NUMERIC(14,2) NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS copay_amount             NUMERIC(14,2) NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS deductible_amount        NUMERIC(14,2) NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS service_tax_amount       NUMERIC(14,2) NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS net_payable_by_insurer   NUMERIC(14,2) NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS net_payable_by_patient   NUMERIC(14,2) NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS tpa_query_json           JSONB,         -- clarification Q&A thread (denormalized fast path)
    ADD COLUMN IF NOT EXISTS process_status           VARCHAR(50)  NOT NULL DEFAULT 'pending',
    ADD COLUMN IF NOT EXISTS process_status_updated_at TIMESTAMPTZ;

COMMENT ON COLUMN ccms_coverage_authorizations.process_status IS
    'Fine-grained sub-status within a workflow state, e.g. docs_awaited, query_raised, approved_with_conditions.';

-- ── ccms_coverage_cases: process_status tracking ──────────────────────────

ALTER TABLE ccms_coverage_cases
    ADD COLUMN IF NOT EXISTS process_status           VARCHAR(50),
    ADD COLUMN IF NOT EXISTS process_status_updated_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS service_tax_applicable   BOOLEAN NOT NULL DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS service_tax_percent      NUMERIC(5,2) NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS service_tax_amount       NUMERIC(14,2) NOT NULL DEFAULT 0;

-- ── Indexes ───────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_ccms_auths_process_status
    ON ccms_coverage_authorizations (tenant_id, process_status)
    WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_ccms_cases_process_status
    ON ccms_coverage_cases (tenant_id, process_status)
    WHERE deleted_at IS NULL;

COMMIT;
