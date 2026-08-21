-- Phase 2 residual: seed CCMS Phase-2 permission aliases + map into JWT-bearing roles.
-- Targets table names used by AuthService EF: permissions, role_permission.
-- Idempotent.

BEGIN;

-- ── 1. Insert alias permissions for system tenant + every live tenant ─────────
WITH tenants_target AS (
    SELECT '00000000-0000-0000-0000-000000000000'::uuid AS tenant_id
    UNION
    SELECT id FROM tenants WHERE COALESCE(is_active, true) = true
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
    id, tenant_id, code, name, module, action, resource_type, scope,
    description, is_system_permission, department_specific, is_custom, is_active,
    created_at, updated_at)
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
    WHERE p.tenant_id = t.tenant_id AND p.code = c.code
);

-- ── 2. Attach aliases to roles that already hold any ccms.* permission ────────
-- Prefer matching same-tenant permission rows; fall back to system-tenant codes.
INSERT INTO role_permission (id, role_id, permission_id, created_at)
SELECT DISTINCT
    gen_random_uuid(),
    roles_with_ccms.role_id,
    alias_perm.id,
    NOW()
FROM (
    SELECT DISTINCT rp.role_id
    FROM role_permission rp
    JOIN permissions p ON p.id = rp.permission_id
    WHERE p.code LIKE 'ccms.%'
      AND COALESCE(p.is_active, true) = true
) roles_with_ccms
JOIN permissions alias_perm
  ON alias_perm.code IN (
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
 AND COALESCE(alias_perm.is_active, true) = true
 AND alias_perm.tenant_id = '00000000-0000-0000-0000-000000000000'::uuid
WHERE NOT EXISTS (
    SELECT 1 FROM role_permission rp2
    WHERE rp2.role_id = roles_with_ccms.role_id
      AND rp2.permission_id = alias_perm.id
);

COMMIT;
