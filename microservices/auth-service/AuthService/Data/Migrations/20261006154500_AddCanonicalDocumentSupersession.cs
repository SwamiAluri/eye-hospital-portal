using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace AuthService.Data.Migrations;

/// <summary>
/// Additive superseded_by lineage for non-destructive canonical document replacement.
/// </summary>
public partial class AddCanonicalDocumentSupersession : Migration
{
    protected override void Up(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.Sql("""
            ALTER TABLE canonical_documents
                ADD COLUMN IF NOT EXISTS superseded_by_document_id uuid NULL;

            DO $$
            BEGIN
                IF NOT EXISTS (
                    SELECT 1 FROM pg_constraint WHERE conname = 'fk_canonical_documents_superseded_by'
                ) THEN
                    ALTER TABLE canonical_documents
                        ADD CONSTRAINT fk_canonical_documents_superseded_by
                        FOREIGN KEY (superseded_by_document_id) REFERENCES canonical_documents (id);
                END IF;
            END $$;
            """);
    }

    protected override void Down(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.Sql("""
            ALTER TABLE canonical_documents DROP CONSTRAINT IF EXISTS fk_canonical_documents_superseded_by;
            ALTER TABLE canonical_documents DROP COLUMN IF EXISTS superseded_by_document_id;
            """);
    }
}
