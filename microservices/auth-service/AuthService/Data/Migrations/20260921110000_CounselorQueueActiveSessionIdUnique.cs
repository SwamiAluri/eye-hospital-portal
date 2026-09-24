using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace AuthService.Data.Migrations
{
    /// <summary>
    /// Phase 3I Slice 8 — CounselorQueue uniqueness applies only to active (non-deleted) rows.
    /// Preserves ReQueue soft-delete + create-new-Waiting semantics against live PostgreSQL.
    /// Replaces unconditional UNIQUE(session_id) with UNIQUE(session_id) WHERE deleted_at IS NULL.
    /// </summary>
    public partial class CounselorQueueActiveSessionIdUnique : Migration
    {
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql("""
                ALTER TABLE counselor_queue
                    DROP CONSTRAINT IF EXISTS counselor_queue_session_id_key;

                DROP INDEX IF EXISTS counselor_queue_session_id_key;

                CREATE UNIQUE INDEX IF NOT EXISTS ux_counselor_queue_session_id_active
                    ON counselor_queue (session_id)
                    WHERE deleted_at IS NULL;
                """);
        }

        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql("""
                DROP INDEX IF EXISTS ux_counselor_queue_session_id_active;

                ALTER TABLE counselor_queue
                    ADD CONSTRAINT counselor_queue_session_id_key UNIQUE (session_id);
                """);
        }
    }
}
