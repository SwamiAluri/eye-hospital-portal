using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace AuthService.Data.Migrations
{
    /// <summary>
    /// FS-G-13 / PD-OTPREP-09 disposition — drop legacy unique partial index that allowed
    /// only one OTPrepared row per tenant/date. Conflicts with multi-patient PrepareOtListAsync.
    /// Verified live: ux_ot_finalize_prepared_date EXISTS AND CONFLICTING (UAT 2026-09-23).
    /// </summary>
    public partial class DropOtFinalizePreparedDateUniqueIndex : Migration
    {
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql("""
                DROP INDEX IF EXISTS ux_ot_finalize_prepared_date;
                """);
        }

        protected override void Down(MigrationBuilder migrationBuilder)
        {
            // Recreate only for emergency rollback — not the intended production model.
            migrationBuilder.Sql("""
                CREATE UNIQUE INDEX IF NOT EXISTS ux_ot_finalize_prepared_date
                    ON ot_finalize_schedule (DATE(start_time AT TIME ZONE 'UTC'), tenant_id)
                    WHERE status = 'OTPrepared'
                      AND deleted_at IS NULL;
                """);
        }
    }
}
