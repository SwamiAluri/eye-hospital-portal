-- =============================================================================
-- _verify_168_journey_safety_token.sql
-- Verification for W-05 A5 / migration 168. Read-only.
-- =============================================================================

\pset pager off

\echo
\echo ===== 1. journey_safety_token exists
SELECT CASE WHEN to_regclass('public.journey_safety_token') IS NULL
            THEN 'FAIL - missing table'
            ELSE 'PASS' END AS status;

\echo
\echo ===== 2. Unique active + token_code indexes
SELECT indexname,
       CASE WHEN indexdef ILIKE '%UNIQUE%' THEN 'PASS unique' ELSE 'FAIL' END AS status
FROM pg_indexes
WHERE tablename = 'journey_safety_token'
  AND indexname IN ('ux_journey_safety_token_active', 'ux_journey_safety_token_code')
ORDER BY indexname;
