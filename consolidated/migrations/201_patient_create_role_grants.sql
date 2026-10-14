-- =============================================================================
-- 201_patient_create_role_grants.sql
-- Phase 3O: grant the existing patient.create permission to the approved
-- named roles. Next number after 200_patient360_diagnosis_read.sql.
--
--   ADMIN, COUNSELLOR, RECEPTIONIST, MEDICAL RECORDS OFFICER, NURSE,
--   IP COORDINATOR
--
-- Does not insert or update permissions. Does not insert or rename app_roles.
-- Does not delete existing role_permission rows.
-- Matches NormalizedName or name. Does not match RoleCode-only rows.
-- Idempotent. Users must re-login to receive the JWT claim.
-- =============================================================================

BEGIN;

DO $$
DECLARE
    v_grants_added INT;
BEGIN
    INSERT INTO role_permission (id, "RoleId", "PermissionId", "CreatedAt")
    SELECT gen_random_uuid(), g.role_id, g.perm_id, NOW()
    FROM (
      SELECT DISTINCT r.id AS role_id, p.id AS perm_id
      FROM (VALUES
        ('ADMIN'),
        ('COUNSELLOR'),
        ('RECEPTIONIST'),
        ('MEDICAL RECORDS OFFICER'),
        ('NURSE'),
        ('IP COORDINATOR')
      ) AS b(role_name)
      JOIN app_roles r
        ON upper(coalesce(r."NormalizedName", r.name, '')) = b.role_name
       AND r."IsActive" = true
       AND r."DeletedAt" IS NULL
      JOIN permissions p
        ON p."Code" = 'patient.create'
       AND p."IsActive" = true
    ) g
    WHERE NOT EXISTS (
        SELECT 1 FROM role_permission rp
        WHERE rp."RoleId" = g.role_id AND rp."PermissionId" = g.perm_id
    );

    GET DIAGNOSTICS v_grants_added = ROW_COUNT;
    RAISE NOTICE '  patient.create grants inserted: %', v_grants_added;
    RAISE NOTICE 'Done. Users must re-login to receive patient.create.';
END $$;

COMMIT;
