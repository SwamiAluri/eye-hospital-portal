-- =============================================================================
-- _seed_w7_ccms_partial_approval.sql
-- Wave 0 / G3: link UAT-IP-106 (Patient share partial) to PARTIAL_APPROVAL
-- with authorization amounts so ward Coverage projects payer vs patient share.
-- E2E tenant only. Idempotent. Does not touch Meenakshi.
-- =============================================================================

BEGIN;

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
    'b2000001-0000-4000-8000-0000000000ca'::uuid,
    j.tenant_id,
    'CCMS-W7-SMOKE-PARTIAL',
    j.patient_id,
    'UAT-IP-106',
    j.id,
    j.branch_id,
    'tpa',
    'TPA',
    'PARTIAL_APPROVAL',
    70000,
    FALSE,
    FALSE,
    'active',
    1,
    NOW(),
    NOW()
FROM patient_journey j
WHERE j.uhid = 'UAT-IP-106'
  AND j.tenant_id = '155fe198-6ae5-4a01-9254-ead5b427247e'
  AND j.deleted_at IS NULL
ON CONFLICT (id) DO UPDATE
SET
    journey_id = EXCLUDED.journey_id,
    current_state = 'PARTIAL_APPROVAL',
    approved_amount = 70000,
    deleted_at = NULL,
    updated_at = NOW();

INSERT INTO ccms_coverage_authorizations (
    id,
    tenant_id,
    coverage_case_id,
    authorization_type,
    pre_auth_number,
    requested_amount,
    approved_amount,
    process_status,
    created_at,
    updated_at,
    status,
    row_version
)
SELECT
    'b2000001-0000-4000-8000-0000000000cb'::uuid,
    c.tenant_id,
    c.id,
    'preauth',
    'PA/W7/SMOKE-PARTIAL',
    100000,
    70000,
    'partial',
    NOW(),
    NOW(),
    'active',
    1
FROM ccms_coverage_cases c
WHERE c.id = 'b2000001-0000-4000-8000-0000000000ca'::uuid
  AND c.deleted_at IS NULL
ON CONFLICT (id) DO UPDATE
SET
    requested_amount = 100000,
    approved_amount = 70000,
    process_status = 'partial',
    deleted_at = NULL,
    updated_at = NOW();

COMMIT;
