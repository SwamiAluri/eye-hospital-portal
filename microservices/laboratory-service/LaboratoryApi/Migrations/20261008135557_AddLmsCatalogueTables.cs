using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace LaboratoryApi.Migrations
{
    /// <inheritdoc />
    public partial class AddLmsCatalogueTables : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "lms_catalogue_branch_applicability",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    tenant_id = table.Column<Guid>(type: "uuid", nullable: false),
                    catalogue_version_id = table.Column<Guid>(type: "uuid", nullable: false),
                    branch_id = table.Column<Guid>(type: "uuid", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_lms_catalogue_branch_applicability", x => x.id);
                });

            migrationBuilder.CreateTable(
                name: "lms_catalogue_items",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    tenant_id = table.Column<Guid>(type: "uuid", nullable: false),
                    catalogue_type = table.Column<string>(type: "character varying(32)", maxLength: 32, nullable: false),
                    current_active_version_id = table.Column<Guid>(type: "uuid", nullable: true),
                    latest_version_id = table.Column<Guid>(type: "uuid", nullable: true),
                    created_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    created_by = table.Column<Guid>(type: "uuid", nullable: false),
                    updated_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    updated_by = table.Column<Guid>(type: "uuid", nullable: true),
                    is_deleted = table.Column<bool>(type: "boolean", nullable: false, defaultValue: false),
                    deleted_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    deleted_by = table.Column<Guid>(type: "uuid", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_lms_catalogue_items", x => x.id);
                });

            migrationBuilder.CreateTable(
                name: "lms_catalogue_versions",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    tenant_id = table.Column<Guid>(type: "uuid", nullable: false),
                    catalogue_item_id = table.Column<Guid>(type: "uuid", nullable: false),
                    version_number = table.Column<int>(type: "integer", nullable: false),
                    status = table.Column<string>(type: "character varying(32)", maxLength: 32, nullable: false),
                    effective_from = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    effective_to = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    internal_order_code = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: false),
                    display_name = table.Column<string>(type: "character varying(256)", maxLength: 256, nullable: false),
                    synonyms = table.Column<string>(type: "character varying(1024)", maxLength: 1024, nullable: true),
                    external_mappings_json = table.Column<string>(type: "text", nullable: true),
                    discipline = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: false),
                    method = table.Column<string>(type: "character varying(256)", maxLength: 256, nullable: true),
                    classification = table.Column<string>(type: "character varying(32)", maxLength: 32, nullable: false),
                    orderable = table.Column<bool>(type: "boolean", nullable: false, defaultValue: true),
                    priority_config_ref = table.Column<string>(type: "character varying(128)", maxLength: 128, nullable: true),
                    age_sex_restriction_config_ref = table.Column<string>(type: "character varying(128)", maxLength: 128, nullable: true),
                    consent_required = table.Column<bool>(type: "boolean", nullable: true),
                    preparation_instruction = table.Column<string>(type: "character varying(2000)", maxLength: 2000, nullable: true),
                    duplicate_interval_config_ref = table.Column<string>(type: "character varying(128)", maxLength: 128, nullable: true),
                    add_on_window_config_ref = table.Column<string>(type: "character varying(128)", maxLength: 128, nullable: true),
                    specimen_type_ref = table.Column<string>(type: "character varying(128)", maxLength: 128, nullable: true),
                    container_ref = table.Column<string>(type: "character varying(128)", maxLength: 128, nullable: true),
                    required_volume = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: true),
                    patient_preparation = table.Column<string>(type: "character varying(2000)", maxLength: 2000, nullable: true),
                    collection_timing = table.Column<string>(type: "character varying(256)", maxLength: 256, nullable: true),
                    stability_notes = table.Column<string>(type: "character varying(2000)", maxLength: 2000, nullable: true),
                    temperature_light_protection = table.Column<string>(type: "character varying(512)", maxLength: 512, nullable: true),
                    rejection_criteria = table.Column<string>(type: "character varying(2000)", maxLength: 2000, nullable: true),
                    storage_requirements = table.Column<string>(type: "character varying(1000)", maxLength: 1000, nullable: true),
                    transport_requirements = table.Column<string>(type: "character varying(1000)", maxLength: 1000, nullable: true),
                    performing_site_ref = table.Column<string>(type: "character varying(128)", maxLength: 128, nullable: true),
                    bench_ref = table.Column<string>(type: "character varying(128)", maxLength: 128, nullable: true),
                    instrument_ref = table.Column<string>(type: "character varying(128)", maxLength: 128, nullable: true),
                    expected_tat_config_ref = table.Column<string>(type: "character varying(128)", maxLength: 128, nullable: true),
                    operating_hours_config_ref = table.Column<string>(type: "character varying(128)", maxLength: 128, nullable: true),
                    routing_config_ref = table.Column<string>(type: "character varying(128)", maxLength: 128, nullable: true),
                    capacity_config_ref = table.Column<string>(type: "character varying(128)", maxLength: 128, nullable: true),
                    referral_partner_ref = table.Column<string>(type: "character varying(128)", maxLength: 128, nullable: true),
                    result_datatype = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: true),
                    permitted_units = table.Column<string>(type: "character varying(256)", maxLength: 256, nullable: true),
                    reference_interval_config_ref = table.Column<string>(type: "character varying(128)", maxLength: 128, nullable: true),
                    reportability_limit_config_ref = table.Column<string>(type: "character varying(128)", maxLength: 128, nullable: true),
                    flag_config_ref = table.Column<string>(type: "character varying(128)", maxLength: 128, nullable: true),
                    critical_threshold_config_ref = table.Column<string>(type: "character varying(128)", maxLength: 128, nullable: true),
                    delta_check_config_ref = table.Column<string>(type: "character varying(128)", maxLength: 128, nullable: true),
                    comment_template_ref = table.Column<string>(type: "character varying(128)", maxLength: 128, nullable: true),
                    autoverification_eligibility_ref = table.Column<string>(type: "character varying(128)", maxLength: 128, nullable: true),
                    service_catalog_ref = table.Column<string>(type: "character varying(128)", maxLength: 128, nullable: true),
                    payer_mapping_ref = table.Column<string>(type: "character varying(128)", maxLength: 128, nullable: true),
                    package_membership_ref = table.Column<string>(type: "character varying(128)", maxLength: 128, nullable: true),
                    authorization_required = table.Column<bool>(type: "boolean", nullable: true),
                    accreditation_scope_status = table.Column<string>(type: "character varying(128)", maxLength: 128, nullable: true),
                    owner_ref = table.Column<string>(type: "character varying(128)", maxLength: 128, nullable: true),
                    approver_ref = table.Column<string>(type: "character varying(128)", maxLength: 128, nullable: true),
                    change_reason = table.Column<string>(type: "character varying(2000)", maxLength: 2000, nullable: true),
                    created_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    created_by = table.Column<Guid>(type: "uuid", nullable: false),
                    updated_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    updated_by = table.Column<Guid>(type: "uuid", nullable: true),
                    submitted_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    submitted_by = table.Column<Guid>(type: "uuid", nullable: true),
                    approved_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    approved_by = table.Column<Guid>(type: "uuid", nullable: true),
                    activated_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    activated_by = table.Column<Guid>(type: "uuid", nullable: true),
                    retired_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    retired_by = table.Column<Guid>(type: "uuid", nullable: true),
                    superseded_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    superseded_by = table.Column<Guid>(type: "uuid", nullable: true),
                    superseded_by_version_id = table.Column<Guid>(type: "uuid", nullable: true),
                    row_version = table.Column<int>(type: "integer", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_lms_catalogue_versions", x => x.id);
                    table.ForeignKey(
                        name: "FK_lms_catalogue_versions_lms_catalogue_items_catalogue_item_id",
                        column: x => x.catalogue_item_id,
                        principalTable: "lms_catalogue_items",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "lms_catalogue_panel_components",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    tenant_id = table.Column<Guid>(type: "uuid", nullable: false),
                    panel_version_id = table.Column<Guid>(type: "uuid", nullable: false),
                    component_catalogue_item_id = table.Column<Guid>(type: "uuid", nullable: false),
                    component_version_id = table.Column<Guid>(type: "uuid", nullable: false),
                    sort_order = table.Column<int>(type: "integer", nullable: false),
                    is_required = table.Column<bool>(type: "boolean", nullable: false, defaultValue: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_lms_catalogue_panel_components", x => x.id);
                    table.ForeignKey(
                        name: "FK_lms_catalogue_panel_components_lms_catalogue_versions_panel~",
                        column: x => x.panel_version_id,
                        principalTable: "lms_catalogue_versions",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_lms_catalogue_branch_applicability_catalogue_version_id_bra~",
                table: "lms_catalogue_branch_applicability",
                columns: new[] { "catalogue_version_id", "branch_id" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_lms_catalogue_branch_applicability_tenant_id_branch_id",
                table: "lms_catalogue_branch_applicability",
                columns: new[] { "tenant_id", "branch_id" });

            migrationBuilder.CreateIndex(
                name: "IX_lms_catalogue_items_current_active_version_id",
                table: "lms_catalogue_items",
                column: "current_active_version_id");

            migrationBuilder.CreateIndex(
                name: "IX_lms_catalogue_items_latest_version_id",
                table: "lms_catalogue_items",
                column: "latest_version_id");

            migrationBuilder.CreateIndex(
                name: "IX_lms_catalogue_items_tenant_id",
                table: "lms_catalogue_items",
                column: "tenant_id");

            migrationBuilder.CreateIndex(
                name: "IX_lms_catalogue_items_tenant_id_catalogue_type",
                table: "lms_catalogue_items",
                columns: new[] { "tenant_id", "catalogue_type" });

            migrationBuilder.CreateIndex(
                name: "IX_lms_catalogue_panel_components_panel_version_id_component_c~",
                table: "lms_catalogue_panel_components",
                columns: new[] { "panel_version_id", "component_catalogue_item_id" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_lms_catalogue_panel_components_panel_version_id_sort_order",
                table: "lms_catalogue_panel_components",
                columns: new[] { "panel_version_id", "sort_order" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_lms_catalogue_versions_catalogue_item_id_version_number",
                table: "lms_catalogue_versions",
                columns: new[] { "catalogue_item_id", "version_number" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_lms_catalogue_versions_tenant_id_classification",
                table: "lms_catalogue_versions",
                columns: new[] { "tenant_id", "classification" });

            migrationBuilder.CreateIndex(
                name: "IX_lms_catalogue_versions_tenant_id_discipline",
                table: "lms_catalogue_versions",
                columns: new[] { "tenant_id", "discipline" });

            migrationBuilder.CreateIndex(
                name: "IX_lms_catalogue_versions_tenant_id_display_name",
                table: "lms_catalogue_versions",
                columns: new[] { "tenant_id", "display_name" });

            migrationBuilder.CreateIndex(
                name: "IX_lms_catalogue_versions_tenant_id_internal_order_code",
                table: "lms_catalogue_versions",
                columns: new[] { "tenant_id", "internal_order_code" });

            migrationBuilder.CreateIndex(
                name: "IX_lms_catalogue_versions_tenant_id_status",
                table: "lms_catalogue_versions",
                columns: new[] { "tenant_id", "status" });

            migrationBuilder.AddForeignKey(
                name: "FK_lms_catalogue_branch_applicability_lms_catalogue_versions_c~",
                table: "lms_catalogue_branch_applicability",
                column: "catalogue_version_id",
                principalTable: "lms_catalogue_versions",
                principalColumn: "id",
                onDelete: ReferentialAction.Cascade);

            migrationBuilder.AddForeignKey(
                name: "FK_lms_catalogue_items_lms_catalogue_versions_current_active_v~",
                table: "lms_catalogue_items",
                column: "current_active_version_id",
                principalTable: "lms_catalogue_versions",
                principalColumn: "id",
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.AddForeignKey(
                name: "FK_lms_catalogue_items_lms_catalogue_versions_latest_version_id",
                table: "lms_catalogue_items",
                column: "latest_version_id",
                principalTable: "lms_catalogue_versions",
                principalColumn: "id",
                onDelete: ReferentialAction.Restrict);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_lms_catalogue_items_lms_catalogue_versions_current_active_v~",
                table: "lms_catalogue_items");

            migrationBuilder.DropForeignKey(
                name: "FK_lms_catalogue_items_lms_catalogue_versions_latest_version_id",
                table: "lms_catalogue_items");

            migrationBuilder.DropTable(
                name: "lms_catalogue_branch_applicability");

            migrationBuilder.DropTable(
                name: "lms_catalogue_panel_components");

            migrationBuilder.DropTable(
                name: "lms_catalogue_versions");

            migrationBuilder.DropTable(
                name: "lms_catalogue_items");
        }
    }
}
