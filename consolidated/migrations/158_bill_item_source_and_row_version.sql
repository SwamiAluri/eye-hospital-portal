-- =============================================================================
-- 158_bill_item_source_and_row_version.sql
-- TASK BILL-030 — Charge item traceability, idempotency, bill concurrency token.
--
-- Additive only. Existing item rows backfill source_type = 'Manual'.
-- Re-running is a no-op.
-- =============================================================================

BEGIN;

ALTER TABLE opd_bill_items
    ADD COLUMN IF NOT EXISTS source_type varchar(30) NOT NULL DEFAULT 'Manual',
    ADD COLUMN IF NOT EXISTS source_ref_id uuid,
    ADD COLUMN IF NOT EXISTS idempotency_key varchar(200);

-- EF maps OpdBillItem.ServiceVariantId here. Azure still has the older
-- service_catalog_id column; add the mapped name so sourced/named lines can
-- omit a catalog variant (BILL-031 PackageDiscount).
ALTER TABLE opd_bill_items
    ADD COLUMN IF NOT EXISTS service_variant_id uuid;

ALTER TABLE opd_bill_items ALTER COLUMN service_variant_id DROP NOT NULL;

COMMENT ON COLUMN opd_bill_items.source_type IS
    'BILL-030: Package | PackageDiscount | Implant | Consumable | Room | Procedure | Manual.';
COMMENT ON COLUMN opd_bill_items.source_ref_id IS
    'BILL-030: originating row (package component, implant usage, consumable, etc.).';
COMMENT ON COLUMN opd_bill_items.idempotency_key IS
    'BILL-030: duplicate automated charges are a no-op when this key repeats per tenant.';

CREATE UNIQUE INDEX IF NOT EXISTS ux_opd_bill_items_idempotency
    ON opd_bill_items (tenant_id, idempotency_key)
    WHERE idempotency_key IS NOT NULL AND deleted_at IS NULL;

ALTER TABLE opd_bills
    ADD COLUMN IF NOT EXISTS row_version integer NOT NULL DEFAULT 1;

COMMENT ON COLUMN opd_bills.row_version IS
    'BILL-030: optimistic concurrency token. Mutations increment; mismatch is 409.';

COMMIT;
