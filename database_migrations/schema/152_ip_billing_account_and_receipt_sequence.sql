-- ============================================================================
-- Migration 152: IP billing account on OpdBill + append-only receipt sequence
-- Financial SoT remains opd_bills / opd_bill_payments / refunds.
-- IP patient_journey.opd_bill_id is a pointer. ip_billing_transactions is
-- historical / mapping only — do not delete.
-- ============================================================================

BEGIN;

ALTER TABLE opd_bills
    ALTER COLUMN appointment_id DROP NOT NULL;

ALTER TABLE opd_bills
    ADD COLUMN IF NOT EXISTS patient_journey_id uuid;

CREATE UNIQUE INDEX IF NOT EXISTS ux_opd_bills_patient_journey
    ON opd_bills (tenant_id, patient_journey_id)
    WHERE patient_journey_id IS NOT NULL AND deleted_at IS NULL;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'opd_bills_encounter_check'
    ) THEN
        ALTER TABLE opd_bills
            ADD CONSTRAINT opd_bills_encounter_check
            CHECK (appointment_id IS NOT NULL OR patient_journey_id IS NOT NULL);
    END IF;
END $$;

ALTER TABLE opd_bill_payments
    ADD COLUMN IF NOT EXISTS payment_kind varchar(20) NOT NULL DEFAULT 'Payment',
    ADD COLUMN IF NOT EXISTS reversed_payment_id uuid,
    ADD COLUMN IF NOT EXISTS idempotency_key varchar(80);

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'opd_bill_payments_kind_check'
    ) THEN
        ALTER TABLE opd_bill_payments
            ADD CONSTRAINT opd_bill_payments_kind_check
            CHECK (payment_kind IN ('Payment', 'Advance', 'Discount', 'Refund', 'Reversal'));
    END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS ux_opd_bill_payments_idempotency
    ON opd_bill_payments (tenant_id, idempotency_key)
    WHERE idempotency_key IS NOT NULL;

CREATE SEQUENCE IF NOT EXISTS opd_receipt_number_seq START WITH 1 INCREMENT BY 1;
CREATE SEQUENCE IF NOT EXISTS opd_bill_number_seq START WITH 1 INCREMENT BY 1;

CREATE UNIQUE INDEX IF NOT EXISTS ux_opd_bill_payments_receipt
    ON opd_bill_payments (tenant_id, receipt_number)
    WHERE receipt_number IS NOT NULL;

ALTER TABLE patient_journey
    ADD COLUMN IF NOT EXISTS opd_bill_id uuid;

CREATE INDEX IF NOT EXISTS ix_patient_journey_opd_bill
    ON patient_journey (opd_bill_id)
    WHERE opd_bill_id IS NOT NULL AND deleted_at IS NULL;

ALTER TABLE ip_billing_transactions
    ADD COLUMN IF NOT EXISTS opd_bill_id uuid,
    ADD COLUMN IF NOT EXISTS opd_bill_payment_id uuid,
    ADD COLUMN IF NOT EXISTS mapping_status varchar(30) NOT NULL DEFAULT 'unmapped';

COMMENT ON COLUMN opd_bills.patient_journey_id IS
    'Inpatient encounter association. One open OpdBill per journey. PatientId alone is not an IP account.';
COMMENT ON COLUMN patient_journey.opd_bill_id IS
    'Pointer to Billing OpdBill. Not a ledger.';
COMMENT ON COLUMN ip_billing_transactions.mapping_status IS
    'Cutover: unmapped | mapped | unmatched | duplicate | needs_review. Rows are retained.';

-- Reconciliation (read-only). Unmapped IP rows that cannot auto-map.
CREATE OR REPLACE VIEW v_ip_billing_cutover_recon AS
SELECT
    t.id                    AS ip_transaction_id,
    t.patient_journey_id,
    t.tenant_id,
    t.transaction_type,
    t.amount,
    t.receipt_number        AS ip_receipt_number,
    t.created_at,
    t.mapping_status,
    t.opd_bill_id,
    t.opd_bill_payment_id,
    j.patient_id,
    j.opd_bill_id           AS journey_opd_bill_id
FROM ip_billing_transactions t
LEFT JOIN patient_journey j ON j.id = t.patient_journey_id
WHERE t.deleted_at IS NULL
  AND t.mapping_status IS DISTINCT FROM 'mapped';

COMMIT;
