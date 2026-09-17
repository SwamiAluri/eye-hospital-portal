-- ============================================================================
-- Migration 195: Counsellor package_templates.read for Quote → Package
--
-- Root cause: counselling Quote → Package lists GET /api/counselling-package-templates
-- which requires package_templates.read (CounsellingPackageTemplatesController).
-- Counsellor least-privilege previously omitted this read entitlement, so Amelia
-- could open a session but could not select approved package templates.
--
-- Seeds the existing permission code if absent; links to COUNSELLOR/COUNSELOR only.
-- Does NOT grant package_templates.create / update / delete.
-- Does NOT grant user.view, session_notes.*, or session_documents.*.
-- Does NOT change controller authorization or Waiting List ownership.
-- After apply: Counsellor users must re-login to refresh JWT claims.
-- ============================================================================

BEGIN;

DO $$
DECLARE
    sys_tenant UUID := '00000000-0000-0000-0000-000000000000';
BEGIN
    INSERT INTO permissions (id, "TenantId", "Code", "Name", "Module", "Action", "ResourceType", "Scope",
        "Description", "IsSystemPermission", "DepartmentSpecific", "IsCustom", "IsActive",
        "CreatedAt", "UpdatedAt")
    SELECT gen_random_uuid(), sys_tenant, 'package_templates.read', 'Read Package Templates',
           'counselling', 'read', 'package_template', 'tenant',
           'List and select approved counselling package templates for quoting (not package administration)',
           true, false, false, true, NOW(), NOW()
    WHERE NOT EXISTS (
        SELECT 1 FROM permissions p WHERE p."Code" = 'package_templates.read' AND p."IsActive" = true
    );

    INSERT INTO role_permission (id, "RoleId", "PermissionId", "CreatedAt")
    SELECT gen_random_uuid(), r.id, p.id, NOW()
    FROM app_roles r
    JOIN permissions p ON p."Code" = 'package_templates.read'
         AND p."IsActive" = true
    WHERE upper(coalesce(r."NormalizedName", r.name, '')) IN ('COUNSELLOR', 'COUNSELOR')
      AND NOT EXISTS (
          SELECT 1 FROM role_permission rp
          WHERE rp."RoleId" = r.id AND rp."PermissionId" = p.id
      );

    RAISE NOTICE 'Counsellor package_templates.read role_permission rows ensured';
END $$;

COMMIT;
