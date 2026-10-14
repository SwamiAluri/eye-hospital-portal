using System;
using LaboratoryApi.Data;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace LaboratoryApi.Migrations
{
    /// <summary>L-VER-01 — Technical Verification metadata on lms_results.</summary>
    [DbContext(typeof(LaboratoryDbContext))]
    [Migration("20261012093000_AddLmsResultTechnicalVerification")]
    public partial class AddLmsResultTechnicalVerification : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<Guid>(
                name: "verified_by_user_id",
                table: "lms_results",
                type: "uuid",
                nullable: true);

            migrationBuilder.AddColumn<DateTime>(
                name: "verified_at_utc",
                table: "lms_results",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "verified_version_number",
                table: "lms_results",
                type: "integer",
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "verified_by_user_id",
                table: "lms_results");

            migrationBuilder.DropColumn(
                name: "verified_at_utc",
                table: "lms_results");

            migrationBuilder.DropColumn(
                name: "verified_version_number",
                table: "lms_results");
        }
    }
}
