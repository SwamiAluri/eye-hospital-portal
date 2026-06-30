-- Add idempotency key for policy OCR confirm (G18) — PostgreSQL
ALTER TABLE ccms_policy_extraction_audit_logs
    ADD COLUMN IF NOT EXISTS idempotency_key VARCHAR(200);

CREATE INDEX IF NOT EXISTS idx_ccms_policy_extraction_audit_idempotency
    ON ccms_policy_extraction_audit_logs (idempotency_key)
    WHERE idempotency_key IS NOT NULL;
