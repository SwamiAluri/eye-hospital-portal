using CcmsApi.Models.Dtos;
using CcmsApi.Services;
using CcmsApi.Tests.Fixtures;
using FluentAssertions;
using Microsoft.Extensions.Logging.Abstractions;
using Moq;

namespace CcmsApi.Tests.ServiceTests;

public class EnhancementServiceTests : IDisposable
{
    private readonly InMemoryDbFixture _fix = new();
    private readonly EnhancementService _svc;

    public EnhancementServiceTests()
    {
        var workflowMock = new Mock<IWorkflowEngine>();
        workflowMock
            .Setup(w => w.FireAsync(It.IsAny<Guid>(), It.IsAny<string>(),
                                    It.IsAny<Guid>(), It.IsAny<string?>(),
                                    It.IsAny<CancellationToken>()))
            .ReturnsAsync(new TransitionResult(true, "CASE_OPEN", "ENHANCEMENT_REQUESTED", "REQUEST_ENHANCEMENT"));

        _svc = new EnhancementService(
            _fix.Db, workflowMock.Object,
            NullLogger<EnhancementService>.Instance);
    }

    // ── CreateAsync ──────────────────────────────────────────────────────────

    [Fact]
    public async Task CreateAsync_ReturnsEnhancementRequestDto()
    {
        var c = _fix.SeedCase();
        var req = new CreateEnhancementRequest(
            EnhancementType: "amount",
            RequestedAmount: 15_000m,
            Reason: "Patient room upgrade");

        var dto = await _svc.CreateAsync(c.Id, _fix.ActorId, req);

        dto.Should().NotBeNull();
        dto.Should().BeOfType<EnhancementRequestDto>();
        dto.RequestedAmount.Should().Be(15_000m);
        dto.EnhancementType.Should().Be("amount");
        dto.Status.Should().Be("active");
        dto.CoverageCase_Id.Should().Be(c.Id);
    }

    [Fact]
    public async Task CreateAsync_UnknownCase_ThrowsKeyNotFoundException()
    {
        var req = new CreateEnhancementRequest("amount", 10_000m, null);
        Func<Task> act = () => _svc.CreateAsync(Guid.NewGuid(), _fix.ActorId, req);
        await act.Should().ThrowAsync<KeyNotFoundException>();
    }

    // ── GetByCaseIdAsync ─────────────────────────────────────────────────────

    [Fact]
    public async Task GetByCaseIdAsync_ReturnsDtos_OrderedDescending()
    {
        var c = _fix.SeedCase();
        _fix.SeedEnhancement(c.Id, 5_000m);
        _fix.SeedEnhancement(c.Id, 10_000m);

        var dtos = await _svc.GetByCaseIdAsync(c.Id);

        dtos.Should().HaveCount(2);
        dtos.Should().AllSatisfy(dto => dto.Should().BeOfType<EnhancementRequestDto>());
        // Descending order — most recent first
        dtos[0].RequestedAmount.Should().BeGreaterThanOrEqualTo(dtos[1].RequestedAmount);
    }

    [Fact]
    public async Task GetByCaseIdAsync_EmptyCase_ReturnsEmptyList()
    {
        var c = _fix.SeedCase();
        var dtos = await _svc.GetByCaseIdAsync(c.Id);
        dtos.Should().BeEmpty();
    }

    // ── DecideAsync ──────────────────────────────────────────────────────────

    [Fact]
    public async Task DecideAsync_Approved_SetsStatusAndAmount()
    {
        var c = _fix.SeedCase();
        var e = _fix.SeedEnhancement(c.Id, 10_000m);

        var decision = new DecideEnhancementRequest(Approved: true, ApprovedAmount: 9_000m);
        var dto = await _svc.DecideAsync(e.Id, _fix.ActorId, decision);

        dto.Status.Should().Be("approved");
        dto.ApprovedAmount.Should().Be(9_000m);
        dto.DecisionBy.Should().Be(_fix.ActorId);
        dto.DecidedAt.Should().NotBeNull();
    }

    [Fact]
    public async Task DecideAsync_Rejected_SetsStatusRejected()
    {
        var c = _fix.SeedCase();
        var e = _fix.SeedEnhancement(c.Id, 10_000m);

        var decision = new DecideEnhancementRequest(Approved: false, ApprovedAmount: 0m);
        var dto = await _svc.DecideAsync(e.Id, _fix.ActorId, decision);

        dto.Status.Should().Be("rejected");
    }

    [Fact]
    public async Task DecideAsync_UnknownEnhancement_ThrowsKeyNotFoundException()
    {
        var decision = new DecideEnhancementRequest(true, 5_000m);
        Func<Task> act = () => _svc.DecideAsync(Guid.NewGuid(), _fix.ActorId, decision);
        await act.Should().ThrowAsync<KeyNotFoundException>();
    }

    public void Dispose() => _fix.Dispose();
}
