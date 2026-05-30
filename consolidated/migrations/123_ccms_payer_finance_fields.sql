-- ============================================================
-- Migration 123: CCMS Payer Finance Fields
-- Extends ccms_insurance_providers with:
--   • payer_category (insurance | other_debtor)
--   • debtor_subtype (corporate | government | individual | other)
--   • credit_limit, export_code, hospital_identifier
--   • service_tax_applicable, default_service_tax_percent, tds_mandatory
--   • valid_from, valid_to
--   • format_code (correspondence format)
-- Also adds a payer_category index and a check constraint.
-- ============================================================

BEGIN;

-- payer_category: distinguishes insurers from other debtors
ALTER TABLE ccms_insurance_providers
    ADD COLUMN IF NOT EXISTS payer_category          VARCHAR(20)   NOT NULL DEFAULT 'insurance',
    ADD COLUMN IF NOT EXISTS debtor_subtype           VARCHAR(30),
    ADD COLUMN IF NOT EXISTS credit_limit             NUMERIC(14,2),
    ADD COLUMN IF NOT EXISTS export_code              VARCHAR(50),
    ADD COLUMN IF NOT EXISTS hospital_identifier      VARCHAR(100),
    ADD COLUMN IF NOT EXISTS service_tax_applicable   BOOLEAN       NOT NULL DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS default_service_tax_percent NUMERIC(5,2) NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS tds_mandatory            BOOLEAN       NOT NULL DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS valid_from               DATE,
    ADD COLUMN IF NOT EXISTS valid_to                 DATE,
    ADD COLUMN IF NOT EXISTS format_code              VARCHAR(50);

DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'chk_payer_category'
          AND conrelid = 'ccms_insurance_providers'::regclass
    ) THEN
        ALTER TABLE ccms_insurance_providers
            ADD CONSTRAINT chk_payer_category
            CHECK (payer_category IN ('insurance', 'other_debtor'));
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_ccms_payer_category
    ON ccms_insurance_providers (tenant_id, payer_category)
    WHERE deleted_at IS NULL;

-- Backfill existing rows as insurance (safe default)
UPDATE ccms_insurance_providers
SET payer_category = 'insurance'
WHERE payer_category IS NULL OR payer_category = '';

COMMIT;
