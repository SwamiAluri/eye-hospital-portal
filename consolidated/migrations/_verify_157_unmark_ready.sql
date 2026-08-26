-- Verify 157_unmark_ready.sql (IP-011).
-- psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f consolidated/migrations/_verify_157_unmark_ready.sql

\echo '=== 157 unmark-ready columns ==='
SELECT
  CASE WHEN COUNT(*) FILTER (WHERE column_name = 'unmark_ready_reason') = 1
        AND COUNT(*) FILTER (WHERE column_name = 'unmarked_ready_at') = 1
        AND COUNT(*) FILTER (WHERE column_name = 'unmarked_ready_by_user_id') = 1
       THEN 'PASS' ELSE 'FAIL' END AS unmark_columns
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'patient_journey'
  AND column_name IN ('unmark_ready_reason', 'unmarked_ready_at', 'unmarked_ready_by_user_id');

\echo '=== 157 NURSE unmark_ready grant (at least one active NURSE role) ==='
SELECT
  CASE WHEN COUNT(*) > 0 THEN 'PASS' ELSE 'FAIL' END AS nurse_unmark_ready
FROM app_roles r
JOIN role_permission rp ON rp."RoleId" = r.id
JOIN permissions p ON p.id = rp."PermissionId"
WHERE r."IsActive" = true
  AND r."DeletedAt" IS NULL
  AND upper(coalesce(r."NormalizedName", r.name, '')) = 'NURSE'
  AND p."Code" = 'ip.ot.unmark_ready';
