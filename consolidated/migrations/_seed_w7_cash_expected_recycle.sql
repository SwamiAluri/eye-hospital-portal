-- =============================================================================
-- _seed_w7_cash_expected_recycle.sql
-- Wave 7 G3: restore one Cash/Expected UAT journey after smoke LAMA exhausts 001–005.
-- E2E tenant only. Does not touch beds Occupied by other journeys.
--
-- Must clear discharge/lock residue. Leaving is_locked/is_discharged true after
-- flipping clinical_state to Expected lets admit succeed but blocks bed transfer
-- and leaves Auth occupancy on the admit bed through LAMA.
-- =============================================================================

BEGIN;

UPDATE patient_journey
SET
    clinical_state = 'Expected',
    assigned_bed_id = NULL,
    ward_id = NULL,
    bed_number = NULL,
    room_number = NULL,
    admitted_at = NULL,
    discharged_at = NULL,
    ward_checkout_at = NULL,
    is_discharged = false,
    is_locked = false,
    discharge_type = NULL,
    discharge_type_reason = NULL,
    clinical_state_before_discharge = NULL,
    updated_at = NOW()
WHERE uhid = 'UAT-IP-001'
  AND tenant_id = '155fe198-6ae5-4a01-9254-ead5b427247e'
  AND deleted_at IS NULL
  AND clinical_state = 'Discharged';

COMMIT;
