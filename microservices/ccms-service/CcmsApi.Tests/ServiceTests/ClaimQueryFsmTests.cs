using CcmsApi.Models.Dtos;
using CcmsApi.Services;
using CcmsApi.Tests.Fixtures;
using FluentAssertions;
using Microsoft.Extensions.Logging.Abstractions;
using Moq;

namespace CcmsApi.Tests.ServiceTests;

public class ClaimQueryFsmTests : IDisposable
{
    private readonly InMemoryDbFixture _fix = new();

    [Fact]
    public async Task RaiseClaimQuery_WithoutWorkflowInstance_SetsQueryRaised()
    {
        var workflow = new Mock<IWorkflowEngine>(MockBehavior.Strict);
        var svc = new ClaimPacketGeneratorService(
            _fix.Db, workflow.Object, NullLogger<ClaimPacketGeneratorService>.Instance);
        var c = _fix.SeedCase(state: "CLAIM_SUBMITTED");
        var claim = _fix.SeedClaim(c.Id);

        var dto = await svc.RaiseClaimQueryAsync(claim.Id, _fix.ActorId, "Need OT notes", false);

        dto.QueryStatus.Should().Be("query_raised");
        (await _fix.Db.CoverageCases.FindAsync(c.Id))!.CurrentState.Should().Be("CLAIM_QUERY_RAISED");
        workflow.Verify(
            w => w.FireAsync(It.IsAny<Guid>(), It.IsAny<string>(), It.IsAny<Guid>(), It.IsAny<string?>(), It.IsAny<CancellationToken>()),
            Times.Never);
    }

    [Fact]
    public async Task RaiseClaimQuery_WithWorkflowInstance_FiresRaiseClaimQuery()
    {
        var instanceId = Guid.NewGuid();
        var workflow = new Mock<IWorkflowEngine>();
        workflow
            .Setup(w => w.FireAsync(instanceId, "RAISE_CLAIM_QUERY",
                It.IsAny<Guid>(), It.IsAny<string?>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(new TransitionResult(true, "CLAIM_SUBMITTED", "CLAIM_QUERY_RAISED", "RAISE_CLAIM_QUERY"));
        var svc = new ClaimPacketGeneratorService(
            _fix.Db, workflow.Object, NullLogger<ClaimPacketGeneratorService>.Instance);
        var c = _fix.SeedCase(state: "CLAIM_SUBMITTED");
        c.WorkflowInstanceId = instanceId;
        await _fix.Db.SaveChangesAsync();
        var claim = _fix.SeedClaim(c.Id);

        var dto = await svc.RaiseClaimQueryAsync(claim.Id, _fix.ActorId, "Need OT notes", false);

        dto.QueryStatus.Should().Be("query_raised");
        (await _fix.Db.CoverageCases.FindAsync(c.Id))!.CurrentState.Should().Be("CLAIM_QUERY_RAISED");
        workflow.Verify(w => w.FireAsync(instanceId, "RAISE_CLAIM_QUERY",
            _fix.ActorId, null, It.IsAny<CancellationToken>()), Times.Once);
    }

    [Fact]
    public async Task RaiseClaimQuery_FailedTransition_DoesNotWriteState()
    {
        var instanceId = Guid.NewGuid();
        var workflow = new Mock<IWorkflowEngine>();
        workflow
            .Setup(w => w.FireAsync(instanceId, "RAISE_CLAIM_QUERY",
                It.IsAny<Guid>(), It.IsAny<string?>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(new TransitionResult(false, "CLAIM_SUBMITTED", "CLAIM_SUBMITTED", "RAISE_CLAIM_QUERY",
                "Event 'RAISE_CLAIM_QUERY' is not valid from state 'CLAIM_SUBMITTED'."));
        var svc = new ClaimPacketGeneratorService(
            _fix.Db, workflow.Object, NullLogger<ClaimPacketGeneratorService>.Instance);
        var c = _fix.SeedCase(state: "CLAIM_SUBMITTED");
        c.WorkflowInstanceId = instanceId;
        await _fix.Db.SaveChangesAsync();
        var claim = _fix.SeedClaim(c.Id);

        var act = () => svc.RaiseClaimQueryAsync(claim.Id, _fix.ActorId, "Need OT notes", false);
        await act.Should().ThrowAsync<InvalidOperationException>();
        (await _fix.Db.CoverageCases.FindAsync(c.Id))!.CurrentState.Should().Be("CLAIM_SUBMITTED");
    }

    [Fact]
    public async Task RespondClaimQuery_FiresRespondThenContinueWhenAcknowledged()
    {
        var instanceId = Guid.NewGuid();
        var workflow = new Mock<IWorkflowEngine>();
        workflow
            .Setup(w => w.FireAsync(instanceId, "RESPOND_CLAIM_QUERY",
                It.IsAny<Guid>(), It.IsAny<string?>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(new TransitionResult(true, "CLAIM_QUERY_RAISED", "CLAIM_QUERY_RESPONDED", "RESPOND_CLAIM_QUERY"));
        workflow
            .Setup(w => w.FireAsync(instanceId, "CONTINUE_CLAIM",
                It.IsAny<Guid>(), It.IsAny<string?>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(new TransitionResult(true, "CLAIM_QUERY_RESPONDED", "CLAIM_IN_PROCESS", "CONTINUE_CLAIM"));
        var svc = new ClaimPacketGeneratorService(
            _fix.Db, workflow.Object, NullLogger<ClaimPacketGeneratorService>.Instance);
        var c = _fix.SeedCase(state: "CLAIM_QUERY_RAISED");
        c.WorkflowInstanceId = instanceId;
        await _fix.Db.SaveChangesAsync();
        var claim = _fix.SeedClaim(c.Id);
        claim.QueryStatus = "query_raised";
        claim.AcknowledgedAt = DateTime.UtcNow;
        await _fix.Db.SaveChangesAsync();

        var dto = await svc.RespondClaimQueryAsync(claim.Id, _fix.ActorId, "OT notes attached");

        dto.QueryStatus.Should().Be("response_submitted");
        (await _fix.Db.CoverageCases.FindAsync(c.Id))!.CurrentState.Should().Be("CLAIM_IN_PROCESS");
        workflow.Verify(w => w.FireAsync(instanceId, "RESPOND_CLAIM_QUERY",
            _fix.ActorId, null, It.IsAny<CancellationToken>()), Times.Once);
        workflow.Verify(w => w.FireAsync(instanceId, "CONTINUE_CLAIM",
            _fix.ActorId, null, It.IsAny<CancellationToken>()), Times.Once);
    }

    public void Dispose() => _fix.Dispose();
}
