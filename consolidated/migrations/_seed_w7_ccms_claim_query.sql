-- =============================================================================
-- _seed_w7_ccms_claim_query.sql
-- Wave 7 G3: dedicated UAT claim packet for live query / query-response smoke.
-- Case number CCMS-W7-SMOKE-CLAIM (E2E tenant only). Idempotent reset.
-- Does not touch Meenakshi or other live claims.
-- =============================================================================

BEGIN;

INSERT INTO ccms_coverage_cases (
    id,
    tenant_id,
    case_number,
    patient_id,
    patient_name,
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
    'b2000001-0000-4000-8000-0000000000c7'::uuid,
    j.tenant_id,
    'CCMS-W7-SMOKE-CLAIM',
    j.patient_id,
    'UAT-W7-CLAIM',
    j.branch_id,
    'tpa',
    'TPA',
    'CLAIM_SUBMITTED',
    100000,
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
LIMIT 1
ON CONFLICT (id) DO UPDATE
SET
    current_state = 'CLAIM_SUBMITTED',
    deleted_at = NULL,
    patient_name = 'UAT-W7-CLAIM',
    case_number = 'CCMS-W7-SMOKE-CLAIM',
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
    'b2000001-0000-4000-8000-0000000000c9'::uuid,
    c.tenant_id,
    c.id,
    'preauth',
    'PA/W7/SMOKE-CLAIM',
    100000,
    100000,
    'approved',
    NOW(),
    NOW(),
    'active',
    1
FROM ccms_coverage_cases c
WHERE c.id = 'b2000001-0000-4000-8000-0000000000c7'
  AND c.deleted_at IS NULL
ON CONFLICT (id) DO UPDATE
SET
    deleted_at = NULL,
    coverage_case_id = EXCLUDED.coverage_case_id,
    process_status = 'approved',
    updated_at = NOW();

INSERT INTO ccms_claim_packets (
    id,
    tenant_id,
    coverage_case_id,
    claim_number,
    claimed_amount,
    claim_type,
    submission_mode,
    submitted_at,
    query_status,
    created_at,
    updated_at,
    status,
    row_version
)
SELECT
    'b2000001-0000-4000-8000-0000000000c8'::uuid,
    c.tenant_id,
    c.id,
    'CLM-W7-SMOKE-CLAIM',
    100000,
    'cashless',
    'portal',
    NOW(),
    'none',
    NOW(),
    NOW(),
    'active',
    1
FROM ccms_coverage_cases c
WHERE c.id = 'b2000001-0000-4000-8000-0000000000c7'
  AND c.deleted_at IS NULL
ON CONFLICT (id) DO UPDATE
SET
    deleted_at = NULL,
    coverage_case_id = EXCLUDED.coverage_case_id,
    claim_number = 'CLM-W7-SMOKE-CLAIM',
    submitted_at = COALESCE(ccms_claim_packets.submitted_at, NOW()),
    query_status = 'none',
    acknowledged_at = NULL,
    updated_at = NOW();

-- Soft-delete prior W7 smoke clarifications so re-runs start clean.
UPDATE ccms_clarification_items ci
SET
    deleted_at = NOW(),
    updated_at = NOW()
WHERE ci.authorization_id = 'b2000001-0000-4000-8000-0000000000c9'
  AND ci.deleted_at IS NULL
  AND ci.clarification_query LIKE '%[CLAIM CLM-W7-SMOKE-CLAIM]%';

UPDATE ccms_coverage_cases
SET
    current_state = 'CLAIM_SUBMITTED',
    process_status = NULL,
    updated_at = NOW()
WHERE id = 'b2000001-0000-4000-8000-0000000000c7'
  AND deleted_at IS NULL;

COMMIT;
