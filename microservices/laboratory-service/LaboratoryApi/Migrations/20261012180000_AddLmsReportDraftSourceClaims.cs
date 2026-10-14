using System;
using LaboratoryApi.Data;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace LaboratoryApi.Migrations
{
    /// <summary>
    /// L-REP-01 PD-REP-DRAFT-UNIQUE-01 — Draft Report ResultVersion exclusivity claims.
    /// Backfills from existing Draft sources (oldest Report wins) without deleting duplicates.
    /// </summary>
    [DbContext(typeof(LaboratoryDbContext))]
    [Migration("20261012180000_AddLmsReportDraftSourceClaims")]
    public partial class AddLmsReportDraftSourceClaims : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "lms_report_draft_source_claims",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    tenant_id = table.Column<Guid>(type: "uuid", nullable: false),
                    result_version_id = table.Column<Guid>(type: "uuid", nullable: false),
                    report_id = table.Column<Guid>(type: "uuid", nullable: false),
                    result_id = table.Column<Guid>(type: "uuid", nullable: false),
                    result_version_number = table.Column<int>(type: "integer", nullable: false),
                    created_at_utc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_lms_report_draft_source_claims", x => x.id);
                    table.ForeignKey(
                        name: "FK_lms_report_draft_source_claims_lms_reports_report_id",
                        column: x => x.report_id,
                        principalTable: "lms_reports",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_lms_report_draft_source_claims_lms_result_versions_result_version_id",
                        column: x => x.result_version_id,
                        principalTable: "lms_result_versions",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateIndex(
                name: "IX_lms_report_draft_source_claims_tenant_id_result_version_id",
                table: "lms_report_draft_source_claims",
                columns: new[] { "tenant_id", "result_version_id" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_lms_report_draft_source_claims_report_id",
                table: "lms_report_draft_source_claims",
                column: "report_id");

            migrationBuilder.CreateIndex(
                name: "IX_lms_report_draft_source_claims_result_version_id",
                table: "lms_report_draft_source_claims",
                column: "result_version_id");

            // Non-destructive: oldest Draft Report keeps the claim; newer UAT duplicates remain as rows.
            migrationBuilder.Sql("""
                INSERT INTO lms_report_draft_source_claims (
                    id, tenant_id, result_version_id, report_id, result_id, result_version_number, created_at_utc)
                SELECT DISTINCT ON (s.tenant_id, s.result_version_id)
                    gen_random_uuid(),
                    s.tenant_id,
                    s.result_version_id,
                    r.id,
                    s.result_id,
                    s.result_version_number,
                    NOW() AT TIME ZONE 'utc'
                FROM lms_report_version_sources s
                INNER JOIN lms_report_versions v ON v.id = s.report_version_id AND v.tenant_id = s.tenant_id
                INNER JOIN lms_reports r ON r.id = v.report_id AND r.tenant_id = s.tenant_id
                WHERE r.status = 'Draft'
                ORDER BY s.tenant_id, s.result_version_id, r.created_at_utc ASC, r.id ASC;
                """);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(name: "lms_report_draft_source_claims");
        }
    }
}
