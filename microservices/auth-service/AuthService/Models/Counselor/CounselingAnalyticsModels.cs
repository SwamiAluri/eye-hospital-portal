using System;
using System.Collections.Generic;
using System.Text.Json.Serialization;

namespace AuthService.Models.Counselor;

public class CounselingAnalyticsSummaryDto
{
    public int? Period { get; set; }
    public string WindowMode { get; set; } = "period";
    public DateTime From { get; set; }
    public DateTime ToExclusive { get; set; }
    public Guid? BranchId { get; set; }
    public Guid? CounselorId { get; set; }
    public int TotalSessions { get; set; }
    public int AgreedCount { get; set; }
    public int DeclinedCount { get; set; }
    public int UndecidedCount { get; set; }
    /// <summary>PD13 alias — same value as <see cref="UndecidedCount"/>.</summary>
    public int PendingDecisionCount { get; set; }
    public int ExceptionCount { get; set; }
    public int OtherUnclassifiedCount { get; set; }
    public int EligibleOutcomeSessions { get; set; }
    public double DecisionRate { get; set; }
    public double ConversionRate { get; set; }
    public double AvgDaysToDecision { get; set; }
    public List<AnalyticsSurgeryTypeCountDto> BySurgeryType { get; set; } = new();
    public List<AnalyticsSessionTypeCountDto> BySessionType { get; set; } = new();
    public int CallbackTotal { get; set; }
    public int CallbackCompleted { get; set; }
    public double CallbackCompletionRate { get; set; }
    public DateTime GeneratedAt { get; set; }
}

public class AnalyticsSurgeryTypeCountDto
{
    public string SurgeryType { get; set; } = "";
    public int Count { get; set; }
    public int AgreedCount { get; set; }
}

public class AnalyticsSessionTypeCountDto
{
    public string SessionType { get; set; } = "";
    public int Count { get; set; }
}

public class CounselingAnalyticsTrendsDto
{
    public int? Period { get; set; }
    public string WindowMode { get; set; } = "period";
    public DateTime From { get; set; }
    public DateTime ToExclusive { get; set; }
    public Guid? BranchId { get; set; }
    public Guid? CounselorId { get; set; }
    public List<AnalyticsTrendPointDto> Trend { get; set; } = new();
}

public class AnalyticsTrendPointDto
{
    public string Date { get; set; } = "";
    public int Count { get; set; }
    public int AgreedCount { get; set; }
}

/// <summary>
/// Aging population is PendingDecision == true (NOT Follow-up Center Active intention allowlist).
/// </summary>
public class CounselingAnalyticsAgingDto
{
    public int? Period { get; set; }
    public string WindowMode { get; set; } = "period";
    public DateTime? From { get; set; }
    public DateTime? ToExclusive { get; set; }
    public Guid? BranchId { get; set; }
    public Guid? CounselorId { get; set; }
    public int TotalPending { get; set; }
    public AnalyticsAgingBucketCountsDto Counts { get; set; } = new();
    public AnalyticsAgingBucketsDto Buckets { get; set; } = new();
    public bool Truncated { get; set; }
    public int MaxItemsPerBucket { get; set; }
    public DateTime GeneratedAt { get; set; }
    /// <summary>Explicit contract note for clients.</summary>
    public string Population { get; set; } = "PendingDecision";
}

public class AnalyticsAgingBucketCountsDto
{
    [JsonPropertyName("bucket_0_3")]
    public int Bucket03 { get; set; }

    [JsonPropertyName("bucket_4_7")]
    public int Bucket47 { get; set; }

    [JsonPropertyName("bucket_8_14")]
    public int Bucket814 { get; set; }

    [JsonPropertyName("bucket_15_plus")]
    public int Bucket15Plus { get; set; }
}

public class AnalyticsAgingBucketsDto
{
    [JsonPropertyName("bucket_0_3")]
    public List<AnalyticsAgingSessionDto> Bucket03 { get; set; } = new();

    [JsonPropertyName("bucket_4_7")]
    public List<AnalyticsAgingSessionDto> Bucket47 { get; set; } = new();

    [JsonPropertyName("bucket_8_14")]
    public List<AnalyticsAgingSessionDto> Bucket814 { get; set; } = new();

    [JsonPropertyName("bucket_15_plus")]
    public List<AnalyticsAgingSessionDto> Bucket15Plus { get; set; } = new();
}

public class AnalyticsAgingSessionDto
{
    public Guid Id { get; set; }
    public string PatientName { get; set; } = "";
    public string RecommendedSurgery { get; set; } = "—";
    public string? Phone { get; set; }
    public int DaysSinceSession { get; set; }
}
