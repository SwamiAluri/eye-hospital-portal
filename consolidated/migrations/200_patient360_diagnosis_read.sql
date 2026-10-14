-- =============================================================================
-- 200_patient360_diagnosis_read.sql
-- Patient 360 coded diagnosis history read permission.
--
-- Next number after 199_patient360_medication_read.sql.
-- Grants patient360.diagnosis.read only to existing active, non-deleted roles:
--   ADMIN, CONSULTANT, DOCTOR, SENIOR DOCTOR, NURSE, SENIOR NURSE,
--   NURSE MANAGER, SURGEON, JUNIOR DOCTOR, ANAESTHETIST, COUNSELLOR,
--   RADIOLOGIST, MEDICAL RECORDS OFFICER
-- Does not insert app_roles. Does not grant rejected, unprovisioned, inactive,
-- deleted, or unnamed roles.
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
        ('patient360.diagnosis.read', 'Read Patient 360 Diagnosis History', 'patient360', 'read', 'diagnosis_history', 'tenant',
         'Read-only Patient 360 coded diagnosis history from patient_diagnosis and diagnosis_code, excluding diagnosis notes, examination narrative, draft diagnosis, payer and financial diagnosis representations, and staff identifiers.')
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
        ('ADMIN',                   'patient360.diagnosis.read'),
        ('CONSULTANT',              'patient360.diagnosis.read'),
        ('DOCTOR',                  'patient360.diagnosis.read'),
        ('SENIOR DOCTOR',           'patient360.diagnosis.read'),
        ('NURSE',                   'patient360.diagnosis.read'),
        ('SENIOR NURSE',            'patient360.diagnosis.read'),
        ('NURSE MANAGER',           'patient360.diagnosis.read'),
        ('SURGEON',                 'patient360.diagnosis.read'),
        ('JUNIOR DOCTOR',           'patient360.diagnosis.read'),
        ('ANAESTHETIST',            'patient360.diagnosis.read'),
        ('COUNSELLOR',              'patient360.diagnosis.read'),
        ('RADIOLOGIST',             'patient360.diagnosis.read'),
        ('MEDICAL RECORDS OFFICER', 'patient360.diagnosis.read')
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
    RAISE NOTICE 'Done. Users must re-login to receive patient360.diagnosis.read.';
END $$;

COMMIT;
