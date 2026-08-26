-- =============================================================================
-- 172_safety_token_print.sql
-- W-05 A5 — seed ip.safety_token.print (inpatient wristband).
--
-- Fail-closed: NURSE, WARD CLERK, IP COORDINATOR, ADMIN.
-- No grandfather via ward.checklist.edit — IpChecklistAuth does not treat
-- ward edit as print. Users must re-login to receive the JWT claim.
-- Idempotent. 171 deferred this code to A5.
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
        ('ip.safety_token.print', 'Print safety token', 'update',
         'Print or reprint the inpatient wristband')
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
        ('NURSE',          'ip.safety_token.print'),
        ('WARD CLERK',     'ip.safety_token.print'),
        ('IP COORDINATOR', 'ip.safety_token.print'),
        ('ADMIN',          'ip.safety_token.print')
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
    RAISE NOTICE 'Done. Users must re-login to receive ip.safety_token.print.';
END $$;

COMMIT;
