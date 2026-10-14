using System;
using LaboratoryApi.Data;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace LaboratoryApi.Migrations
{
    /// <summary>L-REP-02B — Release metadata on lms_reports (actor + UTC time).</summary>
    [DbContext(typeof(LaboratoryDbContext))]
    [Migration("20261012200000_AddLmsReportReleaseMetadata")]
    public partial class AddLmsReportReleaseMetadata : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<DateTime>(
                name: "released_at_utc",
                table: "lms_reports",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "released_by_user_id",
                table: "lms_reports",
                type: "uuid",
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(name: "released_at_utc", table: "lms_reports");
            migrationBuilder.DropColumn(name: "released_by_user_id", table: "lms_reports");
        }
    }
}
