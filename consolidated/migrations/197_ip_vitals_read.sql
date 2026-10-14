-- =============================================================================
-- 197_ip_vitals_read.sql
-- Patient 360 IP vitals read permission.
--
-- Grants: NURSE, OT NURSE, OTNURSE, ADMIN.
-- Does not grant census, checklist, anaesthesia, or post-op holders.
-- Does not change existing permission or role_permission rows.
-- Idempotent. Users must re-login to receive the JWT claim.
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
    SELECT gen_random_uuid(), sys_tenant, v.code, v.name, v.module, v.action, v.resource_type, v.scope,
           v.descr, true, false, false, true, NOW(), NOW()
    FROM (VALUES
        ('ip.vitals.read', 'Read IP Vitals', 'ip_management', 'read', 'vital_sign', 'branch',
         'Read-only Patient 360 IP vitals: vital_sign through patient_journey for the approved fields, Ward and PreOp contexts, and approved journey states, limited to the caller''s authorized branches. Does not authorize notes, recorder identity, nurse records, pre-op clearance, OPD vitals, billing, journey actions, or any mutation.')
    ) AS v(code, name, module, action, resource_type, scope, descr)
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
        ('NURSE',     'ip.vitals.read'),
        ('OT NURSE',  'ip.vitals.read'),
        ('OTNURSE',   'ip.vitals.read'),
        ('ADMIN',     'ip.vitals.read')
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
    RAISE NOTICE 'Done. Users must re-login to receive ip.vitals.read.';
END $$;

COMMIT;
