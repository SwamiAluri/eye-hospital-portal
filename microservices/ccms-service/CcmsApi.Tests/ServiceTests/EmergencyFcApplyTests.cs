using CcmsApi.Tests.Fixtures;
using FluentAssertions;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging.Abstractions;

namespace CcmsApi.Tests.ServiceTests;

public class EmergencyFcApplyTests : IDisposable
{
    private readonly InMemoryDbFixture _fix = new();
    private readonly CcmsApi.Services.CoverageCaseService _svc;

    public EmergencyFcApplyTests()
    {
        _svc = new CcmsApi.Services.CoverageCaseService(
            _fix.Db,
            null!,
            null!,
            null!,
            NullLogger<CcmsApi.Services.CoverageCaseService>.Instance);
    }

    [Fact]
    public async Task ApplyEmergencyFc_SetsFlag_PersistsReasonAndActor()
    {
        var journeyId = Guid.NewGuid();
        var sessionId = Guid.NewGuid();
        var seeded = _fix.SeedCase(state: "WAITING_APPROVAL");
        seeded.JourneyId = journeyId;
        seeded.SessionId = sessionId;
        await _fix.Db.SaveChangesAsync();

        var actor = Guid.NewGuid();
        var result = await _svc.ApplyEmergencyFcAsync(
            _fix.TenantId, journeyId, sessionId, "Trauma overnight — cannot wait", actor);

        result.Should().NotBeNull();
        result!.EmergencyFcApplied.Should().BeTrue();
        result.UpdatedByUserId.Should().Be(actor);
        result.CounsellorDraftJson.Should().Contain("Trauma overnight");
        result.CounsellorDraftJson.Should().Contain(actor.ToString());

        var reloaded = await _fix.Db.CoverageCases.AsNoTracking().SingleAsync(c => c.Id == seeded.Id);
        reloaded.EmergencyFcApplied.Should().BeTrue();
    }

    [Fact]
    public async Task ApplyEmergencyFc_UnknownJourney_ReturnsNull()
    {
        var result = await _svc.ApplyEmergencyFcAsync(
            _fix.TenantId, Guid.NewGuid(), Guid.NewGuid(), "reason", _fix.ActorId);
        result.Should().BeNull();
    }

    public void Dispose() => _fix.Dispose();
}
