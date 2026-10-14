using System;
using LaboratoryApi.Data;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace LaboratoryApi.Migrations
{
    /// <summary>L-REP-01 — Report Foundation (Draft Report + immutable ReportVersion snapshots).</summary>
    [DbContext(typeof(LaboratoryDbContext))]
    [Migration("20261012160000_AddLmsReportFoundation")]
    public partial class AddLmsReportFoundation : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "lms_reports",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    tenant_id = table.Column<Guid>(type: "uuid", nullable: false),
                    operating_branch_id = table.Column<Guid>(type: "uuid", nullable: false),
                    patient_id = table.Column<Guid>(type: "uuid", nullable: false),
                    order_id = table.Column<Guid>(type: "uuid", nullable: false),
                    status = table.Column<string>(type: "character varying(32)", maxLength: 32, nullable: false),
                    current_version_number = table.Column<int>(type: "integer", nullable: false),
                    created_at_utc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    created_by_user_id = table.Column<Guid>(type: "uuid", nullable: false),
                    updated_at_utc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    updated_by_user_id = table.Column<Guid>(type: "uuid", nullable: false),
                    row_version = table.Column<int>(type: "integer", nullable: false),
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_lms_reports", x => x.id);
                });

            migrationBuilder.CreateTable(
                name: "lms_report_idempotency",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    tenant_id = table.Column<Guid>(type: "uuid", nullable: false),
                    idempotency_key = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    operation = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: false),
                    request_hash = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: false),
                    report_id = table.Column<Guid>(type: "uuid", nullable: false),
                    response_json = table.Column<string>(type: "text", nullable: false),
                    created_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_lms_report_idempotency", x => x.id);
                });

            migrationBuilder.CreateTable(
                name: "lms_report_versions",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    tenant_id = table.Column<Guid>(type: "uuid", nullable: false),
                    report_id = table.Column<Guid>(type: "uuid", nullable: false),
                    version_number = table.Column<int>(type: "integer", nullable: false),
                    patient_id = table.Column<Guid>(type: "uuid", nullable: false),
                    order_id = table.Column<Guid>(type: "uuid", nullable: false),
                    operating_branch_id = table.Column<Guid>(type: "uuid", nullable: false),
                    created_at_utc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    created_by_user_id = table.Column<Guid>(type: "uuid", nullable: false),
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_lms_report_versions", x => x.id);
                    table.ForeignKey(
                        name: "FK_lms_report_versions_lms_reports_report_id",
                        column: x => x.report_id,
                        principalTable: "lms_reports",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "lms_report_version_sources",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    tenant_id = table.Column<Guid>(type: "uuid", nullable: false),
                    report_version_id = table.Column<Guid>(type: "uuid", nullable: false),
                    result_id = table.Column<Guid>(type: "uuid", nullable: false),
                    result_version_id = table.Column<Guid>(type: "uuid", nullable: false),
                    result_version_number = table.Column<int>(type: "integer", nullable: false),
                    order_test_id = table.Column<Guid>(type: "uuid", nullable: false),
                    specimen_id = table.Column<Guid>(type: "uuid", nullable: false),
                    catalogue_item_id = table.Column<Guid>(type: "uuid", nullable: false),
                    catalogue_version_id = table.Column<Guid>(type: "uuid", nullable: false),
                    result_datatype = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: false),
                    numeric_value = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: true),
                    qualitative_value = table.Column<string>(type: "character varying(256)", maxLength: 256, nullable: true),
                    unit = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: true),
                    comment = table.Column<string>(type: "character varying(2000)", maxLength: 2000, nullable: true),
                    result_status_at_snapshot = table.Column<string>(type: "character varying(32)", maxLength: 32, nullable: false),
                    authorized_by_user_id = table.Column<Guid>(type: "uuid", nullable: true),
                    authorized_at_utc = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_lms_report_version_sources", x => x.id);
                    table.ForeignKey(
                        name: "FK_lms_report_version_sources_lms_report_versions_report_version_id",
                        column: x => x.report_version_id,
                        principalTable: "lms_report_versions",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_lms_report_version_sources_lms_results_result_id",
                        column: x => x.result_id,
                        principalTable: "lms_results",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_lms_report_version_sources_lms_result_versions_result_version_id",
                        column: x => x.result_version_id,
                        principalTable: "lms_result_versions",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateIndex(
                name: "IX_lms_reports_tenant_id_operating_branch_id_status",
                table: "lms_reports",
                columns: new[] { "tenant_id", "operating_branch_id", "status" });

            migrationBuilder.CreateIndex(
                name: "IX_lms_reports_tenant_id_patient_id",
                table: "lms_reports",
                columns: new[] { "tenant_id", "patient_id" });

            migrationBuilder.CreateIndex(
                name: "IX_lms_reports_tenant_id_order_id",
                table: "lms_reports",
                columns: new[] { "tenant_id", "order_id" });

            migrationBuilder.CreateIndex(
                name: "IX_lms_report_versions_report_id_version_number",
                table: "lms_report_versions",
                columns: new[] { "report_id", "version_number" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_lms_report_versions_tenant_id_report_id",
                table: "lms_report_versions",
                columns: new[] { "tenant_id", "report_id" });

            migrationBuilder.CreateIndex(
                name: "IX_lms_report_version_sources_report_version_id_result_id_result_version_number",
                table: "lms_report_version_sources",
                columns: new[] { "report_version_id", "result_id", "result_version_number" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_lms_report_version_sources_tenant_id_result_id",
                table: "lms_report_version_sources",
                columns: new[] { "tenant_id", "result_id" });

            migrationBuilder.CreateIndex(
                name: "IX_lms_report_version_sources_result_version_id",
                table: "lms_report_version_sources",
                column: "result_version_id");

            migrationBuilder.CreateIndex(
                name: "IX_lms_report_version_sources_result_id",
                table: "lms_report_version_sources",
                column: "result_id");

            migrationBuilder.CreateIndex(
                name: "IX_lms_report_idempotency_tenant_id_idempotency_key",
                table: "lms_report_idempotency",
                columns: new[] { "tenant_id", "idempotency_key" },
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(name: "lms_report_version_sources");
            migrationBuilder.DropTable(name: "lms_report_idempotency");
            migrationBuilder.DropTable(name: "lms_report_versions");
            migrationBuilder.DropTable(name: "lms_reports");
        }
    }
}
