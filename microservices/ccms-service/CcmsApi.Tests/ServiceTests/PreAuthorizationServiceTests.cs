using CcmsApi.Models.Domain;
using CcmsApi.Models.Dtos;
using CcmsApi.Services;
using CcmsApi.Tests.Fixtures;
using FluentAssertions;
using Microsoft.Extensions.Logging.Abstractions;
using Moq;

namespace CcmsApi.Tests.ServiceTests;

public class PreAuthorizationServiceTests : IDisposable
{
    private readonly InMemoryDbFixture _fix = new();
    private readonly PreAuthorizationService _svc;
    private readonly Mock<IWorkflowEngine> _workflowMock = new();

    public PreAuthorizationServiceTests()
    {
        _workflowMock
            .Setup(w => w.FireAsync(It.IsAny<Guid>(), It.IsAny<string>(),
                                    It.IsAny<Guid>(), It.IsAny<string?>(),
                                    It.IsAny<CancellationToken>()))
            .ReturnsAsync(new TransitionResult(true, "CASE_OPEN", "PREAUTH_SENT", "SEND_PREAUTH"));

        _svc = new PreAuthorizationService(
            _fix.Db,
            _workflowMock.Object,
            new ClarificationService(_fix.Db, _workflowMock.Object, NullLogger<ClarificationService>.Instance),
            NullLogger<PreAuthorizationService>.Instance);
    }

    // ── GeneratePreAuthAsync ─────────────────────────────────────────────────

    [Fact]
    public async Task GeneratePreAuthAsync_ReturnsAuthorizationSummaryDto()
    {
        var c = _fix.SeedCase(state: "CASE_OPEN");
        var req = new GeneratePreAuthRequest(RequestedAmount: 50_000m);

        var dto = await _svc.GeneratePreAuthAsync(c.Id, _fix.ActorId, req);

        dto.Should().NotBeNull();
        dto.Should().BeOfType<AuthorizationSummaryDto>();
        dto.RequestedAmount.Should().Be(50_000m);
        dto.CoverageCase_Id.Should().Be(c.Id);
        dto.AuthorizationType.Should().Be("preauth");
    }

    [Fact]
    public async Task GeneratePreAuthAsync_UnknownCase_ThrowsKeyNotFoundException()
    {
        var req = new GeneratePreAuthRequest(10_000m);
        Func<Task> act = () => _svc.GeneratePreAuthAsync(Guid.NewGuid(), _fix.ActorId, req);
        await act.Should().ThrowAsync<KeyNotFoundException>();
    }

    // ── MarkSentAsync ─────────────────────────────────────────────────────────

    [Fact]
    public async Task MarkSentAsync_SetsSubmittedAtAndReturnsDto()
    {
        var c   = _fix.SeedCase();
        var auth = _fix.SeedAuthorization(c.Id, status: "PREAUTH_GENERATED");

        var dto = await _svc.MarkSentAsync(auth.Id, _fix.ActorId, tpaReferenceNumber: "TPA-REF-999");

        dto.Should().BeOfType<AuthorizationSummaryDto>();
        dto.SubmittedAt.Should().NotBeNull();
        dto.TpaReferenceNumber.Should().Be("TPA-REF-999");
    }

    [Fact]
    public async Task MarkSentAsync_SecondCall_IsIdempotent_PreservesSubmittedAt()
    {
        var c    = _fix.SeedCase();
        var auth = _fix.SeedAuthorization(c.Id, status: "PREAUTH_GENERATED");

        var first  = await _svc.MarkSentAsync(auth.Id, _fix.ActorId, tpaReferenceNumber: "TPA-REF-999");
        var second = await _svc.MarkSentAsync(auth.Id, _fix.ActorId, tpaReferenceNumber: "TPA-REF-UPDATED");

        second.SubmittedAt.Should().Be(first.SubmittedAt);
        second.TpaReferenceNumber.Should().Be("TPA-REF-UPDATED");
    }

    // ── RecordTpaResponseAsync ───────────────────────────────────────────────

    [Fact]
    public async Task RecordTpaResponseAsync_Approved_SetsApprovedAmountAndReturnsDto()
    {
        var c   = _fix.SeedCase();
        var auth = _fix.SeedAuthorization(c.Id, requestedAmount: 50_000m);

        var req = new RecordTpaResponseRequest(
            Decision:           "APPROVED",
            ApprovedAmount:     45_000m,
            RoomClassApproved:  "semi-private",
            ValidFrom:          DateTime.UtcNow,
            ValidTo:            DateTime.UtcNow.AddDays(30),
            PreAuthNumber:      "PA-2024-001",
            TpaReferenceNumber: "TPA-REF",
            RejectionReason:    null,
            EventSource:        "manual");

        var dto = await _svc.RecordTpaResponseAsync(auth.Id, _fix.ActorId, req);

        dto.Should().BeOfType<AuthorizationSummaryDto>();
        dto.ApprovedAmount.Should().Be(45_000m);
        dto.PreAuthNumber.Should().Be("PA-2024-001");
        dto.RoomClassApproved.Should().Be("semi-private");
        dto.ReceivedAt.Should().NotBeNull();
    }

    [Fact]
    public async Task RecordTpaResponseAsync_Rejected_SetsRejectionReason()
    {
        var c    = _fix.SeedCase();
        var auth = _fix.SeedAuthorization(c.Id);

        var req = new RecordTpaResponseRequest(
            Decision:           "REJECTED",
            ApprovedAmount:     0m,
            RoomClassApproved:  null,
            ValidFrom:          null,
            ValidTo:            null,
            PreAuthNumber:      null,
            TpaReferenceNumber: "TPA-REF",
            RejectionReason:    "Not covered under policy",
            EventSource:        "portal");

        var dto = await _svc.RecordTpaResponseAsync(auth.Id, _fix.ActorId, req);

        dto.RejectionReason.Should().Be("Not covered under policy");
    }

    [Fact]
    public async Task RecordTpaResponseAsync_InvalidDecision_ThrowsArgumentException()
    {
        var c    = _fix.SeedCase();
        var auth = _fix.SeedAuthorization(c.Id);

        var req = new RecordTpaResponseRequest("UNKNOWN_DECISION", 0m, null, null, null, null, null, null, null);
        Func<Task> act = () => _svc.RecordTpaResponseAsync(auth.Id, _fix.ActorId, req);
        await act.Should().ThrowAsync<ArgumentException>();
    }

    // ── GetByCaseIdAsync ─────────────────────────────────────────────────────

    [Fact]
    public async Task GetByCaseIdAsync_ReturnsAuthorizationSummaryDtos()
    {
        var c = _fix.SeedCase();
        _fix.SeedAuthorization(c.Id, 30_000m);
        _fix.SeedAuthorization(c.Id, 20_000m);

        var dtos = await _svc.GetByCaseIdAsync(c.Id);

        dtos.Should().HaveCount(2);
        dtos.Should().AllSatisfy(d => d.Should().BeOfType<AuthorizationSummaryDto>());
    }

    public void Dispose() => _fix.Dispose();
}
