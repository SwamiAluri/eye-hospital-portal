using Microsoft.EntityFrameworkCore;
using CcmsApi.Functions;    // BillingTransactionRow keyless projection
using CcmsApi.Models.Domain;

namespace CcmsApi.Data;

public class CcmsDbContext : DbContext
{
    public CcmsDbContext(DbContextOptions<CcmsDbContext> options) : base(options) { }

    // ── Phase 0: Financial Years ──────────────────────────────────────────
    public DbSet<CcmsFinancialYear>         FinancialYears            { get; set; }

    // ── Phase 1: Workflow Engine ──────────────────────────────────────────
    public DbSet<CcmsWorkflowDefinition>    WorkflowDefinitions       { get; set; }
    public DbSet<CcmsWorkflowState>         WorkflowStates            { get; set; }
    public DbSet<CcmsWorkflowTransition>    WorkflowTransitions       { get; set; }
    public DbSet<CcmsWorkflowInstance>      WorkflowInstances         { get; set; }
    public DbSet<CcmsWorkflowHistory>       WorkflowHistories         { get; set; }

    // ── Phase 2: Master Data ──────────────────────────────────────────────
    public DbSet<CcmsInsuranceProvider>     InsuranceProviders        { get; set; }
    public DbSet<CcmsTpaProvider>           TpaProviders              { get; set; }
    public DbSet<CcmsGovernmentScheme>      GovernmentSchemes         { get; set; }
    public DbSet<CcmsCoveragePackage>       CoveragePackages          { get; set; }
    public DbSet<CcmsPackageProcedure>      PackageProcedures         { get; set; }
    public DbSet<CcmsExclusionRule>         ExclusionRules            { get; set; }
    public DbSet<CcmsDocumentRequirement>   DocumentRequirements      { get; set; }

    // ── Phase 3: Coverage Cases ───────────────────────────────────────────
    public DbSet<CcmsCoverageCase>          CoverageCases             { get; set; }
    public DbSet<CcmsEligibilityCheck>      EligibilityChecks         { get; set; }
    public DbSet<CcmsPolicyCapture>         PolicyCaptures            { get; set; }
    public DbSet<CcmsPolicyCoverageItem>    PolicyCoverageItems       { get; set; }

    // ── Phase 4: Pre-Authorization ────────────────────────────────────────
    public DbSet<CcmsCoverageAuthorization> CoverageAuthorizations    { get; set; }
    public DbSet<CcmsAuthorizationDocument> AuthorizationDocuments    { get; set; }

    // ── Phase 5: Approval Events ──────────────────────────────────────────
    public DbSet<CcmsApprovalEvent>         ApprovalEvents            { get; set; }
    public DbSet<CcmsClarificationItem>     ClarificationItems        { get; set; }

    // ── Phase 6: Enhancements ─────────────────────────────────────────────
    public DbSet<CcmsEnhancementRequest>    EnhancementRequests       { get; set; }
    public DbSet<CcmsEnhancementEvent>      EnhancementEvents         { get; set; }

    // ── Phase 7: Billing Integration ─────────────────────────────────────
    public DbSet<CcmsBillingSummary>        BillingSummaries          { get; set; }
    public DbSet<CcmsCoverageAllocation>    CoverageAllocations       { get; set; }

    // ── Phase 8: Claims ───────────────────────────────────────────────────
    public DbSet<CcmsClaimPacket>           ClaimPackets              { get; set; }
    public DbSet<CcmsClaimDocument>         ClaimDocuments            { get; set; }

    // ── Phase 9: Settlements ──────────────────────────────────────────────
    public DbSet<CcmsSettlement>            Settlements               { get; set; }
    public DbSet<CcmsSettlementLineItem>    SettlementLineItems       { get; set; }
    public DbSet<CcmsCollectionProjection>  CollectionProjections     { get; set; }
    public DbSet<CcmsCollectionEvent>       CollectionEvents          { get; set; }

    // ── Phase 10: Documents ───────────────────────────────────────────────
    public DbSet<CcmsDocument>              Documents                 { get; set; }

    // ── Phase 11: Communications ──────────────────────────────────────────
    public DbSet<CcmsCommunicationLog>      CommunicationLogs         { get; set; }
    public DbSet<CcmsCommunicationTemplate> CommunicationTemplates    { get; set; }

    // ── Phase 13: Government Scheme Applications ──────────────────────────
    public DbSet<CcmsGovtSchemeApplication> GovtSchemeApplications    { get; set; }
    public DbSet<CcmsGovtSchemeDocument>    GovtSchemeDocuments       { get; set; }

    // ── Migration 122: Visit Insurance Policies ───────────────────────────
    public DbSet<CcmsVisitInsurancePolicy>  VisitInsurancePolicies    { get; set; }

    // ── Policy card OCR audit ─────────────────────────────────────────────
    public DbSet<CcmsPolicyExtractionAuditLog> PolicyExtractionAuditLogs { get; set; }

    // ── Keyless entities (raw SQL projections) ────────────────────────────
    public DbSet<BillingTransactionRow>     BillingTransactionRows    { get; set; }

