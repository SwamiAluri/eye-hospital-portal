-- ============================================================================
-- Migration 143: Cancel-today surgery annotations on patient_journey (G1)
-- Purpose: Ward cancel workflow — audit fields without new clinical states
-- Dependencies: patient_journey (81)
-- ============================================================================

BEGIN;

ALTER TABLE patient_journey
    ADD COLUMN IF NOT EXISTS surgery_cancelled_at   TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS surgery_cancel_reason  TEXT,
    ADD COLUMN IF NOT EXISTS pending_rebook         BOOLEAN NOT NULL DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS cancelled_from_state   VARCHAR(30);

COMMENT ON COLUMN patient_journey.surgery_cancelled_at IS
    'Timestamp when ward cancelled today''s surgery (revert to Expected).';
COMMENT ON COLUMN patient_journey.surgery_cancel_reason IS
    'Required free-text reason for cancel-today surgery.';
COMMENT ON COLUMN patient_journey.pending_rebook IS
    'True until counselling sets a new surgery date (rebook badge).';
COMMENT ON COLUMN patient_journey.cancelled_from_state IS
    'Clinical state before cancel-today (audit).';

CREATE INDEX IF NOT EXISTS idx_pj_pending_rebook
    ON patient_journey (pending_rebook)
    WHERE pending_rebook = TRUE AND deleted_at IS NULL;

COMMIT;
