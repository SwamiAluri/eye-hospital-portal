-- Verify 159_charge_catalog_mapping.sql (MD-055).

\echo '=== 159 service_variant_item_map ==='
SELECT
  CASE WHEN COUNT(*) = 1 THEN 'PASS' ELSE 'FAIL' END AS item_map
FROM information_schema.tables
WHERE table_schema = 'public' AND table_name = 'service_variant_item_map';

\echo '=== 159 charge_exception ==='
SELECT
  CASE WHEN COUNT(*) = 1 THEN 'PASS' ELSE 'FAIL' END AS charge_exception
FROM information_schema.tables
WHERE table_schema = 'public' AND table_name = 'charge_exception';

\echo '=== 159 package_component_map ==='
SELECT
  CASE WHEN COUNT(*) = 1 THEN 'PASS' ELSE 'FAIL' END AS package_component_map
FROM information_schema.tables
WHERE table_schema = 'public' AND table_name = 'package_component_map';

\echo '=== 159 active mapping unique index ==='
SELECT
  CASE WHEN COUNT(*) = 1 THEN 'PASS' ELSE 'FAIL' END AS item_map_active_index
FROM pg_indexes
WHERE schemaname = 'public' AND indexname = 'ux_sv_item_map_active';
