using System;
using LaboratoryApi.Data;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace LaboratoryApi.Migrations
{
    /// <summary>L-REP-02A — Finalization metadata on lms_reports (actor + UTC time).</summary>
    [DbContext(typeof(LaboratoryDbContext))]
    [Migration("20261012190000_AddLmsReportFinalizationMetadata")]
    public partial class AddLmsReportFinalizationMetadata : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<DateTime>(
                name: "finalized_at_utc",
                table: "lms_reports",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "finalized_by_user_id",
                table: "lms_reports",
                type: "uuid",
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(name: "finalized_at_utc", table: "lms_reports");
            migrationBuilder.DropColumn(name: "finalized_by_user_id", table: "lms_reports");
        }
    }
}
