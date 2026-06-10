using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace AuthService.Data.Migrations
{
    /// <inheritdoc />
    public partial class AddVisitStationEvents : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "active_room_code",
                table: "visits",
                type: "character varying(50)",
                maxLength: 50,
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "optometry_pass_count",
                table: "visits",
                type: "integer",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.CreateTable(
                name: "visit_station_events",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    tenant_id = table.Column<Guid>(type: "uuid", nullable: false),
                    branch_id = table.Column<Guid>(type: "uuid", nullable: false),
                    visit_id = table.Column<Guid>(type: "uuid", nullable: false),
                    patient_id = table.Column<Guid>(type: "uuid", nullable: false),
                    station = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: false),
                    event_type = table.Column<string>(type: "character varying(30)", maxLength: 30, nullable: false),
                    pass_number = table.Column<int>(type: "integer", nullable: false, defaultValue: 1),
                    reason_code = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: true),
                    reason_notes = table.Column<string>(type: "text", nullable: true),
                    assigned_to_user_id = table.Column<Guid>(type: "uuid", nullable: true),
                    room_code = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: true),
                    queue_item_id = table.Column<Guid>(type: "uuid", nullable: true),
                    metadata = table.Column<string>(type: "jsonb", nullable: false, defaultValue: "{}"),
                    created_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    created_by_user_id = table.Column<Guid>(type: "uuid", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_visit_station_events", x => x.id);
                    table.ForeignKey(
                        name: "FK_visit_station_events_visits_visit_id",
                        column: x => x.visit_id,
                        principalTable: "visits",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_visit_station_events_branch_id_station_created_at",
                table: "visit_station_events",
                columns: new[] { "branch_id", "station", "created_at" });

            migrationBuilder.CreateIndex(
                name: "IX_visit_station_events_visit_id_station_created_at",
                table: "visit_station_events",
                columns: new[] { "visit_id", "station", "created_at" });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(name: "visit_station_events");

            migrationBuilder.DropColumn(name: "active_room_code", table: "visits");
            migrationBuilder.DropColumn(name: "optometry_pass_count", table: "visits");
        }
    }
}
