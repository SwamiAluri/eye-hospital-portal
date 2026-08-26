-- Verify 162_ccms_collection_settlement_projection.sql (CCMS-060).

\echo '=== 162 collection projections table ==='
SELECT
  CASE WHEN COUNT(*) = 1 THEN 'PASS' ELSE 'FAIL' END AS projections_table
FROM information_schema.tables
WHERE table_schema = 'public' AND table_name = 'ccms_collection_projections';

\echo '=== 162 collection events table ==='
SELECT
  CASE WHEN COUNT(*) = 1 THEN 'PASS' ELSE 'FAIL' END AS events_table
FROM information_schema.tables
WHERE table_schema = 'public' AND table_name = 'ccms_collection_events';

\echo '=== 162 unique case projection ==='
SELECT
  CASE WHEN COUNT(*) = 1 THEN 'PASS' ELSE 'FAIL' END AS projection_unique
FROM pg_indexes
WHERE schemaname = 'public' AND indexname = 'ux_ccms_collection_projection_case';

\echo '=== 162 unique event source ==='
SELECT
  CASE WHEN COUNT(*) = 1 THEN 'PASS' ELSE 'FAIL' END AS event_source_unique
FROM pg_indexes
WHERE schemaname = 'public' AND indexname = 'ux_ccms_collection_event_source';

\echo '=== 162 PARTIAL_SETTLEMENT FULL_PAYMENT transition ==='
SELECT
  CASE WHEN COUNT(*) >= 1 THEN 'PASS' ELSE 'FAIL' END AS partial_to_full
FROM ccms_workflow_transitions t
JOIN ccms_workflow_states fs ON fs.id = t.from_state_id
JOIN ccms_workflow_states ts ON ts.id = t.to_state_id
WHERE fs.state_code = 'PARTIAL_SETTLEMENT'
  AND ts.state_code = 'FULL_SETTLEMENT'
  AND t.trigger_event = 'FULL_PAYMENT'
  AND t.deleted_at IS NULL;
