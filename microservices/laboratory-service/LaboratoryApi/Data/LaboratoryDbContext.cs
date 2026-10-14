using LaboratoryApi.Domain;
using Microsoft.EntityFrameworkCore;

namespace LaboratoryApi.Data;

/// <summary>
/// Laboratory / Enterprise LMS domain DbContext.
/// Owns <c>lms_*</c> tables only — never legacy <c>laboratory_*</c>.
/// </summary>
public class LaboratoryDbContext : DbContext
{
    public LaboratoryDbContext(DbContextOptions<LaboratoryDbContext> options) : base(options) { }

    public DbSet<LmsCatalogueItem> CatalogueItems => Set<LmsCatalogueItem>();
    public DbSet<LmsCatalogueVersion> CatalogueVersions => Set<LmsCatalogueVersion>();
    public DbSet<LmsCataloguePanelComponent> CataloguePanelComponents => Set<LmsCataloguePanelComponent>();
    public DbSet<LmsCatalogueBranchApplicability> CatalogueBranchApplicability => Set<LmsCatalogueBranchApplicability>();

    public DbSet<LmsOrder> Orders => Set<LmsOrder>();
    public DbSet<LmsOrderVersion> OrderVersions => Set<LmsOrderVersion>();
    public DbSet<LmsOrderSelection> OrderSelections => Set<LmsOrderSelection>();
    public DbSet<LmsOrderTest> OrderTests => Set<LmsOrderTest>();
    public DbSet<LmsOrderNumberSequence> OrderNumberSequences => Set<LmsOrderNumberSequence>();
    public DbSet<LmsOrderIdempotencyRecord> OrderIdempotencyRecords => Set<LmsOrderIdempotencyRecord>();

    public DbSet<LmsCollectionTask> CollectionTasks => Set<LmsCollectionTask>();
    public DbSet<LmsCollectionTaskOrderTest> CollectionTaskOrderTests => Set<LmsCollectionTaskOrderTest>();
    public DbSet<LmsCollectionIdempotencyRecord> CollectionIdempotencyRecords => Set<LmsCollectionIdempotencyRecord>();
    public DbSet<LmsCollectionTaskNumberSequence> CollectionTaskNumberSequences => Set<LmsCollectionTaskNumberSequence>();

    public DbSet<LmsSpecimen> Specimens => Set<LmsSpecimen>();
    public DbSet<LmsSpecimenOrderTest> SpecimenOrderTests => Set<LmsSpecimenOrderTest>();
    public DbSet<LmsSpecimenIdempotencyRecord> SpecimenIdempotencyRecords => Set<LmsSpecimenIdempotencyRecord>();
    public DbSet<LmsAccessionNumberSequence> AccessionNumberSequences => Set<LmsAccessionNumberSequence>();
    public DbSet<LmsSpecimenBarcodeConfiguration> SpecimenBarcodeConfigurations => Set<LmsSpecimenBarcodeConfiguration>();
    public DbSet<LmsBarcodeNumberSequence> BarcodeNumberSequences => Set<LmsBarcodeNumberSequence>();
    public DbSet<LmsSpecimenBarcode> SpecimenBarcodes => Set<LmsSpecimenBarcode>();
    public DbSet<LmsSpecimenLabelPrintEvent> SpecimenLabelPrintEvents => Set<LmsSpecimenLabelPrintEvent>();

    public DbSet<LmsResult> Results => Set<LmsResult>();
    public DbSet<LmsResultVersion> ResultVersions => Set<LmsResultVersion>();
    public DbSet<LmsResultIdempotencyRecord> ResultIdempotencyRecords => Set<LmsResultIdempotencyRecord>();
    public DbSet<LmsCriticalResultEvent> CriticalResultEvents => Set<LmsCriticalResultEvent>();

    public DbSet<LmsReport> Reports => Set<LmsReport>();
    public DbSet<LmsReportVersion> ReportVersions => Set<LmsReportVersion>();
    public DbSet<LmsReportVersionSource> ReportVersionSources => Set<LmsReportVersionSource>();
    public DbSet<LmsReportDraftSourceClaim> ReportDraftSourceClaims => Set<LmsReportDraftSourceClaim>();
    public DbSet<LmsReportIdempotencyRecord> ReportIdempotencyRecords => Set<LmsReportIdempotencyRecord>();
    public DbSet<LmsReportNumberConfiguration> ReportNumberConfigurations => Set<LmsReportNumberConfiguration>();
    public DbSet<LmsReportNumberSequence> ReportNumberSequences => Set<LmsReportNumberSequence>();

    public DbSet<LmsReportPdfTemplateVersion> ReportPdfTemplateVersions => Set<LmsReportPdfTemplateVersion>();
    public DbSet<LmsReportPdfSignatory> ReportPdfSignatories => Set<LmsReportPdfSignatory>();
    public DbSet<LmsReportOfficialPdfArtifact> ReportOfficialPdfArtifacts => Set<LmsReportOfficialPdfArtifact>();
    public DbSet<LmsReportOfficialPdfJob> ReportOfficialPdfJobs => Set<LmsReportOfficialPdfJob>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        base.OnModelCreating(modelBuilder);

        modelBuilder.Entity<LmsCatalogueItem>(e =>
        {
            e.ToTable("lms_catalogue_items");
            e.HasKey(x => x.Id);
            e.Property(x => x.Id).HasColumnName("id");
            e.Property(x => x.TenantId).HasColumnName("tenant_id").IsRequired();
            e.Property(x => x.CatalogueType).HasColumnName("catalogue_type").HasMaxLength(32).IsRequired();
            e.Property(x => x.CurrentActiveVersionId).HasColumnName("current_active_version_id");
            e.Property(x => x.LatestVersionId).HasColumnName("latest_version_id");
            e.Property(x => x.CreatedAt).HasColumnName("created_at").IsRequired();
            e.Property(x => x.CreatedBy).HasColumnName("created_by").IsRequired();
            e.Property(x => x.UpdatedAt).HasColumnName("updated_at");
            e.Property(x => x.UpdatedBy).HasColumnName("updated_by");
            e.Property(x => x.IsDeleted).HasColumnName("is_deleted").HasDefaultValue(false);
            e.Property(x => x.DeletedAt).HasColumnName("deleted_at");
            e.Property(x => x.DeletedBy).HasColumnName("deleted_by");

            e.HasIndex(x => new { x.TenantId, x.CatalogueType });
            e.HasIndex(x => x.TenantId);

            e.HasOne(x => x.CurrentActiveVersion)
                .WithMany()
                .HasForeignKey(x => x.CurrentActiveVersionId)
                .OnDelete(DeleteBehavior.Restrict);

            e.HasOne(x => x.LatestVersion)
                .WithMany()
                .HasForeignKey(x => x.LatestVersionId)
                .OnDelete(DeleteBehavior.Restrict);

            e.HasMany(x => x.Versions)
                .WithOne(v => v.CatalogueItem!)
                .HasForeignKey(v => v.CatalogueItemId)
                .OnDelete(DeleteBehavior.Restrict);
        });

