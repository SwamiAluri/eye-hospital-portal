-- =====================================================
-- Day 5: Bill Locking Mechanism
-- Date: January 31, 2026
-- Description: Add bill locking capability to prevent modifications after finalization
-- =====================================================

-- Add is_locked column to opd_bills table
ALTER TABLE opd_bills
ADD COLUMN IF NOT EXISTS is_locked BOOLEAN DEFAULT FALSE NOT NULL;

-- Add locked_at timestamp to track when bill was locked
ALTER TABLE opd_bills
ADD COLUMN IF NOT EXISTS locked_at TIMESTAMP WITH TIME ZONE;

-- Add locked_by_user_id to track who locked the bill
ALTER TABLE opd_bills
ADD COLUMN IF NOT EXISTS locked_by_user_id UUID;

-- Add unlock_reason for audit trail when bills are unlocked
ALTER TABLE opd_bills
ADD COLUMN IF NOT EXISTS unlock_reason TEXT;

-- Add unlocked_at timestamp
ALTER TABLE opd_bills
ADD COLUMN IF NOT EXISTS unlocked_at TIMESTAMP WITH TIME ZONE;

-- Add unlocked_by_user_id
ALTER TABLE opd_bills
ADD COLUMN IF NOT EXISTS unlocked_by_user_id UUID;

-- Create index on is_locked for faster queries
CREATE INDEX IF NOT EXISTS idx_opd_bills_is_locked ON opd_bills(is_locked);

-- Create index on locked_at for audit queries
CREATE INDEX IF NOT EXISTS idx_opd_bills_locked_at ON opd_bills(locked_at);

-- Add foreign key constraint for locked_by_user_id
ALTER TABLE opd_bills
DROP CONSTRAINT IF EXISTS fk_opd_bills_locked_by_user;

ALTER TABLE opd_bills
ADD CONSTRAINT fk_opd_bills_locked_by_user
FOREIGN KEY (locked_by_user_id) REFERENCES "AspNetUsers"(id);

-- Add foreign key constraint for unlocked_by_user_id
ALTER TABLE opd_bills
DROP CONSTRAINT IF EXISTS fk_opd_bills_unlocked_by_user;

ALTER TABLE opd_bills
ADD CONSTRAINT fk_opd_bills_unlocked_by_user
FOREIGN KEY (unlocked_by_user_id) REFERENCES "AspNetUsers"(id);

-- Add comment on is_locked column
COMMENT ON COLUMN opd_bills.is_locked IS 'Bill is locked after finalization/payment to prevent modifications';

-- Add comment on locked_at column
COMMENT ON COLUMN opd_bills.locked_at IS 'Timestamp when bill was locked';

-- Add comment on locked_by_user_id column
COMMENT ON COLUMN opd_bills.locked_by_user_id IS 'User who locked the bill';

-- Add comment on unlock_reason column
COMMENT ON COLUMN opd_bills.unlock_reason IS 'Reason for unlocking a finalized bill (audit trail)';

-- Add comment on unlocked_at column
COMMENT ON COLUMN opd_bills.unlocked_at IS 'Timestamp when bill was last unlocked';

-- Add comment on unlocked_by_user_id column
COMMENT ON COLUMN opd_bills.unlocked_by_user_id IS 'User who unlocked the bill (requires admin permission)';

-- Lock/unlock audit is application `audit_log` (BillLocked / BillUnlocked).
-- Do not INSERT into `audit_logs` — that relation does not exist (migration 179).
CREATE OR REPLACE FUNCTION audit_bill_lock_unlock()
RETURNS TRIGGER AS $$
BEGIN
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop existing trigger if exists
DROP TRIGGER IF EXISTS audit_bill_lock_unlock_trigger ON opd_bills;

-- Create trigger for audit logging
CREATE TRIGGER audit_bill_lock_unlock_trigger
AFTER UPDATE ON opd_bills
FOR EACH ROW
WHEN (OLD.is_locked IS DISTINCT FROM NEW.is_locked)
EXECUTE FUNCTION audit_bill_lock_unlock();

-- Grant permissions
GRANT SELECT, UPDATE ON opd_bills TO rls_user;

-- Migration complete
SELECT 'Bill locking mechanism migration completed successfully' AS status;
