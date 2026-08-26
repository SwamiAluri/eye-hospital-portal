-- =============================================================================
-- _verify_179_fix_bill_lock_audit_trigger.sql
-- =============================================================================

\echo '=== 179 trigger function must not reference audit_logs ==='
SELECT pg_get_functiondef('audit_bill_lock_unlock()'::regprocedure) AS def;

\echo '=== 179 trigger exists on opd_bills ==='
SELECT tgname, tgenabled
FROM pg_trigger
WHERE tgrelid = 'opd_bills'::regclass
  AND tgname = 'audit_bill_lock_unlock_trigger';