        modelBuilder.Entity<LmsCatalogueVersion>(e =>
        {
            e.ToTable("lms_catalogue_versions");
            e.HasKey(x => x.Id);
            e.Property(x => x.Id).HasColumnName("id");
            e.Property(x => x.TenantId).HasColumnName("tenant_id").IsRequired();
            e.Property(x => x.CatalogueItemId).HasColumnName("catalogue_item_id").IsRequired();
            e.Property(x => x.VersionNumber).HasColumnName("version_number").IsRequired();
            e.Property(x => x.Status).HasColumnName("status").HasMaxLength(32).IsRequired();
            e.Property(x => x.EffectiveFrom).HasColumnName("effective_from");
            e.Property(x => x.EffectiveTo).HasColumnName("effective_to");
            e.Property(x => x.InternalOrderCode).HasColumnName("internal_order_code").HasMaxLength(64).IsRequired();
            e.Property(x => x.DisplayName).HasColumnName("display_name").HasMaxLength(256).IsRequired();
            e.Property(x => x.Synonyms).HasColumnName("synonyms").HasMaxLength(1024);
            e.Property(x => x.ExternalMappingsJson).HasColumnName("external_mappings_json");
            e.Property(x => x.Discipline).HasColumnName("discipline").HasMaxLength(64).IsRequired();
            e.Property(x => x.Method).HasColumnName("method").HasMaxLength(256);
            e.Property(x => x.Classification).HasColumnName("classification").HasMaxLength(32).IsRequired();
            e.Property(x => x.Orderable).HasColumnName("orderable").HasDefaultValue(true);
            e.Property(x => x.PriorityConfigRef).HasColumnName("priority_config_ref").HasMaxLength(128);
            e.Property(x => x.AgeSexRestrictionConfigRef).HasColumnName("age_sex_restriction_config_ref").HasMaxLength(128);
            e.Property(x => x.ConsentRequired).HasColumnName("consent_required");
            e.Property(x => x.PreparationInstruction).HasColumnName("preparation_instruction").HasMaxLength(2000);
            e.Property(x => x.DuplicateIntervalConfigRef).HasColumnName("duplicate_interval_config_ref").HasMaxLength(128);
            e.Property(x => x.AddOnWindowConfigRef).HasColumnName("add_on_window_config_ref").HasMaxLength(128);
            e.Property(x => x.SpecimenTypeRef).HasColumnName("specimen_type_ref").HasMaxLength(128);
            e.Property(x => x.ContainerRef).HasColumnName("container_ref").HasMaxLength(128);
            e.Property(x => x.RequiredVolume).HasColumnName("required_volume").HasMaxLength(64);
            e.Property(x => x.PatientPreparation).HasColumnName("patient_preparation").HasMaxLength(2000);
            e.Property(x => x.CollectionTiming).HasColumnName("collection_timing").HasMaxLength(256);
            e.Property(x => x.StabilityNotes).HasColumnName("stability_notes").HasMaxLength(2000);
            e.Property(x => x.TemperatureLightProtection).HasColumnName("temperature_light_protection").HasMaxLength(512);
            e.Property(x => x.RejectionCriteria).HasColumnName("rejection_criteria").HasMaxLength(2000);
            e.Property(x => x.StorageRequirements).HasColumnName("storage_requirements").HasMaxLength(1000);
            e.Property(x => x.TransportRequirements).HasColumnName("transport_requirements").HasMaxLength(1000);
            e.Property(x => x.PerformingSiteRef).HasColumnName("performing_site_ref").HasMaxLength(128);
            e.Property(x => x.BenchRef).HasColumnName("bench_ref").HasMaxLength(128);
            e.Property(x => x.InstrumentRef).HasColumnName("instrument_ref").HasMaxLength(128);
            e.Property(x => x.ExpectedTatConfigRef).HasColumnName("expected_tat_config_ref").HasMaxLength(128);
            e.Property(x => x.OperatingHoursConfigRef).HasColumnName("operating_hours_config_ref").HasMaxLength(128);
            e.Property(x => x.RoutingConfigRef).HasColumnName("routing_config_ref").HasMaxLength(128);
            e.Property(x => x.CapacityConfigRef).HasColumnName("capacity_config_ref").HasMaxLength(128);
            e.Property(x => x.ReferralPartnerRef).HasColumnName("referral_partner_ref").HasMaxLength(128);
            e.Property(x => x.ResultDatatype).HasColumnName("result_datatype").HasMaxLength(64);
            e.Property(x => x.PermittedUnits).HasColumnName("permitted_units").HasMaxLength(256);
            e.Property(x => x.ReferenceIntervalConfigRef).HasColumnName("reference_interval_config_ref").HasMaxLength(128);
            e.Property(x => x.ReportabilityLimitConfigRef).HasColumnName("reportability_limit_config_ref").HasMaxLength(128);
            e.Property(x => x.FlagConfigRef).HasColumnName("flag_config_ref").HasMaxLength(128);
            e.Property(x => x.CriticalThresholdConfigRef).HasColumnName("critical_threshold_config_ref").HasMaxLength(128);
            e.Property(x => x.DeltaCheckConfigRef).HasColumnName("delta_check_config_ref").HasMaxLength(128);
            e.Property(x => x.CommentTemplateRef).HasColumnName("comment_template_ref").HasMaxLength(128);
            e.Property(x => x.AutoverificationEligibilityRef).HasColumnName("autoverification_eligibility_ref").HasMaxLength(128);
            e.Property(x => x.ServiceCatalogRef).HasColumnName("service_catalog_ref").HasMaxLength(128);
            e.Property(x => x.PayerMappingRef).HasColumnName("payer_mapping_ref").HasMaxLength(128);
            e.Property(x => x.PackageMembershipRef).HasColumnName("package_membership_ref").HasMaxLength(128);
            e.Property(x => x.AuthorizationRequired).HasColumnName("authorization_required");
            e.Property(x => x.AccreditationScopeStatus).HasColumnName("accreditation_scope_status").HasMaxLength(128);
            e.Property(x => x.OwnerRef).HasColumnName("owner_ref").HasMaxLength(128);
            e.Property(x => x.ApproverRef).HasColumnName("approver_ref").HasMaxLength(128);
            e.Property(x => x.ChangeReason).HasColumnName("change_reason").HasMaxLength(2000);
            e.Property(x => x.CreatedAt).HasColumnName("created_at").IsRequired();
            e.Property(x => x.CreatedBy).HasColumnName("created_by").IsRequired();
            e.Property(x => x.UpdatedAt).HasColumnName("updated_at");
            e.Property(x => x.UpdatedBy).HasColumnName("updated_by");
            e.Property(x => x.SubmittedAt).HasColumnName("submitted_at");
            e.Property(x => x.SubmittedBy).HasColumnName("submitted_by");
            e.Property(x => x.ApprovedAt).HasColumnName("approved_at");
            e.Property(x => x.ApprovedBy).HasColumnName("approved_by");
            e.Property(x => x.ActivatedAt).HasColumnName("activated_at");
            e.Property(x => x.ActivatedBy).HasColumnName("activated_by");
            e.Property(x => x.RetiredAt).HasColumnName("retired_at");
            e.Property(x => x.RetiredBy).HasColumnName("retired_by");
            e.Property(x => x.SupersededAt).HasColumnName("superseded_at");
            e.Property(x => x.SupersededBy).HasColumnName("superseded_by");
            e.Property(x => x.SupersededByVersionId).HasColumnName("superseded_by_version_id");
            e.Property(x => x.RowVersion).HasColumnName("row_version").IsConcurrencyToken();

            e.HasIndex(x => new { x.TenantId, x.InternalOrderCode });
            e.HasIndex(x => new { x.TenantId, x.DisplayName });
            e.HasIndex(x => new { x.CatalogueItemId, x.VersionNumber }).IsUnique();
            e.HasIndex(x => new { x.TenantId, x.Status });
            e.HasIndex(x => new { x.TenantId, x.Discipline });
            e.HasIndex(x => new { x.TenantId, x.Classification });

            e.HasMany(x => x.PanelComponents)
                .WithOne(c => c.PanelVersion!)
                .HasForeignKey(c => c.PanelVersionId)
                .OnDelete(DeleteBehavior.Cascade);

            e.HasMany(x => x.BranchApplicability)
                .WithOne(b => b.CatalogueVersion!)
                .HasForeignKey(b => b.CatalogueVersionId)
                .OnDelete(DeleteBehavior.Cascade);
        });

        modelBuilder.Entity<LmsCataloguePanelComponent>(e =>
        {
            e.ToTable("lms_catalogue_panel_components");
            e.HasKey(x => x.Id);
            e.Property(x => x.Id).HasColumnName("id");
            e.Property(x => x.TenantId).HasColumnName("tenant_id").IsRequired();
            e.Property(x => x.PanelVersionId).HasColumnName("panel_version_id").IsRequired();
            e.Property(x => x.ComponentCatalogueItemId).HasColumnName("component_catalogue_item_id").IsRequired();
            e.Property(x => x.ComponentVersionId).HasColumnName("component_version_id").IsRequired();
            e.Property(x => x.SortOrder).HasColumnName("sort_order").IsRequired();
            e.Property(x => x.IsRequired).HasColumnName("is_required").HasDefaultValue(true);

            e.HasIndex(x => new { x.PanelVersionId, x.SortOrder }).IsUnique();
            e.HasIndex(x => new { x.PanelVersionId, x.ComponentCatalogueItemId }).IsUnique();
        });

        modelBuilder.Entity<LmsCatalogueBranchApplicability>(e =>
        {
            e.ToTable("lms_catalogue_branch_applicability");
            e.HasKey(x => x.Id);
            e.Property(x => x.Id).HasColumnName("id");
            e.Property(x => x.TenantId).HasColumnName("tenant_id").IsRequired();
            e.Property(x => x.CatalogueVersionId).HasColumnName("catalogue_version_id").IsRequired();
            e.Property(x => x.BranchId).HasColumnName("branch_id").IsRequired();

            e.HasIndex(x => new { x.CatalogueVersionId, x.BranchId }).IsUnique();
            e.HasIndex(x => new { x.TenantId, x.BranchId });
        });

        // ─── L-ORD-01B Order domain ───────────────────────────────────────────
        modelBuilder.Entity<LmsOrder>(e =>
        {
            e.ToTable("lms_orders");
            e.HasKey(x => x.Id);
            e.Property(x => x.Id).HasColumnName("id");
            e.Property(x => x.TenantId).HasColumnName("tenant_id").IsRequired();
            e.Property(x => x.OrderNumber).HasColumnName("order_number").HasMaxLength(32).IsRequired();
            e.Property(x => x.Status).HasColumnName("status").HasMaxLength(32).IsRequired();
            e.Property(x => x.CurrentVersionId).HasColumnName("current_version_id");
            e.Property(x => x.CurrentVersionNumber).HasColumnName("current_version_number").IsRequired();
            e.Property(x => x.OperatingBranchId).HasColumnName("operating_branch_id").IsRequired();
            e.Property(x => x.CreatedAt).HasColumnName("created_at").IsRequired();
            e.Property(x => x.CreatedBy).HasColumnName("created_by").IsRequired();
            e.Property(x => x.UpdatedAt).HasColumnName("updated_at");
            e.Property(x => x.UpdatedBy).HasColumnName("updated_by");
            e.Property(x => x.CancelledAt).HasColumnName("cancelled_at");
            e.Property(x => x.CancelledBy).HasColumnName("cancelled_by");
            e.Property(x => x.CancelReason).HasColumnName("cancel_reason").HasMaxLength(2000);
            // Atomic optimistic concurrency: EF emits UPDATE ... WHERE row_version = @original.
            // Application also requires ExpectedRowVersion before mutate (OrderService).
            e.Property(x => x.RowVersion).HasColumnName("row_version").IsConcurrencyToken();

            e.HasIndex(x => new { x.TenantId, x.OrderNumber }).IsUnique();
            e.HasIndex(x => new { x.TenantId, x.Status });
            e.HasIndex(x => new { x.TenantId, x.OperatingBranchId });
            e.HasIndex(x => x.TenantId);

            e.HasOne(x => x.CurrentVersion)
                .WithMany()
                .HasForeignKey(x => x.CurrentVersionId)
                .OnDelete(DeleteBehavior.Restrict);

            e.HasMany(x => x.Versions)
                .WithOne(v => v.Order!)
                .HasForeignKey(v => v.OrderId)
                .OnDelete(DeleteBehavior.Restrict);
        });

