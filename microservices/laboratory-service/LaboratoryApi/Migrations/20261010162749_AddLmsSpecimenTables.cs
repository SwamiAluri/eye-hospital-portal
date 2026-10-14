using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace LaboratoryApi.Migrations
{
    /// <inheritdoc />
    public partial class AddLmsSpecimenTables : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "lms_specimen_idempotency",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    tenant_id = table.Column<Guid>(type: "uuid", nullable: false),
                    idempotency_key = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    operation = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: false),
                    request_hash = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: false),
                    specimen_id = table.Column<Guid>(type: "uuid", nullable: false),
                    response_json = table.Column<string>(type: "text", nullable: false),
                    created_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_lms_specimen_idempotency", x => x.id);
                });

            migrationBuilder.CreateTable(
                name: "lms_specimens",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    tenant_id = table.Column<Guid>(type: "uuid", nullable: false),
                    collection_task_id = table.Column<Guid>(type: "uuid", nullable: false),
                    order_id = table.Column<Guid>(type: "uuid", nullable: false),
                    patient_id = table.Column<Guid>(type: "uuid", nullable: false),
                    patient_mrn_snapshot = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: true),
                    patient_name_snapshot = table.Column<string>(type: "character varying(256)", maxLength: 256, nullable: true),
                    patient_date_of_birth_snapshot = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    collection_branch_id = table.Column<Guid>(type: "uuid", nullable: false),
                    location_text = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: true),
                    collected_by_user_id = table.Column<Guid>(type: "uuid", nullable: false),
                    collected_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    status = table.Column<string>(type: "character varying(32)", maxLength: 32, nullable: false),
                    created_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    created_by = table.Column<Guid>(type: "uuid", nullable: false),
                    updated_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    updated_by = table.Column<Guid>(type: "uuid", nullable: true),
                    row_version = table.Column<int>(type: "integer", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_lms_specimens", x => x.id);
                });

            migrationBuilder.CreateTable(
                name: "lms_specimen_order_tests",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    tenant_id = table.Column<Guid>(type: "uuid", nullable: false),
                    specimen_id = table.Column<Guid>(type: "uuid", nullable: false),
                    order_id = table.Column<Guid>(type: "uuid", nullable: false),
                    order_test_id = table.Column<Guid>(type: "uuid", nullable: false),
                    sort_order = table.Column<int>(type: "integer", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_lms_specimen_order_tests", x => x.id);
                    table.ForeignKey(
                        name: "FK_lms_specimen_order_tests_lms_specimens_specimen_id",
                        column: x => x.specimen_id,
                        principalTable: "lms_specimens",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_lms_specimen_idempotency_tenant_id_idempotency_key",
                table: "lms_specimen_idempotency",
                columns: new[] { "tenant_id", "idempotency_key" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_lms_specimen_order_tests_specimen_id_order_test_id",
                table: "lms_specimen_order_tests",
                columns: new[] { "specimen_id", "order_test_id" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_lms_specimen_order_tests_tenant_id_order_id",
                table: "lms_specimen_order_tests",
                columns: new[] { "tenant_id", "order_id" });

            migrationBuilder.CreateIndex(
                name: "IX_lms_specimen_order_tests_tenant_id_order_test_id",
                table: "lms_specimen_order_tests",
                columns: new[] { "tenant_id", "order_test_id" });

            migrationBuilder.CreateIndex(
                name: "IX_lms_specimens_tenant_id",
                table: "lms_specimens",
                column: "tenant_id");

            migrationBuilder.CreateIndex(
                name: "IX_lms_specimens_tenant_id_collection_branch_id",
                table: "lms_specimens",
                columns: new[] { "tenant_id", "collection_branch_id" });

            migrationBuilder.CreateIndex(
                name: "IX_lms_specimens_tenant_id_collection_task_id",
                table: "lms_specimens",
                columns: new[] { "tenant_id", "collection_task_id" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_lms_specimens_tenant_id_order_id",
                table: "lms_specimens",
                columns: new[] { "tenant_id", "order_id" });

            migrationBuilder.CreateIndex(
                name: "IX_lms_specimens_tenant_id_patient_id",
                table: "lms_specimens",
                columns: new[] { "tenant_id", "patient_id" });

            migrationBuilder.CreateIndex(
                name: "IX_lms_specimens_tenant_id_status",
                table: "lms_specimens",
                columns: new[] { "tenant_id", "status" });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "lms_specimen_idempotency");

            migrationBuilder.DropTable(
                name: "lms_specimen_order_tests");

            migrationBuilder.DropTable(
                name: "lms_specimens");
        }
    }
}
