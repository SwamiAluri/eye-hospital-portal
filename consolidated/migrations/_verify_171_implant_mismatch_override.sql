-- =============================================================================
-- _verify_171_implant_mismatch_override.sql
-- Verification for W-07 A2 / migration 171. Read-only.
--
--   psql "$DATABASE_URL" -f consolidated/migrations/_verify_171_implant_mismatch_override.sql
-- =============================================================================

\pset pager off

\echo
\echo ===== 1. Permission code exists
SELECT v.code,
       CASE WHEN p.id IS NULL THEN 'FAIL - missing' ELSE 'PASS' END AS status
FROM (VALUES
  ('ip.implant.mismatch.override')
) AS v(code)
LEFT JOIN permissions p
  ON p."Code" = v.code AND p."TenantId" = '00000000-0000-0000-0000-000000000000'
ORDER BY status, v.code;

\echo
\echo ===== 2. SURGEON / OT COORDINATOR / ADMIN have the override
SELECT v.name,
       CASE WHEN bool_or(p."Code" = 'ip.implant.mismatch.override') THEN 'PASS' ELSE 'FAIL' END AS has_override
FROM (VALUES
  ('SURGEON'),('OT COORDINATOR'),('ADMIN')
) AS v(name)
LEFT JOIN app_roles r ON upper(coalesce(r."NormalizedName", r.name, '')) = v.name
LEFT JOIN role_permission rp ON rp."RoleId" = r.id
LEFT JOIN permissions p ON p.id = rp."PermissionId"
GROUP BY v.name
ORDER BY has_override, v.name;

\echo
\echo ===== 3. NURSE must NOT have the override
SELECT r.name,
       bool_or(p."Code" = 'ip.implant.mismatch.override') AS has_override
FROM app_roles r
JOIN role_permission rp ON rp."RoleId" = r.id
JOIN permissions p ON p.id = rp."PermissionId"
WHERE upper(coalesce(r."NormalizedName", r.name, '')) = 'NURSE'
GROUP BY r.name;
