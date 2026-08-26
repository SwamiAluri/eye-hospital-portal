-- =============================================================================
-- _verify_172_safety_token_print.sql
-- Verification for W-05 A5 / migration 172. Read-only.
--
--   psql "$DATABASE_URL" -f consolidated/migrations/_verify_172_safety_token_print.sql
-- =============================================================================

\pset pager off

\echo
\echo ===== 1. Permission code exists
SELECT v.code,
       CASE WHEN p.id IS NULL THEN 'FAIL - missing' ELSE 'PASS' END AS status
FROM (VALUES
  ('ip.safety_token.print')
) AS v(code)
LEFT JOIN permissions p
  ON p."Code" = v.code AND p."TenantId" = '00000000-0000-0000-0000-000000000000'
ORDER BY status, v.code;

\echo
\echo ===== 2. NURSE / IP COORDINATOR / ADMIN have print
SELECT v.name,
       CASE WHEN bool_or(p."Code" = 'ip.safety_token.print') THEN 'PASS' ELSE 'FAIL' END AS has_print
FROM (VALUES
  ('NURSE'),('IP COORDINATOR'),('ADMIN')
) AS v(name)
LEFT JOIN app_roles r ON upper(coalesce(r."NormalizedName", r.name, '')) = v.name
LEFT JOIN role_permission rp ON rp."RoleId" = r.id
LEFT JOIN permissions p ON p.id = rp."PermissionId"
GROUP BY v.name
ORDER BY has_print, v.name;

\echo
\echo ===== 3. SURGEON must NOT have print (not in A5 bundle)
SELECT r.name,
       bool_or(p."Code" = 'ip.safety_token.print') AS has_print
FROM app_roles r
JOIN role_permission rp ON rp."RoleId" = r.id
JOIN permissions p ON p.id = rp."PermissionId"
WHERE upper(coalesce(r."NormalizedName", r.name, '')) = 'SURGEON'
GROUP BY r.name;