    protected override void OnModelCreating(ModelBuilder mb)
    {
        // ── Phase 0 ───────────────────────────────────────────────────────
        mb.Entity<CcmsFinancialYear>(e =>
        {
            e.ToTable("ccms_financial_years");
            e.HasKey(x => x.Id);
            e.Property(x => x.Id).HasColumnName("id");
            e.Property(x => x.TenantId).HasColumnName("tenant_id");
            e.Property(x => x.YearCode).HasColumnName("year_code");
            e.Property(x => x.YearLabel).HasColumnName("year_label");
            e.Property(x => x.StartDate).HasColumnName("start_date");
            e.Property(x => x.EndDate).HasColumnName("end_date");
            e.Property(x => x.IsCurrent).HasColumnName("is_current");
            e.Property(x => x.CreatedAt).HasColumnName("created_at");
            e.Property(x => x.UpdatedAt).HasColumnName("updated_at");
            e.Property(x => x.CreatedByUserId).HasColumnName("created_by_user_id");
            e.Property(x => x.UpdatedByUserId).HasColumnName("updated_by_user_id");
            e.Property(x => x.DeletedAt).HasColumnName("deleted_at");
            e.Property(x => x.Status).HasColumnName("status");
            e.Property(x => x.RowVersion).HasColumnName("row_version");
        });

        // ── Phase 1: Workflow ─────────────────────────────────────────────
        mb.Entity<CcmsWorkflowDefinition>(e =>
        {
            e.ToTable("ccms_workflow_definitions");
            e.HasKey(x => x.Id);
            e.Property(x => x.Id).HasColumnName("id");
            e.Property(x => x.TenantId).HasColumnName("tenant_id");
            e.Property(x => x.Name).HasColumnName("name");
            e.Property(x => x.Code).HasColumnName("code");
            e.Property(x => x.Version).HasColumnName("version");
            e.Property(x => x.IsActive).HasColumnName("is_active");
            e.Property(x => x.ConfigJson).HasColumnName("config_json");
            e.Property(x => x.CreatedAt).HasColumnName("created_at");
            e.Property(x => x.UpdatedAt).HasColumnName("updated_at");
            e.Property(x => x.CreatedByUserId).HasColumnName("created_by_user_id");
            e.Property(x => x.UpdatedByUserId).HasColumnName("updated_by_user_id");
            e.Property(x => x.DeletedAt).HasColumnName("deleted_at");
            e.Property(x => x.Status).HasColumnName("status");
            e.Property(x => x.RowVersion).HasColumnName("row_version");
        });

        mb.Entity<CcmsWorkflowState>(e =>
        {
            e.ToTable("ccms_workflow_states");
            e.HasKey(x => x.Id);
            e.Property(x => x.Id).HasColumnName("id");
            e.Property(x => x.TenantId).HasColumnName("tenant_id");
            e.Property(x => x.WorkflowDefinitionId).HasColumnName("workflow_definition_id");
            e.Property(x => x.StateCode).HasColumnName("state_code");
            e.Property(x => x.StateLabel).HasColumnName("state_label");
            e.Property(x => x.IsInitial).HasColumnName("is_initial");
            e.Property(x => x.IsFinal).HasColumnName("is_final");
            e.Property(x => x.IsTerminal).HasColumnName("is_terminal");
            e.Property(x => x.SortOrder).HasColumnName("sort_order");
            e.Property(x => x.MetaJson).HasColumnName("meta_json");
            e.Property(x => x.CreatedAt).HasColumnName("created_at");
            e.Property(x => x.UpdatedAt).HasColumnName("updated_at");
            e.Property(x => x.CreatedByUserId).HasColumnName("created_by_user_id");
            e.Property(x => x.UpdatedByUserId).HasColumnName("updated_by_user_id");
            e.Property(x => x.DeletedAt).HasColumnName("deleted_at");
            e.Property(x => x.Status).HasColumnName("status");
            e.Property(x => x.RowVersion).HasColumnName("row_version");
        });

        mb.Entity<CcmsWorkflowTransition>(e =>
        {
            e.ToTable("ccms_workflow_transitions");
            e.HasKey(x => x.Id);
            e.Property(x => x.Id).HasColumnName("id");
            e.Property(x => x.TenantId).HasColumnName("tenant_id");
            e.Property(x => x.WorkflowDefinitionId).HasColumnName("workflow_definition_id");
            e.Property(x => x.FromStateId).HasColumnName("from_state_id");
            e.Property(x => x.ToStateId).HasColumnName("to_state_id");
            e.Property(x => x.TriggerEvent).HasColumnName("trigger_event");
            e.Property(x => x.RequiresRole).HasColumnName("requires_role");
            e.Property(x => x.IsAutomatic).HasColumnName("is_automatic");
            e.Property(x => x.GuardConditionJson).HasColumnName("guard_condition_json");
            e.Property(x => x.CreatedAt).HasColumnName("created_at");
            e.Property(x => x.UpdatedAt).HasColumnName("updated_at");
            e.Property(x => x.CreatedByUserId).HasColumnName("created_by_user_id");
            e.Property(x => x.UpdatedByUserId).HasColumnName("updated_by_user_id");
            e.Property(x => x.DeletedAt).HasColumnName("deleted_at");
            e.Property(x => x.Status).HasColumnName("status");
            e.Property(x => x.RowVersion).HasColumnName("row_version");
        });

        mb.Entity<CcmsWorkflowInstance>(e =>
        {
            e.ToTable("ccms_workflow_instances");
            e.HasKey(x => x.Id);
            e.Property(x => x.Id).HasColumnName("id");
            e.Property(x => x.TenantId).HasColumnName("tenant_id");
            e.Property(x => x.WorkflowDefinitionId).HasColumnName("workflow_definition_id");
            e.Property(x => x.CurrentStateId).HasColumnName("current_state_id");
            e.Property(x => x.EntityType).HasColumnName("entity_type");
            e.Property(x => x.EntityId).HasColumnName("entity_id");
            e.Property(x => x.ContextJson).HasColumnName("context_json");
            e.Property(x => x.StartedAt).HasColumnName("started_at");
            e.Property(x => x.CompletedAt).HasColumnName("completed_at");
            e.Property(x => x.CreatedAt).HasColumnName("created_at");
            e.Property(x => x.UpdatedAt).HasColumnName("updated_at");
            e.Property(x => x.CreatedByUserId).HasColumnName("created_by_user_id");
            e.Property(x => x.UpdatedByUserId).HasColumnName("updated_by_user_id");
            e.Property(x => x.DeletedAt).HasColumnName("deleted_at");
            e.Property(x => x.Status).HasColumnName("status");
            e.Property(x => x.RowVersion).HasColumnName("row_version");
        });

        mb.Entity<CcmsWorkflowHistory>(e =>
        {
            e.ToTable("ccms_workflow_history");
            e.HasKey(x => x.Id);
            e.Property(x => x.Id).HasColumnName("id");
            e.Property(x => x.TenantId).HasColumnName("tenant_id");
            e.Property(x => x.WorkflowInstanceId).HasColumnName("workflow_instance_id");
            e.Property(x => x.FromStateId).HasColumnName("from_state_id");
            e.Property(x => x.ToStateId).HasColumnName("to_state_id");
            e.Property(x => x.FromStateCode).HasColumnName("from_state_code");
            e.Property(x => x.ToStateCode).HasColumnName("to_state_code");
            e.Property(x => x.TriggerEvent).HasColumnName("trigger_event");
            e.Property(x => x.ActorUserId).HasColumnName("actor_user_id");
            e.Property(x => x.Notes).HasColumnName("notes");
            e.Property(x => x.TransitionedAt).HasColumnName("transitioned_at");
            e.Property(x => x.MetaJson).HasColumnName("meta_json");
            e.Property(x => x.CreatedAt).HasColumnName("created_at");
            e.Property(x => x.UpdatedAt).HasColumnName("updated_at");
            e.Property(x => x.CreatedByUserId).HasColumnName("created_by_user_id");
            e.Property(x => x.UpdatedByUserId).HasColumnName("updated_by_user_id");
            e.Property(x => x.DeletedAt).HasColumnName("deleted_at");
            e.Property(x => x.Status).HasColumnName("status");
            e.Property(x => x.RowVersion).HasColumnName("row_version");
        });

        // ── Phase 2: Master Data ──────────────────────────────────────────
        mb.Entity<CcmsInsuranceProvider>(e =>
        {
            e.ToTable("ccms_insurance_providers");
            e.HasKey(x => x.Id);
            MapStandardColumns(e);
            e.Property(x => x.ProviderName).HasColumnName("provider_name");
            e.Property(x => x.ProviderCode).HasColumnName("provider_code");
            e.Property(x => x.LicenseNumber).HasColumnName("license_number");
            e.Property(x => x.ContactEmail).HasColumnName("contact_email");
            e.Property(x => x.ContactPhone).HasColumnName("contact_phone");
            e.Property(x => x.PortalUrl).HasColumnName("portal_url");
            e.Property(x => x.ApiEndpoint).HasColumnName("api_endpoint");
            e.Property(x => x.ApiCredentialsJson).HasColumnName("api_credentials_json");
            e.Property(x => x.ClaimSubmissionMode).HasColumnName("claim_submission_mode");
            e.Property(x => x.PreAuthRequired).HasColumnName("pre_auth_required");
            e.Property(x => x.AddressJson).HasColumnName("address_json");
            // Migration 123
            e.Property(x => x.PayerCategory).HasColumnName("payer_category");
            e.Property(x => x.DebtorSubtype).HasColumnName("debtor_subtype");
            e.Property(x => x.CreditLimit).HasColumnName("credit_limit");
            e.Property(x => x.ExportCode).HasColumnName("export_code");
            e.Property(x => x.HospitalIdentifier).HasColumnName("hospital_identifier");
            e.Property(x => x.ServiceTaxApplicable).HasColumnName("service_tax_applicable");
            e.Property(x => x.DefaultServiceTaxPercent).HasColumnName("default_service_tax_percent");
            e.Property(x => x.TdsMandatory).HasColumnName("tds_mandatory");
            e.Property(x => x.ValidFrom).HasColumnName("valid_from");
            e.Property(x => x.ValidTo).HasColumnName("valid_to");
            e.Property(x => x.FormatCode).HasColumnName("format_code");
        });

        mb.Entity<CcmsTpaProvider>(e =>
        {
            e.ToTable("ccms_tpa_providers");
            e.HasKey(x => x.Id);
            MapStandardColumns(e);
            e.Property(x => x.TpaName).HasColumnName("tpa_name");
            e.Property(x => x.TpaCode).HasColumnName("tpa_code");
            e.Property(x => x.InsuranceProviderId).HasColumnName("insurance_provider_id");
            e.Property(x => x.ContactEmail).HasColumnName("contact_email");
            e.Property(x => x.ContactPhone).HasColumnName("contact_phone");
            e.Property(x => x.PortalUrl).HasColumnName("portal_url");
            e.Property(x => x.ClaimsEmail).HasColumnName("claims_email");
            e.Property(x => x.TatDaysPreauth).HasColumnName("tat_days_preauth");
            e.Property(x => x.TatDaysClaim).HasColumnName("tat_days_claim");
        });

        mb.Entity<CcmsGovernmentScheme>(e =>
        {
            e.ToTable("ccms_government_schemes");
            e.HasKey(x => x.Id);
            MapStandardColumns(e);
            e.Property(x => x.SchemeName).HasColumnName("scheme_name");
            e.Property(x => x.SchemeCode).HasColumnName("scheme_code");
            e.Property(x => x.SchemeType).HasColumnName("scheme_type");
            e.Property(x => x.AdministeredBy).HasColumnName("administered_by");
            e.Property(x => x.BenefitLimitPerYear).HasColumnName("benefit_limit_per_year");
            e.Property(x => x.BenefitLimitPerCase).HasColumnName("benefit_limit_per_case");
            e.Property(x => x.EligibilityCriteriaJson).HasColumnName("eligibility_criteria_json");
            e.Property(x => x.CoveredProceduresJson).HasColumnName("covered_procedures_json");
            e.Property(x => x.DocumentsRequiredJson).HasColumnName("documents_required_json");
            e.Property(x => x.PortalUrl).HasColumnName("portal_url");
        });

        mb.Entity<CcmsCoveragePackage>(e =>
        {
            e.ToTable("ccms_coverage_packages");
            e.HasKey(x => x.Id);
            MapStandardColumns(e);
            e.Property(x => x.PackageName).HasColumnName("package_name");
            e.Property(x => x.PackageCode).HasColumnName("package_code");
            e.Property(x => x.InsuranceProviderId).HasColumnName("insurance_provider_id");
            e.Property(x => x.TpaProviderId).HasColumnName("tpa_provider_id");
            e.Property(x => x.GovernmentSchemeId).HasColumnName("government_scheme_id");
            e.Property(x => x.PackageType).HasColumnName("package_type");
            e.Property(x => x.SumInsuredAmount).HasColumnName("sum_insured_amount");
            e.Property(x => x.RoomRentLimit).HasColumnName("room_rent_limit");
            e.Property(x => x.IcuRentLimit).HasColumnName("icu_rent_limit");
            e.Property(x => x.SubLimitsJson).HasColumnName("sub_limits_json");
            e.Property(x => x.WaitingPeriodDays).HasColumnName("waiting_period_days");
            e.Property(x => x.CopayPercent).HasColumnName("copay_percent");
            e.Property(x => x.DeductibleAmount).HasColumnName("deductible_amount");
            e.Property(x => x.ValidFrom).HasColumnName("valid_from");
            e.Property(x => x.ValidTo).HasColumnName("valid_to");
        });

        mb.Entity<CcmsPackageProcedure>(e =>
        {
            e.ToTable("ccms_package_procedures");
            e.HasKey(x => x.Id);
            MapStandardColumns(e);
            e.Property(x => x.CoveragePackageId).HasColumnName("coverage_package_id");
            e.Property(x => x.ProcedureCode).HasColumnName("procedure_code");
            e.Property(x => x.ProcedureName).HasColumnName("procedure_name");
            e.Property(x => x.ApprovedAmount).HasColumnName("approved_amount");
            e.Property(x => x.RequiresPreauth).HasColumnName("requires_preauth");
        });

        mb.Entity<CcmsExclusionRule>(e =>
        {
            e.ToTable("ccms_exclusion_rules");
            e.HasKey(x => x.Id);
            MapStandardColumns(e);
            e.Property(x => x.CoveragePackageId).HasColumnName("coverage_package_id");
            e.Property(x => x.ExclusionType).HasColumnName("exclusion_type");
            e.Property(x => x.ExclusionCode).HasColumnName("exclusion_code");
            e.Property(x => x.Description).HasColumnName("description");
            e.Property(x => x.IsAbsolute).HasColumnName("is_absolute");
        });

        mb.Entity<CcmsDocumentRequirement>(e =>
        {
            e.ToTable("ccms_document_requirements");
            e.HasKey(x => x.Id);
            MapStandardColumns(e);
            e.Property(x => x.InsuranceProviderId).HasColumnName("insurance_provider_id");
            e.Property(x => x.TpaProviderId).HasColumnName("tpa_provider_id");
            e.Property(x => x.GovernmentSchemeId).HasColumnName("government_scheme_id");
            e.Property(x => x.DocumentType).HasColumnName("document_type");
            e.Property(x => x.DocumentName).HasColumnName("document_name");
            e.Property(x => x.IsRequired).HasColumnName("is_required");
            e.Property(x => x.AppliesAt).HasColumnName("applies_at");
        });

        // ── Phase 3: Coverage Cases ────────────────────────────────────────
        mb.Entity<CcmsCoverageCase>(e =>
        {
            e.ToTable("ccms_coverage_cases");
            e.HasKey(x => x.Id);
            MapStandardColumns(e);
            e.Property(x => x.CaseNumber).HasColumnName("case_number");
            e.Property(x => x.PatientId).HasColumnName("patient_id");
            e.Property(x => x.PatientName).HasColumnName("patient_name");
            e.Property(x => x.SessionId).HasColumnName("session_id");
            e.Property(x => x.JourneyId).HasColumnName("journey_id");
            e.Property(x => x.FinancialYearId).HasColumnName("financial_year_id");
            e.Property(x => x.BranchId).HasColumnName("branch_id");
            e.Property(x => x.DoctorId).HasColumnName("doctor_id");
            e.Property(x => x.PayerType).HasColumnName("payer_type");
            e.Property(x => x.PaymentType).HasColumnName("payment_type");
            e.Property(x => x.InsuranceProviderId).HasColumnName("insurance_provider_id");
            e.Property(x => x.TpaProviderId).HasColumnName("tpa_provider_id");
            e.Property(x => x.GovernmentSchemeId).HasColumnName("government_scheme_id");
            e.Property(x => x.CoveragePackageId).HasColumnName("coverage_package_id");
            e.Property(x => x.WorkflowInstanceId).HasColumnName("workflow_instance_id");
            e.Property(x => x.CurrentState).HasColumnName("current_state");
            e.Property(x => x.ApprovedAmount).HasColumnName("approved_amount");
            e.Property(x => x.RoomClassApproved).HasColumnName("room_class_approved");
            e.Property(x => x.PreAuthNumber).HasColumnName("pre_auth_number");
            e.Property(x => x.PreAuthExpiry).HasColumnName("pre_auth_expiry");
            e.Property(x => x.LegacyPreauthId).HasColumnName("legacy_preauth_id");
            e.Property(x => x.SessionPreauthId).HasColumnName("session_preauth_id");
            e.Property(x => x.EmergencyFcApplied).HasColumnName("emergency_fc_applied");
            e.Property(x => x.NotesJson).HasColumnName("notes_json");
            e.Property(x => x.CounsellorDraftJson).HasColumnName("counsellor_draft_json");
            e.Property(x => x.IsDraft).HasColumnName("is_draft");
            e.Property(x => x.DraftSavedAt).HasColumnName("draft_saved_at");
            // Migration 124
            e.Property(x => x.ProcessStatus).HasColumnName("process_status");
            e.Property(x => x.ProcessStatusUpdatedAt).HasColumnName("process_status_updated_at");
            e.Property(x => x.ServiceTaxApplicable).HasColumnName("service_tax_applicable");
            e.Property(x => x.ServiceTaxPercent).HasColumnName("service_tax_percent");
            e.Property(x => x.ServiceTaxAmount).HasColumnName("service_tax_amount");
            // Denormalized display field (kept in sync by search trigger / migration 129)
            e.Property(x => x.InsurerName).HasColumnName("search_insurer_name").IsRequired(false);
            // One active coverage case per counselling session (prevents doc orphaning on race create).
            e.HasIndex(x => new { x.TenantId, x.SessionId })
                .IsUnique()
                .HasFilter("deleted_at IS NULL AND session_id IS NOT NULL")
                .HasDatabaseName("ux_ccms_coverage_cases_tenant_session_active");
        });

        mb.Entity<CcmsEligibilityCheck>(e =>
        {
            e.ToTable("ccms_eligibility_checks");
            e.HasKey(x => x.Id);
            MapStandardColumns(e);
            e.Property(x => x.CoverageCase_Id).HasColumnName("coverage_case_id");
            e.Property(x => x.PolicyNumber).HasColumnName("policy_number");
            e.Property(x => x.MembershipId).HasColumnName("membership_id");
            e.Property(x => x.CheckMethod).HasColumnName("check_method");
            e.Property(x => x.ResponseCode).HasColumnName("response_code");
            e.Property(x => x.IsEligible).HasColumnName("is_eligible");
            e.Property(x => x.EligibilityResponseJson).HasColumnName("eligibility_response_json");
            e.Property(x => x.CheckedAt).HasColumnName("checked_at");
        });

        mb.Entity<CcmsPolicyCapture>(e =>
        {
            e.ToTable("ccms_policy_captures");
            e.HasKey(x => x.Id);
            MapStandardColumns(e);
            e.Property(x => x.CoverageCase_Id).HasColumnName("coverage_case_id");
            e.Property(x => x.PolicyNumber).HasColumnName("policy_number");
            e.Property(x => x.MemberName).HasColumnName("member_name");
            e.Property(x => x.MemberDob).HasColumnName("member_dob");
            e.Property(x => x.PolicyStartDate).HasColumnName("policy_start_date");
            e.Property(x => x.PolicyEndDate).HasColumnName("policy_end_date");
            e.Property(x => x.SumInsured).HasColumnName("sum_insured");
            e.Property(x => x.BalanceSumInsured).HasColumnName("balance_sum_insured");
            e.Property(x => x.CumulativeBonusAmount).HasColumnName("cumulative_bonus_amount");
            e.Property(x => x.RoomEntitlement).HasColumnName("room_entitlement");
            e.Property(x => x.PolicyDocsJson).HasColumnName("policy_docs_json");
            e.Property(x => x.CapturedAt).HasColumnName("captured_at");
        });

        mb.Entity<CcmsPolicyCoverageItem>(e =>
        {
            e.ToTable("ccms_policy_coverage_items");
            e.HasKey(x => x.Id);
            MapStandardColumns(e);
            e.Property(x => x.PolicyCaptureId).HasColumnName("policy_capture_id");
            e.Property(x => x.ItemType).HasColumnName("item_type");
            e.Property(x => x.ItemCode).HasColumnName("item_code");
            e.Property(x => x.ItemDescription).HasColumnName("item_description");
            e.Property(x => x.LimitAmount).HasColumnName("limit_amount");
            e.Property(x => x.UsedAmount).HasColumnName("used_amount");
            e.Property(x => x.AvailableAmount).HasColumnName("available_amount");
            e.Property(x => x.IsExcluded).HasColumnName("is_excluded");
        });

        // ── Phase 4: Pre-Authorization ─────────────────────────────────────
        mb.Entity<CcmsCoverageAuthorization>(e =>
        {
            e.ToTable("ccms_coverage_authorizations");
            e.HasKey(x => x.Id);
            MapStandardColumns(e);
            e.Property(x => x.CoverageCase_Id).HasColumnName("coverage_case_id");
            e.Property(x => x.AuthorizationType).HasColumnName("authorization_type");
            e.Property(x => x.PreAuthNumber).HasColumnName("pre_auth_number");
            e.Property(x => x.RequestedAmount).HasColumnName("requested_amount");
            e.Property(x => x.ApprovedAmount).HasColumnName("approved_amount");
            e.Property(x => x.RoomClassRequested).HasColumnName("room_class_requested");
            e.Property(x => x.RoomClassApproved).HasColumnName("room_class_approved");
            e.Property(x => x.DiagnosisJson).HasColumnName("diagnosis_json").HasColumnType("jsonb");
            e.Property(x => x.ProceduresJson).HasColumnName("procedures_json").HasColumnType("jsonb");
            e.Property(x => x.ValidFrom).HasColumnName("valid_from");
            e.Property(x => x.ValidTo).HasColumnName("valid_to");
            e.Property(x => x.SubmittedAt).HasColumnName("submitted_at");
            e.Property(x => x.ReceivedAt).HasColumnName("received_at");
            e.Property(x => x.TpaReferenceNumber).HasColumnName("tpa_reference_number");
            e.Property(x => x.LegacyPreauthId).HasColumnName("legacy_preauth_id");
            e.Property(x => x.SessionPreauthId).HasColumnName("session_preauth_id");
            e.Property(x => x.RejectionReason).HasColumnName("rejection_reason");
            // Migration 124: clinical
            e.Property(x => x.ClinicalSummary).HasColumnName("clinical_summary");
            e.Property(x => x.TreatingDoctorName).HasColumnName("treating_doctor_name");
            e.Property(x => x.TreatingDoctorReg).HasColumnName("treating_doctor_reg");
            e.Property(x => x.AdmissionDate).HasColumnName("admission_date");
            e.Property(x => x.ExpectedDischargeDate).HasColumnName("expected_discharge_date");
            e.Property(x => x.ActualDischargeDate).HasColumnName("actual_discharge_date");
            e.Property(x => x.LengthOfStayDays).HasColumnName("length_of_stay_days");
            e.Property(x => x.RoomTypeRequested).HasColumnName("room_type_requested");
            e.Property(x => x.TpaQueryJson).HasColumnName("tpa_query_json").HasColumnType("jsonb");
            e.Property(x => x.ProcessStatus).HasColumnName("process_status");
            e.Property(x => x.ProcessStatusUpdatedAt).HasColumnName("process_status_updated_at");
            // Migration 124: financial
            e.Property(x => x.EstimatedTotalCost).HasColumnName("estimated_total_cost");
            e.Property(x => x.CopayAmount).HasColumnName("copay_amount");
            e.Property(x => x.DeductibleAmount).HasColumnName("deductible_amount");
            e.Property(x => x.ServiceTaxAmount).HasColumnName("service_tax_amount");
            e.Property(x => x.NetPayableByInsurer).HasColumnName("net_payable_by_insurer");
            e.Property(x => x.NetPayableByPatient).HasColumnName("net_payable_by_patient");
        });

        mb.Entity<CcmsAuthorizationDocument>(e =>
        {
            e.ToTable("ccms_authorization_documents");
            e.HasKey(x => x.Id);
            MapStandardColumns(e);
            e.Property(x => x.AuthorizationId).HasColumnName("authorization_id");
            e.Property(x => x.DocumentType).HasColumnName("document_type");
            e.Property(x => x.DocumentName).HasColumnName("document_name");
            e.Property(x => x.BlobUrl).HasColumnName("blob_url");
            e.Property(x => x.UploadedAt).HasColumnName("uploaded_at");
        });

        // ── Phase 5: Approval Events (append-only) ─────────────────────────
        mb.Entity<CcmsApprovalEvent>(e =>
        {
            e.ToTable("ccms_approval_events");
            e.HasKey(x => x.Id);
            // Append-only: no updated_at
            e.Property(x => x.Id).HasColumnName("id");
            e.Property(x => x.TenantId).HasColumnName("tenant_id");
            e.Property(x => x.CoverageCase_Id).HasColumnName("coverage_case_id");
            e.Property(x => x.AuthorizationId).HasColumnName("authorization_id");
            e.Property(x => x.EventType).HasColumnName("event_type");
            e.Property(x => x.EventSource).HasColumnName("event_source");
            e.Property(x => x.ApprovalStatus).HasColumnName("approval_status");
            e.Property(x => x.ApprovedAmount).HasColumnName("approved_amount");
            e.Property(x => x.PartialApprovalReason).HasColumnName("partial_approval_reason");
            e.Property(x => x.RejectionReason).HasColumnName("rejection_reason");
            e.Property(x => x.ResponsePayloadJson).HasColumnName("response_payload_json");
            e.Property(x => x.TpaReferenceNumber).HasColumnName("tpa_reference_number");
            e.Property(x => x.RecordedByUserId).HasColumnName("recorded_by_user_id");
            e.Property(x => x.RecordedAt).HasColumnName("recorded_at");
            e.Property(x => x.PreviousState).HasColumnName("previous_state");
            e.Property(x => x.CorrelationId).HasColumnName("correlation_id");
            e.HasIndex(x => x.CorrelationId);
            e.Property(x => x.CreatedAt).HasColumnName("created_at");
            e.Property(x => x.CreatedByUserId).HasColumnName("created_by_user_id");
            e.Property(x => x.Status).HasColumnName("status");
        });

        mb.Entity<CcmsClarificationItem>(e =>
        {
            e.ToTable("ccms_clarification_items");
            e.HasKey(x => x.Id);
            MapStandardColumns(e);
            e.Property(x => x.AuthorizationId).HasColumnName("authorization_id");
            e.Property(x => x.ClarificationQuery).HasColumnName("clarification_query");
            e.Property(x => x.ClarificationResponse).HasColumnName("clarification_response");
            e.Property(x => x.RequestedAt).HasColumnName("requested_at");
            e.Property(x => x.RespondedAt).HasColumnName("responded_at");
        });

        // ── Phase 6: Enhancements ──────────────────────────────────────────
        mb.Entity<CcmsEnhancementRequest>(e =>
        {
            e.ToTable("ccms_enhancement_requests");
            e.HasKey(x => x.Id);
            MapStandardColumns(e);
            e.Property(x => x.CoverageCase_Id).HasColumnName("coverage_case_id");
            e.Property(x => x.EnhancementType).HasColumnName("enhancement_type");
            e.Property(x => x.RequestedAmount).HasColumnName("requested_amount");
            e.Property(x => x.ApprovedAmount).HasColumnName("approved_amount");
            e.Property(x => x.Reason).HasColumnName("reason");
            e.Property(x => x.ReasonJson).HasColumnName("reason_json");
            e.Property(x => x.SubmittedAt).HasColumnName("submitted_at");
            e.Property(x => x.DecidedAt).HasColumnName("decided_at");
            e.Property(x => x.DecisionBy).HasColumnName("decision_by");
        });

        mb.Entity<CcmsEnhancementEvent>(e =>
        {
            e.ToTable("ccms_enhancement_events");
            e.HasKey(x => x.Id);
            MapStandardColumns(e);
            e.Property(x => x.EnhancementRequestId).HasColumnName("enhancement_request_id");
            e.Property(x => x.EventType).HasColumnName("event_type");
            e.Property(x => x.EventPayloadJson).HasColumnName("event_payload_json");
            e.Property(x => x.ActorUserId).HasColumnName("actor_user_id");
            e.Property(x => x.EventAt).HasColumnName("event_at");
        });

        // ── Phase 7: Billing Integration ───────────────────────────────────
        mb.Entity<CcmsBillingSummary>(e =>
        {
            e.ToTable("ccms_billing_summaries");
            e.HasKey(x => x.Id);
            MapStandardColumns(e);
            e.Property(x => x.CoverageCase_Id).HasColumnName("coverage_case_id");
            e.Property(x => x.BillId).HasColumnName("bill_id");
            e.Property(x => x.BillDate).HasColumnName("bill_date");
            e.Property(x => x.TotalBillAmount).HasColumnName("total_bill_amount");
            e.Property(x => x.InsuranceShareAmount).HasColumnName("insurance_share_amount");
            e.Property(x => x.PatientShareAmount).HasColumnName("patient_share_amount");
            e.Property(x => x.CopayAmount).HasColumnName("copay_amount");
            e.Property(x => x.DeductibleAmount).HasColumnName("deductible_amount");
            e.Property(x => x.DisallowedAmount).HasColumnName("disallowed_amount");
            e.Property(x => x.BillItemsJson).HasColumnName("bill_items_json");
        });

        mb.Entity<CcmsCoverageAllocation>(e =>
        {
            e.ToTable("ccms_coverage_allocations");
            e.HasKey(x => x.Id);
            MapStandardColumns(e);
            e.Property(x => x.BillingSummaryId).HasColumnName("billing_summary_id");
            e.Property(x => x.LineItemType).HasColumnName("line_item_type");
            e.Property(x => x.LineItemCode).HasColumnName("line_item_code");
            e.Property(x => x.LineItemDescription).HasColumnName("line_item_description");
            e.Property(x => x.BilledAmount).HasColumnName("billed_amount");
            e.Property(x => x.CoveredAmount).HasColumnName("covered_amount");
            e.Property(x => x.DisallowedAmount).HasColumnName("disallowed_amount");
            e.Property(x => x.DisallowedReason).HasColumnName("disallowed_reason");
            e.Property(x => x.PatientPayable).HasColumnName("patient_payable");
        });

        // ── Phase 8: Claims ────────────────────────────────────────────────
        mb.Entity<CcmsClaimPacket>(e =>
        {
            e.ToTable("ccms_claim_packets");
            e.HasKey(x => x.Id);
            MapStandardColumns(e);
            e.Property(x => x.CoverageCase_Id).HasColumnName("coverage_case_id");
            e.Property(x => x.ClaimNumber).HasColumnName("claim_number");
            e.Property(x => x.ClaimedAmount).HasColumnName("claimed_amount");
            e.Property(x => x.ClaimType).HasColumnName("claim_type");
            e.Property(x => x.SubmissionMode).HasColumnName("submission_mode");
            e.Property(x => x.SubmittedAt).HasColumnName("submitted_at");
            e.Property(x => x.AcknowledgedAt).HasColumnName("acknowledged_at");
            e.Property(x => x.TpaClaimNumber).HasColumnName("tpa_claim_number");
            e.Property(x => x.ExpectedSettlementDate).HasColumnName("expected_settlement_date");
            e.Property(x => x.ClaimPacketJson).HasColumnName("claim_packet_json");
            e.Property(x => x.QueryStatus).HasColumnName("query_status");
        });

        mb.Entity<CcmsClaimDocument>(e =>
        {
            e.ToTable("ccms_claim_documents");
            e.HasKey(x => x.Id);
            MapStandardColumns(e);
            e.Property(x => x.ClaimPacketId).HasColumnName("claim_packet_id");
            e.Property(x => x.DocumentType).HasColumnName("document_type");
            e.Property(x => x.DocumentName).HasColumnName("document_name");
            e.Property(x => x.BlobUrl).HasColumnName("blob_url");
            e.Property(x => x.UploadedAt).HasColumnName("uploaded_at");
        });

        // ── Phase 9: Settlements ───────────────────────────────────────────
        mb.Entity<CcmsSettlement>(e =>
        {
            e.ToTable("ccms_settlements");
            e.HasKey(x => x.Id);
            MapStandardColumns(e);
            e.Property(x => x.CoverageCase_Id).HasColumnName("coverage_case_id");
            e.Property(x => x.ClaimPacketId).HasColumnName("claim_packet_id");
            e.Property(x => x.SettlementNumber).HasColumnName("settlement_number");
            e.Property(x => x.SettlementType).HasColumnName("settlement_type");
            e.Property(x => x.SettledAmount).HasColumnName("settled_amount");
            e.Property(x => x.ClaimAmount).HasColumnName("claim_amount");
            e.Property(x => x.OutstandingAmount).HasColumnName("outstanding_amount");
            e.Property(x => x.PaymentMode).HasColumnName("payment_mode");
            e.Property(x => x.PaymentReference).HasColumnName("payment_reference");
            e.Property(x => x.PaymentDate).HasColumnName("payment_date");
            e.Property(x => x.BankReference).HasColumnName("bank_reference");
            e.Property(x => x.SettledAt).HasColumnName("settled_at");
            e.Property(x => x.ReconciliationStatus).HasColumnName("reconciliation_status");
            e.Property(x => x.ReconciliationNotes).HasColumnName("reconciliation_notes");
            e.Property(x => x.ReconciliationAt).HasColumnName("reconciliation_at");
        });

        mb.Entity<CcmsSettlementLineItem>(e =>
        {
            e.ToTable("ccms_settlement_line_items");
            e.HasKey(x => x.Id);
            MapStandardColumns(e);
            e.Property(x => x.SettlementId).HasColumnName("settlement_id");
            e.Property(x => x.LineItemType).HasColumnName("line_item_type");
            e.Property(x => x.Description).HasColumnName("description");
            e.Property(x => x.ClaimedAmount).HasColumnName("claimed_amount");
            e.Property(x => x.SettledAmount).HasColumnName("settled_amount");
            e.Property(x => x.DisallowedAmount).HasColumnName("disallowed_amount");
            e.Property(x => x.DisallowedReason).HasColumnName("disallowed_reason");
        });

        mb.Entity<CcmsCollectionProjection>(e =>
        {
            e.ToTable("ccms_collection_projections");
            e.HasKey(x => x.Id);
            MapStandardColumns(e);
            e.Property(x => x.CoverageCaseId).HasColumnName("coverage_case_id");
            e.Property(x => x.BillId).HasColumnName("bill_id");
            e.Property(x => x.NetCollected).HasColumnName("net_collected");
            e.Property(x => x.PatientObligationAmount).HasColumnName("patient_obligation_amount");
            e.Property(x => x.LastOccurredAt).HasColumnName("last_occurred_at");
        });

        mb.Entity<CcmsCollectionEvent>(e =>
        {
            e.ToTable("ccms_collection_events");
            e.HasKey(x => x.Id);
            MapStandardColumns(e);
            e.Property(x => x.CoverageCaseId).HasColumnName("coverage_case_id");
            e.Property(x => x.EventType).HasColumnName("event_type");
            e.Property(x => x.SourceRefId).HasColumnName("source_ref_id");
            e.Property(x => x.BillId).HasColumnName("bill_id");
            e.Property(x => x.Amount).HasColumnName("amount");
            e.Property(x => x.IdempotencyKey).HasColumnName("idempotency_key");
            e.Property(x => x.OccurredAt).HasColumnName("occurred_at");
        });

        // ── Phase 10: Documents ────────────────────────────────────────────
        mb.Entity<CcmsDocument>(e =>
        {
            e.ToTable("ccms_documents");
            e.HasKey(x => x.Id);
            MapStandardColumns(e);
            e.Property(x => x.CoverageCase_Id).HasColumnName("coverage_case_id");
            e.Property(x => x.DocumentCategory).HasColumnName("document_category").HasMaxLength(30).IsRequired();
            e.Property(x => x.DocumentType).HasColumnName("document_type");
            e.Property(x => x.DocumentName).HasColumnName("document_name").HasMaxLength(200).IsRequired();
            e.Property(x => x.BlobUrl).HasColumnName("blob_url");
            e.Property(x => x.FileSizeBytes).HasColumnName("file_size_bytes");
            e.Property(x => x.MimeType).HasColumnName("mime_type");
            e.Property(x => x.UploadedAt).HasColumnName("uploaded_at");
            e.Property(x => x.UploadedByUserId).HasColumnName("uploaded_by_user_id");
            e.Property(x => x.VerifiedAt).HasColumnName("verified_at");
            e.Property(x => x.VerifiedByUserId).HasColumnName("verified_by_user_id");
        });

        // ── Phase 11: Communications ───────────────────────────────────────
        mb.Entity<CcmsCommunicationLog>(e =>
        {
            e.ToTable("ccms_communication_logs");
            e.HasKey(x => x.Id);
            MapStandardColumns(e);
            e.Property(x => x.CoverageCase_Id).HasColumnName("coverage_case_id");
            e.Property(x => x.CommunicationType).HasColumnName("communication_type");
            e.Property(x => x.Direction).HasColumnName("direction");
            e.Property(x => x.RecipientType).HasColumnName("recipient_type");
            e.Property(x => x.RecipientAddress).HasColumnName("recipient_address");
            e.Property(x => x.Subject).HasColumnName("subject");
            e.Property(x => x.BodySummary).HasColumnName("body_summary");
            e.Property(x => x.SentAt).HasColumnName("sent_at");
            e.Property(x => x.DeliveryStatus).HasColumnName("delivery_status");
            e.Property(x => x.ExternalMessageId).HasColumnName("external_message_id");
            e.Property(x => x.MetadataJson).HasColumnName("metadata_json").HasColumnType("jsonb");
        });

        mb.Entity<CcmsCommunicationTemplate>(e =>
        {
            e.ToTable("ccms_communication_templates");
            e.HasKey(x => x.Id);
            MapStandardColumns(e);
            e.Property(x => x.TemplateName).HasColumnName("template_name");
            e.Property(x => x.TemplateCode).HasColumnName("template_code");
            e.Property(x => x.CommunicationType).HasColumnName("communication_type");
            e.Property(x => x.TriggerEvent).HasColumnName("trigger_event");
            e.Property(x => x.SubjectTemplate).HasColumnName("subject_template");
            e.Property(x => x.BodyTemplate).HasColumnName("body_template");
            e.Property(x => x.IsActive).HasColumnName("is_active");
        });

        // ── Phase 13: Govt Scheme Applications ────────────────────────────
        mb.Entity<CcmsGovtSchemeApplication>(e =>
        {
            e.ToTable("ccms_govt_scheme_applications");
            e.HasKey(x => x.Id);
            MapStandardColumns(e);
            e.Property(x => x.CoverageCase_Id).HasColumnName("coverage_case_id");
            e.Property(x => x.GovernmentSchemeId).HasColumnName("government_scheme_id");
            e.Property(x => x.SchemeCardNumber).HasColumnName("scheme_card_number");
            e.Property(x => x.BeneficiaryId).HasColumnName("beneficiary_id");
            e.Property(x => x.ClaimedAmount).HasColumnName("claimed_amount");
            e.Property(x => x.ApprovedAmount).HasColumnName("approved_amount");
            e.Property(x => x.ApplicationState).HasColumnName("application_state");
            e.Property(x => x.SchemeReferenceNumber).HasColumnName("scheme_reference_number");
            e.Property(x => x.SubmittedAt).HasColumnName("submitted_at");
            e.Property(x => x.DecidedAt).HasColumnName("decided_at");
        });

        mb.Entity<CcmsGovtSchemeDocument>(e =>
        {
            e.ToTable("ccms_govt_scheme_documents");
            e.HasKey(x => x.Id);
            MapStandardColumns(e);
            e.Property(x => x.GovtSchemeApplicationId).HasColumnName("govt_scheme_application_id");
            e.Property(x => x.DocumentType).HasColumnName("document_type");
            e.Property(x => x.DocumentName).HasColumnName("document_name");
            e.Property(x => x.BlobUrl).HasColumnName("blob_url");
            e.Property(x => x.UploadedAt).HasColumnName("uploaded_at");
        });

        // ── Policy extraction audit ─────────────────────────────────────────
        mb.Entity<CcmsPolicyExtractionAuditLog>(e =>
        {
            e.ToTable("ccms_policy_extraction_audit_logs");
            e.HasKey(x => x.Id);
            e.Property(x => x.Id).HasColumnName("id");
            e.Property(x => x.TenantId).HasColumnName("tenant_id");
            e.Property(x => x.UserId).HasColumnName("user_id");
            e.Property(x => x.CoverageCase_Id).HasColumnName("coverage_case_id");
            e.Property(x => x.SessionId).HasColumnName("session_id");
            e.Property(x => x.IdempotencyKey).HasColumnName("idempotency_key");
            e.Property(x => x.Outcome).HasColumnName("outcome");
            e.Property(x => x.OriginalFilename).HasColumnName("original_filename");
            e.Property(x => x.FrontDocumentUrl).HasColumnName("front_document_url");
            e.Property(x => x.BackDocumentUrl).HasColumnName("back_document_url");
            e.Property(x => x.BlobPurgeAt).HasColumnName("blob_purge_at");
            e.Property(x => x.BlobPurged).HasColumnName("blob_purged");
            e.Property(x => x.ProviderModel).HasColumnName("provider_model");
            e.Property(x => x.ProcessingMs).HasColumnName("processing_ms");
            e.Property(x => x.HighFieldCount).HasColumnName("high_field_count");
            e.Property(x => x.ReviewFieldCount).HasColumnName("review_field_count");
            e.Property(x => x.LowFieldCount).HasColumnName("low_field_count");
            e.Property(x => x.FieldOverrideCount).HasColumnName("field_override_count");
            e.Property(x => x.OverriddenFieldsJson).HasColumnName("overridden_fields_json");
            e.Property(x => x.CreatedPolicyId).HasColumnName("created_policy_id");
            e.Property(x => x.CreatedAt).HasColumnName("created_at");
        });

        // ── Migration 122: Visit Insurance Policies ────────────────────────
        mb.Entity<CcmsVisitInsurancePolicy>(e =>
        {
            e.ToTable("ccms_visit_insurance_policies");
            e.HasKey(x => x.Id);
            MapStandardColumns(e);
            e.Property(x => x.SessionId).HasColumnName("session_id");
            e.Property(x => x.CoverageCase_Id).HasColumnName("coverage_case_id");
            e.Property(x => x.PolicyNumber).HasColumnName("policy_number");
            e.Property(x => x.CardNumber).HasColumnName("card_number");
            e.Property(x => x.MembershipNumber).HasColumnName("membership_number");
            e.Property(x => x.InsuranceProviderId).HasColumnName("insurance_provider_id");
            e.Property(x => x.TpaProviderId).HasColumnName("tpa_provider_id");
            e.Property(x => x.InsuredName).HasColumnName("insured_name");
            e.Property(x => x.RelationshipToInsured).HasColumnName("relationship_to_insured");
            e.Property(x => x.Occupation).HasColumnName("occupation");
            e.Property(x => x.Designation).HasColumnName("designation");
            e.Property(x => x.CompanyName).HasColumnName("company_name");
            e.Property(x => x.EmployeeId).HasColumnName("employee_id");
            e.Property(x => x.VideNumber).HasColumnName("vide_number");
            e.Property(x => x.ContactNumber).HasColumnName("contact_number");
            e.Property(x => x.DoctorName).HasColumnName("doctor_name");
            e.Property(x => x.DoctorRegNumber).HasColumnName("doctor_reg_number");
            e.Property(x => x.DoctorQualification).HasColumnName("doctor_qualification");
            e.Property(x => x.DoctorContact).HasColumnName("doctor_contact");
            e.Property(x => x.AccommodationClass).HasColumnName("accommodation_class");
            e.Property(x => x.DetailsText).HasColumnName("details_text");
            e.Property(x => x.TpaCoordinatorName).HasColumnName("tpa_coordinator_name");
            e.Property(x => x.IsPrimary).HasColumnName("is_primary");
            e.Property(x => x.SortOrder).HasColumnName("sort_order");
            e.Property(x => x.UnderwritingSnapshotJson).HasColumnName("underwriting_snapshot_json");
            e.Property(x => x.ServiceTaxApplicable).HasColumnName("service_tax_applicable");
        });

        // Keyless projections (no table; used only with FromSqlRaw)
        mb.Entity<BillingTransactionRow>().HasNoKey();
    }

