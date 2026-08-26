-- Verify 160_journey_implant_usage.sql (OT-020).

\echo '=== 160 journey_implant_usage table ==='
SELECT
  CASE WHEN COUNT(*) = 1 THEN 'PASS' ELSE 'FAIL' END AS implant_table
FROM information_schema.tables
WHERE table_schema = 'public' AND table_name = 'journey_implant_usage';

\echo '=== 160 unique implanted serial index ==='
SELECT
  CASE WHEN COUNT(*) = 1 THEN 'PASS' ELSE 'FAIL' END AS serial_unique
FROM pg_indexes
WHERE schemaname = 'public' AND indexname = 'ux_journey_implant_serial_implanted';

\echo '=== 160 journey index ==='
SELECT
  CASE WHEN COUNT(*) = 1 THEN 'PASS' ELSE 'FAIL' END AS journey_index
FROM pg_indexes
WHERE schemaname = 'public' AND indexname = 'ix_journey_implant_usage_journey';

\echo '=== 160 udi index ==='
SELECT
  CASE WHEN COUNT(*) = 1 THEN 'PASS' ELSE 'FAIL' END AS udi_index
FROM pg_indexes
WHERE schemaname = 'public' AND indexname = 'ix_journey_implant_usage_udi';