        modelBuilder.Entity<LmsOrderVersion>(e =>
        {
            e.ToTable("lms_order_versions");
            e.HasKey(x => x.Id);
            e.Property(x => x.Id).HasColumnName("id");
            e.Property(x => x.TenantId).HasColumnName("tenant_id").IsRequired();
            e.Property(x => x.OrderId).HasColumnName("order_id").IsRequired();
            e.Property(x => x.VersionNumber).HasColumnName("version_number").IsRequired();
            e.Property(x => x.PatientId).HasColumnName("patient_id").IsRequired();
            e.Property(x => x.PatientMrnSnapshot).HasColumnName("patient_mrn_snapshot").HasMaxLength(50);
            e.Property(x => x.PatientNameSnapshot).HasColumnName("patient_name_snapshot").HasMaxLength(300);
            e.Property(x => x.PatientDateOfBirthSnapshot).HasColumnName("patient_dob_snapshot");
            e.Property(x => x.VisitId).HasColumnName("visit_id");
            e.Property(x => x.OrderingProviderUserId).HasColumnName("ordering_provider_user_id").IsRequired();
            e.Property(x => x.OrderingProviderNameSnapshot).HasColumnName("ordering_provider_name_snapshot").HasMaxLength(300);
            e.Property(x => x.ResponsibleClinicianUserId).HasColumnName("responsible_clinician_user_id").IsRequired();
            e.Property(x => x.ResponsibleClinicianNameSnapshot).HasColumnName("responsible_clinician_name_snapshot").HasMaxLength(300);
            e.Property(x => x.OperatingBranchId).HasColumnName("operating_branch_id").IsRequired();
            e.Property(x => x.PerformingBranchId).HasColumnName("performing_branch_id").IsRequired();
            e.Property(x => x.OrderSource).HasColumnName("order_source").HasMaxLength(32).IsRequired();
            e.Property(x => x.Priority).HasColumnName("priority").HasMaxLength(16).IsRequired();
            e.Property(x => x.PriorityReason).HasColumnName("priority_reason").HasMaxLength(2000);
            e.Property(x => x.ClinicalIndication).HasColumnName("clinical_indication").HasMaxLength(4000).IsRequired();
            e.Property(x => x.Notes).HasColumnName("notes").HasMaxLength(4000);
            e.Property(x => x.ConsentReference).HasColumnName("consent_reference").HasMaxLength(128);
            e.Property(x => x.ConsentTemplateVersionRef).HasColumnName("consent_template_version_ref").HasMaxLength(128);
            e.Property(x => x.AcknowledgementEvidence).HasColumnName("acknowledgement_evidence").HasMaxLength(4000);
            e.Property(x => x.PayerContextRef).HasColumnName("payer_context_ref").HasMaxLength(128);
            e.Property(x => x.AuthorizationReference).HasColumnName("authorization_reference").HasMaxLength(128);
            e.Property(x => x.FinancialDispositionRef).HasColumnName("financial_disposition_ref").HasMaxLength(128);
            e.Property(x => x.ServiceCatalogRef).HasColumnName("service_catalog_ref").HasMaxLength(128);
            e.Property(x => x.AmendmentReason).HasColumnName("amendment_reason").HasMaxLength(2000);
            e.Property(x => x.CreatedAt).HasColumnName("created_at").IsRequired();
            e.Property(x => x.CreatedBy).HasColumnName("created_by").IsRequired();
            e.Property(x => x.SubmittedAt).HasColumnName("submitted_at");
            e.Property(x => x.SubmittedBy).HasColumnName("submitted_by");

            e.HasIndex(x => new { x.OrderId, x.VersionNumber }).IsUnique();
            e.HasIndex(x => new { x.TenantId, x.PatientId });
            e.HasIndex(x => new { x.TenantId, x.VisitId });

            e.HasMany(x => x.Selections)
                .WithOne(s => s.OrderVersion!)
                .HasForeignKey(s => s.OrderVersionId)
                .OnDelete(DeleteBehavior.Cascade);

            e.HasMany(x => x.Tests)
                .WithOne(t => t.OrderVersion!)
                .HasForeignKey(t => t.OrderVersionId)
                .OnDelete(DeleteBehavior.Cascade);
        });

        modelBuilder.Entity<LmsOrderSelection>(e =>
        {
            e.ToTable("lms_order_selections");
            e.HasKey(x => x.Id);
            e.Property(x => x.Id).HasColumnName("id");
            e.Property(x => x.TenantId).HasColumnName("tenant_id").IsRequired();
            e.Property(x => x.OrderVersionId).HasColumnName("order_version_id").IsRequired();
            e.Property(x => x.CatalogueItemId).HasColumnName("catalogue_item_id").IsRequired();
            e.Property(x => x.CatalogueVersionId).HasColumnName("catalogue_version_id");
            e.Property(x => x.CatalogueType).HasColumnName("catalogue_type").HasMaxLength(32).IsRequired();
            e.Property(x => x.SortOrder).HasColumnName("sort_order").IsRequired();
            e.Property(x => x.DisplayNameSnapshot).HasColumnName("display_name_snapshot").HasMaxLength(256);
            e.Property(x => x.InternalOrderCodeSnapshot).HasColumnName("internal_order_code_snapshot").HasMaxLength(64);

            e.HasIndex(x => new { x.OrderVersionId, x.SortOrder });
            e.HasIndex(x => new { x.OrderVersionId, x.CatalogueItemId });
        });

        modelBuilder.Entity<LmsOrderTest>(e =>
        {
            e.ToTable("lms_order_tests");
            e.HasKey(x => x.Id);
            e.Property(x => x.Id).HasColumnName("id");
            e.Property(x => x.TenantId).HasColumnName("tenant_id").IsRequired();
            e.Property(x => x.OrderVersionId).HasColumnName("order_version_id").IsRequired();
            e.Property(x => x.CatalogueItemId).HasColumnName("catalogue_item_id").IsRequired();
            e.Property(x => x.CatalogueVersionId).HasColumnName("catalogue_version_id").IsRequired();
            e.Property(x => x.CatalogueVersionNumber).HasColumnName("catalogue_version_number").IsRequired();
            e.Property(x => x.CatalogueType).HasColumnName("catalogue_type").HasMaxLength(32).IsRequired();
            e.Property(x => x.DisplayNameSnapshot).HasColumnName("display_name_snapshot").HasMaxLength(256).IsRequired();
            e.Property(x => x.InternalOrderCodeSnapshot).HasColumnName("internal_order_code_snapshot").HasMaxLength(64).IsRequired();
            e.Property(x => x.Status).HasColumnName("status").HasMaxLength(32).IsRequired();
            e.Property(x => x.SortOrder).HasColumnName("sort_order").IsRequired();
            e.Property(x => x.PanelCatalogueItemId).HasColumnName("panel_catalogue_item_id");
            e.Property(x => x.PanelCatalogueVersionId).HasColumnName("panel_catalogue_version_id");
            e.Property(x => x.PanelSelectionId).HasColumnName("panel_selection_id");

            e.HasIndex(x => new { x.OrderVersionId, x.SortOrder });
            e.HasIndex(x => new { x.TenantId, x.CatalogueVersionId });
            e.HasIndex(x => new { x.OrderVersionId, x.PanelCatalogueItemId });
        });

        modelBuilder.Entity<LmsOrderNumberSequence>(e =>
        {
            e.ToTable("lms_order_number_sequences");
            e.HasKey(x => x.Id);
            e.Property(x => x.Id).HasColumnName("id");
            e.Property(x => x.TenantId).HasColumnName("tenant_id").IsRequired();
            e.Property(x => x.SequenceDate).HasColumnName("sequence_date").IsRequired();
            e.Property(x => x.LastValue).HasColumnName("last_value").IsRequired();
            e.HasIndex(x => new { x.TenantId, x.SequenceDate }).IsUnique();
        });

