-- Verify 164_outbox_versioned_schema.sql (DB-005). Read-only.

\pset pager off

\echo '=== 164 integration_outbox_event table ==='
SELECT
  CASE WHEN COUNT(*) = 1 THEN 'PASS' ELSE 'FAIL' END AS ip_outbox_table
FROM information_schema.tables
WHERE table_schema = 'public' AND table_name = 'integration_outbox_event';

\echo '=== 164 billing_ccms_outbox table ==='
SELECT
  CASE WHEN COUNT(*) = 1 THEN 'PASS' ELSE 'FAIL' END AS billing_outbox_table
FROM information_schema.tables
WHERE table_schema = 'public' AND table_name = 'billing_ccms_outbox';

\echo '=== 164 IP outbox required columns ==='
SELECT
  CASE WHEN COUNT(*) = 20 THEN 'PASS' ELSE 'FAIL' END AS ip_outbox_cols
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'integration_outbox_event'
  AND column_name IN (
    'id','tenant_id','event_type','aggregate_type','aggregate_id','correlation_id',
    'payload_json','idempotency_key','occurred_at','status','retry_count',
    'last_attempt_at','processed_at','error','abandon_reason','compensating_action',
    'abandoned_at','abandoned_by_user_id','created_at','updated_at'
  );

\echo '=== 164 billing outbox required columns ==='
SELECT
  CASE WHEN COUNT(*) = 20 THEN 'PASS' ELSE 'FAIL' END AS billing_outbox_cols
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'billing_ccms_outbox'
  AND column_name IN (
    'id','tenant_id','event_type','aggregate_type','aggregate_id','correlation_id',
    'payload_json','idempotency_key','occurred_at','status','retry_count',
    'last_attempt_at','processed_at','error','abandon_reason','compensating_action',
    'abandoned_at','abandoned_by_user_id','created_at','updated_at'
  );

\echo '=== 164 unique idempotency indexes ==='
SELECT
  CASE WHEN COUNT(*) = 2 THEN 'PASS' ELSE 'FAIL' END AS outbox_ux
FROM pg_indexes
WHERE schemaname = 'public'
  AND indexname IN (
    'ux_integration_outbox_idempotency',
    'ux_billing_ccms_outbox_idempotency'
  );

\echo '=== 164 pending indexes ==='
SELECT
  CASE WHEN COUNT(*) = 2 THEN 'PASS' ELSE 'FAIL' END AS outbox_pending_ix
FROM pg_indexes
WHERE schemaname = 'public'
  AND indexname IN (
    'ix_integration_outbox_pending',
    'ix_billing_ccms_outbox_pending'
  );
