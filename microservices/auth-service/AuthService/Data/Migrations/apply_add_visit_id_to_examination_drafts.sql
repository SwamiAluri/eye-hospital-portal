-- Phase 5: scope examination_drafts by visit_id
-- Safe to run multiple times (IF NOT EXISTS).

ALTER TABLE examination_drafts
  ADD COLUMN IF NOT EXISTS visit_id uuid REFERENCES visits(id) ON DELETE CASCADE;

UPDATE examination_drafts
SET visit_id = (data::jsonb->>'visitId')::uuid
WHERE visit_id IS NULL
  AND data::jsonb ? 'visitId'
  AND (data::jsonb->>'visitId') ~* '^[0-9a-f-]{36}$';

CREATE UNIQUE INDEX IF NOT EXISTS "IX_examination_drafts_tenant_patient_doctor_visit"
  ON examination_drafts (tenant_id, patient_id, doctor_id, visit_id)
  WHERE visit_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS "IX_examination_drafts_visit_id"
  ON examination_drafts (visit_id)
  WHERE visit_id IS NOT NULL;

INSERT INTO "__EFMigrationsHistory" ("MigrationId", "ProductVersion")
VALUES ('20260602140000_AddVisitIdToExaminationDrafts', '8.0.0')
ON CONFLICT ("MigrationId") DO NOTHING;
