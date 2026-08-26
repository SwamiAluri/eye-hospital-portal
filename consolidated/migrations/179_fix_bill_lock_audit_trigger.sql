-- =============================================================================
-- 179_fix_bill_lock_audit_trigger.sql
-- STEP 17-D1-LIVE — bill lock trigger wrote to missing table `audit_logs`.
--
-- Live `/lock` after a paid IP bill failed with:
--   Postgres 42P01: relation "audit_logs" does not exist
--   PL/pgSQL function audit_bill_lock_unlock() (trigger audit_bill_lock_unlock_trigger)
--
-- Canonical application audit is `audit_log` via OpdBillService.StageFinancialAuditAsync
-- (BillLocked / BillUnlocked). `/finalize` never hit this trigger because it does not
-- change is_locked.
--
-- Do not create a second `audit_logs` table. Replace the trigger function with a
-- no-op so lock/unlock can persist. Application audit_log remains SoT.
-- Idempotent.
-- =============================================================================

BEGIN;

CREATE OR REPLACE FUNCTION audit_bill_lock_unlock()
RETURNS TRIGGER AS $$
BEGIN
    -- Legacy trigger body inserted into audit_logs (does not exist).
    -- Lock/unlock audit is written by Auth OpdBillService to audit_log.
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION audit_bill_lock_unlock() IS
    '179: no-op. Bill lock/unlock audit is application audit_log (BillLocked/BillUnlocked), not audit_logs.';

DROP TRIGGER IF EXISTS audit_bill_lock_unlock_trigger ON opd_bills;

CREATE TRIGGER audit_bill_lock_unlock_trigger
AFTER UPDATE ON opd_bills
FOR EACH ROW
WHEN (OLD.is_locked IS DISTINCT FROM NEW.is_locked)
EXECUTE FUNCTION audit_bill_lock_unlock();

COMMIT;
