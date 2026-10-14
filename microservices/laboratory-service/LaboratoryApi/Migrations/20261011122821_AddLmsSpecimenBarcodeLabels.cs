using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace LaboratoryApi.Migrations
{
    /// <inheritdoc />
    public partial class AddLmsSpecimenBarcodeLabels : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // L-COL-01E only — do not alter lms_specimens accession / receive / reject columns.

            migrationBuilder.CreateTable(
                name: "lms_barcode_number_sequences",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    tenant_id = table.Column<Guid>(type: "uuid", nullable: false),
                    sequence_date = table.Column<DateOnly>(type: "date", nullable: false),
                    last_value = table.Column<int>(type: "integer", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_lms_barcode_number_sequences", x => x.id);
                    table.CheckConstraint("CK_lms_barcode_number_sequences_last_value", "last_value >= 0 AND last_value <= 999999");
                });

            migrationBuilder.CreateTable(
                name: "lms_specimen_barcode_configurations",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    tenant_id = table.Column<Guid>(type: "uuid", nullable: false),
                    format_code = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: false),
                    prefix = table.Column<string>(type: "character varying(16)", maxLength: 16, nullable: false),
                    separator = table.Column<string>(type: "character varying(8)", maxLength: 8, nullable: false),
                    date_segment = table.Column<string>(type: "character varying(32)", maxLength: 32, nullable: false),
                    date_timezone = table.Column<string>(type: "character varying(16)", maxLength: 16, nullable: false),
                    sequence_width = table.Column<int>(type: "integer", nullable: false),
                    sequence_period = table.Column<string>(type: "character varying(32)", maxLength: 32, nullable: false),
                    check_digit_policy = table.Column<string>(type: "character varying(32)", maxLength: 32, nullable: false),
                    charset = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: false),
                    max_length = table.Column<int>(type: "integer", nullable: false),
                    symbology = table.Column<string>(type: "character varying(32)", maxLength: 32, nullable: false),
                    scope = table.Column<string>(type: "character varying(32)", maxLength: 32, nullable: false),
                    uniqueness_policy = table.Column<string>(type: "character varying(32)", maxLength: 32, nullable: false),
                    effective_from_utc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    is_active = table.Column<bool>(type: "boolean", nullable: false),
                    created_at_utc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    created_by_user_id = table.Column<Guid>(type: "uuid", nullable: false),
                    updated_at_utc = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    updated_by_user_id = table.Column<Guid>(type: "uuid", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_lms_specimen_barcode_configurations", x => x.id);
                });

            migrationBuilder.CreateTable(
                name: "lms_specimen_barcodes",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    tenant_id = table.Column<Guid>(type: "uuid", nullable: false),
                    specimen_id = table.Column<Guid>(type: "uuid", nullable: false),
                    barcode_value = table.Column<string>(type: "character varying(19)", maxLength: 19, nullable: false),
                    configuration_id = table.Column<Guid>(type: "uuid", nullable: false),
                    format_code = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: false),
                    symbology = table.Column<string>(type: "character varying(32)", maxLength: 32, nullable: false),
                    issued_at_utc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    issued_by_user_id = table.Column<Guid>(type: "uuid", nullable: false),
                    is_active = table.Column<bool>(type: "boolean", nullable: false),
                    row_version = table.Column<int>(type: "integer", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_lms_specimen_barcodes", x => x.id);
                });

            migrationBuilder.CreateTable(
                name: "lms_specimen_label_print_events",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    tenant_id = table.Column<Guid>(type: "uuid", nullable: false),
                    specimen_id = table.Column<Guid>(type: "uuid", nullable: false),
                    barcode_id = table.Column<Guid>(type: "uuid", nullable: false),
                    print_type = table.Column<string>(type: "character varying(32)", maxLength: 32, nullable: false),
                    printed_by_user_id = table.Column<Guid>(type: "uuid", nullable: false),
                    printed_at_utc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    reason = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: true),
                    correlation_id = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_lms_specimen_label_print_events", x => x.id);
                });

            migrationBuilder.CreateIndex(
                name: "IX_lms_barcode_number_sequences_tenant_id_sequence_date",
                table: "lms_barcode_number_sequences",
                columns: new[] { "tenant_id", "sequence_date" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_lms_specimen_barcode_configurations_tenant_id_effective_fro~",
                table: "lms_specimen_barcode_configurations",
                columns: new[] { "tenant_id", "effective_from_utc" });

            migrationBuilder.CreateIndex(
                name: "IX_lms_specimen_barcode_configurations_tenant_id_is_active",
                table: "lms_specimen_barcode_configurations",
                columns: new[] { "tenant_id", "is_active" });

            migrationBuilder.CreateIndex(
                name: "IX_lms_specimen_barcodes_tenant_id_barcode_value",
                table: "lms_specimen_barcodes",
                columns: new[] { "tenant_id", "barcode_value" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_lms_specimen_barcodes_tenant_id_specimen_id_active",
                table: "lms_specimen_barcodes",
                columns: new[] { "tenant_id", "specimen_id" },
                unique: true,
                filter: "is_active = true");

            migrationBuilder.CreateIndex(
                name: "IX_lms_specimen_label_print_events_tenant_id_barcode_id",
                table: "lms_specimen_label_print_events",
                columns: new[] { "tenant_id", "barcode_id" });

            migrationBuilder.CreateIndex(
                name: "IX_lms_specimen_label_print_events_tenant_id_specimen_id_print~",
                table: "lms_specimen_label_print_events",
                columns: new[] { "tenant_id", "specimen_id", "printed_at_utc" });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "lms_barcode_number_sequences");

            migrationBuilder.DropTable(
                name: "lms_specimen_barcode_configurations");

            migrationBuilder.DropTable(
                name: "lms_specimen_barcodes");

            migrationBuilder.DropTable(
                name: "lms_specimen_label_print_events");
        }
    }
}
