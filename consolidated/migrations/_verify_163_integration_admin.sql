-- Verify 163_integration_admin_outbox_ops.sql (OPS-070).

\echo '=== 163 integration.admin permission ==='
SELECT
  CASE WHEN COUNT(*) = 1 THEN 'PASS' ELSE 'FAIL' END AS integration_admin_perm
FROM permissions
WHERE "Code" = 'integration.admin' AND "IsActive" = true;

\echo '=== 163 Admin (or IT) grant ==='
SELECT
  CASE WHEN COUNT(*) >= 1 THEN 'PASS' ELSE 'FAIL' END AS admin_grant
FROM role_permission rp
JOIN app_roles r ON r.id = rp."RoleId"
JOIN permissions p ON p.id = rp."PermissionId"
WHERE p."Code" = 'integration.admin'
  AND r."IsActive" = true
  AND r."DeletedAt" IS NULL
  AND upper(coalesce(r."NormalizedName", r.name, '')) IN (
      'ADMIN', 'SUPER ADMIN', 'SUPERADMIN', 'SYSTEM ADMINISTRATOR',
      'IT ADMIN', 'IT', 'PLATFORM ADMIN');

\echo '=== 163 IP outbox abandon_reason ==='
SELECT
  CASE WHEN COUNT(*) = 1 THEN 'PASS' ELSE 'FAIL' END AS ip_abandon_col
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'integration_outbox_event'
  AND column_name = 'abandon_reason';

\echo '=== 163 billing outbox abandon_reason ==='
SELECT
  CASE WHEN COUNT(*) = 1 THEN 'PASS' ELSE 'FAIL' END AS billing_abandon_col
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'billing_ccms_outbox'
  AND column_name = 'abandon_reason';
