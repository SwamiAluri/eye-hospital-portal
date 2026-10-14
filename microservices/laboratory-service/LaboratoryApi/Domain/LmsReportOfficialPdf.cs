namespace LaboratoryApi.Domain;

/// <summary>
/// L-REP-03 CUT B / B1 — tenant-level immutable Official PDF template version.
/// No production defaults. Once used for an Official PDF, the version is immutable.
/// </summary>
public class LmsReportPdfTemplateVersion
{
    public Guid Id { get; set; }
    public Guid TenantId { get; set; }

    /// <summary>Governed template code (environment-specific identity, not a hard-coded hospital name).</summary>
    public string TemplateCode { get; set; } = string.Empty;

    public int VersionNumber { get; set; }

    public string HospitalLaboratoryName { get; set; } = string.Empty;

    /// <summary>Governed logo bytes (PNG/JPEG). Required for successful Official PDF generation.</summary>
    public byte[] LogoContent { get; set; } = Array.Empty<byte>();

    public string LogoMimeType { get; set; } = string.Empty;

    public DateTime EffectiveFromUtc { get; set; }
    public bool IsActive { get; set; } = true;

    /// <summary>Set when first used for a successful Official PDF; thereafter in-place edits are forbidden.</summary>
    public bool IsLocked { get; set; }

    public DateTime? LockedAtUtc { get; set; }

    public DateTime CreatedAtUtc { get; set; }
    public Guid CreatedByUserId { get; set; }
    public DateTime? UpdatedAtUtc { get; set; }
    public Guid? UpdatedByUserId { get; set; }
}

/// <summary>
/// L-REP-03 CUT B / B1 — configured laboratory signatory (name + credentials text only).
/// </summary>
public class LmsReportPdfSignatory
{
    public Guid Id { get; set; }
    public Guid TenantId { get; set; }

    public string Name { get; set; } = string.Empty;

    /// <summary>Professional title / credentials text (PD-PDF-07). No signature image.</summary>
    public string CredentialsText { get; set; } = string.Empty;

    public DateTime EffectiveFromUtc { get; set; }
    public bool IsActive { get; set; } = true;

    public DateTime CreatedAtUtc { get; set; }
    public Guid CreatedByUserId { get; set; }
    public DateTime? UpdatedAtUtc { get; set; }
    public Guid? UpdatedByUserId { get; set; }
}

/// <summary>
/// Immutable Official PDF artifact version (LaboratoryApi SoT). Starts at version 1.
/// Failed attempts are never current; CanonicalDocumentId is downstream storage identity.
/// </summary>
public class LmsReportOfficialPdfArtifact
{
    public Guid Id { get; set; }
    public Guid TenantId { get; set; }
    public Guid ReportId { get; set; }
    public Guid ReportVersionId { get; set; }
    public Guid JobId { get; set; }

    public int ArtifactVersion { get; set; }

    /// <summary>Succeeded | Failed</summary>
    public string Status { get; set; } = OfficialPdfArtifactStatuses.Failed;

    public string MimeType { get; set; } = string.Empty;
    public long SizeBytes { get; set; }
    public string? ContentHash { get; set; }
    public Guid? CanonicalDocumentId { get; set; }

    public Guid TemplateVersionId { get; set; }
    public Guid SignatoryId { get; set; }

    public Guid GeneratedByUserId { get; set; }
    public DateTime GeneratedAtUtc { get; set; }

    public string? FailureCode { get; set; }
    public string? FailureMessage { get; set; }

    public LmsReport? Report { get; set; }
    public LmsReportOfficialPdfJob? Job { get; set; }
}

/// <summary>
/// LaboratoryApi-owned Official PDF generation job (PD-PDF-10). Timer drain processes Pending.
/// At most one Pending/Running job per Report (DB filtered unique index).
/// </summary>
public class LmsReportOfficialPdfJob
{
    public Guid Id { get; set; }
    public Guid TenantId { get; set; }
    public Guid OperatingBranchId { get; set; }
    public Guid ReportId { get; set; }

    /// <summary>Pending | Running | Succeeded | Failed</summary>
    public string Status { get; set; } = OfficialPdfJobStatuses.Pending;

    public Guid RequestedByUserId { get; set; }
    public DateTime RequestedAtUtc { get; set; }
    public DateTime? StartedAtUtc { get; set; }
    public DateTime? CompletedAtUtc { get; set; }

    public int AttemptCount { get; set; }

    public Guid? ArtifactId { get; set; }
    public Guid? TemplateVersionId { get; set; }
    public Guid? SignatoryId { get; set; }

    public string? FailureCode { get; set; }
    public string? FailureMessage { get; set; }

    public int RowVersion { get; set; } = 1;

    public LmsReport? Report { get; set; }
    public LmsReportOfficialPdfArtifact? Artifact { get; set; }
}

public static class OfficialPdfJobStatuses
{
    public const string Pending = "Pending";
    public const string Running = "Running";
    public const string Succeeded = "Succeeded";
    public const string Failed = "Failed";

    public static bool IsActive(string status) =>
        string.Equals(status, Pending, StringComparison.Ordinal)
        || string.Equals(status, Running, StringComparison.Ordinal);
}

public static class OfficialPdfArtifactStatuses
{
    public const string Succeeded = "Succeeded";
    public const string Failed = "Failed";
}

/// <summary>Technical job drain mechanics (not product decisions).</summary>
public static class OfficialPdfJobMechanics
{
    /// <summary>Max processing attempts before terminal Failed without further automatic retry.</summary>
    public const int MaxAttempts = 3;

    /// <summary>Running jobs older than this are marked Failed (stale) so a new request may proceed.</summary>
    public static readonly TimeSpan StaleRunningTtl = TimeSpan.FromMinutes(15);

    public const string MimeTypePdf = "application/pdf";
}

/// <summary>PD-PDF-08 — template versions are immutable once used for an Official PDF.</summary>
public static class OfficialPdfTemplateRules
{
    public static void EnsureMutable(LmsReportPdfTemplateVersion template)
    {
        if (template.IsLocked)
            throw new InvalidOperationException(
                "Official PDF template version is locked and cannot be edited in place. Create a new template version.");
    }
}
