using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace AuthService.Data.Migrations;

/// <summary>
/// L3-COM-01 / COM-02 Option A: explicit Laboratory catalog non-billable semantics.
/// Additive only — existing NULL ServiceVariantId rows remain UNMAPPED (default false).
/// </summary>
public partial class AddLaboratoryTestDefinitionIsNonBillable : Migration
{
    protected override void Up(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.Sql("""
            ALTER TABLE laboratory_test_definitions
                ADD COLUMN IF NOT EXISTS is_non_billable boolean NOT NULL DEFAULT false;
            """);
    }

    protected override void Down(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.Sql("""
            ALTER TABLE laboratory_test_definitions
                DROP COLUMN IF EXISTS is_non_billable;
            """);
    }
}
