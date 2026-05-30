-- ============================================================
-- Migration 130: CCMS Realistic Seed Data
-- Populates all CCMS sub-modules with 15 cases spread across
-- every workflow state so every page/queue shows live data.
--
-- Tables touched (inserts only, all idempotent):
--   ccms_insurance_providers  (4 insurers)
--   ccms_tpa_providers        (2 TPAs)
--   ccms_workflow_instances   (15 rows)
--   ccms_coverage_cases       (15 rows)
--   ccms_visit_insurance_policies (15 rows)
--   ccms_coverage_authorizations  (12 rows – states ≥ PREAUTH_GENERATED)
--   ccms_claim_packets            (4 rows – states ≥ CLAIM_SUBMITTED)
--   ccms_settlements              (2 rows – settled cases)
--   ccms_settlement_line_items    (4 rows)
-- ============================================================

BEGIN;

DO $$
DECLARE
  v_tenant_id   UUID;
  v_fy_id       UUID;
  v_fy_code     VARCHAR(10);
  v_wf_def_id   UUID;

  -- Workflow state IDs
  s_elig_pending      UUID;
  s_elig_verified     UUID;
  s_policy_captured   UUID;
  s_auth_required     UUID;
  s_preauth_generated UUID;
  s_preauth_sent      UUID;
  s_waiting_approval  UUID;
  s_clarification_req UUID;
  s_approved          UUID;
  s_partial_approval  UUID;
  s_claim_submitted   UUID;
  s_claim_in_process  UUID;
  s_full_settlement   UUID;
  s_partial_settlement UUID;

  -- Fixed insurance provider UUIDs (idempotent re-runs)
  ip_star     UUID := 'aaaaaaaa-0001-4000-8000-000000000001';
  ip_hdfc     UUID := 'aaaaaaaa-0002-4000-8000-000000000001';
  ip_newindia UUID := 'aaaaaaaa-0003-4000-8000-000000000001';
  ip_united   UUID := 'aaaaaaaa-0004-4000-8000-000000000001';

  -- Fixed TPA UUIDs
  tpa_mediassist UUID := 'bbbbbbbb-0001-4000-8000-000000000001';
  tpa_fhpl       UUID := 'bbbbbbbb-0002-4000-8000-000000000001';

  -- Fixed workflow instance UUIDs (one per case)
  wf01 UUID := 'cccccc01-0000-4000-8000-000000000000';
  wf02 UUID := 'cccccc02-0000-4000-8000-000000000000';
  wf03 UUID := 'cccccc03-0000-4000-8000-000000000000';
  wf04 UUID := 'cccccc04-0000-4000-8000-000000000000';
  wf05 UUID := 'cccccc05-0000-4000-8000-000000000000';
  wf06 UUID := 'cccccc06-0000-4000-8000-000000000000';
  wf07 UUID := 'cccccc07-0000-4000-8000-000000000000';
  wf08 UUID := 'cccccc08-0000-4000-8000-000000000000';
  wf09 UUID := 'cccccc09-0000-4000-8000-000000000000';
  wf10 UUID := 'cccccc10-0000-4000-8000-000000000000';
  wf11 UUID := 'cccccc11-0000-4000-8000-000000000000';
  wf12 UUID := 'cccccc12-0000-4000-8000-000000000000';
  wf13 UUID := 'cccccc13-0000-4000-8000-000000000000';
  wf14 UUID := 'cccccc14-0000-4000-8000-000000000000';
  wf15 UUID := 'cccccc15-0000-4000-8000-000000000000';

  -- Fixed coverage case UUIDs
  c01 UUID := 'ca000001-0000-4000-8000-000000000000';  -- ELIGIBILITY_PENDING
  c02 UUID := 'ca000002-0000-4000-8000-000000000000';  -- ELIGIBILITY_PENDING
  c03 UUID := 'ca000003-0000-4000-8000-000000000000';  -- POLICY_CAPTURED
  c04 UUID := 'ca000004-0000-4000-8000-000000000000';  -- PREAUTH_GENERATED
  c05 UUID := 'ca000005-0000-4000-8000-000000000000';  -- PREAUTH_SENT
  c06 UUID := 'ca000006-0000-4000-8000-000000000000';  -- WAITING_APPROVAL
  c07 UUID := 'ca000007-0000-4000-8000-000000000000';  -- WAITING_APPROVAL
  c08 UUID := 'ca000008-0000-4000-8000-000000000000';  -- CLARIFICATION_REQUIRED
  c09 UUID := 'ca000009-0000-4000-8000-000000000000';  -- CLARIFICATION_REQUIRED
  c10 UUID := 'ca000010-0000-4000-8000-000000000000';  -- APPROVED
  c11 UUID := 'ca000011-0000-4000-8000-000000000000';  -- APPROVED
  c12 UUID := 'ca000012-0000-4000-8000-000000000000';  -- PARTIAL_APPROVAL
  c13 UUID := 'ca000013-0000-4000-8000-000000000000';  -- CLAIM_SUBMITTED
  c14 UUID := 'ca000014-0000-4000-8000-000000000000';  -- CLAIM_IN_PROCESS
  c15 UUID := 'ca000015-0000-4000-8000-000000000000';  -- FULL_SETTLEMENT (settled)
  c16 UUID := 'ca000016-0000-4000-8000-000000000000';  -- PARTIAL_SETTLEMENT (settled)

  -- Fixed wf instance for c16
  wf16 UUID := 'cccccc16-0000-4000-8000-000000000000';

  -- Authorization UUIDs
  au04 UUID := 'da000004-0000-4000-8000-000000000000';
  au05 UUID := 'da000005-0000-4000-8000-000000000000';
  au06 UUID := 'da000006-0000-4000-8000-000000000000';
  au07 UUID := 'da000007-0000-4000-8000-000000000000';
  au08 UUID := 'da000008-0000-4000-8000-000000000000';
  au09 UUID := 'da000009-0000-4000-8000-000000000000';
  au10 UUID := 'da000010-0000-4000-8000-000000000000';
  au11 UUID := 'da000011-0000-4000-8000-000000000000';
  au12 UUID := 'da000012-0000-4000-8000-000000000000';
  au13 UUID := 'da000013-0000-4000-8000-000000000000';
  au14 UUID := 'da000014-0000-4000-8000-000000000000';
  au15 UUID := 'da000015-0000-4000-8000-000000000000';
  au16 UUID := 'da000016-0000-4000-8000-000000000000';

  -- Visit policy UUIDs
  vp01 UUID := 'ea000001-0000-4000-8000-000000000000';
  vp02 UUID := 'ea000002-0000-4000-8000-000000000000';
  vp03 UUID := 'ea000003-0000-4000-8000-000000000000';
  vp04 UUID := 'ea000004-0000-4000-8000-000000000000';
  vp05 UUID := 'ea000005-0000-4000-8000-000000000000';
  vp06 UUID := 'ea000006-0000-4000-8000-000000000000';
  vp07 UUID := 'ea000007-0000-4000-8000-000000000000';
  vp08 UUID := 'ea000008-0000-4000-8000-000000000000';
  vp09 UUID := 'ea000009-0000-4000-8000-000000000000';
  vp10 UUID := 'ea000010-0000-4000-8000-000000000000';
  vp11 UUID := 'ea000011-0000-4000-8000-000000000000';
  vp12 UUID := 'ea000012-0000-4000-8000-000000000000';
  vp13 UUID := 'ea000013-0000-4000-8000-000000000000';
  vp14 UUID := 'ea000014-0000-4000-8000-000000000000';
  vp15 UUID := 'ea000015-0000-4000-8000-000000000000';
  vp16 UUID := 'ea000016-0000-4000-8000-000000000000';

  -- Claim packet UUIDs
  cl13 UUID := 'fa000013-0000-4000-8000-000000000000';
  cl14 UUID := 'fa000014-0000-4000-8000-000000000000';
  cl15 UUID := 'fa000015-0000-4000-8000-000000000000';
  cl16 UUID := 'fa000016-0000-4000-8000-000000000000';

  -- Settlement UUIDs
  se15 UUID := 'fb000015-0000-4000-8000-000000000000';
  se16 UUID := 'fb000016-0000-4000-8000-000000000000';

  -- Settlement line item UUIDs
  li1501 UUID := 'fc001501-0000-4000-8000-000000000000';
  li1502 UUID := 'fc001502-0000-4000-8000-000000000000';
  li1601 UUID := 'fc001601-0000-4000-8000-000000000000';
  li1602 UUID := 'fc001602-0000-4000-8000-000000000000';

  -- Dummy patient UUIDs (realistic but fictional)
  pt_jagadeesh   UUID := 'eeeeee01-0000-4000-8000-000000000000';
  pt_meenakshi   UUID := 'eeeeee02-0000-4000-8000-000000000000';
  pt_ramanadham  UUID := 'eeeeee03-0000-4000-8000-000000000000';
  pt_samaluri    UUID := 'eeeeee04-0000-4000-8000-000000000000';
  pt_priya       UUID := 'eeeeee05-0000-4000-8000-000000000000';
  pt_ravi        UUID := 'eeeeee06-0000-4000-8000-000000000000';
  pt_sunita      UUID := 'eeeeee07-0000-4000-8000-000000000000';
  pt_arjun       UUID := 'eeeeee08-0000-4000-8000-000000000000';
  pt_lakshmi     UUID := 'eeeeee09-0000-4000-8000-000000000000';
  pt_vijay       UUID := 'eeeeee10-0000-4000-8000-000000000000';
  pt_kiran       UUID := 'eeeeee11-0000-4000-8000-000000000000';
  pt_anita       UUID := 'eeeeee12-0000-4000-8000-000000000000';
  pt_mohan       UUID := 'eeeeee13-0000-4000-8000-000000000000';
  pt_rekha       UUID := 'eeeeee14-0000-4000-8000-000000000000';
  pt_suresh      UUID := 'eeeeee15-0000-4000-8000-000000000000';
  pt_deepa       UUID := 'eeeeee16-0000-4000-8000-000000000000';

