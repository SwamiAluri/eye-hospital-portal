-- Verify 161_inv_surgery_consumable_journey_charge.sql (INV-050).

\echo '=== 161 journey_id column ==='
SELECT
  CASE WHEN COUNT(*) = 1 THEN 'PASS' ELSE 'FAIL' END AS journey_col
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'inv_surgery_consumables' AND column_name = 'journey_id';

\echo '=== 161 charge_status column ==='
SELECT
  CASE WHEN COUNT(*) = 1 THEN 'PASS' ELSE 'FAIL' END AS charge_status_col
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'inv_surgery_consumables' AND column_name = 'charge_status';

\echo '=== 161 charge_item_id column ==='
SELECT
  CASE WHEN COUNT(*) = 1 THEN 'PASS' ELSE 'FAIL' END AS charge_item_col
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'inv_surgery_consumables' AND column_name = 'charge_item_id';

\echo '=== 161 journey index ==='
SELECT
  CASE WHEN COUNT(*) = 1 THEN 'PASS' ELSE 'FAIL' END AS journey_index
FROM pg_indexes
WHERE schemaname = 'public' AND indexname = 'ix_inv_surgery_consumables_journey';
