using CcmsApi.Data;
using CcmsApi.Models.Domain;
using CcmsApi.Services;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging.Abstractions;
using Xunit;

namespace CcmsApi.Tests;

public class LinkJourneyIdTests
{
    private static CcmsDbContext CreateDb()
    {
        var opts = new DbContextOptionsBuilder<CcmsDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString("N"))
            .Options;
        return new CcmsDbContext(opts);
    }

    [Fact]
    public async Task LinksJourneyId_WhenMissing_OnSessionMatch()
    {
        await using var db = CreateDb();
        var sessionId = Guid.NewGuid();
        var journeyId = Guid.NewGuid();
        var caseId = Guid.NewGuid();
        db.CoverageCases.Add(new CcmsCoverageCase
        {
            Id = caseId,
            TenantId = Guid.NewGuid(),
            CaseNumber = "CC-TEST-1",
            SessionId = sessionId,
            PatientId = Guid.NewGuid(),
            CurrentState = "APPROVED",
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow,
            Status = "active",
        });
        await db.SaveChangesAsync();

        var svc = new CoverageCaseService(
            db,
            workflow: null!,
            fyService: null!,
            authClient: null!,
            NullLogger<CoverageCaseService>.Instance);

        // LinkJourneyIdAsync only needs GetByJourney/Session + Save — workflow unused.
        // CoverageCaseService ctor requires workflow — use a stub if needed.
        // Actually Fire isn't called by LinkJourneyIdAsync. But Create may need deps.
        // Constructor always assigns — null! is fine for this method.

        var linked = await svc.LinkJourneyIdAsync(journeyId, sessionId, Guid.NewGuid());
        Assert.NotNull(linked);
        Assert.Equal(journeyId, linked!.JourneyId);
    }

    [Fact]
    public async Task DoesNotOverwrite_DifferentJourneyId()
    {
        await using var db = CreateDb();
        var existing = Guid.NewGuid();
        var sessionId = Guid.NewGuid();
        db.CoverageCases.Add(new CcmsCoverageCase
        {
            Id = Guid.NewGuid(),
            TenantId = Guid.NewGuid(),
            CaseNumber = "CC-TEST-2",
            SessionId = sessionId,
            JourneyId = existing,
            PatientId = Guid.NewGuid(),
            CurrentState = "APPROVED",
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow,
            Status = "active",
        });
        await db.SaveChangesAsync();

        var svc = new CoverageCaseService(db, null!, null!, null!, NullLogger<CoverageCaseService>.Instance);
        var linked = await svc.LinkJourneyIdAsync(Guid.NewGuid(), sessionId, Guid.NewGuid());
        Assert.Equal(existing, linked!.JourneyId);
    }
}
