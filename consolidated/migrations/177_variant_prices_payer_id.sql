-- ============================================================================
-- Migration 177: Insurer / corporate tariffs on variant_prices (FR-1.3)
-- Purpose:
--   Overlay catalog prices by ccms_insurance_providers.id. NULL payer_id keeps
--   the existing global / branch tariff. CCMS still owns copay / cap / claim
--   share — this is not a second price book.
-- Dependencies: variant_prices, ccms_insurance_providers (109).
-- Date: 2026-08
-- ============================================================================

BEGIN;

ALTER TABLE variant_prices
    ADD COLUMN IF NOT EXISTS payer_id UUID;

DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'ccms_insurance_providers')
       AND NOT EXISTS (
           SELECT 1 FROM pg_constraint
           WHERE conname = 'fk_variant_prices_payer'
             AND conrelid = 'variant_prices'::regclass
       ) THEN
        ALTER TABLE variant_prices
            ADD CONSTRAINT fk_variant_prices_payer
            FOREIGN KEY (payer_id) REFERENCES ccms_insurance_providers(id);
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_variant_prices_payer
    ON variant_prices (variant_id, payer_id, branch_id, effective_to)
    WHERE deleted_at IS NULL;

COMMIT;
