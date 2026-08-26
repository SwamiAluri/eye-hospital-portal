-- =============================================================================
-- 165_bed_inventory_ward_id_and_daycare_types.sql
-- TASK DB-004 — Bed model for day-care.
--
-- `ward_id` + FK were added in 80. This migration:
--   1. Makes that additive schema idempotent for hosts that missed 80.
--   2. Backfills ward_id by matching tenant + branch + ward_name (keep ward_name).
--   3. Extends bed_type CHECK with Recliner and DayCareChair.
--
-- BedLifecyclePolicy is unchanged — these are types, not occupancy states.
-- Unmatched names (e.g. free-text "Wave7") stay NULL and fall back to ward_name.
-- Idempotent: re-running is a no-op.
-- =============================================================================

BEGIN;

ALTER TABLE bed_inventory ADD COLUMN IF NOT EXISTS ward_id UUID;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'bed_inventory_ward_id_fkey'
    ) THEN
        ALTER TABLE bed_inventory
            ADD CONSTRAINT bed_inventory_ward_id_fkey
            FOREIGN KEY (ward_id) REFERENCES ward(id);
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_bed_inventory_ward
    ON bed_inventory (ward_id)
    WHERE deleted_at IS NULL;

-- Prefer an exact tenant+branch+name match. Do not overwrite a set FK.
UPDATE bed_inventory b
SET ward_id = w.id
FROM ward w
WHERE b.ward_id IS NULL
  AND b.deleted_at IS NULL
  AND w.deleted_at IS NULL
  AND b.tenant_id = w.tenant_id
  AND b.branch_id = w.branch_id
  AND b.ward_name IS NOT NULL
  AND btrim(b.ward_name) <> ''
  AND lower(btrim(b.ward_name)) = lower(btrim(w.ward_name));

ALTER TABLE bed_inventory DROP CONSTRAINT IF EXISTS bed_inventory_bed_type_check;
ALTER TABLE bed_inventory ADD CONSTRAINT bed_inventory_bed_type_check
    CHECK (bed_type IN (
        'General',
        'ICU',
        'Emergency',
        'Isolation',
        'Pediatric',
        'Maternity',
        'Recliner',
        'DayCareChair'
    ));

COMMENT ON COLUMN bed_inventory.ward_id IS
    'DB-004. FK to ward.id. Prefer this over ward_name; ward_name remains for unmatched legacy rows.';
COMMENT ON COLUMN bed_inventory.bed_type IS
    'General, ICU, Emergency, Isolation, Pediatric, Maternity, Recliner, DayCareChair. Occupancy FSM is unchanged.';

COMMIT;
