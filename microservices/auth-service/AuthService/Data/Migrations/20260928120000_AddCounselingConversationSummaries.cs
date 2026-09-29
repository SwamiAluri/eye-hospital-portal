using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace AuthService.Data.Migrations;

/// <summary>
/// Additive conversation summary. Deployed via the companion SQL script.
/// counseling_sessions is not altered.
/// </summary>
public partial class AddCounselingConversationSummaries : Migration
{
    protected override void Up(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.Sql("""
            CREATE TABLE IF NOT EXISTS counseling_conversation_summaries (
                id uuid PRIMARY KEY,
                tenant_id uuid NOT NULL,
                branch_id uuid NULL,
                session_id uuid NOT NULL REFERENCES counseling_sessions(id),
                conversation_id uuid NOT NULL REFERENCES counseling_conversations(id),
                status varchar(30) NOT NULL,
                version integer NOT NULL DEFAULT 1,
                source_fingerprint varchar(64) NOT NULL,
                source_capture jsonb NULL,
                summary_content jsonb NULL,
                evidence jsonb NULL,
                failure_code varchar(40) NULL,
                generated_at timestamptz NULL,
                created_at timestamptz NOT NULL,
                updated_at timestamptz NULL,
                deleted_at timestamptz NULL
            );

            CREATE UNIQUE INDEX IF NOT EXISTS ux_counseling_conversation_summaries_current
                ON counseling_conversation_summaries (conversation_id)
                WHERE deleted_at IS NULL;

            CREATE INDEX IF NOT EXISTS ix_counseling_conversation_summaries_session
                ON counseling_conversation_summaries (session_id);

            CREATE INDEX IF NOT EXISTS ix_counseling_conversation_summaries_tenant
                ON counseling_conversation_summaries (tenant_id);
            """);
    }

    protected override void Down(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.Sql("DROP TABLE IF EXISTS counseling_conversation_summaries;");
    }
}
