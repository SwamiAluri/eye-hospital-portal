-- ============================================================
-- Migration 131: UAT reset — link Meenakshi CCMS case to counsellor session
-- Case:  CCMS-2627-000014
-- Session: bb000001-2222-2222-2222-000000000006
-- Resets workflow to DRAFT and clears orphan domain rows from sidebar-only walkthrough.
-- ============================================================

BEGIN;

DO $$
DECLARE
    v_case_id           UUID;
    v_wf_instance_id    UUID;
    v_draft_state_id    UUID;
    v_session_id        UUID := 'bb000001-2222-2222-2222-000000000006';
    v_case_number       TEXT := 'CCMS-2627-000014';
BEGIN
    SELECT id, workflow_instance_id
      INTO v_case_id, v_wf_instance_id
      FROM ccms_coverage_cases
     WHERE case_number = v_case_number
       AND deleted_at IS NULL
     LIMIT 1;

    IF v_case_id IS NULL THEN
        RAISE NOTICE 'Case % not found — skipping UAT reset (create case first or adjust case_number).', v_case_number;
        RETURN;
    END IF;

    -- Unlink session from any other case (one case per session)
    UPDATE ccms_coverage_cases
       SET session_id = NULL,
           updated_at = NOW()
     WHERE session_id = v_session_id
       AND id <> v_case_id
       AND deleted_at IS NULL;

    -- Resolve DRAFT state from system workflow definition
    SELECT ws.id INTO v_draft_state_id
      FROM ccms_workflow_states ws
      JOIN ccms_workflow_definitions wd ON wd.id = ws.workflow_definition_id
     WHERE wd.code = 'CCMS_MAIN'
       AND wd.tenant_id = '00000000-0000-0000-0000-000000000000'
       AND ws.state_code = 'DRAFT'
     LIMIT 1;

    IF v_draft_state_id IS NULL THEN
        RAISE EXCEPTION 'DRAFT workflow state not found — run migration 108 first.';
    END IF;

    -- Soft-delete orphan domain records for clean tab-only UAT
    UPDATE ccms_settlement_line_items sli
       SET deleted_at = NOW(), status = 'deleted'
      FROM ccms_settlements s
     WHERE sli.settlement_id = s.id
       AND s.coverage_case_id = v_case_id
       AND s.deleted_at IS NULL;

    UPDATE ccms_settlements
       SET deleted_at = NOW(), status = 'deleted', updated_at = NOW()
     WHERE coverage_case_id = v_case_id AND deleted_at IS NULL;

    UPDATE ccms_claim_packets
       SET deleted_at = NOW(), status = 'deleted', updated_at = NOW()
     WHERE coverage_case_id = v_case_id AND deleted_at IS NULL;

    UPDATE ccms_coverage_allocations ca
       SET deleted_at = NOW(), status = 'deleted', updated_at = NOW()
      FROM ccms_billing_summaries bs
     WHERE ca.billing_summary_id = bs.id
       AND bs.coverage_case_id = v_case_id
       AND ca.deleted_at IS NULL;

    UPDATE ccms_billing_summaries
       SET deleted_at = NOW(), status = 'deleted', updated_at = NOW()
     WHERE coverage_case_id = v_case_id AND deleted_at IS NULL;

    DELETE FROM ccms_approval_events
     WHERE coverage_case_id = v_case_id;

    UPDATE ccms_coverage_authorizations
       SET deleted_at = NOW(), status = 'deleted', updated_at = NOW()
     WHERE coverage_case_id = v_case_id AND deleted_at IS NULL;

    UPDATE ccms_eligibility_checks
       SET deleted_at = NOW(), status = 'deleted', updated_at = NOW()
     WHERE coverage_case_id = v_case_id AND deleted_at IS NULL;

    UPDATE ccms_policy_captures
       SET deleted_at = NOW(), status = 'deleted', updated_at = NOW()
     WHERE coverage_case_id = v_case_id AND deleted_at IS NULL;

    UPDATE ccms_clarification_items ci
       SET deleted_at = NOW(), status = 'deleted', updated_at = NOW()
      FROM ccms_coverage_authorizations ca
     WHERE ci.authorization_id = ca.id
       AND ca.coverage_case_id = v_case_id
       AND ci.deleted_at IS NULL;

    -- Reset workflow history (sidebar-only transitions)
    IF v_wf_instance_id IS NOT NULL THEN
        DELETE FROM ccms_workflow_history
         WHERE workflow_instance_id = v_wf_instance_id;

        UPDATE ccms_workflow_instances
           SET current_state_id = v_draft_state_id,
               updated_at       = NOW()
         WHERE id = v_wf_instance_id;

        -- Fresh START history entry
        INSERT INTO ccms_workflow_history
            (id, tenant_id, workflow_instance_id, from_state_id, to_state_id,
             trigger_event, transitioned_at, created_at, updated_at, status, row_version)
        SELECT
            uuid_generate_v4(),
            wi.tenant_id,
            wi.id,
            NULL,
            v_draft_state_id,
            'UAT_RESET',
            NOW(),
            NOW(),
            NOW(),
            'active',
            1
          FROM ccms_workflow_instances wi
         WHERE wi.id = v_wf_instance_id;
    END IF;

    -- Reset case header fields
    UPDATE ccms_coverage_cases
       SET session_id         = v_session_id,
           journey_id         = NULL,
           current_state      = 'DRAFT',
           approved_amount    = 0,
           room_class_approved = NULL,
           pre_auth_number    = NULL,
           pre_auth_expiry    = NULL,
           process_status     = NULL,
           is_draft           = TRUE,
           updated_at         = NOW()
     WHERE id = v_case_id;

    RAISE NOTICE 'UAT reset complete for case % (id=%) linked to session %', v_case_number, v_case_id, v_session_id;
END $$;

COMMIT;
