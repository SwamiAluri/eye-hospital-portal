-- Staging: ensure ip.emergency_fc.apply exists, then assign CCMS + Emergency FC
-- only to Admin / IT_ADMIN / HEALTHCARE_ADMINISTRATOR.
-- Idempotent. Do not attach Emergency FC to every CCMS role.

BEGIN;

-- Ensure the fail-closed Emergency FC permission exists (system + live tenants)
WITH tenants_target AS (
    SELECT '00000000-0000-0000-0000-000000000000'::uuid AS tenant_id
    UNION
    SELECT id FROM tenant WHERE COALESCE(is_active, true) = true
)
INSERT INTO permissions (
    id, "TenantId", "Code", "Name", "Module", "Action", "ResourceType", "Scope",
    "Description", "IsSystemPermission", "DepartmentSpecific", "IsCustom", "IsActive",
    "CreatedAt", "UpdatedAt")
SELECT
    gen_random_uuid(),
    t.tenant_id,
    'ip.emergency_fc.apply',
    'Apply Emergency FC',
    'ip_management',
    'apply',
    'emergency_fc',
    'branch',
    'Apply Emergency Financial Clearance on IP journey',
    true, false, false, true,
    NOW(), NOW()
FROM tenants_target t
WHERE NOT EXISTS (
    SELECT 1 FROM permissions p
    WHERE p."TenantId" = t.tenant_id AND p."Code" = 'ip.emergency_fc.apply'
);

WITH target_roles AS (
    SELECT r.id AS role_id
    FROM app_roles r
    WHERE COALESCE(r."IsActive", true) = true
      AND r."DeletedAt" IS NULL
      AND (
        LOWER(COALESCE(r.name, '')) IN ('admin', 'it administrator')
        OR UPPER(COALESCE(r."RoleCode", '')) IN ('IT_ADMIN', 'HEALTHCARE_ADMINISTRATOR', 'ADMIN')
        OR UPPER(COALESCE(r.role_code, '')) IN ('IT_ADMIN', 'HEALTHCARE_ADMINISTRATOR', 'ADMIN')
      )
),
target_perms AS (
    SELECT p.id AS permission_id
    FROM permissions p
    WHERE COALESCE(p."IsActive", true) = true
      AND (
        p."Code" LIKE 'ccms.%'
        OR p."Code" = 'ip.emergency_fc.apply'
      )
)
INSERT INTO role_permission (id, "RoleId", "PermissionId", "CreatedAt")
SELECT gen_random_uuid(), tr.role_id, tp.permission_id, NOW()
FROM target_roles tr
CROSS JOIN target_perms tp
WHERE NOT EXISTS (
    SELECT 1 FROM role_permission rp
    WHERE rp."RoleId" = tr.role_id AND rp."PermissionId" = tp.permission_id
);

COMMIT;

SELECT r.name, r."RoleCode", COUNT(*) AS assigned
FROM app_roles r
JOIN role_permission rp ON rp."RoleId" = r.id
JOIN permissions p ON p.id = rp."PermissionId"
WHERE p."Code" LIKE 'ccms.%' OR p."Code" = 'ip.emergency_fc.apply'
GROUP BY r.name, r."RoleCode"
ORDER BY 1;

SELECT p."Code", COUNT(DISTINCT rp."RoleId") AS role_count
FROM permissions p
JOIN role_permission rp ON rp."PermissionId" = p.id
WHERE p."Code" IN (
  'ccms.enhancement.write','ccms.enhancement.decide','ccms.preauth.process','ip.emergency_fc.apply'
)
GROUP BY p."Code"
ORDER BY 1;
