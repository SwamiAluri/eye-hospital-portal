-- ============================================================================
-- Migration 161: INV-050 link OT consumable issue to the IP journey and charge
-- Billing projections on inv_surgery_consumables. Price still comes from
-- variant_prices via charge-items; unit_rate/amount remain purchase-cost fields.
-- ============================================================================

BEGIN;

ALTER TABLE inv_surgery_consumables
    ADD COLUMN IF NOT EXISTS journey_id uuid,
    ADD COLUMN IF NOT EXISTS charge_status varchar(24) NOT NULL DEFAULT 'Pending',
    ADD COLUMN IF NOT EXISTS charge_item_id uuid;

CREATE INDEX IF NOT EXISTS ix_inv_surgery_consumables_journey
    ON inv_surgery_consumables (tenant_id, journey_id, issued_at DESC)
    WHERE journey_id IS NOT NULL AND deleted_at IS NULL;

COMMENT ON COLUMN inv_surgery_consumables.journey_id IS
    'INV-050. Patient journey for the IP episode. Null issues are exception-queued, not charged.';
COMMENT ON COLUMN inv_surgery_consumables.charge_status IS
    'INV-050 billing projection: Pending | Posted | Suppressed | Exception | UnmappedJourney.';
COMMENT ON COLUMN inv_surgery_consumables.charge_item_id IS
    'INV-050. opd_bill_items.id when Posted. Null when suppressed or exception-queued.';

COMMIT;
