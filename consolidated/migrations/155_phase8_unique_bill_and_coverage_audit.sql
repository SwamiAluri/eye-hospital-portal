-- ============================================================================
-- Migration 155: Phase 8 uniqueness + coverage audit columns
-- Safe to re-run. Dedupes duplicate IP OpdBills before the unique index.
-- ============================================================================

BEGIN;

-- Keep one active bill per journey: prefer finalized, then newest.
WITH ranked AS (
    SELECT id,
           ROW_NUMBER() OVER (
               PARTITION BY patient_journey_id
               ORDER BY
                   CASE WHEN COALESCE(is_finalized, false) THEN 0 ELSE 1 END,
                   COALESCE(finalized_at, created_at) DESC NULLS LAST,
                   created_at DESC,
                   id
           ) AS rn
    FROM opd_bills
    WHERE patient_journey_id IS NOT NULL
      AND deleted_at IS NULL
)
UPDATE opd_bills b
SET deleted_at = NOW(),
    updated_at = NOW(),
    notes = LEFT(
        CONCAT(COALESCE(b.notes, ''), ' [soft-deleted duplicate journey bill]'),
        2000)
FROM ranked r
WHERE b.id = r.id
  AND r.rn > 1;

-- Close extra open bed-history rows so 154 unique index can exist
WITH open_ranked AS (
    SELECT id,
           ROW_NUMBER() OVER (
               PARTITION BY patient_journey_id
               ORDER BY started_at DESC NULLS LAST, created_at DESC, id
           ) AS rn
    FROM journey_bed_assignment
    WHERE ended_at IS NULL
      AND deleted_at IS NULL
)
UPDATE journey_bed_assignment a
SET ended_at = NOW(),
    updated_at = NOW(),
    reason = LEFT(CONCAT(COALESCE(a.reason, ''), ' [closed duplicate open assignment]'), 500)
FROM open_ranked r
WHERE a.id = r.id
  AND r.rn > 1;

CREATE UNIQUE INDEX IF NOT EXISTS ux_opd_bills_patient_journey
    ON opd_bills (patient_journey_id)
    WHERE patient_journey_id IS NOT NULL AND deleted_at IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS ux_opd_bill_payments_idempotency
    ON opd_bill_payments (tenant_id, idempotency_key)
    WHERE idempotency_key IS NOT NULL AND length(btrim(idempotency_key)) > 0;

CREATE UNIQUE INDEX IF NOT EXISTS ux_journey_bed_assignment_one_open
    ON journey_bed_assignment (patient_journey_id)
    WHERE ended_at IS NULL AND deleted_at IS NULL;

ALTER TABLE ccms_approval_events
    ADD COLUMN IF NOT EXISTS previous_state varchar(80),
    ADD COLUMN IF NOT EXISTS correlation_id uuid;

CREATE INDEX IF NOT EXISTS ix_ccms_approval_events_correlation
    ON ccms_approval_events (correlation_id)
    WHERE correlation_id IS NOT NULL;

COMMIT;
