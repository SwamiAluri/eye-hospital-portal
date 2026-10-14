using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace LaboratoryApi.Migrations
{
    /// <inheritdoc />
    public partial class AddLmsCollectionTaskTables : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "lms_collection_idempotency",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    tenant_id = table.Column<Guid>(type: "uuid", nullable: false),
                    idempotency_key = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    operation = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: false),
                    request_hash = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: false),
                    collection_task_id = table.Column<Guid>(type: "uuid", nullable: false),
                    response_json = table.Column<string>(type: "text", nullable: false),
                    created_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_lms_collection_idempotency", x => x.id);
                });

            migrationBuilder.CreateTable(
                name: "lms_collection_task_number_sequences",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    tenant_id = table.Column<Guid>(type: "uuid", nullable: false),
                    sequence_date = table.Column<DateOnly>(type: "date", nullable: false),
                    last_value = table.Column<int>(type: "integer", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_lms_collection_task_number_sequences", x => x.id);
                });

            migrationBuilder.CreateTable(
                name: "lms_collection_tasks",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    tenant_id = table.Column<Guid>(type: "uuid", nullable: false),
                    task_number = table.Column<string>(type: "character varying(32)", maxLength: 32, nullable: false),
                    order_id = table.Column<Guid>(type: "uuid", nullable: false),
                    collection_branch_id = table.Column<Guid>(type: "uuid", nullable: false),
                    location_text = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: true),
                    status = table.Column<string>(type: "character varying(32)", maxLength: 32, nullable: false),
                    claimed_by_user_id = table.Column<Guid>(type: "uuid", nullable: true),
                    claimed_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    assigned_to_user_id = table.Column<Guid>(type: "uuid", nullable: true),
                    assigned_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    notes = table.Column<string>(type: "character varying(4000)", maxLength: 4000, nullable: true),
                    cancel_reason = table.Column<string>(type: "character varying(2000)", maxLength: 2000, nullable: true),
                    created_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    created_by = table.Column<Guid>(type: "uuid", nullable: false),
                    updated_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    updated_by = table.Column<Guid>(type: "uuid", nullable: true),
                    row_version = table.Column<int>(type: "integer", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_lms_collection_tasks", x => x.id);
                });

            migrationBuilder.CreateTable(
                name: "lms_collection_task_order_tests",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    tenant_id = table.Column<Guid>(type: "uuid", nullable: false),
                    collection_task_id = table.Column<Guid>(type: "uuid", nullable: false),
                    order_id = table.Column<Guid>(type: "uuid", nullable: false),
                    order_test_id = table.Column<Guid>(type: "uuid", nullable: false),
                    sort_order = table.Column<int>(type: "integer", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_lms_collection_task_order_tests", x => x.id);
                    table.ForeignKey(
                        name: "FK_lms_collection_task_order_tests_lms_collection_tasks_collec~",
                        column: x => x.collection_task_id,
                        principalTable: "lms_collection_tasks",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_lms_collection_idempotency_tenant_id_idempotency_key",
                table: "lms_collection_idempotency",
                columns: new[] { "tenant_id", "idempotency_key" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_lms_collection_task_number_sequences_tenant_id_sequence_date",
                table: "lms_collection_task_number_sequences",
                columns: new[] { "tenant_id", "sequence_date" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_lms_collection_task_order_tests_collection_task_id_order_te~",
                table: "lms_collection_task_order_tests",
                columns: new[] { "collection_task_id", "order_test_id" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_lms_collection_task_order_tests_tenant_id_order_id",
                table: "lms_collection_task_order_tests",
                columns: new[] { "tenant_id", "order_id" });

            migrationBuilder.CreateIndex(
                name: "IX_lms_collection_task_order_tests_tenant_id_order_test_id",
                table: "lms_collection_task_order_tests",
                columns: new[] { "tenant_id", "order_test_id" });

            migrationBuilder.CreateIndex(
                name: "IX_lms_collection_tasks_tenant_id",
                table: "lms_collection_tasks",
                column: "tenant_id");

            migrationBuilder.CreateIndex(
                name: "IX_lms_collection_tasks_tenant_id_collection_branch_id",
                table: "lms_collection_tasks",
                columns: new[] { "tenant_id", "collection_branch_id" });

            migrationBuilder.CreateIndex(
                name: "IX_lms_collection_tasks_tenant_id_order_id",
                table: "lms_collection_tasks",
                columns: new[] { "tenant_id", "order_id" });

            migrationBuilder.CreateIndex(
                name: "IX_lms_collection_tasks_tenant_id_status",
                table: "lms_collection_tasks",
                columns: new[] { "tenant_id", "status" });

            migrationBuilder.CreateIndex(
                name: "IX_lms_collection_tasks_tenant_id_task_number",
                table: "lms_collection_tasks",
                columns: new[] { "tenant_id", "task_number" },
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "lms_collection_idempotency");

            migrationBuilder.DropTable(
                name: "lms_collection_task_number_sequences");

            migrationBuilder.DropTable(
                name: "lms_collection_task_order_tests");

            migrationBuilder.DropTable(
                name: "lms_collection_tasks");
        }
    }
}
