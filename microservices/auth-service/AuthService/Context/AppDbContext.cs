using AuthService.Models.Identity;
using AuthService.Models.Domain;
using AuthService.Models;
using AuthService.Models.MasterData;
using AuthService.Models.Onboarding;
using AuthService.Models.Search;
using AuthService.Models.PerformanceReview;
using AuthService.Models.Training;
using AuthService.Models.Counselor;
using AuthService.Services;
using Microsoft.AspNetCore.Identity.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore;
using System;

namespace AuthService.Context
{
    public class AppDbContext : IdentityDbContext<
        AppUser, 
        AppRole, 
        Guid, 
        AppUserClaim, 
        AppUserRole, 
        AppUserLogin, 
        AppRoleClaim, 
        AppUserToken>
    {
        private readonly IHttpContextAccessor _httpContextAccessor;

        public AppDbContext(
            DbContextOptions<AppDbContext> options,
            IHttpContextAccessor httpContextAccessor) : base(options)
        {
            _httpContextAccessor = httpContextAccessor;
        }

        /// <summary>
        /// Sets the tenant context for Row-Level Security (RLS) in PostgreSQL
        /// This ensures the database filters queries based on tenant_id
        /// </summary>
        private async Task SetTenantContextAsync()
        {
            var tenantId = GetCurrentTenantId();
            
            // Set PostgreSQL session variable for RLS policies
            if (Database.IsRelational() && !string.IsNullOrEmpty(Database.GetConnectionString()))
            {
                await Database.ExecuteSqlRawAsync(
                    $"SELECT set_config('app.current_tenant_id', '{tenantId}', false)");
            }
        }

        public DbSet<Tenant> Tenants { get; set; }
        public DbSet<Organization> Organizations { get; set; }
        public DbSet<Branch> Branches { get; set; }
        public DbSet<Department> Departments { get; set; }
        public DbSet<UserDepartment> UserDepartments { get; set; }
        public DbSet<UserBranch> UserBranches { get; set; }
        public DbSet<PasswordResetRequest> PasswordResetRequests { get; set; }
        public DbSet<UserActivationLog> UserActivationLogs { get; set; }
        public DbSet<Permission> Permissions { get; set; }
        public DbSet<RolePermission> RolePermissions { get; set; }
        public DbSet<RoleTemplate> RoleTemplates { get; set; }
        public DbSet<RoleHierarchy> RoleHierarchies { get; set; }
        public DbSet<UserRoleHistory> UserRoleHistories { get; set; }
        public DbSet<AuditLog> AuditLogs { get; set; }
        public DbSet<SystemAlert> SystemAlerts { get; set; }
        public DbSet<FailedLoginAttempt> FailedLoginAttempts { get; set; }
        public DbSet<ActivationAuditLog> ActivationAuditLogs { get; set; }
        public DbSet<UserAttribute> UserAttributes { get; set; }
        public DbSet<Patient> Patients { get; set; }
        // L-PORTAL-01 S1 — Portal identity persistence foundation
        public DbSet<PortalInvitation> PortalInvitations { get; set; }
        public DbSet<PortalPatientLink> PortalPatientLinks { get; set; }
        public DbSet<PortalRemediationRequest> PortalRemediationRequests { get; set; }
        public DbSet<PatientFavorite> PatientFavorites { get; set; }
        public DbSet<PatientRecentView> PatientRecentViews { get; set; }
        public DbSet<UserChartLayout> UserChartLayouts { get; set; }
        public DbSet<PatientVitalSigns> PatientVitalSigns { get; set; }
        public DbSet<ClinicalExamination> ClinicalExaminations { get; set; }
        public DbSet<ExaminationDraft> ExaminationDrafts { get; set; }
        public DbSet<DiagnosisCode> DiagnosisCodes { get; set; }
        public DbSet<PatientDiagnosis> PatientDiagnoses { get; set; }
        public DbSet<OphthalMedication> OphthalMedications { get; set; }
        public DbSet<Appointment> Appointments { get; set; }
        public DbSet<DoctorAvailability> DoctorAvailabilities { get; set; }
        public DbSet<AppointmentConflict> AppointmentConflicts { get; set; }
        public DbSet<AppointmentReminder> AppointmentReminders { get; set; }
        public DbSet<AppointmentStatistics> AppointmentStatisticsRecords { get; set; }
        public DbSet<PatientDocumentUpload> PatientDocumentUploads { get; set; }
        public DbSet<CanonicalDocument> CanonicalDocuments { get; set; }
        public DbSet<CanonicalDocumentAssociation> CanonicalDocumentAssociations { get; set; }
        public DbSet<DocumentAccessAudit> DocumentAccessAudits { get; set; }
        public DbSet<AdminConfiguration> AdminConfigurations { get; set; }
        public DbSet<SystemSetting> SystemSettings { get; set; }
        
        // Module 4: Front Office/OPD Management - Emergency Override Logging
        public DbSet<EmergencyOverrideLog> EmergencyOverrideLogs { get; set; }
        
        // Onboarding & Progressive Access (Phase 2)
        public DbSet<OnboardingWorkflow> OnboardingWorkflows { get; set; }
        public DbSet<OnboardingChecklistItem> OnboardingChecklistItems { get; set; }
        public DbSet<AccessLevelConfiguration> AccessLevelConfigurations { get; set; }
        
        // Advanced Search (Phase 2)
        public DbSet<SavedSearch> SavedSearches { get; set; }
        
        // Performance Reviews (Phase 2)
        public DbSet<PerformanceReview> PerformanceReviews { get; set; }
        
        // Training & Compliance (Phase 2)
        public DbSet<TrainingCourse> TrainingCourses { get; set; }
        public DbSet<TrainingAssignment> TrainingAssignments { get; set; }
        public DbSet<UserCredential> UserCredentials { get; set; }
        
        // Device & Session Management (Tasks 7-12 Backend Implementation)
        public DbSet<Device> Devices { get; set; }
        public DbSet<UserSession> UserSessions { get; set; }
        public DbSet<AccessPolicy> AccessPolicies { get; set; }
        public DbSet<EmergencyAccess> EmergencyAccesses { get; set; }
        // TODO: Add EmergencyAccessAuditLogs when service is fixed
        // public DbSet<EmergencyAccessAuditLog> EmergencyAccessAuditLogs { get; set; }
        
        // Department Access Approval & Audit (Phase 1 Critical Features - Dec 9, 2025)
        public DbSet<DepartmentAccessRequest> DepartmentAccessRequests { get; set; }
        public DbSet<DepartmentAccessAuditLog> DepartmentAccessAuditLogs { get; set; }
        
        // Advanced Access Management - Admin Configuration (Dec 9, 2025)
        public DbSet<AuthService.Models.Department.DepartmentAccessRule> DepartmentAccessRules { get; set; }
        public DbSet<AuthService.Models.Department.SupervisedUser> SupervisedUsers { get; set; }
        public DbSet<AuthService.Models.Department.SupervisorAssignment> SupervisorAssignments { get; set; }
        
        // Employment Management (Phase 1 - HR Features)
        public DbSet<Employee> Employees { get; set; }
        public DbSet<EmploymentTypeLookup> EmploymentTypes { get; set; }
        public DbSet<EmploymentCategoryLookup> EmploymentCategories { get; set; }
        public DbSet<EmploymentContract> EmploymentContracts { get; set; }
        public DbSet<ProfessionalLicense> ProfessionalLicenses { get; set; }
        public DbSet<ProbationTracking> ProbationTrackings { get; set; }
        
        // Bulk Operations (Phase 1 - Admin Features)
        public DbSet<AuthService.Models.BulkOperations.BulkOperationJob> BulkOperationJobs { get; set; }
        
        // Phase 2: Branch Capacity Tracking (Migration 08)
        public DbSet<AuthService.Models.Branch.BedInventory> BedInventories { get; set; }
        public DbSet<AuthService.Models.Branch.WardRef> WardRefs { get; set; }
        public DbSet<AuthService.Models.Branch.BranchCapacityHistory> BranchCapacityHistories { get; set; }
        public DbSet<AuthService.Models.Branch.PatientTransferRequest> PatientTransferRequests { get; set; }
        
        // Phase 2: Diagnostic & Imaging Services
        public DbSet<BiometryRecord> BiometryRecords { get; set; }
        public DbSet<IOLInventoryItem> IOLInventoryItems { get; set; }
        public DbSet<IOLStockAdjustment> IOLStockAdjustments { get; set; }
        public DbSet<RetinopathyScreening> RetinopathyScreenings { get; set; }
        public DbSet<OctImagingScan> OctImagingScans { get; set; }
        public DbSet<ImagingOrder> ImagingOrders { get; set; }
        public DbSet<ImagingImage> ImagingImages { get; set; }
        public DbSet<ImagingAnnotation> ImagingAnnotations { get; set; }
        public DbSet<ImagingComparison> ImagingComparisons { get; set; }
        public DbSet<AIProgressionAnalysis> AIProgressionAnalyses { get; set; } // Phase 8: AI Analysis
        public DbSet<ElectrophysiologyTest> ElectrophysiologyTests { get; set; }
        
        // Phase 2: Follow-up Management System
        public DbSet<FollowUpAppointment> FollowUpAppointments { get; set; }
        public DbSet<PostOpCareSchedule> PostOpCareSchedules { get; set; }
        public DbSet<PostOpVisit> PostOpVisits { get; set; }
        public DbSet<PostOpMedication> PostOpMedications { get; set; }
        public DbSet<TreatmentAdherence> TreatmentAdherences { get; set; }
        public DbSet<MedicationAdherence> MedicationAdherences { get; set; }
        public DbSet<PatientReminder> PatientReminders { get; set; }
        
        // Phase 3: Prescription Management System
        public DbSet<AuthService.Models.Prescription.Prescription> Prescriptions { get; set; }
        public DbSet<AuthService.Models.Prescription.PrescriptionMedication> PrescriptionMedications { get; set; }
        public DbSet<AuthService.Models.Prescription.DrugInteraction> DrugInteractions { get; set; }
        public DbSet<AuthService.Models.Prescription.MedicationMaster> MedicationMaster { get; set; }

        // OPD Visit & Billing System (Phase 1 OPD Workflow)
        public DbSet<Visit> Visits { get; set; }
        public DbSet<VisitStationEvent> VisitStationEvents { get; set; }
        public DbSet<OptometrySegmentExam> OptometrySegmentExams { get; set; }
        public DbSet<OptometryVisitExam> OptometryVisitExams { get; set; }
        public DbSet<OpdBill> OpdBills { get; set; }
        public DbSet<BillingCcmsOutboxEvent> BillingCcmsOutboxEvents { get; set; }
        public DbSet<OpdBillPayment> OpdBillPayments { get; set; }
        public DbSet<BillingRule> BillingRules { get; set; }
        public DbSet<TokenSequence> TokenSequences { get; set; }
        public DbSet<Refund> Refunds { get; set; }
        
        // Day 4: Itemized Billing (Feb 6, 2026)
        public DbSet<OpdBillItem> OpdBillItems { get; set; }
        public DbSet<ServiceVariantItemMap> ServiceVariantItemMaps { get; set; }
        public DbSet<ChargeException> ChargeExceptions { get; set; }
        public DbSet<PackageComponentMap> PackageComponentMaps { get; set; }
        public DbSet<InvItemMasterRead> InvItemMasterReads { get; set; }
        public DbSet<InvSurgeryConsumableRead> InvSurgeryConsumableReads { get; set; }
        public DbSet<JourneyImplantUsageRead> JourneyImplantUsageReads { get; set; }
        public DbSet<InvStockLedgerRead> InvStockLedgerReads { get; set; }
        public DbSet<InvStockBatchRead> InvStockBatchReads { get; set; }
        
        // Module 4: Front Office/OPD Management (Feb 3, 2026)
        public DbSet<QueueItem> QueueItems { get; set; }
        public DbSet<VisitorLog> VisitorLogs { get; set; }
        public DbSet<SurgeryRequest> SurgeryRequests { get; set; }

        // Module 30: Patient Directory Hub (Feb 9, 2026)
        public DbSet<PatientAllergy> PatientAllergies { get; set; }
        public DbSet<PatientConsent> PatientConsents { get; set; }
        public DbSet<PatientCommunication> PatientCommunications { get; set; }
        public DbSet<LabReport> LabReports { get; set; }
        public DbSet<LabReportItem> LabReportItems { get; set; }
        public DbSet<LaboratoryTestDefinition> LaboratoryTestDefinitions { get; set; }
        public DbSet<LaboratoryTestSpecimenOption> LaboratoryTestSpecimenOptions { get; set; }
        public DbSet<LaboratoryPanel> LaboratoryPanels { get; set; }
        public DbSet<LaboratoryPanelItem> LaboratoryPanelItems { get; set; }
        public DbSet<LaboratoryAnalyte> LaboratoryAnalytes { get; set; }
        public DbSet<PatientInsurance> PatientInsurances { get; set; }
        public DbSet<PatientNote> PatientNotes { get; set; }
        public DbSet<OpticalOrder> OpticalOrders { get; set; }

        // Module 3: Counseling & Surgery Package Management (Feb 15, 2026)
        public DbSet<SurgeryPackageTemplate> SurgeryPackageTemplates { get; set; }
        public DbSet<SurgeryPackageItemCatalog> SurgeryPackageItemCatalogs { get; set; }
        public DbSet<CounselorPackage> CounselorPackages { get; set; }
        public DbSet<CounselorPackageItem> CounselorPackageItems { get; set; }
        public DbSet<PackageDiscountApproval> PackageDiscountApprovals { get; set; }
        public DbSet<CounsellingPackageTemplate> CounsellingPackageTemplates { get; set; }

        // Module 3.2: Counseling Workflow (Feb 23, 2026)
        public DbSet<CounselingSession> CounselingSession { get; set; }
        public DbSet<CounselorQueueItem> CounselorQueue { get; set; }
        public DbSet<CounselingSessionNote> CounselingSessionNotes { get; set; }
        public DbSet<CounselingSessionDocument> CounselingSessionDocuments { get; set; }
        public DbSet<CounselingSessionAuditLog> CounselingSessionAuditLog { get; set; }
        // Phase B: Communication Log + Callbacks + Templates (Migrations 69-71)
        public DbSet<CounselorCommunicationLog> CounselorCommunicationLogs { get; set; }
        public DbSet<CounselorCallbackRequest> CounselorCallbackRequests { get; set; }
        public DbSet<CommunicationMessageTemplate> CommunicationMessageTemplates { get; set; }
        public DbSet<DeptCoordinationRequest> DeptCoordinationRequests { get; set; }
        // Phase A: Pre-Admission Checklist + Insurance Pre-Auth (Migration 66-67)
        public DbSet<PreAdmissionChecklistTemplate> PreAdmissionChecklistTemplates { get; set; }
        public DbSet<PreAdmissionChecklistItem> PreAdmissionChecklistItems { get; set; }
        public DbSet<OtAdmissionChecklistCompletion> OtAdmissionChecklistCompletions { get; set; }
        public DbSet<InsurancePreauthRequest> InsurancePreauthRequests { get; set; }
        public DbSet<PatientUploadLink> PatientUploadLinks { get; set; }
        public DbSet<FilterPreset> FilterPresets { get; set; } // Phase 4.2: Advanced Filters
        public DbSet<LabTestCatalog> LabTestCatalog { get; set; } // Lab test catalog with pricing
        public DbSet<PatientMedicalHistory> PatientMedicalHistory { get; set; } // Shared medical history (multi-source)
        public DbSet<CounselorLabOrderItem> CounselorLabOrderItems { get; set; } // Individual lab orders from counselor
        
        // Module 3.12: Audio Transcription & Translation (Feb 24, 2026)
        public DbSet<CounselingConversation> CounselingConversations { get; set; }
        public DbSet<SessionRecording> SessionRecordings { get; set; }
        public DbSet<SessionTranscript> SessionTranscripts { get; set; }
        public DbSet<TranscriptEdit> TranscriptEdits { get; set; }

        // Module 3.3: Patient Type Workflows (Feb 23, 2026)
        public DbSet<PatientTypeConfiguration> PatientTypeConfigurations { get; set; }
        public DbSet<PatientTypeDocumentChecklist> PatientTypeDocumentChecklist { get; set; }

        // Module 3.4: Pre-Op Test Management (Feb 23, 2026)
        public DbSet<PreOpTestProtocol> PreOpTestProtocols { get; set; }
        public DbSet<PreOpTestOrder> PreOpTestOrders { get; set; }
        public DbSet<PreOpTestResult> PreOpTestResults { get; set; }
        public DbSet<PreOpFitnessClearance> PreOpFitnessClearances { get; set; }

        // Module 3.5: OT Booking System (Feb 23, 2026)
        public DbSet<OTTheater> OTTheaters { get; set; }
        public DbSet<OTSchedule> OTSchedules { get; set; }
        public DbSet<OTBookingValidation> OTBookingValidations { get; set; }
        public DbSet<OTEquipmentAvailability> OTEquipmentAvailability { get; set; }
        public DbSet<OTCollisionLog> OTCollisionLogs { get; set; }

        // Module 3.5a: OT Finalize Schedule (Mar 26, 2026) — state machine for counsellor → OT finalization
        public DbSet<OtFinalizeSchedule> OtFinalizeSchedules { get; set; }
        public DbSet<OtFinalizeAuditLog> OtFinalizeAuditLogs { get; set; }

        // Follow-up Center: Read-only projections of ip-management-service tables (no migration — tables exist via mig81/85)
        public DbSet<PatientJourneyReadOnly> PatientJourneys { get; set; }
        public DbSet<VitalSignReadOnly> VitalSigns { get; set; }
        public DbSet<DischargeSummaryReadOnly> DischargeSummaries { get; set; }
        public DbSet<CcmsCoverageCaseReadOnly> CcmsCoverageCases { get; set; }

        // Module 3.6: Insurance Pre-Auth Workflow (Feb 23, 2026)
        public DbSet<InsurancePreAuthorization> InsurancePreAuthorizations { get; set; }
        public DbSet<InsuranceApprovalWorkflow> InsuranceApprovalWorkflows { get; set; }
        public DbSet<InsuranceDocument> InsuranceDocuments { get; set; }
        public DbSet<TPACommunicationLog> TPACommunicationLogs { get; set; }

        // Module 3.7: Payment Processing (Feb 23, 2026)
        public DbSet<PaymentTransaction> PaymentTransactions { get; set; }
        public DbSet<PaymentLink> PaymentLinks { get; set; }
        public DbSet<GovernmentSchemeClaim> GovernmentSchemeClaims { get; set; }

        // Module 3.8: Admission Management (Feb 23, 2026)
        public DbSet<PatientAdmission> PatientAdmissions { get; set; }
        public DbSet<BedReservation> BedReservations { get; set; }

        // Module 3.9: Consent Management (Feb 23, 2026)
        public DbSet<ConsentFormTemplate> ConsentFormTemplates { get; set; }
        public DbSet<CounselingConsent> CounselingConsents { get; set; }

        // Module 3.10: Workflow Orchestration (Feb 23, 2026)
        public DbSet<CounselingWorkflowState> CounselingWorkflowStates { get; set; }
        public DbSet<WorkflowStageTransition> WorkflowStageTransitions { get; set; }

        // Module 3.11: Master Data for Counseling (Feb 23, 2026)
        public DbSet<InsuranceProvider> InsuranceProviders { get; set; }
        public DbSet<TpaProvider> TpaProviders { get; set; }
        public DbSet<AnesthesiaType> AnesthesiaTypes { get; set; }
        public DbSet<GovernmentScheme> GovernmentSchemes { get; set; }
        
        // Service Catalog V2 (Global — no tenant_id)
        public DbSet<ServiceCategory> ServiceCategories { get; set; }
        public DbSet<CatalogService> CatalogServices { get; set; }
        public DbSet<ServiceVariant> ServiceVariants { get; set; }
        public DbSet<IolMaster> IolMasters { get; set; }
        public DbSet<VariantIolMapping> VariantIolMappings { get; set; }
        public DbSet<VariantPrice> VariantPrices { get; set; }
        public DbSet<IolPrice> IolPrices { get; set; }
        public DbSet<BranchPricingOverride> BranchPricingOverrides { get; set; }
        public DbSet<ConsultationCharge> ConsultationCharges { get; set; }

        // Master Data Module (April 2026)
        public DbSet<MasterValue> MasterValues { get; set; }
        public DbSet<EntityTypeRegistry> EntityTypeRegistries { get; set; }

        protected override void OnModelCreating(ModelBuilder builder)
        {
            base.OnModelCreating(builder);

            builder.Entity<BillingCcmsOutboxEvent>(e =>
            {
                e.ToTable("billing_ccms_outbox");
                e.HasKey(x => x.Id);
                e.Property(x => x.Id).HasColumnName("id");
                e.Property(x => x.TenantId).HasColumnName("tenant_id");
                e.Property(x => x.EventType).HasColumnName("event_type").HasMaxLength(80).IsRequired();
                e.Property(x => x.AggregateType).HasColumnName("aggregate_type").HasMaxLength(80);
                e.Property(x => x.AggregateId).HasColumnName("aggregate_id");
                e.Property(x => x.CorrelationId).HasColumnName("correlation_id");
                e.Property(x => x.PayloadJson).HasColumnName("payload_json");
                e.Property(x => x.IdempotencyKey).HasColumnName("idempotency_key").HasMaxLength(200).IsRequired();
                e.Property(x => x.OccurredAt).HasColumnName("occurred_at");
                e.Property(x => x.Status).HasColumnName("status").HasMaxLength(20).IsRequired();
                e.Property(x => x.RetryCount).HasColumnName("retry_count");
                e.Property(x => x.LastAttemptAt).HasColumnName("last_attempt_at");
                e.Property(x => x.ProcessedAt).HasColumnName("processed_at");
                e.Property(x => x.Error).HasColumnName("error");
                e.Property(x => x.AbandonReason).HasColumnName("abandon_reason");
                e.Property(x => x.CompensatingAction).HasColumnName("compensating_action");
                e.Property(x => x.AbandonedAt).HasColumnName("abandoned_at");
                e.Property(x => x.AbandonedByUserId).HasColumnName("abandoned_by_user_id");
                e.Property(x => x.CreatedAt).HasColumnName("created_at");
                e.Property(x => x.UpdatedAt).HasColumnName("updated_at");
                e.HasIndex(x => x.IdempotencyKey).IsUnique().HasDatabaseName("ux_billing_ccms_outbox_idempotency");
            });

            // ✅ FIX: PostgreSQL DateTime UTC Compatibility
            // Configure all DateTime properties to use UTC kind
            // This prevents "Cannot write DateTime with Kind=Unspecified to PostgreSQL type 'timestamp with time zone'"
            var dateTimeConverter = new Microsoft.EntityFrameworkCore.Storage.ValueConversion.ValueConverter<DateTime, DateTime>(
                v => DateTime.SpecifyKind(v, DateTimeKind.Utc),
                v => DateTime.SpecifyKind(v, DateTimeKind.Utc));

            var nullableDateTimeConverter = new Microsoft.EntityFrameworkCore.Storage.ValueConversion.ValueConverter<DateTime?, DateTime?>(
                v => v.HasValue ? DateTime.SpecifyKind(v.Value, DateTimeKind.Utc) : v,
                v => v.HasValue ? DateTime.SpecifyKind(v.Value, DateTimeKind.Utc) : v);

            foreach (var entityType in builder.Model.GetEntityTypes())
            {
                foreach (var property in entityType.GetProperties())
                {
                    if (property.ClrType == typeof(DateTime))
                    {
                        property.SetValueConverter(dateTimeConverter);
                    }
                    else if (property.ClrType == typeof(DateTime?))
                    {
                        property.SetValueConverter(nullableDateTimeConverter);
                    }
                }
            }

            // Configure Identity tables
            builder.Entity<AppUser>(entity =>
            {
                entity.ToTable("users");
                entity.Property(e => e.Id).HasColumnName("id");
                entity.Property(e => e.TenantId).HasColumnName("tenant_id");
                entity.Property(e => e.UserName).HasColumnName("user_name");
                entity.Property(e => e.NormalizedUserName).HasColumnName("normalized_user_name");
                entity.Property(e => e.Email).HasColumnName("email");
                entity.Property(e => e.NormalizedEmail).HasColumnName("normalized_email");
                entity.Property(e => e.EmailConfirmed).HasColumnName("email_confirmed");
                entity.Property(e => e.PasswordHash).HasColumnName("password_hash");
                entity.Property(e => e.SecurityStamp).HasColumnName("security_stamp");
                entity.Property(e => e.ConcurrencyStamp).HasColumnName("concurrency_stamp");
                entity.Property(e => e.PhoneNumber).HasColumnName("phone_number");
                entity.Property(e => e.PhoneNumberConfirmed).HasColumnName("phone_number_confirmed");
                entity.Property(e => e.TwoFactorEnabled).HasColumnName("two_factor_enabled");
                entity.Property(e => e.LockoutEnd).HasColumnName("lockout_end");
                entity.Property(e => e.LockoutEnabled).HasColumnName("lockout_enabled");
                entity.Property(e => e.AccessFailedCount).HasColumnName("access_failed_count");
                
                // New activation and password reset columns
                entity.Property(e => e.ActivationStatus).HasColumnName("activation_status");
                entity.Property(e => e.OneTimePasswordHash).HasColumnName("one_time_password_hash");
                entity.Property(e => e.OtpExpiresAt).HasColumnName("otp_expires_at");
                entity.Property(e => e.MustResetPassword).HasColumnName("must_reset_password");
                entity.Property(e => e.PasswordResetToken).HasColumnName("password_reset_token");
                entity.Property(e => e.ResetTokenExpiresAt).HasColumnName("reset_token_expires_at");
                entity.Property(e => e.LastPasswordChange).HasColumnName("last_password_change");
                entity.Property(e => e.EmailVerified).HasColumnName("email_verified");
                entity.Property(e => e.EmailVerificationToken).HasColumnName("email_verification_token");
                entity.Property(e => e.EmailVerificationSentAt).HasColumnName("email_verification_sent_at");
                entity.Property(e => e.FailedLoginAttempts).HasColumnName("failed_login_attempts");
                entity.Property(e => e.LockedUntil).HasColumnName("locked_until");
                entity.Property(e => e.LastLoginIp).HasColumnName("last_login_ip");
                
                // Professional fields
                entity.Property(e => e.Designation).HasColumnName("designation");
                entity.Property(e => e.LicenseNumber).HasColumnName("license_number");
                entity.Property(e => e.NpiNumber).HasColumnName("npi_number");
                entity.Property(e => e.ProfessionalRegistrationDate).HasColumnName("professional_registration_date");
                
                // HIPAA Compliance acceptance tracking
                entity.Property(e => e.AcceptedTerms).HasColumnName("accepted_terms");
                entity.Property(e => e.AcceptedTermsAt).HasColumnName("accepted_terms_at");
                entity.Property(e => e.AcceptedPrivacy).HasColumnName("accepted_privacy");
                entity.Property(e => e.AcceptedPrivacyAt).HasColumnName("accepted_privacy_at");
                entity.Property(e => e.AcceptedHipaa).HasColumnName("accepted_hipaa");
                entity.Property(e => e.AcceptedHipaaAt).HasColumnName("accepted_hipaa_at");
                entity.Property(e => e.ComplianceAcceptanceIp).HasColumnName("compliance_acceptance_ip");
                
                entity.HasIndex(e => new { e.TenantId, e.UserName }).IsUnique();
                entity.HasIndex(e => new { e.TenantId, e.Email }).IsUnique();
            });

            builder.Entity<AppRole>(entity =>
            {
                entity.ToTable("app_roles");
                entity.Property(e => e.Id).HasColumnName("id");
                entity.Property(e => e.TenantId).HasColumnName("tenant_id");
                entity.Property(e => e.Name).HasColumnName("name");
                entity.Property(e => e.ParentRoleId).HasColumnName("parent_role_id");
                entity.Property(e => e.RoleLevel).HasColumnName("hierarchy_level");
            });

            builder.Entity<AppUserRole>(entity =>
            {
                entity.ToTable("app_user_roles");
                entity.Property(e => e.UserId).HasColumnName("user_id");
                entity.Property(e => e.RoleId).HasColumnName("role_id");
                entity.Property(e => e.BranchId).HasColumnName("branch_id");
                entity.HasOne(e => e.User)
                    .WithMany(u => u.UserRoles)
                    .HasForeignKey(e => e.UserId)
                    .OnDelete(DeleteBehavior.Cascade);
                entity.HasOne(e => e.Role)
                    .WithMany(r => r.UserRoles)
                    .HasForeignKey(e => e.RoleId)
                    .OnDelete(DeleteBehavior.Cascade);
            });

            builder.Entity<AppRoleClaim>(entity =>
            {
                entity.ToTable("app_role_claims");
            });

            builder.Entity<AppUserClaim>(entity =>
            {
                entity.ToTable("app_user_claims");
            });

            builder.Entity<AppUserLogin>(entity =>
            {
                entity.ToTable("app_user_logins");
            });

            builder.Entity<AppUserToken>(entity =>
            {
                entity.ToTable("app_user_tokens");
            });

            builder.Entity<Tenant>(entity =>
            {
                entity.ToTable("tenant");
                entity.Property(e => e.Id).HasColumnName("id").ValueGeneratedOnAdd();
                entity.HasKey(e => e.Id);
                
                // Map properties to actual database columns (snake_case)
                entity.Property(e => e.Name).HasColumnName("name");
                entity.Property(e => e.TenantCode).HasColumnName("tenant_code");
                entity.Property(e => e.TenantType).HasColumnName("tenant_type");
                entity.Property(e => e.Email).HasColumnName("company_email");
                entity.Property(e => e.Phone).HasColumnName("company_phone");
                entity.Property(e => e.Status).HasColumnName("status");
                entity.Property(e => e.SubscriptionTier).HasColumnName("subscription_type");
                entity.Property(e => e.MaxBranches).HasColumnName("max_branches");
                entity.Property(e => e.MaxUsers).HasColumnName("max_users");
                entity.Property(e => e.HipaaCompliant).HasColumnName("hipaa_compliant");
                entity.Property(e => e.NabhAccredited).HasColumnName("nabh_accredited");
                entity.Property(e => e.GdprCompliant).HasColumnName("gdpr_compliant");
                entity.Property(e => e.DpaCompliant).HasColumnName("dpa_compliant");
                entity.Property(e => e.PrimaryRegion).HasColumnName("primary_region");
                entity.Property(e => e.DefaultCurrency).HasColumnName("default_currency");
                entity.Property(e => e.CreatedAt).HasColumnName("created_at");
                entity.Property(e => e.UpdatedAt).HasColumnName("updated_at");
                entity.Property(e => e.UpdatedBy).HasColumnName("updated_by");
                entity.Property(e => e.IsActive).HasColumnName("is_active");
                
                // Address fields
                entity.Property(e => e.Address).HasColumnName("address");
                entity.Property(e => e.City).HasColumnName("city");
                entity.Property(e => e.State).HasColumnName("state");
                entity.Property(e => e.Country).HasColumnName("country");
                entity.Property(e => e.Pincode).HasColumnName("pincode");
                
                // Ignore properties that don't have database columns
                entity.Ignore(e => e.RegistrationNumber);
                entity.Ignore(e => e.CreatedBy);
            });

            // Organization Entity Configuration - Simplified to match actual database schema (11 columns)
            builder.Entity<Organization>(entity =>
            {
                entity.ToTable("organization");
                
                // Primary Key
                entity.HasKey(e => e.Id);
                entity.Property(e => e.Id).HasColumnName("id").HasDefaultValueSql("gen_random_uuid()");
                
                // Auto-increment Organization ID
                entity.Property(e => e.OrganizationId).HasColumnName("organization_id").ValueGeneratedOnAdd();
                
                // Foreign Key to Tenant
                entity.Property(e => e.TenantId).HasColumnName("tenant_id").IsRequired();
                
                // Basic Information
                entity.Property(e => e.Name).HasColumnName("name").HasMaxLength(128).IsRequired();
                entity.Property(e => e.OrganizationCode).HasColumnName("organization_code").HasMaxLength(16);
                entity.Property(e => e.OrganizationName).HasColumnName("organization_name").HasMaxLength(128);
                
                // Location
                entity.Property(e => e.CountryCode).HasColumnName("country_code").HasMaxLength(4);
                entity.Property(e => e.StateProvince).HasColumnName("state_province").HasMaxLength(64);
                entity.Property(e => e.City).HasColumnName("city").HasMaxLength(64);
                entity.Property(e => e.Address).HasColumnName("address").HasMaxLength(255);
                entity.Property(e => e.PostalCode).HasColumnName("postal_code").HasMaxLength(16);
                
                // Contact Information
                entity.Property(e => e.Email).HasColumnName("email").HasMaxLength(128);
                entity.Property(e => e.Phone).HasColumnName("phone").HasMaxLength(32);
                entity.Property(e => e.Website).HasColumnName("website").HasMaxLength(500);
                entity.Property(e => e.PrimaryContactName).HasColumnName("primary_contact_name").HasMaxLength(200);
                entity.Property(e => e.PrimaryContactEmail).HasColumnName("primary_contact_email").HasMaxLength(200);
                entity.Property(e => e.PrimaryContactPhone).HasColumnName("primary_contact_phone").HasMaxLength(50);
                
                // Business Information
                entity.Property(e => e.Description).HasColumnName("description");
                entity.Property(e => e.OperationalSince).HasColumnName("operational_since");
                
                // Configuration
                entity.Property(e => e.CurrencyCode).HasColumnName("currency_code").HasMaxLength(8);
                entity.Property(e => e.LanguageCode).HasColumnName("language_code").HasMaxLength(8);
                entity.Property(e => e.Timezone).HasColumnName("timezone").HasMaxLength(64).HasDefaultValue("UTC");
                entity.Property(e => e.DateFormat).HasColumnName("date_format").HasMaxLength(32);
                entity.Property(e => e.TimeFormat).HasColumnName("time_format").HasMaxLength(16);
                entity.Property(e => e.NumberFormat).HasColumnName("number_format").HasMaxLength(32);
                entity.Property(e => e.Status).HasColumnName("status").HasMaxLength(16).HasDefaultValue("Active");
                
                // Regulatory & Compliance
                entity.Property(e => e.RegulatoryBody).HasColumnName("regulatory_body").HasMaxLength(128);
                entity.Property(e => e.LicenseNumber).HasColumnName("license_number").HasMaxLength(64);
                entity.Property(e => e.AccreditationStatus).HasColumnName("accreditation_status").HasMaxLength(64);
                
                // Branding
                entity.Property(e => e.LogoUrl).HasColumnName("logo_url").HasMaxLength(512);
                entity.Property(e => e.PrimaryColor).HasColumnName("primary_color").HasMaxLength(16);
                entity.Property(e => e.SecondaryColor).HasColumnName("secondary_color").HasMaxLength(16);
                
                // Relationships
                entity.HasOne(e => e.Tenant)
                    .WithMany()
                    .HasForeignKey(e => e.TenantId)
                    .OnDelete(DeleteBehavior.Cascade);
                
                // Indexes
                entity.HasIndex(e => e.TenantId);
                entity.HasIndex(e => e.OrganizationCode);
                entity.HasIndex(e => e.Status);
            });

            // Branch Entity Configuration - Comprehensive HIPAA/NABH/GDPR-compliant healthcare facility
            builder.Entity<Branch>(entity =>
            {
                entity.ToTable("branch");
                
                // ============================================================================
                // PRIMARY KEYS & IDENTIFICATION
                // ============================================================================
                entity.HasKey(e => e.Id);
                entity.Property(e => e.Id).HasColumnName("id").HasDefaultValueSql("gen_random_uuid()");
                entity.Property(e => e.BranchId).HasColumnName("branch_id").ValueGeneratedOnAdd();
                
                // ============================================================================
                // FOREIGN KEYS
                // ============================================================================
                entity.Property(e => e.TenantId).HasColumnName("tenant_id").IsRequired();
                entity.Property(e => e.OrganizationId).HasColumnName("organization_id").IsRequired();
                
                // ============================================================================
                // CORE FIELDS
                // ============================================================================
                entity.Property(e => e.Name).HasColumnName("name").HasMaxLength(128).IsRequired();
                entity.Property(e => e.BranchCode).HasColumnName("branch_code").HasMaxLength(16);
                // LocationCode column removed - not in database
                // entity.Property(e => e.LocationCode).HasColumnName("location_code");
                entity.Property(e => e.Description).HasColumnName("description");
                entity.Property(e => e.Status).HasColumnName("status").HasMaxLength(16).HasDefaultValue("Active");
                entity.Property(e => e.OperationalStatus).HasColumnName("operational_status").HasMaxLength(50).HasDefaultValue("Operational");
                entity.Property(e => e.Region).HasColumnName("region").HasMaxLength(50);
                
                // ============================================================================
                // BRANCH TYPE
                // ============================================================================
                entity.Property(e => e.BranchType).HasColumnName("branch_type").HasMaxLength(50);
                entity.Property(e => e.IsVirtual).HasColumnName("is_virtual").HasDefaultValue(false);
                entity.Property(e => e.IsMainBranch).HasColumnName("is_main_branch").HasDefaultValue(false);
                entity.Property(e => e.LicenseNumber).HasColumnName("license_number").HasMaxLength(64);
                
                // ============================================================================
                // ADDRESS FIELDS (Mix of individual columns and JSONB)
                // ============================================================================
                entity.Property(e => e.Address).HasColumnName("address").HasColumnType("jsonb");
                entity.Property(e => e.AddressLine1).HasColumnName("address_line_1").HasMaxLength(255);
                entity.Property(e => e.AddressLine2).HasColumnName("address_line_2").HasMaxLength(255);
                entity.Property(e => e.City).HasColumnName("city").HasMaxLength(64);
                entity.Property(e => e.StateProvince).HasColumnName("state_province").HasMaxLength(100);
                entity.Property(e => e.PostalCode).HasColumnName("postal_code").HasMaxLength(16);
                entity.Property(e => e.Country).HasColumnName("country").HasMaxLength(100);
                entity.Property(e => e.CountryCode).HasColumnName("country_code").HasMaxLength(4);
                entity.Property(e => e.Latitude).HasColumnName("latitude").HasColumnType("numeric");
                entity.Property(e => e.Longitude).HasColumnName("longitude").HasColumnType("numeric");
                
                // ============================================================================
                // CONTACT INFORMATION
                // ============================================================================
                entity.Property(e => e.Phone).HasColumnName("phone").HasMaxLength(20);
                entity.Property(e => e.Email).HasColumnName("email").HasMaxLength(255);
                entity.Property(e => e.Fax).HasColumnName("fax").HasMaxLength(20);
                entity.Property(e => e.Website).HasColumnName("website").HasMaxLength(500);
                entity.Property(e => e.ContactInfo).HasColumnName("contact_info").HasColumnType("jsonb");
                
                // ============================================================================
                // OPERATIONAL SETTINGS
                // ============================================================================
                entity.Property(e => e.Timezone).HasColumnName("timezone").HasMaxLength(64);
                entity.Property(e => e.CurrencyCode).HasColumnName("currency_code").HasMaxLength(8);
                entity.Property(e => e.LanguagePrimary).HasColumnName("language_primary").HasMaxLength(10).HasDefaultValue("en");
                entity.Property(e => e.OperationalHoursStart).HasColumnName("operational_hours_start");
                entity.Property(e => e.OperationalHoursEnd).HasColumnName("operational_hours_end");
                entity.Property(e => e.OperatingHours).HasColumnName("operating_hours").HasColumnType("jsonb");
                entity.Property(e => e.EmergencySupport24x7).HasColumnName("emergency_support_24_7").HasDefaultValue(true);
                
                // ============================================================================
                // STATISTICS
                // ============================================================================
                entity.Property(e => e.TotalDepartments).HasColumnName("total_departments").HasDefaultValue(0);
                entity.Property(e => e.TotalStaff).HasColumnName("total_staff").HasDefaultValue(0);
                
                // ============================================================================
                // STRUCTURED DATA (JSONB)
                // ============================================================================
                entity.Property(e => e.Facilities).HasColumnName("facilities").HasColumnType("jsonb");
                entity.Property(e => e.CapacityInfo).HasColumnName("capacity_info").HasColumnType("jsonb");
                entity.Property(e => e.BranchSettings).HasColumnName("branch_settings").HasColumnType("jsonb");
                
                // ============================================================================
                // HIPAA COMPLIANCE
                // ============================================================================
                entity.Property(e => e.HipaaCoveredEntity).HasColumnName("hipaa_covered_entity").HasDefaultValue(false);
                entity.Property(e => e.BusinessAssociate).HasColumnName("business_associate").HasDefaultValue(false);
                entity.Property(e => e.PhiStorageApproved).HasColumnName("phi_storage_approved").HasDefaultValue(false);
                entity.Property(e => e.EncryptionAtRest).HasColumnName("encryption_at_rest").HasDefaultValue(true);
                entity.Property(e => e.EncryptionInTransit).HasColumnName("encryption_in_transit").HasDefaultValue(true);
                entity.Property(e => e.AccessControlLevel).HasColumnName("access_control_level").HasMaxLength(50).HasDefaultValue("Standard");
                entity.Property(e => e.LastSecurityAuditDate).HasColumnName("last_security_audit_date");
                entity.Property(e => e.NextSecurityAuditDate).HasColumnName("next_security_audit_date");
                entity.Property(e => e.HipaaComplianceStatus).HasColumnName("hipaa_compliance_status").HasMaxLength(50).HasDefaultValue("Pending");
                entity.Property(e => e.HipaaCertificationDate).HasColumnName("hipaa_certification_date");
                entity.Property(e => e.HipaaCertificationExpiry).HasColumnName("hipaa_certification_expiry");
                entity.Property(e => e.PrivacyOfficerId).HasColumnName("privacy_officer_id");
                entity.Property(e => e.SecurityOfficerId).HasColumnName("security_officer_id");
                
                // ============================================================================
                // NABH ACCREDITATION
                // ============================================================================
                entity.Property(e => e.NabhAccredited).HasColumnName("nabh_accredited").HasDefaultValue(false);
                entity.Property(e => e.NabhAccreditationLevel).HasColumnName("nabh_accreditation_level").HasMaxLength(50);
                entity.Property(e => e.NabhCertificateNumber).HasColumnName("nabh_certificate_number").HasMaxLength(50);
                entity.Property(e => e.NabhAccreditationDate).HasColumnName("nabh_accreditation_date");
                entity.Property(e => e.NabhAccreditationExpiry).HasColumnName("nabh_accreditation_expiry");
                entity.Property(e => e.NabhLastAuditDate).HasColumnName("nabh_last_audit_date");
                entity.Property(e => e.NabhNextAuditDate).HasColumnName("nabh_next_audit_date");
                
                // ============================================================================
                // QUALITY CERTIFICATIONS
                // ============================================================================
                entity.Property(e => e.IsoCertified).HasColumnName("iso_certified").HasDefaultValue(false);
                entity.Property(e => e.IsoCertificateNumber).HasColumnName("iso_certificate_number").HasMaxLength(50);
                entity.Property(e => e.JciAccredited).HasColumnName("jci_accredited").HasDefaultValue(false);
                entity.Property(e => e.QualityCertifications).HasColumnName("quality_certifications").HasColumnType("jsonb");
                
                // ============================================================================
                // PATIENT SAFETY
                // ============================================================================
                entity.Property(e => e.InfectionControlCertified).HasColumnName("infection_control_certified").HasDefaultValue(false);
                entity.Property(e => e.PatientSafetyCertified).HasColumnName("patient_safety_certified").HasDefaultValue(false);
                entity.Property(e => e.FireSafetyCertified).HasColumnName("fire_safety_certified").HasDefaultValue(false);
                entity.Property(e => e.DisasterPreparednessPlan).HasColumnName("disaster_preparedness_plan").HasDefaultValue(false);
                
                // ============================================================================
                // GDPR/DPA COMPLIANCE
                // ============================================================================
                entity.Property(e => e.GdprCompliant).HasColumnName("gdpr_compliant").HasDefaultValue(false);
                entity.Property(e => e.DpaRegistered).HasColumnName("dpa_registered").HasDefaultValue(false);
                entity.Property(e => e.DataProtectionOfficerId).HasColumnName("data_protection_officer_id");
                entity.Property(e => e.DataRetentionPolicy).HasColumnName("data_retention_policy").HasMaxLength(50).HasDefaultValue("7years");
                entity.Property(e => e.RightToErasureEnabled).HasColumnName("right_to_erasure_enabled").HasDefaultValue(true);
                
                // ============================================================================
                // ACCESSIBILITY
                // ============================================================================
                entity.Property(e => e.WheelchairAccessible).HasColumnName("wheelchair_accessible").HasDefaultValue(true);
                entity.Property(e => e.AccessibilityFeatures).HasColumnName("accessibility_features").HasColumnType("jsonb");
                
                // ============================================================================
                // EMERGENCY SERVICES
                // ============================================================================
                entity.Property(e => e.EmergencyServicesAvailable).HasColumnName("emergency_services_available").HasDefaultValue(false);
                entity.Property(e => e.TraumaCenterLevel).HasColumnName("trauma_center_level").HasMaxLength(50);
                entity.Property(e => e.AmbulanceServices).HasColumnName("ambulance_services").HasDefaultValue(false);
                entity.Property(e => e.HelipadAvailable).HasColumnName("helipad_available").HasDefaultValue(false);
                
                // ============================================================================
                // MEDICAL SERVICES
                // ============================================================================
                entity.Property(e => e.MedicalSpecialties).HasColumnName("medical_specialties").HasColumnType("jsonb");
                entity.Property(e => e.TelemedicineEnabled).HasColumnName("telemedicine_enabled").HasDefaultValue(false);
                entity.Property(e => e.PharmacyOnSite).HasColumnName("pharmacy_on_site").HasDefaultValue(false);
                entity.Property(e => e.LaboratoryServices).HasColumnName("laboratory_services").HasDefaultValue(false);
                entity.Property(e => e.ImagingServices).HasColumnName("imaging_services").HasColumnType("jsonb");
                
                // ============================================================================
                // CAPACITY MANAGEMENT
                // ============================================================================
                entity.Property(e => e.BedCapacityTotal).HasColumnName("bed_capacity_total").HasDefaultValue(0);
                entity.Property(e => e.BedCapacityIcu).HasColumnName("bed_capacity_icu").HasDefaultValue(0);
                entity.Property(e => e.BedCapacityGeneral).HasColumnName("bed_capacity_general").HasDefaultValue(0);
                entity.Property(e => e.BedCapacityEmergency).HasColumnName("bed_capacity_emergency").HasDefaultValue(0);
                entity.Property(e => e.CurrentOccupancyRate).HasColumnName("current_occupancy_rate").HasColumnType("decimal(5,2)").HasDefaultValue(0.00m);
                entity.Property(e => e.AcceptsNewPatients).HasColumnName("accepts_new_patients").HasDefaultValue(true);
                
                // ============================================================================
                // INSURANCE & BILLING
                // ============================================================================
                entity.Property(e => e.InsuranceProvidersAccepted).HasColumnName("insurance_providers_accepted").HasColumnType("jsonb");
                entity.Property(e => e.BillingTypesAccepted).HasColumnName("billing_types_accepted").HasColumnType("jsonb");
                entity.Property(e => e.PaymentPlansAvailable).HasColumnName("payment_plans_available").HasDefaultValue(true);
                
                // ============================================================================
                // STAFF MANAGEMENT
                // ============================================================================
                entity.Property(e => e.BranchManagerId).HasColumnName("branch_manager_id");
                entity.Property(e => e.MedicalDirectorId).HasColumnName("medical_director_id");
                entity.Property(e => e.NursingSupervisorId).HasColumnName("nursing_supervisor_id");
                entity.Property(e => e.TotalPhysicians).HasColumnName("total_physicians").HasDefaultValue(0);
                entity.Property(e => e.TotalNurses).HasColumnName("total_nurses").HasDefaultValue(0);
                entity.Property(e => e.TotalAdministrativeStaff).HasColumnName("total_administrative_staff").HasDefaultValue(0);
                
                // ============================================================================
                // AUDIT FIELDS
                // ============================================================================
                entity.Property(e => e.CreatedAt).HasColumnName("created_at").HasDefaultValueSql("now()");
                entity.Property(e => e.UpdatedAt).HasColumnName("updated_at").HasDefaultValueSql("now()");
                entity.Property(e => e.CreatedBy).HasColumnName("created_by");
                entity.Property(e => e.UpdatedBy).HasColumnName("updated_by");
                entity.Property(e => e.DeletedAt).HasColumnName("deleted_at");
                entity.Property(e => e.DeletedBy).HasColumnName("deleted_by");
                
                // ============================================================================
                // RELATIONSHIPS
                // ============================================================================
                entity.HasOne(e => e.Tenant)
                    .WithMany()
                    .HasForeignKey(e => e.TenantId)
                    .OnDelete(DeleteBehavior.Cascade);
                    
                entity.HasOne(e => e.Organization)
                    .WithMany(o => o.Branches)
                    .HasForeignKey(e => e.OrganizationId)
                    .OnDelete(DeleteBehavior.Cascade);
                
                // ============================================================================
                // INDEXES FOR PERFORMANCE
                // ============================================================================
                entity.HasIndex(e => e.TenantId);
                entity.HasIndex(e => e.OrganizationId);
                entity.HasIndex(e => e.BranchCode);
                entity.HasIndex(e => e.Status);
                entity.HasIndex(e => e.OperationalStatus);
                entity.HasIndex(e => e.HipaaComplianceStatus);
                entity.HasIndex(e => e.NabhAccredited);
                entity.HasIndex(e => e.EmergencyServicesAvailable);
                entity.HasIndex(e => e.AcceptsNewPatients);
                entity.HasIndex(e => e.DeletedAt); // For soft delete queries
                
                // ============================================================================
                // COMPUTED PROPERTIES (Ignore - not stored in database)
                // ============================================================================
                entity.Ignore(e => e.IsActive);
                entity.Ignore(e => e.IsOperational);
                entity.Ignore(e => e.IsCompliant);
                entity.Ignore(e => e.HasEmergencyServices);
                entity.Ignore(e => e.TotalBedCapacity);
                entity.Ignore(e => e.AvailableBeds);
                entity.Ignore(e => e.RequiresSecurityAudit);
                entity.Ignore(e => e.RequiresNabhAudit);
            });

            // Department Entity Configuration - Healthcare department with hierarchical structure
            builder.Entity<Department>(entity =>
            {
                entity.ToTable("department");

                // ============================================================================
                // PRIMARY KEYS & IDENTIFICATION
                // ============================================================================
                entity.HasKey(e => e.Id);
                entity.Property(e => e.Id).HasColumnName("id").HasDefaultValueSql("gen_random_uuid()");

                // ============================================================================
                // CORE DEPARTMENT FIELDS
                // ============================================================================
                entity.Property(e => e.DepartmentCode).HasColumnName("department_code").HasMaxLength(50).IsRequired();
                entity.Property(e => e.DepartmentName).HasColumnName("department_name").HasMaxLength(200).IsRequired();
                entity.Property(e => e.DepartmentType).HasColumnName("department_type").HasMaxLength(100);
                entity.Property(e => e.Description).HasColumnName("description");
                entity.Property(e => e.Status).HasColumnName("status").HasMaxLength(50).HasDefaultValue("Active");

                // ============================================================================
                // HIERARCHICAL STRUCTURE
                // ============================================================================
                entity.Property(e => e.ParentDepartmentId).HasColumnName("parent_department_id");

                // ============================================================================
                // DEPARTMENT LEADERSHIP
                // ============================================================================
                entity.Property(e => e.DepartmentHeadId).HasColumnName("department_head_id");

                // ============================================================================
                // OPERATIONAL HOURS
                // ============================================================================
                entity.Property(e => e.OperatingHoursStart).HasColumnName("operating_hours_start");
                entity.Property(e => e.OperatingHoursEnd).HasColumnName("operating_hours_end");
                entity.Property(e => e.DaysOfOperation).HasColumnName("days_of_operation");
                entity.Property(e => e.Is24x7).HasColumnName("is_24x7").HasDefaultValue(false);

                // ============================================================================
                // BUDGET & FINANCIAL
                // ============================================================================
                entity.Property(e => e.AnnualBudget).HasColumnName("annual_budget").HasColumnType("decimal(18,2)");
                entity.Property(e => e.BudgetCurrency).HasColumnName("budget_currency").HasMaxLength(3);

                // ============================================================================
                // APPROVAL WORKFLOW
                // ============================================================================
                entity.Property(e => e.RequiresApproval).HasColumnName("requires_approval").HasDefaultValue(false);
                entity.Property(e => e.ApprovalLevel).HasColumnName("approval_level");
                entity.Property(e => e.AutoApprovalThreshold).HasColumnName("auto_approval_threshold").HasColumnType("decimal(18,2)");

                // ============================================================================
                // CAPACITY MANAGEMENT
                // ============================================================================
                entity.Property(e => e.MaxConcurrentPatients).HasColumnName("max_concurrent_patients");
                entity.Property(e => e.WaitingRoomCapacity).HasColumnName("waiting_room_capacity");

                // ============================================================================
                // FOREIGN KEYS
                // ============================================================================
                entity.Property(e => e.TenantId).HasColumnName("tenant_id").IsRequired();
                entity.Property(e => e.BranchId).HasColumnName("branch_id");

                // ============================================================================
                // AUDIT FIELDS
                // ============================================================================
                entity.Property(e => e.CreatedAt).HasColumnName("created_at").HasDefaultValueSql("now()");
                entity.Property(e => e.UpdatedAt).HasColumnName("updated_at");
                entity.Property(e => e.CreatedBy).HasColumnName("created_by");
                entity.Property(e => e.UpdatedBy).HasColumnName("updated_by");
                entity.Property(e => e.DeletedAt).HasColumnName("deleted_at");
                entity.Property(e => e.DeletedBy).HasColumnName("deleted_by");
                entity.Property(e => e.ChangeReason).HasColumnName("change_reason");

                // ============================================================================
                // RELATIONSHIPS
                // ============================================================================
                entity.HasOne(e => e.ParentDepartment)
                    .WithMany(e => e.SubDepartments)
                    .HasForeignKey(e => e.ParentDepartmentId)
                    .OnDelete(DeleteBehavior.Restrict);

                entity.HasOne(e => e.Tenant)
                    .WithMany()
                    .HasForeignKey(e => e.TenantId)
                    .OnDelete(DeleteBehavior.Cascade);

                entity.HasOne(e => e.Branch)
                    .WithMany()
                    .HasForeignKey(e => e.BranchId)
                    .OnDelete(DeleteBehavior.SetNull);

                // ============================================================================
                // INDEXES FOR PERFORMANCE
                // ============================================================================
                entity.HasIndex(e => e.TenantId);
                entity.HasIndex(e => e.BranchId);
                entity.HasIndex(e => e.DepartmentCode);
                entity.HasIndex(e => e.Status);
                entity.HasIndex(e => e.ParentDepartmentId);
                entity.HasIndex(e => e.DeletedAt); // For soft delete queries

                // ============================================================================
                // COMPUTED PROPERTIES (Ignore - not stored in database)
                // ============================================================================
                entity.Ignore(e => e.Name); // Alias property, not stored
            });

            builder.Entity<Permission>(entity =>
            {
                entity.ToTable("permissions"); // Fixed: Azure DB uses plural 'permissions'
                entity.Property(e => e.Id).HasColumnName("id").ValueGeneratedOnAdd();
                entity.HasIndex(e => new { e.TenantId, e.Code }).IsUnique();
            });

            builder.Entity<RolePermission>(entity =>
            {
                entity.ToTable("role_permission");
                entity.Property(e => e.Id).HasColumnName("id").ValueGeneratedOnAdd();
                entity.HasOne(e => e.Role)
                    .WithMany(r => r.RolePermissions)
                    .HasForeignKey(e => e.RoleId)
                    .OnDelete(DeleteBehavior.Cascade);
                entity.HasOne(e => e.Permission)
                    .WithMany(p => p.RolePermissions)
                    .HasForeignKey(e => e.PermissionId)
                    .OnDelete(DeleteBehavior.Cascade);
            });

            builder.Entity<UserAttribute>(entity =>
            {
                entity.ToTable("user_attribute");
                entity.Property(e => e.Id).HasColumnName("id").ValueGeneratedOnAdd();
                entity.HasOne(e => e.User)
                    .WithMany(u => u.UserAttributes)
                    .HasForeignKey(e => e.UserId)
                    .OnDelete(DeleteBehavior.Cascade);
            });

            builder.Entity<FailedLoginAttempt>(entity =>
            {
                entity.ToTable("failed_login_attempt");
                entity.Property(e => e.Id).HasColumnName("id").ValueGeneratedOnAdd();
                entity.Property(e => e.EmailOrUsername).HasColumnName("email_or_username");
                entity.Property(e => e.TenantId).HasColumnName("tenant_id");
                entity.Property(e => e.IpAddress).HasColumnName("ip_address");
                entity.Property(e => e.AttemptedAt).HasColumnName("attempted_at");
                entity.Property(e => e.Reason).HasColumnName("reason");
            });

            builder.Entity<AuditLog>(entity =>
            {
                entity.ToTable("audit_log");
                entity.Property(e => e.Id).HasColumnName("id").ValueGeneratedOnAdd();
                entity.Property(e => e.TenantId).HasColumnName("tenant_id");
                entity.Property(e => e.UserId).HasColumnName("user_id");
                entity.Property(e => e.UserName).HasColumnName("UserName"); // PascalCase in DB
                entity.Property(e => e.Action).HasColumnName("action");
                entity.Property(e => e.ResourceType).HasColumnName("resource_type");
                entity.Property(e => e.ResourceId).HasColumnName("resource_id");
                entity.Property(e => e.EntityType).HasColumnName("EntityType"); // PascalCase in DB
                entity.Property(e => e.EntityId).HasColumnName("EntityId"); // PascalCase in DB
                entity.Property(e => e.Description).HasColumnName("Description"); // PascalCase in DB
                entity.Property(e => e.OldValues).HasColumnName("old_values");
                entity.Property(e => e.NewValues).HasColumnName("new_values");
                entity.Property(e => e.Changes).HasColumnName("Changes"); // PascalCase in DB
                entity.Property(e => e.IpAddress).HasColumnName("ip_address");
                entity.Property(e => e.UserAgent).HasColumnName("user_agent");
                entity.Property(e => e.Status).HasColumnName("status");
                entity.Property(e => e.Reason).HasColumnName("reason");
                entity.Property(e => e.CreatedAt).HasColumnName("created_at");
                entity.Property(e => e.Timestamp).HasColumnName("Timestamp"); // PascalCase in DB
            });

            builder.Entity<SystemAlert>(entity =>
            {
                entity.ToTable("system_alert");
                entity.Property(e => e.Id).HasColumnName("id").ValueGeneratedOnAdd();
                entity.Property(e => e.AlertType).HasColumnName("alert_type");
                entity.Property(e => e.Severity).HasColumnName("severity");
                entity.Property(e => e.Title).HasColumnName("title");
                entity.Property(e => e.Description).HasColumnName("description");
                entity.Property(e => e.Count).HasColumnName("count");
                entity.Property(e => e.IsDismissed).HasColumnName("is_dismissed");
                entity.Property(e => e.CreatedAt).HasColumnName("created_at");
                entity.Property(e => e.DismissedAt).HasColumnName("dismissed_at");
            });

            builder.Entity<SystemSetting>(entity =>
            {
                entity.ToTable("system_settings");
                entity.Property(e => e.Id).HasColumnName("id").ValueGeneratedOnAdd();
                entity.Property(e => e.TenantId).HasColumnName("tenant_id");
                entity.Property(e => e.Category).HasColumnName("category");
                entity.Property(e => e.Key).HasColumnName("key");
                entity.Property(e => e.Value).HasColumnName("value");
                entity.Property(e => e.DataType).HasColumnName("data_type");
                entity.Property(e => e.CreatedAt).HasColumnName("created_at");
                entity.Property(e => e.UpdatedAt).HasColumnName("updated_at");
                entity.Property(e => e.CreatedByUserId).HasColumnName("created_by_user_id");
                entity.Property(e => e.UpdatedByUserId).HasColumnName("updated_by_user_id");
                entity.HasIndex(e => new { e.TenantId, e.Category, e.Key }).IsUnique();
            });

            builder.Entity<Patient>(entity =>
            {
                entity.ToTable("patient");
                entity.Property(e => e.Id).HasColumnName("id").ValueGeneratedOnAdd();
                entity.Property(e => e.TenantId).HasColumnName("tenant_id");
                entity.Property(e => e.MedicalRecordNumber).HasColumnName("medical_record_number");

                // Extended Demographics mappings (Phase 6)
                entity.Property(e => e.Title).HasColumnName("title");
                entity.Property(e => e.FirstName).HasColumnName("first_name");
                entity.Property(e => e.MiddleName).HasColumnName("middle_name");
                entity.Property(e => e.LastName).HasColumnName("last_name");
                entity.Property(e => e.DateOfBirth).HasColumnName("date_of_birth");
                entity.Property(e => e.Nationality).HasColumnName("nationality");
                entity.Property(e => e.Occupation).HasColumnName("occupation");
                entity.Property(e => e.MaritalStatus).HasColumnName("marital_status");
                entity.Property(e => e.Religion).HasColumnName("religion");
                entity.Property(e => e.LanguagePreference).HasColumnName("language_preference");

                entity.Property(e => e.Gender).HasColumnName("gender");
                entity.Property(e => e.ContactNumber).HasColumnName("contact_number");
                entity.Property(e => e.Email).HasColumnName("email");
                entity.Property(e => e.Address).HasColumnName("address");
                
                // Structured Address mappings (Phase 5)
                entity.Property(e => e.AddressLine1).HasColumnName("address_line_1");
                entity.Property(e => e.AddressLine2).HasColumnName("address_line_2");
                entity.Property(e => e.Country).HasColumnName("country");
                entity.Property(e => e.District).HasColumnName("district");
                entity.Property(e => e.Landmark).HasColumnName("landmark");
                entity.Property(e => e.PinCode).HasColumnName("pin_code");
                
                entity.Property(e => e.BloodGroup).HasColumnName("blood_group");
                entity.Property(e => e.Allergies).HasColumnName("allergies");
                
                // Enhanced Medical History mappings (Phase 4)
                entity.Property(e => e.ChronicConditions).HasColumnName("chronic_conditions");
                entity.Property(e => e.CurrentMedications).HasColumnName("current_medications");
                entity.Property(e => e.PastSurgeries).HasColumnName("past_surgeries");
                entity.Property(e => e.FamilyMedicalHistory).HasColumnName("family_medical_history");
                entity.Property(e => e.KnownAllergiesDetails).HasColumnName("known_allergies_details");
                entity.Property(e => e.ImmunizationRecords).HasColumnName("immunization_records");
                entity.Property(e => e.DisabilityStatus).HasColumnName("disability_status");
                entity.Property(e => e.SpecialNeeds).HasColumnName("special_needs");
                
                // Additional Medical/Lifestyle mappings (Phase 8)
                entity.Property(e => e.ExerciseHabits).HasColumnName("exercise_habits");
                entity.Property(e => e.DietType).HasColumnName("diet_type");
                entity.Property(e => e.SmokingStatus).HasColumnName("smoking_status");
                entity.Property(e => e.AlcoholUse).HasColumnName("alcohol_use");
                entity.Property(e => e.LifestyleNotes).HasColumnName("lifestyle_notes");
                
                // Patient Photo mappings (Phase 7)
                entity.Property(e => e.PhotoUrl).HasColumnName("photo_url");
                entity.Property(e => e.PhotoThumbnailUrl).HasColumnName("photo_thumbnail_url");
                entity.Property(e => e.PhotoUploadedAt).HasColumnName("photo_uploaded_at");
                
                // Emergency Contact mappings
                entity.Property(e => e.EmergencyContactName).HasColumnName("emergency_contact_name");
                entity.Property(e => e.EmergencyContactPhone).HasColumnName("emergency_contact_phone");
                entity.Property(e => e.EmergencyContactRelationship).HasColumnName("emergency_contact_relationship");
                entity.Property(e => e.EmergencyContactEmail).HasColumnName("emergency_contact_email");
                entity.Property(e => e.EmergencyContactAddress).HasColumnName("emergency_contact_address");
                
                // Insurance mappings
                entity.Property(e => e.InsuranceProvider).HasColumnName("insurance_provider");
                entity.Property(e => e.InsurancePolicyNumber).HasColumnName("insurance_policy_number");
                entity.Property(e => e.InsuranceGroupNumber).HasColumnName("insurance_group_number");
                entity.Property(e => e.InsuranceValidFrom).HasColumnName("insurance_valid_from");
                entity.Property(e => e.InsuranceValidTo).HasColumnName("insurance_valid_to");
                entity.Property(e => e.InsuranceStatus).HasColumnName("insurance_status");
                
                // Identity Documents mappings
                entity.Property(e => e.HealthId).HasColumnName("health_id");
                entity.Property(e => e.AadhaarNumber).HasColumnName("aadhaar_number");
                entity.Property(e => e.NationalId).HasColumnName("national_id");
                entity.Property(e => e.PassportNumber).HasColumnName("passport_number");
                entity.Property(e => e.DrivingLicense).HasColumnName("driving_license");
                entity.Property(e => e.IdProofType).HasColumnName("id_proof_type");
                
                // Guardian Information mappings
                entity.Property(e => e.GuardianName).HasColumnName("guardian_name");
                entity.Property(e => e.GuardianRelationship).HasColumnName("guardian_relationship");
                entity.Property(e => e.GuardianPhone).HasColumnName("guardian_phone");
                entity.Property(e => e.GuardianEmail).HasColumnName("guardian_email");
                entity.Property(e => e.GuardianAddress).HasColumnName("guardian_address");
                entity.Property(e => e.GuardianIdProof).HasColumnName("guardian_id_proof");
                
                // Audit mappings
                entity.Property(e => e.CreatedByUserId).HasColumnName("created_by_user_id");
                entity.Property(e => e.UpdatedByUserId).HasColumnName("updated_by_user_id");
                entity.Property(e => e.Status).HasColumnName("status");
                entity.Property(e => e.DeceasedDate).HasColumnName("deceased_date");
                
                entity.Property(e => e.CreatedAt).HasColumnName("created_at");
                entity.Property(e => e.UpdatedAt).HasColumnName("updated_at");
                entity.Property(e => e.DeletedAt).HasColumnName("deleted_at");
            });

            builder.Entity<ClinicalExamination>(entity =>
            {
                entity.ToTable("clinical_examination");
                entity.Property(e => e.Id).HasColumnName("id").ValueGeneratedOnAdd();
            });

            builder.Entity<Appointment>(entity =>
            {
                entity.ToTable("appointment");
                entity.Property(e => e.Id).HasColumnName("id").ValueGeneratedOnAdd();
                
                // Configure navigation properties for new tables
                entity.HasMany(e => e.Conflicts)
                    .WithOne(c => c.Appointment)
                    .HasForeignKey(c => c.AppointmentId)
                    .OnDelete(DeleteBehavior.Cascade);
                
                entity.HasMany(e => e.Reminders)
                    .WithOne(r => r.Appointment)
                    .HasForeignKey(r => r.AppointmentId)
                    .OnDelete(DeleteBehavior.Cascade);
            });

            // Appointment Enhancement Tables
            builder.Entity<DoctorAvailability>(entity =>
            {
                entity.ToTable("doctor_availability");
                entity.Property(e => e.Id).HasColumnName("id").ValueGeneratedOnAdd();
                entity.Property(e => e.TenantId).HasColumnName("tenant_id");
                entity.Property(e => e.DoctorId).HasColumnName("doctor_id");
                entity.Property(e => e.DayOfWeek).HasColumnName("day_of_week");
                entity.Property(e => e.SpecificDate).HasColumnName("specific_date");
                entity.Property(e => e.StartTime).HasColumnName("start_time");
                entity.Property(e => e.EndTime).HasColumnName("end_time");
                entity.Property(e => e.AvailabilityType).HasColumnName("availability_type");
                entity.Property(e => e.Reason).HasColumnName("reason");
                entity.Property(e => e.IsRecurring).HasColumnName("is_recurring");
                entity.Property(e => e.IsActive).HasColumnName("is_active");
                entity.Property(e => e.CreatedAt).HasColumnName("created_at");
                entity.Property(e => e.UpdatedAt).HasColumnName("updated_at");
                entity.Property(e => e.CreatedByUserId).HasColumnName("created_by_user_id");
                entity.Property(e => e.UpdatedByUserId).HasColumnName("updated_by_user_id");
            });

            builder.Entity<AppointmentConflict>(entity =>
            {
                entity.ToTable("appointment_conflicts");
                entity.Property(e => e.Id).HasColumnName("id").ValueGeneratedOnAdd();
                entity.Property(e => e.TenantId).HasColumnName("tenant_id");
                entity.Property(e => e.AppointmentId).HasColumnName("appointment_id");
                entity.Property(e => e.ConflictType).HasColumnName("conflict_type");
                entity.Property(e => e.ConflictingAppointmentId).HasColumnName("conflicting_appointment_id");
                entity.Property(e => e.ConflictMessage).HasColumnName("conflict_message");
                entity.Property(e => e.Severity).HasColumnName("severity");
                entity.Property(e => e.DetectedAt).HasColumnName("detected_at");
                entity.Property(e => e.ResolvedAt).HasColumnName("resolved_at");
                entity.Property(e => e.ResolutionNotes).HasColumnName("resolution_notes");
                entity.Property(e => e.CreatedAt).HasColumnName("created_at");
                entity.Property(e => e.UpdatedAt).HasColumnName("updated_at");
                entity.Property(e => e.Status).HasColumnName("status");
                
                // Configure ConflictingAppointment navigation (Appointment is configured from Appointment side)
                entity.HasOne(e => e.ConflictingAppointment)
                    .WithMany()
                    .HasForeignKey(e => e.ConflictingAppointmentId)
                    .OnDelete(DeleteBehavior.Restrict);
            });

            builder.Entity<AppointmentReminder>(entity =>
            {
                entity.ToTable("appointment_reminders");
                entity.Property(e => e.Id).HasColumnName("id").ValueGeneratedOnAdd();
                entity.Property(e => e.TenantId).HasColumnName("tenant_id");
                entity.Property(e => e.AppointmentId).HasColumnName("appointment_id");
                entity.Property(e => e.ReminderType).HasColumnName("reminder_type");
                entity.Property(e => e.ScheduledTime).HasColumnName("scheduled_time");
                entity.Property(e => e.SentAt).HasColumnName("sent_at");
                entity.Property(e => e.DeliveryStatus).HasColumnName("delivery_status");
                entity.Property(e => e.ErrorMessage).HasColumnName("error_message");
                entity.Property(e => e.RetryCount).HasColumnName("retry_count");
                entity.Property(e => e.CreatedAt).HasColumnName("created_at");
                entity.Property(e => e.UpdatedAt).HasColumnName("updated_at");
                entity.Property(e => e.Status).HasColumnName("status");
                // Navigation configured from Appointment side
            });

            builder.Entity<AppointmentStatistics>(entity =>
            {
                entity.ToTable("appointment_statistics");
                entity.Property(e => e.Id).HasColumnName("id").ValueGeneratedOnAdd();
                entity.Property(e => e.TenantId).HasColumnName("tenant_id");
                entity.Property(e => e.DateRangeStart).HasColumnName("date_range_start");
                entity.Property(e => e.DateRangeEnd).HasColumnName("date_range_end");
                entity.Property(e => e.DoctorId).HasColumnName("doctor_id");
                entity.Property(e => e.DepartmentId).HasColumnName("department_id");
                entity.Property(e => e.TotalAppointments).HasColumnName("total_appointments");
                entity.Property(e => e.CompletedAppointments).HasColumnName("completed_appointments");
                entity.Property(e => e.CancelledAppointments).HasColumnName("cancelled_appointments");
                entity.Property(e => e.NoShowAppointments).HasColumnName("no_show_appointments");
                entity.Property(e => e.AverageDurationMinutes).HasColumnName("average_duration_minutes");
                entity.Property(e => e.MostBookedTimeSlot).HasColumnName("most_booked_time_slot");
                entity.Property(e => e.UtilizationRate).HasColumnName("utilization_rate");
                entity.Property(e => e.CalculatedAt).HasColumnName("calculated_at");
                entity.Property(e => e.CreatedAt).HasColumnName("created_at");
                entity.Property(e => e.UpdatedAt).HasColumnName("updated_at");
            });

            builder.Entity<PatientDocumentUpload>(entity =>
            {
                entity.ToTable("patient_document_uploads");
                entity.Property(e => e.Id).HasColumnName("id").ValueGeneratedOnAdd();
                entity.Property(e => e.TenantId).HasColumnName("tenant_id");
                entity.Property(e => e.PatientId).HasColumnName("patient_id");
                entity.Property(e => e.DocumentType).HasColumnName("document_type");
                entity.Property(e => e.DocumentTitle).HasColumnName("document_title");
                entity.Property(e => e.FileUrl).HasColumnName("file_url");
                entity.Property(e => e.FileSize).HasColumnName("file_size");
                entity.Property(e => e.MimeType).HasColumnName("mime_type");
                entity.Property(e => e.UploadedBy).HasColumnName("uploaded_by");
                entity.Property(e => e.UploadedAt).HasColumnName("uploaded_at");
                entity.Property(e => e.SharedToDepartments).HasColumnName("shared_to_departments");
                entity.Property(e => e.SharedToRoles).HasColumnName("shared_to_roles");
                entity.Property(e => e.IsPublic).HasColumnName("is_public");
                entity.Property(e => e.DataClassification).HasColumnName("data_classification");
                entity.Property(e => e.RetentionDays).HasColumnName("retention_days");
                entity.Property(e => e.Status).HasColumnName("status");
                entity.Property(e => e.CreatedAt).HasColumnName("created_at");
                entity.Property(e => e.CreatedByUserId).HasColumnName("created_by_user_id");
                entity.Property(e => e.UpdatedAt).HasColumnName("updated_at");
                entity.Property(e => e.UpdatedByUserId).HasColumnName("updated_by_user_id");
                entity.Property(e => e.DeletedAt).HasColumnName("deleted_at");
                entity.Property(e => e.DeletedByUserId).HasColumnName("deleted_by_user_id");
                entity.HasIndex(e => new { e.TenantId, e.PatientId });
            });

            builder.Entity<CanonicalDocument>(entity =>
            {
                entity.ToTable("canonical_documents");
                entity.HasKey(e => e.Id);
                entity.Property(e => e.Id).HasColumnName("id");
                entity.Property(e => e.TenantId).HasColumnName("tenant_id");
                entity.Property(e => e.PatientId).HasColumnName("patient_id");
                entity.Property(e => e.StorageBackend).HasColumnName("storage_backend");
                entity.Property(e => e.StorageContainer).HasColumnName("storage_container");
                entity.Property(e => e.StorageObjectKey).HasColumnName("storage_object_key");
                entity.Property(e => e.FileName).HasColumnName("file_name");
                entity.Property(e => e.MimeType).HasColumnName("mime_type");
                entity.Property(e => e.SizeBytes).HasColumnName("size_bytes");
                entity.Property(e => e.ContentHash).HasColumnName("content_hash");
                entity.Property(e => e.Classification).HasColumnName("classification");
                entity.Property(e => e.Status).HasColumnName("status");
                entity.Property(e => e.CreatedByUserId).HasColumnName("created_by_user_id");
                entity.Property(e => e.CreatedAt).HasColumnName("created_at");
                entity.Property(e => e.DeletedAt).HasColumnName("deleted_at");
                entity.Property(e => e.SupersededByDocumentId).HasColumnName("superseded_by_document_id");
                entity.HasIndex(e => new { e.TenantId, e.PatientId });
                entity.HasIndex(e => new { e.TenantId, e.PatientId, e.ContentHash });
                entity.HasMany(e => e.Associations)
                    .WithOne(a => a.Document)
                    .HasForeignKey(a => a.DocumentId);
            });

            builder.Entity<CanonicalDocumentAssociation>(entity =>
            {
                entity.ToTable("canonical_document_associations");
                entity.HasKey(e => e.Id);
                entity.Property(e => e.Id).HasColumnName("id");
                entity.Property(e => e.DocumentId).HasColumnName("document_id");
                entity.Property(e => e.Domain).HasColumnName("domain");
                entity.Property(e => e.EntityType).HasColumnName("entity_type");
                entity.Property(e => e.EntityId).HasColumnName("entity_id");
                entity.Property(e => e.Category).HasColumnName("category");
                entity.Property(e => e.Role).HasColumnName("role");
                entity.Property(e => e.CreatedByUserId).HasColumnName("created_by_user_id");
                entity.Property(e => e.CreatedAt).HasColumnName("created_at");
                entity.HasIndex(e => new { e.DocumentId, e.Domain, e.EntityType, e.EntityId }).IsUnique();
                entity.HasIndex(e => new { e.Domain, e.EntityType, e.EntityId });
            });

            builder.Entity<DocumentAccessAudit>(entity =>
            {
                entity.ToTable("document_access_audit");
                entity.Property(e => e.Id).HasColumnName("id").ValueGeneratedOnAdd();
                entity.Property(e => e.TenantId).HasColumnName("tenant_id");
                entity.Property(e => e.UserId).HasColumnName("user_id");
                entity.Property(e => e.UserEmail).HasColumnName("user_email");
                entity.Property(e => e.UserRole).HasColumnName("user_role");
                entity.Property(e => e.DocumentId).HasColumnName("document_id");
                entity.Property(e => e.DocumentType).HasColumnName("document_type");
                entity.Property(e => e.DocumentTitle).HasColumnName("document_title");
                entity.Property(e => e.PatientId).HasColumnName("patient_id");
                entity.Property(e => e.Action).HasColumnName("action");
                entity.Property(e => e.ActionResult).HasColumnName("action_result");
                entity.Property(e => e.AccessGranted).HasColumnName("access_granted");
                entity.Property(e => e.DenialReason).HasColumnName("denial_reason");
                entity.Property(e => e.PermissionUsed).HasColumnName("permission_used");
                entity.Property(e => e.IpAddress).HasColumnName("ip_address");
                entity.Property(e => e.UserAgent).HasColumnName("user_agent");
                entity.Property(e => e.RequestPath).HasColumnName("request_path");
                entity.Property(e => e.RequestMethod).HasColumnName("request_method");
                entity.Property(e => e.ResponseTimeMs).HasColumnName("response_time_ms");
                entity.Property(e => e.AccessedAt).HasColumnName("accessed_at");
                entity.HasIndex(e => new { e.TenantId, e.UserId, e.AccessedAt });
            });

            builder.Entity<ActivationAuditLog>(entity =>
            {
                entity.ToTable("activation_audit_log");
                entity.Property(e => e.Id).HasColumnName("id").ValueGeneratedOnAdd();
                entity.Property(e => e.TenantId).HasColumnName("tenant_id");
                entity.Property(e => e.UserId).HasColumnName("user_id");
                entity.Property(e => e.ActivationStep).HasColumnName("activation_step").HasMaxLength(50);
                entity.Property(e => e.Status).HasColumnName("status").HasMaxLength(20);
                entity.Property(e => e.ErrorMessage).HasColumnName("error_message");
                entity.Property(e => e.IpAddress).HasColumnName("ip_address").HasMaxLength(45);
                entity.Property(e => e.UserAgent).HasColumnName("user_agent");
                entity.Property(e => e.DeviceInfo).HasColumnName("device_info");
                entity.Property(e => e.GeolocationInfo).HasColumnName("geolocation_info");
                entity.Property(e => e.Timestamp).HasColumnName("timestamp");
                entity.Property(e => e.CompletedAt).HasColumnName("completed_at");
                entity.Property(e => e.RequestData).HasColumnName("request_data");
                entity.Property(e => e.ResponseData).HasColumnName("response_data");
                entity.Property(e => e.ResponseTimeMs).HasColumnName("response_time_ms");
                entity.Property(e => e.SuspiciousActivity).HasColumnName("suspicious_activity").HasDefaultValue(false);
                entity.Property(e => e.ComplianceNotes).HasColumnName("compliance_notes");
                entity.Property(e => e.CreatedAt).HasColumnName("created_at");
                entity.HasIndex(e => new { e.TenantId, e.UserId });
                entity.HasIndex(e => e.Timestamp);
            });

            builder.Entity<AdminConfiguration>(entity =>
            {
                entity.ToTable("admin_configurations");
                entity.Property(e => e.Id).HasColumnName("id").ValueGeneratedOnAdd();
                entity.Property(e => e.TenantId).HasColumnName("tenant_id");
                entity.Property(e => e.ConfigKey).HasColumnName("config_key");
                entity.Property(e => e.ConfigValue).HasColumnName("config_value");
                entity.Property(e => e.ConfigType).HasColumnName("config_type");
                entity.Property(e => e.ConfigCategory).HasColumnName("config_category");
                entity.Property(e => e.Description).HasColumnName("description");
                entity.Property(e => e.DisplayName).HasColumnName("display_name");
                entity.Property(e => e.EditableByRoles).HasColumnName("editable_by_roles");
                entity.Property(e => e.VisibleToRoles).HasColumnName("visible_to_roles");
                entity.Property(e => e.IsSystemConfig).HasColumnName("is_system_config");
                entity.Property(e => e.IsSensitive).HasColumnName("is_sensitive");
                entity.Property(e => e.ValidationRules).HasColumnName("validation_rules");
                entity.Property(e => e.AllowedValues).HasColumnName("allowed_values");
                entity.Property(e => e.MinValue).HasColumnName("min_value");
                entity.Property(e => e.MaxValue).HasColumnName("max_value");
                entity.Property(e => e.PreviousValue).HasColumnName("previous_value");
                entity.Property(e => e.ChangeReason).HasColumnName("change_reason");
                entity.Property(e => e.RequiresRestart).HasColumnName("requires_restart");
                entity.Property(e => e.Status).HasColumnName("status");
                entity.Property(e => e.CreatedAt).HasColumnName("created_at");
                entity.Property(e => e.CreatedByUserId).HasColumnName("created_by_user_id");
                entity.Property(e => e.UpdatedAt).HasColumnName("updated_at");
                entity.Property(e => e.UpdatedByUserId).HasColumnName("updated_by_user_id");
                entity.Property(e => e.DeletedAt).HasColumnName("deleted_at");
                entity.Property(e => e.DeletedByUserId).HasColumnName("deleted_by_user_id");
                entity.HasIndex(e => new { e.TenantId, e.ConfigKey }).IsUnique();
            });

            // UserDepartment Entity Configuration (department_access table - Migration 03)
            builder.Entity<UserDepartment>(entity =>
            {
                entity.ToTable("department_access");
                entity.HasKey(e => e.Id);
                entity.Property(e => e.Id).HasColumnName("id");
                entity.Property(e => e.TenantId).HasColumnName("tenant_id").IsRequired();
                entity.Property(e => e.UserId).HasColumnName("user_id").IsRequired();
                entity.Property(e => e.DepartmentId).HasColumnName("department_id").IsRequired();
                entity.Property(e => e.BranchId).HasColumnName("branch_id");
                entity.Property(e => e.AccessType).HasColumnName("access_type").HasMaxLength(20).HasDefaultValue("Secondary");
                // IsPrimary is computed from AccessType == 'Primary' - not a database column
                
                // Granular Permissions (Migration 03)
                entity.Property(e => e.CanView).HasColumnName("can_view").HasDefaultValue(true);
                entity.Property(e => e.CanCreate).HasColumnName("can_create").HasDefaultValue(false);
                entity.Property(e => e.CanEdit).HasColumnName("can_edit").HasDefaultValue(false);
                entity.Property(e => e.CanDelete).HasColumnName("can_delete").HasDefaultValue(false);
                entity.Property(e => e.CanApprove).HasColumnName("can_approve").HasDefaultValue(false);
                entity.Property(e => e.CanExport).HasColumnName("can_export").HasDefaultValue(false);
                
                // Time-bound Access
                entity.Property(e => e.AccessStartDate).HasColumnName("access_start_date");
                entity.Property(e => e.AccessEndDate).HasColumnName("access_end_date");
                
                // Approval Workflow
                entity.Property(e => e.ApprovedBy).HasColumnName("approved_by");
                entity.Property(e => e.ApprovedAt).HasColumnName("approved_at");
                entity.Property(e => e.ApprovalNotes).HasColumnName("approval_notes").HasMaxLength(500);
                
                // Audit Columns (match migration 03 schema)
                entity.Property(e => e.Status).HasColumnName("status").HasMaxLength(50).HasDefaultValue("Active");
                entity.Property(e => e.IsActive).HasColumnName("is_active").HasDefaultValue(true);
                entity.Property(e => e.CreatedAt).HasColumnName("created_at").HasDefaultValueSql("NOW()");
                entity.Property(e => e.CreatedBy).HasColumnName("created_by");
                entity.Property(e => e.UpdatedAt).HasColumnName("updated_at");
                entity.Property(e => e.UpdatedBy).HasColumnName("updated_by");
                entity.Property(e => e.DeletedAt).HasColumnName("deleted_at");
                entity.Property(e => e.RevokedBy).HasColumnName("deleted_by");
                
                // Indexes
                entity.HasIndex(e => new { e.TenantId, e.UserId, e.DepartmentId });
                entity.HasIndex(e => e.DepartmentId);
                entity.HasIndex(e => e.BranchId);
            });

            // UserBranch Entity Configuration (Many-to-Many: User <-> Branch)
            builder.Entity<UserBranch>(entity =>
            {
                entity.ToTable("user_branches");
                entity.HasKey(e => e.Id);
                entity.Property(e => e.Id).HasColumnName("id");
                entity.Property(e => e.TenantId).HasColumnName("tenant_id").IsRequired();
                entity.Property(e => e.UserId).HasColumnName("user_id").IsRequired();
                entity.Property(e => e.BranchId).HasColumnName("branch_id").IsRequired();
                entity.Property(e => e.IsDefault).HasColumnName("is_default").HasDefaultValue(false);
                entity.Property(e => e.AssignedAt).HasColumnName("assigned_at");
                entity.Property(e => e.AssignedByUserId).HasColumnName("assigned_by_user_id");
                entity.Property(e => e.EffectiveFrom).HasColumnName("effective_from");
                entity.Property(e => e.EffectiveUntil).HasColumnName("effective_until");
                entity.Property(e => e.Status).HasColumnName("status").HasMaxLength(20).HasDefaultValue("active");
                entity.Property(e => e.Notes).HasColumnName("notes");
                entity.Property(e => e.CreatedAt).HasColumnName("created_at");
                entity.Property(e => e.CreatedByUserId).HasColumnName("created_by_user_id");
                entity.Property(e => e.UpdatedAt).HasColumnName("updated_at");
                entity.Property(e => e.UpdatedByUserId).HasColumnName("updated_by_user_id");
                entity.HasIndex(e => new { e.TenantId, e.UserId, e.BranchId });
                entity.HasIndex(e => e.BranchId);
            });

            // ============================================================================
            // EMPLOYMENT MANAGEMENT TABLES (Phase 1 - HR Features)
            // ============================================================================
            builder.Entity<EmploymentTypeLookup>(entity =>
            {
                entity.ToTable("employment_type_lookup");
                entity.Property(e => e.Id).HasColumnName("id");
                entity.Property(e => e.TypeCode).HasColumnName("type_code");
                entity.Property(e => e.TypeName).HasColumnName("type_name");
                entity.Property(e => e.Description).HasColumnName("description");
                entity.Property(e => e.IsActive).HasColumnName("is_active");
                entity.Property(e => e.DisplayOrder).HasColumnName("display_order");
                entity.Property(e => e.CreatedAt).HasColumnName("created_at");
                entity.Property(e => e.CreatedByUserId).HasColumnName("created_by_user_id");
            });

            builder.Entity<EmploymentCategoryLookup>(entity =>
            {
                entity.ToTable("employment_category_lookup");
                entity.Property(e => e.Id).HasColumnName("id");
                entity.Property(e => e.CategoryCode).HasColumnName("category_code");
                entity.Property(e => e.CategoryName).HasColumnName("category_name");
                entity.Property(e => e.Description).HasColumnName("description");
                entity.Property(e => e.IsActive).HasColumnName("is_active");
                entity.Property(e => e.DisplayOrder).HasColumnName("display_order");
                entity.Property(e => e.CreatedAt).HasColumnName("created_at");
                entity.Property(e => e.CreatedByUserId).HasColumnName("created_by_user_id");
            });

            builder.Entity<Employee>(entity =>
            {
                entity.ToTable("employee");
                
                // Core Fields (EXIST in database)
                entity.Property(e => e.Id).HasColumnName("id");
                entity.Property(e => e.TenantId).HasColumnName("tenant_id");
                entity.Property(e => e.UserId).HasColumnName("user_id");
                entity.Property(e => e.EmployeeNumber).HasColumnName("employee_number");
                entity.Property(e => e.HireDate).HasColumnName("hire_date");
                entity.Property(e => e.JobTitle).HasColumnName("job_title");
                entity.Property(e => e.DepartmentId).HasColumnName("department_id");
                entity.Property(e => e.ManagerId).HasColumnName("manager_id");
                
                // Note: DB has employment_type as text column, not employment_type_id FK
                // Ignoring EmploymentTypeId since it doesn't exist in DB
                entity.Ignore(e => e.EmploymentTypeId);
                entity.Ignore(e => e.EmploymentType);
                
                // Emergency Contact (EXIST in database)
                entity.Property(e => e.EmergencyContactName).HasColumnName("emergency_contact_name");
                entity.Property(e => e.EmergencyContactRelationship).HasColumnName("emergency_contact_relationship");
                entity.Property(e => e.EmergencyContactPhone).HasColumnName("emergency_contact_phone");
                
                // Compensation & Benefits (EXIST in database)
                entity.Property(e => e.SalaryGrade).HasColumnName("salary_grade");
                entity.Property(e => e.BaseSalary).HasColumnName("base_salary");
                entity.Property(e => e.BenefitsPackage).HasColumnName("benefits_package"); // JSONB
                
                // Work Schedule (EXIST in database)
                entity.Property(e => e.WorkSchedule).HasColumnName("work_schedule"); // JSONB
                
                // Audit Fields (EXIST in database)
                entity.Property(e => e.Status).HasColumnName("status");
                entity.Property(e => e.CreatedAt).HasColumnName("created_at");
                entity.Property(e => e.UpdatedAt).HasColumnName("updated_at");
                entity.Property(e => e.DeletedAt).HasColumnName("deleted_at");
                entity.Property(e => e.CreatedByUserId).HasColumnName("created_by_user_id");
                entity.Property(e => e.UpdatedByUserId).HasColumnName("updated_by_user_id");
                
                // IGNORE - These columns do NOT exist in current database
                entity.Ignore(e => e.BranchId);
                entity.Ignore(e => e.Branch);
                entity.Ignore(e => e.EmploymentStatus);
                entity.Ignore(e => e.ProbationEndDate);
                entity.Ignore(e => e.ConfirmationDate);
                entity.Ignore(e => e.ContractEndDate);
                entity.Ignore(e => e.ResignationDate);
                entity.Ignore(e => e.TerminationDate);
                entity.Ignore(e => e.LastWorkingDate);
                entity.Ignore(e => e.EmergencyContactEmail);
                entity.Ignore(e => e.EmergencyContactAddress);
                entity.Ignore(e => e.Currency);
                entity.Ignore(e => e.PayrollFrequency);
                entity.Ignore(e => e.BankAccountNumber);
                entity.Ignore(e => e.BankName);
                entity.Ignore(e => e.BankBranch);
                entity.Ignore(e => e.TaxId);
                entity.Ignore(e => e.WeeklyHours);
                entity.Ignore(e => e.ShiftPattern);
                entity.Ignore(e => e.MaritalStatus);
                entity.Ignore(e => e.DependentsCount);
                entity.Ignore(e => e.BloodGroup);
                entity.Ignore(e => e.Allergies);
                entity.Ignore(e => e.MedicalConditions);
                entity.Ignore(e => e.DeletedByUserId);
                
                // Navigation Properties
                entity.HasOne(e => e.User).WithMany().HasForeignKey(e => e.UserId);
                entity.HasOne(e => e.Department).WithMany().HasForeignKey(e => e.DepartmentId);
                
                // Indexes
                entity.HasIndex(e => e.TenantId);
                entity.HasIndex(e => e.EmployeeNumber);
            });

            builder.Entity<EmploymentContract>(entity =>
            {
                entity.ToTable("employment_contract");
                entity.Property(e => e.Id).HasColumnName("id");
                entity.Property(e => e.TenantId).HasColumnName("tenant_id");
                entity.Property(e => e.EmployeeId).HasColumnName("employee_id");
                entity.Property(e => e.ContractType).HasColumnName("contract_type");
                entity.Property(e => e.StartDate).HasColumnName("start_date");
                entity.Property(e => e.EndDate).HasColumnName("end_date");
                entity.Property(e => e.ContractTerms).HasColumnName("contract_terms");
                entity.Property(e => e.DocumentUrl).HasColumnName("document_url");
                entity.Property(e => e.AutoRenewal).HasColumnName("auto_renewal");
                entity.Property(e => e.RenewalNoticeDays).HasColumnName("renewal_notice_days");
                entity.Property(e => e.RenewalStatus).HasColumnName("renewal_status");
                entity.Property(e => e.CreatedAt).HasColumnName("created_at");
                entity.Property(e => e.UpdatedAt).HasColumnName("updated_at");
                entity.Property(e => e.CreatedByUserId).HasColumnName("created_by_user_id");
                entity.Property(e => e.UpdatedByUserId).HasColumnName("updated_by_user_id");
                entity.Property(e => e.DeletedAt).HasColumnName("deleted_at");
                entity.Property(e => e.DeletedByUserId).HasColumnName("deleted_by_user_id");
                entity.Property(e => e.Status).HasColumnName("status");
                
                entity.HasOne(e => e.Employee).WithMany().HasForeignKey(e => e.EmployeeId);
                entity.HasIndex(e => e.TenantId);
            });

            builder.Entity<ProfessionalLicense>(entity =>
            {
                entity.ToTable("professional_license");
                entity.Property(e => e.Id).HasColumnName("id");
                entity.Property(e => e.TenantId).HasColumnName("tenant_id");
                entity.Property(e => e.UserId).HasColumnName("user_id");
                entity.Property(e => e.LicenseType).HasColumnName("license_type");
                entity.Property(e => e.LicenseCategory).HasColumnName("license_category");
                entity.Property(e => e.LicenseNumber).HasColumnName("license_number");
                entity.Property(e => e.IssuingAuthority).HasColumnName("issuing_authority");
                entity.Property(e => e.IssuingCountry).HasColumnName("issuing_country");
                entity.Property(e => e.IssuingState).HasColumnName("issuing_state");
                entity.Property(e => e.IssueDate).HasColumnName("issue_date");
                entity.Property(e => e.ExpiryDate).HasColumnName("expiry_date");
                entity.Ignore(e => e.RenewalDate); // Column doesn't exist in DB
                entity.Ignore(e => e.RenewalReminderDays); // Column doesn't exist in DB
                entity.Ignore(e => e.LastReminderSentAt); // Column doesn't exist in DB
                entity.Ignore(e => e.RenewalStatus); // Column doesn't exist in DB
                entity.Property(e => e.VerificationStatus).HasColumnName("verification_status");
                entity.Property(e => e.VerifiedAt).HasColumnName("verified_at");
                entity.Property(e => e.VerifiedByUserId).HasColumnName("verified_by_user_id");
                entity.Property(e => e.VerificationNotes).HasColumnName("verification_notes");
                entity.Property(e => e.DocumentUrl).HasColumnName("document_url");
                entity.Property(e => e.RenewalDocumentUrl).HasColumnName("renewal_document_url");
                entity.Property(e => e.ScopeOfPractice).HasColumnName("scope_of_practice");
                entity.Property(e => e.Restrictions).HasColumnName("restrictions");
                entity.Property(e => e.Specializations).HasColumnName("specializations");
                entity.Property(e => e.CreatedAt).HasColumnName("created_at");
                entity.Property(e => e.UpdatedAt).HasColumnName("updated_at");
                entity.Property(e => e.CreatedByUserId).HasColumnName("created_by_user_id");
                entity.Property(e => e.UpdatedByUserId).HasColumnName("updated_by_user_id");
                entity.Property(e => e.DeletedAt).HasColumnName("deleted_at");
                entity.Ignore(e => e.DeletedByUserId); // Database column doesn't exist
                entity.Property(e => e.Status).HasColumnName("status");
                
                entity.Ignore(e => e.DaysUntilExpiry); // Computed property
                entity.HasOne(e => e.User).WithMany().HasForeignKey(e => e.UserId);
                entity.HasOne(e => e.VerifiedByUser).WithMany().HasForeignKey(e => e.VerifiedByUserId);
                entity.HasIndex(e => e.TenantId);
                entity.HasIndex(e => e.ExpiryDate);
                entity.HasIndex(e => e.VerificationStatus);
            });

            builder.Entity<ProbationTracking>(entity =>
            {
                entity.ToTable("probation_tracking");
                entity.Property(e => e.Id).HasColumnName("id");
                entity.Property(e => e.TenantId).HasColumnName("tenant_id");
                entity.Property(e => e.EmployeeId).HasColumnName("employee_id");
                entity.Property(e => e.ProbationStartDate).HasColumnName("probation_start_date");
                entity.Property(e => e.ProbationEndDate).HasColumnName("probation_end_date");
                entity.Property(e => e.ProbationStatus).HasColumnName("probation_status");
                entity.Property(e => e.ConfirmationDate).HasColumnName("confirmation_date");
                entity.Property(e => e.ReviewedByUserId).HasColumnName("reviewed_by_user_id");
                entity.Property(e => e.ReviewNotes).HasColumnName("review_notes");
                entity.Property(e => e.ExtensionDays).HasColumnName("extension_days");
                entity.Property(e => e.CreatedAt).HasColumnName("created_at");
                entity.Property(e => e.UpdatedAt).HasColumnName("updated_at");
                entity.Property(e => e.CreatedByUserId).HasColumnName("created_by_user_id");
                entity.Property(e => e.UpdatedByUserId).HasColumnName("updated_by_user_id");
                entity.Property(e => e.DeletedAt).HasColumnName("deleted_at");
                entity.Property(e => e.DeletedByUserId).HasColumnName("deleted_by_user_id");
                entity.Property(e => e.Status).HasColumnName("status");
                
                entity.HasOne(e => e.Employee).WithMany().HasForeignKey(e => e.EmployeeId);
                entity.HasOne(e => e.ReviewedBy).WithMany().HasForeignKey(e => e.ReviewedByUserId);
                entity.HasIndex(e => e.TenantId);
            });

            builder.Entity<AuthService.Models.BulkOperations.BulkOperationJob>(entity =>
            {
                entity.ToTable("bulk_operation_job");
                entity.Property(e => e.Id).HasColumnName("id");
                entity.Property(e => e.TenantId).HasColumnName("tenant_id");
                entity.Property(e => e.OperationType).HasColumnName("operation_type");
                entity.Property(e => e.EntityType).HasColumnName("entity_type");
                entity.Property(e => e.TotalItems).HasColumnName("total_records");
                entity.Property(e => e.ProcessedItems).HasColumnName("processed_records");
                entity.Property(e => e.SuccessCount).HasColumnName("successful_records");
                entity.Property(e => e.FailureCount).HasColumnName("failed_records");
                entity.Property(e => e.Status).HasColumnName("status");
                entity.Property(e => e.StartedAt).HasColumnName("started_at");
                entity.Property(e => e.CompletedAt).HasColumnName("completed_at");
                entity.Property(e => e.ResultFilePath).HasColumnName("output_file_url");
                entity.Property(e => e.CreatedBy).HasColumnName("created_by_user_id");
                entity.Property(e => e.CreatedAt).HasColumnName("created_at");
                
                entity.HasIndex(e => e.TenantId);
                entity.HasIndex(e => e.Status);
                entity.HasIndex(e => e.OperationType);
                entity.HasIndex(e => e.CreatedAt);
            });

            // ============================================================================
            // ROW-LEVEL SECURITY FILTERS (TEMPORARILY DISABLED FOR TESTING)
            // ============================================================================
            // Enable Row-Level Security filters
            // TEMPORARILY DISABLED FOR TESTING
            // builder.Entity<AppUser>().HasQueryFilter(u => u.TenantId == GetCurrentTenantId());
            // builder.Entity<AppRole>().HasQueryFilter(r => r.TenantId == GetCurrentTenantId());
            // builder.Entity<Permission>().HasQueryFilter(p => p.TenantId == GetCurrentTenantId());
            // builder.Entity<Branch>().HasQueryFilter(b => b.TenantId == GetCurrentTenantId());
            // builder.Entity<Organization>().HasQueryFilter(o => o.TenantId == GetCurrentTenantId());
            // builder.Entity<Department>().HasQueryFilter(d => d.TenantId == GetCurrentTenantId());
            // builder.Entity<UserDepartment>().HasQueryFilter(ud => ud.TenantId == GetCurrentTenantId());
            // builder.Entity<UserBranch>().HasQueryFilter(ub => ub.TenantId == GetCurrentTenantId());
            // builder.Entity<PatientDocumentUpload>().HasQueryFilter(d => d.TenantId == GetCurrentTenantId());
            // builder.Entity<DocumentAccessAudit>().HasQueryFilter(a => a.TenantId == GetCurrentTenantId());
            // builder.Entity<AdminConfiguration>().HasQueryFilter(c => c.TenantId == GetCurrentTenantId());
            
            // ============================================================================
            // DEVICE & SESSION MANAGEMENT (Tasks 7-12)
            // ============================================================================
            
            builder.Entity<Device>(entity =>
            {
                entity.ToTable("device");
                entity.HasKey(e => e.Id);
                entity.Property(e => e.Id).HasColumnName("id");
                entity.Property(e => e.TenantId).HasColumnName("tenant_id").IsRequired();
                entity.Property(e => e.UserId).HasColumnName("user_id").IsRequired();
                entity.Property(e => e.DeviceId).HasColumnName("device_id").HasMaxLength(255).IsRequired();
                entity.Property(e => e.DeviceName).HasColumnName("device_name").HasMaxLength(200);
                entity.Property(e => e.DeviceType).HasColumnName("device_type").HasMaxLength(50);
                entity.Property(e => e.OS).HasColumnName("operating_system").HasMaxLength(100);
                entity.Property(e => e.Browser).HasColumnName("browser").HasMaxLength(100);
                entity.Property(e => e.IPAddress).HasColumnName("ip_address").HasMaxLength(45);
                entity.Property(e => e.Location).HasColumnName("location").HasMaxLength(200);
                entity.Property(e => e.TrustLevel).HasColumnName("trust_level").HasMaxLength(20).HasDefaultValue("Untrusted");
                entity.Property(e => e.IsBlocked).HasColumnName("is_blocked").HasDefaultValue(false);
                entity.Property(e => e.BlockReason).HasColumnName("block_reason").HasMaxLength(500);
                entity.Property(e => e.IsPrimaryDevice).HasColumnName("is_primary_device").HasDefaultValue(false);
                entity.Property(e => e.RegisteredAt).HasColumnName("registered_at");
                entity.Property(e => e.LastSeenAt).HasColumnName("last_seen_at");
                entity.Property(e => e.LastLoginAt).HasColumnName("last_login_at");
                entity.Property(e => e.TotalLogins).HasColumnName("total_logins").HasDefaultValue(0);
                entity.Property(e => e.Status).HasColumnName("status").HasMaxLength(20).HasDefaultValue("active");
                entity.Property(e => e.CreatedAt).HasColumnName("created_at");
                entity.Property(e => e.UpdatedAt).HasColumnName("updated_at");
                entity.Property(e => e.DeletedAt).HasColumnName("deleted_at");
                
                entity.HasIndex(e => e.DeviceId);
                entity.HasIndex(e => new { e.UserId, e.IsBlocked });
                entity.HasIndex(e => new { e.TenantId, e.UserId });
            });
            
            builder.Entity<UserSession>(entity =>
            {
                entity.ToTable("user_session");
                entity.HasKey(e => e.Id);
                entity.Property(e => e.Id).HasColumnName("id");
                entity.Property(e => e.TenantId).HasColumnName("tenant_id").IsRequired();
                entity.Property(e => e.UserId).HasColumnName("user_id").IsRequired();
                entity.Property(e => e.DeviceId).HasColumnName("device_id");
                entity.Property(e => e.SessionId).HasColumnName("session_id").HasMaxLength(255).IsRequired();
                entity.Property(e => e.TokenId).HasColumnName("token_id").HasMaxLength(255);
                entity.Property(e => e.RefreshToken).HasColumnName("refresh_token").HasMaxLength(500);
                entity.Property(e => e.LoginTime).HasColumnName("login_time");
                entity.Property(e => e.LastActivityTime).HasColumnName("last_activity_time");
                entity.Property(e => e.ExpiresAt).HasColumnName("expires_at");
                entity.Property(e => e.LogoutTime).HasColumnName("logout_time");
                entity.Property(e => e.IsActive).HasColumnName("is_active").HasDefaultValue(true);
                entity.Property(e => e.IPAddress).HasColumnName("ip_address").HasMaxLength(45);
                entity.Property(e => e.UserAgent).HasColumnName("user_agent").HasMaxLength(500);
                entity.Property(e => e.Location).HasColumnName("location").HasMaxLength(200);
                entity.Property(e => e.SessionType).HasColumnName("session_type").HasMaxLength(20).HasDefaultValue("Web");
                entity.Property(e => e.LoginMethod).HasColumnName("login_method").HasMaxLength(50);
                entity.Property(e => e.SuspiciousActivity).HasColumnName("suspicious_activity").HasDefaultValue(false);
                entity.Property(e => e.TerminationReason).HasColumnName("termination_reason").HasMaxLength(200);
                entity.Property(e => e.TerminatedBy).HasColumnName("terminated_by");
                entity.Property(e => e.CreatedAt).HasColumnName("created_at");
                entity.Property(e => e.UpdatedAt).HasColumnName("updated_at");
                
                entity.HasIndex(e => e.SessionId);
                entity.HasIndex(e => new { e.UserId, e.IsActive });
                entity.HasIndex(e => e.ExpiresAt);
                entity.HasIndex(e => new { e.TenantId, e.UserId });
            });
            
            builder.Entity<AccessPolicy>(entity =>
            {
                entity.ToTable("access_policy");
                entity.HasKey(e => e.Id);
                entity.Property(e => e.Id).HasColumnName("id");
                entity.Property(e => e.TenantId).HasColumnName("tenant_id").IsRequired();
                entity.Property(e => e.PolicyName).HasColumnName("policy_name").HasMaxLength(200).IsRequired();
                entity.Property(e => e.PolicyCode).HasColumnName("policy_code").HasMaxLength(100);
                entity.Property(e => e.PolicyType).HasColumnName("policy_type").HasMaxLength(50).IsRequired();
                entity.Property(e => e.Description).HasColumnName("description").HasMaxLength(500);
                entity.Property(e => e.Conditions).HasColumnName("conditions").HasColumnType("jsonb");
                entity.Property(e => e.Actions).HasColumnName("actions").HasColumnType("jsonb");
                entity.Property(e => e.Resources).HasColumnName("resources").HasColumnType("jsonb");
                entity.Property(e => e.Effect).HasColumnName("effect").HasMaxLength(10).HasDefaultValue("Deny");
                entity.Property(e => e.Priority).HasColumnName("priority").HasDefaultValue(100);
                entity.Property(e => e.AppliesToRoles).HasColumnName("applies_to_roles").HasColumnType("jsonb");
                entity.Property(e => e.AppliesToDepartments).HasColumnName("applies_to_departments").HasColumnType("jsonb");
                entity.Property(e => e.AppliesToUsers).HasColumnName("applies_to_users").HasColumnType("jsonb");
                entity.Property(e => e.EffectiveFrom).HasColumnName("effective_from");
                entity.Property(e => e.EffectiveUntil).HasColumnName("effective_until");
                entity.Property(e => e.TimeOfDayStart).HasColumnName("time_of_day_start");
                entity.Property(e => e.TimeOfDayEnd).HasColumnName("time_of_day_end");
                entity.Property(e => e.DaysOfWeek).HasColumnName("days_of_week").HasMaxLength(100);
                entity.Property(e => e.IsSystemPolicy).HasColumnName("is_system_policy").HasDefaultValue(false);
                entity.Property(e => e.IsActive).HasColumnName("is_active").HasDefaultValue(true);
                entity.Property(e => e.EvaluationCount).HasColumnName("evaluation_count").HasDefaultValue(0);
                entity.Property(e => e.LastEvaluatedAt).HasColumnName("last_evaluated_at");
                entity.Property(e => e.Status).HasColumnName("status").HasMaxLength(20).HasDefaultValue("active");
                entity.Property(e => e.CreatedAt).HasColumnName("created_at");
                entity.Property(e => e.CreatedBy).HasColumnName("created_by_user_id");
                entity.Property(e => e.UpdatedAt).HasColumnName("updated_at");
                entity.Property(e => e.UpdatedBy).HasColumnName("updated_by_user_id");
                entity.Property(e => e.DeletedAt).HasColumnName("deleted_at");
                
                entity.HasIndex(e => e.PolicyCode);
                entity.HasIndex(e => new { e.TenantId, e.IsActive });
                entity.HasIndex(e => e.Priority);
            });
            
            builder.Entity<EmergencyAccess>(entity =>
            {
                entity.ToTable("emergency_access");
                entity.HasKey(e => e.Id);
                entity.Property(e => e.Id).HasColumnName("id");
                entity.Property(e => e.TenantId).HasColumnName("tenant_id").IsRequired();
                entity.Property(e => e.UserId).HasColumnName("user_id").IsRequired();
                entity.Property(e => e.AccessCode).HasColumnName("access_code").HasMaxLength(50);
                entity.Property(e => e.Reason).HasColumnName("reason").HasMaxLength(1000).IsRequired();
                entity.Property(e => e.EmergencyType).HasColumnName("emergency_type").HasMaxLength(100);
                entity.Property(e => e.PatientId).HasColumnName("patient_id");
                entity.Property(e => e.GrantedPermissions).HasColumnName("granted_permissions").HasColumnType("jsonb");
                entity.Property(e => e.Scope).HasColumnName("scope").HasMaxLength(50).HasDefaultValue("Limited");
                entity.Property(e => e.StartTime).HasColumnName("start_time");
                entity.Property(e => e.EndTime).HasColumnName("end_time");
                entity.Property(e => e.DurationMinutes).HasColumnName("duration_minutes").HasDefaultValue(60);
                entity.Property(e => e.AutoRevokeEnabled).HasColumnName("auto_revoke_enabled").HasDefaultValue(true);
                entity.Property(e => e.RequiresApproval).HasColumnName("requires_approval").HasDefaultValue(true);
                entity.Property(e => e.ApprovedBy).HasColumnName("approved_by");
                entity.Property(e => e.ApprovedAt).HasColumnName("approved_at");
                entity.Property(e => e.ApprovalNotes).HasColumnName("approval_notes").HasMaxLength(500);
                entity.Property(e => e.RejectedBy).HasColumnName("rejected_by");
                entity.Property(e => e.RejectedAt).HasColumnName("rejected_at");
                entity.Property(e => e.RejectionReason).HasColumnName("rejection_reason").HasMaxLength(500);
                entity.Property(e => e.RevokedAt).HasColumnName("revoked_at");
                entity.Property(e => e.RevokedBy).HasColumnName("revoked_by");
                entity.Property(e => e.RevocationReason).HasColumnName("revocation_reason").HasMaxLength(500);
                entity.Property(e => e.Status).HasColumnName("status").HasMaxLength(20).HasDefaultValue("pending");
                entity.Property(e => e.AuditTrail).HasColumnName("audit_trail").HasColumnType("jsonb");
                entity.Property(e => e.ActionsPerformed).HasColumnName("actions_performed").HasColumnType("jsonb");
                entity.Property(e => e.NotificationSent).HasColumnName("notification_sent").HasDefaultValue(false);
                entity.Property(e => e.NotifiedUsers).HasColumnName("notified_users").HasColumnType("jsonb");
                entity.Property(e => e.RequiresReview).HasColumnName("requires_review").HasDefaultValue(true);
                entity.Property(e => e.ReviewedBy).HasColumnName("reviewed_by");
                entity.Property(e => e.ReviewedAt).HasColumnName("reviewed_at");
                entity.Property(e => e.ReviewNotes).HasColumnName("review_notes").HasMaxLength(500);
                entity.Property(e => e.ReviewStatus).HasColumnName("review_status").HasMaxLength(50);
                entity.Property(e => e.RiskLevel).HasColumnName("risk_level").HasMaxLength(20).HasDefaultValue("High");
                entity.Property(e => e.SuspiciousActivity).HasColumnName("suspicious_activity").HasDefaultValue(false);
                entity.Property(e => e.CreatedAt).HasColumnName("created_at");
                entity.Property(e => e.UpdatedAt).HasColumnName("updated_at");
                
                entity.HasIndex(e => e.AccessCode);
                entity.HasIndex(e => new { e.UserId, e.Status });
                entity.HasIndex(e => new { e.StartTime, e.EndTime });
                entity.HasIndex(e => new { e.TenantId, e.Status });
            });

            // Role Template Configuration
            builder.Entity<RoleTemplate>(entity =>
            {
                entity.ToTable("role_template");
                entity.HasKey(e => e.Id);
                entity.Property(e => e.Id).HasColumnName("id");
                entity.Property(e => e.TenantId).HasColumnName("tenant_id").IsRequired();
                entity.Property(e => e.Name).HasColumnName("name").HasMaxLength(100).IsRequired();
                entity.Property(e => e.Description).HasColumnName("description").HasMaxLength(500);
                entity.Property(e => e.RoleType).HasColumnName("role_type").HasMaxLength(50).IsRequired();
                entity.Property(e => e.TemplateCategory).HasColumnName("template_category").HasMaxLength(50).IsRequired();
                entity.Property(e => e.Priority).HasColumnName("priority").HasDefaultValue(0);
                entity.Property(e => e.Configuration).HasColumnName("configuration").HasColumnType("jsonb").HasDefaultValue("{}");
                entity.Property(e => e.Metadata).HasColumnName("metadata").HasColumnType("jsonb").HasDefaultValue("{}");
                entity.Property(e => e.IsActive).HasColumnName("is_active").HasDefaultValue(true);
                entity.Property(e => e.IsSystemTemplate).HasColumnName("is_system_template").HasDefaultValue(false);
                entity.Property(e => e.Status).HasColumnName("status").HasMaxLength(50).HasDefaultValue("active");
                entity.Property(e => e.CreatedAt).HasColumnName("created_at");
                entity.Property(e => e.UpdatedAt).HasColumnName("updated_at");
                entity.Property(e => e.DeletedAt).HasColumnName("deleted_at");
                entity.Property(e => e.CreatedByUserId).HasColumnName("created_by_user_id");
                entity.Property(e => e.UpdatedByUserId).HasColumnName("updated_by_user_id");
                entity.Property(e => e.DeletedBy).HasColumnName("deleted_by");
                
                entity.HasIndex(e => e.TenantId);
                entity.HasIndex(e => e.RoleType);
                entity.HasIndex(e => e.TemplateCategory);
                entity.HasIndex(e => new { e.TenantId, e.Name });
                entity.HasIndex(e => new { e.TenantId, e.IsActive });
            });

            // Role Hierarchy Configuration
            builder.Entity<RoleHierarchy>(entity =>
            {
                entity.ToTable("role_hierarchy");
                entity.HasKey(e => e.Id);
                entity.Property(e => e.Id).HasColumnName("id");
                entity.Property(e => e.TenantId).HasColumnName("tenant_id").IsRequired();
                entity.Property(e => e.ParentRoleId).HasColumnName("parent_role_id").IsRequired();
                entity.Property(e => e.ChildRoleId).HasColumnName("child_role_id").IsRequired();
                entity.Property(e => e.Level).HasColumnName("level").HasDefaultValue(1);
                entity.Property(e => e.Path).HasColumnName("path").HasMaxLength(500);
                entity.Property(e => e.InheritanceType).HasColumnName("inheritance_type").HasMaxLength(50).HasDefaultValue("inherit_all");
                entity.Property(e => e.InheritanceConfig).HasColumnName("inheritance_config").HasColumnType("jsonb").HasDefaultValue("{}");
                entity.Property(e => e.IsActive).HasColumnName("is_active").HasDefaultValue(true);
                entity.Property(e => e.Status).HasColumnName("status").HasMaxLength(50).HasDefaultValue("active");
                entity.Property(e => e.CreatedAt).HasColumnName("created_at");
                entity.Property(e => e.UpdatedAt).HasColumnName("updated_at");
                entity.Property(e => e.DeletedAt).HasColumnName("deleted_at");
                entity.Property(e => e.CreatedByUserId).HasColumnName("created_by_user_id");
                entity.Property(e => e.UpdatedByUserId).HasColumnName("updated_by_user_id");
                entity.Property(e => e.DeletedBy).HasColumnName("deleted_by");
                
                entity.HasIndex(e => e.TenantId);
                entity.HasIndex(e => e.ParentRoleId);
                entity.HasIndex(e => e.ChildRoleId);
                entity.HasIndex(e => new { e.TenantId, e.ParentRoleId });
                entity.HasIndex(e => new { e.TenantId, e.ChildRoleId });
                entity.HasIndex(e => new { e.ParentRoleId, e.ChildRoleId });
                
                // Configure foreign key relationships
                entity.HasOne(e => e.ParentRole)
                    .WithMany()
                    .HasForeignKey(e => e.ParentRoleId)
                    .OnDelete(DeleteBehavior.Restrict);
                    
                entity.HasOne(e => e.ChildRole)
                    .WithMany()
                    .HasForeignKey(e => e.ChildRoleId)
                    .OnDelete(DeleteBehavior.Restrict);
            });

            // User Role History Configuration
            builder.Entity<UserRoleHistory>(entity =>
            {
                entity.ToTable("user_role_history");
                entity.HasKey(e => e.Id);
                entity.Property(e => e.Id).HasColumnName("id");
                entity.Property(e => e.TenantId).HasColumnName("tenant_id").IsRequired();
                entity.Property(e => e.UserId).HasColumnName("user_id").IsRequired();
                entity.Property(e => e.RoleId).HasColumnName("role_id").IsRequired();
                entity.Property(e => e.Action).HasColumnName("action").HasMaxLength(50).IsRequired();
                entity.Property(e => e.Reason).HasColumnName("reason").HasMaxLength(500);
                entity.Property(e => e.ActionTimestamp).HasColumnName("action_timestamp");
                entity.Property(e => e.EffectiveFrom).HasColumnName("effective_from");
                entity.Property(e => e.EffectiveUntil).HasColumnName("effective_until");
                entity.Property(e => e.AssignedByUserId).HasColumnName("assigned_by_user_id").IsRequired();
                entity.Property(e => e.BranchId).HasColumnName("branch_id");
                entity.Property(e => e.Metadata).HasColumnName("metadata").HasColumnType("jsonb").HasDefaultValue("{}");
                entity.Property(e => e.Status).HasColumnName("status").HasMaxLength(50).HasDefaultValue("active");
                entity.Property(e => e.CreatedAt).HasColumnName("created_at");
                
                entity.HasIndex(e => e.TenantId);
                entity.HasIndex(e => e.UserId);
                entity.HasIndex(e => e.RoleId);
                entity.HasIndex(e => new { e.TenantId, e.UserId });
                entity.HasIndex(e => new { e.TenantId, e.RoleId });
                entity.HasIndex(e => new { e.UserId, e.RoleId });
                entity.HasIndex(e => e.ActionTimestamp);
            });
            
            // =============================================
            // Phase 3: Prescription Management Configuration
            // =============================================
            
            builder.Entity<AuthService.Models.Prescription.Prescription>(entity =>
            {
                entity.ToTable("prescription");
                entity.HasKey(e => e.Id);
                entity.Property(e => e.Id).HasColumnName("id");
                entity.Property(e => e.TenantId).HasColumnName("tenant_id").IsRequired();
                entity.Property(e => e.PatientId).HasColumnName("patient_id").IsRequired();
                entity.Property(e => e.DoctorId).HasColumnName("doctor_id").IsRequired();
                entity.Property(e => e.PrescriptionDate).HasColumnName("prescription_date").IsRequired();
                entity.Property(e => e.Diagnosis).HasColumnName("diagnosis").IsRequired();
                entity.Property(e => e.Instructions).HasColumnName("instructions");
                entity.Property(e => e.DurationDays).HasColumnName("duration_days");
                entity.Property(e => e.FollowUpDate).HasColumnName("follow_up_date");
                entity.Property(e => e.Status).HasColumnName("status").HasMaxLength(50).IsRequired().HasDefaultValue("active");
                entity.Property(e => e.PharmacyId).HasColumnName("pharmacy_id");
                entity.Property(e => e.DispensedDate).HasColumnName("dispensed_date");
                entity.Property(e => e.DispensedByUserId).HasColumnName("dispensed_by_user_id");
                entity.Property(e => e.Notes).HasColumnName("notes");
                entity.Property(e => e.IsPrinted).HasColumnName("is_printed").HasDefaultValue(false);
                entity.Property(e => e.PrintedAt).HasColumnName("printed_at");
                entity.Property(e => e.CreatedAt).HasColumnName("created_at");
                entity.Property(e => e.UpdatedAt).HasColumnName("updated_at");
                entity.Property(e => e.CreatedByUserId).HasColumnName("created_by_user_id");
                entity.Property(e => e.UpdatedByUserId).HasColumnName("updated_by_user_id");
                entity.Property(e => e.DeletedAt).HasColumnName("deleted_at");
                
                // Navigation properties
                entity.HasOne(e => e.Patient)
                    .WithMany()
                    .HasForeignKey(e => e.PatientId)
                    .OnDelete(DeleteBehavior.Restrict);
                    
                entity.HasOne(e => e.Doctor)
                    .WithMany()
                    .HasForeignKey(e => e.DoctorId)
                    .OnDelete(DeleteBehavior.Restrict);
                    
                entity.HasOne(e => e.DispensedByUser)
                    .WithMany()
                    .HasForeignKey(e => e.DispensedByUserId)
                    .OnDelete(DeleteBehavior.SetNull);
                    
                entity.HasMany(e => e.Medications)
                    .WithOne(m => m.Prescription)
                    .HasForeignKey(m => m.PrescriptionId)
                    .OnDelete(DeleteBehavior.Cascade);
                
                entity.HasIndex(e => e.TenantId);
                entity.HasIndex(e => e.PatientId);
                entity.HasIndex(e => e.DoctorId);
                entity.HasIndex(e => e.PrescriptionDate);
                entity.HasIndex(e => e.Status);
                entity.HasIndex(e => e.DeletedAt);
            });
            
            builder.Entity<AuthService.Models.Prescription.PrescriptionMedication>(entity =>
            {
                entity.ToTable("prescription_medication");
                entity.HasKey(e => e.Id);
                entity.Property(e => e.Id).HasColumnName("id");
                entity.Property(e => e.TenantId).HasColumnName("tenant_id").IsRequired();
                entity.Property(e => e.PrescriptionId).HasColumnName("prescription_id").IsRequired();
                entity.Property(e => e.MedicationName).HasColumnName("medication_name").HasMaxLength(200).IsRequired();
                entity.Property(e => e.GenericName).HasColumnName("generic_name").HasMaxLength(200);
                entity.Property(e => e.Dosage).HasColumnName("dosage").HasMaxLength(100).IsRequired();
                entity.Property(e => e.Form).HasColumnName("form").HasMaxLength(50).IsRequired();
                entity.Property(e => e.Route).HasColumnName("route").HasMaxLength(50).IsRequired();
                entity.Property(e => e.Frequency).HasColumnName("frequency").HasMaxLength(100).IsRequired();
                entity.Property(e => e.DurationDays).HasColumnName("duration_days").IsRequired();
                entity.Property(e => e.Quantity).HasColumnName("quantity").IsRequired();
                entity.Property(e => e.Instructions).HasColumnName("instructions");
                entity.Property(e => e.StartDate).HasColumnName("start_date").IsRequired();
                entity.Property(e => e.EndDate).HasColumnName("end_date");
                entity.Property(e => e.RefillsAllowed).HasColumnName("refills_allowed").HasDefaultValue(0);
                entity.Property(e => e.RefillsRemaining).HasColumnName("refills_remaining").HasDefaultValue(0);
                entity.Property(e => e.IsCritical).HasColumnName("is_critical").HasDefaultValue(false);
                entity.Property(e => e.CreatedAt).HasColumnName("created_at");
                entity.Property(e => e.UpdatedAt).HasColumnName("updated_at");
                entity.Property(e => e.DeletedAt).HasColumnName("deleted_at");
                
                entity.HasIndex(e => e.TenantId);
                entity.HasIndex(e => e.PrescriptionId);
                entity.HasIndex(e => e.MedicationName);
                entity.HasIndex(e => new { e.StartDate, e.EndDate });
            });
            
            builder.Entity<AuthService.Models.Prescription.DrugInteraction>(entity =>
            {
                entity.ToTable("drug_interaction");
                entity.HasKey(e => e.Id);
                entity.Property(e => e.Id).HasColumnName("id");
                entity.Property(e => e.Drug1Name).HasColumnName("drug1_name").HasMaxLength(200).IsRequired();
                entity.Property(e => e.Drug2Name).HasColumnName("drug2_name").HasMaxLength(200).IsRequired();
                entity.Property(e => e.InteractionType).HasColumnName("interaction_type").HasMaxLength(50).IsRequired();
                entity.Property(e => e.Severity).HasColumnName("severity").HasMaxLength(50).IsRequired();
                entity.Property(e => e.Description).HasColumnName("description").IsRequired();
                entity.Property(e => e.ClinicalEffects).HasColumnName("clinical_effects");
                entity.Property(e => e.Mechanism).HasColumnName("mechanism");
                entity.Property(e => e.Management).HasColumnName("management");
                entity.Property(e => e.ReferenceSources).HasColumnName("reference_sources");
                entity.Property(e => e.IsActive).HasColumnName("is_active").HasDefaultValue(true);
                entity.Property(e => e.CreatedAt).HasColumnName("created_at");
                entity.Property(e => e.UpdatedAt).HasColumnName("updated_at");
                
                entity.HasIndex(e => e.Drug1Name);
                entity.HasIndex(e => e.Drug2Name);
                entity.HasIndex(e => e.InteractionType);
                entity.HasIndex(e => e.Severity);
            });
            
            builder.Entity<AuthService.Models.Prescription.MedicationMaster>(entity =>
            {
                entity.ToTable("medication_master");
                entity.HasKey(e => e.Id);
                entity.Property(e => e.Id).HasColumnName("id");
                entity.Property(e => e.Name).HasColumnName("name").HasMaxLength(200).IsRequired();
                entity.Property(e => e.GenericName).HasColumnName("generic_name").HasMaxLength(200);
                entity.Property(e => e.BrandNames).HasColumnName("brand_names");
                entity.Property(e => e.Category).HasColumnName("category").HasMaxLength(100).IsRequired();
                entity.Property(e => e.Form).HasColumnName("form").HasMaxLength(50).IsRequired();
                entity.Property(e => e.StandardDosages).HasColumnName("standard_dosages");
                entity.Property(e => e.Route).HasColumnName("route").HasMaxLength(50).IsRequired();
                entity.Property(e => e.Contraindications).HasColumnName("contraindications");
                entity.Property(e => e.SideEffects).HasColumnName("side_effects");
                entity.Property(e => e.PregnancyCategory).HasColumnName("pregnancy_category").HasMaxLength(10);
                entity.Property(e => e.RequiresPrescription).HasColumnName("requires_prescription").HasDefaultValue(true);
                entity.Property(e => e.IsControlledSubstance).HasColumnName("is_controlled_substance").HasDefaultValue(false);
                entity.Property(e => e.IsActive).HasColumnName("is_active").HasDefaultValue(true);
                entity.Property(e => e.CreatedAt).HasColumnName("created_at");
                entity.Property(e => e.UpdatedAt).HasColumnName("updated_at");
                
                entity.HasIndex(e => e.Name);
                entity.HasIndex(e => e.GenericName);
                entity.HasIndex(e => e.Category);
                entity.HasIndex(e => e.IsActive);
            });

            // ============ OPD Visit & Billing Entities ============
            
            builder.Entity<Visit>(entity =>
            {
                entity.ToTable("visits");
                entity.HasKey(e => e.Id);
                entity.Property(e => e.Id).HasColumnName("id");
                entity.Property(e => e.TenantId).HasColumnName("tenant_id").IsRequired();
                entity.Property(e => e.PatientId).HasColumnName("patient_id").IsRequired();
                entity.Property(e => e.AppointmentId).HasColumnName("appointment_id").IsRequired();
                entity.Property(e => e.OpdBillId).HasColumnName("opd_bill_id");
                entity.Property(e => e.BranchId).HasColumnName("branch_id").IsRequired();
                entity.Property(e => e.ConsultantId).HasColumnName("consultant_id");
                entity.Property(e => e.DepartmentId).HasColumnName("department_id");
                entity.Property(e => e.VisitType).HasColumnName("visit_type").HasMaxLength(30).IsRequired();
                entity.Property(e => e.VisitCategory).HasColumnName("visit_category").HasMaxLength(30).IsRequired();
                entity.Property(e => e.Status).HasColumnName("status").HasMaxLength(30).IsRequired();
                entity.Property(e => e.TokenNumber).HasColumnName("token_number").HasMaxLength(20).IsRequired();
                entity.Property(e => e.TokenSequence).HasColumnName("token_sequence");
                entity.Property(e => e.CheckedInAt).HasColumnName("checked_in_at");
                entity.Property(e => e.CheckedInBy).HasColumnName("checked_in_by");
                entity.Property(e => e.CurrentStation).HasColumnName("current_station").HasMaxLength(50);
                entity.Property(e => e.AssignedTo).HasColumnName("assigned_to");
                entity.Property(e => e.AssignedAt).HasColumnName("assigned_at");
                entity.Property(e => e.ActiveRoomCode).HasColumnName("active_room_code").HasMaxLength(50);
                entity.Property(e => e.OptometryPassCount).HasColumnName("optometry_pass_count").HasDefaultValue(0);
                entity.Property(e => e.CompletedAt).HasColumnName("completed_at");
                entity.Property(e => e.CompletedBy).HasColumnName("completed_by");
                entity.Property(e => e.Outcome).HasColumnName("outcome").HasMaxLength(50);
                entity.Property(e => e.OutcomeNotes).HasColumnName("outcome_notes");
                entity.Property(e => e.IsEmergency).HasColumnName("is_emergency").HasDefaultValue(false);
                entity.Property(e => e.EmergencyAuthorizedBy).HasColumnName("emergency_authorized_by");
                entity.Property(e => e.EmergencyReason).HasColumnName("emergency_reason");
                entity.Property(e => e.WalkoutReason).HasColumnName("walkout_reason").HasMaxLength(100);
                entity.Property(e => e.WalkoutAt).HasColumnName("walkout_at");
                entity.Property(e => e.OverrideReason).HasColumnName("override_reason").HasMaxLength(100);
                entity.Property(e => e.Notes).HasColumnName("notes");
                entity.Property(e => e.CreatedAt).HasColumnName("created_at");
                entity.Property(e => e.UpdatedAt).HasColumnName("updated_at");
                entity.Property(e => e.CreatedByUserId).HasColumnName("created_by_user_id").IsRequired();
                entity.Property(e => e.UpdatedByUserId).HasColumnName("updated_by_user_id");
                entity.Property(e => e.DeletedAt).HasColumnName("deleted_at");
                
                entity.HasIndex(e => e.TenantId);
                entity.HasIndex(e => e.PatientId);
                entity.HasIndex(e => e.AppointmentId);
                entity.HasIndex(e => e.BranchId);
                entity.HasIndex(e => e.TokenNumber);
                entity.HasIndex(e => e.Status);
                entity.HasIndex(e => new { e.BranchId, e.TokenSequence, e.CreatedAt });
            });

            builder.Entity<OptometrySegmentExam>(entity =>
            {
                entity.ToTable("optometry_segment_exams");
                entity.HasKey(e => e.Id);
                entity.Property(e => e.Id).HasColumnName("id");
                entity.Property(e => e.TenantId).HasColumnName("tenant_id").IsRequired();
                entity.Property(e => e.VisitId).HasColumnName("visit_id").IsRequired();
                entity.Property(e => e.PatientId).HasColumnName("patient_id").IsRequired();
                entity.Property(e => e.SegmentKey).HasColumnName("segment_key").HasMaxLength(64).IsRequired();
                entity.Property(e => e.Data).HasColumnName("data").IsRequired();
                entity.Property(e => e.UpdatedBy).HasColumnName("updated_by");
                entity.Property(e => e.CreatedAt).HasColumnName("created_at");
                entity.Property(e => e.UpdatedAt).HasColumnName("updated_at");
                entity.HasIndex(e => new { e.VisitId, e.SegmentKey }).IsUnique();
                entity.HasIndex(e => new { e.TenantId, e.VisitId });
                entity.HasIndex(e => new { e.PatientId, e.TenantId, e.UpdatedAt });
            });

            builder.Entity<OptometryVisitExam>(entity =>
            {
                entity.ToTable("optometry_visit_exams");
                entity.HasKey(e => e.Id);
                entity.Property(e => e.Id).HasColumnName("id");
                entity.Property(e => e.TenantId).HasColumnName("tenant_id").IsRequired();
                entity.Property(e => e.VisitId).HasColumnName("visit_id").IsRequired();
                entity.Property(e => e.PatientId).HasColumnName("patient_id").IsRequired();
                entity.Property(e => e.SnapshotJson).HasColumnName("snapshot_json").HasColumnType("jsonb").IsRequired();
                entity.Property(e => e.CompletedAt).HasColumnName("completed_at");
                entity.Property(e => e.CompletedBy).HasColumnName("completed_by");
                entity.Property(e => e.CreatedAt).HasColumnName("created_at");
                entity.Property(e => e.UpdatedAt).HasColumnName("updated_at");
                entity.HasIndex(e => e.VisitId).IsUnique();
                entity.HasIndex(e => new { e.PatientId, e.TenantId, e.UpdatedAt });
            });

            builder.Entity<VisitStationEvent>(entity =>
            {
                entity.ToTable("visit_station_events");
                entity.HasKey(e => e.Id);
                entity.Property(e => e.Id).HasColumnName("id");
                entity.Property(e => e.TenantId).HasColumnName("tenant_id").IsRequired();
                entity.Property(e => e.BranchId).HasColumnName("branch_id").IsRequired();
                entity.Property(e => e.VisitId).HasColumnName("visit_id").IsRequired();
                entity.Property(e => e.PatientId).HasColumnName("patient_id").IsRequired();
                entity.Property(e => e.Station).HasColumnName("station").HasMaxLength(50).IsRequired();
                entity.Property(e => e.EventType).HasColumnName("event_type").HasMaxLength(30).IsRequired();
                entity.Property(e => e.PassNumber).HasColumnName("pass_number").HasDefaultValue(1);
                entity.Property(e => e.ReasonCode).HasColumnName("reason_code").HasMaxLength(50);
                entity.Property(e => e.ReasonNotes).HasColumnName("reason_notes");
                entity.Property(e => e.AssignedToUserId).HasColumnName("assigned_to_user_id");
                entity.Property(e => e.RoomCode).HasColumnName("room_code").HasMaxLength(50);
                entity.Property(e => e.QueueItemId).HasColumnName("queue_item_id");
                entity.Property(e => e.Metadata).HasColumnName("metadata").HasColumnType("jsonb");
                entity.Property(e => e.CreatedAt).HasColumnName("created_at");
                entity.Property(e => e.CreatedByUserId).HasColumnName("created_by_user_id");
                entity.HasIndex(e => new { e.VisitId, e.Station, e.CreatedAt });
                entity.HasIndex(e => new { e.BranchId, e.Station, e.CreatedAt });
            });

            builder.Entity<OpdBill>(entity =>
            {
                entity.ToTable("opd_bills");
                entity.HasKey(e => e.Id);
                entity.Property(e => e.Id).HasColumnName("id");
                entity.Property(e => e.TenantId).HasColumnName("tenant_id").IsRequired();
                entity.Property(e => e.PatientId).HasColumnName("patient_id").IsRequired();
                entity.Property(e => e.AppointmentId).HasColumnName("appointment_id");
                entity.Property(e => e.BranchId).HasColumnName("branch_id").IsRequired();
                entity.Property(e => e.BillingRuleId).HasColumnName("billing_rule_id");
                entity.Property(e => e.BillNumber).HasColumnName("bill_number").HasMaxLength(50).IsRequired();
                entity.Property(e => e.BillDate).HasColumnName("bill_date").IsRequired();
                entity.Property(e => e.ConsultationFee).HasColumnName("consultation_fee").HasPrecision(10, 2);
                entity.Property(e => e.RegistrationFee).HasColumnName("registration_fee").HasPrecision(10, 2);
                entity.Property(e => e.AdditionalCharges).HasColumnName("additional_charges").HasPrecision(10, 2);
                entity.Property(e => e.GrossAmount).HasColumnName("gross_amount").HasPrecision(10, 2);
                entity.Property(e => e.DiscountPercentage).HasColumnName("discount_percentage").HasPrecision(5, 2);
                entity.Property(e => e.DiscountAmount).HasColumnName("discount_amount").HasPrecision(10, 2);
                entity.Property(e => e.TaxAmount).HasColumnName("tax_amount").HasPrecision(10, 2);
                entity.Property(e => e.NetAmount).HasColumnName("net_amount").HasPrecision(10, 2);
                entity.Property(e => e.AmountPaid).HasColumnName("amount_paid").HasPrecision(10, 2);
                entity.Property(e => e.BalanceDue).HasColumnName("balance_due").HasPrecision(10, 2);
                entity.Property(e => e.Status).HasColumnName("status").HasMaxLength(30).IsRequired();
                entity.Property(e => e.IsFreeVisit).HasColumnName("is_free_visit").HasDefaultValue(false);
                entity.Property(e => e.FreeVisitReason).HasColumnName("free_visit_reason").HasMaxLength(200);
                entity.Property(e => e.IsCredit).HasColumnName("is_credit").HasDefaultValue(false);
                entity.Property(e => e.CreditApprovedBy).HasColumnName("credit_approved_by");
                entity.Property(e => e.CreditApprovedAt).HasColumnName("credit_approved_at");
                entity.Property(e => e.CreditNotes).HasColumnName("credit_notes");
                entity.Property(e => e.IsInsurance).HasColumnName("is_insurance").HasDefaultValue(false);
                entity.Property(e => e.InsuranceProvider).HasColumnName("insurance_provider").HasMaxLength(200);
                entity.Property(e => e.InsurancePolicyNumber).HasColumnName("insurance_policy_number").HasMaxLength(100);
                entity.Property(e => e.InsuranceClaimAmount).HasColumnName("insurance_claim_amount").HasPrecision(10, 2);
                entity.Property(e => e.BillItems).HasColumnName("bill_items").HasColumnType("jsonb");
                entity.Property(e => e.IsFinalized).HasColumnName("is_finalized").HasDefaultValue(false);
                entity.Property(e => e.FinalizedAt).HasColumnName("finalized_at");
                entity.Property(e => e.FinalizedByUserId).HasColumnName("finalized_by_user_id");
                // Day 5: Bill Locking (Feb 7, 2026)
                entity.Property(e => e.IsLocked).HasColumnName("is_locked").HasDefaultValue(false);
                entity.Property(e => e.LockedAt).HasColumnName("locked_at");
                entity.Property(e => e.LockedByUserId).HasColumnName("locked_by_user_id");
                entity.Property(e => e.UnlockReason).HasColumnName("unlock_reason");
                entity.Property(e => e.UnlockedAt).HasColumnName("unlocked_at");
                entity.Property(e => e.UnlockedByUserId).HasColumnName("unlocked_by_user_id");
                entity.Property(e => e.RefundStatus).HasColumnName("refund_status").HasMaxLength(20).HasDefaultValue("none");
                entity.Property(e => e.RefundAmount).HasColumnName("refund_amount").HasPrecision(10, 2);
                entity.Property(e => e.RefundReason).HasColumnName("refund_reason").HasMaxLength(200);
                entity.Property(e => e.Notes).HasColumnName("notes");
                entity.Property(e => e.GeneratedBy).HasColumnName("generated_by").IsRequired();
                entity.Property(e => e.CreatedAt).HasColumnName("created_at");
                entity.Property(e => e.UpdatedAt).HasColumnName("updated_at");
                entity.Property(e => e.CreatedByUserId).HasColumnName("created_by_user_id").IsRequired();
                entity.Property(e => e.UpdatedByUserId).HasColumnName("updated_by_user_id");
                entity.Property(e => e.DeletedAt).HasColumnName("deleted_at");
                entity.Property(e => e.RowVersion)
                    .HasColumnName("row_version")
                    .IsConcurrencyToken()
                    .HasDefaultValue(1);
                
                entity.HasIndex(e => e.TenantId);
                entity.Property(e => e.PatientJourneyId).HasColumnName("patient_journey_id");
                entity.HasIndex(e => e.BillNumber).IsUnique();
                entity.HasIndex(e => e.PatientId);
                entity.HasIndex(e => e.AppointmentId);
                entity.HasIndex(e => e.PatientJourneyId)
                    .IsUnique()
                    .HasFilter("patient_journey_id IS NOT NULL AND deleted_at IS NULL")
                    .HasDatabaseName("ux_opd_bills_patient_journey");
                entity.HasIndex(e => e.Status);
                // Day 5: Bill Locking indexes
                entity.HasIndex(e => e.IsLocked);
            });

            // Phase 3I Slice 7 (PD-S7-01) — optimistic concurrency token for CounselingSession.
            // Other CounselingSession columns already map via [Column] attributes on the entity.
            builder.Entity<CounselingSession>(entity =>
            {
                entity.Property(e => e.Version)
                    .HasColumnName("version")
                    .IsConcurrencyToken()
                    .HasDefaultValue(1);
            });

            // Phase 3I Slice 8 — active CounselorQueue row unique per session.
            // Soft-deleted historical rows may share session_id; two DeletedAt=NULL rows must not.
            builder.Entity<CounselorQueueItem>(entity =>
            {
                entity.HasIndex(e => e.SessionId)
                    .IsUnique()
                    .HasFilter("deleted_at IS NULL")
                    .HasDatabaseName("ux_counselor_queue_session_id_active");
            });

            builder.Entity<OpdBillPayment>(entity =>
            {
                entity.ToTable("opd_bill_payments");
                entity.HasKey(e => e.Id);
                entity.Property(e => e.Id).HasColumnName("id");
                entity.Property(e => e.TenantId).HasColumnName("tenant_id").IsRequired();
                entity.Property(e => e.OpdBillId).HasColumnName("opd_bill_id").IsRequired();
                entity.Property(e => e.PaymentReference).HasColumnName("payment_reference").HasMaxLength(50).IsRequired();
                entity.Property(e => e.PaymentMode).HasColumnName("payment_mode").HasMaxLength(30).IsRequired();
                entity.Property(e => e.Amount).HasColumnName("amount").HasPrecision(10, 2);
                entity.Property(e => e.PaymentDate).HasColumnName("payment_date");
                entity.Property(e => e.CardType).HasColumnName("card_type").HasMaxLength(30);
                entity.Property(e => e.CardLastFour).HasColumnName("card_last_four").HasMaxLength(4);
                entity.Property(e => e.CardNetwork).HasColumnName("card_network").HasMaxLength(30);
                entity.Property(e => e.UpiId).HasColumnName("upi_id").HasMaxLength(100);
                entity.Property(e => e.UpiTransactionId).HasColumnName("upi_transaction_id").HasMaxLength(100);
                entity.Property(e => e.BankName).HasColumnName("bank_name").HasMaxLength(100);
                entity.Property(e => e.ChequeNumber).HasColumnName("cheque_number").HasMaxLength(50);
                entity.Property(e => e.InsuranceClaimId).HasColumnName("insurance_claim_id").HasMaxLength(100);
                entity.Property(e => e.InsuranceResponse).HasColumnName("insurance_response");
                entity.Property(e => e.ReceivedBy).HasColumnName("received_by");
                entity.Property(e => e.ReceiptNumber).HasColumnName("receipt_number").HasMaxLength(50);
                entity.Property(e => e.PaymentKind).HasColumnName("payment_kind").HasMaxLength(20);
                entity.Property(e => e.ReversedPaymentId).HasColumnName("reversed_payment_id");
                entity.Property(e => e.IdempotencyKey).HasColumnName("idempotency_key").HasMaxLength(80);
                
                entity.HasIndex(e => e.OpdBillId);
                entity.HasIndex(e => e.PaymentReference).IsUnique();
                entity.HasIndex(e => new { e.TenantId, e.IdempotencyKey })
                    .IsUnique()
                    .HasFilter("idempotency_key IS NOT NULL AND length(trim(idempotency_key)) > 0")
                    .HasDatabaseName("ux_opd_bill_payments_idempotency");
            });

            builder.Entity<Refund>(entity =>
            {
                entity.ToTable("refunds");
                entity.HasKey(e => e.Id);
                entity.Property(e => e.Id).HasColumnName("id");
                entity.Property(e => e.BillId).HasColumnName("bill_id").IsRequired();
                entity.Property(e => e.PatientId).HasColumnName("patient_id").IsRequired();
                entity.Property(e => e.VisitId).HasColumnName("visit_id");
                entity.Property(e => e.RefundAmount).HasColumnName("refund_amount").HasPrecision(10, 2);
                entity.Property(e => e.RefundReason).HasColumnName("refund_reason").HasMaxLength(200);
                entity.Property(e => e.RefundMode).HasColumnName("refund_mode").HasMaxLength(50);
                entity.Property(e => e.RequestedByUserId).HasColumnName("requested_by_user_id");
                entity.Property(e => e.RequestedAt).HasColumnName("requested_at");
                entity.Property(e => e.AuthorizedByUserId).HasColumnName("authorized_by_user_id");
                entity.Property(e => e.AuthorizedAt).HasColumnName("authorized_at");
                entity.Property(e => e.Status).HasColumnName("status").HasMaxLength(20).HasDefaultValue("pending");
                entity.Property(e => e.Notes).HasColumnName("notes");
                entity.Property(e => e.TenantId).HasColumnName("tenant_id").IsRequired();
                entity.Property(e => e.CreatedAt).HasColumnName("created_at");
                
                entity.HasIndex(e => e.BillId);
                entity.HasIndex(e => e.PatientId);
                entity.HasIndex(e => e.VisitId);
                entity.HasIndex(e => e.TenantId);
            });

            builder.Entity<BillingRule>(entity =>
            {
                entity.ToTable("billing_rules");
                entity.HasKey(e => e.Id);
                entity.Property(e => e.Id).HasColumnName("id");
                entity.Property(e => e.TenantId).HasColumnName("tenant_id").IsRequired();
                entity.Property(e => e.BranchId).HasColumnName("branch_id");
                entity.Property(e => e.Name).HasColumnName("name").HasMaxLength(100).IsRequired();
                entity.Property(e => e.VisitType).HasColumnName("visit_type").HasMaxLength(30).IsRequired();
                entity.Property(e => e.FreeDays).HasColumnName("free_days");
                entity.Property(e => e.FreeVisits).HasColumnName("free_visits");
                entity.Property(e => e.Condition).HasColumnName("condition").HasMaxLength(30);
                entity.Property(e => e.DefaultFee).HasColumnName("default_fee").HasPrecision(10, 2);
                entity.Property(e => e.IsActive).HasColumnName("is_active").HasDefaultValue(true);
                entity.Property(e => e.Priority).HasColumnName("priority");
                entity.Property(e => e.Description).HasColumnName("description").HasMaxLength(500);
                entity.Property(e => e.CreatedAt).HasColumnName("created_at");
                entity.Property(e => e.UpdatedAt).HasColumnName("updated_at");
                entity.Property(e => e.CreatedByUserId).HasColumnName("created_by_user_id").IsRequired();
                entity.Property(e => e.UpdatedByUserId).HasColumnName("updated_by_user_id");
                entity.Property(e => e.DeletedAt).HasColumnName("deleted_at");
                
                entity.HasIndex(e => e.TenantId);
                entity.HasIndex(e => e.VisitType);
                entity.HasIndex(e => e.IsActive);
            });

            builder.Entity<TokenSequence>(entity =>
            {
                entity.ToTable("token_sequences");
                entity.HasKey(e => e.Id);
                entity.Property(e => e.Id).HasColumnName("id");
                entity.Property(e => e.TenantId).HasColumnName("tenant_id").IsRequired();
                entity.Property(e => e.BranchId).HasColumnName("branch_id").IsRequired();
                entity.Property(e => e.SequenceDate).HasColumnName("sequence_date");
                entity.Property(e => e.CurrentSequence).HasColumnName("current_sequence");
                entity.Property(e => e.BranchPrefix).HasColumnName("branch_prefix").HasMaxLength(10).IsRequired();
                entity.Property(e => e.CreatedAt).HasColumnName("created_at");
                entity.Property(e => e.UpdatedAt).HasColumnName("updated_at");
                
                entity.HasIndex(e => new { e.BranchId, e.SequenceDate }).IsUnique();
            });

            // Day 4: Itemized Billing Entities (Feb 6, 2026)
            builder.Entity<OpdBillItem>(entity =>
            {
                entity.ToTable("opd_bill_items");
                entity.HasKey(e => e.Id);
                entity.Property(e => e.Id).HasColumnName("id");
                entity.Property(e => e.TenantId).HasColumnName("tenant_id").IsRequired();
                entity.Property(e => e.OpdBillId).HasColumnName("opd_bill_id").IsRequired();
                entity.Property(e => e.ServiceVariantId).HasColumnName("service_variant_id");
                entity.Property(e => e.ServiceCode).HasColumnName("service_code").HasMaxLength(50).IsRequired();
                entity.Property(e => e.ServiceName).HasColumnName("service_name").HasMaxLength(200).IsRequired();
                entity.Property(e => e.ServiceCategory).HasColumnName("service_category");
                entity.Property(e => e.Description).HasColumnName("description");
                entity.Property(e => e.Quantity).HasColumnName("quantity").HasDefaultValue(1);
                entity.Property(e => e.UnitPrice).HasColumnName("unit_price").HasPrecision(10, 2).IsRequired();
                entity.Property(e => e.Subtotal).HasColumnName("subtotal").HasPrecision(10, 2).IsRequired();
                entity.Property(e => e.DiscountPercentage).HasColumnName("discount_percentage").HasPrecision(5, 2).HasDefaultValue(0);
                entity.Property(e => e.DiscountAmount).HasColumnName("discount_amount").HasPrecision(10, 2).HasDefaultValue(0);
                entity.Property(e => e.DiscountReason).HasColumnName("discount_reason");
                entity.Property(e => e.TaxPercentage).HasColumnName("tax_percentage").HasPrecision(5, 2).HasDefaultValue(0);
                entity.Property(e => e.TaxAmount).HasColumnName("tax_amount").HasPrecision(10, 2).HasDefaultValue(0);
                entity.Property(e => e.TotalAmount).HasColumnName("total_amount").HasPrecision(10, 2).IsRequired();
                entity.Property(e => e.PerformedByUserId).HasColumnName("performed_by_user_id");
                entity.Property(e => e.PerformedAt).HasColumnName("performed_at");
                entity.Property(e => e.DepartmentId).HasColumnName("department_id");
                entity.Property(e => e.Notes).HasColumnName("notes");
                entity.Property(e => e.Status).HasColumnName("status").HasMaxLength(20).HasDefaultValue("active");
                entity.Property(e => e.SourceType).HasColumnName("source_type").HasMaxLength(30).HasDefaultValue("Manual");
                entity.Property(e => e.SourceRefId).HasColumnName("source_ref_id");
                entity.Property(e => e.IdempotencyKey).HasColumnName("idempotency_key").HasMaxLength(200);
                entity.Property(e => e.CreatedAt).HasColumnName("created_at");
                entity.Property(e => e.UpdatedAt).HasColumnName("updated_at");
                entity.Property(e => e.CreatedByUserId).HasColumnName("created_by_user_id").IsRequired();
                entity.Property(e => e.UpdatedByUserId).HasColumnName("updated_by_user_id");
                entity.Property(e => e.DeletedAt).HasColumnName("deleted_at");
                
                entity.HasOne(e => e.OpdBill)
                    .WithMany()
                    .HasForeignKey(e => e.OpdBillId)
                    .OnDelete(DeleteBehavior.Restrict);
                
                entity.HasOne(e => e.ServiceVariant)
                    .WithMany()
                    .HasForeignKey(e => e.ServiceVariantId)
                    .OnDelete(DeleteBehavior.Restrict);
                
                entity.HasOne(e => e.Department)
                    .WithMany()
                    .HasForeignKey(e => e.DepartmentId)
                    .OnDelete(DeleteBehavior.Restrict);
                
                entity.HasIndex(e => e.TenantId);
                entity.HasIndex(e => e.OpdBillId);
                entity.HasIndex(e => e.ServiceVariantId);
                entity.HasIndex(e => e.Status);
                entity.HasIndex(e => new { e.TenantId, e.IdempotencyKey })
                    .IsUnique()
                    .HasFilter("idempotency_key IS NOT NULL AND deleted_at IS NULL")
                    .HasDatabaseName("ux_opd_bill_items_idempotency");
            });

            builder.Entity<ServiceVariantItemMap>(entity =>
            {
                entity.ToTable("service_variant_item_map");
                entity.HasKey(e => e.Id);
                entity.Property(e => e.Id).HasColumnName("id");
                entity.Property(e => e.TenantId).HasColumnName("tenant_id").IsRequired();
                entity.Property(e => e.ItemId).HasColumnName("item_id").IsRequired();
                entity.Property(e => e.ServiceVariantId).HasColumnName("service_variant_id").IsRequired();
                entity.Property(e => e.IsChargeable).HasColumnName("is_chargeable").HasDefaultValue(true);
                entity.Property(e => e.NonChargeableReason).HasColumnName("non_chargeable_reason");
                entity.Property(e => e.EffectiveFrom).HasColumnName("effective_from");
                entity.Property(e => e.EffectiveTo).HasColumnName("effective_to");
                entity.Property(e => e.CreatedAt).HasColumnName("created_at");
                entity.Property(e => e.CreatedByUserId).HasColumnName("created_by_user_id");
                entity.Property(e => e.UpdatedAt).HasColumnName("updated_at");
                entity.Property(e => e.UpdatedByUserId).HasColumnName("updated_by_user_id");
                entity.HasIndex(e => new { e.TenantId, e.ItemId })
                    .IsUnique()
                    .HasFilter("effective_to IS NULL")
                    .HasDatabaseName("ux_sv_item_map_active");
            });

            builder.Entity<ChargeException>(entity =>
            {
                entity.ToTable("charge_exception");
                entity.HasKey(e => e.Id);
                entity.Property(e => e.Id).HasColumnName("id");
                entity.Property(e => e.TenantId).HasColumnName("tenant_id").IsRequired();
                entity.Property(e => e.ItemId).HasColumnName("item_id");
                entity.Property(e => e.PackageTemplateId).HasColumnName("package_template_id");
                entity.Property(e => e.PackageComponentId).HasColumnName("package_component_id");
                entity.Property(e => e.SourceType).HasColumnName("source_type").HasMaxLength(30).IsRequired();
                entity.Property(e => e.SourceRefId).HasColumnName("source_ref_id");
                entity.Property(e => e.OpdBillId).HasColumnName("opd_bill_id");
                entity.Property(e => e.PatientJourneyId).HasColumnName("patient_journey_id");
                entity.Property(e => e.Quantity).HasColumnName("quantity").HasPrecision(12, 3);
                entity.Property(e => e.EstimatedValue).HasColumnName("estimated_value").HasPrecision(12, 2);
                entity.Property(e => e.Status).HasColumnName("status").HasMaxLength(20);
                entity.Property(e => e.Reason).HasColumnName("reason").HasMaxLength(200);
                entity.Property(e => e.IdempotencyKey).HasColumnName("idempotency_key").HasMaxLength(200);
                entity.Property(e => e.CreatedAt).HasColumnName("created_at");
                entity.Property(e => e.ResolvedAt).HasColumnName("resolved_at");
                entity.Property(e => e.ResolvedByUserId).HasColumnName("resolved_by_user_id");
                entity.HasIndex(e => new { e.TenantId, e.IdempotencyKey })
                    .IsUnique()
                    .HasFilter("idempotency_key IS NOT NULL")
                    .HasDatabaseName("ux_charge_exception_idempotency");
            });

            builder.Entity<PackageComponentMap>(entity =>
            {
                entity.ToTable("package_component_map");
                entity.HasKey(e => e.Id);
                entity.Property(e => e.Id).HasColumnName("id");
                entity.Property(e => e.TenantId).HasColumnName("tenant_id").IsRequired();
                entity.Property(e => e.PackageTemplateId).HasColumnName("package_template_id").IsRequired();
                entity.Property(e => e.ComponentKey).HasColumnName("component_key").HasMaxLength(80).IsRequired();
                entity.Property(e => e.ComponentName).HasColumnName("component_name").HasMaxLength(200).IsRequired();
                entity.Property(e => e.ServiceVariantId).HasColumnName("service_variant_id");
                entity.Property(e => e.Allocation).HasColumnName("allocation").HasMaxLength(20);
                entity.Property(e => e.CoversConsumable).HasColumnName("covers_consumable");
                entity.Property(e => e.SortOrder).HasColumnName("sort_order");
                entity.Property(e => e.CreatedAt).HasColumnName("created_at");
                entity.Property(e => e.UpdatedAt).HasColumnName("updated_at");
                entity.Property(e => e.CreatedByUserId).HasColumnName("created_by_user_id");
                entity.Property(e => e.UpdatedByUserId).HasColumnName("updated_by_user_id");
                entity.HasIndex(e => new { e.TenantId, e.PackageTemplateId, e.ComponentKey })
                    .IsUnique()
                    .HasDatabaseName("ux_package_component_key");
            });

            builder.Entity<InvItemMasterRead>(entity =>
            {
                entity.ToTable("inv_item_master");
                entity.HasKey(e => e.Id);
                entity.Property(e => e.Id).HasColumnName("id");
                entity.Property(e => e.TenantId).HasColumnName("tenant_id");
                entity.Property(e => e.ItemName).HasColumnName("item_name");
                entity.Property(e => e.ItemType).HasColumnName("item_type");
                entity.Property(e => e.DeletedAt).HasColumnName("deleted_at");
                entity.Property(e => e.Status).HasColumnName("status");
            });

            builder.Entity<InvSurgeryConsumableRead>(entity =>
            {
                entity.ToTable("inv_surgery_consumables");
                entity.HasKey(e => e.Id);
                entity.Property(e => e.Id).HasColumnName("id");
                entity.Property(e => e.TenantId).HasColumnName("tenant_id");
                entity.Property(e => e.JourneyId).HasColumnName("journey_id");
                entity.Property(e => e.ItemId).HasColumnName("item_id");
                entity.Property(e => e.Quantity).HasColumnName("quantity");
                entity.Property(e => e.Amount).HasColumnName("amount");
                entity.Property(e => e.ChargeStatus).HasColumnName("charge_status");
                entity.Property(e => e.ChargeItemId).HasColumnName("charge_item_id");
                entity.Property(e => e.ConsumableStatus).HasColumnName("consumable_status");
                entity.Property(e => e.IssuedAt).HasColumnName("issued_at");
                entity.Property(e => e.DeletedAt).HasColumnName("deleted_at");
            });

            builder.Entity<JourneyImplantUsageRead>(entity =>
            {
                entity.ToTable("journey_implant_usage");
                entity.HasKey(e => e.Id);
                entity.Property(e => e.Id).HasColumnName("id");
                entity.Property(e => e.TenantId).HasColumnName("tenant_id");
                entity.Property(e => e.JourneyId).HasColumnName("journey_id");
                entity.Property(e => e.PatientId).HasColumnName("patient_id");
                entity.Property(e => e.Eye).HasColumnName("eye");
                entity.Property(e => e.ItemId).HasColumnName("item_id");
                entity.Property(e => e.CatalogRef).HasColumnName("catalog_ref");
                entity.Property(e => e.Brand).HasColumnName("brand");
                entity.Property(e => e.Model).HasColumnName("model");
                entity.Property(e => e.Power).HasColumnName("power");
                entity.Property(e => e.SerialNumber).HasColumnName("serial_number");
                entity.Property(e => e.UsageStatus).HasColumnName("usage_status");
                entity.Property(e => e.SurgeonUserId).HasColumnName("surgeon_user_id");
                entity.Property(e => e.ScannedAt).HasColumnName("scanned_at");
                entity.Property(e => e.InventoryTxnId).HasColumnName("inventory_txn_id");
                entity.Property(e => e.ChargeItemId).HasColumnName("charge_item_id");
                entity.Property(e => e.ChargeStatus).HasColumnName("charge_status");
                entity.Property(e => e.WastageReason).HasColumnName("wastage_reason");
                entity.Property(e => e.DeletedAt).HasColumnName("deleted_at");
            });

            builder.Entity<InvStockLedgerRead>(entity =>
            {
                entity.ToTable("inv_stock_ledger");
                entity.HasKey(e => e.Id);
                entity.Property(e => e.Id).HasColumnName("id");
                entity.Property(e => e.TenantId).HasColumnName("tenant_id");
                entity.Property(e => e.StoreId).HasColumnName("store_id");
                entity.Property(e => e.ItemId).HasColumnName("item_id");
                entity.Property(e => e.StockBatchId).HasColumnName("stock_batch_id");
                entity.Property(e => e.TransactionType).HasColumnName("transaction_type");
                entity.Property(e => e.ReferenceId).HasColumnName("reference_id");
                entity.Property(e => e.ReferenceNumber).HasColumnName("reference_number");
                entity.Property(e => e.QuantityOut).HasColumnName("quantity_out");
                entity.Property(e => e.UnitRate).HasColumnName("unit_rate");
                entity.Property(e => e.TotalValue).HasColumnName("total_value");
                entity.Property(e => e.TransactionDate).HasColumnName("transaction_date");
                entity.Property(e => e.CreatedAt).HasColumnName("created_at");
                entity.Property(e => e.DeletedAt).HasColumnName("deleted_at");
            });

            builder.Entity<InvStockBatchRead>(entity =>
            {
                entity.ToTable("inv_stock_batches");
                entity.HasKey(e => e.Id);
                entity.Property(e => e.Id).HasColumnName("id");
                entity.Property(e => e.TenantId).HasColumnName("tenant_id");
                entity.Property(e => e.ItemId).HasColumnName("item_id");
                entity.Property(e => e.PurchaseRate).HasColumnName("purchase_rate");
                entity.Property(e => e.CreatedAt).HasColumnName("created_at");
                entity.Property(e => e.DeletedAt).HasColumnName("deleted_at");
                entity.Property(e => e.IsActive).HasColumnName("is_active");
            });

            // Module 30: Patient Directory Hub (Feb 9, 2026)
            builder.Entity<PatientAllergy>(entity =>
            {
                entity.ToTable("patient_allergies");
                entity.HasKey(e => e.Id);
                entity.HasIndex(e => new { e.TenantId, e.PatientId });
                entity.HasQueryFilter(e => e.DeletedAt == null);
            });

            builder.Entity<PatientConsent>(entity =>
            {
                entity.ToTable("patient_consents");
                entity.HasKey(e => e.Id);
                entity.HasIndex(e => new { e.TenantId, e.PatientId });
                entity.HasQueryFilter(e => e.DeletedAt == null);
            });

            builder.Entity<PatientCommunication>(entity =>
            {
                entity.ToTable("patient_communications");
                entity.HasKey(e => e.Id);
                entity.HasIndex(e => new { e.TenantId, e.PatientId });
                entity.HasIndex(e => e.SentAt);
                entity.HasQueryFilter(e => e.DeletedAt == null);
            });

            builder.Entity<LabReport>(entity =>
            {
                entity.ToTable("lab_reports");
                entity.HasKey(e => e.Id);
                entity.HasIndex(e => new { e.TenantId, e.PatientId });
                entity.HasIndex(e => e.Status);
                entity.HasIndex(e => e.TestDefinitionId);
                entity.HasIndex(e => e.PanelId);
                entity.HasQueryFilter(e => e.DeletedAt == null);
                entity.HasOne(e => e.TestDefinition).WithMany().HasForeignKey(e => e.TestDefinitionId).OnDelete(DeleteBehavior.Restrict);
                entity.HasOne(e => e.Panel).WithMany().HasForeignKey(e => e.PanelId).OnDelete(DeleteBehavior.Restrict);
                entity.HasMany(e => e.Items).WithOne(i => i.LabReport).HasForeignKey(i => i.LabReportId).OnDelete(DeleteBehavior.Cascade);
            });

            builder.Entity<LabReportItem>(entity =>
            {
                entity.ToTable("lab_report_items");
                entity.HasKey(e => e.Id);
                entity.HasIndex(e => new { e.TenantId, e.LabReportId });
                entity.HasOne(e => e.TestDefinition).WithMany().HasForeignKey(e => e.TestDefinitionId).OnDelete(DeleteBehavior.Restrict);
            });

            builder.Entity<LaboratoryTestDefinition>(entity =>
            {
                entity.ToTable("laboratory_test_definitions");
                entity.HasKey(e => e.Id);
                entity.HasIndex(e => new { e.TenantId, e.LocalCode });
                entity.HasIndex(e => new { e.TenantId, e.Name });
                entity.HasIndex(e => e.ServiceVariantId);
                entity.HasQueryFilter(e => e.DeletedAt == null);
                entity.HasMany(e => e.SpecimenOptions).WithOne(o => o.TestDefinition!).HasForeignKey(o => o.TestDefinitionId).OnDelete(DeleteBehavior.Cascade);
                entity.HasMany(e => e.Analytes).WithOne(a => a.TestDefinition!).HasForeignKey(a => a.TestDefinitionId).OnDelete(DeleteBehavior.Cascade);
            });

            builder.Entity<LaboratoryTestSpecimenOption>(entity =>
            {
                entity.ToTable("laboratory_test_specimen_options");
                entity.HasKey(e => e.Id);
                entity.HasIndex(e => new { e.TestDefinitionId, e.SpecimenType }).IsUnique();
            });

            builder.Entity<LaboratoryPanel>(entity =>
            {
                entity.ToTable("laboratory_panels");
                entity.HasKey(e => e.Id);
                entity.HasIndex(e => new { e.TenantId, e.LocalCode });
                entity.HasIndex(e => new { e.TenantId, e.Name });
                entity.HasQueryFilter(e => e.DeletedAt == null);
                entity.HasMany(e => e.Items).WithOne(i => i.Panel!).HasForeignKey(i => i.PanelId).OnDelete(DeleteBehavior.Cascade);
            });

            builder.Entity<LaboratoryPanelItem>(entity =>
            {
                entity.ToTable("laboratory_panel_items");
                entity.HasKey(e => e.Id);
                entity.HasIndex(e => new { e.PanelId, e.TestDefinitionId }).IsUnique();
                entity.HasOne(e => e.TestDefinition).WithMany().HasForeignKey(e => e.TestDefinitionId).OnDelete(DeleteBehavior.Restrict);
            });

            builder.Entity<LaboratoryAnalyte>(entity =>
            {
                entity.ToTable("laboratory_analytes");
                entity.HasKey(e => e.Id);
                entity.HasIndex(e => new { e.TenantId, e.TestDefinitionId });
                entity.HasQueryFilter(e => e.DeletedAt == null);
            });

            builder.Entity<PatientInsurance>(entity =>
            {
                entity.ToTable("patient_insurance");
                entity.HasKey(e => e.Id);
                entity.HasIndex(e => new { e.TenantId, e.PatientId });
                entity.HasIndex(e => e.PolicyNumber);
                entity.HasQueryFilter(e => e.DeletedAt == null);
            });

            builder.Entity<PatientNote>(entity =>
            {
                entity.ToTable("patient_notes");
                entity.HasKey(e => e.Id);
                entity.HasIndex(e => new { e.TenantId, e.PatientId });
                entity.HasIndex(e => e.NoteType);
                entity.HasQueryFilter(e => e.DeletedAt == null);
            });

            builder.Entity<OpticalOrder>(entity =>
            {
                entity.ToTable("optical_orders");
                entity.HasKey(e => e.Id);
                entity.HasIndex(e => new { e.TenantId, e.PatientId });
                entity.HasIndex(e => e.Status);
                entity.HasQueryFilter(e => e.DeletedAt == null);
            });

            // Module 3.9: Consent Management (Feb 23, 2026)
            builder.Entity<ConsentFormTemplate>(entity =>
            {
                entity.ToTable("consent_form_templates");
                entity.HasKey(e => e.Id);
                entity.Property(e => e.Id).HasColumnName("id");
                entity.Property(e => e.TenantId).HasColumnName("tenant_id").IsRequired();
                entity.Property(e => e.TemplateName).HasColumnName("template_name").HasMaxLength(200).IsRequired();
                entity.Property(e => e.ConsentCategory).HasColumnName("consent_category").HasMaxLength(50).IsRequired();
                entity.Property(e => e.Description).HasColumnName("description");
                entity.Property(e => e.TemplateHtml).HasColumnName("template_html").IsRequired();
                entity.Property(e => e.RequiresPatientSignature).HasColumnName("requires_patient_signature").HasDefaultValue(true);
                entity.Property(e => e.RequiresWitnessSignature).HasColumnName("requires_witness_signature").HasDefaultValue(true);
                entity.Property(e => e.RequiresGuardianSignature).HasColumnName("requires_guardian_signature").HasDefaultValue(false);
                entity.Property(e => e.ComplianceStandards).HasColumnName("compliance_standards");
                entity.Property(e => e.Version).HasColumnName("version").HasMaxLength(20);
                entity.Property(e => e.EffectiveFrom).HasColumnName("effective_from");
                entity.Property(e => e.EffectiveTo).HasColumnName("effective_to");
                entity.Property(e => e.IsActive).HasColumnName("is_active").HasDefaultValue(true);
                entity.Property(e => e.CreatedAt).HasColumnName("created_at").IsRequired();
                entity.Property(e => e.CreatedByUserId).HasColumnName("created_by_user_id").IsRequired();
                entity.Property(e => e.UpdatedAt).HasColumnName("updated_at");
                entity.Property(e => e.DeletedAt).HasColumnName("deleted_at");
                
                entity.HasIndex(e => e.TenantId);
                entity.HasIndex(e => e.ConsentCategory);
                entity.HasIndex(e => e.IsActive);
                entity.HasQueryFilter(e => e.DeletedAt == null);
            });

            builder.Entity<CounselingConsent>(entity =>
            {
                entity.ToTable("counseling_consents");
                entity.HasKey(e => e.Id);
                entity.Property(e => e.Id).HasColumnName("id");
                entity.Property(e => e.TenantId).HasColumnName("tenant_id").IsRequired();
                entity.Property(e => e.BranchId).HasColumnName("branch_id").IsRequired();
                entity.Property(e => e.TemplateId).HasColumnName("template_id").IsRequired();
                entity.Property(e => e.SessionId).HasColumnName("session_id").IsRequired();
                entity.Property(e => e.PatientId).HasColumnName("patient_id").IsRequired();
                entity.Property(e => e.PackageId).HasColumnName("package_id");
                entity.Property(e => e.RenderedHtml).HasColumnName("rendered_html").IsRequired();
                entity.Property(e => e.PatientSignatureBase64).HasColumnName("patient_signature_base64");
                entity.Property(e => e.PatientSignedAt).HasColumnName("patient_signed_at");
                entity.Property(e => e.WitnessName).HasColumnName("witness_name").HasMaxLength(200);
                entity.Property(e => e.WitnessSignatureBase64).HasColumnName("witness_signature_base64");
                entity.Property(e => e.WitnessSignedAt).HasColumnName("witness_signed_at");
                entity.Property(e => e.GuardianName).HasColumnName("guardian_name").HasMaxLength(200);
                entity.Property(e => e.GuardianRelation).HasColumnName("guardian_relationship").HasMaxLength(50);
                entity.Property(e => e.GuardianSignatureBase64).HasColumnName("guardian_signature_base64");
                entity.Property(e => e.GuardianSignedAt).HasColumnName("guardian_signed_at");
                entity.Property(e => e.PdfUrl).HasColumnName("pdf_url");
                entity.Property(e => e.PdfGeneratedAt).HasColumnName("pdf_generated_at");
                entity.Property(e => e.ConsentStatus).HasColumnName("consent_status").HasMaxLength(20).HasDefaultValue("Draft");
                entity.Property(e => e.RevokedAt).HasColumnName("revoked_at");
                entity.Property(e => e.RevocationReason).HasColumnName("revocation_reason");
                entity.Property(e => e.RevokedByUserId).HasColumnName("revoked_by_user_id");
                entity.Property(e => e.CreatedAt).HasColumnName("created_at").IsRequired();
                entity.Property(e => e.CreatedByUserId).HasColumnName("created_by_user_id").IsRequired();
                entity.Property(e => e.UpdatedAt).HasColumnName("updated_at");
                entity.Property(e => e.DeletedAt).HasColumnName("deleted_at");
                
                entity.HasIndex(e => e.TenantId);
                entity.HasIndex(e => e.TemplateId);
                entity.HasIndex(e => e.PatientId);
                entity.HasIndex(e => e.SessionId);
                entity.HasIndex(e => e.ConsentStatus);
                entity.HasQueryFilter(e => e.DeletedAt == null);
            });

            // ============================================================================
            // SERVICE CATALOG V2 (Global — no tenant_id)
            // ============================================================================

            builder.Entity<ServiceCategory>(entity =>
            {
                entity.ToTable("service_categories");
                entity.HasKey(e => e.Id);
                entity.Property(e => e.Id).HasColumnName("id");
                entity.Property(e => e.Code).HasColumnName("code").HasMaxLength(50).IsRequired();
                entity.Property(e => e.Name).HasColumnName("name").HasMaxLength(200).IsRequired();
                entity.Property(e => e.DisplayOrder).HasColumnName("display_order").HasDefaultValue(0);
                entity.Property(e => e.IsActive).HasColumnName("is_active").HasDefaultValue(true);
                entity.HasIndex(e => e.Code).IsUnique();
            });

            builder.Entity<CatalogService>(entity =>
            {
                entity.ToTable("catalog_services");
                entity.HasKey(e => e.Id);
                entity.Property(e => e.Id).HasColumnName("id");
                entity.Property(e => e.CategoryId).HasColumnName("category_id").IsRequired();
                entity.Property(e => e.ServiceCode).HasColumnName("service_code").HasMaxLength(50);
                entity.Property(e => e.ServiceName).HasColumnName("service_name").HasMaxLength(200).IsRequired();
                entity.Property(e => e.DisplayOrder).HasColumnName("display_order").HasDefaultValue(0);
                entity.Property(e => e.IsActive).HasColumnName("is_active").HasDefaultValue(true);
                entity.HasOne(e => e.Category).WithMany(c => c.Services).HasForeignKey(e => e.CategoryId);
                entity.HasIndex(e => e.ServiceCode);
                entity.HasIndex(e => e.CategoryId);
            });

            builder.Entity<ServiceVariant>(entity =>
            {
                entity.ToTable("service_variants");
                entity.HasKey(e => e.Id);
                entity.Property(e => e.Id).HasColumnName("id");
                entity.Property(e => e.CatalogServiceId).HasColumnName("catalog_service_id").IsRequired();
                entity.Property(e => e.VariantCode).HasColumnName("variant_code").HasMaxLength(50);
                entity.Property(e => e.VariantName).HasColumnName("variant_name").HasMaxLength(200).IsRequired();
                entity.Property(e => e.PriceType).HasColumnName("price_type").HasMaxLength(20).HasDefaultValue("FIXED");
                entity.Property(e => e.HasIolOptions).HasColumnName("has_iol_options").HasDefaultValue(false);
                entity.Property(e => e.DisplayOrder).HasColumnName("display_order").HasDefaultValue(0);
                entity.Property(e => e.IsActive).HasColumnName("is_active").HasDefaultValue(true);
                entity.Property(e => e.SubOptions).HasColumnName("sub_options");
                entity.HasOne(e => e.CatalogService).WithMany(s => s.Variants).HasForeignKey(e => e.CatalogServiceId);
                entity.HasIndex(e => e.VariantCode);
                entity.HasIndex(e => e.CatalogServiceId);
            });

            builder.Entity<IolMaster>(entity =>
            {
                entity.ToTable("iol_master");
                entity.HasKey(e => e.Id);
                entity.Property(e => e.Id).HasColumnName("id");
                entity.Property(e => e.ModelName).HasColumnName("model_name").HasMaxLength(200).IsRequired();
                entity.Property(e => e.BrandManufacturer).HasColumnName("brand_manufacturer").HasMaxLength(200).IsRequired();
                entity.Property(e => e.IolType).HasColumnName("iol_type").HasMaxLength(50).IsRequired();
                entity.Property(e => e.Origin).HasColumnName("origin").HasMaxLength(50).IsRequired();
                entity.Property(e => e.IsActive).HasColumnName("is_active").HasDefaultValue(true);
                entity.HasIndex(e => e.IolType);
            });

            builder.Entity<VariantIolMapping>(entity =>
            {
                entity.ToTable("variant_iol_mapping");
                entity.HasKey(e => e.Id);
                entity.Property(e => e.Id).HasColumnName("id");
                entity.Property(e => e.VariantId).HasColumnName("variant_id").IsRequired();
                entity.Property(e => e.IolMasterId).HasColumnName("iol_master_id").IsRequired();
                entity.Property(e => e.IsDefault).HasColumnName("is_default").HasDefaultValue(false);
                entity.HasOne(e => e.Variant).WithMany(v => v.IolMappings).HasForeignKey(e => e.VariantId);
                entity.HasOne(e => e.IolMaster).WithMany().HasForeignKey(e => e.IolMasterId);
                entity.HasIndex(e => new { e.VariantId, e.IolMasterId }).IsUnique();
            });

            builder.Entity<VariantPrice>(entity =>
            {
                entity.ToTable("variant_prices");
                entity.HasKey(e => e.Id);
                entity.Property(e => e.Id).HasColumnName("id");
                entity.Property(e => e.VariantId).HasColumnName("variant_id").IsRequired();
                entity.Property(e => e.BranchId).HasColumnName("branch_id");
                entity.Property(e => e.PayerId).HasColumnName("payer_id");
                entity.Property(e => e.Amount).HasColumnName("amount").HasColumnType("numeric(12,2)");
                entity.Property(e => e.EffectiveFrom).HasColumnName("effective_from");
                entity.Property(e => e.EffectiveTo).HasColumnName("effective_to");
                entity.Property(e => e.IsActive).HasColumnName("is_active").HasDefaultValue(true);
                entity.Property(e => e.CreatedAt).HasColumnName("created_at");
                entity.Property(e => e.UpdatedAt).HasColumnName("updated_at");
                entity.Property(e => e.CreatedByUserId).HasColumnName("created_by_user_id");
                entity.Property(e => e.UpdatedByUserId).HasColumnName("updated_by_user_id");
                entity.Property(e => e.DeletedAt).HasColumnName("deleted_at");
                entity.Property(e => e.Status).HasColumnName("status").HasMaxLength(50).HasDefaultValue("active");
                entity.HasOne(e => e.Variant).WithMany(v => v.Prices).HasForeignKey(e => e.VariantId);
                entity.HasIndex(e => e.VariantId);
                entity.HasIndex(e => new { e.VariantId, e.BranchId, e.EffectiveTo });
                entity.HasQueryFilter(e => e.DeletedAt == null);
            });

            builder.Entity<IolPrice>(entity =>
            {
                entity.ToTable("iol_prices");
                entity.HasKey(e => e.Id);
                entity.Property(e => e.Id).HasColumnName("id");
                entity.Property(e => e.IolMasterId).HasColumnName("iol_master_id").IsRequired();
                entity.Property(e => e.BranchId).HasColumnName("branch_id");
                entity.Property(e => e.Amount).HasColumnName("amount").HasColumnType("numeric(12,2)");
                entity.Property(e => e.EffectiveFrom).HasColumnName("effective_from");
                entity.Property(e => e.EffectiveTo).HasColumnName("effective_to");
                entity.Property(e => e.IsActive).HasColumnName("is_active").HasDefaultValue(true);
                entity.Property(e => e.CreatedAt).HasColumnName("created_at");
                entity.Property(e => e.UpdatedAt).HasColumnName("updated_at");
                entity.Property(e => e.CreatedByUserId).HasColumnName("created_by_user_id");
                entity.Property(e => e.UpdatedByUserId).HasColumnName("updated_by_user_id");
                entity.Property(e => e.DeletedAt).HasColumnName("deleted_at");
                entity.Property(e => e.Status).HasColumnName("status").HasMaxLength(50).HasDefaultValue("active");
                entity.HasOne(e => e.IolMaster).WithMany(i => i.Prices).HasForeignKey(e => e.IolMasterId);
                entity.HasIndex(e => e.IolMasterId);
                entity.HasIndex(e => new { e.IolMasterId, e.BranchId, e.EffectiveTo });
                entity.HasQueryFilter(e => e.DeletedAt == null);
            });

            builder.Entity<BranchPricingOverride>(entity =>
            {
                entity.ToTable("branch_pricing_overrides");
                entity.HasKey(e => e.Id);
                entity.Property(e => e.Id).HasColumnName("id");
                entity.Property(e => e.TenantId).HasColumnName("tenant_id").IsRequired();
                entity.Property(e => e.BranchId).HasColumnName("branch_id").IsRequired();
                entity.Property(e => e.ItemType).HasColumnName("item_type").HasMaxLength(50).IsRequired();
                entity.Property(e => e.ItemId).HasColumnName("item_id").IsRequired();
                entity.Property(e => e.OverridePrice).HasColumnName("override_price").HasColumnType("decimal(15,2)");
                entity.Property(e => e.DiscountPercentage).HasColumnName("discount_percentage").HasColumnType("decimal(5,2)");
                entity.Property(e => e.PricingStrategy).HasColumnName("pricing_strategy").HasMaxLength(50).HasDefaultValue("Fixed");
                entity.Property(e => e.EffectiveFrom).HasColumnName("effective_from");
                entity.Property(e => e.EffectiveTo).HasColumnName("effective_to");
                entity.Property(e => e.Reason).HasColumnName("reason");
                entity.Property(e => e.ApprovedByUserId).HasColumnName("approved_by_user_id");
                entity.Property(e => e.ApprovedAt).HasColumnName("approved_at");
                entity.Property(e => e.IsActive).HasColumnName("is_active").HasDefaultValue(true);
                entity.Property(e => e.CreatedAt).HasColumnName("created_at").IsRequired();
                entity.Property(e => e.UpdatedAt).HasColumnName("updated_at").IsRequired();
                entity.Property(e => e.CreatedByUserId).HasColumnName("created_by_user_id");
                entity.Property(e => e.UpdatedByUserId).HasColumnName("updated_by_user_id");
                entity.Property(e => e.DeletedAt).HasColumnName("deleted_at");
                entity.Property(e => e.Status).HasColumnName("status").HasMaxLength(50).HasDefaultValue("active");
                
                entity.HasIndex(e => e.TenantId);
                entity.HasIndex(e => e.BranchId);
                entity.HasIndex(e => new { e.ItemType, e.ItemId });
                entity.HasIndex(e => new { e.BranchId, e.ItemType, e.ItemId, e.EffectiveFrom }).IsUnique();
                entity.HasIndex(e => new { e.IsActive, e.EffectiveFrom, e.EffectiveTo });
                entity.HasQueryFilter(e => e.DeletedAt == null);
            });

            builder.Entity<ConsultationCharge>(entity =>
            {
                entity.ToTable("consultation_charges");
                entity.HasKey(e => e.Id);
                entity.Property(e => e.Id).HasColumnName("id");
                entity.Property(e => e.TenantId).HasColumnName("tenant_id").IsRequired();
                entity.Property(e => e.BranchId).HasColumnName("branch_id").IsRequired();
                entity.Property(e => e.ChargeType).HasColumnName("charge_type").HasMaxLength(50).IsRequired();
                entity.Property(e => e.DoctorId).HasColumnName("doctor_id");
                entity.Property(e => e.DepartmentId).HasColumnName("department_id");
                entity.Property(e => e.Specialty).HasColumnName("specialty").HasMaxLength(100);
                entity.Property(e => e.ConsultationFee).HasColumnName("consultation_fee").HasColumnType("decimal(15,2)").IsRequired();
                entity.Property(e => e.FollowUpFee).HasColumnName("follow_up_fee").HasColumnType("decimal(15,2)");
                entity.Property(e => e.EmergencyConsultationFee).HasColumnName("emergency_consultation_fee").HasColumnType("decimal(15,2)");
                entity.Property(e => e.HomeVisitFee).HasColumnName("home_visit_fee").HasColumnType("decimal(15,2)");
                entity.Property(e => e.ValidityDays).HasColumnName("validity_days").HasDefaultValue(30);
                entity.Property(e => e.FreeFollowUpsCount).HasColumnName("free_follow_ups_count");
                entity.Property(e => e.AcceptsCash).HasColumnName("accepts_cash").HasDefaultValue(true);
                entity.Property(e => e.AcceptsCard).HasColumnName("accepts_card").HasDefaultValue(true);
                entity.Property(e => e.AcceptsInsurance).HasColumnName("accepts_insurance").HasDefaultValue(true);
                entity.Property(e => e.EffectiveFrom).HasColumnName("effective_from");
                entity.Property(e => e.EffectiveTo).HasColumnName("effective_to");
                entity.Property(e => e.IsActive).HasColumnName("is_active").HasDefaultValue(true);
                entity.Property(e => e.CreatedAt).HasColumnName("created_at").IsRequired();
                entity.Property(e => e.UpdatedAt).HasColumnName("updated_at").IsRequired();
                entity.Property(e => e.CreatedByUserId).HasColumnName("created_by_user_id");
                entity.Property(e => e.UpdatedByUserId).HasColumnName("updated_by_user_id");
                entity.Property(e => e.DeletedAt).HasColumnName("deleted_at");
                entity.Property(e => e.Status).HasColumnName("status").HasMaxLength(50).HasDefaultValue("active");
                
                entity.HasIndex(e => e.TenantId);
                entity.HasIndex(e => e.BranchId);
                entity.HasIndex(e => e.DoctorId);
                entity.HasIndex(e => e.DepartmentId);
                entity.HasIndex(e => e.Specialty);
                entity.HasIndex(e => e.ChargeType);
                entity.HasIndex(e => new { e.DoctorId, e.BranchId }).IsUnique().HasFilter("doctor_id IS NOT NULL");
                entity.HasIndex(e => new { e.DepartmentId, e.BranchId }).IsUnique().HasFilter("department_id IS NOT NULL");
                entity.HasQueryFilter(e => e.DeletedAt == null);
            });

            // ========================================
            // MODULE 3.12: Session Recordings & Transcription
            // ========================================
            
            builder.Entity<SessionRecording>(entity =>
            {
                entity.ToTable("session_recordings");
                entity.HasKey(e => e.Id);
                
                // Primary columns
                entity.Property(e => e.Id).HasColumnName("id").ValueGeneratedOnAdd();
                entity.Property(e => e.TenantId).HasColumnName("tenant_id").IsRequired();
                entity.Property(e => e.SessionId).HasColumnName("session_id").IsRequired();
                entity.Property(e => e.ConversationId).HasColumnName("conversation_id");
                entity.Property(e => e.DocumentId).HasColumnName("document_id");
                entity.Property(e => e.RecordingState).HasColumnName("recording_state").HasMaxLength(30).HasDefaultValue(CounselingRecordingState.Created);
                
                // Recording details
                entity.Property(e => e.RecordingType).HasColumnName("recording_type").HasMaxLength(20).HasDefaultValue("Audio");
                entity.Property(e => e.FileUrl).HasColumnName("file_url").IsRequired();
                entity.Property(e => e.FileName).HasColumnName("file_name").HasMaxLength(500).IsRequired();
                entity.Property(e => e.FileSizeBytes).HasColumnName("file_size_bytes");
                entity.Property(e => e.DurationSeconds).HasColumnName("duration_seconds");
                entity.Property(e => e.MimeType).HasColumnName("mime_type").HasMaxLength(100);
                
                // Transcription status
                entity.Property(e => e.TranscriptionStatus).HasColumnName("transcription_status").HasMaxLength(30).HasDefaultValue("Pending");
                entity.Property(e => e.TranscriptionStartedAt).HasColumnName("transcription_started_at");
                entity.Property(e => e.TranscriptionCompletedAt).HasColumnName("transcription_completed_at");
                entity.Property(e => e.TranscriptionError).HasColumnName("transcription_error");
                
                // Translation status
                entity.Property(e => e.TranslationStatus).HasColumnName("translation_status").HasMaxLength(30).HasDefaultValue("Pending");
                entity.Property(e => e.TranslationStartedAt).HasColumnName("translation_started_at");
                entity.Property(e => e.TranslationCompletedAt).HasColumnName("translation_completed_at");
                entity.Property(e => e.TranslationError).HasColumnName("translation_error");
                
                // Processing metadata
                entity.Property(e => e.AzureJobId).HasColumnName("azure_job_id").HasMaxLength(200);
                entity.Property(e => e.ProcessingDurationMs).HasColumnName("processing_duration_ms");
                
                // Status & audit
                entity.Property(e => e.Status).HasColumnName("status").HasMaxLength(20).HasDefaultValue("active");
                entity.Property(e => e.CreatedAt).HasColumnName("created_at").IsRequired();
                entity.Property(e => e.CreatedByUserId).HasColumnName("created_by_user_id");
                entity.Property(e => e.UpdatedAt).HasColumnName("updated_at");
                entity.Property(e => e.UpdatedByUserId).HasColumnName("updated_by_user_id");
                entity.Property(e => e.DeletedAt).HasColumnName("deleted_at");
                
                // Indexes
                entity.HasIndex(e => e.TenantId);
                entity.HasIndex(e => e.SessionId);
                entity.HasIndex(e => e.TranscriptionStatus);
                entity.HasIndex(e => e.CreatedAt);
                entity.HasIndex(e => e.ConversationId);
                
                // Query filter
                entity.HasQueryFilter(e => e.DeletedAt == null);
            });

            builder.Entity<CounselingConversation>(entity =>
            {
                entity.ToTable("counseling_conversations");
                entity.HasKey(e => e.Id);
                entity.Property(e => e.Id).HasColumnName("id");
                entity.Property(e => e.TenantId).HasColumnName("tenant_id").IsRequired();
                entity.Property(e => e.BranchId).HasColumnName("branch_id");
                entity.Property(e => e.SessionId).HasColumnName("session_id").IsRequired();
                entity.Property(e => e.SequenceNumber).HasColumnName("sequence_number").IsRequired();
                entity.Property(e => e.StartedAt).HasColumnName("started_at").IsRequired();
                entity.Property(e => e.EndedAt).HasColumnName("ended_at");
                entity.Property(e => e.Status).HasColumnName("status").HasMaxLength(20).HasDefaultValue(CounselingConversationStatus.Active);
                entity.Property(e => e.Version).HasColumnName("version").IsConcurrencyToken().HasDefaultValue(1);
                entity.Property(e => e.CreatedAt).HasColumnName("created_at").IsRequired();
                entity.Property(e => e.CreatedByUserId).HasColumnName("created_by_user_id").IsRequired();
                entity.Property(e => e.UpdatedAt).HasColumnName("updated_at");
                entity.Property(e => e.DeletedAt).HasColumnName("deleted_at");
                entity.HasIndex(e => new { e.SessionId, e.SequenceNumber })
                    .IsUnique()
                    .HasFilter("deleted_at IS NULL")
                    .HasDatabaseName("ux_counseling_conversations_session_sequence");
                entity.HasIndex(e => e.SessionId)
                    .IsUnique()
                    .HasFilter("deleted_at IS NULL AND ended_at IS NULL")
                    .HasDatabaseName("ux_counseling_conversations_one_open");
                entity.HasIndex(e => e.TenantId);
                entity.HasQueryFilter(e => e.DeletedAt == null);
            });

            builder.Entity<SessionTranscript>(entity =>
            {
                entity.ToTable("session_transcripts");
                entity.HasKey(e => e.Id);
                
                // Primary columns
                entity.Property(e => e.Id).HasColumnName("id").ValueGeneratedOnAdd();
                entity.Property(e => e.TenantId).HasColumnName("tenant_id").IsRequired();
                entity.Property(e => e.RecordingId).HasColumnName("recording_id").IsRequired();
                entity.Property(e => e.SessionId).HasColumnName("session_id").IsRequired();
                
                // Transcript content
                entity.Property(e => e.LanguageCode).HasColumnName("language_code").HasMaxLength(10).IsRequired();
                entity.Property(e => e.LanguageName).HasColumnName("language_name").HasMaxLength(50);
                entity.Property(e => e.IsOriginalLanguage).HasColumnName("is_original_language").HasDefaultValue(true);
                entity.Property(e => e.TranscriptText).HasColumnName("transcript_text").IsRequired();
                
                // Subtitle files
                entity.Property(e => e.VttFileUrl).HasColumnName("vtt_file_url");
                entity.Property(e => e.SrtFileUrl).HasColumnName("srt_file_url");
                
                // Quality metrics
                entity.Property(e => e.ConfidenceScore).HasColumnName("confidence_score").HasPrecision(5, 4);
                entity.Property(e => e.WordCount).HasColumnName("word_count");
                entity.Property(e => e.CharacterCount).HasColumnName("character_count");
                
                // Timestamps (JSONB)
                entity.Property(e => e.Segments).HasColumnName("segments").HasColumnType("jsonb");
                
                // Status & audit
                entity.Property(e => e.Status).HasColumnName("status").HasMaxLength(20).HasDefaultValue("active");
                entity.Property(e => e.CreatedAt).HasColumnName("created_at").IsRequired();
                entity.Property(e => e.UpdatedAt).HasColumnName("updated_at");
                entity.Property(e => e.DeletedAt).HasColumnName("deleted_at");
                
                // Indexes
                entity.HasIndex(e => e.TenantId);
                entity.HasIndex(e => e.RecordingId);
                entity.HasIndex(e => e.SessionId);
                entity.HasIndex(e => e.LanguageCode);
                entity.HasIndex(e => new { e.RecordingId, e.LanguageCode }).IsUnique().HasFilter("deleted_at IS NULL");
                
                // Query filter
                entity.HasQueryFilter(e => e.DeletedAt == null);
            });
            
            builder.Entity<TranscriptEdit>(entity =>
            {
                entity.ToTable("transcript_edits");
                entity.HasKey(e => e.Id);
                
                // Primary columns
                entity.Property(e => e.Id).HasColumnName("id").ValueGeneratedOnAdd();
                entity.Property(e => e.TenantId).HasColumnName("tenant_id").IsRequired();
                entity.Property(e => e.TranscriptId).HasColumnName("transcript_id").IsRequired();
                
                // Edit details
                entity.Property(e => e.SegmentIndex).HasColumnName("segment_index").IsRequired();
                entity.Property(e => e.OriginalText).HasColumnName("original_text").IsRequired();
                entity.Property(e => e.EditedText).HasColumnName("edited_text").IsRequired();
                entity.Property(e => e.EditReason).HasColumnName("edit_reason").HasMaxLength(200);
                
                // Audit (edit history for legal compliance)
                entity.Property(e => e.CreatedAt).HasColumnName("created_at").IsRequired();
                entity.Property(e => e.CreatedByUserId).HasColumnName("created_by_user_id").IsRequired();
                
                // Indexes
                entity.HasIndex(e => e.TenantId);
                entity.HasIndex(e => e.TranscriptId);
                entity.HasIndex(e => e.CreatedByUserId);
                entity.HasIndex(e => e.CreatedAt);
            });

            // ========================================
            // FOLLOW-UP CENTER: Read-only ip-management views
            // Tables created by migrations 81 (patient_journey) and 85 (discharge_summary)
            // ========================================

            builder.Entity<PatientJourneyReadOnly>(entity =>
            {
                entity.ToTable("patient_journey");
                entity.HasKey(e => e.Id);
                entity.Property(e => e.Id).HasColumnName("id");
                entity.Property(e => e.TenantId).HasColumnName("tenant_id");
                entity.Property(e => e.PatientId).HasColumnName("patient_id");
                entity.Property(e => e.CounselingSessionId).HasColumnName("counseling_session_id");
                entity.Property(e => e.PackageAmount).HasColumnName("package_amount");
                entity.Property(e => e.BranchId).HasColumnName("branch_id");
                entity.Property(e => e.Uhid).HasColumnName("uhid").HasMaxLength(50);
                entity.Property(e => e.ClinicalState).HasColumnName("clinical_state").HasMaxLength(30);
                entity.Property(e => e.IsDischarged).HasColumnName("is_discharged");
                entity.Property(e => e.AdmittedAt).HasColumnName("admitted_at");
                entity.Property(e => e.DischargedAt).HasColumnName("discharged_at");
                entity.Property(e => e.ProcedureName).HasColumnName("procedure_name").HasMaxLength(300);
                entity.Property(e => e.PrimarySurgeonId).HasColumnName("primary_surgeon_id");
                entity.Property(e => e.CreatedAt).HasColumnName("created_at");
                entity.Property(e => e.DeletedAt).HasColumnName("deleted_at");
                entity.HasOne(e => e.Patient).WithMany().HasForeignKey(e => e.PatientId);
                entity.HasIndex(e => e.TenantId);
                entity.HasIndex(e => e.PatientId);
                entity.HasIndex(e => e.IsDischarged);
            });

            builder.Entity<VitalSignReadOnly>(entity =>
            {
                entity.ToTable("vital_sign", t => t.ExcludeFromMigrations());
                entity.HasKey(e => e.Id);
                entity.Property(e => e.Id).HasColumnName("id");
                entity.Property(e => e.TenantId).HasColumnName("tenant_id");
                entity.Property(e => e.JourneyId).HasColumnName("journey_id");
                entity.Property(e => e.RecordedAt).HasColumnName("recorded_at");
                entity.Property(e => e.Temperature).HasColumnName("temperature");
                entity.Property(e => e.BloodPressureSystolic).HasColumnName("blood_pressure_systolic");
                entity.Property(e => e.BloodPressureDiastolic).HasColumnName("blood_pressure_diastolic");
                entity.Property(e => e.PulseRate).HasColumnName("pulse_rate");
                entity.Property(e => e.RespiratoryRate).HasColumnName("respiratory_rate");
                entity.Property(e => e.OxygenSaturation).HasColumnName("oxygen_saturation");
                entity.Property(e => e.Weight).HasColumnName("weight");
                entity.Property(e => e.Height).HasColumnName("height");
                entity.Property(e => e.Notes).HasColumnName("notes");
                entity.Property(e => e.Context).HasColumnName("context");
                entity.Property(e => e.RecordedByUserId).HasColumnName("recorded_by_user_id");
                entity.Property(e => e.CreatedAt).HasColumnName("created_at");
                entity.Property(e => e.UpdatedAt).HasColumnName("updated_at");
                entity.Property(e => e.DeletedAt).HasColumnName("deleted_at");
                entity.Property(e => e.Status).HasColumnName("status");
            });

            builder.Entity<DischargeSummaryReadOnly>(entity =>
            {
                entity.ToTable("discharge_summary");
                entity.HasKey(e => e.Id);
                entity.Property(e => e.Id).HasColumnName("id");
                entity.Property(e => e.TenantId).HasColumnName("tenant_id");
                entity.Property(e => e.PatientJourneyId).HasColumnName("patient_journey_id");
                entity.Property(e => e.DischargeDate).HasColumnName("discharge_date").HasColumnType("date");
                entity.Property(e => e.ConditionAtDischarge).HasColumnName("condition_at_discharge").HasMaxLength(20);
                entity.Property(e => e.ProceduresPerformed).HasColumnName("procedures_performed").HasColumnType("jsonb");
                entity.Property(e => e.SummaryStatus).HasColumnName("summary_status").HasMaxLength(20);
                entity.Property(e => e.FinalBillAmount).HasColumnName("final_bill_amount").HasColumnType("decimal(12,2)");
                entity.Property(e => e.FinalizedAt).HasColumnName("finalized_at");
                entity.Property(e => e.DeletedAt).HasColumnName("deleted_at");
                entity.HasIndex(e => e.PatientJourneyId);
            });

            builder.Entity<AuthService.Models.Branch.WardRef>(entity =>
            {
                entity.ToTable("ward", t => t.ExcludeFromMigrations());
                entity.HasKey(e => e.Id);
                entity.Property(e => e.Id).HasColumnName("id");
                entity.Property(e => e.TenantId).HasColumnName("tenant_id");
                entity.Property(e => e.BranchId).HasColumnName("branch_id");
                entity.Property(e => e.WardName).HasColumnName("ward_name");
                entity.Property(e => e.WardType).HasColumnName("ward_type");
                entity.Property(e => e.IsActive).HasColumnName("is_active");
                entity.Property(e => e.DeletedAt).HasColumnName("deleted_at");
            });

            builder.Entity<CcmsCoverageCaseReadOnly>(entity =>
            {
                entity.ToTable("ccms_coverage_cases", t => t.ExcludeFromMigrations());
                entity.HasKey(e => e.Id);
                entity.Property(e => e.Id).HasColumnName("id");
                entity.Property(e => e.JourneyId).HasColumnName("journey_id");
                entity.Property(e => e.PatientId).HasColumnName("patient_id");
                entity.Property(e => e.BranchId).HasColumnName("branch_id");
                entity.Property(e => e.PayerType).HasColumnName("payer_type");
                entity.Property(e => e.InsuranceProviderId).HasColumnName("insurance_provider_id");
                entity.Property(e => e.CurrentState).HasColumnName("current_state");
                entity.Property(e => e.ApprovedAmount).HasColumnName("approved_amount");
                entity.Property(e => e.DeletedAt).HasColumnName("deleted_at");
            });

            // ─── Explicit table-name overrides: DB uses singular names ───────────────
            builder.Entity<PostOpCareSchedule>().ToTable("post_op_care_schedule");
            builder.Entity<PostOpVisit>(entity =>
            {
                entity.ToTable("post_op_visit");
                // DB uses schedule_id; the model class attr says post_op_care_schedule_id
                entity.Property(e => e.PostOpCareScheduleId).HasColumnName("schedule_id");
            });

            builder.Entity<CounsellingPackageTemplate>(entity =>
            {
                entity.ToTable("counselling_package_templates");
                entity.HasKey(e => e.Id);
                entity.HasIndex(e => new { e.TenantId, e.Code }).IsUnique()
                    .HasDatabaseName("uq_counselling_pkg_tpl_code");
                entity.HasQueryFilter(e => e.DeletedAt == null);
            });

            // ============================================================================
            // MASTER DATA MODULE (April 2026)
            // ============================================================================

            builder.Entity<MasterValue>(entity =>
            {
                entity.ToTable("master_value", "master");
                entity.HasKey(e => e.Id);
                entity.Property(e => e.Id).HasColumnName("id").ValueGeneratedOnAdd();
                entity.Property(e => e.TenantId).HasColumnName("tenant_id").IsRequired();
                entity.Property(e => e.GroupKey).HasColumnName("group_key").HasMaxLength(100).IsRequired();
                entity.Property(e => e.EntityType).HasColumnName("entity_type").HasMaxLength(150).IsRequired();
                entity.Property(e => e.Code).HasColumnName("code").HasMaxLength(150).IsRequired();
                entity.Property(e => e.Label).HasColumnName("label").HasMaxLength(500).IsRequired();
                entity.Property(e => e.Description).HasColumnName("description");
                entity.Property(e => e.Metadata).HasColumnName("metadata").HasColumnType("jsonb").HasDefaultValue("{}");
                entity.Property(e => e.SortOrder).HasColumnName("sort_order").HasDefaultValue(0);
                entity.Property(e => e.IsActive).HasColumnName("is_active").HasDefaultValue(true);
                entity.Property(e => e.IsSystemLocked).HasColumnName("is_system_locked").HasDefaultValue(false);
                entity.Property(e => e.DisabledAt).HasColumnName("disabled_at");
                entity.Property(e => e.DisabledByUserId).HasColumnName("disabled_by_user_id");
                entity.Property(e => e.DisabledReason).HasColumnName("disabled_reason").HasMaxLength(500);
                entity.Property(e => e.CreatedAt).HasColumnName("created_at").IsRequired();
                entity.Property(e => e.UpdatedAt).HasColumnName("updated_at").IsRequired();
                entity.Property(e => e.CreatedByUserId).HasColumnName("created_by_user_id");
                entity.Property(e => e.UpdatedByUserId).HasColumnName("updated_by_user_id");
                entity.Property(e => e.DeletedAt).HasColumnName("deleted_at");

                entity.HasIndex(e => new { e.TenantId, e.GroupKey }).HasDatabaseName("idx_mv_tenant_group");
                entity.HasIndex(e => new { e.TenantId, e.EntityType }).HasDatabaseName("idx_mv_tenant_type");
                entity.HasIndex(e => new { e.TenantId, e.EntityType, e.Code }).IsUnique()
                    .HasDatabaseName("uq_master_value_tenant_type_code");
                entity.HasQueryFilter(e => e.DeletedAt == null);
            });

            builder.Entity<EntityTypeRegistry>(entity =>
            {
                entity.ToTable("entity_type_registry", "master");
                entity.HasKey(e => e.EntityType);
                entity.Property(e => e.EntityType).HasColumnName("entity_type").HasMaxLength(150);
                entity.Property(e => e.GroupKey).HasColumnName("group_key").HasMaxLength(100).IsRequired();
                entity.Property(e => e.DisplayName).HasColumnName("display_name").HasMaxLength(200).IsRequired();
                entity.Property(e => e.Description).HasColumnName("description");
                entity.Property(e => e.TabLabel).HasColumnName("tab_label").HasMaxLength(100);
                entity.Property(e => e.AllowCustomFields).HasColumnName("allow_custom_fields").HasDefaultValue(false);
                entity.Property(e => e.SortOrder).HasColumnName("sort_order").HasDefaultValue(0);
            });

            // L-PORTAL-01 S1 — Portal identity tables (PostgreSQL filtered unique indexes)
            builder.Entity<PortalInvitation>(entity =>
            {
                entity.ToTable("portal_invitations");
                entity.HasKey(e => e.Id);
                entity.Property(e => e.Id).HasColumnName("id");
                entity.Property(e => e.TenantId).HasColumnName("tenant_id").IsRequired();
                entity.Property(e => e.PatientId).HasColumnName("patient_id").IsRequired();
                entity.Property(e => e.DeliveryChannel).HasColumnName("delivery_channel").HasMaxLength(50).IsRequired();
                entity.Property(e => e.TokenHash).HasColumnName("token_hash").HasMaxLength(128).IsRequired();
                entity.Property(e => e.ExpiresAt).HasColumnName("expires_at").IsRequired();
                entity.Property(e => e.UsedAt).HasColumnName("used_at");
                entity.Property(e => e.SupersededAt).HasColumnName("superseded_at");
                entity.Property(e => e.SupersededByInvitationId).HasColumnName("superseded_by_invitation_id");
                entity.Property(e => e.CreatedByUserId).HasColumnName("created_by_user_id").IsRequired();
                entity.Property(e => e.CreatedAt).HasColumnName("created_at").IsRequired();
                entity.Property(e => e.Status).HasColumnName("status").HasMaxLength(30).IsRequired();
                entity.HasIndex(e => e.TenantId).HasDatabaseName("ix_portal_invitations_tenant");
                entity.HasIndex(e => new { e.TenantId, e.PatientId }).HasDatabaseName("ix_portal_invitations_tenant_patient");
                entity.HasIndex(e => e.TokenHash).HasDatabaseName("ix_portal_invitations_token_hash");
            });

            builder.Entity<PortalPatientLink>(entity =>
            {
                entity.ToTable("portal_patient_links");
                entity.HasKey(e => e.Id);
                entity.Property(e => e.Id).HasColumnName("id");
                entity.Property(e => e.TenantId).HasColumnName("tenant_id").IsRequired();
                entity.Property(e => e.PrincipalUserId).HasColumnName("principal_user_id").IsRequired();
                entity.Property(e => e.PatientId).HasColumnName("patient_id").IsRequired();
                entity.Property(e => e.VerificationStatus).HasColumnName("verification_status").HasMaxLength(30).IsRequired();
                entity.Property(e => e.VerificationMethodCode).HasColumnName("verification_method_code").HasMaxLength(100);
                entity.Property(e => e.VerifiedAt).HasColumnName("verified_at");
                entity.Property(e => e.VerifiedByUserId).HasColumnName("verified_by_user_id");
                entity.Property(e => e.RevokedAt).HasColumnName("revoked_at");
                entity.Property(e => e.RevokedReason).HasColumnName("revoked_reason").HasMaxLength(500);
                entity.Property(e => e.CreatedAt).HasColumnName("created_at").IsRequired();
                entity.HasIndex(e => e.TenantId).HasDatabaseName("ix_portal_patient_links_tenant");
                entity.HasIndex(e => new { e.TenantId, e.PatientId })
                    .IsUnique()
                    .HasFilter("verification_status = 'verified' AND revoked_at IS NULL")
                    .HasDatabaseName("ux_portal_patient_links_active_verified_patient");
                entity.HasIndex(e => new { e.TenantId, e.PrincipalUserId })
                    .IsUnique()
                    .HasFilter("verification_status = 'verified' AND revoked_at IS NULL")
                    .HasDatabaseName("ux_portal_patient_links_active_verified_principal");
            });

            builder.Entity<PortalRemediationRequest>(entity =>
            {
                entity.ToTable("portal_remediation_requests");
                entity.HasKey(e => e.Id);
                entity.Property(e => e.Id).HasColumnName("id");
                entity.Property(e => e.TenantId).HasColumnName("tenant_id").IsRequired();
                entity.Property(e => e.LinkId).HasColumnName("link_id").IsRequired();
                entity.Property(e => e.RequestedByUserId).HasColumnName("requested_by_user_id").IsRequired();
                entity.Property(e => e.ApprovedByUserId).HasColumnName("approved_by_user_id");
                entity.Property(e => e.Operation).HasColumnName("operation").HasMaxLength(50).IsRequired();
                entity.Property(e => e.Reason).HasColumnName("reason").HasMaxLength(1000).IsRequired();
                entity.Property(e => e.Status).HasColumnName("status").HasMaxLength(30).IsRequired();
                entity.Property(e => e.CreatedAt).HasColumnName("created_at").IsRequired();
                entity.Property(e => e.ResolvedAt).HasColumnName("resolved_at");
                entity.HasIndex(e => e.TenantId).HasDatabaseName("ix_portal_remediation_requests_tenant");
                entity.HasIndex(e => new { e.TenantId, e.LinkId }).HasDatabaseName("ix_portal_remediation_requests_tenant_link");
            });
        }

        private Guid GetCurrentTenantId()
        {
            // Try HttpContext.Items (set during login)
            var tenantId = _httpContextAccessor?.HttpContext?.Items["TenantId"] as Guid?;
            
            // Try JWT claims (for authenticated API calls)
            if (tenantId == null)
            {
                var tenantIdClaim = _httpContextAccessor?.HttpContext?.User?.FindFirst("tenant_id")?.Value;
                if (!string.IsNullOrEmpty(tenantIdClaim) && Guid.TryParse(tenantIdClaim, out var parsedTenantId))
                {
                    tenantId = parsedTenantId;
                }
            }
            
            // Try X-Tenant-ID header
            if (tenantId == null)
            {
                var tenantIdHeader = _httpContextAccessor?.HttpContext?.Request.Headers["X-Tenant-ID"].FirstOrDefault();
                if (!string.IsNullOrEmpty(tenantIdHeader) && Guid.TryParse(tenantIdHeader, out var parsedTenantId))
                {
                    tenantId = parsedTenantId;
                }
            }
            
            return tenantId ?? Guid.Parse("11111111-1111-1111-1111-111111111111"); // Default to test tenant
        }

        public override async Task<int> SaveChangesAsync(CancellationToken cancellationToken = default)
        {
            // Set tenant context for RLS before executing queries
            await SetTenantContextAsync();
            
            foreach (var entry in ChangeTracker.Entries<AppUser>()
                .Where(e => e.State == EntityState.Modified))
            {
                entry.Property(p => p.UpdatedAt).CurrentValue = DateTime.UtcNow;
            }

            foreach (var entry in ChangeTracker.Entries<AppRole>()
                .Where(e => e.State == EntityState.Modified))
            {
                entry.Property(p => p.UpdatedAt).CurrentValue = DateTime.UtcNow;
            }

            foreach (var entry in ChangeTracker.Entries<OpdBill>()
                .Where(e => e.State == EntityState.Modified))
            {
                var rowVersion = entry.Property(b => b.RowVersion);
                rowVersion.CurrentValue = rowVersion.OriginalValue + 1;
            }

            // Phase 3I Slice 7 (PD-S7-01) — bump CounselingSession.Version on every tracked mutation,
            // mirroring the OpdBill.RowVersion pattern above.
            foreach (var entry in ChangeTracker.Entries<CounselingSession>()
                .Where(e => e.State == EntityState.Modified))
            {
                var version = entry.Property(s => s.Version);
                version.CurrentValue = version.OriginalValue + 1;
            }

            try
            {
                return await base.SaveChangesAsync(cancellationToken);
            }
            catch (DbUpdateConcurrencyException ex)
            {
                if (ex.Entries.Any(e => e.Entity is OpdBill))
                    throw new InvalidOperationException(BillConcurrency.StaleMessage);
                if (ex.Entries.Any(e => e.Entity is CounselingSession))
                    throw new InvalidOperationException(SessionConcurrency.StaleMessage);
                throw;
            }
        }
    }
}
