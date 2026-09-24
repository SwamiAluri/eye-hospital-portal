using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace AuthService.Data.Migrations
{
    /// <summary>
    /// Phase 3I Slice 7 (PD-S7-01) — optimistic concurrency token for counseling_sessions.
    /// Additive-only: adds `version` defaulting to 1 for existing rows.
    /// </summary>
    public partial class AddCounselingSessionVersion : Migration
    {
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql("""
                ALTER TABLE counseling_sessions ADD COLUMN IF NOT EXISTS version integer NOT NULL DEFAULT 1;
                UPDATE counseling_sessions SET version = 1 WHERE version IS NULL;
                """);
        }

        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql("""
                ALTER TABLE counseling_sessions DROP COLUMN IF EXISTS version;
                """);
        }
    }
}