BEGIN
  -- ── 1. Dynamic lookups ───────────────────────────────────────────────────────

  -- Use the tenant that already has a current CCMS financial year configured.
  -- Falls back to the first tenant if no FY exists yet.
  SELECT fy.tenant_id INTO v_tenant_id
  FROM ccms_financial_years fy
  WHERE fy.is_current = TRUE
    AND fy.deleted_at IS NULL
  ORDER BY fy.created_at
  LIMIT 1;

  IF v_tenant_id IS NULL THEN
    SELECT id INTO v_tenant_id
    FROM tenant
    WHERE deleted_at IS NULL
    ORDER BY created_at
    LIMIT 1;
  END IF;

  IF v_tenant_id IS NULL THEN
    RAISE EXCEPTION 'No tenant found — run base tenant seed first.';
  END IF;

  -- Bypass RLS so seed inserts succeed
  PERFORM set_config('app.current_tenant_id', v_tenant_id::text, true);

  SELECT id, year_code INTO v_fy_id, v_fy_code
  FROM ccms_financial_years
  WHERE tenant_id = v_tenant_id
    AND is_current = TRUE
    AND deleted_at IS NULL
  LIMIT 1;

  IF v_fy_id IS NULL THEN
    RAISE EXCEPTION 'No current financial year found for tenant % — run migration 106 first.', v_tenant_id;
  END IF;

  SELECT id INTO v_wf_def_id
  FROM ccms_workflow_definitions
  WHERE code = 'CCMS_MAIN'
    AND version = 1
    AND deleted_at IS NULL
  LIMIT 1;

  IF v_wf_def_id IS NULL THEN
    RAISE EXCEPTION 'CCMS_MAIN workflow definition not found — run migration 108 first.';
  END IF;

  -- Fetch state IDs
  SELECT id INTO s_elig_pending      FROM ccms_workflow_states WHERE workflow_definition_id=v_wf_def_id AND state_code='ELIGIBILITY_PENDING';
  SELECT id INTO s_elig_verified     FROM ccms_workflow_states WHERE workflow_definition_id=v_wf_def_id AND state_code='ELIGIBILITY_VERIFIED';
  SELECT id INTO s_policy_captured   FROM ccms_workflow_states WHERE workflow_definition_id=v_wf_def_id AND state_code='POLICY_CAPTURED';
  SELECT id INTO s_auth_required     FROM ccms_workflow_states WHERE workflow_definition_id=v_wf_def_id AND state_code='AUTHORIZATION_REQUIRED';
  SELECT id INTO s_preauth_generated FROM ccms_workflow_states WHERE workflow_definition_id=v_wf_def_id AND state_code='PREAUTH_GENERATED';
  SELECT id INTO s_preauth_sent      FROM ccms_workflow_states WHERE workflow_definition_id=v_wf_def_id AND state_code='PREAUTH_SENT';
  SELECT id INTO s_waiting_approval  FROM ccms_workflow_states WHERE workflow_definition_id=v_wf_def_id AND state_code='WAITING_APPROVAL';
  SELECT id INTO s_clarification_req FROM ccms_workflow_states WHERE workflow_definition_id=v_wf_def_id AND state_code='CLARIFICATION_REQUIRED';
  SELECT id INTO s_approved          FROM ccms_workflow_states WHERE workflow_definition_id=v_wf_def_id AND state_code='APPROVED';
  SELECT id INTO s_partial_approval  FROM ccms_workflow_states WHERE workflow_definition_id=v_wf_def_id AND state_code='PARTIAL_APPROVAL';
  SELECT id INTO s_claim_submitted   FROM ccms_workflow_states WHERE workflow_definition_id=v_wf_def_id AND state_code='CLAIM_SUBMITTED';
  SELECT id INTO s_claim_in_process  FROM ccms_workflow_states WHERE workflow_definition_id=v_wf_def_id AND state_code='CLAIM_IN_PROCESS';
  SELECT id INTO s_full_settlement   FROM ccms_workflow_states WHERE workflow_definition_id=v_wf_def_id AND state_code='FULL_SETTLEMENT';
  SELECT id INTO s_partial_settlement FROM ccms_workflow_states WHERE workflow_definition_id=v_wf_def_id AND state_code='PARTIAL_SETTLEMENT';

  -- ── 2. Insurance Providers ───────────────────────────────────────────────────

  INSERT INTO ccms_insurance_providers
    (id, tenant_id, provider_name, provider_code, contact_email, contact_phone,
     pre_auth_required, payer_category, service_tax_applicable,
     default_service_tax_percent, claim_submission_mode,
     created_at, updated_at, status, row_version)
  VALUES
    (ip_star,     v_tenant_id, 'Star Health & Allied Insurance',     'STAR_HEALTH',   'preauth@starhealth.in',    '044-28605000', TRUE, 'insurance', TRUE, 18, 'portal',  NOW()-INTERVAL '90 days', NOW()-INTERVAL '90 days', 'active', 1),
    (ip_hdfc,     v_tenant_id, 'HDFC ERGO General Insurance',        'HDFC_ERGO',     'claims@hdfcergo.com',      '022-62346234', TRUE, 'insurance', TRUE, 18, 'portal',  NOW()-INTERVAL '90 days', NOW()-INTERVAL '90 days', 'active', 1),
    (ip_newindia, v_tenant_id, 'New India Assurance Co. Ltd.',        'NEW_INDIA',     'ho@newindia.co.in',        '022-22770700', TRUE, 'insurance', FALSE, 0, 'manual',  NOW()-INTERVAL '90 days', NOW()-INTERVAL '90 days', 'active', 1),
    (ip_united,   v_tenant_id, 'United India Insurance Co. Ltd.',     'UNITED_INDIA',  'customercare@uiic.co.in',  '044-28575001', TRUE, 'insurance', FALSE, 0, 'manual',  NOW()-INTERVAL '90 days', NOW()-INTERVAL '90 days', 'active', 1)
  ON CONFLICT (id) DO NOTHING;

  -- Re-fetch IDs in case they already existed under different UUIDs
  SELECT id INTO ip_star     FROM ccms_insurance_providers WHERE tenant_id=v_tenant_id AND provider_code='STAR_HEALTH'  AND deleted_at IS NULL LIMIT 1;
  SELECT id INTO ip_hdfc     FROM ccms_insurance_providers WHERE tenant_id=v_tenant_id AND provider_code='HDFC_ERGO'    AND deleted_at IS NULL LIMIT 1;
  SELECT id INTO ip_newindia FROM ccms_insurance_providers WHERE tenant_id=v_tenant_id AND provider_code='NEW_INDIA'    AND deleted_at IS NULL LIMIT 1;
  SELECT id INTO ip_united   FROM ccms_insurance_providers WHERE tenant_id=v_tenant_id AND provider_code='UNITED_INDIA' AND deleted_at IS NULL LIMIT 1;

  -- ── 3. TPA Providers ────────────────────────────────────────────────────────

  INSERT INTO ccms_tpa_providers
    (id, tenant_id, tpa_name, tpa_code, insurance_provider_id,
     contact_email, contact_phone, tat_days_preauth, tat_days_claim,
     created_at, updated_at, status, row_version)
  VALUES
    (tpa_mediassist, v_tenant_id, 'Medi Assist India TPA Pvt. Ltd.', 'MEDI_ASSIST', ip_star,
     'preauth@mediassist.in',  '080-46107000', 3, 30, NOW()-INTERVAL '90 days', NOW()-INTERVAL '90 days', 'active', 1),
    (tpa_fhpl,       v_tenant_id, 'Family Health Plan Insurance TPA', 'FHPL',       ip_hdfc,
     'preauth@fhpl.net',       '040-23552345', 4, 30, NOW()-INTERVAL '90 days', NOW()-INTERVAL '90 days', 'active', 1)
  ON CONFLICT (id) DO NOTHING;

  SELECT id INTO tpa_mediassist FROM ccms_tpa_providers WHERE tenant_id=v_tenant_id AND tpa_code='MEDI_ASSIST' AND deleted_at IS NULL LIMIT 1;
  SELECT id INTO tpa_fhpl       FROM ccms_tpa_providers WHERE tenant_id=v_tenant_id AND tpa_code='FHPL'        AND deleted_at IS NULL LIMIT 1;

  -- ── 4. Workflow Instances ────────────────────────────────────────────────────

  INSERT INTO ccms_workflow_instances
    (id, tenant_id, workflow_definition_id, current_state_id, entity_type, entity_id,
     started_at, created_at, updated_at, status, row_version)
  VALUES
    (wf01, v_tenant_id, v_wf_def_id, s_elig_pending,       'coverage_case', c01, NOW()-INTERVAL '14 days', NOW()-INTERVAL '14 days', NOW()-INTERVAL '13 days', 'active', 1),
    (wf02, v_tenant_id, v_wf_def_id, s_elig_pending,       'coverage_case', c02, NOW()-INTERVAL '12 days', NOW()-INTERVAL '12 days', NOW()-INTERVAL '11 days', 'active', 1),
    (wf03, v_tenant_id, v_wf_def_id, s_policy_captured,    'coverage_case', c03, NOW()-INTERVAL '11 days', NOW()-INTERVAL '11 days', NOW()-INTERVAL '10 days', 'active', 1),
    (wf04, v_tenant_id, v_wf_def_id, s_preauth_generated,  'coverage_case', c04, NOW()-INTERVAL '10 days', NOW()-INTERVAL '10 days', NOW()-INTERVAL '9 days',  'active', 1),
    (wf05, v_tenant_id, v_wf_def_id, s_preauth_sent,       'coverage_case', c05, NOW()-INTERVAL '9 days',  NOW()-INTERVAL '9 days',  NOW()-INTERVAL '8 days',  'active', 1),
    (wf06, v_tenant_id, v_wf_def_id, s_waiting_approval,   'coverage_case', c06, NOW()-INTERVAL '8 days',  NOW()-INTERVAL '8 days',  NOW()-INTERVAL '7 days',  'active', 1),
    (wf07, v_tenant_id, v_wf_def_id, s_waiting_approval,   'coverage_case', c07, NOW()-INTERVAL '7 days',  NOW()-INTERVAL '7 days',  NOW()-INTERVAL '6 days',  'active', 1),
    (wf08, v_tenant_id, v_wf_def_id, s_clarification_req,  'coverage_case', c08, NOW()-INTERVAL '10 days', NOW()-INTERVAL '10 days', NOW()-INTERVAL '5 days',  'active', 1),
    (wf09, v_tenant_id, v_wf_def_id, s_clarification_req,  'coverage_case', c09, NOW()-INTERVAL '9 days',  NOW()-INTERVAL '9 days',  NOW()-INTERVAL '4 days',  'active', 1),
    (wf10, v_tenant_id, v_wf_def_id, s_approved,           'coverage_case', c10, NOW()-INTERVAL '20 days', NOW()-INTERVAL '20 days', NOW()-INTERVAL '12 days', 'active', 1),
    (wf11, v_tenant_id, v_wf_def_id, s_approved,           'coverage_case', c11, NOW()-INTERVAL '18 days', NOW()-INTERVAL '18 days', NOW()-INTERVAL '10 days', 'active', 1),
    (wf12, v_tenant_id, v_wf_def_id, s_partial_approval,   'coverage_case', c12, NOW()-INTERVAL '15 days', NOW()-INTERVAL '15 days', NOW()-INTERVAL '8 days',  'active', 1),
    (wf13, v_tenant_id, v_wf_def_id, s_claim_submitted,    'coverage_case', c13, NOW()-INTERVAL '30 days', NOW()-INTERVAL '30 days', NOW()-INTERVAL '3 days',  'active', 1),
    (wf14, v_tenant_id, v_wf_def_id, s_claim_in_process,   'coverage_case', c14, NOW()-INTERVAL '25 days', NOW()-INTERVAL '25 days', NOW()-INTERVAL '8 days',  'active', 1),
    (wf15, v_tenant_id, v_wf_def_id, s_full_settlement,    'coverage_case', c15, NOW()-INTERVAL '45 days', NOW()-INTERVAL '45 days', NOW()-INTERVAL '5 days',  'active', 1),
    (wf16, v_tenant_id, v_wf_def_id, s_partial_settlement, 'coverage_case', c16, NOW()-INTERVAL '40 days', NOW()-INTERVAL '40 days', NOW()-INTERVAL '7 days',  'active', 1)
  ON CONFLICT (id) DO NOTHING;

  -- ── 5. Coverage Cases ────────────────────────────────────────────────────────

  INSERT INTO ccms_coverage_cases
    (id, tenant_id, case_number, patient_id, patient_name, financial_year_id,
     payer_type, payment_type, insurance_provider_id, tpa_provider_id,
     workflow_instance_id, current_state, approved_amount, room_class_approved,
     pre_auth_number, emergency_fc_applied, is_draft, counsellor_draft_json,
     process_status, service_tax_applicable, service_tax_percent,
     search_patient_name, search_insurer_name, search_case_tags,
     created_at, updated_at, status, row_version)
  VALUES

    -- C01: ELIGIBILITY_PENDING – Jagadeesh Rao, Star Health
    (c01, v_tenant_id, 'CCMS-'||v_fy_code||'-000101', pt_jagadeesh, 'Jagadeesh Rao',
     v_fy_id, 'insurance', 'Insurance', ip_star, tpa_mediassist,
     wf01, 'ELIGIBILITY_PENDING', 0, NULL, NULL, FALSE, FALSE,
     '{"insurerName":"Star Health & Allied Insurance","policyNumber":"SH-2024-0019234","insuredName":"Jagadeesh Rao","estimatedAmount":175000,"payerType":"insurance","diagnosisCode":"H26.9","procedureCode":"66985","sessionPackageRate":175000}',
     'pending', FALSE, 0,
     'Jagadeesh Rao', 'Star Health & Allied Insurance', 'ELIGIBILITY_PENDING insurance Insurance',
     NOW()-INTERVAL '14 days', NOW()-INTERVAL '13 days', 'active', 1),

    -- C02: ELIGIBILITY_PENDING – Meenakshi Iyer, HDFC Ergo
    (c02, v_tenant_id, 'CCMS-'||v_fy_code||'-000102', pt_meenakshi, 'Meenakshi Iyer',
     v_fy_id, 'tpa', 'TPA', ip_hdfc, tpa_fhpl,
     wf02, 'ELIGIBILITY_PENDING', 0, NULL, NULL, FALSE, FALSE,
     '{"insurerName":"HDFC ERGO General Insurance","policyNumber":"HDFC-2024-0045678","insuredName":"Meenakshi Iyer","estimatedAmount":95000,"payerType":"tpa","diagnosisCode":"H25.11","procedureCode":"66984","sessionPackageRate":95000}',
     'pending', TRUE, 18,
     'Meenakshi Iyer', 'HDFC ERGO General Insurance', 'ELIGIBILITY_PENDING tpa TPA',
     NOW()-INTERVAL '12 days', NOW()-INTERVAL '11 days', 'active', 1),

    -- C03: POLICY_CAPTURED – Ramanadham Reddy, New India Assurance
    (c03, v_tenant_id, 'CCMS-'||v_fy_code||'-000103', pt_ramanadham, 'Ramanadham Reddy',
     v_fy_id, 'insurance', 'Insurance', ip_newindia, NULL,
     wf03, 'POLICY_CAPTURED', 0, NULL, NULL, FALSE, FALSE,
     '{"insurerName":"New India Assurance Co. Ltd.","policyNumber":"NIA-2024-0067890","insuredName":"Ramanadham Reddy","estimatedAmount":130000,"payerType":"insurance","diagnosisCode":"H40.11","procedureCode":"66170","sessionPackageRate":130000}',
     'docs_awaited', FALSE, 0,
     'Ramanadham Reddy', 'New India Assurance Co. Ltd.', 'POLICY_CAPTURED insurance Insurance',
     NOW()-INTERVAL '11 days', NOW()-INTERVAL '10 days', 'active', 1),

    -- C04: PREAUTH_GENERATED – Sam Aluri, United India
    (c04, v_tenant_id, 'CCMS-'||v_fy_code||'-000104', pt_samaluri, 'Sam Aluri',
     v_fy_id, 'insurance', 'Insurance', ip_united, NULL,
     wf04, 'PREAUTH_GENERATED', 0, NULL, NULL, FALSE, FALSE,
     '{"insurerName":"United India Insurance Co. Ltd.","policyNumber":"UII-2024-0012345","insuredName":"Sam Aluri","estimatedAmount":80000,"payerType":"insurance","diagnosisCode":"H26.9","procedureCode":"66985","sessionPackageRate":80000}',
     'preauth_drafted', FALSE, 0,
     'Sam Aluri', 'United India Insurance Co. Ltd.', 'PREAUTH_GENERATED insurance Insurance',
     NOW()-INTERVAL '10 days', NOW()-INTERVAL '9 days', 'active', 1),

    -- C05: PREAUTH_SENT – Priya Sharma, Star Health
    (c05, v_tenant_id, 'CCMS-'||v_fy_code||'-000105', pt_priya, 'Priya Sharma',
     v_fy_id, 'insurance', 'Insurance', ip_star, tpa_mediassist,
     wf05, 'PREAUTH_SENT', 0, NULL, NULL, FALSE, FALSE,
     '{"insurerName":"Star Health & Allied Insurance","policyNumber":"SH-2024-0023456","insuredName":"Priya Sharma","estimatedAmount":145000,"payerType":"insurance","diagnosisCode":"H25.12","procedureCode":"66984","sessionPackageRate":145000}',
     'sent', TRUE, 18,
     'Priya Sharma', 'Star Health & Allied Insurance', 'PREAUTH_SENT insurance Insurance',
     NOW()-INTERVAL '9 days', NOW()-INTERVAL '8 days', 'active', 1),

    -- C06: WAITING_APPROVAL – Ravi Kumar, HDFC Ergo (7 days waiting)
    (c06, v_tenant_id, 'CCMS-'||v_fy_code||'-000106', pt_ravi, 'Ravi Kumar',
     v_fy_id, 'tpa', 'TPA', ip_hdfc, tpa_fhpl,
     wf06, 'WAITING_APPROVAL', 0, NULL, NULL, FALSE, FALSE,
     '{"insurerName":"HDFC ERGO General Insurance","policyNumber":"HDFC-2024-0056789","insuredName":"Ravi Kumar","estimatedAmount":112000,"payerType":"tpa","diagnosisCode":"H26.1","procedureCode":"66982","sessionPackageRate":112000}',
     'sent', TRUE, 18,
     'Ravi Kumar', 'HDFC ERGO General Insurance', 'WAITING_APPROVAL tpa TPA',
     NOW()-INTERVAL '8 days', NOW()-INTERVAL '7 days', 'active', 1),

    -- C07: WAITING_APPROVAL – Sunita Devi, New India (3 days waiting)
    (c07, v_tenant_id, 'CCMS-'||v_fy_code||'-000107', pt_sunita, 'Sunita Devi',
     v_fy_id, 'insurance', 'Insurance', ip_newindia, NULL,
     wf07, 'WAITING_APPROVAL', 0, NULL, NULL, FALSE, FALSE,
     '{"insurerName":"New India Assurance Co. Ltd.","policyNumber":"NIA-2024-0089012","insuredName":"Sunita Devi","estimatedAmount":200000,"payerType":"insurance","diagnosisCode":"H40.13","procedureCode":"66170","sessionPackageRate":200000}',
     'sent', FALSE, 0,
     'Sunita Devi', 'New India Assurance Co. Ltd.', 'WAITING_APPROVAL insurance Insurance',
     NOW()-INTERVAL '7 days', NOW()-INTERVAL '3 days', 'active', 1),

    -- C08: CLARIFICATION_REQUIRED – Arjun Mehta, Star Health (5 days)
    (c08, v_tenant_id, 'CCMS-'||v_fy_code||'-000108', pt_arjun, 'Arjun Mehta',
     v_fy_id, 'insurance', 'Insurance', ip_star, tpa_mediassist,
     wf08, 'CLARIFICATION_REQUIRED', 0, NULL, NULL, FALSE, FALSE,
     '{"insurerName":"Star Health & Allied Insurance","policyNumber":"SH-2024-0034567","insuredName":"Arjun Mehta","estimatedAmount":160000,"payerType":"insurance","diagnosisCode":"H25.9","procedureCode":"66984","sessionPackageRate":160000}',
     'query_raised', TRUE, 18,
     'Arjun Mehta', 'Star Health & Allied Insurance', 'CLARIFICATION_REQUIRED insurance Insurance',
     NOW()-INTERVAL '10 days', NOW()-INTERVAL '5 days', 'active', 1),

    -- C09: CLARIFICATION_REQUIRED – Lakshmi Rao, United India (4 days)
    (c09, v_tenant_id, 'CCMS-'||v_fy_code||'-000109', pt_lakshmi, 'Lakshmi Rao',
     v_fy_id, 'insurance', 'Insurance', ip_united, NULL,
     wf09, 'CLARIFICATION_REQUIRED', 0, NULL, NULL, FALSE, FALSE,
     '{"insurerName":"United India Insurance Co. Ltd.","policyNumber":"UII-2024-0023456","insuredName":"Lakshmi Rao","estimatedAmount":88000,"payerType":"insurance","diagnosisCode":"H26.9","procedureCode":"66985","sessionPackageRate":88000}',
     'query_raised', FALSE, 0,
     'Lakshmi Rao', 'United India Insurance Co. Ltd.', 'CLARIFICATION_REQUIRED insurance Insurance',
     NOW()-INTERVAL '9 days', NOW()-INTERVAL '4 days', 'active', 1),

    -- C10: APPROVED – Vijay Nair, Star Health; TPA approved ₹1,20,000
    (c10, v_tenant_id, 'CCMS-'||v_fy_code||'-000110', pt_vijay, 'Vijay Nair',
     v_fy_id, 'insurance', 'Insurance', ip_star, tpa_mediassist,
     wf10, 'APPROVED', 120000, 'semi-private', 'PA/2627/SH/000110', FALSE, FALSE,
     '{"insurerName":"Star Health & Allied Insurance","policyNumber":"SH-2024-0045678","insuredName":"Vijay Nair","estimatedAmount":150000,"payerType":"insurance","diagnosisCode":"H25.12","procedureCode":"66984","sessionPackageRate":150000}',
     'approved', TRUE, 18,
     'Vijay Nair', 'Star Health & Allied Insurance', 'APPROVED insurance Insurance',
     NOW()-INTERVAL '20 days', NOW()-INTERVAL '12 days', 'active', 1),

    -- C11: APPROVED – Kiran Patel, HDFC Ergo; approved ₹75,000
    (c11, v_tenant_id, 'CCMS-'||v_fy_code||'-000111', pt_kiran, 'Kiran Patel',
     v_fy_id, 'tpa', 'TPA', ip_hdfc, tpa_fhpl,
     wf11, 'APPROVED', 75000, 'general', 'PA/2627/HDFC/000111', FALSE, FALSE,
     '{"insurerName":"HDFC ERGO General Insurance","policyNumber":"HDFC-2024-0067890","insuredName":"Kiran Patel","estimatedAmount":90000,"payerType":"tpa","diagnosisCode":"H26.9","procedureCode":"66985","sessionPackageRate":90000}',
     'approved', TRUE, 18,
     'Kiran Patel', 'HDFC ERGO General Insurance', 'APPROVED tpa TPA',
     NOW()-INTERVAL '18 days', NOW()-INTERVAL '10 days', 'active', 1),

    -- C12: PARTIAL_APPROVAL – Anita Singh, New India; approved ₹60,000 of ₹90,000
    (c12, v_tenant_id, 'CCMS-'||v_fy_code||'-000112', pt_anita, 'Anita Singh',
     v_fy_id, 'insurance', 'Insurance', ip_newindia, NULL,
     wf12, 'PARTIAL_APPROVAL', 60000, 'general', 'PA/2627/NIA/000112', FALSE, FALSE,
     '{"insurerName":"New India Assurance Co. Ltd.","policyNumber":"NIA-2024-0101112","insuredName":"Anita Singh","estimatedAmount":90000,"payerType":"insurance","diagnosisCode":"H25.11","procedureCode":"66984","sessionPackageRate":90000}',
     'partial_approved', FALSE, 0,
     'Anita Singh', 'New India Assurance Co. Ltd.', 'PARTIAL_APPROVAL insurance Insurance',
     NOW()-INTERVAL '15 days', NOW()-INTERVAL '8 days', 'active', 1),

    -- C13: CLAIM_SUBMITTED – Mohan Das, Star Health
    (c13, v_tenant_id, 'CCMS-'||v_fy_code||'-000113', pt_mohan, 'Mohan Das',
     v_fy_id, 'insurance', 'Insurance', ip_star, tpa_mediassist,
     wf13, 'CLAIM_SUBMITTED', 150000, 'semi-private', 'PA/2627/SH/000113', FALSE, FALSE,
     '{"insurerName":"Star Health & Allied Insurance","policyNumber":"SH-2024-0056789","insuredName":"Mohan Das","estimatedAmount":165000,"payerType":"insurance","diagnosisCode":"H25.12","procedureCode":"66984","sessionPackageRate":165000}',
     'submitted', TRUE, 18,
     'Mohan Das', 'Star Health & Allied Insurance', 'CLAIM_SUBMITTED insurance Insurance',
     NOW()-INTERVAL '30 days', NOW()-INTERVAL '3 days', 'active', 1),

    -- C14: CLAIM_IN_PROCESS – Rekha Gupta, HDFC Ergo
    (c14, v_tenant_id, 'CCMS-'||v_fy_code||'-000114', pt_rekha, 'Rekha Gupta',
     v_fy_id, 'tpa', 'TPA', ip_hdfc, tpa_fhpl,
     wf14, 'CLAIM_IN_PROCESS', 85000, 'general', 'PA/2627/HDFC/000114', FALSE, FALSE,
     '{"insurerName":"HDFC ERGO General Insurance","policyNumber":"HDFC-2024-0078901","insuredName":"Rekha Gupta","estimatedAmount":95000,"payerType":"tpa","diagnosisCode":"H26.9","procedureCode":"66985","sessionPackageRate":95000}',
     'under_review', TRUE, 18,
     'Rekha Gupta', 'HDFC ERGO General Insurance', 'CLAIM_IN_PROCESS tpa TPA',
     NOW()-INTERVAL '25 days', NOW()-INTERVAL '8 days', 'active', 1),

    -- C15: FULL_SETTLEMENT – Suresh Babu, Star Health
    (c15, v_tenant_id, 'CCMS-'||v_fy_code||'-000115', pt_suresh, 'Suresh Babu',
     v_fy_id, 'insurance', 'Insurance', ip_star, tpa_mediassist,
     wf15, 'FULL_SETTLEMENT', 135000, 'semi-private', 'PA/2627/SH/000115', FALSE, FALSE,
     '{"insurerName":"Star Health & Allied Insurance","policyNumber":"SH-2024-0067890","insuredName":"Suresh Babu","estimatedAmount":150000,"payerType":"insurance","diagnosisCode":"H25.9","procedureCode":"66984","sessionPackageRate":150000}',
     'settled', TRUE, 18,
     'Suresh Babu', 'Star Health & Allied Insurance', 'FULL_SETTLEMENT insurance Insurance',
     NOW()-INTERVAL '45 days', NOW()-INTERVAL '5 days', 'active', 1),

    -- C16: PARTIAL_SETTLEMENT – Deepa Nair, New India
    (c16, v_tenant_id, 'CCMS-'||v_fy_code||'-000116', pt_deepa, 'Deepa Nair',
     v_fy_id, 'insurance', 'Insurance', ip_newindia, NULL,
     wf16, 'PARTIAL_SETTLEMENT', 72000, 'general', 'PA/2627/NIA/000116', FALSE, FALSE,
     '{"insurerName":"New India Assurance Co. Ltd.","policyNumber":"NIA-2024-0112233","insuredName":"Deepa Nair","estimatedAmount":85000,"payerType":"insurance","diagnosisCode":"H40.11","procedureCode":"66170","sessionPackageRate":85000}',
     'partial_settled', FALSE, 0,
     'Deepa Nair', 'New India Assurance Co. Ltd.', 'PARTIAL_SETTLEMENT insurance Insurance',
     NOW()-INTERVAL '40 days', NOW()-INTERVAL '7 days', 'active', 1)

  ON CONFLICT (id) DO NOTHING;

  -- ── 6. Visit Insurance Policies ─────────────────────────────────────────────

  INSERT INTO ccms_visit_insurance_policies
    (id, tenant_id, coverage_case_id, policy_number, card_number,
     insurance_provider_id, tpa_provider_id, insured_name, relationship_to_insured,
     accommodation_class, tpa_coordinator_name, is_primary, sort_order,
     service_tax_applicable, created_at, updated_at, status, row_version)
  VALUES
    (vp01, v_tenant_id, c01, 'SH-2024-0019234',   'SH-C-01923', ip_star,     tpa_mediassist, 'Jagadeesh Rao',   'self',   'semi-private', 'Anand K',        TRUE, 0, FALSE, NOW()-INTERVAL '14 days', NOW()-INTERVAL '14 days', 'active', 1),
    (vp02, v_tenant_id, c02, 'HDFC-2024-0045678',  'HD-C-04567', ip_hdfc,     tpa_fhpl,       'Meenakshi Iyer',  'self',   'private',      'Sravani P',      TRUE, 0, TRUE,  NOW()-INTERVAL '12 days', NOW()-INTERVAL '12 days', 'active', 1),
    (vp03, v_tenant_id, c03, 'NIA-2024-0067890',   'NI-C-06789', ip_newindia, NULL,           'Ramanadham Reddy','self',   'semi-private', NULL,             TRUE, 0, FALSE, NOW()-INTERVAL '11 days', NOW()-INTERVAL '11 days', 'active', 1),
    (vp04, v_tenant_id, c04, 'UII-2024-0012345',   'UI-C-01234', ip_united,   NULL,           'Sam Aluri',       'self',   'general',      NULL,             TRUE, 0, FALSE, NOW()-INTERVAL '10 days', NOW()-INTERVAL '10 days', 'active', 1),
    (vp05, v_tenant_id, c05, 'SH-2024-0023456',    'SH-C-02345', ip_star,     tpa_mediassist, 'Priya Sharma',    'self',   'semi-private', 'Anand K',        TRUE, 0, TRUE,  NOW()-INTERVAL '9 days',  NOW()-INTERVAL '9 days',  'active', 1),
    (vp06, v_tenant_id, c06, 'HDFC-2024-0056789',  'HD-C-05678', ip_hdfc,     tpa_fhpl,       'Ravi Kumar',      'self',   'general',      'Sravani P',      TRUE, 0, TRUE,  NOW()-INTERVAL '8 days',  NOW()-INTERVAL '8 days',  'active', 1),
    (vp07, v_tenant_id, c07, 'NIA-2024-0089012',   'NI-C-08901', ip_newindia, NULL,           'Sunita Devi',     'self',   'private',      NULL,             TRUE, 0, FALSE, NOW()-INTERVAL '7 days',  NOW()-INTERVAL '7 days',  'active', 1),
    (vp08, v_tenant_id, c08, 'SH-2024-0034567',    'SH-C-03456', ip_star,     tpa_mediassist, 'Arjun Mehta',     'self',   'semi-private', 'Anand K',        TRUE, 0, TRUE,  NOW()-INTERVAL '10 days', NOW()-INTERVAL '10 days', 'active', 1),
    (vp09, v_tenant_id, c09, 'UII-2024-0023456',   'UI-C-02345', ip_united,   NULL,           'Lakshmi Rao',     'self',   'general',      NULL,             TRUE, 0, FALSE, NOW()-INTERVAL '9 days',  NOW()-INTERVAL '9 days',  'active', 1),
    (vp10, v_tenant_id, c10, 'SH-2024-0045678',    'SH-C-04567', ip_star,     tpa_mediassist, 'Vijay Nair',      'self',   'semi-private', 'Anand K',        TRUE, 0, TRUE,  NOW()-INTERVAL '20 days', NOW()-INTERVAL '20 days', 'active', 1),
    (vp11, v_tenant_id, c11, 'HDFC-2024-0067890',  'HD-C-06789', ip_hdfc,     tpa_fhpl,       'Kiran Patel',     'self',   'general',      'Sravani P',      TRUE, 0, TRUE,  NOW()-INTERVAL '18 days', NOW()-INTERVAL '18 days', 'active', 1),
    (vp12, v_tenant_id, c12, 'NIA-2024-0101112',   'NI-C-10111', ip_newindia, NULL,           'Anita Singh',     'self',   'general',      NULL,             TRUE, 0, FALSE, NOW()-INTERVAL '15 days', NOW()-INTERVAL '15 days', 'active', 1),
    (vp13, v_tenant_id, c13, 'SH-2024-0056789',    'SH-C-05678', ip_star,     tpa_mediassist, 'Mohan Das',       'self',   'semi-private', 'Anand K',        TRUE, 0, TRUE,  NOW()-INTERVAL '30 days', NOW()-INTERVAL '30 days', 'active', 1),
    (vp14, v_tenant_id, c14, 'HDFC-2024-0078901',  'HD-C-07890', ip_hdfc,     tpa_fhpl,       'Rekha Gupta',     'self',   'general',      'Sravani P',      TRUE, 0, TRUE,  NOW()-INTERVAL '25 days', NOW()-INTERVAL '25 days', 'active', 1),
    (vp15, v_tenant_id, c15, 'SH-2024-0067890',    'SH-C-06789', ip_star,     tpa_mediassist, 'Suresh Babu',     'self',   'semi-private', 'Anand K',        TRUE, 0, TRUE,  NOW()-INTERVAL '45 days', NOW()-INTERVAL '45 days', 'active', 1),
    (vp16, v_tenant_id, c16, 'NIA-2024-0112233',   'NI-C-11223', ip_newindia, NULL,           'Deepa Nair',      'self',   'general',      NULL,             TRUE, 0, FALSE, NOW()-INTERVAL '40 days', NOW()-INTERVAL '40 days', 'active', 1)
  ON CONFLICT (id) DO NOTHING;

  -- ── 7. Coverage Authorizations (cases ≥ PREAUTH_GENERATED: c04–c16) ─────────

  INSERT INTO ccms_coverage_authorizations
    (id, tenant_id, coverage_case_id, authorization_type,
     pre_auth_number, requested_amount, approved_amount,
     room_class_requested, room_class_approved,
     diagnosis_json, procedures_json,
     submitted_at, received_at, tpa_reference_number,
     valid_from, valid_to,
     estimated_total_cost, copay_amount, net_payable_by_insurer, net_payable_by_patient,
     process_status,
     created_at, updated_at, status, row_version)
  VALUES

    -- C04: PREAUTH_GENERATED
    (au04, v_tenant_id, c04, 'preauth',
     NULL, 80000, 0, 'general', NULL,
     '[{"icd10":"H26.9","description":"Unspecified cataract","isPrimary":true}]',
     '[{"code":"66985","name":"Cataract Surgery with IOL","icd10":"H26.9","estimatedCost":80000}]',
     NULL, NULL, NULL, NULL, NULL,
     80000, 0, 0, 0, 'pending',
     NOW()-INTERVAL '9 days', NOW()-INTERVAL '9 days', 'active', 1),

    -- C05: PREAUTH_SENT
    (au05, v_tenant_id, c05, 'preauth',
     NULL, 145000, 0, 'semi-private', NULL,
     '[{"icd10":"H25.12","description":"Age-related nuclear cataract, left eye","isPrimary":true}]',
     '[{"code":"66984","name":"Phacoemulsification with IOL","icd10":"H25.12","estimatedCost":145000}]',
     NOW()-INTERVAL '8 days', NULL, 'TPA-REF-MEDI-000105',
     NULL, NULL,
     145000, 14500, 0, 14500, 'sent',
     NOW()-INTERVAL '9 days', NOW()-INTERVAL '8 days', 'active', 1),

    -- C06: WAITING_APPROVAL
    (au06, v_tenant_id, c06, 'preauth',
     NULL, 112000, 0, 'general', NULL,
     '[{"icd10":"H26.1","description":"Traumatic cataract","isPrimary":true}]',
     '[{"code":"66982","name":"Complex Cataract Surgery","icd10":"H26.1","estimatedCost":112000}]',
     NOW()-INTERVAL '7 days', NULL, 'TPA-REF-FHPL-000106',
     NULL, NULL,
     112000, 11200, 0, 11200, 'sent',
     NOW()-INTERVAL '8 days', NOW()-INTERVAL '7 days', 'active', 1),

    -- C07: WAITING_APPROVAL
    (au07, v_tenant_id, c07, 'preauth',
     NULL, 200000, 0, 'private', NULL,
     '[{"icd10":"H40.13","description":"Primary open-angle glaucoma, severe stage","isPrimary":true}]',
     '[{"code":"66170","name":"Trabeculectomy with or without Mitomycin C","icd10":"H40.13","estimatedCost":200000}]',
     NOW()-INTERVAL '3 days', NULL, 'TPA-REF-NIA-000107',
     NULL, NULL,
     200000, 0, 0, 0, 'sent',
     NOW()-INTERVAL '7 days', NOW()-INTERVAL '3 days', 'active', 1),

    -- C08: CLARIFICATION_REQUIRED (query raised)
    (au08, v_tenant_id, c08, 'preauth',
     NULL, 160000, 0, 'semi-private', NULL,
     '[{"icd10":"H25.9","description":"Age-related cataract, unspecified","isPrimary":true}]',
     '[{"code":"66984","name":"Phacoemulsification with IOL","icd10":"H25.9","estimatedCost":160000}]',
     NOW()-INTERVAL '9 days', NOW()-INTERVAL '5 days', 'TPA-REF-MEDI-000108',
     NULL, NULL,
     160000, 16000, 0, 16000, 'query_raised',
     NOW()-INTERVAL '10 days', NOW()-INTERVAL '5 days', 'active', 1),

    -- C09: CLARIFICATION_REQUIRED
    (au09, v_tenant_id, c09, 'preauth',
     NULL, 88000, 0, 'general', NULL,
     '[{"icd10":"H26.9","description":"Unspecified cataract","isPrimary":true}]',
     '[{"code":"66985","name":"Cataract Surgery with IOL","icd10":"H26.9","estimatedCost":88000}]',
     NOW()-INTERVAL '8 days', NOW()-INTERVAL '4 days', 'TPA-REF-UII-000109',
     NULL, NULL,
     88000, 0, 0, 0, 'query_raised',
     NOW()-INTERVAL '9 days', NOW()-INTERVAL '4 days', 'active', 1),

    -- C10: APPROVED ₹1,20,000 with TPA ref
    (au10, v_tenant_id, c10, 'preauth',
     'PA/2627/SH/000110', 150000, 120000, 'semi-private', 'semi-private',
     '[{"icd10":"H25.12","description":"Age-related nuclear cataract, left eye","isPrimary":true}]',
     '[{"code":"66984","name":"Phacoemulsification with IOL","icd10":"H25.12","estimatedCost":150000}]',
     NOW()-INTERVAL '18 days', NOW()-INTERVAL '12 days', 'TPA-REF-MEDI-000110',
     NOW()-INTERVAL '12 days', NOW()-INTERVAL '12 days'+INTERVAL '30 days',
     150000, 15000, 120000, 30000, 'approved',
     NOW()-INTERVAL '20 days', NOW()-INTERVAL '12 days', 'active', 1),

    -- C11: APPROVED ₹75,000
    (au11, v_tenant_id, c11, 'preauth',
     'PA/2627/HDFC/000111', 90000, 75000, 'general', 'general',
     '[{"icd10":"H26.9","description":"Unspecified cataract","isPrimary":true}]',
     '[{"code":"66985","name":"Cataract Surgery with IOL","icd10":"H26.9","estimatedCost":90000}]',
     NOW()-INTERVAL '16 days', NOW()-INTERVAL '10 days', 'TPA-REF-FHPL-000111',
     NOW()-INTERVAL '10 days', NOW()-INTERVAL '10 days'+INTERVAL '30 days',
     90000, 9000, 75000, 24000, 'approved',
     NOW()-INTERVAL '18 days', NOW()-INTERVAL '10 days', 'active', 1),

    -- C12: PARTIAL_APPROVAL ₹60,000 of ₹90,000
    (au12, v_tenant_id, c12, 'preauth',
     'PA/2627/NIA/000112', 90000, 60000, 'general', 'general',
     '[{"icd10":"H25.11","description":"Age-related nuclear cataract, right eye","isPrimary":true}]',
     '[{"code":"66984","name":"Phacoemulsification with IOL","icd10":"H25.11","estimatedCost":90000}]',
     NOW()-INTERVAL '13 days', NOW()-INTERVAL '8 days', 'TPA-REF-NIA-000112',
     NOW()-INTERVAL '8 days', NOW()-INTERVAL '8 days'+INTERVAL '21 days',
     90000, 0, 60000, 30000, 'partial_approved',
     NOW()-INTERVAL '15 days', NOW()-INTERVAL '8 days', 'active', 1),

    -- C13: CLAIM_SUBMITTED
    (au13, v_tenant_id, c13, 'preauth',
     'PA/2627/SH/000113', 165000, 150000, 'semi-private', 'semi-private',
     '[{"icd10":"H25.12","description":"Age-related nuclear cataract, left eye","isPrimary":true}]',
     '[{"code":"66984","name":"Phacoemulsification with IOL","icd10":"H25.12","estimatedCost":165000}]',
     NOW()-INTERVAL '28 days', NOW()-INTERVAL '22 days', 'TPA-REF-MEDI-000113',
     NOW()-INTERVAL '22 days', NOW()-INTERVAL '22 days'+INTERVAL '30 days',
     165000, 16500, 150000, 31500, 'approved',
     NOW()-INTERVAL '30 days', NOW()-INTERVAL '22 days', 'active', 1),

    -- C14: CLAIM_IN_PROCESS
    (au14, v_tenant_id, c14, 'preauth',
     'PA/2627/HDFC/000114', 95000, 85000, 'general', 'general',
     '[{"icd10":"H26.9","description":"Unspecified cataract","isPrimary":true}]',
     '[{"code":"66985","name":"Cataract Surgery with IOL","icd10":"H26.9","estimatedCost":95000}]',
     NOW()-INTERVAL '23 days', NOW()-INTERVAL '18 days', 'TPA-REF-FHPL-000114',
     NOW()-INTERVAL '18 days', NOW()-INTERVAL '18 days'+INTERVAL '30 days',
     95000, 9500, 85000, 19500, 'approved',
     NOW()-INTERVAL '25 days', NOW()-INTERVAL '18 days', 'active', 1),

    -- C15: FULL_SETTLEMENT
    (au15, v_tenant_id, c15, 'preauth',
     'PA/2627/SH/000115', 150000, 135000, 'semi-private', 'semi-private',
     '[{"icd10":"H25.9","description":"Age-related cataract, unspecified","isPrimary":true}]',
     '[{"code":"66984","name":"Phacoemulsification with IOL","icd10":"H25.9","estimatedCost":150000}]',
     NOW()-INTERVAL '43 days', NOW()-INTERVAL '38 days', 'TPA-REF-MEDI-000115',
     NOW()-INTERVAL '38 days', NOW()-INTERVAL '38 days'+INTERVAL '30 days',
     150000, 15000, 135000, 30000, 'approved',
     NOW()-INTERVAL '45 days', NOW()-INTERVAL '38 days', 'active', 1),

    -- C16: PARTIAL_SETTLEMENT
    (au16, v_tenant_id, c16, 'preauth',
     'PA/2627/NIA/000116', 85000, 72000, 'general', 'general',
     '[{"icd10":"H40.11","description":"Primary open-angle glaucoma, mild stage","isPrimary":true}]',
     '[{"code":"66170","name":"Trabeculectomy","icd10":"H40.11","estimatedCost":85000}]',
     NOW()-INTERVAL '38 days', NOW()-INTERVAL '33 days', 'TPA-REF-NIA-000116',
     NOW()-INTERVAL '33 days', NOW()-INTERVAL '33 days'+INTERVAL '30 days',
     85000, 0, 72000, 13000, 'approved',
     NOW()-INTERVAL '40 days', NOW()-INTERVAL '33 days', 'active', 1)

  ON CONFLICT (id) DO NOTHING;

  -- ── 8. Claim Packets ─────────────────────────────────────────────────────────

  INSERT INTO ccms_claim_packets
    (id, tenant_id, coverage_case_id, claim_number, claimed_amount, claim_type,
     submission_mode, submitted_at, acknowledged_at, tpa_claim_number,
     expected_settlement_date,
     created_at, updated_at, status, row_version)
  VALUES
    -- C13: CLAIM_SUBMITTED
    (cl13, v_tenant_id, c13, 'CLM-'||v_fy_code||'-000113', 148000, 'cashless', 'portal',
     NOW()-INTERVAL '3 days', NULL, NULL,
     (NOW()+INTERVAL '27 days')::date,
     NOW()-INTERVAL '3 days', NOW()-INTERVAL '3 days', 'active', 1),

    -- C14: CLAIM_IN_PROCESS
    (cl14, v_tenant_id, c14, 'CLM-'||v_fy_code||'-000114', 84000, 'cashless', 'portal',
     NOW()-INTERVAL '8 days', NOW()-INTERVAL '6 days', 'FHPL-CLM-2024-000114',
     (NOW()+INTERVAL '22 days')::date,
     NOW()-INTERVAL '8 days', NOW()-INTERVAL '6 days', 'active', 1),

    -- C15: FULL_SETTLEMENT (claim is the source of the settlement)
    (cl15, v_tenant_id, c15, 'CLM-'||v_fy_code||'-000115', 133000, 'cashless', 'portal',
     NOW()-INTERVAL '20 days', NOW()-INTERVAL '18 days', 'MEDI-CLM-2024-000115',
     NOW()-INTERVAL '5 days',
     NOW()-INTERVAL '20 days', NOW()-INTERVAL '5 days', 'active', 1),

    -- C16: PARTIAL_SETTLEMENT
    (cl16, v_tenant_id, c16, 'CLM-'||v_fy_code||'-000116', 71000, 'cashless', 'manual',
     NOW()-INTERVAL '15 days', NOW()-INTERVAL '13 days', 'NIA-CLM-2024-000116',
     NOW()-INTERVAL '7 days',
     NOW()-INTERVAL '15 days', NOW()-INTERVAL '7 days', 'active', 1)

  ON CONFLICT (id) DO NOTHING;

  -- ── 9. Settlements ───────────────────────────────────────────────────────────

  INSERT INTO ccms_settlements
    (id, tenant_id, coverage_case_id, claim_packet_id, settlement_number,
     settlement_type, settled_amount, claim_amount, outstanding_amount,
     payment_reference, payment_mode, payment_date, bank_reference,
     reconciliation_status, reconciliation_notes, settled_at,
     created_at, updated_at, status, row_version)
  VALUES
    -- C15: FULL_SETTLEMENT
    (se15, v_tenant_id, c15, cl15, 'SETL-'||v_fy_code||'-000115',
     'full', 133000, 133000, 0,
     'NEFT/UTR-202627-000115', 'NEFT', (NOW()-INTERVAL '5 days')::date,
     'SBIN0015678-TXN-000115',
     'reconciled', 'Full and final settlement. Claim number CLM-'||v_fy_code||'-000115.',
     NOW()-INTERVAL '5 days',
     NOW()-INTERVAL '5 days', NOW()-INTERVAL '5 days', 'active', 1),

    -- C16: PARTIAL_SETTLEMENT
    (se16, v_tenant_id, c16, cl16, 'SETL-'||v_fy_code||'-000116',
     'partial', 45000, 71000, 26000,
     'NEFT/UTR-202627-000116', 'NEFT', (NOW()-INTERVAL '7 days')::date,
     'SBIN0015678-TXN-000116',
     'pending', 'Partial settlement. Balance Rs.26,000 awaiting TPA response on disputed items.',
     NOW()-INTERVAL '7 days',
     NOW()-INTERVAL '7 days', NOW()-INTERVAL '7 days', 'active', 1)

  ON CONFLICT (id) DO NOTHING;

  -- ── 10. Settlement Line Items ────────────────────────────────────────────────

  INSERT INTO ccms_settlement_line_items
    (id, tenant_id, settlement_id, line_item_type, description,
     claimed_amount, settled_amount, disallowed_amount, disallowed_reason,
     created_at, updated_at, status, row_version)
  VALUES
    -- C15 Full settlement lines
    (li1501, v_tenant_id, se15, 'surgery',       'Phacoemulsification with IOL (Right Eye)',  110000, 110000, 0,     NULL,                     NOW()-INTERVAL '5 days', NOW()-INTERVAL '5 days', 'active', 1),
    (li1502, v_tenant_id, se15, 'consumables',   'OT Consumables & Medicines',                 23000,  23000, 0,     NULL,                     NOW()-INTERVAL '5 days', NOW()-INTERVAL '5 days', 'active', 1),

    -- C16 Partial settlement lines
    (li1601, v_tenant_id, se16, 'surgery',       'Trabeculectomy with Mitomycin C',           60000,  45000, 15000, 'Procedure limit exceeded per policy schedule', NOW()-INTERVAL '7 days', NOW()-INTERVAL '7 days', 'active', 1),
    (li1602, v_tenant_id, se16, 'investigations','Pre-op Investigations & Lab Tests',          11000,   0,   11000, 'Pre-hospitalization expenses not covered',     NOW()-INTERVAL '7 days', NOW()-INTERVAL '7 days', 'active', 1)

  ON CONFLICT (id) DO NOTHING;

  RAISE NOTICE 'Migration 130 complete: 16 coverage cases seeded across all workflow states.';

END $$;

COMMIT;
