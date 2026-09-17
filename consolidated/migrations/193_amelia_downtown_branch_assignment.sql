-- ============================================================================
-- Migration 193: Amelia Counsellor Downtown branch assignment (IAM data fix)
--
-- ROOT CAUSE (live UAT audit 2026-09-15):
--   counsellor4@hospital.com (Amelia Martinez, 48a94c56-ccb2-49c0-9916-bee2703b0251)
--   has Users."BranchId" IS NULL and ZERO user_branches / user_branch_access rows.
--   ResolveEffectiveBranchAsync correctly returns:
--     "No authorized branch is assigned to this user."
--   API/FE resolution code is not the defect — assignment data is missing.
--
-- AUTHORITATIVE EXPECTATION:
--   UAT product brief: Amelia is Downtown Counsellor.
--   Branch resolved by branch_code = 'DOWNTOWN_HOSP' for the India Eye Hospital
--   Network tenant (not hard-coded into application C#/TS).
--
-- IDEMPOTENT:
--   Only updates when BranchId is null; only inserts user_branches when missing.
--   Does not invent a branch if DOWNTOWN_HOSP is absent.
--   Does not touch counsellor1–3 or historical counselling sessions.
-- ============================================================================

BEGIN;

DO $$
DECLARE
    v_tenant UUID := '155fe198-6ae5-4a01-9254-ead5b427247e';
    v_email  TEXT := 'counsellor4@hospital.com';
    v_user   UUID;
    v_branch UUID;
BEGIN
    SELECT u.id INTO v_user
    FROM users u
    WHERE lower(u.email) = lower(v_email)
      AND u.tenant_id = v_tenant
    LIMIT 1;

    IF v_user IS NULL THEN
        RAISE NOTICE '193: Amelia user % not found in tenant % — skipped', v_email, v_tenant;
        RETURN;
    END IF;

    SELECT b.id INTO v_branch
    FROM branch b
    WHERE b.tenant_id = v_tenant
      AND b.branch_code = 'DOWNTOWN_HOSP'
      AND b.deleted_at IS NULL
      AND lower(coalesce(b.status, '')) IN ('active')
    LIMIT 1;

    IF v_branch IS NULL THEN
        RAISE EXCEPTION '193: DOWNTOWN_HOSP branch not found or inactive for tenant %', v_tenant;
    END IF;

    -- Primary home branch on Users
    UPDATE users u
    SET "BranchId" = v_branch
    WHERE u.id = v_user
      AND u.tenant_id = v_tenant
      AND u."BranchId" IS NULL;

    -- Explicit UserBranch assignment (FollowupBranchAccessService + /user-branches/me)
    INSERT INTO user_branches (
        id, tenant_id, user_id, branch_id, is_default,
        assigned_at, effective_from, status, notes,
        created_at, updated_at
    )
    SELECT
        gen_random_uuid(), v_tenant, v_user, v_branch, true,
        NOW(), NOW(), 'active',
        '193: UAT Amelia Downtown Counsellor primary branch assignment',
        NOW(), NOW()
    WHERE NOT EXISTS (
        SELECT 1
        FROM user_branches ub
        WHERE ub.user_id = v_user
          AND ub.branch_id = v_branch
          AND ub.tenant_id = v_tenant
          AND ub.deleted_at IS NULL
          AND ub.status = 'active'
    );

    RAISE NOTICE '193: Amelia % assigned to Downtown branch %', v_user, v_branch;
END $$;

COMMIT;
