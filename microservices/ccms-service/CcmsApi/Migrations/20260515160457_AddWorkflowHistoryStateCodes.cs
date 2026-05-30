using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace CcmsApi.Migrations
{
    /// <inheritdoc />
    public partial class AddWorkflowHistoryStateCodes : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "from_state_code",
                table: "ccms_workflow_history",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "to_state_code",
                table: "ccms_workflow_history",
                type: "text",
                nullable: true);

            migrationBuilder.Sql("""
                UPDATE ccms_workflow_history h
                SET to_state_code = s.state_code
                FROM ccms_workflow_states s
                WHERE h.to_state_id = s.id AND h.to_state_code IS NULL;

                UPDATE ccms_workflow_history h
                SET from_state_code = s.state_code
                FROM ccms_workflow_states s
                WHERE h.from_state_id = s.id AND h.from_state_code IS NULL;

                UPDATE ccms_coverage_cases
                SET patient_name = COALESCE(
                    NULLIF(TRIM(patient_name), ''),
                    NULLIF(TRIM(counsellor_draft_json::jsonb ->> 'insuredName'), ''),
                    NULLIF(TRIM(counsellor_draft_json::jsonb ->> 'InsuredName'), '')
                )
                WHERE patient_name IS NULL
                  AND counsellor_draft_json IS NOT NULL
                  AND counsellor_draft_json <> '';
                """);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "from_state_code",
                table: "ccms_workflow_history");

            migrationBuilder.DropColumn(
                name: "to_state_code",
                table: "ccms_workflow_history");
        }
    }
}
