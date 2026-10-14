namespace LaboratoryApi.Domain;

/// <summary>
/// L-CRT-01 — Orthogonal Critical Result safety event.
/// Does not change ResultStatus. Binds to exact ResultVersionNumber.
/// </summary>
public class LmsCriticalResultEvent
{
    public Guid Id { get; set; }
    public Guid TenantId { get; set; }
    public Guid ResultId { get; set; }
    public int ResultVersionNumber { get; set; }
    public Guid OperatingBranchId { get; set; }

    /// <summary>Open or Acknowledged.</summary>
    public string Status { get; set; } = CriticalResultEventStatuses.Open;

    public Guid ClassifiedByUserId { get; set; }
    public DateTime ClassifiedAtUtc { get; set; }

    public Guid? AcknowledgedByUserId { get; set; }
    public DateTime? AcknowledgedAtUtc { get; set; }
    public string? AcknowledgementEvidence { get; set; }

    /// <summary>NotAttempted, Emitted, Failed, Unavailable — delivery honesty, not acknowledgement.</summary>
    public string NotificationIntentStatus { get; set; } = CriticalNotificationIntentStatuses.NotAttempted;

    public string? NotificationIntentDetail { get; set; }

    public DateTime CreatedAtUtc { get; set; }
    public Guid CreatedByUserId { get; set; }
    public DateTime UpdatedAtUtc { get; set; }
    public Guid UpdatedByUserId { get; set; }
    public int RowVersion { get; set; }

    public LmsResult? Result { get; set; }
}
