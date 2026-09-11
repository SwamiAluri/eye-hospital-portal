using System;

namespace AuthService.Services;

public enum CounselingAnalyticsDateWindowMode
{
    Period,
    Custom,
}

public sealed class CounselingAnalyticsDateWindowException : Exception
{
    public CounselingAnalyticsDateWindowException(string message) : base(message) { }
}

/// <summary>
/// Shared Analytics date-window for Summary and Trends (Phase 2D).
/// SessionDate is a date column; bounds use UTC calendar dates (half-open).
/// Not related to Follow-up Center due-date heuristics.
/// </summary>
public sealed class CounselingAnalyticsDateWindow
{
    public const int DefaultPeriodDays = 30;
    public const int MaxPeriodDays = 366;

    public DateTime FromInclusive { get; init; }
    public DateTime ToExclusive { get; init; }
    public int? Period { get; init; }
    public CounselingAnalyticsDateWindowMode Mode { get; init; }

    public static CounselingAnalyticsDateWindow Resolve(
        int period,
        DateTime? from,
        DateTime? to,
        DateTime utcNow)
    {
        var hasFrom = from.HasValue;
        var hasTo = to.HasValue;

        if (hasFrom != hasTo)
            throw new CounselingAnalyticsDateWindowException(
                "Both 'from' and 'to' are required for a custom date range.");

        if (hasFrom && hasTo)
        {
            var fromDate = DateTime.SpecifyKind(from!.Value.Date, DateTimeKind.Utc);
            var toDate = DateTime.SpecifyKind(to!.Value.Date, DateTimeKind.Utc);
            if (fromDate > toDate)
                throw new CounselingAnalyticsDateWindowException(
                    "'from' must be on or before 'to'.");

            return new CounselingAnalyticsDateWindow
            {
                FromInclusive = fromDate,
                ToExclusive = toDate.AddDays(1),
                Period = null,
                Mode = CounselingAnalyticsDateWindowMode.Custom,
            };
        }

        if (period < 1) period = DefaultPeriodDays;
        if (period > MaxPeriodDays) period = MaxPeriodDays;

        var today = DateTime.SpecifyKind(utcNow.Date, DateTimeKind.Utc);
        return new CounselingAnalyticsDateWindow
        {
            FromInclusive = today.AddDays(-period),
            ToExclusive = today.AddDays(1),
            Period = period,
            Mode = CounselingAnalyticsDateWindowMode.Period,
        };
    }

    public bool ContainsSessionDate(DateTime sessionDate)
    {
        var d = sessionDate.Date;
        return d >= FromInclusive && d < ToExclusive;
    }
}