        modelBuilder.Entity<LmsOrderIdempotencyRecord>(e =>
        {
            e.ToTable("lms_order_idempotency");
            e.HasKey(x => x.Id);
            e.Property(x => x.Id).HasColumnName("id");
            e.Property(x => x.TenantId).HasColumnName("tenant_id").IsRequired();
            e.Property(x => x.IdempotencyKey).HasColumnName("idempotency_key").HasMaxLength(200).IsRequired();
            e.Property(x => x.Operation).HasColumnName("operation").HasMaxLength(64).IsRequired();
            e.Property(x => x.RequestHash).HasColumnName("request_hash").HasMaxLength(64).IsRequired();
            e.Property(x => x.OrderId).HasColumnName("order_id").IsRequired();
            e.Property(x => x.ResponseJson).HasColumnName("response_json").IsRequired();
            e.Property(x => x.CreatedAt).HasColumnName("created_at").IsRequired();
            e.HasIndex(x => new { x.TenantId, x.IdempotencyKey }).IsUnique();
        });

        // ─── L-COL-01B CollectionTask ──────────────────────────────────────────
        modelBuilder.Entity<LmsCollectionTask>(e =>
        {
            e.ToTable("lms_collection_tasks");
            e.HasKey(x => x.Id);
            e.Property(x => x.Id).HasColumnName("id");
            e.Property(x => x.TenantId).HasColumnName("tenant_id").IsRequired();
            e.Property(x => x.TaskNumber).HasColumnName("task_number").HasMaxLength(32).IsRequired();
            e.Property(x => x.OrderId).HasColumnName("order_id").IsRequired();
            e.Property(x => x.CollectionBranchId).HasColumnName("collection_branch_id").IsRequired();
            e.Property(x => x.LocationText).HasColumnName("location_text").HasMaxLength(500);
            e.Property(x => x.Status).HasColumnName("status").HasMaxLength(32).IsRequired();
            e.Property(x => x.ClaimedByUserId).HasColumnName("claimed_by_user_id");
            e.Property(x => x.ClaimedAt).HasColumnName("claimed_at");
            e.Property(x => x.AssignedToUserId).HasColumnName("assigned_to_user_id");
            e.Property(x => x.AssignedAt).HasColumnName("assigned_at");
            e.Property(x => x.Notes).HasColumnName("notes").HasMaxLength(4000);
            e.Property(x => x.CancelReason).HasColumnName("cancel_reason").HasMaxLength(2000);
            e.Property(x => x.CreatedAt).HasColumnName("created_at").IsRequired();
            e.Property(x => x.CreatedBy).HasColumnName("created_by").IsRequired();
            e.Property(x => x.UpdatedAt).HasColumnName("updated_at");
            e.Property(x => x.UpdatedBy).HasColumnName("updated_by");
            e.Property(x => x.RowVersion).HasColumnName("row_version").IsConcurrencyToken();

            e.HasIndex(x => new { x.TenantId, x.TaskNumber }).IsUnique();
            e.HasIndex(x => new { x.TenantId, x.Status });
            e.HasIndex(x => new { x.TenantId, x.CollectionBranchId });
            e.HasIndex(x => new { x.TenantId, x.OrderId });
            e.HasIndex(x => x.TenantId);

            e.HasMany(x => x.OrderTests)
                .WithOne(l => l.CollectionTask!)
                .HasForeignKey(l => l.CollectionTaskId)
                .OnDelete(DeleteBehavior.Cascade);
        });

        modelBuilder.Entity<LmsCollectionTaskOrderTest>(e =>
        {
            e.ToTable("lms_collection_task_order_tests");
            e.HasKey(x => x.Id);
            e.Property(x => x.Id).HasColumnName("id");
            e.Property(x => x.TenantId).HasColumnName("tenant_id").IsRequired();
            e.Property(x => x.CollectionTaskId).HasColumnName("collection_task_id").IsRequired();
            e.Property(x => x.OrderId).HasColumnName("order_id").IsRequired();
            e.Property(x => x.OrderTestId).HasColumnName("order_test_id").IsRequired();
            e.Property(x => x.SortOrder).HasColumnName("sort_order").IsRequired();

            e.HasIndex(x => new { x.CollectionTaskId, x.OrderTestId }).IsUnique();
            e.HasIndex(x => new { x.TenantId, x.OrderTestId });
            e.HasIndex(x => new { x.TenantId, x.OrderId });
        });

        modelBuilder.Entity<LmsCollectionIdempotencyRecord>(e =>
        {
            e.ToTable("lms_collection_idempotency");
            e.HasKey(x => x.Id);
            e.Property(x => x.Id).HasColumnName("id");
            e.Property(x => x.TenantId).HasColumnName("tenant_id").IsRequired();
            e.Property(x => x.IdempotencyKey).HasColumnName("idempotency_key").HasMaxLength(200).IsRequired();
            e.Property(x => x.Operation).HasColumnName("operation").HasMaxLength(64).IsRequired();
            e.Property(x => x.RequestHash).HasColumnName("request_hash").HasMaxLength(64).IsRequired();
            e.Property(x => x.CollectionTaskId).HasColumnName("collection_task_id").IsRequired();
            e.Property(x => x.ResponseJson).HasColumnName("response_json").IsRequired();
            e.Property(x => x.CreatedAt).HasColumnName("created_at").IsRequired();
            e.HasIndex(x => new { x.TenantId, x.IdempotencyKey }).IsUnique();
        });

        modelBuilder.Entity<LmsCollectionTaskNumberSequence>(e =>
        {
            e.ToTable("lms_collection_task_number_sequences");
            e.HasKey(x => x.Id);
            e.Property(x => x.Id).HasColumnName("id");
            e.Property(x => x.TenantId).HasColumnName("tenant_id").IsRequired();
            e.Property(x => x.SequenceDate).HasColumnName("sequence_date").IsRequired();
            e.Property(x => x.LastValue).HasColumnName("last_value").IsRequired();
            e.HasIndex(x => new { x.TenantId, x.SequenceDate }).IsUnique();
        });

        // ─── L-COL-01C / L-COL-01D Specimen + Receiving ────────────────────────
        modelBuilder.Entity<LmsSpecimen>(e =>
        {
            e.ToTable("lms_specimens");
            e.HasKey(x => x.Id);
            e.Property(x => x.Id).HasColumnName("id");
            e.Property(x => x.TenantId).HasColumnName("tenant_id").IsRequired();
            e.Property(x => x.CollectionTaskId).HasColumnName("collection_task_id").IsRequired();
            e.Property(x => x.OrderId).HasColumnName("order_id").IsRequired();
            e.Property(x => x.PatientId).HasColumnName("patient_id").IsRequired();
            e.Property(x => x.PatientMrnSnapshot).HasColumnName("patient_mrn_snapshot").HasMaxLength(64);
            e.Property(x => x.PatientNameSnapshot).HasColumnName("patient_name_snapshot").HasMaxLength(256);
            e.Property(x => x.PatientDateOfBirthSnapshot).HasColumnName("patient_date_of_birth_snapshot");
            e.Property(x => x.CollectionBranchId).HasColumnName("collection_branch_id").IsRequired();
            e.Property(x => x.LocationText).HasColumnName("location_text").HasMaxLength(500);
            e.Property(x => x.CollectedByUserId).HasColumnName("collected_by_user_id").IsRequired();
            e.Property(x => x.CollectedAt).HasColumnName("collected_at").IsRequired();
            e.Property(x => x.Status).HasColumnName("status").HasMaxLength(32).IsRequired();
            // ACC-YYYYMMDD-NNNNNN = 19 chars (approved format/example). Closure "18" was inconsistent.
            e.Property(x => x.Accession).HasColumnName("accession").HasMaxLength(19);
            e.Property(x => x.AccessionDate).HasColumnName("accession_date");
            e.Property(x => x.AccessionSequence).HasColumnName("accession_sequence");
            e.Property(x => x.ReceivedAtUtc).HasColumnName("received_at_utc");
            e.Property(x => x.ReceivedByUserId).HasColumnName("received_by_user_id");
            e.Property(x => x.ReceivingBranchId).HasColumnName("receiving_branch_id");
            e.Property(x => x.ReceivingLocationText).HasColumnName("receiving_location_text").HasMaxLength(500);
            e.Property(x => x.RejectionReasonCode).HasColumnName("rejection_reason_code").HasMaxLength(150);
            e.Property(x => x.RejectionReasonLabelSnapshot).HasColumnName("rejection_reason_label_snapshot").HasMaxLength(500);
            e.Property(x => x.RejectedAtUtc).HasColumnName("rejected_at_utc");
            e.Property(x => x.RejectedByUserId).HasColumnName("rejected_by_user_id");
            e.Property(x => x.CreatedAt).HasColumnName("created_at").IsRequired();
            e.Property(x => x.CreatedBy).HasColumnName("created_by").IsRequired();
            e.Property(x => x.UpdatedAt).HasColumnName("updated_at");
            e.Property(x => x.UpdatedBy).HasColumnName("updated_by");
            e.Property(x => x.RowVersion).HasColumnName("row_version").IsConcurrencyToken();

            e.HasIndex(x => new { x.TenantId, x.CollectionTaskId }).IsUnique();
            e.HasIndex(x => new { x.TenantId, x.OrderId });
            e.HasIndex(x => new { x.TenantId, x.PatientId });
            e.HasIndex(x => new { x.TenantId, x.CollectionBranchId });
            e.HasIndex(x => new { x.TenantId, x.Status });
            e.HasIndex(x => x.TenantId);
            e.HasIndex(x => new { x.TenantId, x.Accession })
                .IsUnique()
                .HasFilter("accession IS NOT NULL");
            e.HasIndex(x => new { x.TenantId, x.AccessionDate, x.AccessionSequence })
                .IsUnique()
                .HasFilter("accession_date IS NOT NULL AND accession_sequence IS NOT NULL");
            e.HasIndex(x => new { x.TenantId, x.ReceivingBranchId });

            e.HasMany(x => x.OrderTests)
                .WithOne(l => l.Specimen!)
                .HasForeignKey(l => l.SpecimenId)
                .OnDelete(DeleteBehavior.Cascade);
        });

