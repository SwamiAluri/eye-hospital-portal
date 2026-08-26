-- ============================================================================
-- Migration 153: map historical IP billing rows onto OpdBill payments (append-only)
-- and add a payment-reference sequence. Do not delete ip_billing_transactions.
-- Unmapped rows without a journey OpdBill remain in v_ip_billing_cutover_recon.
-- ============================================================================

BEGIN;

CREATE SEQUENCE IF NOT EXISTS opd_payment_reference_seq START WITH 1 INCREMENT BY 1;

INSERT INTO opd_bill_payments (
    id,
    tenant_id,
    opd_bill_id,
    payment_reference,
    payment_mode,
    amount,
    payment_date,
    receipt_number,
    payment_kind,
    idempotency_key,
    status,
    created_at,
    created_by_user_id
)
SELECT
    gen_random_uuid(),
    t.tenant_id,
    j.opd_bill_id,
    'IPMAP-' || replace(t.id::text, '-', ''),
    COALESCE(NULLIF(btrim(t.payment_mode), ''), 'cash'),
    t.amount,
    COALESCE(t.created_at, now()),
    NULL,
    CASE lower(COALESCE(t.transaction_type, ''))
        WHEN 'advance' THEN 'Advance'
        WHEN 'discount' THEN 'Discount'
        WHEN 'refund' THEN 'Refund'
        WHEN 'reversal' THEN 'Reversal'
        ELSE 'Payment'
    END,
    'ip-cutover:' || t.id::text,
    'completed',
    COALESCE(t.created_at, now()),
    COALESCE(t.created_by_user_id, '00000000-0000-0000-0000-000000000001')
FROM ip_billing_transactions t
JOIN patient_journey j ON j.id = t.patient_journey_id
WHERE t.deleted_at IS NULL
  AND t.opd_bill_payment_id IS NULL
  AND COALESCE(t.mapping_status, 'unmapped') IN ('unmapped', 'pending_map')
  AND j.opd_bill_id IS NOT NULL
  AND NOT EXISTS (
      SELECT 1 FROM opd_bill_payments p
      WHERE p.idempotency_key = 'ip-cutover:' || t.id::text
  );

UPDATE ip_billing_transactions t
SET mapping_status = 'mapped',
    opd_bill_id = p.opd_bill_id,
    opd_bill_payment_id = p.id
FROM opd_bill_payments p
WHERE p.idempotency_key = 'ip-cutover:' || t.id::text
  AND COALESCE(t.mapping_status, 'unmapped') IS DISTINCT FROM 'mapped';

UPDATE ip_billing_transactions t
SET mapping_status = 'unmatched'
WHERE t.deleted_at IS NULL
  AND t.opd_bill_payment_id IS NULL
  AND COALESCE(t.mapping_status, 'unmapped') = 'unmapped'
  AND NOT EXISTS (
      SELECT 1 FROM patient_journey j
      WHERE j.id = t.patient_journey_id
        AND j.opd_bill_id IS NOT NULL
  );

COMMIT;
