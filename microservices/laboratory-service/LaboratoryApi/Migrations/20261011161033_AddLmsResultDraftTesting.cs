using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace LaboratoryApi.Migrations
{
    /// <inheritdoc />
    public partial class AddLmsResultDraftTesting : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "lms_result_idempotency",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    tenant_id = table.Column<Guid>(type: "uuid", nullable: false),
                    idempotency_key = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    operation = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: false),
                    request_hash = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: false),
                    result_id = table.Column<Guid>(type: "uuid", nullable: false),
                    response_json = table.Column<string>(type: "text", nullable: false),
                    created_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_lms_result_idempotency", x => x.id);
                });

            migrationBuilder.CreateTable(
                name: "lms_results",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    tenant_id = table.Column<Guid>(type: "uuid", nullable: false),
                    order_id = table.Column<Guid>(type: "uuid", nullable: false),
                    order_test_id = table.Column<Guid>(type: "uuid", nullable: false),
                    specimen_id = table.Column<Guid>(type: "uuid", nullable: false),
                    operating_branch_id = table.Column<Guid>(type: "uuid", nullable: false),
                    catalogue_item_id = table.Column<Guid>(type: "uuid", nullable: false),
                    catalogue_version_id = table.Column<Guid>(type: "uuid", nullable: false),
                    result_datatype = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: false),
                    status = table.Column<string>(type: "character varying(32)", maxLength: 32, nullable: false),
                    current_version_number = table.Column<int>(type: "integer", nullable: false),
                    numeric_value = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: true),
                    qualitative_value = table.Column<string>(type: "character varying(256)", maxLength: 256, nullable: true),
                    unit = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: true),
                    comment = table.Column<string>(type: "character varying(2000)", maxLength: 2000, nullable: true),
                    created_at_utc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    created_by_user_id = table.Column<Guid>(type: "uuid", nullable: false),
                    updated_at_utc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    updated_by_user_id = table.Column<Guid>(type: "uuid", nullable: false),
                    row_version = table.Column<int>(type: "integer", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_lms_results", x => x.id);
                });

            migrationBuilder.CreateTable(
                name: "lms_result_versions",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    tenant_id = table.Column<Guid>(type: "uuid", nullable: false),
                    result_id = table.Column<Guid>(type: "uuid", nullable: false),
                    version_number = table.Column<int>(type: "integer", nullable: false),
                    numeric_value = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: true),
                    qualitative_value = table.Column<string>(type: "character varying(256)", maxLength: 256, nullable: true),
                    unit = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: true),
                    comment = table.Column<string>(type: "character varying(2000)", maxLength: 2000, nullable: true),
                    created_at_utc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    created_by_user_id = table.Column<Guid>(type: "uuid", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_lms_result_versions", x => x.id);
                    table.ForeignKey(
                        name: "FK_lms_result_versions_lms_results_result_id",
                        column: x => x.result_id,
                        principalTable: "lms_results",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_lms_result_idempotency_tenant_id_idempotency_key",
                table: "lms_result_idempotency",
                columns: new[] { "tenant_id", "idempotency_key" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_lms_result_versions_result_id_version_number",
                table: "lms_result_versions",
                columns: new[] { "result_id", "version_number" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_lms_result_versions_tenant_id_result_id",
                table: "lms_result_versions",
                columns: new[] { "tenant_id", "result_id" });

            migrationBuilder.CreateIndex(
                name: "IX_lms_results_tenant_id_operating_branch_id_status",
                table: "lms_results",
                columns: new[] { "tenant_id", "operating_branch_id", "status" });

            migrationBuilder.CreateIndex(
                name: "IX_lms_results_tenant_id_order_id",
                table: "lms_results",
                columns: new[] { "tenant_id", "order_id" });

            migrationBuilder.CreateIndex(
                name: "IX_lms_results_tenant_id_order_test_id_specimen_id",
                table: "lms_results",
                columns: new[] { "tenant_id", "order_test_id", "specimen_id" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_lms_results_tenant_id_specimen_id",
                table: "lms_results",
                columns: new[] { "tenant_id", "specimen_id" });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "lms_result_idempotency");

            migrationBuilder.DropTable(
                name: "lms_result_versions");

            migrationBuilder.DropTable(
                name: "lms_results");
        }
    }
}