        modelBuilder.Entity<LmsAccessionNumberSequence>(e =>
        {
            e.ToTable("lms_accession_number_sequences");
            e.HasKey(x => x.Id);
            e.Property(x => x.Id).HasColumnName("id");
            e.Property(x => x.TenantId).HasColumnName("tenant_id").IsRequired();
            e.Property(x => x.SequenceDate).HasColumnName("sequence_date").IsRequired();
            e.Property(x => x.LastValue).HasColumnName("last_value").IsRequired();
            e.HasIndex(x => new { x.TenantId, x.SequenceDate }).IsUnique();
        });

        modelBuilder.Entity<LmsSpecimenOrderTest>(e =>
        {
            e.ToTable("lms_specimen_order_tests");
            e.HasKey(x => x.Id);
            e.Property(x => x.Id).HasColumnName("id");
            e.Property(x => x.TenantId).HasColumnName("tenant_id").IsRequired();
            e.Property(x => x.SpecimenId).HasColumnName("specimen_id").IsRequired();
            e.Property(x => x.OrderId).HasColumnName("order_id").IsRequired();
            e.Property(x => x.OrderTestId).HasColumnName("order_test_id").IsRequired();
            e.Property(x => x.SortOrder).HasColumnName("sort_order").IsRequired();

            e.HasIndex(x => new { x.SpecimenId, x.OrderTestId }).IsUnique();
            e.HasIndex(x => new { x.TenantId, x.OrderTestId });
            e.HasIndex(x => new { x.TenantId, x.OrderId });
        });

        modelBuilder.Entity<LmsSpecimenIdempotencyRecord>(e =>
        {
            e.ToTable("lms_specimen_idempotency");
            e.HasKey(x => x.Id);
            e.Property(x => x.Id).HasColumnName("id");
            e.Property(x => x.TenantId).HasColumnName("tenant_id").IsRequired();
            e.Property(x => x.IdempotencyKey).HasColumnName("idempotency_key").HasMaxLength(200).IsRequired();
            e.Property(x => x.Operation).HasColumnName("operation").HasMaxLength(64).IsRequired();
            e.Property(x => x.RequestHash).HasColumnName("request_hash").HasMaxLength(64).IsRequired();
            e.Property(x => x.SpecimenId).HasColumnName("specimen_id").IsRequired();
            e.Property(x => x.ResponseJson).HasColumnName("response_json").IsRequired();
            e.Property(x => x.CreatedAt).HasColumnName("created_at").IsRequired();
            e.HasIndex(x => new { x.TenantId, x.IdempotencyKey }).IsUnique();
        });

        // ─── L-COL-01E Barcode & Labels ───────────────────────────────────────
        modelBuilder.Entity<LmsSpecimenBarcodeConfiguration>(e =>
        {
            e.ToTable("lms_specimen_barcode_configurations");
            e.HasKey(x => x.Id);
            e.Property(x => x.Id).HasColumnName("id");
            e.Property(x => x.TenantId).HasColumnName("tenant_id").IsRequired();
            e.Property(x => x.FormatCode).HasColumnName("format_code").HasMaxLength(64).IsRequired();
            e.Property(x => x.Prefix).HasColumnName("prefix").HasMaxLength(16).IsRequired();
            e.Property(x => x.Separator).HasColumnName("separator").HasMaxLength(8).IsRequired();
            e.Property(x => x.DateSegment).HasColumnName("date_segment").HasMaxLength(32).IsRequired();
            e.Property(x => x.DateTimezone).HasColumnName("date_timezone").HasMaxLength(16).IsRequired();
            e.Property(x => x.SequenceWidth).HasColumnName("sequence_width").IsRequired();
            e.Property(x => x.SequencePeriod).HasColumnName("sequence_period").HasMaxLength(32).IsRequired();
            e.Property(x => x.CheckDigitPolicy).HasColumnName("check_digit_policy").HasMaxLength(32).IsRequired();
            e.Property(x => x.Charset).HasColumnName("charset").HasMaxLength(64).IsRequired();
            e.Property(x => x.MaxLength).HasColumnName("max_length").IsRequired();
            e.Property(x => x.Symbology).HasColumnName("symbology").HasMaxLength(32).IsRequired();
            e.Property(x => x.Scope).HasColumnName("scope").HasMaxLength(32).IsRequired();
            e.Property(x => x.UniquenessPolicy).HasColumnName("uniqueness_policy").HasMaxLength(32).IsRequired();
            e.Property(x => x.EffectiveFromUtc).HasColumnName("effective_from_utc").IsRequired();
            e.Property(x => x.IsActive).HasColumnName("is_active").IsRequired();
            e.Property(x => x.CreatedAtUtc).HasColumnName("created_at_utc").IsRequired();
            e.Property(x => x.CreatedByUserId).HasColumnName("created_by_user_id").IsRequired();
            e.Property(x => x.UpdatedAtUtc).HasColumnName("updated_at_utc");
            e.Property(x => x.UpdatedByUserId).HasColumnName("updated_by_user_id");
            e.HasIndex(x => new { x.TenantId, x.EffectiveFromUtc });
            e.HasIndex(x => new { x.TenantId, x.IsActive });
        });

        modelBuilder.Entity<LmsBarcodeNumberSequence>(e =>
        {
            e.ToTable("lms_barcode_number_sequences");
            e.HasKey(x => x.Id);
            e.Property(x => x.Id).HasColumnName("id");
            e.Property(x => x.TenantId).HasColumnName("tenant_id").IsRequired();
            e.Property(x => x.SequenceDate).HasColumnName("sequence_date").IsRequired();
            e.Property(x => x.LastValue).HasColumnName("last_value").IsRequired();
            e.HasIndex(x => new { x.TenantId, x.SequenceDate }).IsUnique();
        });

        modelBuilder.Entity<LmsSpecimenBarcode>(e =>
        {
            e.ToTable("lms_specimen_barcodes");
            e.HasKey(x => x.Id);
            e.Property(x => x.Id).HasColumnName("id");
            e.Property(x => x.TenantId).HasColumnName("tenant_id").IsRequired();
            e.Property(x => x.SpecimenId).HasColumnName("specimen_id").IsRequired();
            e.Property(x => x.BarcodeValue).HasColumnName("barcode_value").HasMaxLength(19).IsRequired();
            e.Property(x => x.ConfigurationId).HasColumnName("configuration_id").IsRequired();
            e.Property(x => x.FormatCode).HasColumnName("format_code").HasMaxLength(64).IsRequired();
            e.Property(x => x.Symbology).HasColumnName("symbology").HasMaxLength(32).IsRequired();
            e.Property(x => x.IssuedAtUtc).HasColumnName("issued_at_utc").IsRequired();
            e.Property(x => x.IssuedByUserId).HasColumnName("issued_by_user_id").IsRequired();
            e.Property(x => x.IsActive).HasColumnName("is_active").IsRequired();
            e.Property(x => x.RowVersion).HasColumnName("row_version").IsConcurrencyToken();
            e.HasIndex(x => new { x.TenantId, x.BarcodeValue }).IsUnique();
            e.HasIndex(x => new { x.TenantId, x.SpecimenId });
            e.HasIndex(x => new { x.TenantId, x.SpecimenId })
                .IsUnique()
                .HasFilter("is_active = true")
                .HasDatabaseName("IX_lms_specimen_barcodes_tenant_id_specimen_id_active");
        });

        modelBuilder.Entity<LmsSpecimenLabelPrintEvent>(e =>
        {
            e.ToTable("lms_specimen_label_print_events");
            e.HasKey(x => x.Id);
            e.Property(x => x.Id).HasColumnName("id");
            e.Property(x => x.TenantId).HasColumnName("tenant_id").IsRequired();
            e.Property(x => x.SpecimenId).HasColumnName("specimen_id").IsRequired();
            e.Property(x => x.BarcodeId).HasColumnName("barcode_id").IsRequired();
            e.Property(x => x.PrintType).HasColumnName("print_type").HasMaxLength(32).IsRequired();
            e.Property(x => x.PrintedByUserId).HasColumnName("printed_by_user_id").IsRequired();
            e.Property(x => x.PrintedAtUtc).HasColumnName("printed_at_utc").IsRequired();
            e.Property(x => x.Reason).HasColumnName("reason").HasMaxLength(500);
            e.Property(x => x.CorrelationId).HasColumnName("correlation_id").HasMaxLength(200);
            e.HasIndex(x => new { x.TenantId, x.SpecimenId, x.PrintedAtUtc });
            e.HasIndex(x => new { x.TenantId, x.BarcodeId });
        });

