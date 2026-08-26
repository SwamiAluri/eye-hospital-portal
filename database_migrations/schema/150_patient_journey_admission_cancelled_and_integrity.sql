-- ============================================================================
-- Migration 150: AdmissionCancelled clinical state + journey occupancy integrity
-- Purpose:
--   1. Allow Expected → AdmissionCancelled (pre-clinical admission cancel).
--   2. Keep Auth bed_inventory as occupancy SoT; IP only stores assigned_bed_id.
-- Forward clinical graph is unchanged. CancelledSurgery remains the surgery
-- cancel-today off-ramp.
-- Dependencies: 148_patient_journey_cancelled_surgery_state.sql
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
        'CancelledSurgery',
        'AdmissionCancelled'
    ));

COMMENT ON COLUMN patient_journey.clinical_state IS
    'Clinical SoT: Expected → Admitted → ReadyForSurgery → SentToOT → InOT → SurgeryCompleted → PostOp → ReadyForDischarge → Discharged. '
    'Off-ramps: CancelledSurgery (cancel-today; rebook → Expected) and AdmissionCancelled (Expected only; terminal). '
    'Bed occupancy SoT remains Auth bed_inventory; assigned_bed_id is a pointer only.';

COMMIT;
