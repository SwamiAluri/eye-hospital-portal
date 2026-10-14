using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace LaboratoryApi.Migrations
{
    /// <inheritdoc />
    public partial class AddLmsOrderTables : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "lms_order_idempotency",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    tenant_id = table.Column<Guid>(type: "uuid", nullable: false),
                    idempotency_key = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    operation = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: false),
                    request_hash = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: false),
                    order_id = table.Column<Guid>(type: "uuid", nullable: false),
                    response_json = table.Column<string>(type: "text", nullable: false),
                    created_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_lms_order_idempotency", x => x.id);
                });

            migrationBuilder.CreateTable(
                name: "lms_order_number_sequences",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    tenant_id = table.Column<Guid>(type: "uuid", nullable: false),
                    sequence_date = table.Column<DateOnly>(type: "date", nullable: false),
                    last_value = table.Column<int>(type: "integer", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_lms_order_number_sequences", x => x.id);
                });

            migrationBuilder.CreateTable(
                name: "lms_order_selections",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    tenant_id = table.Column<Guid>(type: "uuid", nullable: false),
                    order_version_id = table.Column<Guid>(type: "uuid", nullable: false),
                    catalogue_item_id = table.Column<Guid>(type: "uuid", nullable: false),
                    catalogue_version_id = table.Column<Guid>(type: "uuid", nullable: true),
                    catalogue_type = table.Column<string>(type: "character varying(32)", maxLength: 32, nullable: false),
                    sort_order = table.Column<int>(type: "integer", nullable: false),
                    display_name_snapshot = table.Column<string>(type: "character varying(256)", maxLength: 256, nullable: true),
                    internal_order_code_snapshot = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_lms_order_selections", x => x.id);
                });

            migrationBuilder.CreateTable(
                name: "lms_order_tests",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    tenant_id = table.Column<Guid>(type: "uuid", nullable: false),
                    order_version_id = table.Column<Guid>(type: "uuid", nullable: false),
                    catalogue_item_id = table.Column<Guid>(type: "uuid", nullable: false),
                    catalogue_version_id = table.Column<Guid>(type: "uuid", nullable: false),
                    catalogue_version_number = table.Column<int>(type: "integer", nullable: false),
                    catalogue_type = table.Column<string>(type: "character varying(32)", maxLength: 32, nullable: false),
                    display_name_snapshot = table.Column<string>(type: "character varying(256)", maxLength: 256, nullable: false),
                    internal_order_code_snapshot = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: false),
                    status = table.Column<string>(type: "character varying(32)", maxLength: 32, nullable: false),
                    sort_order = table.Column<int>(type: "integer", nullable: false),
                    panel_catalogue_item_id = table.Column<Guid>(type: "uuid", nullable: true),
                    panel_catalogue_version_id = table.Column<Guid>(type: "uuid", nullable: true),
                    panel_selection_id = table.Column<Guid>(type: "uuid", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_lms_order_tests", x => x.id);
                });

            migrationBuilder.CreateTable(
                name: "lms_order_versions",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    tenant_id = table.Column<Guid>(type: "uuid", nullable: false),
                    order_id = table.Column<Guid>(type: "uuid", nullable: false),
                    version_number = table.Column<int>(type: "integer", nullable: false),
                    patient_id = table.Column<Guid>(type: "uuid", nullable: false),
                    patient_mrn_snapshot = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: true),
                    patient_name_snapshot = table.Column<string>(type: "character varying(300)", maxLength: 300, nullable: true),
                    patient_dob_snapshot = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    visit_id = table.Column<Guid>(type: "uuid", nullable: true),
                    ordering_provider_user_id = table.Column<Guid>(type: "uuid", nullable: false),
                    ordering_provider_name_snapshot = table.Column<string>(type: "character varying(300)", maxLength: 300, nullable: true),
                    responsible_clinician_user_id = table.Column<Guid>(type: "uuid", nullable: false),
                    responsible_clinician_name_snapshot = table.Column<string>(type: "character varying(300)", maxLength: 300, nullable: true),
                    operating_branch_id = table.Column<Guid>(type: "uuid", nullable: false),
                    performing_branch_id = table.Column<Guid>(type: "uuid", nullable: false),
                    order_source = table.Column<string>(type: "character varying(32)", maxLength: 32, nullable: false),
                    priority = table.Column<string>(type: "character varying(16)", maxLength: 16, nullable: false),
                    priority_reason = table.Column<string>(type: "character varying(2000)", maxLength: 2000, nullable: true),
                    clinical_indication = table.Column<string>(type: "character varying(4000)", maxLength: 4000, nullable: false),
                    notes = table.Column<string>(type: "character varying(4000)", maxLength: 4000, nullable: true),
                    consent_reference = table.Column<string>(type: "character varying(128)", maxLength: 128, nullable: true),
                    consent_template_version_ref = table.Column<string>(type: "character varying(128)", maxLength: 128, nullable: true),
                    acknowledgement_evidence = table.Column<string>(type: "character varying(4000)", maxLength: 4000, nullable: true),
                    payer_context_ref = table.Column<string>(type: "character varying(128)", maxLength: 128, nullable: true),
                    authorization_reference = table.Column<string>(type: "character varying(128)", maxLength: 128, nullable: true),
                    financial_disposition_ref = table.Column<string>(type: "character varying(128)", maxLength: 128, nullable: true),
                    service_catalog_ref = table.Column<string>(type: "character varying(128)", maxLength: 128, nullable: true),
                    amendment_reason = table.Column<string>(type: "character varying(2000)", maxLength: 2000, nullable: true),
                    created_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    created_by = table.Column<Guid>(type: "uuid", nullable: false),
                    submitted_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    submitted_by = table.Column<Guid>(type: "uuid", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_lms_order_versions", x => x.id);
                });

            migrationBuilder.CreateTable(
                name: "lms_orders",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    tenant_id = table.Column<Guid>(type: "uuid", nullable: false),
                    order_number = table.Column<string>(type: "character varying(32)", maxLength: 32, nullable: false),
                    status = table.Column<string>(type: "character varying(32)", maxLength: 32, nullable: false),
                    current_version_id = table.Column<Guid>(type: "uuid", nullable: true),
                    current_version_number = table.Column<int>(type: "integer", nullable: false),
                    operating_branch_id = table.Column<Guid>(type: "uuid", nullable: false),
                    created_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    created_by = table.Column<Guid>(type: "uuid", nullable: false),
                    updated_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    updated_by = table.Column<Guid>(type: "uuid", nullable: true),
                    cancelled_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    cancelled_by = table.Column<Guid>(type: "uuid", nullable: true),
                    cancel_reason = table.Column<string>(type: "character varying(2000)", maxLength: 2000, nullable: true),
                    row_version = table.Column<int>(type: "integer", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_lms_orders", x => x.id);
                    table.ForeignKey(
                        name: "FK_lms_orders_lms_order_versions_current_version_id",
                        column: x => x.current_version_id,
                        principalTable: "lms_order_versions",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateIndex(
                name: "IX_lms_order_idempotency_tenant_id_idempotency_key",
                table: "lms_order_idempotency",
                columns: new[] { "tenant_id", "idempotency_key" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_lms_order_number_sequences_tenant_id_sequence_date",
                table: "lms_order_number_sequences",
                columns: new[] { "tenant_id", "sequence_date" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_lms_order_selections_order_version_id_catalogue_item_id",
                table: "lms_order_selections",
                columns: new[] { "order_version_id", "catalogue_item_id" });

            migrationBuilder.CreateIndex(
                name: "IX_lms_order_selections_order_version_id_sort_order",
                table: "lms_order_selections",
                columns: new[] { "order_version_id", "sort_order" });

            migrationBuilder.CreateIndex(
                name: "IX_lms_order_tests_order_version_id_panel_catalogue_item_id",
                table: "lms_order_tests",
                columns: new[] { "order_version_id", "panel_catalogue_item_id" });

            migrationBuilder.CreateIndex(
                name: "IX_lms_order_tests_order_version_id_sort_order",
                table: "lms_order_tests",
                columns: new[] { "order_version_id", "sort_order" });

            migrationBuilder.CreateIndex(
                name: "IX_lms_order_tests_tenant_id_catalogue_version_id",
                table: "lms_order_tests",
                columns: new[] { "tenant_id", "catalogue_version_id" });

            migrationBuilder.CreateIndex(
                name: "IX_lms_order_versions_order_id_version_number",
                table: "lms_order_versions",
                columns: new[] { "order_id", "version_number" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_lms_order_versions_tenant_id_patient_id",
                table: "lms_order_versions",
                columns: new[] { "tenant_id", "patient_id" });

            migrationBuilder.CreateIndex(
                name: "IX_lms_order_versions_tenant_id_visit_id",
                table: "lms_order_versions",
                columns: new[] { "tenant_id", "visit_id" });

            migrationBuilder.CreateIndex(
                name: "IX_lms_orders_current_version_id",
                table: "lms_orders",
                column: "current_version_id");

            migrationBuilder.CreateIndex(
                name: "IX_lms_orders_tenant_id",
                table: "lms_orders",
                column: "tenant_id");

            migrationBuilder.CreateIndex(
                name: "IX_lms_orders_tenant_id_operating_branch_id",
                table: "lms_orders",
                columns: new[] { "tenant_id", "operating_branch_id" });

            migrationBuilder.CreateIndex(
                name: "IX_lms_orders_tenant_id_order_number",
                table: "lms_orders",
                columns: new[] { "tenant_id", "order_number" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_lms_orders_tenant_id_status",
                table: "lms_orders",
                columns: new[] { "tenant_id", "status" });

            migrationBuilder.AddForeignKey(
                name: "FK_lms_order_selections_lms_order_versions_order_version_id",
                table: "lms_order_selections",
                column: "order_version_id",
                principalTable: "lms_order_versions",
                principalColumn: "id",
                onDelete: ReferentialAction.Cascade);

            migrationBuilder.AddForeignKey(
                name: "FK_lms_order_tests_lms_order_versions_order_version_id",
                table: "lms_order_tests",
                column: "order_version_id",
                principalTable: "lms_order_versions",
                principalColumn: "id",
                onDelete: ReferentialAction.Cascade);

            migrationBuilder.AddForeignKey(
                name: "FK_lms_order_versions_lms_orders_order_id",
                table: "lms_order_versions",
                column: "order_id",
                principalTable: "lms_orders",
                principalColumn: "id",
                onDelete: ReferentialAction.Restrict);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_lms_orders_lms_order_versions_current_version_id",
                table: "lms_orders");

            migrationBuilder.DropTable(
                name: "lms_order_idempotency");

            migrationBuilder.DropTable(
                name: "lms_order_number_sequences");

            migrationBuilder.DropTable(
                name: "lms_order_selections");

            migrationBuilder.DropTable(
                name: "lms_order_tests");

            migrationBuilder.DropTable(
                name: "lms_order_versions");

            migrationBuilder.DropTable(
                name: "lms_orders");
        }
    }
}
