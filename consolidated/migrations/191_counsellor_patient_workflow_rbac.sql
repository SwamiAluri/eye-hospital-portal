-- ============================================================================
-- Migration 191: Counsellor patient.view + patient.create for Waiting List workflow
--
-- Root cause: counselling session UI calls GET /patients/{id} and Add Patient calls
-- GET /patients/suggest + POST /patients. Those require patient.view / patient.create
-- (PatientsController existing RequirePermission contracts).
-- Surgeon dropdown uses GET /api/Counseling/surgeons (counseling_sessions.read) — no user.view.
--
-- patient.create may be absent from permissions catalog in some environments even though
-- PatientsController already requires it — seed the existing code, do not invent a new one.
--
-- Does NOT grant user.view, patient.update, patient.admin, or clinical.*.
-- Does NOT filter Waiting List by CounselorId. Does NOT backfill sessions.
-- After apply: Counsellor users must re-login to refresh JWT claims.
-- ============================================================================

BEGIN;

DO $$
DECLARE
    sys_tenant UUID := '00000000-0000-0000-0000-000000000000';
BEGIN
    -- Ensure patient.view exists (some DBs only have a non-system tenant copy)
    INSERT INTO permissions (id, "TenantId", "Code", "Name", "Module", "Action", "ResourceType", "Scope",
        "Description", "IsSystemPermission", "DepartmentSpecific", "IsCustom", "IsActive",
        "CreatedAt", "UpdatedAt")
    SELECT gen_random_uuid(), sys_tenant, 'patient.view', 'View Patients', 'patient', 'view', 'patient', 'branch',
           'View patient records, suggest, and demographics needed for clinical workflows',
           true, false, false, true, NOW(), NOW()
    WHERE NOT EXISTS (
        SELECT 1 FROM permissions p WHERE p."Code" = 'patient.view' AND p."IsActive" = true
    );

    -- Ensure patient.create exists (PatientsController POST /api/patients contract)
    INSERT INTO permissions (id, "TenantId", "Code", "Name", "Module", "Action", "ResourceType", "Scope",
        "Description", "IsSystemPermission", "DepartmentSpecific", "IsCustom", "IsActive",
        "CreatedAt", "UpdatedAt")
    SELECT gen_random_uuid(), sys_tenant, 'patient.create', 'Create Patients', 'patient', 'create', 'patient', 'branch',
           'Register new patients (MPI create) including counselling Add Patient registration',
           true, false, false, true, NOW(), NOW()
    WHERE NOT EXISTS (
        SELECT 1 FROM permissions p WHERE p."Code" = 'patient.create' AND p."IsActive" = true
    );

    INSERT INTO role_permission (id, "RoleId", "PermissionId", "CreatedAt")
    SELECT gen_random_uuid(), r.id, p.id, NOW()
    FROM app_roles r
    JOIN permissions p ON p."Code" IN ('patient.view', 'patient.create')
         AND p."IsActive" = true
    WHERE upper(coalesce(r."NormalizedName", r.name, '')) IN ('COUNSELLOR', 'COUNSELOR')
      AND NOT EXISTS (
          SELECT 1 FROM role_permission rp
          WHERE rp."RoleId" = r.id AND rp."PermissionId" = p.id
      );

    RAISE NOTICE 'Counsellor patient.view/create role_permission rows ensured';
END $$;

COMMIT;
