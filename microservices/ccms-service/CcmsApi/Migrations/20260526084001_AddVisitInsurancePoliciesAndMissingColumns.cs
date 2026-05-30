using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace CcmsApi.Migrations
{
    /// <inheritdoc />
    public partial class AddVisitInsurancePoliciesAndMissingColumns : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // ── ccms_visit_insurance_policies (new table) ─────────────────────────
            migrationBuilder.Sql(@"
                CREATE TABLE IF NOT EXISTS ccms_visit_insurance_policies (
                    id UUID PRIMARY KEY,
                    tenant_id UUID NOT NULL DEFAULT '00000000-0000-0000-0000-000000000000',
                    session_id UUID,
                    coverage_case_id UUID,
                    policy_number TEXT NOT NULL DEFAULT '',
                    card_number TEXT,
                    membership_number TEXT,
                    insurance_provider_id UUID,
                    tpa_provider_id UUID,
                    insured_name TEXT,
                    relationship_to_insured TEXT,
                    occupation TEXT,
                    designation TEXT,
                    company_name TEXT,
                    employee_id TEXT,
                    vide_number TEXT,
                    contact_number TEXT,
                    doctor_name TEXT,
                    doctor_reg_number TEXT,
                    doctor_qualification TEXT,
                    doctor_contact TEXT,
                    accommodation_class TEXT,
                    details_text TEXT,
                    tpa_coordinator_name TEXT,
                    is_primary BOOLEAN NOT NULL DEFAULT FALSE,
                    sort_order INTEGER NOT NULL DEFAULT 0,
                    underwriting_snapshot_json TEXT,
                    service_tax_applicable BOOLEAN,
                    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
                    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
                    created_by_user_id UUID,
                    updated_by_user_id UUID,
                    deleted_at TIMESTAMP WITH TIME ZONE,
                    status TEXT NOT NULL DEFAULT 'active',
                    row_version INTEGER NOT NULL DEFAULT 1
                );
            ");

            // ── ccms_settlements – missing columns ────────────────────────────────
            migrationBuilder.Sql("ALTER TABLE ccms_settlements ADD COLUMN IF NOT EXISTS bank_reference TEXT;");
            migrationBuilder.Sql("ALTER TABLE ccms_settlements ADD COLUMN IF NOT EXISTS claim_amount NUMERIC NOT NULL DEFAULT 0;");
            migrationBuilder.Sql("ALTER TABLE ccms_settlements ADD COLUMN IF NOT EXISTS outstanding_amount NUMERIC NOT NULL DEFAULT 0;");
            migrationBuilder.Sql("ALTER TABLE ccms_settlements ADD COLUMN IF NOT EXISTS payment_date DATE;");
            migrationBuilder.Sql("ALTER TABLE ccms_settlements ADD COLUMN IF NOT EXISTS settlement_number TEXT NOT NULL DEFAULT '';");

            // ── ccms_insurance_providers – missing columns ────────────────────────
            migrationBuilder.Sql("ALTER TABLE ccms_insurance_providers ADD COLUMN IF NOT EXISTS credit_limit NUMERIC;");
            migrationBuilder.Sql("ALTER TABLE ccms_insurance_providers ADD COLUMN IF NOT EXISTS debtor_subtype TEXT;");
            migrationBuilder.Sql("ALTER TABLE ccms_insurance_providers ADD COLUMN IF NOT EXISTS default_service_tax_percent NUMERIC NOT NULL DEFAULT 0;");
            migrationBuilder.Sql("ALTER TABLE ccms_insurance_providers ADD COLUMN IF NOT EXISTS export_code TEXT;");
            migrationBuilder.Sql("ALTER TABLE ccms_insurance_providers ADD COLUMN IF NOT EXISTS format_code TEXT;");
            migrationBuilder.Sql("ALTER TABLE ccms_insurance_providers ADD COLUMN IF NOT EXISTS hospital_identifier TEXT;");
            migrationBuilder.Sql("ALTER TABLE ccms_insurance_providers ADD COLUMN IF NOT EXISTS payer_category TEXT NOT NULL DEFAULT '';");
            migrationBuilder.Sql("ALTER TABLE ccms_insurance_providers ADD COLUMN IF NOT EXISTS service_tax_applicable BOOLEAN NOT NULL DEFAULT FALSE;");
            migrationBuilder.Sql("ALTER TABLE ccms_insurance_providers ADD COLUMN IF NOT EXISTS tds_mandatory BOOLEAN NOT NULL DEFAULT FALSE;");
            migrationBuilder.Sql("ALTER TABLE ccms_insurance_providers ADD COLUMN IF NOT EXISTS valid_from DATE;");
            migrationBuilder.Sql("ALTER TABLE ccms_insurance_providers ADD COLUMN IF NOT EXISTS valid_to DATE;");

            // ── ccms_coverage_cases – missing columns ─────────────────────────────
            migrationBuilder.Sql("ALTER TABLE ccms_coverage_cases ADD COLUMN IF NOT EXISTS process_status TEXT;");
            migrationBuilder.Sql("ALTER TABLE ccms_coverage_cases ADD COLUMN IF NOT EXISTS process_status_updated_at TIMESTAMP WITH TIME ZONE;");
            migrationBuilder.Sql("ALTER TABLE ccms_coverage_cases ADD COLUMN IF NOT EXISTS search_insurer_name TEXT;");
            migrationBuilder.Sql("ALTER TABLE ccms_coverage_cases ADD COLUMN IF NOT EXISTS service_tax_amount NUMERIC NOT NULL DEFAULT 0;");
            migrationBuilder.Sql("ALTER TABLE ccms_coverage_cases ADD COLUMN IF NOT EXISTS service_tax_applicable BOOLEAN NOT NULL DEFAULT FALSE;");
            migrationBuilder.Sql("ALTER TABLE ccms_coverage_cases ADD COLUMN IF NOT EXISTS service_tax_percent NUMERIC NOT NULL DEFAULT 0;");

            // ── ccms_coverage_authorizations – missing columns ────────────────────
            migrationBuilder.Sql("ALTER TABLE ccms_coverage_authorizations ADD COLUMN IF NOT EXISTS actual_discharge_date DATE;");
            migrationBuilder.Sql("ALTER TABLE ccms_coverage_authorizations ADD COLUMN IF NOT EXISTS admission_date DATE;");
            migrationBuilder.Sql("ALTER TABLE ccms_coverage_authorizations ADD COLUMN IF NOT EXISTS clinical_summary TEXT;");
            migrationBuilder.Sql("ALTER TABLE ccms_coverage_authorizations ADD COLUMN IF NOT EXISTS copay_amount NUMERIC NOT NULL DEFAULT 0;");
            migrationBuilder.Sql("ALTER TABLE ccms_coverage_authorizations ADD COLUMN IF NOT EXISTS deductible_amount NUMERIC NOT NULL DEFAULT 0;");
            migrationBuilder.Sql("ALTER TABLE ccms_coverage_authorizations ADD COLUMN IF NOT EXISTS estimated_total_cost NUMERIC NOT NULL DEFAULT 0;");
            migrationBuilder.Sql("ALTER TABLE ccms_coverage_authorizations ADD COLUMN IF NOT EXISTS expected_discharge_date DATE;");
            migrationBuilder.Sql("ALTER TABLE ccms_coverage_authorizations ADD COLUMN IF NOT EXISTS length_of_stay_days INTEGER;");
            migrationBuilder.Sql("ALTER TABLE ccms_coverage_authorizations ADD COLUMN IF NOT EXISTS net_payable_by_insurer NUMERIC NOT NULL DEFAULT 0;");
            migrationBuilder.Sql("ALTER TABLE ccms_coverage_authorizations ADD COLUMN IF NOT EXISTS net_payable_by_patient NUMERIC NOT NULL DEFAULT 0;");
            migrationBuilder.Sql("ALTER TABLE ccms_coverage_authorizations ADD COLUMN IF NOT EXISTS process_status TEXT NOT NULL DEFAULT '';");
            migrationBuilder.Sql("ALTER TABLE ccms_coverage_authorizations ADD COLUMN IF NOT EXISTS process_status_updated_at TIMESTAMP WITH TIME ZONE;");
            migrationBuilder.Sql("ALTER TABLE ccms_coverage_authorizations ADD COLUMN IF NOT EXISTS room_type_requested TEXT;");
            migrationBuilder.Sql("ALTER TABLE ccms_coverage_authorizations ADD COLUMN IF NOT EXISTS service_tax_amount NUMERIC NOT NULL DEFAULT 0;");
            migrationBuilder.Sql("ALTER TABLE ccms_coverage_authorizations ADD COLUMN IF NOT EXISTS tpa_query_json TEXT;");
            migrationBuilder.Sql("ALTER TABLE ccms_coverage_authorizations ADD COLUMN IF NOT EXISTS treating_doctor_name TEXT;");
            migrationBuilder.Sql("ALTER TABLE ccms_coverage_authorizations ADD COLUMN IF NOT EXISTS treating_doctor_reg TEXT;");

            // ── BillingTransactionRows keyless projection (no-op if exists) ───────
            migrationBuilder.Sql(@"
                CREATE TABLE IF NOT EXISTS ""BillingTransactionRows"" (
                    ""Id"" UUID,
                    ""TransactionType"" TEXT,
                    ""Description"" TEXT,
                    ""Amount"" NUMERIC NOT NULL DEFAULT 0,
                    ""IsExcluded"" BOOLEAN NOT NULL DEFAULT FALSE
                );
            ");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql(@"DROP TABLE IF EXISTS ccms_visit_insurance_policies;");
            migrationBuilder.Sql(@"DROP TABLE IF EXISTS ""BillingTransactionRows"";");

            migrationBuilder.Sql("ALTER TABLE ccms_settlements DROP COLUMN IF EXISTS bank_reference;");
            migrationBuilder.Sql("ALTER TABLE ccms_settlements DROP COLUMN IF EXISTS claim_amount;");
            migrationBuilder.Sql("ALTER TABLE ccms_settlements DROP COLUMN IF EXISTS outstanding_amount;");
            migrationBuilder.Sql("ALTER TABLE ccms_settlements DROP COLUMN IF EXISTS payment_date;");
            migrationBuilder.Sql("ALTER TABLE ccms_settlements DROP COLUMN IF EXISTS settlement_number;");

            migrationBuilder.Sql("ALTER TABLE ccms_insurance_providers DROP COLUMN IF EXISTS credit_limit;");
            migrationBuilder.Sql("ALTER TABLE ccms_insurance_providers DROP COLUMN IF EXISTS debtor_subtype;");
            migrationBuilder.Sql("ALTER TABLE ccms_insurance_providers DROP COLUMN IF EXISTS default_service_tax_percent;");
            migrationBuilder.Sql("ALTER TABLE ccms_insurance_providers DROP COLUMN IF EXISTS export_code;");
            migrationBuilder.Sql("ALTER TABLE ccms_insurance_providers DROP COLUMN IF EXISTS format_code;");
            migrationBuilder.Sql("ALTER TABLE ccms_insurance_providers DROP COLUMN IF EXISTS hospital_identifier;");
            migrationBuilder.Sql("ALTER TABLE ccms_insurance_providers DROP COLUMN IF EXISTS payer_category;");
            migrationBuilder.Sql("ALTER TABLE ccms_insurance_providers DROP COLUMN IF EXISTS service_tax_applicable;");
            migrationBuilder.Sql("ALTER TABLE ccms_insurance_providers DROP COLUMN IF EXISTS tds_mandatory;");
            migrationBuilder.Sql("ALTER TABLE ccms_insurance_providers DROP COLUMN IF EXISTS valid_from;");
            migrationBuilder.Sql("ALTER TABLE ccms_insurance_providers DROP COLUMN IF EXISTS valid_to;");

            migrationBuilder.Sql("ALTER TABLE ccms_coverage_cases DROP COLUMN IF EXISTS process_status;");
            migrationBuilder.Sql("ALTER TABLE ccms_coverage_cases DROP COLUMN IF EXISTS process_status_updated_at;");
            migrationBuilder.Sql("ALTER TABLE ccms_coverage_cases DROP COLUMN IF EXISTS search_insurer_name;");
            migrationBuilder.Sql("ALTER TABLE ccms_coverage_cases DROP COLUMN IF EXISTS service_tax_amount;");
            migrationBuilder.Sql("ALTER TABLE ccms_coverage_cases DROP COLUMN IF EXISTS service_tax_applicable;");
            migrationBuilder.Sql("ALTER TABLE ccms_coverage_cases DROP COLUMN IF EXISTS service_tax_percent;");

            migrationBuilder.Sql("ALTER TABLE ccms_coverage_authorizations DROP COLUMN IF EXISTS actual_discharge_date;");
            migrationBuilder.Sql("ALTER TABLE ccms_coverage_authorizations DROP COLUMN IF EXISTS admission_date;");
            migrationBuilder.Sql("ALTER TABLE ccms_coverage_authorizations DROP COLUMN IF EXISTS clinical_summary;");
            migrationBuilder.Sql("ALTER TABLE ccms_coverage_authorizations DROP COLUMN IF EXISTS copay_amount;");
            migrationBuilder.Sql("ALTER TABLE ccms_coverage_authorizations DROP COLUMN IF EXISTS deductible_amount;");
            migrationBuilder.Sql("ALTER TABLE ccms_coverage_authorizations DROP COLUMN IF EXISTS estimated_total_cost;");
            migrationBuilder.Sql("ALTER TABLE ccms_coverage_authorizations DROP COLUMN IF EXISTS expected_discharge_date;");
            migrationBuilder.Sql("ALTER TABLE ccms_coverage_authorizations DROP COLUMN IF EXISTS length_of_stay_days;");
            migrationBuilder.Sql("ALTER TABLE ccms_coverage_authorizations DROP COLUMN IF EXISTS net_payable_by_insurer;");
            migrationBuilder.Sql("ALTER TABLE ccms_coverage_authorizations DROP COLUMN IF EXISTS net_payable_by_patient;");
            migrationBuilder.Sql("ALTER TABLE ccms_coverage_authorizations DROP COLUMN IF EXISTS process_status;");
            migrationBuilder.Sql("ALTER TABLE ccms_coverage_authorizations DROP COLUMN IF EXISTS process_status_updated_at;");
            migrationBuilder.Sql("ALTER TABLE ccms_coverage_authorizations DROP COLUMN IF EXISTS room_type_requested;");
            migrationBuilder.Sql("ALTER TABLE ccms_coverage_authorizations DROP COLUMN IF EXISTS service_tax_amount;");
            migrationBuilder.Sql("ALTER TABLE ccms_coverage_authorizations DROP COLUMN IF EXISTS tpa_query_json;");
            migrationBuilder.Sql("ALTER TABLE ccms_coverage_authorizations DROP COLUMN IF EXISTS treating_doctor_name;");
            migrationBuilder.Sql("ALTER TABLE ccms_coverage_authorizations DROP COLUMN IF EXISTS treating_doctor_reg;");
        }
    }
}
