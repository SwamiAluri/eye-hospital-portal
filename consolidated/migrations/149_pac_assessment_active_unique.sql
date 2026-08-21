-- ============================================================================
-- Migration 149: PAC / monitoring active-row unique indexes
-- Fixes soft-delete + UNIQUE(patient_journey_id) conflict that caused
-- "Sequence contains no elements" on PAC save (GetOrInit insert/catch path).
-- Dependencies: 138_s4_pac_anaesthesia_monitoring.sql
-- ============================================================================

BEGIN;

ALTER TABLE pac_assessment
    DROP CONSTRAINT IF EXISTS uq_pac_assessment_journey;

CREATE UNIQUE INDEX IF NOT EXISTS uq_pac_assessment_journey_active
    ON pac_assessment (patient_journey_id)
    WHERE deleted_at IS NULL;

ALTER TABLE anaesthesia_monitoring
    DROP CONSTRAINT IF EXISTS uq_anaesthesia_monitoring_journey;

CREATE UNIQUE INDEX IF NOT EXISTS uq_anaesthesia_monitoring_journey_active
    ON anaesthesia_monitoring (patient_journey_id)
    WHERE deleted_at IS NULL;

COMMIT;
