using System;
using LaboratoryApi.Data;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace LaboratoryApi.Migrations
{
    /// <summary>L-AUTH-01 — Clinical Authorization metadata on lms_results.</summary>
    [DbContext(typeof(LaboratoryDbContext))]
    [Migration("20261012110000_AddLmsResultClinicalAuthorization")]
    public partial class AddLmsResultClinicalAuthorization : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<Guid>(
                name: "authorized_by_user_id",
                table: "lms_results",
                type: "uuid",
                nullable: true);

            migrationBuilder.AddColumn<DateTime>(
                name: "authorized_at_utc",
                table: "lms_results",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "authorized_version_number",
                table: "lms_results",
                type: "integer",
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "authorized_by_user_id",
                table: "lms_results");

            migrationBuilder.DropColumn(
                name: "authorized_at_utc",
                table: "lms_results");

            migrationBuilder.DropColumn(
                name: "authorized_version_number",
                table: "lms_results");
        }
    }
}
