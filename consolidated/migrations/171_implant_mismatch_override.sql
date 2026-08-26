-- =============================================================================
-- 171_implant_mismatch_override.sql
-- W-07 A2 — seed ip.implant.mismatch.override (IOL power/model exact compare).
--
-- Fail-closed: SURGEON, OT Coordinator, ADMIN only. Not NURSE.
-- No clinical fallback — IpChecklistAuth does not treat ot.safety.sign as override.
-- Idempotent. Users must re-login to receive the JWT claim.
-- ip.safety_token.print is deferred to W-05 A5.
-- =============================================================================

BEGIN;

DO $$
DECLARE
    sys_tenant     UUID := '00000000-0000-0000-0000-000000000000';
    v_perms_added  INT;
    v_grants_added INT;
BEGIN
    INSERT INTO permissions (
        id, "TenantId", "Code", "Name", "Module", "Action", "ResourceType", "Scope",
        "Description", "IsSystemPermission", "DepartmentSpecific", "IsCustom", "IsActive",
        "CreatedAt", "UpdatedAt")
    SELECT gen_random_uuid(), sys_tenant, v.code, v.name, 'ip_management', v.action, 'patient_journey', 'branch',
           v.descr, true, false, false, true, NOW(), NOW()
    FROM (VALUES
        ('ip.implant.mismatch.override', 'Override IOL mismatch', 'override',
         'Record an implant when power or model differs from the planned lens')
    ) AS v(code, name, action, descr)
    WHERE NOT EXISTS (
        SELECT 1 FROM permissions p WHERE p."Code" = v.code AND p."TenantId" = sys_tenant
    );

    GET DIAGNOSTICS v_perms_added = ROW_COUNT;
    RAISE NOTICE '  permissions inserted: %', v_perms_added;

    INSERT INTO role_permission (id, "RoleId", "PermissionId", "CreatedAt")
    SELECT gen_random_uuid(), g.role_id, g.perm_id, NOW()
    FROM (
      SELECT DISTINCT r.id AS role_id, p.id AS perm_id
      FROM (VALUES
        ('SURGEON',        'ip.implant.mismatch.override'),
        ('OT COORDINATOR', 'ip.implant.mismatch.override'),
        ('ADMIN',          'ip.implant.mismatch.override')
      ) AS b(role_name, perm_code)
      JOIN app_roles r
        ON upper(coalesce(r."NormalizedName", r.name, '')) = b.role_name
       AND r."IsActive" = true
       AND r."DeletedAt" IS NULL
      JOIN permissions p
        ON p."Code" = b.perm_code
       AND p."IsActive" = true
       AND p."TenantId" = sys_tenant
    ) g
    WHERE NOT EXISTS (
        SELECT 1 FROM role_permission rp
        WHERE rp."RoleId" = g.role_id AND rp."PermissionId" = g.perm_id
    );

    GET DIAGNOSTICS v_grants_added = ROW_COUNT;
    RAISE NOTICE '  bundle grants: %', v_grants_added;
    RAISE NOTICE 'Done. Users must re-login to receive ip.implant.mismatch.override.';
END $$;

COMMIT;