        // ─── L-TST-01A Result Draft ───────────────────────────────────────────
        modelBuilder.Entity<LmsResult>(e =>
        {
            e.ToTable("lms_results");
            e.HasKey(x => x.Id);
            e.Property(x => x.Id).HasColumnName("id");
            e.Property(x => x.TenantId).HasColumnName("tenant_id").IsRequired();
            e.Property(x => x.OrderId).HasColumnName("order_id").IsRequired();
            e.Property(x => x.OrderTestId).HasColumnName("order_test_id").IsRequired();
            e.Property(x => x.SpecimenId).HasColumnName("specimen_id").IsRequired();
            e.Property(x => x.OperatingBranchId).HasColumnName("operating_branch_id").IsRequired();
            e.Property(x => x.CatalogueItemId).HasColumnName("catalogue_item_id").IsRequired();
            e.Property(x => x.CatalogueVersionId).HasColumnName("catalogue_version_id").IsRequired();
            e.Property(x => x.ResultDatatype).HasColumnName("result_datatype").HasMaxLength(64).IsRequired();
            e.Property(x => x.Status).HasColumnName("status").HasMaxLength(32).IsRequired();
            e.Property(x => x.CurrentVersionNumber).HasColumnName("current_version_number").IsRequired();
            e.Property(x => x.NumericValue).HasColumnName("numeric_value").HasMaxLength(64);
            e.Property(x => x.QualitativeValue).HasColumnName("qualitative_value").HasMaxLength(256);
            e.Property(x => x.Unit).HasColumnName("unit").HasMaxLength(64);
            e.Property(x => x.Comment).HasColumnName("comment").HasMaxLength(2000);
            e.Property(x => x.VerifiedByUserId).HasColumnName("verified_by_user_id");
            e.Property(x => x.VerifiedAtUtc).HasColumnName("verified_at_utc");
            e.Property(x => x.VerifiedVersionNumber).HasColumnName("verified_version_number");
            e.Property(x => x.AuthorizedByUserId).HasColumnName("authorized_by_user_id");
            e.Property(x => x.AuthorizedAtUtc).HasColumnName("authorized_at_utc");
            e.Property(x => x.AuthorizedVersionNumber).HasColumnName("authorized_version_number");
            e.Property(x => x.CreatedAtUtc).HasColumnName("created_at_utc").IsRequired();
            e.Property(x => x.CreatedByUserId).HasColumnName("created_by_user_id").IsRequired();
            e.Property(x => x.UpdatedAtUtc).HasColumnName("updated_at_utc").IsRequired();
            e.Property(x => x.UpdatedByUserId).HasColumnName("updated_by_user_id").IsRequired();
            e.Property(x => x.RowVersion).HasColumnName("row_version").IsConcurrencyToken();

            e.HasIndex(x => new { x.TenantId, x.OrderTestId, x.SpecimenId }).IsUnique();
            e.HasIndex(x => new { x.TenantId, x.SpecimenId });
            e.HasIndex(x => new { x.TenantId, x.OrderId });
            e.HasIndex(x => new { x.TenantId, x.OperatingBranchId, x.Status });

            e.HasMany(x => x.Versions)
                .WithOne(v => v.Result!)
                .HasForeignKey(v => v.ResultId)
                .OnDelete(DeleteBehavior.Cascade);
        });

        modelBuilder.Entity<LmsResultVersion>(e =>
        {
            e.ToTable("lms_result_versions");
            e.HasKey(x => x.Id);
            e.Property(x => x.Id).HasColumnName("id");
            e.Property(x => x.TenantId).HasColumnName("tenant_id").IsRequired();
            e.Property(x => x.ResultId).HasColumnName("result_id").IsRequired();
            e.Property(x => x.VersionNumber).HasColumnName("version_number").IsRequired();
            e.Property(x => x.NumericValue).HasColumnName("numeric_value").HasMaxLength(64);
            e.Property(x => x.QualitativeValue).HasColumnName("qualitative_value").HasMaxLength(256);
            e.Property(x => x.Unit).HasColumnName("unit").HasMaxLength(64);
            e.Property(x => x.Comment).HasColumnName("comment").HasMaxLength(2000);
            e.Property(x => x.CreatedAtUtc).HasColumnName("created_at_utc").IsRequired();
            e.Property(x => x.CreatedByUserId).HasColumnName("created_by_user_id").IsRequired();
            e.HasIndex(x => new { x.ResultId, x.VersionNumber }).IsUnique();
            e.HasIndex(x => new { x.TenantId, x.ResultId });
        });

        modelBuilder.Entity<LmsResultIdempotencyRecord>(e =>
        {
            e.ToTable("lms_result_idempotency");
            e.HasKey(x => x.Id);
            e.Property(x => x.Id).HasColumnName("id");
            e.Property(x => x.TenantId).HasColumnName("tenant_id").IsRequired();
            e.Property(x => x.IdempotencyKey).HasColumnName("idempotency_key").HasMaxLength(200).IsRequired();
            e.Property(x => x.Operation).HasColumnName("operation").HasMaxLength(64).IsRequired();
            e.Property(x => x.RequestHash).HasColumnName("request_hash").HasMaxLength(64).IsRequired();
            e.Property(x => x.ResultId).HasColumnName("result_id").IsRequired();
            e.Property(x => x.ResponseJson).HasColumnName("response_json").IsRequired();
            e.Property(x => x.CreatedAt).HasColumnName("created_at").IsRequired();
            e.HasIndex(x => new { x.TenantId, x.IdempotencyKey }).IsUnique();
        });

        modelBuilder.Entity<LmsCriticalResultEvent>(e =>
        {
            e.ToTable("lms_critical_result_events");
            e.HasKey(x => x.Id);
            e.Property(x => x.Id).HasColumnName("id");
            e.Property(x => x.TenantId).HasColumnName("tenant_id").IsRequired();
            e.Property(x => x.ResultId).HasColumnName("result_id").IsRequired();
            e.Property(x => x.ResultVersionNumber).HasColumnName("result_version_number").IsRequired();
            e.Property(x => x.OperatingBranchId).HasColumnName("operating_branch_id").IsRequired();
            e.Property(x => x.Status).HasColumnName("status").HasMaxLength(32).IsRequired();
            e.Property(x => x.ClassifiedByUserId).HasColumnName("classified_by_user_id").IsRequired();
            e.Property(x => x.ClassifiedAtUtc).HasColumnName("classified_at_utc").IsRequired();
            e.Property(x => x.AcknowledgedByUserId).HasColumnName("acknowledged_by_user_id");
            e.Property(x => x.AcknowledgedAtUtc).HasColumnName("acknowledged_at_utc");
            e.Property(x => x.AcknowledgementEvidence).HasColumnName("acknowledgement_evidence").HasMaxLength(2000);
            e.Property(x => x.NotificationIntentStatus).HasColumnName("notification_intent_status").HasMaxLength(32).IsRequired();
            e.Property(x => x.NotificationIntentDetail).HasColumnName("notification_intent_detail").HasMaxLength(500);
            e.Property(x => x.CreatedAtUtc).HasColumnName("created_at_utc").IsRequired();
            e.Property(x => x.CreatedByUserId).HasColumnName("created_by_user_id").IsRequired();
            e.Property(x => x.UpdatedAtUtc).HasColumnName("updated_at_utc").IsRequired();
            e.Property(x => x.UpdatedByUserId).HasColumnName("updated_by_user_id").IsRequired();
            e.Property(x => x.RowVersion).HasColumnName("row_version").IsConcurrencyToken();

            e.HasIndex(x => new { x.TenantId, x.ResultId, x.ResultVersionNumber }).IsUnique();
            e.HasIndex(x => new { x.TenantId, x.OperatingBranchId, x.Status });
            e.HasIndex(x => x.ResultId);

            e.HasOne(x => x.Result)
                .WithMany()
                .HasForeignKey(x => x.ResultId)
                .OnDelete(DeleteBehavior.Restrict);
        });

