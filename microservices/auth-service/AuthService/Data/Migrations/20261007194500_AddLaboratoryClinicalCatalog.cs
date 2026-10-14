using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace AuthService.Data.Migrations;

/// <summary>
/// L2 Laboratory clinical catalog + LabReport additive catalog FKs / indication / items.
/// Additive only — historical lab_reports remain valid without catalog FKs.
/// </summary>
public partial class AddLaboratoryClinicalCatalog : Migration
{
    protected override void Up(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.Sql("""
            CREATE TABLE IF NOT EXISTS laboratory_test_definitions (
                id uuid PRIMARY KEY,
                tenant_id uuid NOT NULL,
                name varchar(300) NOT NULL,
                local_code varchar(50) NOT NULL,
                description varchar(2000) NULL,
                category varchar(100) NULL,
                method varchar(200) NULL,
                turnaround_hours integer NULL,
                service_variant_id uuid NULL,
                is_active boolean NOT NULL DEFAULT true,
                created_at timestamptz NOT NULL,
                updated_at timestamptz NOT NULL,
                created_by_user_id uuid NULL,
                updated_by_user_id uuid NULL,
                deleted_at timestamptz NULL
            );

            CREATE INDEX IF NOT EXISTS ix_lab_test_def_tenant_code
                ON laboratory_test_definitions (tenant_id, local_code)
                WHERE deleted_at IS NULL;

            CREATE INDEX IF NOT EXISTS ix_lab_test_def_tenant_name
                ON laboratory_test_definitions (tenant_id, name)
                WHERE deleted_at IS NULL;

            CREATE INDEX IF NOT EXISTS ix_lab_test_def_service_variant
                ON laboratory_test_definitions (service_variant_id)
                WHERE deleted_at IS NULL;

            CREATE TABLE IF NOT EXISTS laboratory_test_specimen_options (
                id uuid PRIMARY KEY,
                tenant_id uuid NOT NULL,
                test_definition_id uuid NOT NULL REFERENCES laboratory_test_definitions (id) ON DELETE CASCADE,
                specimen_type varchar(100) NOT NULL,
                is_default boolean NOT NULL DEFAULT false,
                display_order integer NOT NULL DEFAULT 0
            );

            CREATE UNIQUE INDEX IF NOT EXISTS ux_lab_test_specimen_option
                ON laboratory_test_specimen_options (test_definition_id, specimen_type);

            CREATE TABLE IF NOT EXISTS laboratory_panels (
                id uuid PRIMARY KEY,
                tenant_id uuid NOT NULL,
                name varchar(300) NOT NULL,
                local_code varchar(50) NOT NULL,
                description varchar(2000) NULL,
                category varchar(100) NULL,
                is_active boolean NOT NULL DEFAULT true,
                created_at timestamptz NOT NULL,
                updated_at timestamptz NOT NULL,
                created_by_user_id uuid NULL,
                updated_by_user_id uuid NULL,
                deleted_at timestamptz NULL
            );

            CREATE INDEX IF NOT EXISTS ix_lab_panel_tenant_code
                ON laboratory_panels (tenant_id, local_code)
                WHERE deleted_at IS NULL;

            CREATE TABLE IF NOT EXISTS laboratory_panel_items (
                id uuid PRIMARY KEY,
                tenant_id uuid NOT NULL,
                panel_id uuid NOT NULL REFERENCES laboratory_panels (id) ON DELETE CASCADE,
                test_definition_id uuid NOT NULL REFERENCES laboratory_test_definitions (id) ON DELETE RESTRICT,
                display_order integer NOT NULL DEFAULT 0,
                is_required boolean NOT NULL DEFAULT true
            );

            CREATE UNIQUE INDEX IF NOT EXISTS ux_lab_panel_item
                ON laboratory_panel_items (panel_id, test_definition_id);

            CREATE TABLE IF NOT EXISTS laboratory_analytes (
                id uuid PRIMARY KEY,
                tenant_id uuid NOT NULL,
                test_definition_id uuid NOT NULL REFERENCES laboratory_test_definitions (id) ON DELETE CASCADE,
                name varchar(200) NOT NULL,
                local_code varchar(50) NULL,
                value_type varchar(30) NOT NULL DEFAULT 'numeric',
                unit varchar(50) NULL,
                reference_range_text varchar(200) NULL,
                display_order integer NOT NULL DEFAULT 0,
                is_active boolean NOT NULL DEFAULT true,
                created_at timestamptz NOT NULL,
                updated_at timestamptz NOT NULL,
                deleted_at timestamptz NULL
            );

            CREATE INDEX IF NOT EXISTS ix_lab_analyte_test
                ON laboratory_analytes (tenant_id, test_definition_id)
                WHERE deleted_at IS NULL;

            ALTER TABLE lab_reports
                ADD COLUMN IF NOT EXISTS test_definition_id uuid NULL,
                ADD COLUMN IF NOT EXISTS panel_id uuid NULL,
                ADD COLUMN IF NOT EXISTS clinical_indication varchar(1000) NULL;

            CREATE INDEX IF NOT EXISTS ix_lab_reports_test_definition
                ON lab_reports (test_definition_id)
                WHERE deleted_at IS NULL;

            CREATE INDEX IF NOT EXISTS ix_lab_reports_panel
                ON lab_reports (panel_id)
                WHERE deleted_at IS NULL;

            CREATE TABLE IF NOT EXISTS lab_report_items (
                id uuid PRIMARY KEY,
                tenant_id uuid NOT NULL,
                lab_report_id uuid NOT NULL REFERENCES lab_reports (id) ON DELETE CASCADE,
                test_definition_id uuid NULL REFERENCES laboratory_test_definitions (id) ON DELETE RESTRICT,
                test_name varchar(300) NOT NULL,
                test_code varchar(50) NULL,
                test_category varchar(100) NULL,
                display_order integer NOT NULL DEFAULT 0,
                created_at timestamptz NOT NULL
            );

            CREATE INDEX IF NOT EXISTS ix_lab_report_items_report
                ON lab_report_items (tenant_id, lab_report_id);
            """);
    }

    protected override void Down(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.Sql("""
            DROP TABLE IF EXISTS lab_report_items;
            ALTER TABLE lab_reports DROP COLUMN IF EXISTS clinical_indication;
            ALTER TABLE lab_reports DROP COLUMN IF EXISTS panel_id;
            ALTER TABLE lab_reports DROP COLUMN IF EXISTS test_definition_id;
            DROP TABLE IF EXISTS laboratory_analytes;
            DROP TABLE IF EXISTS laboratory_panel_items;
            DROP TABLE IF EXISTS laboratory_panels;
            DROP TABLE IF EXISTS laboratory_test_specimen_options;
            DROP TABLE IF EXISTS laboratory_test_definitions;
            """);
    }
}
