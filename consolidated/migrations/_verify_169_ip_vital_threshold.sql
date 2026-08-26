-- =============================================================================
-- _verify_169_ip_vital_threshold.sql
-- Read-only checks for W-06 A4 / migration 169.
-- =============================================================================

\pset pager off

\echo
\echo ===== 1. Table exists
SELECT CASE WHEN COUNT(*) = 1 THEN 'PASS' ELSE 'FAIL' END AS ip_vital_threshold_table
FROM information_schema.tables
WHERE table_schema = 'public' AND table_name = 'ip_vital_threshold';

\echo
\echo ===== 2. Unique tenant_id
SELECT CASE WHEN COUNT(*) = 1 THEN 'PASS' ELSE 'FAIL' END AS tenant_unique
FROM pg_indexes
WHERE schemaname = 'public'
  AND tablename = 'ip_vital_threshold'
  AND indexdef ILIKE '%UNIQUE%'
  AND indexdef ILIKE '%tenant_id%';

\echo
\echo ===== 3. severity check allows warn/block
SELECT CASE WHEN COUNT(*) >= 1 THEN 'PASS' ELSE 'FAIL' END AS severity_check
FROM pg_constraint
WHERE conrelid = 'ip_vital_threshold'::regclass
  AND contype = 'c'
  AND pg_get_constraintdef(oid) ILIKE '%warn%';

\echo
\echo ===== 4. Default seed row for journeys
SELECT CASE WHEN COUNT(*) >= 1 THEN 'PASS' ELSE 'WARN - no journey tenants yet; in-code defaults apply' END AS seeded
FROM ip_vital_threshold;
