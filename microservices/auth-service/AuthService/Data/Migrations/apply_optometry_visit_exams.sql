CREATE TABLE IF NOT EXISTS optometry_visit_exams (
    id uuid NOT NULL PRIMARY KEY,
    tenant_id uuid NOT NULL,
    visit_id uuid NOT NULL REFERENCES visits(id) ON DELETE CASCADE,
    patient_id uuid NOT NULL,
    snapshot_json jsonb NOT NULL DEFAULT '{}',
    completed_at timestamp with time zone,
    completed_by uuid,
    created_at timestamp with time zone NOT NULL,
    updated_at timestamp with time zone NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS "IX_optometry_visit_exams_visit_id"
    ON optometry_visit_exams (visit_id);
CREATE INDEX IF NOT EXISTS "IX_optometry_visit_exams_patient_id_tenant_id_updated_at"
    ON optometry_visit_exams (patient_id, tenant_id, updated_at DESC);
CREATE INDEX IF NOT EXISTS "IX_optometry_segment_exams_patient_id_tenant_id_updated_at"
    ON optometry_segment_exams (patient_id, tenant_id, updated_at DESC);
