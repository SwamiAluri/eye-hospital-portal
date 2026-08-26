-- ============================================================================
-- Migration 178: Consignment stock (FR-5.4)
-- Purpose:
--   Mark vendors and stock batches as consignment so OT issue/return deducts
--   consignment lots first (still FEFO within that group). Inventory-owned —
--   IP implant path already calls internal/implants/apply.
-- Dependencies: inv_vendors, inv_stock_batches.
-- Date: 2026-08
-- ============================================================================

BEGIN;

ALTER TABLE inv_vendors
    ADD COLUMN IF NOT EXISTS is_consignment_vendor BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE inv_stock_batches
    ADD COLUMN IF NOT EXISTS is_consignment BOOLEAN NOT NULL DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS vendor_id UUID;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'fk_inv_stock_batches_vendor'
          AND conrelid = 'inv_stock_batches'::regclass
    ) THEN
        ALTER TABLE inv_stock_batches
            ADD CONSTRAINT fk_inv_stock_batches_vendor
            FOREIGN KEY (vendor_id) REFERENCES inv_vendors(id);
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_inv_stock_batches_consignment
    ON inv_stock_batches (tenant_id, item_id, store_id, is_consignment)
    WHERE deleted_at IS NULL AND is_active = TRUE AND quantity_available > 0;

COMMIT;
