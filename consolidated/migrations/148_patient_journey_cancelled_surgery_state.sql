-- ============================================================================
-- Migration 148: Add CancelledSurgery clinical state (Phase 1 — Ward dashboard)
-- Purpose: Promote ward cancel-today from a silent revert-to-Expected annotation
--          to an explicit off-ramp state. A cancelled surgical case parks in
--          'CancelledSurgery' and only exits via Rebook → Expected.
-- Forward graph (Expected → … → Discharged) is unchanged.
-- Dependencies: patient_journey (81), clinical_state CHECK (97),
--               cancel annotations (143)
-- ============================================================================

BEGIN;

ALTER TABLE patient_journey
    DROP CONSTRAINT IF EXISTS patient_journey_clinical_state_check;

ALTER TABLE patient_journey
    ADD CONSTRAINT patient_journey_clinical_state_check
    CHECK (clinical_state IN (
        'Expected',
        'Admitted',
        'ReadyForSurgery',
        'SentToOT',
        'InOT',
        'SurgeryCompleted',
        'PostOp',
        'ReadyForDischarge',
        'Discharged',
        'CancelledSurgery'
    ));

COMMENT ON COLUMN patient_journey.clinical_state IS
    'RLS-protected state machine: Expected → Admitted → ReadyForSurgery → SentToOT → InOT → SurgeryCompleted → PostOp → ReadyForDischarge → Discharged. '
    'CancelledSurgery is an off-ramp branch (cancel-today): entered from Expected/Admitted/ReadyForSurgery/SentToOT, single exit Rebook → Expected.';

COMMIT;
