namespace LaboratoryApi.Domain;

/// <summary>
/// LMS Specimen. Created via Complete Collection (Collected).
/// L-COL-01D adds Receive → Received (+ accession) and Reject → Rejected.
/// Barcode/label identity lives in dedicated L-COL-01E tables (not on this entity).
/// </summary>
public class LmsSpecimen
{
    public Guid Id { get; set; }
    public Guid TenantId { get; set; }
    public Guid CollectionTaskId { get; set; }
    public Guid OrderId { get; set; }
    public Guid PatientId { get; set; }
    public string? PatientMrnSnapshot { get; set; }
    public string? PatientNameSnapshot { get; set; }
    public DateTime? PatientDateOfBirthSnapshot { get; set; }
    public Guid CollectionBranchId { get; set; }
    public string? LocationText { get; set; }
    public Guid CollectedByUserId { get; set; }
    public DateTime CollectedAt { get; set; }
    public string Status { get; set; } = SpecimenStatuses.Collected;

    /// <summary>ACC-YYYYMMDD-NNNNNN — immutable once issued. Null until Received.</summary>
    public string? Accession { get; set; }
    public DateOnly? AccessionDate { get; set; }
    public int? AccessionSequence { get; set; }

    public DateTime? ReceivedAtUtc { get; set; }
    public Guid? ReceivedByUserId { get; set; }
    public Guid? ReceivingBranchId { get; set; }
    public string? ReceivingLocationText { get; set; }

    public string? RejectionReasonCode { get; set; }
    public string? RejectionReasonLabelSnapshot { get; set; }
    public DateTime? RejectedAtUtc { get; set; }
    public Guid? RejectedByUserId { get; set; }

    public DateTime CreatedAt { get; set; }
    public Guid CreatedBy { get; set; }
    public DateTime? UpdatedAt { get; set; }
    public Guid? UpdatedBy { get; set; }
    public int RowVersion { get; set; }

    public ICollection<LmsSpecimenOrderTest> OrderTests { get; set; } = new List<LmsSpecimenOrderTest>();
}
