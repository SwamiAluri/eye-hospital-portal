-- Staging ops: seed CCMS/IP Phase 2–5 permission aliases into PascalCase Auth schema.
-- Idempotent. Matches hospitalportal permissions / role_permission column names.

BEGIN;

-- 1) Ensure permissions exist (system tenant + every live tenant)
WITH tenants_target AS (
    SELECT '00000000-0000-0000-0000-000000000000'::uuid AS tenant_id
    UNION
    SELECT id FROM tenant WHERE COALESCE(is_active, true) = true
),
codes AS (
    SELECT * FROM (VALUES
        ('ccms.clarification.write', 'Write Clarifications',           'write',  'clarification',
         'Create or respond to TPA clarification queries (Phase 2 alias)'),
        ('ccms.preauth.create',      'Create Pre-Auth (alias)',        'create', 'authorization',
         'Alias of ccms.authorization.create for Phase 2 RBAC'),
        ('ccms.preauth.submit',      'Submit Pre-Auth (alias)',        'submit', 'authorization',
         'Alias of ccms.authorization.submit for Phase 2 RBAC'),
        ('ccms.preauth.process',     'Process Pre-Auth (alias)',       'process','authorization',
         'Alias of ccms.authorization.record_response for Phase 2 RBAC'),
        ('ccms.enhancement.write',   'Write Enhancements',             'write',  'enhancement',
         'Create or decide enhancement requests'),
        ('ccms.enhancement.create',  'Create Enhancement',             'create', 'enhancement',
         'Create an enhancement request on a coverage case'),
        ('ccms.enhancement.decide',  'Decide Enhancement',             'decide', 'enhancement',
         'Approve or reject an enhancement request'),
        ('ccms.claim.write',         'Write Claims (alias)',           'write',  'claim',
         'Alias covering claim create/submit for Phase 2 RBAC'),
        ('ip.emergency_fc.apply',    'Apply Emergency FC',             'apply',  'emergency_fc',
         'Apply Emergency Financial Clearance on IP journey')
    ) AS v(code, name, action, resource_type, description)
)
INSERT INTO permissions (
    id, "TenantId", "Code", "Name", "Module", "Action", "ResourceType", "Scope",
    "Description", "IsSystemPermission", "DepartmentSpecific", "IsCustom", "IsActive",
    "CreatedAt", "UpdatedAt")
SELECT
    gen_random_uuid(),
    t.tenant_id,
    c.code,
    c.name,
    CASE WHEN c.code LIKE 'ip.%' THEN 'ip_management' ELSE 'ccms' END,
    c.action,
    c.resource_type,
    'branch',
    c.description,
    true, false, false, true,
    NOW(), NOW()
FROM tenants_target t
CROSS JOIN codes c
WHERE NOT EXISTS (
    SELECT 1 FROM permissions p
    WHERE p."TenantId" = t.tenant_id AND p."Code" = c.code
);

-- 2) Attach aliases to roles that already hold any ccms.* permission
INSERT INTO role_permission (id, "RoleId", "PermissionId", "CreatedAt")
SELECT DISTINCT
    gen_random_uuid(),
    roles_with_ccms.role_id,
    alias_perm.id,
    NOW()
FROM (
    SELECT DISTINCT rp."RoleId" AS role_id
    FROM role_permission rp
    JOIN permissions p ON p.id = rp."PermissionId"
    WHERE p."Code" LIKE 'ccms.%'
      AND COALESCE(p."IsActive", true) = true
) roles_with_ccms
JOIN permissions alias_perm
  ON alias_perm."Code" IN (
        'ccms.clarification.write',
        'ccms.preauth.create',
        'ccms.preauth.submit',
        'ccms.preauth.process',
        'ccms.enhancement.write',
        'ccms.enhancement.create',
        'ccms.enhancement.decide',
        'ccms.claim.write',
        'ip.emergency_fc.apply'
     )
 AND COALESCE(alias_perm."IsActive", true) = true
WHERE NOT EXISTS (
    SELECT 1 FROM role_permission rp2
    WHERE rp2."RoleId" = roles_with_ccms.role_id
      AND rp2."PermissionId" = alias_perm.id
);

COMMIT;

-- Verification
SELECT p."Code", COUNT(DISTINCT rp."RoleId") AS role_count
FROM permissions p
LEFT JOIN role_permission rp ON rp."PermissionId" = p.id
WHERE p."Code" IN (
  'ccms.enhancement.write','ccms.enhancement.create','ccms.enhancement.decide',
  'ccms.preauth.process','ip.emergency_fc.apply'
)
GROUP BY p."Code"
ORDER BY 1;

