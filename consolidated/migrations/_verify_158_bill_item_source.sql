-- Verify 158_bill_item_source_and_row_version.sql (BILL-030).
-- psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f consolidated/migrations/_verify_158_bill_item_source.sql

\echo '=== 158 opd_bill_items source columns ==='
SELECT
  CASE WHEN COUNT(*) FILTER (WHERE column_name = 'source_type') = 1
        AND COUNT(*) FILTER (WHERE column_name = 'source_ref_id') = 1
        AND COUNT(*) FILTER (WHERE column_name = 'idempotency_key') = 1
       THEN 'PASS' ELSE 'FAIL' END AS item_source_columns
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'opd_bill_items'
  AND column_name IN ('source_type', 'source_ref_id', 'idempotency_key');

\echo '=== 158 opd_bills.row_version ==='
SELECT
  CASE WHEN COUNT(*) = 1 THEN 'PASS' ELSE 'FAIL' END AS bill_row_version
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'opd_bills'
  AND column_name = 'row_version';

\echo '=== 158 idempotency unique index ==='
SELECT
  CASE WHEN COUNT(*) = 1 THEN 'PASS' ELSE 'FAIL' END AS item_idempotency_index
FROM pg_indexes
WHERE schemaname = 'public'
  AND indexname = 'ux_opd_bill_items_idempotency';

\echo '=== 158 service_variant_id nullable ==='
SELECT
  CASE WHEN COUNT(*) FILTER (WHERE column_name = 'service_variant_id' AND is_nullable = 'YES') = 1
       THEN 'PASS' ELSE 'FAIL' END AS variant_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'opd_bill_items'
  AND column_name = 'service_variant_id';
