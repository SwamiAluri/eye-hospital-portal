-- =============================================================================
-- 166_journey_slot.sql
-- TASK IP-013 — Day-care batch / slot model (staggered arrival).
--
-- journey_slot is history: release a row (released_at) instead of mutating a
-- position column on patient_journey as the only record. patient_journey.slot_id
-- is the current pointer.
--
-- Unique sequence is filtered so released rows do not occupy a slot.
-- Idempotent: re-running is a no-op.
-- =============================================================================

BEGIN;

CREATE TABLE IF NOT EXISTS journey_slot (
    id                    UUID PRIMARY KEY,
    tenant_id             UUID NOT NULL,
    branch_id             UUID NOT NULL,
    slot_date             DATE NOT NULL,
    session               VARCHAR(16) NOT NULL,
    theatre_id            UUID NOT NULL,
    theatre_name          VARCHAR(120),
    sequence_no           INTEGER NOT NULL,
    planned_arrival_at    TIMESTAMPTZ NOT NULL,
    journey_id            UUID NOT NULL,
    released_at           TIMESTAMPTZ,
    released_reason       VARCHAR(200),
    released_by_user_id   UUID,
    created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by_user_id    UUID,
    updated_by_user_id    UUID,
    CONSTRAINT journey_slot_session_check
        CHECK (session IN ('Morning', 'Afternoon', 'Evening')),
    CONSTRAINT journey_slot_sequence_check
        CHECK (sequence_no >= 1)
);

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'journey_slot_journey_id_fkey'
    ) THEN
        ALTER TABLE journey_slot
            ADD CONSTRAINT journey_slot_journey_id_fkey
            FOREIGN KEY (journey_id) REFERENCES patient_journey(id);
    END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS ux_journey_slot_theatre_session_seq
    ON journey_slot (tenant_id, theatre_id, slot_date, session, sequence_no)
    WHERE released_at IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS ux_journey_slot_active_journey
    ON journey_slot (journey_id)
    WHERE released_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_journey_slot_tenant_date_session
    ON journey_slot (tenant_id, slot_date, session)
    WHERE released_at IS NULL;

ALTER TABLE patient_journey ADD COLUMN IF NOT EXISTS slot_id UUID;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'patient_journey_slot_id_fkey'
    ) THEN
        ALTER TABLE patient_journey
            ADD CONSTRAINT patient_journey_slot_id_fkey
            FOREIGN KEY (slot_id) REFERENCES journey_slot(id);
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_patient_journey_slot_id
    ON patient_journey (slot_id)
    WHERE slot_id IS NOT NULL AND deleted_at IS NULL;

COMMENT ON TABLE journey_slot IS
    'IP-013. Session batch / staggered arrival. Rows are history; released_at frees a sequence.';
COMMENT ON COLUMN patient_journey.slot_id IS
    'IP-013. Current journey_slot.id. Null when unassigned. Accounting is unchanged.';
COMMENT ON COLUMN journey_slot.planned_arrival_at IS
    'UTC instant. Default is session start + (sequence-1)*30min minus 15min pre-arrival, IST.';

COMMIT;
