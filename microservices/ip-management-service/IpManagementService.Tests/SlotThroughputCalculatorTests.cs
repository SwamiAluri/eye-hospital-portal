using IpManagementService.Models.Domain;
using IpManagementService.Services;
using Xunit;

namespace IpManagementService.Tests;

public class SlotThroughputCalculatorTests
{
    private static readonly DateOnly Day = new(2026, 8, 25);
    private static readonly Guid Theatre = Guid.Parse("aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa");

    [Fact]
    public void PrefersActiveSlot_OverReleasedHistory()
    {
        var journey = Guid.NewGuid();
        var planned = Day.ToDateTime(new TimeOnly(8, 0), DateTimeKind.Utc);
        var facts = new[]
        {
            Fact(journey, planned, releasedAt: planned.AddHours(1), createdAt: planned, sequence: 1),
            Fact(journey, planned.AddMinutes(20), releasedAt: null, createdAt: planned.AddHours(2), sequence: 2),
        };

        var dto = SlotThroughputCalculator.Compute(facts, Day, Day);

        Assert.Equal(1, dto.AssignedCount);
        Assert.Equal(1, dto.ActiveCount);
        Assert.Equal(0, dto.CancelledCount);
    }

    [Fact]
    public void ArrivalToDischarge_AverageAndMedian()
    {
        var a = Guid.NewGuid();
        var b = Guid.NewGuid();
        var start = Day.ToDateTime(new TimeOnly(8, 0), DateTimeKind.Utc);
        var facts = new[]
        {
            Fact(a, start, dischargedAt: start.AddMinutes(60)),
            Fact(b, start, dischargedAt: start.AddMinutes(120)),
        };

        var dto = SlotThroughputCalculator.Compute(facts, Day, Day);

        Assert.Equal(90, dto.AvgArrivalToDischargeMinutes);
        Assert.Equal(90, dto.MedianArrivalToDischargeMinutes);
        Assert.Equal(2, dto.DischargedCount);
    }

    [Fact]
    public void Turnover_UsesSurgeryEndedGaps_InSameTheatreSession()
    {
        var start = Day.ToDateTime(new TimeOnly(8, 0), DateTimeKind.Utc);
        var facts = new[]
        {
            Fact(Guid.NewGuid(), start, surgeryEndedAt: start.AddHours(1), sequence: 1),
            Fact(Guid.NewGuid(), start.AddMinutes(30), surgeryEndedAt: start.AddHours(1).AddMinutes(25), sequence: 2),
        };

        var dto = SlotThroughputCalculator.Compute(facts, Day, Day);

        Assert.Equal(25, dto.AvgTurnoverMinutes);
        Assert.Equal(2, dto.CompletedCount);
    }

    [Fact]
    public void ReleasedOnly_CountsAsCancelled()
    {
        var planned = Day.ToDateTime(new TimeOnly(8, 0), DateTimeKind.Utc);
        var facts = new[]
        {
            Fact(Guid.NewGuid(), planned, releasedAt: planned.AddMinutes(10)),
        };

        var dto = SlotThroughputCalculator.Compute(facts, Day, Day);

        Assert.Equal(1, dto.AssignedCount);
        Assert.Equal(0, dto.ActiveCount);
        Assert.Equal(1, dto.CancelledCount);
    }

    [Fact]
    public void ReadyCount_UsesClinicalState()
    {
        var planned = Day.ToDateTime(new TimeOnly(8, 0), DateTimeKind.Utc);
        var facts = new[]
        {
            Fact(Guid.NewGuid(), planned, clinical: ClinicalState.ReadyForSurgery),
            Fact(Guid.NewGuid(), planned, clinical: ClinicalState.Admitted),
        };

        var dto = SlotThroughputCalculator.Compute(facts, Day, Day);
        Assert.Equal(1, dto.ReadyCount);
    }

    private static SlotThroughputFact Fact(
        Guid journeyId,
        DateTime planned,
        DateTime? releasedAt = null,
        DateTime? createdAt = null,
        DateTime? surgeryEndedAt = null,
        DateTime? dischargedAt = null,
        int sequence = 1,
        string? clinical = null)
        => new(
            Guid.NewGuid(),
            journeyId,
            Theatre,
            "Theatre 1",
            Day,
            SlotSession.Morning,
            sequence,
            planned,
            createdAt ?? planned,
            releasedAt,
            surgeryEndedAt,
            dischargedAt,
            clinical);
}
