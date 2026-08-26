-- ============================================================================
-- Migration 154: Phase 8 audit columns, list indexes, one-open bed history
-- ============================================================================

BEGIN;

ALTER TABLE journey_audit_log
    ADD COLUMN IF NOT EXISTS notes text,
    ADD COLUMN IF NOT EXISTS correlation_id uuid;

CREATE INDEX IF NOT EXISTS idx_jal_correlation
    ON journey_audit_log (correlation_id)
    WHERE correlation_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS ix_patient_journey_dashboard
    ON patient_journey (tenant_id, branch_id, clinical_state, surgery_scheduled_at)
    WHERE deleted_at IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS ux_journey_bed_assignment_one_open
    ON journey_bed_assignment (patient_journey_id)
    WHERE ended_at IS NULL AND deleted_at IS NULL;

COMMENT ON COLUMN journey_audit_log.notes IS
    'Human reason / documentation for the audited action.';
COMMENT ON COLUMN journey_audit_log.correlation_id IS
    'Stable reference (usually patient_journey.id) for cross-module tracing.';

COMMIT;
