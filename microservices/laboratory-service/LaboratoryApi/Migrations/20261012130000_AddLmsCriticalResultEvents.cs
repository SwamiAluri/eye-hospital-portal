using System;
using LaboratoryApi.Data;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace LaboratoryApi.Migrations
{
    /// <summary>L-CRT-01 — CriticalResultEvent table (orthogonal to ResultStatus).</summary>
    [DbContext(typeof(LaboratoryDbContext))]
    [Migration("20261012130000_AddLmsCriticalResultEvents")]
    public partial class AddLmsCriticalResultEvents : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "lms_critical_result_events",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    tenant_id = table.Column<Guid>(type: "uuid", nullable: false),
                    result_id = table.Column<Guid>(type: "uuid", nullable: false),
                    result_version_number = table.Column<int>(type: "integer", nullable: false),
                    operating_branch_id = table.Column<Guid>(type: "uuid", nullable: false),
                    status = table.Column<string>(type: "character varying(32)", maxLength: 32, nullable: false),
                    classified_by_user_id = table.Column<Guid>(type: "uuid", nullable: false),
                    classified_at_utc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    acknowledged_by_user_id = table.Column<Guid>(type: "uuid", nullable: true),
                    acknowledged_at_utc = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    acknowledgement_evidence = table.Column<string>(type: "character varying(2000)", maxLength: 2000, nullable: true),
                    notification_intent_status = table.Column<string>(type: "character varying(32)", maxLength: 32, nullable: false),
                    notification_intent_detail = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: true),
                    created_at_utc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    created_by_user_id = table.Column<Guid>(type: "uuid", nullable: false),
                    updated_at_utc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    updated_by_user_id = table.Column<Guid>(type: "uuid", nullable: false),
                    row_version = table.Column<int>(type: "integer", nullable: false),
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_lms_critical_result_events", x => x.id);
                    table.ForeignKey(
                        name: "FK_lms_critical_result_events_lms_results_result_id",
                        column: x => x.result_id,
                        principalTable: "lms_results",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateIndex(
                name: "IX_lms_critical_result_events_tenant_id_result_id_result_version_number",
                table: "lms_critical_result_events",
                columns: new[] { "tenant_id", "result_id", "result_version_number" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_lms_critical_result_events_tenant_id_operating_branch_id_status",
                table: "lms_critical_result_events",
                columns: new[] { "tenant_id", "operating_branch_id", "status" });

            migrationBuilder.CreateIndex(
                name: "IX_lms_critical_result_events_result_id",
                table: "lms_critical_result_events",
                column: "result_id");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(name: "lms_critical_result_events");
        }
    }
}
