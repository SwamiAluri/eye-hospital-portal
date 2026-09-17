-- ============================================================================
-- Migration 196: counseling_sessions.reassign — Phase 3I Slice 6 D1 IAM
--
-- Supervisory General Reassign permission (owned session A → counsellor B).
-- Distinct from:
--   counseling_sessions.update  (Assign NULL→target, Claim, content mutate)
--
-- Grants: ADMIN only (existing Admin role_permission path)
-- Does NOT grant COUNSELLOR / COUNSELOR
-- Does NOT invent a Supervisor role — other supervisory actors receive this
-- permission via IAM role editing (PD-SUP-01 / PD-S6-01)
--
-- After apply: affected users must re-login to refresh JWT claims.
-- Does NOT implement /reassign endpoint or ownership mutation behavior.
-- ============================================================================

BEGIN;

DO $$
DECLARE
    sys_tenant UUID := '00000000-0000-0000-0000-000000000000';
BEGIN
    INSERT INTO permissions (id, "TenantId", "Code", "Name", "Module", "Action", "ResourceType", "Scope",
        "Description", "IsSystemPermission", "DepartmentSpecific", "IsCustom", "IsActive",
        "CreatedAt", "UpdatedAt")
    SELECT gen_random_uuid(), sys_tenant,
           'counseling_sessions.reassign',
           'Reassign Counseling Session Ownership',
           'counsellor', 'reassign', 'counseling_sessions', 'branch',
           'Supervisory reassignment of an already-owned counselling session to another authorized counsellor (A→B). Does not establish initial ownership (Assign) or lifecycle claim.',
           true, false, false, true, NOW(), NOW()
    WHERE NOT EXISTS (
        SELECT 1 FROM permissions p
        WHERE p."Code" = 'counseling_sessions.reassign' AND p."TenantId" = sys_tenant
    );

    INSERT INTO role_permission (id, "RoleId", "PermissionId", "CreatedAt")
    SELECT gen_random_uuid(), r.id, p.id, NOW()
    FROM app_roles r
    JOIN permissions p ON p."Code" = 'counseling_sessions.reassign' AND p."IsActive" = true
    WHERE upper(replace(coalesce(r."NormalizedName", r.name, ''), '_', ' ')) = 'ADMIN'
      AND upper(coalesce(r."NormalizedName", r.name, '')) NOT IN ('COUNSELLOR', 'COUNSELOR')
      AND NOT EXISTS (
          SELECT 1 FROM role_permission rp
          WHERE rp."RoleId" = r.id AND rp."PermissionId" = p.id
      );

    -- Defence in depth: strip reassign from Counsellor/Counselor if present
    DELETE FROM role_permission rp
    USING app_roles r, permissions p
    WHERE rp."RoleId" = r.id
      AND rp."PermissionId" = p.id
      AND p."Code" = 'counseling_sessions.reassign'
      AND upper(coalesce(r."NormalizedName", r.name, '')) IN ('COUNSELLOR', 'COUNSELOR');

    RAISE NOTICE 'counseling_sessions.reassign catalog + ADMIN grant ensured; Counsellor excluded';
END $$;

COMMIT;
