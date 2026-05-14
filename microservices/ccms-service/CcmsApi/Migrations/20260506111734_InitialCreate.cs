using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace CcmsApi.Migrations
{
    /// <inheritdoc />
    public partial class InitialCreate : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "ccms_approval_events",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    tenant_id = table.Column<Guid>(type: "uuid", nullable: false),
                    coverage_case_id = table.Column<Guid>(type: "uuid", nullable: false),
                    authorization_id = table.Column<Guid>(type: "uuid", nullable: true),
                    event_type = table.Column<string>(type: "text", nullable: false),
                    event_source = table.Column<string>(type: "text", nullable: false),
                    approval_status = table.Column<string>(type: "text", nullable: false),
                    approved_amount = table.Column<decimal>(type: "numeric", nullable: false),
                    partial_approval_reason = table.Column<string>(type: "text", nullable: true),
                    rejection_reason = table.Column<string>(type: "text", nullable: true),
                    response_payload_json = table.Column<string>(type: "text", nullable: true),
                    tpa_reference_number = table.Column<string>(type: "text", nullable: true),
                    recorded_by_user_id = table.Column<Guid>(type: "uuid", nullable: true),
                    recorded_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    created_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    created_by_user_id = table.Column<Guid>(type: "uuid", nullable: true),
                    status = table.Column<string>(type: "text", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ccms_approval_events", x => x.id);
                });

            migrationBuilder.CreateTable(
                name: "ccms_authorization_documents",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    authorization_id = table.Column<Guid>(type: "uuid", nullable: false),
                    document_type = table.Column<string>(type: "text", nullable: false),
                    document_name = table.Column<string>(type: "text", nullable: false),
                    blob_url = table.Column<string>(type: "text", nullable: true),
                    uploaded_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    tenant_id = table.Column<Guid>(type: "uuid", nullable: false),
                    created_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    updated_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    created_by_user_id = table.Column<Guid>(type: "uuid", nullable: true),
                    updated_by_user_id = table.Column<Guid>(type: "uuid", nullable: true),
                    deleted_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    status = table.Column<string>(type: "text", nullable: false),
                    row_version = table.Column<int>(type: "integer", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ccms_authorization_documents", x => x.id);
                });

            migrationBuilder.CreateTable(
                name: "ccms_billing_summaries",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    coverage_case_id = table.Column<Guid>(type: "uuid", nullable: false),
                    bill_id = table.Column<Guid>(type: "uuid", nullable: true),
                    bill_date = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    total_bill_amount = table.Column<decimal>(type: "numeric", nullable: false),
                    insurance_share_amount = table.Column<decimal>(type: "numeric", nullable: false),
                    patient_share_amount = table.Column<decimal>(type: "numeric", nullable: false),
                    copay_amount = table.Column<decimal>(type: "numeric", nullable: false),
                    deductible_amount = table.Column<decimal>(type: "numeric", nullable: false),
                    disallowed_amount = table.Column<decimal>(type: "numeric", nullable: false),
                    bill_items_json = table.Column<string>(type: "text", nullable: true),
                    tenant_id = table.Column<Guid>(type: "uuid", nullable: false),
                    created_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    updated_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    created_by_user_id = table.Column<Guid>(type: "uuid", nullable: true),
                    updated_by_user_id = table.Column<Guid>(type: "uuid", nullable: true),
                    deleted_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    status = table.Column<string>(type: "text", nullable: false),
                    row_version = table.Column<int>(type: "integer", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ccms_billing_summaries", x => x.id);
                });

            migrationBuilder.CreateTable(
                name: "ccms_claim_documents",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    claim_packet_id = table.Column<Guid>(type: "uuid", nullable: false),
                    document_type = table.Column<string>(type: "text", nullable: false),
                    document_name = table.Column<string>(type: "text", nullable: false),
                    blob_url = table.Column<string>(type: "text", nullable: true),
                    uploaded_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    tenant_id = table.Column<Guid>(type: "uuid", nullable: false),
                    created_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    updated_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    created_by_user_id = table.Column<Guid>(type: "uuid", nullable: true),
                    updated_by_user_id = table.Column<Guid>(type: "uuid", nullable: true),
                    deleted_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    status = table.Column<string>(type: "text", nullable: false),
                    row_version = table.Column<int>(type: "integer", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ccms_claim_documents", x => x.id);
                });

            migrationBuilder.CreateTable(
                name: "ccms_claim_packets",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    coverage_case_id = table.Column<Guid>(type: "uuid", nullable: false),
                    claim_number = table.Column<string>(type: "text", nullable: false),
                    claimed_amount = table.Column<decimal>(type: "numeric", nullable: false),
                    claim_type = table.Column<string>(type: "text", nullable: false),
                    submission_mode = table.Column<string>(type: "text", nullable: false),
                    submitted_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    acknowledged_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    tpa_claim_number = table.Column<string>(type: "text", nullable: true),
                    expected_settlement_date = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    claim_packet_json = table.Column<string>(type: "text", nullable: true),
                    tenant_id = table.Column<Guid>(type: "uuid", nullable: false),
                    created_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    updated_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    created_by_user_id = table.Column<Guid>(type: "uuid", nullable: true),
                    updated_by_user_id = table.Column<Guid>(type: "uuid", nullable: true),
                    deleted_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    status = table.Column<string>(type: "text", nullable: false),
                    row_version = table.Column<int>(type: "integer", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ccms_claim_packets", x => x.id);
                });

            migrationBuilder.CreateTable(
                name: "ccms_clarification_items",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    authorization_id = table.Column<Guid>(type: "uuid", nullable: false),
                    clarification_query = table.Column<string>(type: "text", nullable: false),
                    clarification_response = table.Column<string>(type: "text", nullable: true),
                    requested_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    responded_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    tenant_id = table.Column<Guid>(type: "uuid", nullable: false),
                    created_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    updated_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    created_by_user_id = table.Column<Guid>(type: "uuid", nullable: true),
                    updated_by_user_id = table.Column<Guid>(type: "uuid", nullable: true),
                    deleted_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    status = table.Column<string>(type: "text", nullable: false),
                    row_version = table.Column<int>(type: "integer", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ccms_clarification_items", x => x.id);
                });

            migrationBuilder.CreateTable(
                name: "ccms_communication_logs",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    coverage_case_id = table.Column<Guid>(type: "uuid", nullable: false),
                    communication_type = table.Column<string>(type: "text", nullable: false),
                    direction = table.Column<string>(type: "text", nullable: false),
                    recipient_type = table.Column<string>(type: "text", nullable: false),
                    recipient_address = table.Column<string>(type: "text", nullable: true),
                    subject = table.Column<string>(type: "text", nullable: true),
                    body_summary = table.Column<string>(type: "text", nullable: true),
                    sent_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    delivery_status = table.Column<string>(type: "text", nullable: false),
                    external_message_id = table.Column<string>(type: "text", nullable: true),
                    tenant_id = table.Column<Guid>(type: "uuid", nullable: false),
                    created_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    updated_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    created_by_user_id = table.Column<Guid>(type: "uuid", nullable: true),
                    updated_by_user_id = table.Column<Guid>(type: "uuid", nullable: true),
                    deleted_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    status = table.Column<string>(type: "text", nullable: false),
                    row_version = table.Column<int>(type: "integer", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ccms_communication_logs", x => x.id);
                });

            migrationBuilder.CreateTable(
                name: "ccms_communication_templates",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    template_name = table.Column<string>(type: "text", nullable: false),
                    template_code = table.Column<string>(type: "text", nullable: false),
                    communication_type = table.Column<string>(type: "text", nullable: false),
                    trigger_event = table.Column<string>(type: "text", nullable: true),
                    subject_template = table.Column<string>(type: "text", nullable: true),
                    body_template = table.Column<string>(type: "text", nullable: false),
                    is_active = table.Column<bool>(type: "boolean", nullable: false),
                    tenant_id = table.Column<Guid>(type: "uuid", nullable: false),
                    created_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    updated_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    created_by_user_id = table.Column<Guid>(type: "uuid", nullable: true),
                    updated_by_user_id = table.Column<Guid>(type: "uuid", nullable: true),
                    deleted_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    status = table.Column<string>(type: "text", nullable: false),
                    row_version = table.Column<int>(type: "integer", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ccms_communication_templates", x => x.id);
                });

            migrationBuilder.CreateTable(
                name: "ccms_coverage_allocations",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    billing_summary_id = table.Column<Guid>(type: "uuid", nullable: false),
                    line_item_type = table.Column<string>(type: "text", nullable: false),
                    line_item_code = table.Column<string>(type: "text", nullable: true),
                    line_item_description = table.Column<string>(type: "text", nullable: false),
                    billed_amount = table.Column<decimal>(type: "numeric", nullable: false),
                    covered_amount = table.Column<decimal>(type: "numeric", nullable: false),
                    disallowed_amount = table.Column<decimal>(type: "numeric", nullable: false),
                    disallowed_reason = table.Column<string>(type: "text", nullable: true),
                    patient_payable = table.Column<decimal>(type: "numeric", nullable: false),
                    tenant_id = table.Column<Guid>(type: "uuid", nullable: false),
                    created_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    updated_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    created_by_user_id = table.Column<Guid>(type: "uuid", nullable: true),
                    updated_by_user_id = table.Column<Guid>(type: "uuid", nullable: true),
                    deleted_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    status = table.Column<string>(type: "text", nullable: false),
                    row_version = table.Column<int>(type: "integer", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ccms_coverage_allocations", x => x.id);
                });

            migrationBuilder.CreateTable(
                name: "ccms_coverage_authorizations",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    coverage_case_id = table.Column<Guid>(type: "uuid", nullable: false),
                    authorization_type = table.Column<string>(type: "text", nullable: false),
                    pre_auth_number = table.Column<string>(type: "text", nullable: true),
                    requested_amount = table.Column<decimal>(type: "numeric", nullable: false),
                    approved_amount = table.Column<decimal>(type: "numeric", nullable: false),
                    room_class_requested = table.Column<string>(type: "text", nullable: true),
                    room_class_approved = table.Column<string>(type: "text", nullable: true),
                    diagnosis_json = table.Column<string>(type: "text", nullable: true),
                    procedures_json = table.Column<string>(type: "text", nullable: true),
                    valid_from = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    valid_to = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    submitted_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    received_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    tpa_reference_number = table.Column<string>(type: "text", nullable: true),
                    legacy_preauth_id = table.Column<Guid>(type: "uuid", nullable: true),
                    session_preauth_id = table.Column<Guid>(type: "uuid", nullable: true),
                    rejection_reason = table.Column<string>(type: "text", nullable: true),
                    tenant_id = table.Column<Guid>(type: "uuid", nullable: false),
                    created_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    updated_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    created_by_user_id = table.Column<Guid>(type: "uuid", nullable: true),
                    updated_by_user_id = table.Column<Guid>(type: "uuid", nullable: true),
                    deleted_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    status = table.Column<string>(type: "text", nullable: false),
                    row_version = table.Column<int>(type: "integer", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ccms_coverage_authorizations", x => x.id);
                });

            migrationBuilder.CreateTable(
                name: "ccms_coverage_cases",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    case_number = table.Column<string>(type: "text", nullable: false),
                    patient_id = table.Column<Guid>(type: "uuid", nullable: false),
                    patient_name = table.Column<string>(type: "text", nullable: true),
                    session_id = table.Column<Guid>(type: "uuid", nullable: true),
                    journey_id = table.Column<Guid>(type: "uuid", nullable: true),
                    financial_year_id = table.Column<Guid>(type: "uuid", nullable: true),
                    branch_id = table.Column<Guid>(type: "uuid", nullable: true),
                    doctor_id = table.Column<Guid>(type: "uuid", nullable: true),
                    payer_type = table.Column<string>(type: "text", nullable: false),
                    insurance_provider_id = table.Column<Guid>(type: "uuid", nullable: true),
                    tpa_provider_id = table.Column<Guid>(type: "uuid", nullable: true),
                    government_scheme_id = table.Column<Guid>(type: "uuid", nullable: true),
                    coverage_package_id = table.Column<Guid>(type: "uuid", nullable: true),
                    workflow_instance_id = table.Column<Guid>(type: "uuid", nullable: true),
                    current_state = table.Column<string>(type: "text", nullable: false),
                    approved_amount = table.Column<decimal>(type: "numeric", nullable: false),
                    room_class_approved = table.Column<string>(type: "text", nullable: true),
                    pre_auth_number = table.Column<string>(type: "text", nullable: true),
                    pre_auth_expiry = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    legacy_preauth_id = table.Column<Guid>(type: "uuid", nullable: true),
                    session_preauth_id = table.Column<Guid>(type: "uuid", nullable: true),
                    emergency_fc_applied = table.Column<bool>(type: "boolean", nullable: false),
                    notes_json = table.Column<string>(type: "text", nullable: true),
                    tenant_id = table.Column<Guid>(type: "uuid", nullable: false),
                    created_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    updated_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    created_by_user_id = table.Column<Guid>(type: "uuid", nullable: true),
                    updated_by_user_id = table.Column<Guid>(type: "uuid", nullable: true),
                    deleted_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    status = table.Column<string>(type: "text", nullable: false),
                    row_version = table.Column<int>(type: "integer", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ccms_coverage_cases", x => x.id);
                });

            migrationBuilder.CreateTable(
                name: "ccms_coverage_packages",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    package_name = table.Column<string>(type: "text", nullable: false),
                    package_code = table.Column<string>(type: "text", nullable: false),
                    insurance_provider_id = table.Column<Guid>(type: "uuid", nullable: true),
                    tpa_provider_id = table.Column<Guid>(type: "uuid", nullable: true),
                    government_scheme_id = table.Column<Guid>(type: "uuid", nullable: true),
                    package_type = table.Column<string>(type: "text", nullable: false),
                    sum_insured_amount = table.Column<decimal>(type: "numeric", nullable: false),
                    room_rent_limit = table.Column<decimal>(type: "numeric", nullable: true),
                    icu_rent_limit = table.Column<decimal>(type: "numeric", nullable: true),
                    sub_limits_json = table.Column<string>(type: "text", nullable: true),
                    waiting_period_days = table.Column<int>(type: "integer", nullable: false),
                    copay_percent = table.Column<decimal>(type: "numeric", nullable: false),
                    deductible_amount = table.Column<decimal>(type: "numeric", nullable: false),
                    valid_from = table.Column<DateOnly>(type: "date", nullable: true),
                    valid_to = table.Column<DateOnly>(type: "date", nullable: true),
                    tenant_id = table.Column<Guid>(type: "uuid", nullable: false),
                    created_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    updated_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    created_by_user_id = table.Column<Guid>(type: "uuid", nullable: true),
                    updated_by_user_id = table.Column<Guid>(type: "uuid", nullable: true),
                    deleted_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    status = table.Column<string>(type: "text", nullable: false),
                    row_version = table.Column<int>(type: "integer", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ccms_coverage_packages", x => x.id);
                });

            migrationBuilder.CreateTable(
                name: "ccms_document_requirements",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    insurance_provider_id = table.Column<Guid>(type: "uuid", nullable: true),
                    tpa_provider_id = table.Column<Guid>(type: "uuid", nullable: true),
                    government_scheme_id = table.Column<Guid>(type: "uuid", nullable: true),
                    document_type = table.Column<string>(type: "text", nullable: false),
                    document_name = table.Column<string>(type: "text", nullable: false),
                    is_required = table.Column<bool>(type: "boolean", nullable: false),
                    applies_at = table.Column<string>(type: "text", nullable: false),
                    tenant_id = table.Column<Guid>(type: "uuid", nullable: false),
                    created_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    updated_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    created_by_user_id = table.Column<Guid>(type: "uuid", nullable: true),
                    updated_by_user_id = table.Column<Guid>(type: "uuid", nullable: true),
                    deleted_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    status = table.Column<string>(type: "text", nullable: false),
                    row_version = table.Column<int>(type: "integer", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ccms_document_requirements", x => x.id);
                });

            migrationBuilder.CreateTable(
                name: "ccms_documents",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    coverage_case_id = table.Column<Guid>(type: "uuid", nullable: false),
                    document_category = table.Column<string>(type: "text", nullable: false),
                    document_type = table.Column<string>(type: "text", nullable: false),
                    document_name = table.Column<string>(type: "text", nullable: false),
                    blob_url = table.Column<string>(type: "text", nullable: true),
                    file_size_bytes = table.Column<long>(type: "bigint", nullable: false),
                    mime_type = table.Column<string>(type: "text", nullable: true),
                    uploaded_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    uploaded_by_user_id = table.Column<Guid>(type: "uuid", nullable: true),
                    verified_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    verified_by_user_id = table.Column<Guid>(type: "uuid", nullable: true),
                    tenant_id = table.Column<Guid>(type: "uuid", nullable: false),
                    created_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    updated_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    created_by_user_id = table.Column<Guid>(type: "uuid", nullable: true),
                    updated_by_user_id = table.Column<Guid>(type: "uuid", nullable: true),
                    deleted_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    status = table.Column<string>(type: "text", nullable: false),
                    row_version = table.Column<int>(type: "integer", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ccms_documents", x => x.id);
                });

            migrationBuilder.CreateTable(
                name: "ccms_eligibility_checks",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    coverage_case_id = table.Column<Guid>(type: "uuid", nullable: false),
                    policy_number = table.Column<string>(type: "text", nullable: true),
                    membership_id = table.Column<string>(type: "text", nullable: true),
                    check_method = table.Column<string>(type: "text", nullable: false),
                    response_code = table.Column<string>(type: "text", nullable: true),
                    is_eligible = table.Column<bool>(type: "boolean", nullable: false),
                    eligibility_response_json = table.Column<string>(type: "text", nullable: true),
                    checked_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    tenant_id = table.Column<Guid>(type: "uuid", nullable: false),
                    created_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    updated_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    created_by_user_id = table.Column<Guid>(type: "uuid", nullable: true),
                    updated_by_user_id = table.Column<Guid>(type: "uuid", nullable: true),
                    deleted_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    status = table.Column<string>(type: "text", nullable: false),
                    row_version = table.Column<int>(type: "integer", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ccms_eligibility_checks", x => x.id);
                });

            migrationBuilder.CreateTable(
                name: "ccms_enhancement_events",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    enhancement_request_id = table.Column<Guid>(type: "uuid", nullable: false),
                    event_type = table.Column<string>(type: "text", nullable: false),
                    event_payload_json = table.Column<string>(type: "text", nullable: true),
                    actor_user_id = table.Column<Guid>(type: "uuid", nullable: true),
                    event_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    tenant_id = table.Column<Guid>(type: "uuid", nullable: false),
                    created_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    updated_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    created_by_user_id = table.Column<Guid>(type: "uuid", nullable: true),
                    updated_by_user_id = table.Column<Guid>(type: "uuid", nullable: true),
                    deleted_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    status = table.Column<string>(type: "text", nullable: false),
                    row_version = table.Column<int>(type: "integer", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ccms_enhancement_events", x => x.id);
                });

            migrationBuilder.CreateTable(
                name: "ccms_enhancement_requests",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    coverage_case_id = table.Column<Guid>(type: "uuid", nullable: false),
                    enhancement_type = table.Column<string>(type: "text", nullable: false),
                    requested_amount = table.Column<decimal>(type: "numeric", nullable: false),
                    approved_amount = table.Column<decimal>(type: "numeric", nullable: false),
                    reason = table.Column<string>(type: "text", nullable: true),
                    reason_json = table.Column<string>(type: "text", nullable: true),
                    submitted_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    decided_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    decision_by = table.Column<Guid>(type: "uuid", nullable: true),
                    tenant_id = table.Column<Guid>(type: "uuid", nullable: false),
                    created_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    updated_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    created_by_user_id = table.Column<Guid>(type: "uuid", nullable: true),
                    updated_by_user_id = table.Column<Guid>(type: "uuid", nullable: true),
                    deleted_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    status = table.Column<string>(type: "text", nullable: false),
                    row_version = table.Column<int>(type: "integer", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ccms_enhancement_requests", x => x.id);
                });

            migrationBuilder.CreateTable(
                name: "ccms_exclusion_rules",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    coverage_package_id = table.Column<Guid>(type: "uuid", nullable: false),
                    exclusion_type = table.Column<string>(type: "text", nullable: false),
                    exclusion_code = table.Column<string>(type: "text", nullable: false),
                    description = table.Column<string>(type: "text", nullable: true),
                    is_absolute = table.Column<bool>(type: "boolean", nullable: false),
                    tenant_id = table.Column<Guid>(type: "uuid", nullable: false),
                    created_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    updated_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    created_by_user_id = table.Column<Guid>(type: "uuid", nullable: true),
                    updated_by_user_id = table.Column<Guid>(type: "uuid", nullable: true),
                    deleted_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    status = table.Column<string>(type: "text", nullable: false),
                    row_version = table.Column<int>(type: "integer", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ccms_exclusion_rules", x => x.id);
                });

            migrationBuilder.CreateTable(
                name: "ccms_financial_years",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    year_code = table.Column<string>(type: "text", nullable: false),
                    year_label = table.Column<string>(type: "text", nullable: false),
                    start_date = table.Column<DateOnly>(type: "date", nullable: false),
                    end_date = table.Column<DateOnly>(type: "date", nullable: false),
                    is_current = table.Column<bool>(type: "boolean", nullable: false),
                    tenant_id = table.Column<Guid>(type: "uuid", nullable: false),
                    created_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    updated_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    created_by_user_id = table.Column<Guid>(type: "uuid", nullable: true),
                    updated_by_user_id = table.Column<Guid>(type: "uuid", nullable: true),
                    deleted_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    status = table.Column<string>(type: "text", nullable: false),
                    row_version = table.Column<int>(type: "integer", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ccms_financial_years", x => x.id);
                });

            migrationBuilder.CreateTable(
                name: "ccms_government_schemes",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    scheme_name = table.Column<string>(type: "text", nullable: false),
                    scheme_code = table.Column<string>(type: "text", nullable: false),
                    scheme_type = table.Column<string>(type: "text", nullable: false),
                    administered_by = table.Column<string>(type: "text", nullable: true),
                    benefit_limit_per_year = table.Column<decimal>(type: "numeric", nullable: true),
                    benefit_limit_per_case = table.Column<decimal>(type: "numeric", nullable: true),
                    eligibility_criteria_json = table.Column<string>(type: "text", nullable: true),
                    covered_procedures_json = table.Column<string>(type: "text", nullable: true),
                    documents_required_json = table.Column<string>(type: "text", nullable: true),
                    portal_url = table.Column<string>(type: "text", nullable: true),
                    tenant_id = table.Column<Guid>(type: "uuid", nullable: false),
                    created_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    updated_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    created_by_user_id = table.Column<Guid>(type: "uuid", nullable: true),
                    updated_by_user_id = table.Column<Guid>(type: "uuid", nullable: true),
                    deleted_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    status = table.Column<string>(type: "text", nullable: false),
                    row_version = table.Column<int>(type: "integer", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ccms_government_schemes", x => x.id);
                });

            migrationBuilder.CreateTable(
                name: "ccms_govt_scheme_applications",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    coverage_case_id = table.Column<Guid>(type: "uuid", nullable: false),
                    government_scheme_id = table.Column<Guid>(type: "uuid", nullable: false),
                    scheme_card_number = table.Column<string>(type: "text", nullable: true),
                    beneficiary_id = table.Column<string>(type: "text", nullable: true),
                    claimed_amount = table.Column<decimal>(type: "numeric", nullable: false),
                    approved_amount = table.Column<decimal>(type: "numeric", nullable: false),
                    application_state = table.Column<string>(type: "text", nullable: false),
                    scheme_reference_number = table.Column<string>(type: "text", nullable: true),
                    submitted_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    decided_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    tenant_id = table.Column<Guid>(type: "uuid", nullable: false),
                    created_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    updated_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    created_by_user_id = table.Column<Guid>(type: "uuid", nullable: true),
                    updated_by_user_id = table.Column<Guid>(type: "uuid", nullable: true),
                    deleted_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    status = table.Column<string>(type: "text", nullable: false),
                    row_version = table.Column<int>(type: "integer", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ccms_govt_scheme_applications", x => x.id);
                });

            migrationBuilder.CreateTable(
                name: "ccms_govt_scheme_documents",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    govt_scheme_application_id = table.Column<Guid>(type: "uuid", nullable: false),
                    document_type = table.Column<string>(type: "text", nullable: false),
                    document_name = table.Column<string>(type: "text", nullable: false),
                    blob_url = table.Column<string>(type: "text", nullable: true),
                    uploaded_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    tenant_id = table.Column<Guid>(type: "uuid", nullable: false),
                    created_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    updated_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    created_by_user_id = table.Column<Guid>(type: "uuid", nullable: true),
                    updated_by_user_id = table.Column<Guid>(type: "uuid", nullable: true),
                    deleted_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    status = table.Column<string>(type: "text", nullable: false),
                    row_version = table.Column<int>(type: "integer", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ccms_govt_scheme_documents", x => x.id);
                });

            migrationBuilder.CreateTable(
                name: "ccms_insurance_providers",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    provider_name = table.Column<string>(type: "text", nullable: false),
                    provider_code = table.Column<string>(type: "text", nullable: false),
                    license_number = table.Column<string>(type: "text", nullable: true),
                    contact_email = table.Column<string>(type: "text", nullable: true),
                    contact_phone = table.Column<string>(type: "text", nullable: true),
                    portal_url = table.Column<string>(type: "text", nullable: true),
                    api_endpoint = table.Column<string>(type: "text", nullable: true),
                    api_credentials_json = table.Column<string>(type: "text", nullable: true),
                    claim_submission_mode = table.Column<string>(type: "text", nullable: false),
                    pre_auth_required = table.Column<bool>(type: "boolean", nullable: false),
                    address_json = table.Column<string>(type: "text", nullable: true),
                    tenant_id = table.Column<Guid>(type: "uuid", nullable: false),
                    created_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    updated_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    created_by_user_id = table.Column<Guid>(type: "uuid", nullable: true),
                    updated_by_user_id = table.Column<Guid>(type: "uuid", nullable: true),
                    deleted_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    status = table.Column<string>(type: "text", nullable: false),
                    row_version = table.Column<int>(type: "integer", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ccms_insurance_providers", x => x.id);
                });

            migrationBuilder.CreateTable(
                name: "ccms_package_procedures",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    coverage_package_id = table.Column<Guid>(type: "uuid", nullable: false),
                    procedure_code = table.Column<string>(type: "text", nullable: false),
                    procedure_name = table.Column<string>(type: "text", nullable: false),
                    approved_amount = table.Column<decimal>(type: "numeric", nullable: false),
                    requires_preauth = table.Column<bool>(type: "boolean", nullable: false),
                    tenant_id = table.Column<Guid>(type: "uuid", nullable: false),
                    created_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    updated_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    created_by_user_id = table.Column<Guid>(type: "uuid", nullable: true),
                    updated_by_user_id = table.Column<Guid>(type: "uuid", nullable: true),
                    deleted_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    status = table.Column<string>(type: "text", nullable: false),
                    row_version = table.Column<int>(type: "integer", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ccms_package_procedures", x => x.id);
                });

            migrationBuilder.CreateTable(
                name: "ccms_policy_captures",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    coverage_case_id = table.Column<Guid>(type: "uuid", nullable: false),
                    policy_number = table.Column<string>(type: "text", nullable: false),
                    member_name = table.Column<string>(type: "text", nullable: true),
                    member_dob = table.Column<DateOnly>(type: "date", nullable: true),
                    policy_start_date = table.Column<DateOnly>(type: "date", nullable: false),
                    policy_end_date = table.Column<DateOnly>(type: "date", nullable: false),
                    sum_insured = table.Column<decimal>(type: "numeric", nullable: false),
                    balance_sum_insured = table.Column<decimal>(type: "numeric", nullable: false),
                    cumulative_bonus_amount = table.Column<decimal>(type: "numeric", nullable: false),
                    room_entitlement = table.Column<string>(type: "text", nullable: true),
                    policy_docs_json = table.Column<string>(type: "text", nullable: true),
                    captured_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    tenant_id = table.Column<Guid>(type: "uuid", nullable: false),
                    created_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    updated_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    created_by_user_id = table.Column<Guid>(type: "uuid", nullable: true),
                    updated_by_user_id = table.Column<Guid>(type: "uuid", nullable: true),
                    deleted_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    status = table.Column<string>(type: "text", nullable: false),
                    row_version = table.Column<int>(type: "integer", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ccms_policy_captures", x => x.id);
                });

            migrationBuilder.CreateTable(
                name: "ccms_policy_coverage_items",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    policy_capture_id = table.Column<Guid>(type: "uuid", nullable: false),
                    item_type = table.Column<string>(type: "text", nullable: false),
                    item_code = table.Column<string>(type: "text", nullable: true),
                    item_description = table.Column<string>(type: "text", nullable: false),
                    limit_amount = table.Column<decimal>(type: "numeric", nullable: false),
                    used_amount = table.Column<decimal>(type: "numeric", nullable: false),
                    available_amount = table.Column<decimal>(type: "numeric", nullable: false),
                    is_excluded = table.Column<bool>(type: "boolean", nullable: false),
                    tenant_id = table.Column<Guid>(type: "uuid", nullable: false),
                    created_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    updated_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    created_by_user_id = table.Column<Guid>(type: "uuid", nullable: true),
                    updated_by_user_id = table.Column<Guid>(type: "uuid", nullable: true),
                    deleted_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    status = table.Column<string>(type: "text", nullable: false),
                    row_version = table.Column<int>(type: "integer", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ccms_policy_coverage_items", x => x.id);
                });

            migrationBuilder.CreateTable(
                name: "ccms_settlement_line_items",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    settlement_id = table.Column<Guid>(type: "uuid", nullable: false),
                    line_item_type = table.Column<string>(type: "text", nullable: false),
                    description = table.Column<string>(type: "text", nullable: true),
                    claimed_amount = table.Column<decimal>(type: "numeric", nullable: false),
                    settled_amount = table.Column<decimal>(type: "numeric", nullable: false),
                    disallowed_amount = table.Column<decimal>(type: "numeric", nullable: false),
                    disallowed_reason = table.Column<string>(type: "text", nullable: true),
                    tenant_id = table.Column<Guid>(type: "uuid", nullable: false),
                    created_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    updated_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    created_by_user_id = table.Column<Guid>(type: "uuid", nullable: true),
                    updated_by_user_id = table.Column<Guid>(type: "uuid", nullable: true),
                    deleted_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    status = table.Column<string>(type: "text", nullable: false),
                    row_version = table.Column<int>(type: "integer", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ccms_settlement_line_items", x => x.id);
                });

            migrationBuilder.CreateTable(
                name: "ccms_settlements",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    coverage_case_id = table.Column<Guid>(type: "uuid", nullable: false),
                    claim_packet_id = table.Column<Guid>(type: "uuid", nullable: true),
                    settlement_type = table.Column<string>(type: "text", nullable: false),
                    settled_amount = table.Column<decimal>(type: "numeric", nullable: false),
                    payment_mode = table.Column<string>(type: "text", nullable: true),
                    payment_reference = table.Column<string>(type: "text", nullable: true),
                    settled_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    reconciliation_status = table.Column<string>(type: "text", nullable: false),
                    reconciliation_notes = table.Column<string>(type: "text", nullable: true),
                    reconciliation_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    tenant_id = table.Column<Guid>(type: "uuid", nullable: false),
                    created_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    updated_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    created_by_user_id = table.Column<Guid>(type: "uuid", nullable: true),
                    updated_by_user_id = table.Column<Guid>(type: "uuid", nullable: true),
                    deleted_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    status = table.Column<string>(type: "text", nullable: false),
                    row_version = table.Column<int>(type: "integer", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ccms_settlements", x => x.id);
                });

            migrationBuilder.CreateTable(
                name: "ccms_tpa_providers",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    tpa_name = table.Column<string>(type: "text", nullable: false),
                    tpa_code = table.Column<string>(type: "text", nullable: false),
                    insurance_provider_id = table.Column<Guid>(type: "uuid", nullable: true),
                    contact_email = table.Column<string>(type: "text", nullable: true),
                    contact_phone = table.Column<string>(type: "text", nullable: true),
                    portal_url = table.Column<string>(type: "text", nullable: true),
                    claims_email = table.Column<string>(type: "text", nullable: true),
                    tat_days_preauth = table.Column<int>(type: "integer", nullable: false),
                    tat_days_claim = table.Column<int>(type: "integer", nullable: false),
                    tenant_id = table.Column<Guid>(type: "uuid", nullable: false),
                    created_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    updated_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    created_by_user_id = table.Column<Guid>(type: "uuid", nullable: true),
                    updated_by_user_id = table.Column<Guid>(type: "uuid", nullable: true),
                    deleted_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    status = table.Column<string>(type: "text", nullable: false),
                    row_version = table.Column<int>(type: "integer", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ccms_tpa_providers", x => x.id);
                });

            migrationBuilder.CreateTable(
                name: "ccms_workflow_definitions",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    name = table.Column<string>(type: "text", nullable: false),
                    code = table.Column<string>(type: "text", nullable: false),
                    version = table.Column<int>(type: "integer", nullable: false),
                    is_active = table.Column<bool>(type: "boolean", nullable: false),
                    config_json = table.Column<string>(type: "text", nullable: true),
                    tenant_id = table.Column<Guid>(type: "uuid", nullable: false),
                    created_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    updated_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    created_by_user_id = table.Column<Guid>(type: "uuid", nullable: true),
                    updated_by_user_id = table.Column<Guid>(type: "uuid", nullable: true),
                    deleted_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    status = table.Column<string>(type: "text", nullable: false),
                    row_version = table.Column<int>(type: "integer", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ccms_workflow_definitions", x => x.id);
                });

            migrationBuilder.CreateTable(
                name: "ccms_workflow_history",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    workflow_instance_id = table.Column<Guid>(type: "uuid", nullable: false),
                    from_state_id = table.Column<Guid>(type: "uuid", nullable: true),
                    to_state_id = table.Column<Guid>(type: "uuid", nullable: false),
                    trigger_event = table.Column<string>(type: "text", nullable: false),
                    actor_user_id = table.Column<Guid>(type: "uuid", nullable: true),
                    notes = table.Column<string>(type: "text", nullable: true),
                    transitioned_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    meta_json = table.Column<string>(type: "text", nullable: true),
                    tenant_id = table.Column<Guid>(type: "uuid", nullable: false),
                    created_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    updated_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    created_by_user_id = table.Column<Guid>(type: "uuid", nullable: true),
                    updated_by_user_id = table.Column<Guid>(type: "uuid", nullable: true),
                    deleted_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    status = table.Column<string>(type: "text", nullable: false),
                    row_version = table.Column<int>(type: "integer", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ccms_workflow_history", x => x.id);
                });

            migrationBuilder.CreateTable(
                name: "ccms_workflow_instances",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    workflow_definition_id = table.Column<Guid>(type: "uuid", nullable: false),
                    current_state_id = table.Column<Guid>(type: "uuid", nullable: false),
                    entity_type = table.Column<string>(type: "text", nullable: false),
                    entity_id = table.Column<Guid>(type: "uuid", nullable: false),
                    context_json = table.Column<string>(type: "text", nullable: true),
                    started_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    completed_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    tenant_id = table.Column<Guid>(type: "uuid", nullable: false),
                    created_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    updated_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    created_by_user_id = table.Column<Guid>(type: "uuid", nullable: true),
                    updated_by_user_id = table.Column<Guid>(type: "uuid", nullable: true),
                    deleted_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    status = table.Column<string>(type: "text", nullable: false),
                    row_version = table.Column<int>(type: "integer", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ccms_workflow_instances", x => x.id);
                });

            migrationBuilder.CreateTable(
                name: "ccms_workflow_states",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    workflow_definition_id = table.Column<Guid>(type: "uuid", nullable: false),
                    state_code = table.Column<string>(type: "text", nullable: false),
                    state_label = table.Column<string>(type: "text", nullable: false),
                    is_initial = table.Column<bool>(type: "boolean", nullable: false),
                    is_final = table.Column<bool>(type: "boolean", nullable: false),
                    is_terminal = table.Column<bool>(type: "boolean", nullable: false),
                    sort_order = table.Column<int>(type: "integer", nullable: false),
                    meta_json = table.Column<string>(type: "text", nullable: true),
                    tenant_id = table.Column<Guid>(type: "uuid", nullable: false),
                    created_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    updated_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    created_by_user_id = table.Column<Guid>(type: "uuid", nullable: true),
                    updated_by_user_id = table.Column<Guid>(type: "uuid", nullable: true),
                    deleted_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    status = table.Column<string>(type: "text", nullable: false),
                    row_version = table.Column<int>(type: "integer", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ccms_workflow_states", x => x.id);
                });

            migrationBuilder.CreateTable(
                name: "ccms_workflow_transitions",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    workflow_definition_id = table.Column<Guid>(type: "uuid", nullable: false),
                    from_state_id = table.Column<Guid>(type: "uuid", nullable: false),
                    to_state_id = table.Column<Guid>(type: "uuid", nullable: false),
                    trigger_event = table.Column<string>(type: "text", nullable: false),
                    requires_role = table.Column<string>(type: "text", nullable: true),
                    is_automatic = table.Column<bool>(type: "boolean", nullable: false),
                    guard_condition_json = table.Column<string>(type: "text", nullable: true),
                    tenant_id = table.Column<Guid>(type: "uuid", nullable: false),
                    created_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    updated_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    created_by_user_id = table.Column<Guid>(type: "uuid", nullable: true),
                    updated_by_user_id = table.Column<Guid>(type: "uuid", nullable: true),
                    deleted_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    status = table.Column<string>(type: "text", nullable: false),
                    row_version = table.Column<int>(type: "integer", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ccms_workflow_transitions", x => x.id);
                });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "ccms_approval_events");

            migrationBuilder.DropTable(
                name: "ccms_authorization_documents");

            migrationBuilder.DropTable(
                name: "ccms_billing_summaries");

            migrationBuilder.DropTable(
                name: "ccms_claim_documents");

            migrationBuilder.DropTable(
                name: "ccms_claim_packets");

            migrationBuilder.DropTable(
                name: "ccms_clarification_items");

            migrationBuilder.DropTable(
                name: "ccms_communication_logs");

            migrationBuilder.DropTable(
                name: "ccms_communication_templates");

            migrationBuilder.DropTable(
                name: "ccms_coverage_allocations");

            migrationBuilder.DropTable(
                name: "ccms_coverage_authorizations");

            migrationBuilder.DropTable(
                name: "ccms_coverage_cases");

            migrationBuilder.DropTable(
                name: "ccms_coverage_packages");

            migrationBuilder.DropTable(
                name: "ccms_document_requirements");

            migrationBuilder.DropTable(
                name: "ccms_documents");

            migrationBuilder.DropTable(
                name: "ccms_eligibility_checks");

            migrationBuilder.DropTable(
                name: "ccms_enhancement_events");

            migrationBuilder.DropTable(
                name: "ccms_enhancement_requests");

            migrationBuilder.DropTable(
                name: "ccms_exclusion_rules");

            migrationBuilder.DropTable(
                name: "ccms_financial_years");

            migrationBuilder.DropTable(
                name: "ccms_government_schemes");

            migrationBuilder.DropTable(
                name: "ccms_govt_scheme_applications");

            migrationBuilder.DropTable(
                name: "ccms_govt_scheme_documents");

            migrationBuilder.DropTable(
                name: "ccms_insurance_providers");

            migrationBuilder.DropTable(
                name: "ccms_package_procedures");

            migrationBuilder.DropTable(
                name: "ccms_policy_captures");

            migrationBuilder.DropTable(
                name: "ccms_policy_coverage_items");

            migrationBuilder.DropTable(
                name: "ccms_settlement_line_items");

            migrationBuilder.DropTable(
                name: "ccms_settlements");

            migrationBuilder.DropTable(
                name: "ccms_tpa_providers");

            migrationBuilder.DropTable(
                name: "ccms_workflow_definitions");

            migrationBuilder.DropTable(
                name: "ccms_workflow_history");

            migrationBuilder.DropTable(
                name: "ccms_workflow_instances");

            migrationBuilder.DropTable(
                name: "ccms_workflow_states");

            migrationBuilder.DropTable(
                name: "ccms_workflow_transitions");
        }
    }
}
