-- ============================================================================
-- Migration 190: Counsellor least-privilege RBAC (Phase 2Z PD-RBAC-01)
--
-- Removes unjustified IP/Ward/OT/anaesthesia mutation grants from Counsellor /
-- Counselor roles. Retains counselling workflow + documented supporting reads
-- (ip.view, bill.view, opd_bill.view, ward.investigation.*, counseling_sessions.*,
-- counsellor.outpatient_checklist.edit, master_data.lookup, dashboard.view).
--
-- Does NOT modify counseling_sessions rows, CounselorId, or CreatedByUserId.
-- After apply: Counsellor users must re-login to refresh JWT claims.
-- ============================================================================

BEGIN;

DO $$
BEGIN
    DELETE FROM role_permission rp
    USING app_roles r, permissions p
    WHERE rp."RoleId" = r.id
      AND rp."PermissionId" = p.id
      AND upper(coalesce(r."NormalizedName", r.name, '')) IN ('COUNSELLOR', 'COUNSELOR')
      AND p."Code" IN (
          'ip.admit',
          'ip.bed.transfer',
          'ip.discharge',
          'ip.ot.accept',
          'ip.ot.mark_ready',
          'ip.ot.send',
          'ip.ot.unmark_ready',
          'ip.postop.manage',
          'ip.surgery.complete',
          'ip.surgery.start',
          'ip_management.view',
          'ward.checklist.edit',
          'ot.safety.sign',
          'ot.safety.override',
          'anaesthesia.pac.edit',
          'anaesthesia.monitoring.edit'
      );

    RAISE NOTICE 'Counsellor least-privilege: removed unjustified role_permission rows';
END $$;

COMMIT;
