-- =============================================================================
-- _seed_w7_smoke_available_beds.sql
-- Wave 7 leftover after 167: Day Care had no Available bed
-- (W7-SMOKE-1 Occupied by leaked UAT occupancy, W7-SMOKE-2 Cleaning).
--
-- Does NOT release Occupied rows that still have a patient_id.
-- Applies `cleaned` to W7-SMOKE-2 when it is empty Cleaning.
-- Inserts Available Recliner + DayCareChair on the E2E tenant DayCare ward.
-- Idempotent. No-op when that tenant/branch/ward is absent.
-- =============================================================================

BEGIN;

-- FSM: Cleaning + no occupant + no live journey → Available (`cleaned`).
UPDATE bed_inventory b
SET
    bed_status = 'Available',
    is_occupied = false,
    patient_id = NULL,
    assigned_at = NULL,
    expected_discharge_at = NULL,
    updated_at = NOW()
WHERE b.bed_number = 'W7-SMOKE-2'
  AND b.deleted_at IS NULL
  AND b.bed_status = 'Cleaning'
  AND b.patient_id IS NULL
  AND NOT EXISTS (
      SELECT 1
      FROM patient_journey j
      WHERE j.assigned_bed_id = b.id
        AND j.deleted_at IS NULL
  );

INSERT INTO bed_inventory (
    id,
    tenant_id,
    branch_id,
    bed_number,
    bed_type,
    bed_status,
    ward_name,
    ward_id,
    is_occupied,
    is_isolation_bed,
    status,
    created_at,
    updated_at
)
SELECT
    v.id,
    w.tenant_id,
    w.branch_id,
    v.bed_number,
    v.bed_type,
    'Available',
    w.ward_name,
    w.id,
    false,
    false,
    'active',
    NOW(),
    NOW()
FROM ward w
CROSS JOIN (
    VALUES
        ('a1000001-0000-4000-8000-0000000000b3'::uuid, 'W7-SMOKE-3', 'Recliner'),
        ('a1000001-0000-4000-8000-0000000000b4'::uuid, 'W7-SMOKE-4', 'DayCareChair')
) AS v(id, bed_number, bed_type)
WHERE w.deleted_at IS NULL
  AND w.is_active
  AND w.ward_type = 'DayCare'
  AND w.tenant_id = '155fe198-6ae5-4a01-9254-ead5b427247e'
  AND w.branch_id = '74c014cf-9570-4824-bdf9-b369ea11a8f4'
ON CONFLICT (id) DO NOTHING;

-- Leaked occupancy on smoke recliner/chair (Auth occupy succeeded, IP admit
-- rolled back so no journey holds assigned_bed_id). Do not touch W7-SMOKE-1.
UPDATE bed_inventory b
SET
    bed_status = 'Available',
    is_occupied = false,
    patient_id = NULL,
    assigned_at = NULL,
    expected_discharge_at = NULL,
    updated_at = NOW()
WHERE b.bed_number IN ('W7-SMOKE-3', 'W7-SMOKE-4')
  AND b.deleted_at IS NULL
  AND b.patient_id IS NOT NULL
  AND NOT EXISTS (
      SELECT 1
      FROM patient_journey j
      WHERE j.assigned_bed_id = b.id
        AND j.deleted_at IS NULL
  );

-- Cleaning + empty + no journey → Available (`cleaned`) for recliner/chair smoke beds.
UPDATE bed_inventory b
SET
    bed_status = 'Available',
    is_occupied = false,
    patient_id = NULL,
    assigned_at = NULL,
    expected_discharge_at = NULL,
    updated_at = NOW()
WHERE b.bed_number IN ('W7-SMOKE-3', 'W7-SMOKE-4')
  AND b.deleted_at IS NULL
  AND b.patient_id IS NULL
  AND NOT EXISTS (
      SELECT 1
      FROM patient_journey j
      WHERE j.assigned_bed_id = b.id
        AND j.deleted_at IS NULL
  );

COMMIT;
