using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace AuthService.Data.Migrations;

/// <summary>
/// Additive conversation identity under counseling_sessions, plus recording_state.
/// Deployed via the companion SQL script. counseling_sessions is not altered.
/// </summary>
public partial class AddCounselingConversations : Migration
{
    protected override void Up(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.Sql("""
            CREATE TABLE IF NOT EXISTS counseling_conversations (
                id uuid PRIMARY KEY,
                tenant_id uuid NOT NULL,
                branch_id uuid NULL,
                session_id uuid NOT NULL REFERENCES counseling_sessions(id),
                sequence_number integer NOT NULL,
                started_at timestamptz NOT NULL,
                ended_at timestamptz NULL,
                status varchar(20) NOT NULL DEFAULT 'Active',
                version integer NOT NULL DEFAULT 1,
                created_at timestamptz NOT NULL,
                created_by_user_id uuid NOT NULL,
                updated_at timestamptz NULL,
                deleted_at timestamptz NULL
            );

            CREATE UNIQUE INDEX IF NOT EXISTS ux_counseling_conversations_session_sequence
                ON counseling_conversations (session_id, sequence_number)
                WHERE deleted_at IS NULL;

            CREATE UNIQUE INDEX IF NOT EXISTS ux_counseling_conversations_one_open
                ON counseling_conversations (session_id)
                WHERE deleted_at IS NULL AND ended_at IS NULL;

            CREATE INDEX IF NOT EXISTS ix_counseling_conversations_tenant
                ON counseling_conversations (tenant_id);

            ALTER TABLE session_recordings ADD COLUMN IF NOT EXISTS conversation_id uuid NULL;
            ALTER TABLE session_recordings ADD COLUMN IF NOT EXISTS recording_state varchar(30) NOT NULL DEFAULT 'Created';

            DO $$
            BEGIN
                IF NOT EXISTS (
                    SELECT 1 FROM pg_constraint WHERE conname = 'fk_session_recordings_conversation'
                ) THEN
                    ALTER TABLE session_recordings
                        ADD CONSTRAINT fk_session_recordings_conversation
                        FOREIGN KEY (conversation_id) REFERENCES counseling_conversations(id);
                END IF;
            END $$;

            CREATE INDEX IF NOT EXISTS ix_session_recordings_conversation
                ON session_recordings (conversation_id);

            ALTER TABLE counseling_session_documents
                DROP CONSTRAINT IF EXISTS counseling_session_documents_document_type_check;

            ALTER TABLE counseling_session_documents
                ADD CONSTRAINT counseling_session_documents_document_type_check
                CHECK (
                    document_type IS NULL
                    OR document_type IN (
                        'ReferralLetter',
                        'PreviousReport',
                        'InsuranceCard',
                        'PolicyDocument',
                        'IDProof',
                        'AddressProof',
                        'LabReport',
                        'Imaging',
                        'Other',
                        'AudioRecording'
                    )
                );
            """);
    }

    protected override void Down(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.Sql("""
            ALTER TABLE session_recordings DROP CONSTRAINT IF EXISTS fk_session_recordings_conversation;
            DROP INDEX IF EXISTS ix_session_recordings_conversation;
            ALTER TABLE session_recordings DROP COLUMN IF EXISTS conversation_id;
            ALTER TABLE session_recordings DROP COLUMN IF EXISTS recording_state;
            DROP TABLE IF EXISTS counseling_conversations;

            ALTER TABLE counseling_session_documents
                DROP CONSTRAINT IF EXISTS counseling_session_documents_document_type_check;
            ALTER TABLE counseling_session_documents
                ADD CONSTRAINT counseling_session_documents_document_type_check
                CHECK (
                    document_type IS NULL
                    OR document_type IN (
                        'ReferralLetter',
                        'PreviousReport',
                        'InsuranceCard',
                        'PolicyDocument',
                        'IDProof',
                        'AddressProof',
                        'LabReport',
                        'Imaging',
                        'Other'
                    )
                );
            """);
    }
}
