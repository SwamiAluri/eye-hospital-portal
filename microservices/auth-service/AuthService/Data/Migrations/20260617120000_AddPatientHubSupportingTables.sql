CREATE TABLE IF NOT EXISTS patient_notes (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id uuid NOT NULL,
    patient_id uuid NOT NULL REFERENCES patient(id) ON DELETE CASCADE,
    visit_id uuid NULL REFERENCES visits(id) ON DELETE SET NULL,
    note_type varchar(50) NOT NULL DEFAULT 'general',
    title varchar(300) NOT NULL,
    content varchar(8000) NOT NULL,
    is_flagged boolean NOT NULL DEFAULT false,
    flag_reason varchar(500) NULL,
    priority varchar(20) NOT NULL DEFAULT 'normal',
    author_id uuid NULL,
    author_name varchar(200) NULL,
    is_confidential boolean NOT NULL DEFAULT false,
    status varchar(20) NOT NULL DEFAULT 'active',
    created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_by_user_id uuid NULL,
    updated_by_user_id uuid NULL,
    deleted_at timestamptz NULL
);

CREATE INDEX IF NOT EXISTS ix_patient_notes_tenant_patient
    ON patient_notes (tenant_id, patient_id)
    WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS ix_patient_vital_signs_patient_measured
    ON patient_vital_signs (patient_id, measurement_date DESC)
    WHERE deleted_at IS NULL;

CREATE TABLE IF NOT EXISTS user_chart_layout (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id uuid NOT NULL,
    user_id uuid NOT NULL,
    layout_json jsonb NOT NULL DEFAULT '[]'::jsonb,
    updated_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_user_chart_layout_user UNIQUE (tenant_id, user_id)
);
