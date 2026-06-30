CREATE TABLE IF NOT EXISTS patient_recent_views (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id uuid NOT NULL,
    user_id uuid NOT NULL,
    patient_id uuid NOT NULL REFERENCES patient(id) ON DELETE CASCADE,
    viewed_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_patient_recent_views_user_patient UNIQUE (tenant_id, user_id, patient_id)
);

CREATE INDEX IF NOT EXISTS ix_patient_recent_views_user_viewed
    ON patient_recent_views (tenant_id, user_id, viewed_at DESC);
