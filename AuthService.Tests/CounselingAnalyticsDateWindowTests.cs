using System;
using AuthService.Services;
using Xunit;

namespace AuthService.Tests;

public class CounselingAnalyticsDateWindowTests
{
    private static readonly DateTime FixedUtc = new(2026, 9, 10, 15, 30, 0, DateTimeKind.Utc);

    [Fact]
    public void Period_UsesUtcDate_NotTimeOfDay_AndHalfOpenThroughEndOfToday()
    {
        var w = CounselingAnalyticsDateWindow.Resolve(period: 30, from: null, to: null, utcNow: FixedUtc);

        Assert.Equal(new DateTime(2026, 8, 11), w.FromInclusive);
        Assert.Equal(new DateTime(2026, 9, 11), w.ToExclusive);
        Assert.Equal(30, w.Period);
        Assert.Equal(CounselingAnalyticsDateWindowMode.Period, w.Mode);
    }

    [Fact]
    public void SummaryAndTrends_ShareIdenticalBounds_ForSamePeriod()
    {
        var a = CounselingAnalyticsDateWindow.Resolve(7, null, null, FixedUtc);
        var b = CounselingAnalyticsDateWindow.Resolve(7, null, null, FixedUtc);
        Assert.Equal(a.FromInclusive, b.FromInclusive);
        Assert.Equal(a.ToExclusive, b.ToExclusive);
    }

    [Fact]
    public void CustomFromTo_IsHalfOpenInclusiveStartExclusiveEndPlusOneDay()
    {
        var from = new DateTime(2026, 9, 1);
        var to = new DateTime(2026, 9, 5);
        var w = CounselingAnalyticsDateWindow.Resolve(period: 30, from: from, to: to, utcNow: FixedUtc);

        Assert.Equal(new DateTime(2026, 9, 1), w.FromInclusive);
        Assert.Equal(new DateTime(2026, 9, 6), w.ToExclusive);
        Assert.Equal(CounselingAnalyticsDateWindowMode.Custom, w.Mode);
        Assert.Null(w.Period);
    }

    [Fact]
    public void CustomRange_TakesPrecedenceOverPeriod()
    {
        var w = CounselingAnalyticsDateWindow.Resolve(
            period: 90,
            from: new DateTime(2026, 1, 1),
            to: new DateTime(2026, 1, 31),
            utcNow: FixedUtc);

        Assert.Equal(CounselingAnalyticsDateWindowMode.Custom, w.Mode);
        Assert.Equal(new DateTime(2026, 1, 1), w.FromInclusive);
        Assert.Equal(new DateTime(2026, 2, 1), w.ToExclusive);
    }

    [Fact]
    public void FromWithoutTo_IsInvalid()
    {
        var ex = Assert.Throws<CounselingAnalyticsDateWindowException>(() =>
            CounselingAnalyticsDateWindow.Resolve(30, new DateTime(2026, 9, 1), null, FixedUtc));
        Assert.Contains("from", ex.Message, StringComparison.OrdinalIgnoreCase);
        Assert.Contains("to", ex.Message, StringComparison.OrdinalIgnoreCase);
    }

    [Fact]
    public void ToWithoutFrom_IsInvalid()
    {
        Assert.Throws<CounselingAnalyticsDateWindowException>(() =>
            CounselingAnalyticsDateWindow.Resolve(30, null, new DateTime(2026, 9, 1), FixedUtc));
    }

    [Fact]
    public void FromAfterTo_IsInvalid()
    {
        Assert.Throws<CounselingAnalyticsDateWindowException>(() =>
            CounselingAnalyticsDateWindow.Resolve(
                30,
                new DateTime(2026, 9, 10),
                new DateTime(2026, 9, 1),
                FixedUtc));
    }

    [Fact]
    public void PeriodLessThanOne_DefaultsToThirty()
    {
        var w = CounselingAnalyticsDateWindow.Resolve(0, null, null, FixedUtc);
        Assert.Equal(30, w.Period);
        Assert.Equal(FixedUtc.Date.AddDays(-30), w.FromInclusive);
    }

    [Fact]
    public void Period_ClampedToMax366()
    {
        var w = CounselingAnalyticsDateWindow.Resolve(999, null, null, FixedUtc);
        Assert.Equal(366, w.Period);
    }
}
