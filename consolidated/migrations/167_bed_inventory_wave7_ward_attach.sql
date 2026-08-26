-- =============================================================================
-- 167_bed_inventory_wave7_ward_attach.sql
-- DB-004 leftover — Wave 7 smoke beds used free-text ward_name 'Wave7',
-- so 165 name-match left ward_id NULL and they never appeared on Day Care Ward.
--
-- Attach those alias rows to the branch DayCare ward (else the only active ward).
-- Canonicalize ward_name to the ward master. Occupancy is unchanged.
-- Idempotent: re-running is a no-op.
-- =============================================================================

BEGIN;

UPDATE bed_inventory b
SET
    ward_id = w.id,
    ward_name = w.ward_name,
    updated_at = NOW()
FROM ward w
WHERE b.deleted_at IS NULL
  AND b.ward_id IS NULL
  AND lower(btrim(COALESCE(b.ward_name, ''))) IN ('wave7', 'wave 7')
  AND w.deleted_at IS NULL
  AND w.is_active
  AND w.tenant_id = b.tenant_id
  AND w.branch_id = b.branch_id
  AND w.ward_type = 'DayCare';

UPDATE bed_inventory b
SET
    ward_id = w.id,
    ward_name = w.ward_name,
    updated_at = NOW()
FROM ward w
WHERE b.deleted_at IS NULL
  AND b.ward_id IS NULL
  AND lower(btrim(COALESCE(b.ward_name, ''))) IN ('wave7', 'wave 7')
  AND w.deleted_at IS NULL
  AND w.is_active
  AND w.tenant_id = b.tenant_id
  AND w.branch_id = b.branch_id
  AND (
      SELECT COUNT(*)
      FROM ward x
      WHERE x.deleted_at IS NULL
        AND x.is_active
        AND x.tenant_id = b.tenant_id
        AND x.branch_id = b.branch_id
  ) = 1;

COMMENT ON COLUMN bed_inventory.ward_id IS
    'DB-004. FK to ward.id. Prefer this over ward_name. Wave7 alias rows are attached by 167.';

COMMIT;
