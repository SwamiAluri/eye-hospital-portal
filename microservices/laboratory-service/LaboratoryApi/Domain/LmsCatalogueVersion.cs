namespace LaboratoryApi.Domain;

/// <summary>Versioned catalogue definition. Immutable once Active/Retired/Superseded.</summary>
public class LmsCatalogueVersion
{
    public Guid Id { get; set; }
    public Guid TenantId { get; set; }
    public Guid CatalogueItemId { get; set; }

    public int VersionNumber { get; set; }

    /// <summary>Draft | Review | Approved | Active | Retired | Superseded</summary>
    public string Status { get; set; } = CatalogueStatuses.Draft;

    public DateTime? EffectiveFrom { get; set; }
    public DateTime? EffectiveTo { get; set; }

    // Identity / coding
    public string InternalOrderCode { get; set; } = string.Empty;
    public string DisplayName { get; set; } = string.Empty;
    public string? Synonyms { get; set; }
    public string? ExternalMappingsJson { get; set; }
    public string Discipline { get; set; } = string.Empty;
    public string? Method { get; set; }

    /// <summary>LOCAL | REFERRAL</summary>
    public string Classification { get; set; } = CatalogueClassifications.Local;

    // Order rules / configuration references (nullable — no invented clinical policy)
    public bool Orderable { get; set; } = true;
    public string? PriorityConfigRef { get; set; }
    public string? AgeSexRestrictionConfigRef { get; set; }
    public bool? ConsentRequired { get; set; }
    public string? PreparationInstruction { get; set; }
    public string? DuplicateIntervalConfigRef { get; set; }
    public string? AddOnWindowConfigRef { get; set; }

    // Specimen / logistics references
    public string? SpecimenTypeRef { get; set; }
    public string? ContainerRef { get; set; }
    public string? RequiredVolume { get; set; }
    public string? PatientPreparation { get; set; }
    public string? CollectionTiming { get; set; }
    public string? StabilityNotes { get; set; }
    public string? TemperatureLightProtection { get; set; }
    public string? RejectionCriteria { get; set; }
    public string? StorageRequirements { get; set; }
    public string? TransportRequirements { get; set; }

    // Performance / routing references
    public string? PerformingSiteRef { get; set; }
    public string? BenchRef { get; set; }
    public string? InstrumentRef { get; set; }
    public string? ExpectedTatConfigRef { get; set; }
    public string? OperatingHoursConfigRef { get; set; }
    public string? RoutingConfigRef { get; set; }
    public string? CapacityConfigRef { get; set; }
    public string? ReferralPartnerRef { get; set; }

    // Result-definition references (nullable — not configured until owned masters exist)
    public string? ResultDatatype { get; set; }
    public string? PermittedUnits { get; set; }
    public string? ReferenceIntervalConfigRef { get; set; }
    public string? ReportabilityLimitConfigRef { get; set; }
    public string? FlagConfigRef { get; set; }
    public string? CriticalThresholdConfigRef { get; set; }
    public string? DeltaCheckConfigRef { get; set; }
    public string? CommentTemplateRef { get; set; }
    public string? AutoverificationEligibilityRef { get; set; }

    // Commercial / governance references (Billing remains financial SoT)
    public string? ServiceCatalogRef { get; set; }
    public string? PayerMappingRef { get; set; }
    public string? PackageMembershipRef { get; set; }
    public bool? AuthorizationRequired { get; set; }
    public string? AccreditationScopeStatus { get; set; }
    public string? OwnerRef { get; set; }
    public string? ApproverRef { get; set; }
    public string? ChangeReason { get; set; }

    // Lifecycle actors / timestamps
    public DateTime CreatedAt { get; set; }
    public Guid CreatedBy { get; set; }
    public DateTime? UpdatedAt { get; set; }
    public Guid? UpdatedBy { get; set; }
    public DateTime? SubmittedAt { get; set; }
    public Guid? SubmittedBy { get; set; }
    public DateTime? ApprovedAt { get; set; }
    public Guid? ApprovedBy { get; set; }
    public DateTime? ActivatedAt { get; set; }
    public Guid? ActivatedBy { get; set; }
    public DateTime? RetiredAt { get; set; }
    public Guid? RetiredBy { get; set; }
    public DateTime? SupersededAt { get; set; }
    public Guid? SupersededBy { get; set; }
    public Guid? SupersededByVersionId { get; set; }

    /// <summary>
    /// Optimistic concurrency token. Incremented on every successful mutation.
    /// Prevents silent last-write-wins on drafts and lifecycle races.
    /// </summary>
    public int RowVersion { get; set; }

    public LmsCatalogueItem? CatalogueItem { get; set; }
    public ICollection<LmsCataloguePanelComponent> PanelComponents { get; set; } = new List<LmsCataloguePanelComponent>();
    public ICollection<LmsCatalogueBranchApplicability> BranchApplicability { get; set; } = new List<LmsCatalogueBranchApplicability>();
}
