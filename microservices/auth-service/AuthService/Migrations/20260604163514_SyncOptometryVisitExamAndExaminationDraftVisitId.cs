using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace AuthService.Migrations
{
    /// <summary>
    /// Syncs optometry_visit_exams, examination_drafts.visit_id, and history indexes.
    /// Segment keys vitreous_exam and peripheral_retina_exam use existing optometry_segment_exams (JSON).
    /// </summary>
    public partial class SyncOptometryVisitExamAndExaminationDraftVisitId : Migration
    {
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql("""
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

                ALTER TABLE examination_drafts
                  ADD COLUMN IF NOT EXISTS visit_id uuid;

                DO $$
                BEGIN
                  IF NOT EXISTS (
                    SELECT 1 FROM pg_constraint WHERE conname = 'FK_examination_drafts_visits_visit_id'
                  ) THEN
                    ALTER TABLE examination_drafts
                      ADD CONSTRAINT "FK_examination_drafts_visits_visit_id"
                      FOREIGN KEY (visit_id) REFERENCES visits(id);
                  END IF;
                END $$;

                CREATE INDEX IF NOT EXISTS "IX_examination_drafts_visit_id"
                  ON examination_drafts (visit_id)
                  WHERE visit_id IS NOT NULL;
                """);
        }

        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql("""
                DROP INDEX IF EXISTS "IX_examination_drafts_visit_id";
                ALTER TABLE examination_drafts DROP CONSTRAINT IF EXISTS "FK_examination_drafts_visits_visit_id";
                ALTER TABLE examination_drafts DROP COLUMN IF EXISTS visit_id;
                DROP INDEX IF EXISTS "IX_optometry_segment_exams_patient_id_tenant_id_updated_at";
                DROP INDEX IF EXISTS "IX_optometry_visit_exams_patient_id_tenant_id_updated_at";
                DROP INDEX IF EXISTS "IX_optometry_visit_exams_visit_id";
                DROP TABLE IF EXISTS optometry_visit_exams;
                """);
        }
    }
}