        // ─── L-REP-01 Report Foundation ───────────────────────────────────────
        modelBuilder.Entity<LmsReport>(e =>
        {
            e.ToTable("lms_reports");
            e.HasKey(x => x.Id);
            e.Property(x => x.Id).HasColumnName("id");
            e.Property(x => x.TenantId).HasColumnName("tenant_id").IsRequired();
            e.Property(x => x.OperatingBranchId).HasColumnName("operating_branch_id").IsRequired();
            e.Property(x => x.PatientId).HasColumnName("patient_id").IsRequired();
            e.Property(x => x.OrderId).HasColumnName("order_id").IsRequired();
            e.Property(x => x.Status).HasColumnName("status").HasMaxLength(32).IsRequired();
            e.Property(x => x.CurrentVersionNumber).HasColumnName("current_version_number").IsRequired();
            e.Property(x => x.FinalizedAtUtc).HasColumnName("finalized_at_utc");
            e.Property(x => x.FinalizedByUserId).HasColumnName("finalized_by_user_id");
            e.Property(x => x.ReleasedAtUtc).HasColumnName("released_at_utc");
            e.Property(x => x.ReleasedByUserId).HasColumnName("released_by_user_id");
            e.Property(x => x.BusinessReportNumber).HasColumnName("business_report_number").HasMaxLength(64);
            e.Property(x => x.BusinessReportNumberAssignedAtUtc)
                .HasColumnName("business_report_number_assigned_at_utc");
            e.Property(x => x.BusinessReportNumberAssignedByUserId)
                .HasColumnName("business_report_number_assigned_by_user_id");
            e.Property(x => x.CurrentOfficialArtifactId)
                .HasColumnName("current_official_artifact_id");
            e.Property(x => x.CreatedAtUtc).HasColumnName("created_at_utc").IsRequired();
            e.Property(x => x.CreatedByUserId).HasColumnName("created_by_user_id").IsRequired();
            e.Property(x => x.UpdatedAtUtc).HasColumnName("updated_at_utc").IsRequired();
            e.Property(x => x.UpdatedByUserId).HasColumnName("updated_by_user_id").IsRequired();
            e.Property(x => x.RowVersion).HasColumnName("row_version").IsConcurrencyToken();

            e.HasIndex(x => new { x.TenantId, x.OperatingBranchId, x.Status });
            e.HasIndex(x => new { x.TenantId, x.PatientId });
            e.HasIndex(x => new { x.TenantId, x.OrderId });
            e.HasIndex(x => new { x.TenantId, x.BusinessReportNumber })
                .IsUnique()
                .HasFilter("business_report_number IS NOT NULL");
            e.HasIndex(x => x.CurrentOfficialArtifactId);

            e.HasMany(x => x.Versions)
                .WithOne(v => v.Report!)
                .HasForeignKey(v => v.ReportId)
                .OnDelete(DeleteBehavior.Restrict);
        });

        // ─── L-REP-03 CUT B Official PDF ──────────────────────────────────────
        modelBuilder.Entity<LmsReportPdfTemplateVersion>(e =>
        {
            e.ToTable("lms_report_pdf_template_versions");
            e.HasKey(x => x.Id);
            e.Property(x => x.Id).HasColumnName("id");
            e.Property(x => x.TenantId).HasColumnName("tenant_id").IsRequired();
            e.Property(x => x.TemplateCode).HasColumnName("template_code").HasMaxLength(64).IsRequired();
            e.Property(x => x.VersionNumber).HasColumnName("version_number").IsRequired();
            e.Property(x => x.HospitalLaboratoryName).HasColumnName("hospital_laboratory_name").HasMaxLength(256).IsRequired();
            e.Property(x => x.LogoContent).HasColumnName("logo_content").IsRequired();
            e.Property(x => x.LogoMimeType).HasColumnName("logo_mime_type").HasMaxLength(64).IsRequired();
            e.Property(x => x.EffectiveFromUtc).HasColumnName("effective_from_utc").IsRequired();
            e.Property(x => x.IsActive).HasColumnName("is_active").IsRequired();
            e.Property(x => x.IsLocked).HasColumnName("is_locked").IsRequired();
            e.Property(x => x.LockedAtUtc).HasColumnName("locked_at_utc");
            e.Property(x => x.CreatedAtUtc).HasColumnName("created_at_utc").IsRequired();
            e.Property(x => x.CreatedByUserId).HasColumnName("created_by_user_id").IsRequired();
            e.Property(x => x.UpdatedAtUtc).HasColumnName("updated_at_utc");
            e.Property(x => x.UpdatedByUserId).HasColumnName("updated_by_user_id");
            e.HasIndex(x => new { x.TenantId, x.TemplateCode, x.VersionNumber }).IsUnique();
            e.HasIndex(x => new { x.TenantId, x.IsActive, x.EffectiveFromUtc });
        });

        modelBuilder.Entity<LmsReportPdfSignatory>(e =>
        {
            e.ToTable("lms_report_pdf_signatories");
            e.HasKey(x => x.Id);
            e.Property(x => x.Id).HasColumnName("id");
            e.Property(x => x.TenantId).HasColumnName("tenant_id").IsRequired();
            e.Property(x => x.Name).HasColumnName("name").HasMaxLength(256).IsRequired();
            e.Property(x => x.CredentialsText).HasColumnName("credentials_text").HasMaxLength(512).IsRequired();
            e.Property(x => x.EffectiveFromUtc).HasColumnName("effective_from_utc").IsRequired();
            e.Property(x => x.IsActive).HasColumnName("is_active").IsRequired();
            e.Property(x => x.CreatedAtUtc).HasColumnName("created_at_utc").IsRequired();
            e.Property(x => x.CreatedByUserId).HasColumnName("created_by_user_id").IsRequired();
            e.Property(x => x.UpdatedAtUtc).HasColumnName("updated_at_utc");
            e.Property(x => x.UpdatedByUserId).HasColumnName("updated_by_user_id");
            e.HasIndex(x => new { x.TenantId, x.IsActive, x.EffectiveFromUtc });
        });

        modelBuilder.Entity<LmsReportOfficialPdfJob>(e =>
        {
            e.ToTable("lms_report_official_pdf_jobs");
            e.HasKey(x => x.Id);
            e.Property(x => x.Id).HasColumnName("id");
            e.Property(x => x.TenantId).HasColumnName("tenant_id").IsRequired();
            e.Property(x => x.OperatingBranchId).HasColumnName("operating_branch_id").IsRequired();
            e.Property(x => x.ReportId).HasColumnName("report_id").IsRequired();
            e.Property(x => x.Status).HasColumnName("status").HasMaxLength(32).IsRequired();
            e.Property(x => x.RequestedByUserId).HasColumnName("requested_by_user_id").IsRequired();
            e.Property(x => x.RequestedAtUtc).HasColumnName("requested_at_utc").IsRequired();
            e.Property(x => x.StartedAtUtc).HasColumnName("started_at_utc");
            e.Property(x => x.CompletedAtUtc).HasColumnName("completed_at_utc");
            e.Property(x => x.AttemptCount).HasColumnName("attempt_count").IsRequired();
            e.Property(x => x.ArtifactId).HasColumnName("artifact_id");
            e.Property(x => x.TemplateVersionId).HasColumnName("template_version_id");
            e.Property(x => x.SignatoryId).HasColumnName("signatory_id");
            e.Property(x => x.FailureCode).HasColumnName("failure_code").HasMaxLength(64);
            e.Property(x => x.FailureMessage).HasColumnName("failure_message").HasMaxLength(1000);
            e.Property(x => x.RowVersion).HasColumnName("row_version").IsConcurrencyToken();

            e.HasIndex(x => new { x.TenantId, x.ReportId, x.Status });
            e.HasIndex(x => new { x.Status, x.RequestedAtUtc });
            // One active (Pending|Running) generation per Report — PostgreSQL filtered unique index.
            e.HasIndex(x => new { x.TenantId, x.ReportId })
                .IsUnique()
                .HasFilter("status IN ('Pending', 'Running')")
                .HasDatabaseName("IX_lms_report_official_pdf_jobs_one_active");

            e.HasOne(x => x.Report)
                .WithMany()
                .HasForeignKey(x => x.ReportId)
                .OnDelete(DeleteBehavior.Restrict);
        });

        modelBuilder.Entity<LmsReportOfficialPdfArtifact>(e =>
        {
            e.ToTable("lms_report_official_pdf_artifacts");
            e.HasKey(x => x.Id);
            e.Property(x => x.Id).HasColumnName("id");
            e.Property(x => x.TenantId).HasColumnName("tenant_id").IsRequired();
            e.Property(x => x.ReportId).HasColumnName("report_id").IsRequired();
            e.Property(x => x.ReportVersionId).HasColumnName("report_version_id").IsRequired();
            e.Property(x => x.JobId).HasColumnName("job_id").IsRequired();
            e.Property(x => x.ArtifactVersion).HasColumnName("artifact_version").IsRequired();
            e.Property(x => x.Status).HasColumnName("status").HasMaxLength(32).IsRequired();
            e.Property(x => x.MimeType).HasColumnName("mime_type").HasMaxLength(100).IsRequired();
            e.Property(x => x.SizeBytes).HasColumnName("size_bytes").IsRequired();
            e.Property(x => x.ContentHash).HasColumnName("content_hash").HasMaxLength(64);
            e.Property(x => x.CanonicalDocumentId).HasColumnName("canonical_document_id");
            e.Property(x => x.TemplateVersionId).HasColumnName("template_version_id").IsRequired();
            e.Property(x => x.SignatoryId).HasColumnName("signatory_id").IsRequired();
            e.Property(x => x.GeneratedByUserId).HasColumnName("generated_by_user_id").IsRequired();
            e.Property(x => x.GeneratedAtUtc).HasColumnName("generated_at_utc").IsRequired();
            e.Property(x => x.FailureCode).HasColumnName("failure_code").HasMaxLength(64);
            e.Property(x => x.FailureMessage).HasColumnName("failure_message").HasMaxLength(1000);

            e.HasIndex(x => new { x.ReportId, x.ArtifactVersion }).IsUnique();
            e.HasIndex(x => new { x.TenantId, x.ReportId });
            e.HasIndex(x => x.CanonicalDocumentId);
            e.HasIndex(x => x.JobId).IsUnique();

            e.HasOne(x => x.Report)
                .WithMany()
                .HasForeignKey(x => x.ReportId)
                .OnDelete(DeleteBehavior.Restrict);

            e.HasOne(x => x.Job)
                .WithOne(j => j.Artifact!)
                .HasForeignKey<LmsReportOfficialPdfArtifact>(x => x.JobId)
                .OnDelete(DeleteBehavior.Restrict);
        });

