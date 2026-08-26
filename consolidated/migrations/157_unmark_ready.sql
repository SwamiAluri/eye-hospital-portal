-- =============================================================================
-- 157_unmark_ready.sql
-- TASK IP-011 — Reversible Mark Ready (ReadyForSurgery → Admitted).
--
-- Additive only. Existing journeys keep NULL unmark columns. Re-running is a
-- no-op. NURSE already received ip.ot.unmark_ready via 156 grandfathering when
-- they hold ward.checklist.edit; the explicit NURSE grant covers roles that
-- missed that path.
-- =============================================================================

BEGIN;

ALTER TABLE patient_journey
    ADD COLUMN IF NOT EXISTS unmark_ready_reason text,
    ADD COLUMN IF NOT EXISTS unmarked_ready_at timestamptz,
    ADD COLUMN IF NOT EXISTS unmarked_ready_by_user_id uuid;

COMMENT ON COLUMN patient_journey.unmark_ready_reason IS
    'IP-011: reason supplied when reversing ReadyForSurgery → Admitted.';
COMMENT ON COLUMN patient_journey.unmarked_ready_at IS
    'IP-011: when Ready for OT was last reversed.';
COMMENT ON COLUMN patient_journey.unmarked_ready_by_user_id IS
    'IP-011: actor who reversed Ready for OT.';

DO $$
DECLARE
    sys_tenant UUID := '00000000-0000-0000-0000-000000000000';
BEGIN
    INSERT INTO role_permission (id, "RoleId", "PermissionId", "CreatedAt")
    SELECT gen_random_uuid(), r.id, p.id, NOW()
    FROM app_roles r
    JOIN permissions p ON p."TenantId" = sys_tenant
                      AND p."IsActive" = true
                      AND p."Code" = 'ip.ot.unmark_ready'
    WHERE r."IsActive" = true
      AND r."DeletedAt" IS NULL
      AND upper(coalesce(r."NormalizedName", r.name, '')) = 'NURSE'
      AND NOT EXISTS (
          SELECT 1 FROM role_permission rp
          WHERE rp."RoleId" = r.id AND rp."PermissionId" = p.id
      );
END $$;

COMMIT;
