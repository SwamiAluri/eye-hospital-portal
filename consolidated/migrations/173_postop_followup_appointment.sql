-- =============================================================================
-- 173_postop_followup_appointment.sql
-- W-09 B2 — map discharge follow-up to Auth appointment (FR-6.3).
--
-- followup_date remains a projection. The lock is followup_appointment_id
-- pointing at Auth table appointment (logical FK; no cross-schema constraint).
-- Idempotent. Also attaches appointment.create / appointment.view to ward
-- bundles when those permission rows already exist (do not invent a second code).
-- =============================================================================

BEGIN;

ALTER TABLE post_op_instructions
  ADD COLUMN IF NOT EXISTS followup_appointment_id uuid;

CREATE INDEX IF NOT EXISTS ix_post_op_instr_followup_appt
  ON post_op_instructions (followup_appointment_id)
  WHERE followup_appointment_id IS NOT NULL;

COMMENT ON COLUMN post_op_instructions.followup_appointment_id IS
  'Auth appointment.id for the booked discharge follow-up. Logical FK; clinic slot is SoT.';

DO $$
DECLARE
    v_grants_added INT;
BEGIN
    INSERT INTO role_permission (id, "RoleId", "PermissionId", "CreatedAt")
    SELECT gen_random_uuid(), g.role_id, g.perm_id, NOW()
    FROM (
      SELECT DISTINCT r.id AS role_id, p.id AS perm_id
      FROM (VALUES
        ('NURSE',          'appointment.create'),
        ('NURSE',          'appointment.view'),
        ('WARD CLERK',     'appointment.create'),
        ('WARD CLERK',     'appointment.view'),
        ('IP COORDINATOR', 'appointment.create'),
        ('IP COORDINATOR', 'appointment.view'),
        ('ADMIN',          'appointment.create'),
        ('ADMIN',          'appointment.view')
      ) AS b(role_name, perm_code)
      JOIN app_roles r
        ON upper(coalesce(r."NormalizedName", r.name, '')) = b.role_name
       AND r."IsActive" = true
       AND r."DeletedAt" IS NULL
      JOIN permissions p
        ON p."Code" = b.perm_code
       AND p."IsActive" = true
    ) g
    WHERE NOT EXISTS (
        SELECT 1 FROM role_permission rp
        WHERE rp."RoleId" = g.role_id AND rp."PermissionId" = g.perm_id
    );

    GET DIAGNOSTICS v_grants_added = ROW_COUNT;
    RAISE NOTICE '  appointment.create/view ward grants: %', v_grants_added;
    RAISE NOTICE 'Done. Users must re-login if they newly received appointment.create.';
END $$;

COMMIT;
