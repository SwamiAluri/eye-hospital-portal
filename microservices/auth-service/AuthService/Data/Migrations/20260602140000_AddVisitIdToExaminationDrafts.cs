using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace AuthService.Data.Migrations
{
    /// <summary>
    /// Scope examination drafts per visit (optometry exam working copy).
    /// </summary>
    public partial class AddVisitIdToExaminationDrafts : Migration
    {
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql("""
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
                """);
        }

        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql("""
                DROP INDEX IF EXISTS "IX_examination_drafts_visit_id";
                DROP INDEX IF EXISTS "IX_examination_drafts_tenant_patient_doctor_visit";
                ALTER TABLE examination_drafts DROP COLUMN IF EXISTS visit_id;
                """);
        }
    }
}
