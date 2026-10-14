using System;
using LaboratoryApi.Data;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace LaboratoryApi.Migrations
{
    /// <summary>
    /// L-REP-03 CUT B / B1 — Official PDF template/signatory configuration,
    /// generation jobs, immutable artifacts, and current official pointer.
    /// No production configuration values are seeded.
    /// </summary>
    [DbContext(typeof(LaboratoryDbContext))]
    [Migration("20261012220000_AddLmsReportOfficialPdfFoundation")]
    public partial class AddLmsReportOfficialPdfFoundation : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<Guid>(
                name: "current_official_artifact_id",
                table: "lms_reports",
                type: "uuid",
                nullable: true);

            migrationBuilder.CreateIndex(
                name: "IX_lms_reports_current_official_artifact_id",
                table: "lms_reports",
                column: "current_official_artifact_id");

            migrationBuilder.CreateTable(
                name: "lms_report_pdf_template_versions",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    tenant_id = table.Column<Guid>(type: "uuid", nullable: false),
                    template_code = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: false),
                    version_number = table.Column<int>(type: "integer", nullable: false),
                    hospital_laboratory_name = table.Column<string>(type: "character varying(256)", maxLength: 256, nullable: false),
                    logo_content = table.Column<byte[]>(type: "bytea", nullable: false),
                    logo_mime_type = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: false),
                    effective_from_utc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    is_active = table.Column<bool>(type: "boolean", nullable: false),
                    is_locked = table.Column<bool>(type: "boolean", nullable: false),
                    locked_at_utc = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    created_at_utc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    created_by_user_id = table.Column<Guid>(type: "uuid", nullable: false),
                    updated_at_utc = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    updated_by_user_id = table.Column<Guid>(type: "uuid", nullable: true),
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_lms_report_pdf_template_versions", x => x.id);
                });

            migrationBuilder.CreateIndex(
                name: "IX_lms_report_pdf_template_versions_tenant_code_version",
                table: "lms_report_pdf_template_versions",
                columns: new[] { "tenant_id", "template_code", "version_number" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_lms_report_pdf_template_versions_tenant_active_effective",
                table: "lms_report_pdf_template_versions",
                columns: new[] { "tenant_id", "is_active", "effective_from_utc" });

            migrationBuilder.CreateTable(
                name: "lms_report_pdf_signatories",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    tenant_id = table.Column<Guid>(type: "uuid", nullable: false),
                    name = table.Column<string>(type: "character varying(256)", maxLength: 256, nullable: false),
                    credentials_text = table.Column<string>(type: "character varying(512)", maxLength: 512, nullable: false),
                    effective_from_utc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    is_active = table.Column<bool>(type: "boolean", nullable: false),
                    created_at_utc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    created_by_user_id = table.Column<Guid>(type: "uuid", nullable: false),
                    updated_at_utc = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    updated_by_user_id = table.Column<Guid>(type: "uuid", nullable: true),
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_lms_report_pdf_signatories", x => x.id);
                });

            migrationBuilder.CreateIndex(
                name: "IX_lms_report_pdf_signatories_tenant_active_effective",
                table: "lms_report_pdf_signatories",
                columns: new[] { "tenant_id", "is_active", "effective_from_utc" });

            migrationBuilder.CreateTable(
                name: "lms_report_official_pdf_jobs",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    tenant_id = table.Column<Guid>(type: "uuid", nullable: false),
                    operating_branch_id = table.Column<Guid>(type: "uuid", nullable: false),
                    report_id = table.Column<Guid>(type: "uuid", nullable: false),
                    status = table.Column<string>(type: "character varying(32)", maxLength: 32, nullable: false),
                    requested_by_user_id = table.Column<Guid>(type: "uuid", nullable: false),
                    requested_at_utc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    started_at_utc = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    completed_at_utc = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    attempt_count = table.Column<int>(type: "integer", nullable: false),
                    artifact_id = table.Column<Guid>(type: "uuid", nullable: true),
                    template_version_id = table.Column<Guid>(type: "uuid", nullable: true),
                    signatory_id = table.Column<Guid>(type: "uuid", nullable: true),
                    failure_code = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: true),
                    failure_message = table.Column<string>(type: "character varying(1000)", maxLength: 1000, nullable: true),
                    row_version = table.Column<int>(type: "integer", nullable: false),
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_lms_report_official_pdf_jobs", x => x.id);
                    table.ForeignKey(
                        name: "FK_lms_report_official_pdf_jobs_lms_reports_report_id",
                        column: x => x.report_id,
                        principalTable: "lms_reports",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateIndex(
                name: "IX_lms_report_official_pdf_jobs_tenant_report_status",
                table: "lms_report_official_pdf_jobs",
                columns: new[] { "tenant_id", "report_id", "status" });

            migrationBuilder.CreateIndex(
                name: "IX_lms_report_official_pdf_jobs_status_requested",
                table: "lms_report_official_pdf_jobs",
                columns: new[] { "status", "requested_at_utc" });

            migrationBuilder.CreateIndex(
                name: "IX_lms_report_official_pdf_jobs_one_active",
                table: "lms_report_official_pdf_jobs",
                columns: new[] { "tenant_id", "report_id" },
                unique: true,
                filter: "status IN ('Pending', 'Running')");

            migrationBuilder.CreateTable(
                name: "lms_report_official_pdf_artifacts",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    tenant_id = table.Column<Guid>(type: "uuid", nullable: false),
                    report_id = table.Column<Guid>(type: "uuid", nullable: false),
                    report_version_id = table.Column<Guid>(type: "uuid", nullable: false),
                    job_id = table.Column<Guid>(type: "uuid", nullable: false),
                    artifact_version = table.Column<int>(type: "integer", nullable: false),
                    status = table.Column<string>(type: "character varying(32)", maxLength: 32, nullable: false),
                    mime_type = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    size_bytes = table.Column<long>(type: "bigint", nullable: false),
                    content_hash = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: true),
                    canonical_document_id = table.Column<Guid>(type: "uuid", nullable: true),
                    template_version_id = table.Column<Guid>(type: "uuid", nullable: false),
                    signatory_id = table.Column<Guid>(type: "uuid", nullable: false),
                    generated_by_user_id = table.Column<Guid>(type: "uuid", nullable: false),
                    generated_at_utc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    failure_code = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: true),
                    failure_message = table.Column<string>(type: "character varying(1000)", maxLength: 1000, nullable: true),
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_lms_report_official_pdf_artifacts", x => x.id);
                    table.ForeignKey(
                        name: "FK_lms_report_official_pdf_artifacts_lms_reports_report_id",
                        column: x => x.report_id,
                        principalTable: "lms_reports",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_lms_report_official_pdf_artifacts_jobs_job_id",
                        column: x => x.job_id,
                        principalTable: "lms_report_official_pdf_jobs",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateIndex(
                name: "IX_lms_report_official_pdf_artifacts_report_version",
                table: "lms_report_official_pdf_artifacts",
                columns: new[] { "report_id", "artifact_version" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_lms_report_official_pdf_artifacts_tenant_report",
                table: "lms_report_official_pdf_artifacts",
                columns: new[] { "tenant_id", "report_id" });

            migrationBuilder.CreateIndex(
                name: "IX_lms_report_official_pdf_artifacts_canonical_document_id",
                table: "lms_report_official_pdf_artifacts",
                column: "canonical_document_id");

            migrationBuilder.CreateIndex(
                name: "IX_lms_report_official_pdf_artifacts_job_id",
                table: "lms_report_official_pdf_artifacts",
                column: "job_id",
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(name: "lms_report_official_pdf_artifacts");
            migrationBuilder.DropTable(name: "lms_report_official_pdf_jobs");
            migrationBuilder.DropTable(name: "lms_report_pdf_signatories");
            migrationBuilder.DropTable(name: "lms_report_pdf_template_versions");
            migrationBuilder.DropIndex(
                name: "IX_lms_reports_current_official_artifact_id",
                table: "lms_reports");
            migrationBuilder.DropColumn(
                name: "current_official_artifact_id",
                table: "lms_reports");
        }
    }
}
