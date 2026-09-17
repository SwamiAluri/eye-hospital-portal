-- ============================================================================
-- Migration 189: Seed counseling_sessions.* IAM permissions and grant to Counsellor
--
-- Root cause (Phase 2Z UAT): Counsellor role/JWT correctly emit role "Counsellor",
-- but counseling_sessions.read (required by sidebar + ProtectedRoute + CounselingController)
-- was never present in permissions / role_permission. Admin sees Counsellor nav via "*".
--
-- After apply: Counsellor users must re-login to refresh JWT permission claims.
-- ============================================================================

BEGIN;

DO $$
DECLARE
    sys_tenant UUID := '00000000-0000-0000-0000-000000000000';
BEGIN
    INSERT INTO permissions (id, "TenantId", "Code", "Name", "Module", "Action", "ResourceType", "Scope",
        "Description", "IsSystemPermission", "DepartmentSpecific", "IsCustom", "IsActive",
        "CreatedAt", "UpdatedAt")
    SELECT gen_random_uuid(), sys_tenant, v.code, v.name, v.module, v.action, v.resource_type, v.scope,
           v.description, true, false, false, true, NOW(), NOW()
    FROM (VALUES
        ('counseling_sessions.read', 'Read Counseling Sessions', 'counsellor', 'read', 'counseling_sessions', 'branch',
         'View counselling waiting list, sessions, follow-up center, and analytics'),
        ('counseling_sessions.create', 'Create Counseling Sessions', 'counsellor', 'create', 'counseling_sessions', 'branch',
         'Create counselling sessions from waiting list / queue'),
        ('counseling_sessions.update', 'Update Counseling Sessions', 'counsellor', 'update', 'counseling_sessions', 'branch',
         'Start, update, and complete counselling sessions and follow-up actions'),
        ('counseling_sessions.delete', 'Delete Counseling Sessions', 'counsellor', 'delete', 'counseling_sessions', 'branch',
         'Soft-delete counselling sessions'),
        ('counseling_sessions.view', 'View Counseling Session Detail', 'counsellor', 'view', 'counseling_sessions', 'branch',
         'View individual counselling session detail (legacy alias of read)')
    ) AS v(code, name, module, action, resource_type, scope, description)
    WHERE NOT EXISTS (
        SELECT 1 FROM permissions p WHERE p."Code" = v.code AND p."TenantId" = sys_tenant
    );

    -- Counsellor / Counselor roles receive counselling session baseline permissions
    INSERT INTO role_permission (id, "RoleId", "PermissionId", "CreatedAt")
    SELECT gen_random_uuid(), r.id, p.id, NOW()
    FROM app_roles r
    JOIN permissions p ON p."Code" IN (
        'counseling_sessions.read',
        'counseling_sessions.create',
        'counseling_sessions.update',
        'counseling_sessions.delete',
        'counseling_sessions.view'
    ) AND p."IsActive" = true
    WHERE upper(coalesce(r."NormalizedName", r.name, '')) IN ('COUNSELLOR', 'COUNSELOR')
      AND NOT EXISTS (
          SELECT 1 FROM role_permission rp
          WHERE rp."RoleId" = r.id AND rp."PermissionId" = p.id
      );
END $$;

COMMIT;
