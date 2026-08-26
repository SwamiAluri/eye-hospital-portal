-- Verify 165_bed_inventory_ward_id_and_daycare_types.sql (DB-004). Read-only.

\pset pager off

\echo '=== 165 ward_id column ==='
SELECT
  CASE WHEN COUNT(*) = 1 THEN 'PASS' ELSE 'FAIL' END AS ward_id_col
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'bed_inventory'
  AND column_name = 'ward_id';

\echo '=== 165 ward_id FK ==='
SELECT
  CASE WHEN COUNT(*) = 1 THEN 'PASS' ELSE 'FAIL' END AS ward_id_fk
FROM pg_constraint
WHERE conname = 'bed_inventory_ward_id_fkey';

\echo '=== 165 bed_type allows Recliner and DayCareChair ==='
SELECT
  CASE
    WHEN COUNT(*) = 1
     AND bool_and(pg_get_constraintdef(oid) LIKE '%Recliner%')
     AND bool_and(pg_get_constraintdef(oid) LIKE '%DayCareChair%')
    THEN 'PASS' ELSE 'FAIL'
  END AS bed_type_check
FROM pg_constraint
WHERE conname = 'bed_inventory_bed_type_check';

\echo '=== 165 matchable names are backfilled ==='
SELECT
  CASE WHEN COUNT(*) = 0 THEN 'PASS' ELSE 'FAIL' END AS backfill_complete
FROM bed_inventory b
JOIN ward w
  ON w.tenant_id = b.tenant_id
 AND w.branch_id = b.branch_id
 AND w.deleted_at IS NULL
 AND lower(btrim(w.ward_name)) = lower(btrim(b.ward_name))
WHERE b.deleted_at IS NULL
  AND b.ward_id IS NULL
  AND b.ward_name IS NOT NULL
  AND btrim(b.ward_name) <> '';

\echo '=== 165 ward_name column kept ==='
SELECT
  CASE WHEN COUNT(*) = 1 THEN 'PASS' ELSE 'FAIL' END AS ward_name_kept
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'bed_inventory'
  AND column_name = 'ward_name';

\echo '=== 167 Wave7 alias rows are attached ==='
SELECT
  CASE WHEN COUNT(*) = 0 THEN 'PASS' ELSE 'FAIL' END AS wave7_unmatched
FROM bed_inventory b
WHERE b.deleted_at IS NULL
  AND b.ward_id IS NULL
  AND lower(btrim(COALESCE(b.ward_name, ''))) IN ('wave7', 'wave 7');

\echo '=== 167 W7-SMOKE beds sit on branch DayCare ==='
SELECT
  CASE
    WHEN COUNT(*) = 0 THEN 'PASS'
    WHEN COUNT(*) FILTER (
      WHERE b.ward_id IS NOT NULL
        AND w.ward_type = 'DayCare'
        AND w.branch_id = b.branch_id
        AND w.tenant_id = b.tenant_id
    ) = COUNT(*) THEN 'PASS'
    ELSE 'FAIL'
  END AS w7_smoke_daycare
FROM bed_inventory b
LEFT JOIN ward w ON w.id = b.ward_id
WHERE b.deleted_at IS NULL
  AND b.bed_number LIKE 'W7-SMOKE-%';

\echo '=== W7-SMOKE-2 is not stuck empty Cleaning ==='
SELECT
  CASE
    WHEN COUNT(*) = 0 THEN 'PASS'
    ELSE 'FAIL'
  END AS w7_smoke2_cleaned
FROM bed_inventory b
WHERE b.deleted_at IS NULL
  AND b.bed_number = 'W7-SMOKE-2'
  AND b.bed_status = 'Cleaning'
  AND b.patient_id IS NULL
  AND NOT EXISTS (
    SELECT 1 FROM patient_journey j
    WHERE j.assigned_bed_id = b.id AND j.deleted_at IS NULL
  );

\echo '=== W7-SMOKE Available recliner and day-care chair ==='
SELECT
  CASE
    WHEN COUNT(*) FILTER (WHERE b.bed_number = 'W7-SMOKE-3' AND b.bed_type = 'Recliner' AND b.bed_status = 'Available' AND w.ward_type = 'DayCare') = 1
     AND COUNT(*) FILTER (WHERE b.bed_number = 'W7-SMOKE-4' AND b.bed_type = 'DayCareChair' AND b.bed_status = 'Available' AND w.ward_type = 'DayCare') = 1
    THEN 'PASS'
    WHEN COUNT(*) FILTER (WHERE b.bed_number IN ('W7-SMOKE-3', 'W7-SMOKE-4')) = 0
    THEN 'PASS'
    ELSE 'FAIL'
  END AS w7_smoke_available
FROM bed_inventory b
LEFT JOIN ward w ON w.id = b.ward_id
WHERE b.deleted_at IS NULL
  AND b.bed_number IN ('W7-SMOKE-3', 'W7-SMOKE-4');
