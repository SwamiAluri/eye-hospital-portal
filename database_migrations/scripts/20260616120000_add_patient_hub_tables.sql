-- Patient Hub — favorites table and lookup indexes (20260616120000_AddPatientHubTables)

CREATE TABLE IF NOT EXISTS patient_favorites (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id uuid NOT NULL,
    user_id uuid NOT NULL,
    patient_id uuid NOT NULL REFERENCES patient(id) ON DELETE CASCADE,
    created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_patient_favorites_user_patient UNIQUE (tenant_id, user_id, patient_id)
);

CREATE INDEX IF NOT EXISTS ix_patient_favorites_user
    ON patient_favorites (tenant_id, user_id);

CREATE INDEX IF NOT EXISTS ix_patients_tenant_mrn
    ON patient (tenant_id, medical_record_number)
    WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS ix_patients_tenant_branch
    ON patient (tenant_id, branch_id)
    WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS ix_patients_tenant_name
    ON patient (tenant_id, last_name, first_name)
    WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS ix_visits_tenant_branch_patient_status
    ON visits (tenant_id, branch_id, patient_id, status)
    WHERE deleted_at IS NULL;
