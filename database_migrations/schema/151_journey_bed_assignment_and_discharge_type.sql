-- ============================================================================
-- Migration 151: journey_bed_assignment history, discharge type, prior journey
-- Occupancy SoT remains Auth bed inventory. This table is history only.
-- ============================================================================

BEGIN;

ALTER TABLE patient_journey
    ADD COLUMN IF NOT EXISTS discharge_type text,
    ADD COLUMN IF NOT EXISTS discharge_type_reason text,
    ADD COLUMN IF NOT EXISTS clinical_state_before_discharge varchar(40),
    ADD COLUMN IF NOT EXISTS prior_journey_id uuid;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'patient_journey_discharge_type_check'
    ) THEN
        ALTER TABLE patient_journey
            ADD CONSTRAINT patient_journey_discharge_type_check
            CHECK (discharge_type IS NULL OR discharge_type IN (
                'Routine', 'Lama', 'Transfer', 'Death', 'Other'
            ));
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS ix_patient_journey_prior_journey
    ON patient_journey (tenant_id, prior_journey_id)
    WHERE prior_journey_id IS NOT NULL AND deleted_at IS NULL;

CREATE TABLE IF NOT EXISTS journey_bed_assignment (
    id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id             uuid NOT NULL,
    patient_journey_id    uuid NOT NULL,
    patient_id            uuid NOT NULL,
    ward_id               uuid,
    ward_name             varchar(120),
    room_number           varchar(40),
    bed_number            varchar(40),
    assigned_bed_id       uuid,
    assignment_type       varchar(40) NOT NULL,
    assigned_from_bed_id  uuid,
    assigned_to_bed_id    uuid,
    started_at            timestamptz NOT NULL DEFAULT now(),
    ended_at              timestamptz,
    performed_by_user_id  uuid,
    reason                text,
    created_at            timestamptz NOT NULL DEFAULT now(),
    updated_at            timestamptz NOT NULL DEFAULT now(),
    created_by_user_id    uuid,
    updated_by_user_id    uuid,
    deleted_at            timestamptz,
    status                varchar(20) NOT NULL DEFAULT 'active',
    CONSTRAINT journey_bed_assignment_type_check CHECK (assignment_type IN (
        'Initial', 'Transfer', 'Release', 'Cancellation', 'Discharge', 'Reoccupy'
    ))
);

CREATE INDEX IF NOT EXISTS ix_journey_bed_assignment_journey
    ON journey_bed_assignment (tenant_id, patient_journey_id, started_at DESC)
    WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS ix_journey_bed_assignment_open
    ON journey_bed_assignment (patient_journey_id)
    WHERE ended_at IS NULL AND deleted_at IS NULL;

COMMENT ON TABLE journey_bed_assignment IS
    'Historical ward/bed assignment for an IP journey. Auth bed inventory remains occupancy SoT.';

INSERT INTO permissions (id, "TenantId", "Code", "Name", "Module", "Action", "ResourceType", "Scope",
    "Description", "IsSystemPermission", "DepartmentSpecific", "IsCustom", "IsActive",
    "CreatedAt", "UpdatedAt")
SELECT gen_random_uuid(), '00000000-0000-0000-0000-000000000000'::uuid,
       'ip.discharge.cancel', 'Cancel IP discharge', 'ip_management', 'cancel', 'ip_discharge', 'branch',
       'Privileged reopen of a discharged journey with bed reoccupy and audit',
       true, false, false, true, NOW(), NOW()
WHERE NOT EXISTS (
    SELECT 1 FROM permissions p
    WHERE p."Code" = 'ip.discharge.cancel'
      AND p."TenantId" = '00000000-0000-0000-0000-000000000000'::uuid
);

COMMIT;
