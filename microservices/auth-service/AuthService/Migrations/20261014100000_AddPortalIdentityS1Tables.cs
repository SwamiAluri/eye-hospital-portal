using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace AuthService.Migrations
{
    /// <summary>
    /// L-PORTAL-01 S1 — Portal identity persistence foundation.
    /// Additive PostgreSQL tables + filtered unique indexes for active verified links.
    /// Does not apply automatically to shared/staging/production; apply via authorized SQL/migration process.
    /// Rollback: drop the three tables (see Down).
    /// </summary>
    /// <summary>
    /// Hand-written SQL Up/Down. Designer metadata + model snapshot reconciled in S1-R1
    /// so EF tooling knows about portal identity tables without regenerating duplicate DDL.
    /// </summary>
    public partial class AddPortalIdentityS1Tables : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql("""
                CREATE TABLE IF NOT EXISTS portal_invitations (
                    id uuid NOT NULL PRIMARY KEY,
                    tenant_id uuid NOT NULL,
                    patient_id uuid NOT NULL,
                    delivery_channel character varying(50) NOT NULL,
                    token_hash character varying(128) NOT NULL,
                    expires_at timestamp with time zone NOT NULL,
                    used_at timestamp with time zone,
                    superseded_at timestamp with time zone,
                    superseded_by_invitation_id uuid,
                    created_by_user_id uuid NOT NULL,
                    created_at timestamp with time zone NOT NULL,
                    status character varying(30) NOT NULL
                );
                CREATE INDEX IF NOT EXISTS ix_portal_invitations_tenant
                    ON portal_invitations (tenant_id);
                CREATE INDEX IF NOT EXISTS ix_portal_invitations_tenant_patient
                    ON portal_invitations (tenant_id, patient_id);
                CREATE INDEX IF NOT EXISTS ix_portal_invitations_token_hash
                    ON portal_invitations (token_hash);

                CREATE TABLE IF NOT EXISTS portal_patient_links (
                    id uuid NOT NULL PRIMARY KEY,
                    tenant_id uuid NOT NULL,
                    principal_user_id uuid NOT NULL,
                    patient_id uuid NOT NULL,
                    verification_status character varying(30) NOT NULL,
                    verification_method_code character varying(100),
                    verified_at timestamp with time zone,
                    verified_by_user_id uuid,
                    revoked_at timestamp with time zone,
                    revoked_reason character varying(500),
                    created_at timestamp with time zone NOT NULL
                );
                CREATE INDEX IF NOT EXISTS ix_portal_patient_links_tenant
                    ON portal_patient_links (tenant_id);
                CREATE UNIQUE INDEX IF NOT EXISTS ux_portal_patient_links_active_verified_patient
                    ON portal_patient_links (tenant_id, patient_id)
                    WHERE verification_status = 'verified' AND revoked_at IS NULL;
                CREATE UNIQUE INDEX IF NOT EXISTS ux_portal_patient_links_active_verified_principal
                    ON portal_patient_links (tenant_id, principal_user_id)
                    WHERE verification_status = 'verified' AND revoked_at IS NULL;

                CREATE TABLE IF NOT EXISTS portal_remediation_requests (
                    id uuid NOT NULL PRIMARY KEY,
                    tenant_id uuid NOT NULL,
                    link_id uuid NOT NULL,
                    requested_by_user_id uuid NOT NULL,
                    approved_by_user_id uuid,
                    operation character varying(50) NOT NULL,
                    reason character varying(1000) NOT NULL,
                    status character varying(30) NOT NULL,
                    created_at timestamp with time zone NOT NULL,
                    resolved_at timestamp with time zone
                );
                CREATE INDEX IF NOT EXISTS ix_portal_remediation_requests_tenant
                    ON portal_remediation_requests (tenant_id);
                CREATE INDEX IF NOT EXISTS ix_portal_remediation_requests_tenant_link
                    ON portal_remediation_requests (tenant_id, link_id);
                """);
        }

        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql("""
                DROP TABLE IF EXISTS portal_remediation_requests;
                DROP TABLE IF EXISTS portal_patient_links;
                DROP TABLE IF EXISTS portal_invitations;
                """);
        }
    }
}
