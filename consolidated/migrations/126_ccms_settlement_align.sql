-- ============================================================
-- Migration 126: CCMS Settlement alignment
--   1. Drop the inline ccms_settlement_sequences table
--      created by the original SettlementReconciliationService
--      and replace it with a proper per-tenant sequence using
--      a lightweight SEQUENCE-per-tenant approach via a
--      dedicated tracking table with advisory locking.
--   2. Add missing columns to ccms_settlements that were
--      added to the domain model (settlement_number,
--      claim_amount, outstanding_amount, payment_date,
--      bank_reference) in case they are absent on existing
--      databases that only ran migration 116.
--   3. Add settled_at and reconciliation columns if missing.
-- ============================================================

BEGIN;

-- ── 1. Proper sequence tracking table ─────────────────────────────────────

CREATE TABLE IF NOT EXISTS ccms_settlement_sequences (
    tenant_id       UUID   NOT NULL PRIMARY KEY,
    last_sequence   BIGINT NOT NULL DEFAULT 0
);

COMMENT ON TABLE ccms_settlement_sequences IS
    'Monotonic per-tenant counters used to generate settlement numbers.';

-- ── 2. Ensure ccms_settlements has all required columns ────────────────────
-- (These were defined in migration 116 but may be missing on older schemas)

ALTER TABLE ccms_settlements
    ADD COLUMN IF NOT EXISTS settlement_number  VARCHAR(50),
    ADD COLUMN IF NOT EXISTS claim_amount       NUMERIC(14,2) NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS outstanding_amount NUMERIC(14,2) NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS payment_date       DATE,
    ADD COLUMN IF NOT EXISTS bank_reference     VARCHAR(100),
    ADD COLUMN IF NOT EXISTS settled_at         TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS reconciliation_status  VARCHAR(30) NOT NULL DEFAULT 'pending',
    ADD COLUMN IF NOT EXISTS reconciliation_notes   TEXT,
    ADD COLUMN IF NOT EXISTS reconciliation_at      TIMESTAMPTZ;

-- Back-fill settlement_number for any rows created before this migration.
UPDATE ccms_settlements
SET    settlement_number = 'LEGACY-' || id::text
WHERE  settlement_number IS NULL;

ALTER TABLE ccms_settlements
    ALTER COLUMN settlement_number SET NOT NULL;

-- Unique constraint on (tenant_id, settlement_number) if not already present.
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE  conname = 'uq_ccms_settlement_number'
    ) THEN
        ALTER TABLE ccms_settlements
            ADD CONSTRAINT uq_ccms_settlement_number
            UNIQUE (tenant_id, settlement_number);
    END IF;
END$$;

-- ── 3. Index for reconciliation queries ───────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_ccms_settlements_reconciliation
    ON ccms_settlements (tenant_id, reconciliation_status)
    WHERE deleted_at IS NULL;

COMMIT;
