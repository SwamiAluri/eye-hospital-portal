-- Verify 166_journey_slot.sql (IP-013). Read-only.

\pset pager off

\echo '=== 166 journey_slot table ==='
SELECT
  CASE WHEN COUNT(*) = 1 THEN 'PASS' ELSE 'FAIL' END AS journey_slot_table
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name = 'journey_slot';

\echo '=== 166 patient_journey.slot_id ==='
SELECT
  CASE WHEN COUNT(*) = 1 THEN 'PASS' ELSE 'FAIL' END AS slot_id_col
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'patient_journey'
  AND column_name = 'slot_id';

\echo '=== 166 slot_id FK ==='
SELECT
  CASE WHEN COUNT(*) = 1 THEN 'PASS' ELSE 'FAIL' END AS slot_id_fk
FROM pg_constraint
WHERE conname = 'patient_journey_slot_id_fkey';

\echo '=== 166 filtered unique sequence ==='
SELECT
  CASE WHEN COUNT(*) = 1 THEN 'PASS' ELSE 'FAIL' END AS unique_seq
FROM pg_indexes
WHERE schemaname = 'public'
  AND indexname = 'ux_journey_slot_theatre_session_seq';

\echo '=== 166 date/session index ==='
SELECT
  CASE WHEN COUNT(*) = 1 THEN 'PASS' ELSE 'FAIL' END AS date_session_idx
FROM pg_indexes
WHERE schemaname = 'public'
  AND indexname = 'idx_journey_slot_tenant_date_session';

\echo '=== 166 session CHECK ==='
SELECT
  CASE
    WHEN COUNT(*) = 1
     AND bool_and(pg_get_constraintdef(oid) LIKE '%Morning%')
     AND bool_and(pg_get_constraintdef(oid) LIKE '%Afternoon%')
     AND bool_and(pg_get_constraintdef(oid) LIKE '%Evening%')
    THEN 'PASS' ELSE 'FAIL'
  END AS session_check
FROM pg_constraint
WHERE conname = 'journey_slot_session_check';