        modelBuilder.Entity<LmsReportNumberConfiguration>(e =>
        {
            e.ToTable("lms_report_number_configurations");
            e.HasKey(x => x.Id);
            e.Property(x => x.Id).HasColumnName("id");
            e.Property(x => x.TenantId).HasColumnName("tenant_id").IsRequired();
            e.Property(x => x.OperatingBranchId).HasColumnName("operating_branch_id").IsRequired();
            e.Property(x => x.FormatCode).HasColumnName("format_code").HasMaxLength(64).IsRequired();
            e.Property(x => x.Prefix).HasColumnName("prefix").HasMaxLength(32).IsRequired();
            e.Property(x => x.Separator).HasColumnName("separator").HasMaxLength(8).IsRequired();
            e.Property(x => x.DateSegment).HasColumnName("date_segment").HasMaxLength(32).IsRequired();
            e.Property(x => x.DateTimezone).HasColumnName("date_timezone").HasMaxLength(16).IsRequired();
            e.Property(x => x.SequenceWidth).HasColumnName("sequence_width").IsRequired();
            e.Property(x => x.SequencePeriod).HasColumnName("sequence_period").HasMaxLength(32).IsRequired();
            e.Property(x => x.EffectiveFromUtc).HasColumnName("effective_from_utc").IsRequired();
            e.Property(x => x.IsActive).HasColumnName("is_active").IsRequired();
            e.Property(x => x.CreatedAtUtc).HasColumnName("created_at_utc").IsRequired();
            e.Property(x => x.CreatedByUserId).HasColumnName("created_by_user_id").IsRequired();
            e.Property(x => x.UpdatedAtUtc).HasColumnName("updated_at_utc");
            e.Property(x => x.UpdatedByUserId).HasColumnName("updated_by_user_id");
            e.HasIndex(x => new { x.TenantId, x.OperatingBranchId, x.EffectiveFromUtc });
            e.HasIndex(x => new { x.TenantId, x.OperatingBranchId, x.IsActive });
        });

        modelBuilder.Entity<LmsReportNumberSequence>(e =>
        {
            e.ToTable("lms_report_number_sequences");
            e.HasKey(x => x.Id);
            e.Property(x => x.Id).HasColumnName("id");
            e.Property(x => x.TenantId).HasColumnName("tenant_id").IsRequired();
            e.Property(x => x.OperatingBranchId).HasColumnName("operating_branch_id").IsRequired();
            e.Property(x => x.SequencePeriodKey).HasColumnName("sequence_period_key").HasMaxLength(32).IsRequired();
            e.Property(x => x.LastValue).HasColumnName("last_value").IsRequired();
            e.HasIndex(x => new { x.TenantId, x.OperatingBranchId, x.SequencePeriodKey }).IsUnique();
        });

        modelBuilder.Entity<LmsReportVersion>(e =>
        {
            e.ToTable("lms_report_versions");
            e.HasKey(x => x.Id);
            e.Property(x => x.Id).HasColumnName("id");
            e.Property(x => x.TenantId).HasColumnName("tenant_id").IsRequired();
            e.Property(x => x.ReportId).HasColumnName("report_id").IsRequired();
            e.Property(x => x.VersionNumber).HasColumnName("version_number").IsRequired();
            e.Property(x => x.PatientId).HasColumnName("patient_id").IsRequired();
            e.Property(x => x.OrderId).HasColumnName("order_id").IsRequired();
            e.Property(x => x.OperatingBranchId).HasColumnName("operating_branch_id").IsRequired();
            e.Property(x => x.CreatedAtUtc).HasColumnName("created_at_utc").IsRequired();
            e.Property(x => x.CreatedByUserId).HasColumnName("created_by_user_id").IsRequired();

            e.HasIndex(x => new { x.ReportId, x.VersionNumber }).IsUnique();
            e.HasIndex(x => new { x.TenantId, x.ReportId });

            e.HasMany(x => x.Sources)
                .WithOne(s => s.ReportVersion!)
                .HasForeignKey(s => s.ReportVersionId)
                .OnDelete(DeleteBehavior.Restrict);
        });

        modelBuilder.Entity<LmsReportVersionSource>(e =>
        {
            e.ToTable("lms_report_version_sources");
            e.HasKey(x => x.Id);
            e.Property(x => x.Id).HasColumnName("id");
            e.Property(x => x.TenantId).HasColumnName("tenant_id").IsRequired();
            e.Property(x => x.ReportVersionId).HasColumnName("report_version_id").IsRequired();
            e.Property(x => x.ResultId).HasColumnName("result_id").IsRequired();
            e.Property(x => x.ResultVersionId).HasColumnName("result_version_id").IsRequired();
            e.Property(x => x.ResultVersionNumber).HasColumnName("result_version_number").IsRequired();
            e.Property(x => x.OrderTestId).HasColumnName("order_test_id").IsRequired();
            e.Property(x => x.SpecimenId).HasColumnName("specimen_id").IsRequired();
            e.Property(x => x.CatalogueItemId).HasColumnName("catalogue_item_id").IsRequired();
            e.Property(x => x.CatalogueVersionId).HasColumnName("catalogue_version_id").IsRequired();
            e.Property(x => x.ResultDatatype).HasColumnName("result_datatype").HasMaxLength(64).IsRequired();
            e.Property(x => x.NumericValue).HasColumnName("numeric_value").HasMaxLength(64);
            e.Property(x => x.QualitativeValue).HasColumnName("qualitative_value").HasMaxLength(256);
            e.Property(x => x.Unit).HasColumnName("unit").HasMaxLength(64);
            e.Property(x => x.Comment).HasColumnName("comment").HasMaxLength(2000);
            e.Property(x => x.ResultStatusAtSnapshot).HasColumnName("result_status_at_snapshot").HasMaxLength(32).IsRequired();
            e.Property(x => x.AuthorizedByUserId).HasColumnName("authorized_by_user_id");
            e.Property(x => x.AuthorizedAtUtc).HasColumnName("authorized_at_utc");

            e.HasIndex(x => new { x.ReportVersionId, x.ResultId, x.ResultVersionNumber }).IsUnique();
            e.HasIndex(x => new { x.TenantId, x.ResultId });
            e.HasIndex(x => x.ResultVersionId);

            e.HasOne<LmsResult>()
                .WithMany()
                .HasForeignKey(x => x.ResultId)
                .OnDelete(DeleteBehavior.Restrict);

            e.HasOne<LmsResultVersion>()
                .WithMany()
                .HasForeignKey(x => x.ResultVersionId)
                .OnDelete(DeleteBehavior.Restrict);
        });

        modelBuilder.Entity<LmsReportDraftSourceClaim>(e =>
        {
            e.ToTable("lms_report_draft_source_claims");
            e.HasKey(x => x.Id);
            e.Property(x => x.Id).HasColumnName("id");
            e.Property(x => x.TenantId).HasColumnName("tenant_id").IsRequired();
            e.Property(x => x.ResultVersionId).HasColumnName("result_version_id").IsRequired();
            e.Property(x => x.ReportId).HasColumnName("report_id").IsRequired();
            e.Property(x => x.ResultId).HasColumnName("result_id").IsRequired();
            e.Property(x => x.ResultVersionNumber).HasColumnName("result_version_number").IsRequired();
            e.Property(x => x.CreatedAtUtc).HasColumnName("created_at_utc").IsRequired();

            e.HasIndex(x => new { x.TenantId, x.ResultVersionId }).IsUnique();
            e.HasIndex(x => x.ReportId);
            e.HasIndex(x => x.ResultVersionId);

            e.HasOne<LmsReport>()
                .WithMany()
                .HasForeignKey(x => x.ReportId)
                .OnDelete(DeleteBehavior.Restrict);

            e.HasOne<LmsResultVersion>()
                .WithMany()
                .HasForeignKey(x => x.ResultVersionId)
                .OnDelete(DeleteBehavior.Restrict);
        });

        modelBuilder.Entity<LmsReportIdempotencyRecord>(e =>
        {
            e.ToTable("lms_report_idempotency");
            e.HasKey(x => x.Id);
            e.Property(x => x.Id).HasColumnName("id");
            e.Property(x => x.TenantId).HasColumnName("tenant_id").IsRequired();
            e.Property(x => x.IdempotencyKey).HasColumnName("idempotency_key").HasMaxLength(200).IsRequired();
            e.Property(x => x.Operation).HasColumnName("operation").HasMaxLength(64).IsRequired();
            e.Property(x => x.RequestHash).HasColumnName("request_hash").HasMaxLength(64).IsRequired();
            e.Property(x => x.ReportId).HasColumnName("report_id").IsRequired();
            e.Property(x => x.ResponseJson).HasColumnName("response_json").IsRequired();
            e.Property(x => x.CreatedAt).HasColumnName("created_at").IsRequired();
            e.HasIndex(x => new { x.TenantId, x.IdempotencyKey }).IsUnique();
        });
    }
}
