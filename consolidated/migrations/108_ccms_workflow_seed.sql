-- ============================================================
-- Migration 108: CCMS Workflow Seed Data
-- Seeds the master CCMS coverage-case workflow definition,
-- all 30 states, and full transition matrix.
-- ============================================================
-- NOTE: Uses a sentinel tenant_id (nil UUID) for system/global
-- definitions. Per-tenant instances reference these definitions.
-- ============================================================

BEGIN;

-- Use nil UUID as the system tenant for global seed data
-- (RLS bypass needed; execute as rls_admin or with SET role)

DO $$
DECLARE
    v_def_id    UUID;
    v_state     RECORD;
    -- State ID variables
    s_draft                 UUID;
    s_elig_pending          UUID;
    s_elig_verified         UUID;
    s_policy_captured       UUID;
    s_auth_required         UUID;
    s_preauth_generated     UUID;
    s_preauth_sent          UUID;
    s_waiting_approval      UUID;
    s_clarification_req     UUID;
    s_resubmitted           UUID;
    s_approved              UUID;
    s_partial_approval      UUID;
    s_admission_ready       UUID;
    s_admitted              UUID;
    s_surgery_scheduled     UUID;
    s_surgery_completed     UUID;
    s_bill_pending          UUID;
    s_bill_finalized        UUID;
    s_claim_ready           UUID;
    s_claim_submitted       UUID;
    s_claim_in_process      UUID;
    s_settlement_pending    UUID;
    s_partial_settlement    UUID;
    s_full_settlement       UUID;
    s_reconciled            UUID;
    s_closed                UUID;
    s_rejected              UUID;
    s_cancelled             UUID;
    s_expired               UUID;
    s_aborted               UUID;
    -- Nil tenant for global definitions
    v_system_tenant UUID := '00000000-0000-0000-0000-000000000000';
