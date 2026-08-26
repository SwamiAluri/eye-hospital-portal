-- =============================================================================
-- 174_post_op_taper_step.sql
-- W-08 B1 — structured eyedrop taper (FR-6.2).
-- Blueprint numbered this 170; 171–173 already shipped, so this is 174.
--
-- Free-text post_op_instructions.medications remains optional notes.
-- Active plan is rows with deleted_at IS NULL. Replace-all PUT soft-deletes
-- the previous active set (history) and inserts the new one — do not UPDATE
-- in place.
-- Idempotent.
-- =============================================================================

BEGIN;

CREATE TABLE IF NOT EXISTS post_op_taper_step (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id       uuid NOT NULL,
    journey_id      uuid NOT NULL REFERENCES patient_journey(id),
    drug_name       varchar(160) NOT NULL,
    eye             varchar(8) NOT NULL,
    step_no         int NOT NULL,
    frequency_label varchar(80) NOT NULL,
    days            int NOT NULL CHECK (days > 0),
    instructions    text,
    created_at      timestamptz NOT NULL DEFAULT now(),
    created_by      uuid NOT NULL,
    deleted_at      timestamptz
);

CREATE UNIQUE INDEX IF NOT EXISTS ux_post_op_taper_active_step
    ON post_op_taper_step (journey_id, drug_name, eye, step_no)
    WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS ix_post_op_taper_journey
    ON post_op_taper_step (tenant_id, journey_id)
    WHERE deleted_at IS NULL;

COMMENT ON TABLE post_op_taper_step IS
    'W-08 B1 eyedrop taper. Active plan = deleted_at IS NULL. History is soft-deleted rows.';

COMMIT;
