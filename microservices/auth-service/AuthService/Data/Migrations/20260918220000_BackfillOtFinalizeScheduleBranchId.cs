using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace AuthService.Data.Migrations
{
    /// <summary>
    /// Phase 3I Slice 9 (PD-S9-12) — backfill ot_finalize_schedule.branch_id from the linked
    /// counseling_sessions.branch_id when authoritative.
    /// Does not invent branch for rows without a linked session branch.
    /// </summary>
    public partial class BackfillOtFinalizeScheduleBranchId : Migration
    {
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql("""
                UPDATE ot_finalize_schedule ofs
                SET branch_id = cs.branch_id
                FROM counseling_sessions cs
                WHERE ofs.counselling_session_id = cs.id
                  AND ofs.tenant_id = cs.tenant_id
                  AND ofs.branch_id IS NULL
                  AND cs.branch_id IS NOT NULL;
                """);
        }

        protected override void Down(MigrationBuilder migrationBuilder)
        {
            // Irreversible data backfill — no-op.
        }
    }
}
