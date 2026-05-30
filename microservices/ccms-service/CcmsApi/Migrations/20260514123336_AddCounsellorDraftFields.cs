using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace CcmsApi.Migrations
{
    /// <inheritdoc />
    public partial class AddCounsellorDraftFields : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "counsellor_draft_json",
                table: "ccms_coverage_cases",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<DateTime>(
                name: "draft_saved_at",
                table: "ccms_coverage_cases",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.AddColumn<bool>(
                name: "is_draft",
                table: "ccms_coverage_cases",
                type: "boolean",
                nullable: false,
                defaultValue: false);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "counsellor_draft_json",
                table: "ccms_coverage_cases");

            migrationBuilder.DropColumn(
                name: "draft_saved_at",
                table: "ccms_coverage_cases");

            migrationBuilder.DropColumn(
                name: "is_draft",
                table: "ccms_coverage_cases");
        }
    }
}
