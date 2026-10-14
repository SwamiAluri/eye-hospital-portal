-- =============================================================================
-- 198_diagnostic_oct_read.sql
-- Patient 360 OCT metadata read permission.
--
-- Grants diagnostic.oct.read only to existing active, non-deleted roles:
--   ADMIN, DOCTOR, SURGEON, OPTOMETRIST
-- Does not insert app_roles. If OPTOMETRIST is not already provisioned, that
-- grant is skipped.
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
        ('diagnostic.oct.read', 'Read OCT metadata', 'diagnostic', 'read', 'oct_imaging', 'branch',
         'Read-only Patient 360 OCT metadata from oct_imaging_scans for the approved fields only: scan date, eye, scan type, scan pattern, scan size, device, device model, and status. Limited to the caller''s server-authorized branches. Does not authorize measurements, signal or quality scores, pathology or fluid findings, technician identity, notes, diagnosis, image paths, thumbnail paths, data-file paths, storage keys, URLs, file bytes, viewer, download, preview, upload, edit, delete, capture, search, statistics, or any other OCT route.')
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
        ('ADMIN',       'diagnostic.oct.read'),
        ('DOCTOR',      'diagnostic.oct.read'),
        ('SURGEON',     'diagnostic.oct.read'),
        ('OPTOMETRIST', 'diagnostic.oct.read')
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
    RAISE NOTICE 'Done. Users must re-login to receive diagnostic.oct.read.';
END $$;

COMMIT;
