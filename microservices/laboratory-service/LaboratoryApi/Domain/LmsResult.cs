namespace LaboratoryApi.Domain;

/// <summary>
/// LMS Result aggregate. Linked to OrderTest + specific Specimen.
/// Status: Draft → TechnicalVerified → ClinicallyAuthorized. Does not mutate OrderTest.
/// </summary>
public class LmsResult
{
    public Guid Id { get; set; }
    public Guid TenantId { get; set; }
    public Guid OrderId { get; set; }
    public Guid OrderTestId { get; set; }
    public Guid SpecimenId { get; set; }
    public Guid OperatingBranchId { get; set; }

    public Guid CatalogueItemId { get; set; }
    public Guid CatalogueVersionId { get; set; }
    public string ResultDatatype { get; set; } = string.Empty;

    /// <summary>Draft, TechnicalVerified, or ClinicallyAuthorized.</summary>
    public string Status { get; set; } = ResultStatuses.Draft;

    public int CurrentVersionNumber { get; set; }

    public string? NumericValue { get; set; }
    public string? QualitativeValue { get; set; }
    public string? Unit { get; set; }
    public string? Comment { get; set; }

    /// <summary>L-VER-01 — verifier when Status = TechnicalVerified (or later).</summary>
    public Guid? VerifiedByUserId { get; set; }

    /// <summary>L-VER-01 — verification UTC timestamp.</summary>
    public DateTime? VerifiedAtUtc { get; set; }

    /// <summary>L-VER-01 — CurrentVersionNumber that was verified.</summary>
    public int? VerifiedVersionNumber { get; set; }

    /// <summary>L-AUTH-01 — clinical authorizer when Status = ClinicallyAuthorized.</summary>
    public Guid? AuthorizedByUserId { get; set; }

    /// <summary>L-AUTH-01 — authorization UTC timestamp.</summary>
    public DateTime? AuthorizedAtUtc { get; set; }

    /// <summary>L-AUTH-01 — CurrentVersionNumber that was clinically authorized.</summary>
    public int? AuthorizedVersionNumber { get; set; }

    public DateTime CreatedAtUtc { get; set; }
    public Guid CreatedByUserId { get; set; }
    public DateTime UpdatedAtUtc { get; set; }
    public Guid UpdatedByUserId { get; set; }
    public int RowVersion { get; set; }

    public ICollection<LmsResultVersion> Versions { get; set; } = new List<LmsResultVersion>();
}
