using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace AuthService.Data.Migrations;

/// <summary>
/// Slice 3A — concurrency-safe identity: one active canonical document per tenant+patient+content hash.
/// Null hashes (historical/unavailable bytes) are excluded from the unique index.
/// </summary>
public partial class CanonicalDocumentContentHashUniqueness : Migration
{
    protected override void Up(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.Sql("""
            CREATE UNIQUE INDEX IF NOT EXISTS ux_canonical_documents_tenant_patient_hash
                ON canonical_documents (tenant_id, patient_id, content_hash)
                WHERE deleted_at IS NULL
                  AND status = 'active'
                  AND content_hash IS NOT NULL;
            """);
    }

    protected override void Down(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.Sql("""
            DROP INDEX IF EXISTS ux_canonical_documents_tenant_patient_hash;
            """);
    }
}
