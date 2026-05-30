using CcmsApi.Models.Dtos;
using CcmsApi.Services;
using CcmsApi.Tests.Fixtures;
using FluentAssertions;
using Microsoft.Extensions.Logging.Abstractions;
using Moq;

namespace CcmsApi.Tests.ServiceTests;

public class ClaimServiceTests : IDisposable
{
    private readonly InMemoryDbFixture _fix = new();
    private readonly ClaimPacketGeneratorService _svc;

    public ClaimServiceTests()
    {
        var workflowMock = new Mock<IWorkflowEngine>();
        workflowMock
            .Setup(w => w.FireAsync(It.IsAny<Guid>(), It.IsAny<string>(),
                                    It.IsAny<Guid>(), It.IsAny<string?>(),
                                    It.IsAny<CancellationToken>()))
            .ReturnsAsync(new TransitionResult(true, "BILL_FINALIZED", "CLAIM_READY", "GENERATE_CLAIM"));

        _svc = new ClaimPacketGeneratorService(
            _fix.Db, workflowMock.Object,
            NullLogger<ClaimPacketGeneratorService>.Instance);
    }

    // ── GenerateClaimAsync ───────────────────────────────────────────────────

    [Fact]
    public async Task GenerateClaimAsync_ReturnsClaimPacketDto()
    {
        var c = _fix.SeedCase(state: "BILL_FINALIZED");
        var req = new GenerateClaimRequest(ClaimedAmount: 50_000m);

        var dto = await _svc.GenerateClaimAsync(c.Id, _fix.ActorId, req);

        dto.Should().NotBeNull();
        dto.Should().BeOfType<ClaimPacketDto>();
        dto.ClaimedAmount.Should().Be(50_000m);
        dto.ClaimNumber.Should().StartWith("CLM-");
        dto.Status.Should().Be("active");
    }

    [Fact]
    public async Task GenerateClaimAsync_UnknownCase_ThrowsKeyNotFoundException()
    {
        var req = new GenerateClaimRequest(10_000m);
        Func<Task> act = () => _svc.GenerateClaimAsync(Guid.NewGuid(), _fix.ActorId, req);
        await act.Should().ThrowAsync<KeyNotFoundException>();
    }

    // ── SubmitClaimAsync ─────────────────────────────────────────────────────

    [Fact]
    public async Task SubmitClaimAsync_ReturnsClaimPacketDtoWithSubmittedAt()
    {
        var c     = _fix.SeedCase(state: "CLAIM_READY");
        var claim = _fix.SeedClaim(c.Id);

        var dto = await _svc.SubmitClaimAsync(claim.Id, _fix.ActorId, tpaClaimNumber: "TPA-CLM-9999");

        dto.SubmittedAt.Should().NotBeNull();
        dto.TpaClaimNumber.Should().Be("TPA-CLM-9999");
        dto.Should().BeOfType<ClaimPacketDto>();
    }

    // ── AcknowledgeClaimAsync ────────────────────────────────────────────────

    [Fact]
    public async Task AcknowledgeClaimAsync_ReturnsClaimPacketDtoWithAcknowledgedAt()
    {
        var c     = _fix.SeedCase(state: "CLAIM_SUBMITTED");
        var claim = _fix.SeedClaim(c.Id);

        var dto = await _svc.AcknowledgeClaimAsync(claim.Id, _fix.ActorId, tpaAckReference: "ACK-001");

        dto.AcknowledgedAt.Should().NotBeNull();
        dto.TpaClaimNumber.Should().Be("ACK-001");
        dto.Should().BeOfType<ClaimPacketDto>();
    }

    // ── GetByCaseIdAsync ─────────────────────────────────────────────────────

    [Fact]
    public async Task GetByCaseIdAsync_ReturnsClaimPacketDtos()
    {
        var c = _fix.SeedCase();
        _fix.SeedClaim(c.Id, 50_000m);
        _fix.SeedClaim(c.Id, 25_000m);

        var dtos = await _svc.GetByCaseIdAsync(c.Id);

        dtos.Should().HaveCount(2);
        dtos.Should().AllSatisfy(d => d.Should().BeOfType<ClaimPacketDto>());
    }

    // ── GetQueueAsync ────────────────────────────────────────────────────────

    [Fact]
    public async Task GetQueueAsync_ReturnsListOfClaimQueueItems()
    {
        var c = _fix.SeedCase();
        _fix.SeedClaim(c.Id);

        var queue = await _svc.GetQueueAsync();

        queue.Should().NotBeNull();
    }

    public void Dispose() => _fix.Dispose();
}
