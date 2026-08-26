-- Wave 3–6 schema (idempotent). Auth bed_inventory remains the bed master.

-- Vacate/transfer-out uses Cleaning; policy also uses Under_Maintenance.
ALTER TABLE bed_inventory DROP CONSTRAINT IF EXISTS bed_inventory_bed_status_check;
ALTER TABLE bed_inventory ADD CONSTRAINT bed_inventory_bed_status_check
    CHECK (bed_status::text = ANY (ARRAY[
        'Available'::text, 'Occupied'::text, 'Maintenance'::text, 'Under_Maintenance'::text,
        'Reserved'::text, 'Out of Service'::text, 'Cleaning'::text
    ]));

ALTER TABLE bed_inventory ADD COLUMN IF NOT EXISTS assigned_at TIMESTAMPTZ NULL;
ALTER TABLE bed_inventory ADD COLUMN IF NOT EXISTS expected_discharge_at TIMESTAMPTZ NULL;
ALTER TABLE bed_inventory ADD COLUMN IF NOT EXISTS floor_number INTEGER NULL;
ALTER TABLE bed_inventory ADD COLUMN IF NOT EXISTS equipment_available VARCHAR(500) NULL;
ALTER TABLE bed_inventory ADD COLUMN IF NOT EXISTS is_isolation_bed BOOLEAN NOT NULL DEFAULT FALSE;
UPDATE bed_inventory SET floor_number = floor WHERE floor_number IS NULL AND floor IS NOT NULL;


ALTER TABLE patient_journey
    ADD COLUMN IF NOT EXISTS assigned_bed_id UUID NULL;

ALTER TABLE patient_journey
    ADD COLUMN IF NOT EXISTS discharge_planning_ready BOOLEAN NOT NULL DEFAULT FALSE;

COMMENT ON COLUMN patient_journey.assigned_bed_id IS
  'Reference to auth bed_inventory.id — not a second bed table.';

CREATE TABLE IF NOT EXISTS ip_daily_progress_note (
    id                 UUID PRIMARY KEY,
    tenant_id          UUID NOT NULL,
    patient_journey_id UUID NOT NULL,
    note               TEXT NOT NULL,
    recorded_at        TIMESTAMPTZ NOT NULL DEFAULT (NOW() AT TIME ZONE 'utc'),
    created_at         TIMESTAMPTZ NOT NULL DEFAULT (NOW() AT TIME ZONE 'utc'),
    updated_at         TIMESTAMPTZ NOT NULL DEFAULT (NOW() AT TIME ZONE 'utc'),
    created_by_user_id UUID NULL,
    updated_by_user_id UUID NULL,
    deleted_at         TIMESTAMPTZ NULL,
    status             VARCHAR(20) NOT NULL DEFAULT 'active'
);

CREATE INDEX IF NOT EXISTS ix_ip_daily_progress_journey
    ON ip_daily_progress_note (patient_journey_id, recorded_at DESC)
    WHERE deleted_at IS NULL;

ALTER TABLE ccms_claim_packets
    ADD COLUMN IF NOT EXISTS query_status VARCHAR(40) NOT NULL DEFAULT 'none';

COMMENT ON COLUMN ccms_claim_packets.query_status IS
  'Claim-desk query overlay: none | query_raised | additional_info_required | response_submitted';
