namespace LaboratoryApi.Domain;

/// <summary>
/// Immutable submitted clinical snapshot (and mutable draft content while Status=Draft on parent).
/// Amendment creates a new version; historical rows are never rewritten.
/// </summary>
public class LmsOrderVersion
{
    public Guid Id { get; set; }
    public Guid TenantId { get; set; }
    public Guid OrderId { get; set; }
    public int VersionNumber { get; set; }

    public Guid PatientId { get; set; }
    public string? PatientMrnSnapshot { get; set; }
    public string? PatientNameSnapshot { get; set; }
    public DateTime? PatientDateOfBirthSnapshot { get; set; }

    public Guid? VisitId { get; set; }

    public Guid OrderingProviderUserId { get; set; }
    public string? OrderingProviderNameSnapshot { get; set; }
    public Guid ResponsibleClinicianUserId { get; set; }
    public string? ResponsibleClinicianNameSnapshot { get; set; }

    public Guid OperatingBranchId { get; set; }
    /// <summary>L-ORD-01B: equals OperatingBranchId (no unsafe cross-site performing site).</summary>
    public Guid PerformingBranchId { get; set; }

    public string OrderSource { get; set; } = OrderSources.Clinician;
    public string Priority { get; set; } = OrderPriorities.Routine;
    public string? PriorityReason { get; set; }
    public string ClinicalIndication { get; set; } = string.Empty;
    public string? Notes { get; set; }

    public string? ConsentReference { get; set; }
    public string? ConsentTemplateVersionRef { get; set; }
    public string? AcknowledgementEvidence { get; set; }

    public string? PayerContextRef { get; set; }
    public string? AuthorizationReference { get; set; }
    public string? FinancialDispositionRef { get; set; }
    public string? ServiceCatalogRef { get; set; }

    public string? AmendmentReason { get; set; }

    public DateTime CreatedAt { get; set; }
    public Guid CreatedBy { get; set; }
    public DateTime? SubmittedAt { get; set; }
    public Guid? SubmittedBy { get; set; }

    public LmsOrder? Order { get; set; }
    public ICollection<LmsOrderSelection> Selections { get; set; } = new List<LmsOrderSelection>();
    public ICollection<LmsOrderTest> Tests { get; set; } = new List<LmsOrderTest>();
}
