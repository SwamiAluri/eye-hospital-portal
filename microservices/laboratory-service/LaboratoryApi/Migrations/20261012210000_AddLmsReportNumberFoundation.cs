using System;
using LaboratoryApi.Data;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace LaboratoryApi.Migrations
{
    /// <summary>
    /// L-REP-03 CUT A — Business Report Number metadata, operating-branch sequence,
    /// and governed format configuration (no production default values seeded).
    /// </summary>
    [DbContext(typeof(LaboratoryDbContext))]
    [Migration("20261012210000_AddLmsReportNumberFoundation")]
    public partial class AddLmsReportNumberFoundation : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "business_report_number",
                table: "lms_reports",
                type: "character varying(64)",
                maxLength: 64,
                nullable: true);

            migrationBuilder.AddColumn<DateTime>(
                name: "business_report_number_assigned_at_utc",
                table: "lms_reports",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "business_report_number_assigned_by_user_id",
                table: "lms_reports",
                type: "uuid",
                nullable: true);

            migrationBuilder.CreateIndex(
                name: "IX_lms_reports_tenant_id_business_report_number",
                table: "lms_reports",
                columns: new[] { "tenant_id", "business_report_number" },
                unique: true,
                filter: "business_report_number IS NOT NULL");

            migrationBuilder.CreateTable(
                name: "lms_report_number_configurations",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    tenant_id = table.Column<Guid>(type: "uuid", nullable: false),
                    operating_branch_id = table.Column<Guid>(type: "uuid", nullable: false),
                    format_code = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: false),
                    prefix = table.Column<string>(type: "character varying(32)", maxLength: 32, nullable: false),
                    separator = table.Column<string>(type: "character varying(8)", maxLength: 8, nullable: false),
                    date_segment = table.Column<string>(type: "character varying(32)", maxLength: 32, nullable: false),
                    date_timezone = table.Column<string>(type: "character varying(16)", maxLength: 16, nullable: false),
                    sequence_width = table.Column<int>(type: "integer", nullable: false),
                    sequence_period = table.Column<string>(type: "character varying(32)", maxLength: 32, nullable: false),
                    effective_from_utc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    is_active = table.Column<bool>(type: "boolean", nullable: false),
                    created_at_utc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    created_by_user_id = table.Column<Guid>(type: "uuid", nullable: false),
                    updated_at_utc = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    updated_by_user_id = table.Column<Guid>(type: "uuid", nullable: true),
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_lms_report_number_configurations", x => x.id);
                });

            migrationBuilder.CreateIndex(
                name: "IX_lms_report_number_configurations_tenant_branch_effective",
                table: "lms_report_number_configurations",
                columns: new[] { "tenant_id", "operating_branch_id", "effective_from_utc" });

            migrationBuilder.CreateIndex(
                name: "IX_lms_report_number_configurations_tenant_branch_active",
                table: "lms_report_number_configurations",
                columns: new[] { "tenant_id", "operating_branch_id", "is_active" });

            migrationBuilder.CreateTable(
                name: "lms_report_number_sequences",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    tenant_id = table.Column<Guid>(type: "uuid", nullable: false),
                    operating_branch_id = table.Column<Guid>(type: "uuid", nullable: false),
                    sequence_period_key = table.Column<string>(type: "character varying(32)", maxLength: 32, nullable: false),
                    last_value = table.Column<int>(type: "integer", nullable: false),
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_lms_report_number_sequences", x => x.id);
                });

            migrationBuilder.CreateIndex(
                name: "IX_lms_report_number_sequences_tenant_branch_period",
                table: "lms_report_number_sequences",
                columns: new[] { "tenant_id", "operating_branch_id", "sequence_period_key" },
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(name: "lms_report_number_sequences");
            migrationBuilder.DropTable(name: "lms_report_number_configurations");
            migrationBuilder.DropIndex(
                name: "IX_lms_reports_tenant_id_business_report_number",
                table: "lms_reports");
            migrationBuilder.DropColumn(name: "business_report_number", table: "lms_reports");
            migrationBuilder.DropColumn(name: "business_report_number_assigned_at_utc", table: "lms_reports");
            migrationBuilder.DropColumn(name: "business_report_number_assigned_by_user_id", table: "lms_reports");
        }
    }
}
