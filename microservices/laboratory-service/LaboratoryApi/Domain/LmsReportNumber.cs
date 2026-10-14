namespace LaboratoryApi.Domain;

/// <summary>
/// L-REP-03 CUT A — governed Report Number format configuration (operating-branch scoped).
/// No production default values are seeded; assignment fails closed when config is missing.
/// </summary>
public class LmsReportNumberConfiguration
{
    public Guid Id { get; set; }
    public Guid TenantId { get; set; }
    public Guid OperatingBranchId { get; set; }

    /// <summary>Governed format identifier (environment-specific; not a hard-coded production rule).</summary>
    public string FormatCode { get; set; } = string.Empty;

    public string Prefix { get; set; } = string.Empty;
    public string Separator { get; set; } = string.Empty;

    /// <summary>YYYYMMDD when period segment is included; NONE when omitted.</summary>
    public string DateSegment { get; set; } = string.Empty;

    /// <summary>UTC for period boundary evaluation.</summary>
    public string DateTimezone { get; set; } = string.Empty;

    public int SequenceWidth { get; set; }

    /// <summary>UTC_DAY or NONE (no periodic reset).</summary>
    public string SequencePeriod { get; set; } = string.Empty;

    public DateTime EffectiveFromUtc { get; set; }
    public bool IsActive { get; set; } = true;
    public DateTime CreatedAtUtc { get; set; }
    public Guid CreatedByUserId { get; set; }
    public DateTime? UpdatedAtUtc { get; set; }
    public Guid? UpdatedByUserId { get; set; }
}

/// <summary>
/// Operating-branch Report Number counter. Keyed by tenant + operating branch + period key.
/// </summary>
public class LmsReportNumberSequence
{
    public Guid Id { get; set; }
    public Guid TenantId { get; set; }
    public Guid OperatingBranchId { get; set; }

    /// <summary>Period bucket (e.g. yyyyMMdd for UTC_DAY, or * for NONE).</summary>
    public string SequencePeriodKey { get; set; } = string.Empty;

    public int LastValue { get; set; }
}

/// <summary>
/// Structural constants for Report Number configuration validation.
/// Not production format values — those come from governed configuration rows.
/// </summary>
public static class ReportNumberFormats
{
    public const string DateTimezoneUtc = "UTC";
    public const string DateSegmentYyyyMmDd = "YYYYMMDD";
    public const string DateSegmentNone = "NONE";
    public const string SequencePeriodUtcDay = "UTC_DAY";
    public const string SequencePeriodNone = "NONE";
    public const string PeriodKeyNone = "*";

    public const int MinSequenceWidth = 1;
    public const int MaxSequenceWidth = 12;
    public const int MaxPrefixLength = 32;
    public const int MaxSeparatorLength = 8;
    public const int MaxBusinessReportNumberLength = 64;

    /// <summary>
    /// Test-only seed helper. Values are automated-test configuration, not production defaults.
    /// </summary>
    public static LmsReportNumberConfiguration CreateTestConfiguration(
        Guid tenantId,
        Guid operatingBranchId,
        Guid actorId,
        DateTime? effectiveFromUtc = null,
        string prefix = "RPT",
        string separator = "-",
        int sequenceWidth = 6,
        string sequencePeriod = SequencePeriodUtcDay,
        string dateSegment = DateSegmentYyyyMmDd,
        string formatCode = "TEST_RPT_UTC_DAY") =>
        new()
        {
            Id = Guid.NewGuid(),
            TenantId = tenantId,
            OperatingBranchId = operatingBranchId,
            FormatCode = formatCode,
            Prefix = prefix,
            Separator = separator,
            DateSegment = dateSegment,
            DateTimezone = DateTimezoneUtc,
            SequenceWidth = sequenceWidth,
            SequencePeriod = sequencePeriod,
            EffectiveFromUtc = effectiveFromUtc
                ?? new DateTime(2000, 1, 1, 0, 0, 0, DateTimeKind.Utc),
            IsActive = true,
            CreatedAtUtc = DateTime.UtcNow,
            CreatedByUserId = actorId,
        };

    public static bool IsStructurallyValid(LmsReportNumberConfiguration c)
    {
        if (c is null || !c.IsActive)
            return false;
        if (string.IsNullOrWhiteSpace(c.Prefix) || c.Prefix.Length > MaxPrefixLength)
            return false;
        if (c.Separator.Length > MaxSeparatorLength)
            return false;
        if (c.SequenceWidth < MinSequenceWidth || c.SequenceWidth > MaxSequenceWidth)
            return false;
        if (!string.Equals(c.DateTimezone, DateTimezoneUtc, StringComparison.Ordinal))
            return false;

        var periodOk =
            string.Equals(c.SequencePeriod, SequencePeriodUtcDay, StringComparison.Ordinal)
            || string.Equals(c.SequencePeriod, SequencePeriodNone, StringComparison.Ordinal);
        if (!periodOk)
            return false;

        if (string.Equals(c.SequencePeriod, SequencePeriodUtcDay, StringComparison.Ordinal))
        {
            if (!string.Equals(c.DateSegment, DateSegmentYyyyMmDd, StringComparison.Ordinal))
                return false;
        }
        else if (!string.Equals(c.DateSegment, DateSegmentNone, StringComparison.Ordinal)
                 && !string.Equals(c.DateSegment, DateSegmentYyyyMmDd, StringComparison.Ordinal))
        {
            return false;
        }

        return !string.IsNullOrWhiteSpace(c.FormatCode);
    }

    public static string ResolvePeriodKey(LmsReportNumberConfiguration config, DateTime utcNow)
    {
        if (string.Equals(config.SequencePeriod, SequencePeriodNone, StringComparison.Ordinal))
            return PeriodKeyNone;
        return DateOnly.FromDateTime(utcNow).ToString("yyyyMMdd");
    }

    public static string FormatNumber(
        LmsReportNumberConfiguration config, int sequenceValue, DateTime utcNow)
    {
        if (sequenceValue < 1)
            throw new ArgumentOutOfRangeException(nameof(sequenceValue));

        var padded = sequenceValue.ToString($"D{config.SequenceWidth}");
        var includeDate = string.Equals(config.DateSegment, DateSegmentYyyyMmDd, StringComparison.Ordinal);

        if (!includeDate)
            return string.IsNullOrEmpty(config.Separator)
                ? $"{config.Prefix}{padded}"
                : $"{config.Prefix}{config.Separator}{padded}";

        var datePart = DateOnly.FromDateTime(utcNow).ToString("yyyyMMdd");
        if (string.IsNullOrEmpty(config.Separator))
            return $"{config.Prefix}{datePart}{padded}";
        return $"{config.Prefix}{config.Separator}{datePart}{config.Separator}{padded}";
    }
}
