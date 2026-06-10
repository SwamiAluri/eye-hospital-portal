using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace AuthService.Data.Migrations
{
    /// <summary>
    /// Documents vitreous_exam and peripheral_retina_exam segment keys on existing optometry_segment_exams JSON storage.
    /// No schema change — segment_key is a string column; new keys are accepted by the generic upsert API.
    /// </summary>
    public partial class AddOptometrySegmentKeysVitreousPeripheralRetina : Migration
    {
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql("""
                -- Optometry segment keys (JSON per row): pupil_exam, anterior_segment, posterior_segment,
                -- fundus_exam, vitreous_exam, peripheral_retina_exam, visual_acuity_bundle, iop_bundle, etc.
                SELECT 1;
                """);
        }

        protected override void Down(MigrationBuilder migrationBuilder)
        {
        }
    }
}
