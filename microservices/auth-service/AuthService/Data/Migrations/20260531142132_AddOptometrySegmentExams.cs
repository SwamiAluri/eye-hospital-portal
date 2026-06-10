using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace AuthService.Data.Migrations
{
    /// <inheritdoc />
    /// <summary>
    /// Idempotent migration: optometry segment exams + visit station support only.
    /// Avoids unrelated model-drift operations that fail on partial databases.
    /// </summary>
    public partial class AddOptometrySegmentExams : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql("""
                ALTER TABLE visits ADD COLUMN IF NOT EXISTS active_room_code character varying(50);
                ALTER TABLE visits ADD COLUMN IF NOT EXISTS optometry_pass_count integer NOT NULL DEFAULT 0;
                """);

            migrationBuilder.Sql("""
                CREATE TABLE IF NOT EXISTS visit_station_events (
                    id uuid NOT NULL PRIMARY KEY,
                    tenant_id uuid NOT NULL,
                    branch_id uuid NOT NULL,
                    visit_id uuid NOT NULL REFERENCES visits(id) ON DELETE CASCADE,
                    patient_id uuid NOT NULL,
                    station character varying(50) NOT NULL,
                    event_type character varying(30) NOT NULL,
                    pass_number integer NOT NULL DEFAULT 1,
                    reason_code character varying(50),
                    reason_notes text,
                    assigned_to_user_id uuid,
                    room_code character varying(50),
                    queue_item_id uuid,
                    metadata jsonb NOT NULL DEFAULT '{}',
                    created_at timestamp with time zone NOT NULL,
                    created_by_user_id uuid
                );
                CREATE INDEX IF NOT EXISTS "IX_visit_station_events_visit_id_station_created_at"
                    ON visit_station_events (visit_id, station, created_at);
                CREATE INDEX IF NOT EXISTS "IX_visit_station_events_branch_id_station_created_at"
                    ON visit_station_events (branch_id, station, created_at);
                """);

            migrationBuilder.Sql("""
                CREATE TABLE IF NOT EXISTS optometry_segment_exams (
                    id uuid NOT NULL PRIMARY KEY,
                    tenant_id uuid NOT NULL,
                    visit_id uuid NOT NULL REFERENCES visits(id) ON DELETE CASCADE,
                    patient_id uuid NOT NULL,
                    segment_key character varying(64) NOT NULL,
                    data text NOT NULL,
                    updated_by uuid,
                    created_at timestamp with time zone NOT NULL,
                    updated_at timestamp with time zone NOT NULL
                );
                CREATE UNIQUE INDEX IF NOT EXISTS "IX_optometry_segment_exams_visit_id_segment_key"
                    ON optometry_segment_exams (visit_id, segment_key);
                CREATE INDEX IF NOT EXISTS "IX_optometry_segment_exams_tenant_id_visit_id"
                    ON optometry_segment_exams (tenant_id, visit_id);
                """);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql("DROP TABLE IF EXISTS optometry_segment_exams;");
            migrationBuilder.Sql("DROP TABLE IF EXISTS visit_station_events;");
            migrationBuilder.Sql("""
                ALTER TABLE visits DROP COLUMN IF EXISTS active_room_code;
                ALTER TABLE visits DROP COLUMN IF EXISTS optometry_pass_count;
                """);
        }
    }
}
