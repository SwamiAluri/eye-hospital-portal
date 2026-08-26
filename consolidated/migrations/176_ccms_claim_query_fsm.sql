-- ============================================================================
-- Migration 176: CCMS claim-query FSM (C3 / FR-2.3)
-- Purpose:
--   Seed CLAIM_QUERY_RAISED / CLAIM_QUERY_RESPONDED and legal transitions so
--   claim query raise/respond go through WorkflowEngine.FireAsync instead of
--   writing ccms_coverage_cases.current_state directly.
-- Dependencies: 108 (CCMS_MAIN states + claim track).
-- Date: 2026-08
-- ============================================================================

BEGIN;

DO $$
DECLARE
    v_def_id            UUID;
    v_system_tenant     UUID := '00000000-0000-0000-0000-000000000000';
    s_claim_submitted   UUID;
    s_claim_in_process  UUID;
    s_query_raised      UUID;
    s_query_responded   UUID;
BEGIN
    SELECT id INTO v_def_id
    FROM ccms_workflow_definitions
    WHERE tenant_id = v_system_tenant AND code = 'CCMS_MAIN' AND version = 1
      AND deleted_at IS NULL
    LIMIT 1;

    IF v_def_id IS NULL THEN
        RAISE NOTICE '176: CCMS_MAIN definition missing — skip claim-query FSM seed.';
        RETURN;
    END IF;

    INSERT INTO ccms_workflow_states
        (id, tenant_id, workflow_definition_id, state_code, state_label,
         is_initial, is_final, is_terminal, sort_order, row_version, created_at, updated_at, status)
    SELECT gen_random_uuid(), v_system_tenant, v_def_id, 'CLAIM_QUERY_RAISED',
           'Claim Query Raised', FALSE, FALSE, FALSE, 211, 1, NOW(), NOW(), 'active'
    WHERE NOT EXISTS (
        SELECT 1 FROM ccms_workflow_states s
        WHERE s.workflow_definition_id = v_def_id
          AND s.state_code = 'CLAIM_QUERY_RAISED'
          AND s.deleted_at IS NULL);

    INSERT INTO ccms_workflow_states
        (id, tenant_id, workflow_definition_id, state_code, state_label,
         is_initial, is_final, is_terminal, sort_order, row_version, created_at, updated_at, status)
    SELECT gen_random_uuid(), v_system_tenant, v_def_id, 'CLAIM_QUERY_RESPONDED',
           'Claim Query Responded', FALSE, FALSE, FALSE, 212, 1, NOW(), NOW(), 'active'
    WHERE NOT EXISTS (
        SELECT 1 FROM ccms_workflow_states s
        WHERE s.workflow_definition_id = v_def_id
          AND s.state_code = 'CLAIM_QUERY_RESPONDED'
          AND s.deleted_at IS NULL);

    SELECT id INTO s_claim_submitted
    FROM ccms_workflow_states
    WHERE workflow_definition_id = v_def_id AND state_code = 'CLAIM_SUBMITTED' AND deleted_at IS NULL;
    SELECT id INTO s_claim_in_process
    FROM ccms_workflow_states
    WHERE workflow_definition_id = v_def_id AND state_code = 'CLAIM_IN_PROCESS' AND deleted_at IS NULL;
    SELECT id INTO s_query_raised
    FROM ccms_workflow_states
    WHERE workflow_definition_id = v_def_id AND state_code = 'CLAIM_QUERY_RAISED' AND deleted_at IS NULL;
    SELECT id INTO s_query_responded
    FROM ccms_workflow_states
    WHERE workflow_definition_id = v_def_id AND state_code = 'CLAIM_QUERY_RESPONDED' AND deleted_at IS NULL;

    IF s_claim_submitted IS NULL OR s_claim_in_process IS NULL
       OR s_query_raised IS NULL OR s_query_responded IS NULL THEN
        RAISE NOTICE '176: claim-query states incomplete — skip transitions.';
        RETURN;
    END IF;

    -- RAISE_CLAIM_QUERY from submitted / in-process / already-responded.
    INSERT INTO ccms_workflow_transitions
        (id, tenant_id, workflow_definition_id, from_state_id, to_state_id, trigger_event,
         is_automatic, row_version, created_at, updated_at, status)
    SELECT gen_random_uuid(), v_system_tenant, v_def_id, s_claim_submitted, s_query_raised,
           'RAISE_CLAIM_QUERY', FALSE, 1, NOW(), NOW(), 'active'
    WHERE NOT EXISTS (
        SELECT 1 FROM ccms_workflow_transitions t
        WHERE t.workflow_definition_id = v_def_id
          AND t.from_state_id = s_claim_submitted
          AND t.trigger_event = 'RAISE_CLAIM_QUERY'
          AND t.deleted_at IS NULL);

    INSERT INTO ccms_workflow_transitions
        (id, tenant_id, workflow_definition_id, from_state_id, to_state_id, trigger_event,
         is_automatic, row_version, created_at, updated_at, status)
    SELECT gen_random_uuid(), v_system_tenant, v_def_id, s_claim_in_process, s_query_raised,
           'RAISE_CLAIM_QUERY', FALSE, 1, NOW(), NOW(), 'active'
    WHERE NOT EXISTS (
        SELECT 1 FROM ccms_workflow_transitions t
        WHERE t.workflow_definition_id = v_def_id
          AND t.from_state_id = s_claim_in_process
          AND t.trigger_event = 'RAISE_CLAIM_QUERY'
          AND t.deleted_at IS NULL);

    INSERT INTO ccms_workflow_transitions
        (id, tenant_id, workflow_definition_id, from_state_id, to_state_id, trigger_event,
         is_automatic, row_version, created_at, updated_at, status)
    SELECT gen_random_uuid(), v_system_tenant, v_def_id, s_query_responded, s_query_raised,
           'RAISE_CLAIM_QUERY', FALSE, 1, NOW(), NOW(), 'active'
    WHERE NOT EXISTS (
        SELECT 1 FROM ccms_workflow_transitions t
        WHERE t.workflow_definition_id = v_def_id
          AND t.from_state_id = s_query_responded
          AND t.trigger_event = 'RAISE_CLAIM_QUERY'
          AND t.deleted_at IS NULL);

    INSERT INTO ccms_workflow_transitions
        (id, tenant_id, workflow_definition_id, from_state_id, to_state_id, trigger_event,
         is_automatic, row_version, created_at, updated_at, status)
    SELECT gen_random_uuid(), v_system_tenant, v_def_id, s_query_raised, s_query_responded,
           'RESPOND_CLAIM_QUERY', FALSE, 1, NOW(), NOW(), 'active'
    WHERE NOT EXISTS (
        SELECT 1 FROM ccms_workflow_transitions t
        WHERE t.workflow_definition_id = v_def_id
          AND t.from_state_id = s_query_raised
          AND t.trigger_event = 'RESPOND_CLAIM_QUERY'
          AND t.deleted_at IS NULL);

    -- Resume the claim track after a response (acked vs not yet acked).
    INSERT INTO ccms_workflow_transitions
        (id, tenant_id, workflow_definition_id, from_state_id, to_state_id, trigger_event,
         is_automatic, row_version, created_at, updated_at, status)
    SELECT gen_random_uuid(), v_system_tenant, v_def_id, s_query_responded, s_claim_in_process,
           'CONTINUE_CLAIM', FALSE, 1, NOW(), NOW(), 'active'
    WHERE NOT EXISTS (
        SELECT 1 FROM ccms_workflow_transitions t
        WHERE t.workflow_definition_id = v_def_id
          AND t.from_state_id = s_query_responded
          AND t.trigger_event = 'CONTINUE_CLAIM'
          AND t.deleted_at IS NULL);

    INSERT INTO ccms_workflow_transitions
        (id, tenant_id, workflow_definition_id, from_state_id, to_state_id, trigger_event,
         is_automatic, row_version, created_at, updated_at, status)
    SELECT gen_random_uuid(), v_system_tenant, v_def_id, s_query_responded, s_claim_submitted,
           'RETURN_TO_SUBMITTED', FALSE, 1, NOW(), NOW(), 'active'
    WHERE NOT EXISTS (
        SELECT 1 FROM ccms_workflow_transitions t
        WHERE t.workflow_definition_id = v_def_id
          AND t.from_state_id = s_query_responded
          AND t.trigger_event = 'RETURN_TO_SUBMITTED'
          AND t.deleted_at IS NULL);
END $$;

COMMIT;
