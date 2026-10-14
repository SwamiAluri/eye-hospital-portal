-- ============================================================================
-- Migration 202: Counsellor session_documents.* for Counselling Session Documents
--
-- Root cause (Slice 2B Manual UAT): Counselling document endpoints require
-- session_documents.read / create / verify / delete, but Counsellor least-privilege
-- never linked those existing codes. Amelia saw "Counselling documents are not
-- available to this sign-in" despite Session Documents being a certified workflow.
--
-- Seeds the existing permission codes if absent; links to COUNSELLOR/COUNSELOR only.
-- Does NOT grant Front Desk / Receptionist / wildcard Admin permissions.
-- Does NOT grant session_notes.*, patient.view as a document substitute, or patient.update.
-- Does NOT change creator-ownership soft-delete (CreatedByUserId == actor).
-- Does NOT alter CCMS / insurance_documents / General MPI document auth.
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
    SELECT gen_random_uuid(), sys_tenant, v.code, v.name, v.module, v.action, v.resource_type, v.scope,
           v.description, true, false, false, true, NOW(), NOW()
    FROM (VALUES
        ('session_documents.read', 'Read Session Documents', 'counsellor', 'read', 'session_documents', 'branch',
         'View counselling session documents and Patient 360 counselling document metadata/content'),
        ('session_documents.create', 'Upload Session Documents', 'counsellor', 'create', 'session_documents', 'branch',
         'Upload counselling session documents (requires an existing counselling session)'),
        ('session_documents.verify', 'Verify Session Documents', 'counsellor', 'verify', 'session_documents', 'branch',
         'Verify counselling session documents in the certified counselling workflow'),
        ('session_documents.delete', 'Delete Session Documents', 'counsellor', 'delete', 'session_documents', 'branch',
         'Soft-delete counselling session documents when creator ownership permits')
    ) AS v(code, name, module, action, resource_type, scope, description)
    WHERE NOT EXISTS (
        SELECT 1 FROM permissions p WHERE p."Code" = v.code AND p."IsActive" = true
    );

    INSERT INTO role_permission (id, "RoleId", "PermissionId", "CreatedAt")
    SELECT gen_random_uuid(), r.id, p.id, NOW()
    FROM app_roles r
    JOIN permissions p ON p."Code" IN (
        'session_documents.read',
        'session_documents.create',
        'session_documents.verify',
        'session_documents.delete'
    ) AND p."IsActive" = true
    WHERE upper(coalesce(r."NormalizedName", r.name, '')) IN ('COUNSELLOR', 'COUNSELOR')
      AND NOT EXISTS (
          SELECT 1 FROM role_permission rp
          WHERE rp."RoleId" = r.id AND rp."PermissionId" = p.id
      );

    RAISE NOTICE 'Counsellor session_documents.* role_permission rows ensured';
END $$;

COMMIT;
