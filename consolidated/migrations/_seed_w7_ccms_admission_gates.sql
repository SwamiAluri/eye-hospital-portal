-- =============================================================================
-- _seed_w7_ccms_admission_gates.sql
-- Wave 7 G3: link UAT insurance journeys to CCMS states for live admit gates.
--   UAT-IP-091 → WAITING_APPROVAL (existing CCMS-2627-000106)
--   UAT-IP-096 → APPROVED (dedicated W7 smoke case)
-- E2E tenant only. Idempotent. Does not touch Meenakshi case CCMS-2627-000014.
-- =============================================================================

BEGIN;

UPDATE ccms_coverage_cases c
SET
    journey_id = j.id,
    updated_at = NOW()
FROM patient_journey j
WHERE j.uhid = 'UAT-IP-091'
  AND j.tenant_id = '155fe198-6ae5-4a01-9254-ead5b427247e'
  AND j.deleted_at IS NULL
  AND c.tenant_id = j.tenant_id
  AND c.case_number = 'CCMS-2627-000106'
  AND c.deleted_at IS NULL
  AND c.current_state = 'WAITING_APPROVAL'
  AND (c.journey_id IS NULL OR c.journey_id = j.id);

INSERT INTO ccms_coverage_cases (
    id,
    tenant_id,
    case_number,
    patient_id,
    patient_name,
    journey_id,
    branch_id,
    payer_type,
    payment_type,
    current_state,
    approved_amount,
    emergency_fc_applied,
    is_draft,
    status,
    row_version,
    created_at,
    updated_at
)
SELECT
    'b2000001-0000-4000-8000-0000000000c6'::uuid,
    j.tenant_id,
    'CCMS-W7-SMOKE-APPROVED',
    j.patient_id,
    'UAT-IP-096',
    j.id,
    j.branch_id,
    'tpa',
    'TPA',
    'APPROVED',
    COALESCE(j.package_amount, 100000),
    FALSE,
    FALSE,
    'active',
    1,
    NOW(),
    NOW()
FROM patient_journey j
WHERE j.uhid = 'UAT-IP-096'
  AND j.tenant_id = '155fe198-6ae5-4a01-9254-ead5b427247e'
  AND j.deleted_at IS NULL
ON CONFLICT (id) DO UPDATE
SET
    journey_id = EXCLUDED.journey_id,
    current_state = 'APPROVED',
    deleted_at = NULL,
    updated_at = NOW();

COMMIT;
