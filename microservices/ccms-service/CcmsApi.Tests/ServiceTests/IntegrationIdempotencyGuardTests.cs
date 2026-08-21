using CcmsApi.Services;
using FluentAssertions;
using Microsoft.Extensions.Logging.Abstractions;

namespace CcmsApi.Tests.ServiceTests;

/// <summary>Phase 5 / P0 — consumer-side idempotency for integration events.</summary>
public class IntegrationIdempotencyGuardTests
{
    private static MemoryIntegrationIdempotencyGuard CreateMemoryGuard() =>
        new(NullLogger<MemoryIntegrationIdempotencyGuard>.Instance, TimeSpan.FromMinutes(5));

    [Theory]
    [InlineData("JourneyAdmitted:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa")]
    [InlineData("SurgeryCompleted:bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb")]
    [InlineData("PatientClinicallyDischarged:cccccccccccccccccccccccccccccccc")]
    [InlineData("BillFinalized:dddddddddddddddddddddddddddddddd")]
    public async Task FirstSight_IsNotDuplicate_SecondSight_IsDuplicate(string key)
    {
        var guard = CreateMemoryGuard();
        (await guard.IsDuplicateAsync(key)).Should().BeFalse();
        (await guard.IsDuplicateAsync(key)).Should().BeTrue();
        (await guard.IsDuplicateAsync(key)).Should().BeTrue();
    }

    [Fact]
    public async Task EmptyOrMissingKey_NeverDuplicate()
    {
        var guard = CreateMemoryGuard();
        (await guard.IsDuplicateAsync(null)).Should().BeFalse();
        (await guard.IsDuplicateAsync("")).Should().BeFalse();
        (await guard.IsDuplicateAsync("   ")).Should().BeFalse();
        (await guard.IsDuplicateAsync(null)).Should().BeFalse();
    }

    [Fact]
    public async Task DistinctKeys_AreIndependent()
    {
        var guard = CreateMemoryGuard();
        (await guard.IsDuplicateAsync("JourneyAdmitted:1")).Should().BeFalse();
        (await guard.IsDuplicateAsync("BillFinalized:1")).Should().BeFalse();
        (await guard.IsDuplicateAsync("JourneyAdmitted:1")).Should().BeTrue();
        (await guard.IsDuplicateAsync("BillFinalized:1")).Should().BeTrue();
    }

    [Fact]
    public async Task TwoMemoryGuards_DoNotShareState_UnlikeDbGuard()
    {
        // Documents why DB-backed guard is required for multi-instance deployments.
        var a = CreateMemoryGuard();
        var b = CreateMemoryGuard();
        (await a.IsDuplicateAsync("shared-key")).Should().BeFalse();
        (await b.IsDuplicateAsync("shared-key")).Should().BeFalse(); // second instance would wrongly accept
    }
}
