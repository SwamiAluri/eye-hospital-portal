using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace AuthService.Data.Migrations;

/// <summary>
/// Canonical document platform (MPI/General only). Additive tables only.
/// </summary>
public partial class AddCanonicalDocuments : Migration
{
    protected override void Up(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.Sql("""
            CREATE TABLE IF NOT EXISTS canonical_documents (
                id uuid PRIMARY KEY,
                tenant_id uuid NOT NULL,
                patient_id uuid NOT NULL,
                storage_backend varchar(50) NOT NULL,
                storage_container varchar(100) NOT NULL,
                storage_object_key varchar(500) NOT NULL,
                file_name varchar(200) NOT NULL,
                mime_type varchar(100) NOT NULL,
                size_bytes bigint NOT NULL,
                content_hash varchar(64) NULL,
                classification varchar(50) NOT NULL,
                status varchar(20) NOT NULL,
                created_by_user_id uuid NOT NULL,
                created_at timestamptz NOT NULL,
                deleted_at timestamptz NULL
            );

            CREATE INDEX IF NOT EXISTS ix_canonical_documents_tenant_patient
                ON canonical_documents (tenant_id, patient_id)
                WHERE deleted_at IS NULL;

            CREATE UNIQUE INDEX IF NOT EXISTS ux_canonical_documents_object_key
                ON canonical_documents (storage_container, storage_object_key)
                WHERE deleted_at IS NULL;

            CREATE TABLE IF NOT EXISTS canonical_document_associations (
                id uuid PRIMARY KEY,
                document_id uuid NOT NULL REFERENCES canonical_documents (id),
                domain varchar(50) NOT NULL,
                entity_type varchar(50) NOT NULL,
                entity_id uuid NOT NULL,
                category varchar(50) NOT NULL,
                role varchar(50) NOT NULL,
                created_by_user_id uuid NOT NULL,
                created_at timestamptz NOT NULL
            );

            CREATE UNIQUE INDEX IF NOT EXISTS ux_canonical_document_association_once
                ON canonical_document_associations (document_id, domain, entity_type, entity_id);

            CREATE INDEX IF NOT EXISTS ix_canonical_document_associations_entity
                ON canonical_document_associations (domain, entity_type, entity_id);
            """);
    }

    protected override void Down(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.Sql("""
            DROP TABLE IF EXISTS canonical_document_associations;
            DROP TABLE IF EXISTS canonical_documents;
            """);
    }
}