    /// Helper to map the standard columns shared by most entities.
    private static void MapStandardColumns<T>(Microsoft.EntityFrameworkCore.Metadata.Builders.EntityTypeBuilder<T> e)
        where T : class, IStandardEntity
    {
        e.Property(x => x.Id).HasColumnName("id");
        e.Property(x => x.TenantId).HasColumnName("tenant_id");
        e.Property(x => x.CreatedAt).HasColumnName("created_at");
        e.Property(x => x.UpdatedAt).HasColumnName("updated_at");
        e.Property(x => x.CreatedByUserId).HasColumnName("created_by_user_id");
        e.Property(x => x.UpdatedByUserId).HasColumnName("updated_by_user_id");
        e.Property(x => x.DeletedAt).HasColumnName("deleted_at");
        e.Property(x => x.Status).HasColumnName("status");
        e.Property(x => x.RowVersion).HasColumnName("row_version");
    }
}

/// Marker interface for entities with all standard columns.
public interface IStandardEntity
{
    Guid Id { get; set; }
    Guid TenantId { get; set; }
    DateTime CreatedAt { get; set; }
    DateTime UpdatedAt { get; set; }
    Guid? CreatedByUserId { get; set; }
    Guid? UpdatedByUserId { get; set; }
    DateTime? DeletedAt { get; set; }
    string Status { get; set; }
    int RowVersion { get; set; }
}
