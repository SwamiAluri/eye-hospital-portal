using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace LaboratoryApi.Migrations
{
    /// <inheritdoc />
    public partial class AddLmsSpecimenReceivingAccession : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "accession",
                table: "lms_specimens",
                type: "character varying(19)",
                maxLength: 19,
                nullable: true);

            migrationBuilder.AddColumn<DateOnly>(
                name: "accession_date",
                table: "lms_specimens",
                type: "date",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "accession_sequence",
                table: "lms_specimens",
                type: "integer",
                nullable: true);

            migrationBuilder.AddColumn<DateTime>(
                name: "received_at_utc",
                table: "lms_specimens",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "received_by_user_id",
                table: "lms_specimens",
                type: "uuid",
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "receiving_branch_id",
                table: "lms_specimens",
                type: "uuid",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "receiving_location_text",
                table: "lms_specimens",
                type: "character varying(500)",
                maxLength: 500,
                nullable: true);

            migrationBuilder.AddColumn<DateTime>(
                name: "rejected_at_utc",
                table: "lms_specimens",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "rejected_by_user_id",
                table: "lms_specimens",
                type: "uuid",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "rejection_reason_code",
                table: "lms_specimens",
                type: "character varying(150)",
                maxLength: 150,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "rejection_reason_label_snapshot",
                table: "lms_specimens",
                type: "character varying(500)",
                maxLength: 500,
                nullable: true);

            migrationBuilder.CreateTable(
                name: "lms_accession_number_sequences",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    tenant_id = table.Column<Guid>(type: "uuid", nullable: false),
                    sequence_date = table.Column<DateOnly>(type: "date", nullable: false),
                    last_value = table.Column<int>(type: "integer", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_lms_accession_number_sequences", x => x.id);
                });

            migrationBuilder.CreateIndex(
                name: "IX_lms_specimens_tenant_id_accession",
                table: "lms_specimens",
                columns: new[] { "tenant_id", "accession" },
                unique: true,
                filter: "accession IS NOT NULL");

            migrationBuilder.CreateIndex(
                name: "IX_lms_specimens_tenant_id_accession_date_accession_sequence",
                table: "lms_specimens",
                columns: new[] { "tenant_id", "accession_date", "accession_sequence" },
                unique: true,
                filter: "accession_date IS NOT NULL AND accession_sequence IS NOT NULL");

            migrationBuilder.CreateIndex(
                name: "IX_lms_specimens_tenant_id_receiving_branch_id",
                table: "lms_specimens",
                columns: new[] { "tenant_id", "receiving_branch_id" });

            migrationBuilder.CreateIndex(
                name: "IX_lms_accession_number_sequences_tenant_id_sequence_date",
                table: "lms_accession_number_sequences",
                columns: new[] { "tenant_id", "sequence_date" },
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "lms_accession_number_sequences");

            migrationBuilder.DropIndex(
                name: "IX_lms_specimens_tenant_id_accession",
                table: "lms_specimens");

            migrationBuilder.DropIndex(
                name: "IX_lms_specimens_tenant_id_accession_date_accession_sequence",
                table: "lms_specimens");

            migrationBuilder.DropIndex(
                name: "IX_lms_specimens_tenant_id_receiving_branch_id",
                table: "lms_specimens");

            migrationBuilder.DropColumn(
                name: "accession",
                table: "lms_specimens");

            migrationBuilder.DropColumn(
                name: "accession_date",
                table: "lms_specimens");

            migrationBuilder.DropColumn(
                name: "accession_sequence",
                table: "lms_specimens");

            migrationBuilder.DropColumn(
                name: "received_at_utc",
                table: "lms_specimens");

            migrationBuilder.DropColumn(
                name: "received_by_user_id",
                table: "lms_specimens");

            migrationBuilder.DropColumn(
                name: "receiving_branch_id",
                table: "lms_specimens");

            migrationBuilder.DropColumn(
                name: "receiving_location_text",
                table: "lms_specimens");

            migrationBuilder.DropColumn(
                name: "rejected_at_utc",
                table: "lms_specimens");

            migrationBuilder.DropColumn(
                name: "rejected_by_user_id",
                table: "lms_specimens");

            migrationBuilder.DropColumn(
                name: "rejection_reason_code",
                table: "lms_specimens");

            migrationBuilder.DropColumn(
                name: "rejection_reason_label_snapshot",
                table: "lms_specimens");
        }
    }
}