BEGIN
    -- ── Insert workflow definition ──────────────────────────────────────────
    INSERT INTO ccms_workflow_definitions (id, tenant_id, name, code, version, is_active, row_version, created_at, updated_at, status)
    VALUES (
        uuid_generate_v4(),
        v_system_tenant,
        'Coverage & Claims Management Workflow',
        'CCMS_MAIN',
        1,
        TRUE,
        1,
        NOW(), NOW(), 'active'
    )
    ON CONFLICT (tenant_id, code, version) DO NOTHING
    RETURNING id INTO v_def_id;

    -- If definition already existed, fetch its id
    IF v_def_id IS NULL THEN
        SELECT id INTO v_def_id FROM ccms_workflow_definitions
        WHERE tenant_id = v_system_tenant AND code = 'CCMS_MAIN' AND version = 1;
    END IF;

    -- ── Insert States ───────────────────────────────────────────────────────
    INSERT INTO ccms_workflow_states
        (id, tenant_id, workflow_definition_id, state_code, state_label, is_initial, is_final, is_terminal, sort_order, row_version, created_at, updated_at, status)
    VALUES
        (uuid_generate_v4(), v_system_tenant, v_def_id, 'DRAFT',                'Draft',                         TRUE,  FALSE, FALSE,  1,  1, NOW(), NOW(), 'active'),
        (uuid_generate_v4(), v_system_tenant, v_def_id, 'ELIGIBILITY_PENDING',  'Eligibility Verification',      FALSE, FALSE, FALSE,  2,  1, NOW(), NOW(), 'active'),
        (uuid_generate_v4(), v_system_tenant, v_def_id, 'ELIGIBILITY_VERIFIED', 'Eligibility Verified',          FALSE, FALSE, FALSE,  3,  1, NOW(), NOW(), 'active'),
        (uuid_generate_v4(), v_system_tenant, v_def_id, 'POLICY_CAPTURED',      'Policy Details Captured',       FALSE, FALSE, FALSE,  4,  1, NOW(), NOW(), 'active'),
        (uuid_generate_v4(), v_system_tenant, v_def_id, 'AUTHORIZATION_REQUIRED','Authorization Required',       FALSE, FALSE, FALSE,  5,  1, NOW(), NOW(), 'active'),
        (uuid_generate_v4(), v_system_tenant, v_def_id, 'PREAUTH_GENERATED',    'Pre-Auth Request Generated',    FALSE, FALSE, FALSE,  6,  1, NOW(), NOW(), 'active'),
        (uuid_generate_v4(), v_system_tenant, v_def_id, 'PREAUTH_SENT',         'Pre-Auth Sent to TPA',          FALSE, FALSE, FALSE,  7,  1, NOW(), NOW(), 'active'),
        (uuid_generate_v4(), v_system_tenant, v_def_id, 'WAITING_APPROVAL',     'Waiting for TPA Approval',      FALSE, FALSE, FALSE,  8,  1, NOW(), NOW(), 'active'),
        (uuid_generate_v4(), v_system_tenant, v_def_id, 'CLARIFICATION_REQUIRED','Clarification Required',       FALSE, FALSE, FALSE,  9,  1, NOW(), NOW(), 'active'),
        (uuid_generate_v4(), v_system_tenant, v_def_id, 'RESUBMITTED',          'Pre-Auth Resubmitted',          FALSE, FALSE, FALSE, 10,  1, NOW(), NOW(), 'active'),
        (uuid_generate_v4(), v_system_tenant, v_def_id, 'APPROVED',             'Approved by TPA',               FALSE, FALSE, FALSE, 11,  1, NOW(), NOW(), 'active'),
        (uuid_generate_v4(), v_system_tenant, v_def_id, 'PARTIAL_APPROVAL',     'Partially Approved',            FALSE, FALSE, FALSE, 12,  1, NOW(), NOW(), 'active'),
        (uuid_generate_v4(), v_system_tenant, v_def_id, 'ADMISSION_READY',      'Ready for Admission',           FALSE, FALSE, FALSE, 13,  1, NOW(), NOW(), 'active'),
        (uuid_generate_v4(), v_system_tenant, v_def_id, 'ADMITTED',             'Patient Admitted',              FALSE, FALSE, FALSE, 14,  1, NOW(), NOW(), 'active'),
        (uuid_generate_v4(), v_system_tenant, v_def_id, 'SURGERY_SCHEDULED',    'Surgery Scheduled',             FALSE, FALSE, FALSE, 15,  1, NOW(), NOW(), 'active'),
        (uuid_generate_v4(), v_system_tenant, v_def_id, 'SURGERY_COMPLETED',    'Surgery Completed',             FALSE, FALSE, FALSE, 16,  1, NOW(), NOW(), 'active'),
        (uuid_generate_v4(), v_system_tenant, v_def_id, 'BILL_PENDING',         'Bill Generation Pending',       FALSE, FALSE, FALSE, 17,  1, NOW(), NOW(), 'active'),
        (uuid_generate_v4(), v_system_tenant, v_def_id, 'BILL_FINALIZED',       'Bill Finalized',                FALSE, FALSE, FALSE, 18,  1, NOW(), NOW(), 'active'),
        (uuid_generate_v4(), v_system_tenant, v_def_id, 'CLAIM_READY',          'Claim Packet Ready',            FALSE, FALSE, FALSE, 19,  1, NOW(), NOW(), 'active'),
        (uuid_generate_v4(), v_system_tenant, v_def_id, 'CLAIM_SUBMITTED',      'Claim Submitted',               FALSE, FALSE, FALSE, 20,  1, NOW(), NOW(), 'active'),
        (uuid_generate_v4(), v_system_tenant, v_def_id, 'CLAIM_IN_PROCESS',     'Claim Being Processed',         FALSE, FALSE, FALSE, 21,  1, NOW(), NOW(), 'active'),
        (uuid_generate_v4(), v_system_tenant, v_def_id, 'SETTLEMENT_PENDING',   'Settlement Pending',            FALSE, FALSE, FALSE, 22,  1, NOW(), NOW(), 'active'),
        (uuid_generate_v4(), v_system_tenant, v_def_id, 'PARTIAL_SETTLEMENT',   'Partial Settlement Received',   FALSE, FALSE, FALSE, 23,  1, NOW(), NOW(), 'active'),
        (uuid_generate_v4(), v_system_tenant, v_def_id, 'FULL_SETTLEMENT',      'Full Settlement Received',      FALSE, FALSE, FALSE, 24,  1, NOW(), NOW(), 'active'),
        (uuid_generate_v4(), v_system_tenant, v_def_id, 'RECONCILED',           'Reconciled',                    FALSE, FALSE, FALSE, 25,  1, NOW(), NOW(), 'active'),
        (uuid_generate_v4(), v_system_tenant, v_def_id, 'CLOSED',               'Case Closed',                   FALSE, TRUE,  FALSE, 26,  1, NOW(), NOW(), 'active'),
        (uuid_generate_v4(), v_system_tenant, v_def_id, 'REJECTED',             'Rejected by TPA',               FALSE, TRUE,  TRUE,  27,  1, NOW(), NOW(), 'active'),
        (uuid_generate_v4(), v_system_tenant, v_def_id, 'CANCELLED',            'Case Cancelled',                FALSE, TRUE,  TRUE,  28,  1, NOW(), NOW(), 'active'),
        (uuid_generate_v4(), v_system_tenant, v_def_id, 'EXPIRED',              'Pre-Auth Expired',              FALSE, TRUE,  TRUE,  29,  1, NOW(), NOW(), 'active'),
        (uuid_generate_v4(), v_system_tenant, v_def_id, 'ABORTED',              'Case Aborted',                  FALSE, TRUE,  TRUE,  30,  1, NOW(), NOW(), 'active')
    ON CONFLICT DO NOTHING;

    -- ── Fetch state IDs ──────────────────────────────────────────────────────
    SELECT id INTO s_draft              FROM ccms_workflow_states WHERE workflow_definition_id=v_def_id AND state_code='DRAFT';
    SELECT id INTO s_elig_pending       FROM ccms_workflow_states WHERE workflow_definition_id=v_def_id AND state_code='ELIGIBILITY_PENDING';
    SELECT id INTO s_elig_verified      FROM ccms_workflow_states WHERE workflow_definition_id=v_def_id AND state_code='ELIGIBILITY_VERIFIED';
    SELECT id INTO s_policy_captured    FROM ccms_workflow_states WHERE workflow_definition_id=v_def_id AND state_code='POLICY_CAPTURED';
    SELECT id INTO s_auth_required      FROM ccms_workflow_states WHERE workflow_definition_id=v_def_id AND state_code='AUTHORIZATION_REQUIRED';
    SELECT id INTO s_preauth_generated  FROM ccms_workflow_states WHERE workflow_definition_id=v_def_id AND state_code='PREAUTH_GENERATED';
    SELECT id INTO s_preauth_sent       FROM ccms_workflow_states WHERE workflow_definition_id=v_def_id AND state_code='PREAUTH_SENT';
    SELECT id INTO s_waiting_approval   FROM ccms_workflow_states WHERE workflow_definition_id=v_def_id AND state_code='WAITING_APPROVAL';
    SELECT id INTO s_clarification_req  FROM ccms_workflow_states WHERE workflow_definition_id=v_def_id AND state_code='CLARIFICATION_REQUIRED';
    SELECT id INTO s_resubmitted        FROM ccms_workflow_states WHERE workflow_definition_id=v_def_id AND state_code='RESUBMITTED';
    SELECT id INTO s_approved           FROM ccms_workflow_states WHERE workflow_definition_id=v_def_id AND state_code='APPROVED';
    SELECT id INTO s_partial_approval   FROM ccms_workflow_states WHERE workflow_definition_id=v_def_id AND state_code='PARTIAL_APPROVAL';
    SELECT id INTO s_admission_ready    FROM ccms_workflow_states WHERE workflow_definition_id=v_def_id AND state_code='ADMISSION_READY';
    SELECT id INTO s_admitted           FROM ccms_workflow_states WHERE workflow_definition_id=v_def_id AND state_code='ADMITTED';
    SELECT id INTO s_surgery_scheduled  FROM ccms_workflow_states WHERE workflow_definition_id=v_def_id AND state_code='SURGERY_SCHEDULED';
    SELECT id INTO s_surgery_completed  FROM ccms_workflow_states WHERE workflow_definition_id=v_def_id AND state_code='SURGERY_COMPLETED';
    SELECT id INTO s_bill_pending       FROM ccms_workflow_states WHERE workflow_definition_id=v_def_id AND state_code='BILL_PENDING';
    SELECT id INTO s_bill_finalized     FROM ccms_workflow_states WHERE workflow_definition_id=v_def_id AND state_code='BILL_FINALIZED';
    SELECT id INTO s_claim_ready        FROM ccms_workflow_states WHERE workflow_definition_id=v_def_id AND state_code='CLAIM_READY';
    SELECT id INTO s_claim_submitted    FROM ccms_workflow_states WHERE workflow_definition_id=v_def_id AND state_code='CLAIM_SUBMITTED';
    SELECT id INTO s_claim_in_process   FROM ccms_workflow_states WHERE workflow_definition_id=v_def_id AND state_code='CLAIM_IN_PROCESS';
    SELECT id INTO s_settlement_pending FROM ccms_workflow_states WHERE workflow_definition_id=v_def_id AND state_code='SETTLEMENT_PENDING';
    SELECT id INTO s_partial_settlement FROM ccms_workflow_states WHERE workflow_definition_id=v_def_id AND state_code='PARTIAL_SETTLEMENT';
    SELECT id INTO s_full_settlement    FROM ccms_workflow_states WHERE workflow_definition_id=v_def_id AND state_code='FULL_SETTLEMENT';
    SELECT id INTO s_reconciled         FROM ccms_workflow_states WHERE workflow_definition_id=v_def_id AND state_code='RECONCILED';
    SELECT id INTO s_closed             FROM ccms_workflow_states WHERE workflow_definition_id=v_def_id AND state_code='CLOSED';
    SELECT id INTO s_rejected           FROM ccms_workflow_states WHERE workflow_definition_id=v_def_id AND state_code='REJECTED';
    SELECT id INTO s_cancelled          FROM ccms_workflow_states WHERE workflow_definition_id=v_def_id AND state_code='CANCELLED';
    SELECT id INTO s_expired            FROM ccms_workflow_states WHERE workflow_definition_id=v_def_id AND state_code='EXPIRED';
    SELECT id INTO s_aborted            FROM ccms_workflow_states WHERE workflow_definition_id=v_def_id AND state_code='ABORTED';

    -- ── Insert Transitions ───────────────────────────────────────────────────
    INSERT INTO ccms_workflow_transitions
        (id, tenant_id, workflow_definition_id, from_state_id, to_state_id, trigger_event, is_automatic, row_version, created_at, updated_at, status)
    VALUES
        -- Pre-auth track
        (uuid_generate_v4(), v_system_tenant, v_def_id, s_draft,              s_elig_pending,      'VERIFY_ELIGIBILITY',   FALSE, 1, NOW(), NOW(), 'active'),
        (uuid_generate_v4(), v_system_tenant, v_def_id, s_elig_pending,       s_elig_verified,     'ELIGIBILITY_APPROVED', FALSE, 1, NOW(), NOW(), 'active'),
        (uuid_generate_v4(), v_system_tenant, v_def_id, s_elig_pending,       s_rejected,          'ELIGIBILITY_FAILED',   FALSE, 1, NOW(), NOW(), 'active'),
        (uuid_generate_v4(), v_system_tenant, v_def_id, s_elig_verified,      s_policy_captured,   'CAPTURE_POLICY',       FALSE, 1, NOW(), NOW(), 'active'),
        (uuid_generate_v4(), v_system_tenant, v_def_id, s_policy_captured,    s_auth_required,     'REQUIRE_AUTHORIZATION',FALSE, 1, NOW(), NOW(), 'active'),
        (uuid_generate_v4(), v_system_tenant, v_def_id, s_auth_required,      s_preauth_generated, 'GENERATE_PREAUTH',     FALSE, 1, NOW(), NOW(), 'active'),
        (uuid_generate_v4(), v_system_tenant, v_def_id, s_preauth_generated,  s_preauth_sent,      'SEND_PREAUTH',         FALSE, 1, NOW(), NOW(), 'active'),
        (uuid_generate_v4(), v_system_tenant, v_def_id, s_preauth_sent,       s_waiting_approval,  'WAIT_RESPONSE',        FALSE, 1, NOW(), NOW(), 'active'),
        (uuid_generate_v4(), v_system_tenant, v_def_id, s_waiting_approval,   s_approved,          'RECEIVE_APPROVAL',     FALSE, 1, NOW(), NOW(), 'active'),
        (uuid_generate_v4(), v_system_tenant, v_def_id, s_waiting_approval,   s_partial_approval,  'RECEIVE_PARTIAL',      FALSE, 1, NOW(), NOW(), 'active'),
        (uuid_generate_v4(), v_system_tenant, v_def_id, s_waiting_approval,   s_rejected,          'RECEIVE_REJECTION',    FALSE, 1, NOW(), NOW(), 'active'),
        (uuid_generate_v4(), v_system_tenant, v_def_id, s_waiting_approval,   s_clarification_req, 'REQUEST_CLARIFICATION',FALSE, 1, NOW(), NOW(), 'active'),
        (uuid_generate_v4(), v_system_tenant, v_def_id, s_clarification_req,  s_resubmitted,       'RESUBMIT',             FALSE, 1, NOW(), NOW(), 'active'),
        (uuid_generate_v4(), v_system_tenant, v_def_id, s_resubmitted,        s_preauth_sent,      'SEND_PREAUTH',         FALSE, 1, NOW(), NOW(), 'active'),
        -- Admission track
        (uuid_generate_v4(), v_system_tenant, v_def_id, s_approved,           s_admission_ready,   'PREPARE_ADMISSION',    FALSE, 1, NOW(), NOW(), 'active'),
        (uuid_generate_v4(), v_system_tenant, v_def_id, s_partial_approval,   s_admission_ready,   'PREPARE_ADMISSION',    FALSE, 1, NOW(), NOW(), 'active'),
        (uuid_generate_v4(), v_system_tenant, v_def_id, s_admission_ready,    s_admitted,          'ADMIT_PATIENT',        FALSE, 1, NOW(), NOW(), 'active'),
        (uuid_generate_v4(), v_system_tenant, v_def_id, s_admitted,           s_surgery_scheduled, 'SCHEDULE_SURGERY',     FALSE, 1, NOW(), NOW(), 'active'),
        (uuid_generate_v4(), v_system_tenant, v_def_id, s_surgery_scheduled,  s_surgery_completed, 'COMPLETE_SURGERY',     FALSE, 1, NOW(), NOW(), 'active'),
        -- Billing & claim track
        (uuid_generate_v4(), v_system_tenant, v_def_id, s_surgery_completed,  s_bill_pending,      'GENERATE_BILL',        FALSE, 1, NOW(), NOW(), 'active'),
        (uuid_generate_v4(), v_system_tenant, v_def_id, s_bill_pending,       s_bill_finalized,    'FINALIZE_BILL',        FALSE, 1, NOW(), NOW(), 'active'),
        (uuid_generate_v4(), v_system_tenant, v_def_id, s_bill_finalized,     s_claim_ready,       'PREPARE_CLAIM',        FALSE, 1, NOW(), NOW(), 'active'),
        (uuid_generate_v4(), v_system_tenant, v_def_id, s_claim_ready,        s_claim_submitted,   'SUBMIT_CLAIM',         FALSE, 1, NOW(), NOW(), 'active'),
        (uuid_generate_v4(), v_system_tenant, v_def_id, s_claim_submitted,    s_claim_in_process,  'CLAIM_ACKNOWLEDGED',   FALSE, 1, NOW(), NOW(), 'active'),
        -- Settlement track
        (uuid_generate_v4(), v_system_tenant, v_def_id, s_claim_in_process,   s_settlement_pending,'RECEIVE_SETTLEMENT',   FALSE, 1, NOW(), NOW(), 'active'),
        (uuid_generate_v4(), v_system_tenant, v_def_id, s_settlement_pending, s_partial_settlement,'PARTIAL_PAYMENT',      FALSE, 1, NOW(), NOW(), 'active'),
        (uuid_generate_v4(), v_system_tenant, v_def_id, s_settlement_pending, s_full_settlement,   'FULL_PAYMENT',         FALSE, 1, NOW(), NOW(), 'active'),
        (uuid_generate_v4(), v_system_tenant, v_def_id, s_full_settlement,    s_reconciled,        'RECONCILE',            FALSE, 1, NOW(), NOW(), 'active'),
        (uuid_generate_v4(), v_system_tenant, v_def_id, s_reconciled,         s_closed,            'CLOSE_CASE',           FALSE, 1, NOW(), NOW(), 'active'),
        -- Universal abort/cancel/expire (from any non-terminal state)
        (uuid_generate_v4(), v_system_tenant, v_def_id, s_draft,              s_cancelled,         'CANCEL',               FALSE, 1, NOW(), NOW(), 'active'),
        (uuid_generate_v4(), v_system_tenant, v_def_id, s_elig_pending,       s_cancelled,         'CANCEL',               FALSE, 1, NOW(), NOW(), 'active'),
        (uuid_generate_v4(), v_system_tenant, v_def_id, s_waiting_approval,   s_expired,           'EXPIRE_PREAUTH',       FALSE, 1, NOW(), NOW(), 'active'),
        (uuid_generate_v4(), v_system_tenant, v_def_id, s_preauth_sent,       s_expired,           'EXPIRE_PREAUTH',       FALSE, 1, NOW(), NOW(), 'active'),
        (uuid_generate_v4(), v_system_tenant, v_def_id, s_admission_ready,    s_expired,           'EXPIRE_PREAUTH',       FALSE, 1, NOW(), NOW(), 'active'),
        (uuid_generate_v4(), v_system_tenant, v_def_id, s_approved,           s_aborted,           'ABORT',                FALSE, 1, NOW(), NOW(), 'active'),
        (uuid_generate_v4(), v_system_tenant, v_def_id, s_partial_approval,   s_aborted,           'ABORT',                FALSE, 1, NOW(), NOW(), 'active'),
        (uuid_generate_v4(), v_system_tenant, v_def_id, s_partial_settlement, s_reconciled,        'RECONCILE',            FALSE, 1, NOW(), NOW(), 'active')
    ON CONFLICT DO NOTHING;

END $$;

COMMIT;
