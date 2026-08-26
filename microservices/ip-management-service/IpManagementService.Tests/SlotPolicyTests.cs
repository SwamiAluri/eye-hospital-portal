using IpManagementService.Models.Domain;
using IpManagementService.Services;
using Xunit;

namespace IpManagementService.Tests;

public class SlotPolicyTests
{
    [Fact]
    public void FormatLabel_UsesSessionPrefix()
    {
        Assert.Equal("AM-3", SlotPolicy.FormatLabel(SlotSession.Morning, 3));
        Assert.Equal("PM-1", SlotPolicy.FormatLabel(SlotSession.Afternoon, 1));
        Assert.Equal("EV-2", SlotPolicy.FormatLabel(SlotSession.Evening, 2));
    }

    [Fact]
    public void DefaultPlannedArrival_Seq1Morning_IsFifteenMinutesBeforeSessionStartIst()
    {
        var utc = SlotPolicy.DefaultPlannedArrivalUtc(new DateOnly(2026, 8, 25), SlotSession.Morning, 1);
        var local = TimeZoneInfo.ConvertTimeFromUtc(utc, SlotPolicy.HospitalTimeZone);
        Assert.Equal(new DateTime(2026, 8, 25, 7, 15, 0), local);
    }

    [Fact]
    public void DefaultPlannedArrival_StaggersThirtyMinutes()
    {
        var first = SlotPolicy.DefaultPlannedArrivalUtc(new DateOnly(2026, 8, 25), SlotSession.Afternoon, 1);
        var second = SlotPolicy.DefaultPlannedArrivalUtc(new DateOnly(2026, 8, 25), SlotSession.Afternoon, 2);
        Assert.Equal(30, (second - first).TotalMinutes);
    }

    [Fact]
    public void IsPastSentToOt_BlocksForwardGraphAndSentTimestamp()
    {
        Assert.True(SlotPolicy.IsPastSentToOt(new PatientJourney { ClinicalState = ClinicalState.SentToOT }));
        Assert.True(SlotPolicy.IsPastSentToOt(new PatientJourney
        {
            ClinicalState = ClinicalState.Admitted,
            SentToOtAt = DateTime.UtcNow,
        }));
        Assert.False(SlotPolicy.IsPastSentToOt(new PatientJourney { ClinicalState = ClinicalState.ReadyForSurgery }));
    }

    [Fact]
    public void NormalizeSession_RejectsUnknown()
    {
        Assert.Equal(SlotSession.Morning, SlotPolicy.NormalizeSession("Morning"));
        Assert.Throws<ArgumentException>(() => SlotPolicy.NormalizeSession("AM"));
    }
}
