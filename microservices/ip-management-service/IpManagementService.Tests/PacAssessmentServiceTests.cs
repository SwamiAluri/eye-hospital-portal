using Microsoft.EntityFrameworkCore;
using IpManagementService.Models.Domain;
using IpManagementService.Models.Dtos;
using IpManagementService.Services;
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

    [Fact]
    public async Task SaveAssessmentAsync_revives_soft_deleted_row()
    {
        var now = DateTime.UtcNow;
        _ctx.Db.PacAssessments.Add(new PacAssessment
        {
            Id               = Guid.NewGuid(),
            TenantId         = _seed.TenantId,
            PatientJourneyId = _seed.JourneyId,
            DeletedAt        = now.AddDays(-1),
            CreatedAt        = now,
            UpdatedAt        = now,
        });
        await _ctx.Db.SaveChangesAsync();

        var result = await _ctx.Pac.SaveAssessmentAsync(
            _seed.JourneyId,
            _seed.TenantId,
            _seed.UserId,
            new SavePacAssessmentRequest(
                null, null, null, null, null, null, null, null, null, null,
                "General", null, null, null, null, null, null, null));

        Assert.Equal("General", result.AnaesthesiaPlan);

        var row = await _ctx.Db.PacAssessments
            .FirstAsync(p => p.PatientJourneyId == _seed.JourneyId);
        Assert.Null(row.DeletedAt);
    }

    [Fact]
    public async Task SaveAssessmentAsync_persists_scalar_and_json_fields()
    {
        var airway = new PacAirwayExamDto(2, "Normal", null, null, null, null, null, null);
        var systemic = new PacSystemicReviewDto("NAD", "NAD", "NAD", "NAD", "NAD", "NAD", "NAD");

        var result = await _ctx.Pac.SaveAssessmentAsync(
            _seed.JourneyId,
            _seed.TenantId,
            _seed.UserId,
            new SavePacAssessmentRequest(
                null, null, "120/80", 72, 2, null, null, systemic, null, airway,
                "Local", null, "Written", null, null, null, null, null));

        Assert.Equal("120/80", result.Bp);
        Assert.Equal(72, result.Hr);
        Assert.Equal(2, result.PhysicalStatusAsa);
        Assert.Equal("Local", result.AnaesthesiaPlan);
        Assert.Equal("Written", result.ConsentType);
        Assert.Equal(2, result.AirwayExam?.Mallampati);

        var row = await _ctx.Db.PacAssessments
            .FirstAsync(p => p.PatientJourneyId == _seed.JourneyId && p.TenantId == _seed.TenantId);
        Assert.Equal("120/80", row.Bp);
        Assert.Contains("mallampati", row.AirwayExam, StringComparison.OrdinalIgnoreCase);
        Assert.Contains("cvs", row.SystemicReview, StringComparison.OrdinalIgnoreCase);
    }
}
