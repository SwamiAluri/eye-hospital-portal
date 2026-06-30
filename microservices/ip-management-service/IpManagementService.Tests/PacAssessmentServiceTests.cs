using Microsoft.EntityFrameworkCore;
using Xunit;

namespace IpManagementService.Tests;

public class PacAssessmentServiceTests : IDisposable
{
    private readonly WardPreOpTestContext _ctx = WardPreOpTestContext.Create();
    private WardPreOpSeed _seed = null!;

    public PacAssessmentServiceTests()
    {
        _seed = WardPreOpSeedData.SeedInvestigationJourneyAsync(_ctx.Db).GetAwaiter().GetResult();
    }

    public void Dispose() => _ctx.Dispose();

    [Fact]
    public async Task CompleteAssessmentAsync_returns_unverified_critical_warnings_and_completes()
    {
        await WardPreOpSeedData.SeedCompletePacAssessmentAsync(_ctx.Db, _seed);

        var result = await _ctx.Pac.CompleteAssessmentAsync(
            _seed.JourneyId,
            _seed.TenantId,
            _seed.UserId);

        Assert.Equal("Completed", result.Assessment.AssessmentStatus);
        Assert.NotNull(result.Assessment.CompletedAt);
        Assert.NotEmpty(result.UnverifiedCriticalWarnings);
        Assert.Contains(result.UnverifiedCriticalWarnings, w =>
            w.Contains("serum_creatinine", StringComparison.OrdinalIgnoreCase));

        // Completing PAC must not throw even when critical labs are unverified (warn-only).
        var pacRow = await _ctx.Db.PacAssessments
            .FirstAsync(p => p.PatientJourneyId == _seed.JourneyId && p.TenantId == _seed.TenantId);
        Assert.Equal("Completed", pacRow.AssessmentStatus);
    }

    [Fact]
    public async Task CompleteAssessmentAsync_when_incomplete_throws()
    {
        await Assert.ThrowsAsync<InvalidOperationException>(() =>
            _ctx.Pac.CompleteAssessmentAsync(_seed.JourneyId, _seed.TenantId, _seed.UserId));
    }
}
