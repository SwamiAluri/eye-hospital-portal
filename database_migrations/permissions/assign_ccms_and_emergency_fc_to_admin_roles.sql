-- Staging: assign CCMS + Emergency FC permissions to operational admin roles.
-- Targets app_roles named/coded as Admin / IT_ADMIN / HEALTHCARE_ADMINISTRATOR.
-- Idempotent.

BEGIN;

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
