using IpManagementService.Models.Domain;
using IpManagementService.Models.Dtos;
using IpManagementService.Services;
using Xunit;

namespace IpManagementService.Tests;

public class DilationReadinessTests
{
    private static PreOpMedicationLog Drop(string name, DateTime? at, DateTime? deleted = null)
        => new()
        {
            Id = Guid.NewGuid(),
            MedicineName = name,
            AdministeredAt = at,
            DeletedAt = deleted,
        };

    [Fact]
    public void TenMinutesAgo_IsNotReadyWithRemaining()
    {
        var now = new DateTime(2026, 8, 25, 10, 0, 0, DateTimeKind.Utc);
        var slice = DilationReadiness.From(
            [Drop("Tropicamide", now.AddMinutes(-10))],
            now);

        Assert.Equal(DilationReadiness.NotReady, slice.Status);
        Assert.Equal("Tropicamide", slice.MedicineName);
        Assert.Equal(15 * 60, slice.RemainingSeconds);
        Assert.Equal(now.AddMinutes(-10), slice.StartedAt);
        Assert.Equal(now.AddMinutes(15), slice.ReadyAt);
    }

    [Fact]
    public void ThirtyMinutesAgo_IsReady()
    {
        var now = new DateTime(2026, 8, 25, 10, 0, 0, DateTimeKind.Utc);
        var slice = DilationReadiness.From(
            [Drop("Tropicamide 1%", now.AddMinutes(-30))],
            now);

        Assert.Equal(DilationReadiness.Ready, slice.Status);
        Assert.Equal(0, slice.RemainingSeconds);
    }

    [Fact]
    public void NoDilatingDrop_IsNotRecorded()
    {
        var now = DateTime.UtcNow;
        var slice = DilationReadiness.From(
            [Drop("Cefuroxime", now.AddMinutes(-5))],
            now);

        Assert.Equal(DilationReadiness.NotRecorded, slice.Status);
        Assert.Null(slice.StartedAt);
    }

    [Fact]
    public void FirstAdministeredDrop_Wins()
    {
        var now = new DateTime(2026, 8, 25, 10, 0, 0, DateTimeKind.Utc);
        var slice = DilationReadiness.From(
            [
                Drop("Phenylephrine", now.AddMinutes(-5)),
                Drop("Tropicamide", now.AddMinutes(-20)),
            ],
            now);

        Assert.Equal("Tropicamide", slice.MedicineName);
        Assert.Equal(now.AddMinutes(-20), slice.StartedAt);
        Assert.Equal(DilationReadiness.NotReady, slice.Status);
    }

    [Fact]
    public void MarkReadyWarning_IsWarnNeverBlock()
    {
        var warnings = new List<ChecklistGateWarningDto>();
        DilationReadiness.AddMarkReadyWarning(warnings, new DilationReadiness.Slice(
            null, null, null, DilationReadiness.NotRecorded, null));
        Assert.Equal("dilation_not_recorded", warnings[0].Code);
        Assert.Equal("warn", warnings[0].Severity);
        Assert.False(warnings[0].CanOverride);

        warnings.Clear();
        var now = DateTime.UtcNow;
        DilationReadiness.AddMarkReadyWarning(warnings, new DilationReadiness.Slice(
            now.AddMinutes(-10), now.AddMinutes(15), 900, DilationReadiness.NotReady, "Tropicamide"));
        Assert.Equal("dilation_not_ready", warnings[0].Code);
        Assert.Equal("warn", warnings[0].Severity);
        Assert.Contains("15:00", warnings[0].Message);

        warnings.Clear();
        DilationReadiness.AddMarkReadyWarning(warnings, new DilationReadiness.Slice(
            now.AddMinutes(-30), now, 0, DilationReadiness.Ready, "Tropicamide"));
        Assert.Empty(warnings);
    }
}
