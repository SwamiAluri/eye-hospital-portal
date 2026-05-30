using CcmsApi.Models.Dtos;
using CcmsApi.Services;
using CcmsApi.Tests.Fixtures;
using FluentAssertions;
using Microsoft.Extensions.Logging.Abstractions;
using Moq;

namespace CcmsApi.Tests.ServiceTests;

public class SettlementServiceTests : IDisposable
{
    private readonly InMemoryDbFixture _fix = new();
    private readonly SettlementReconciliationService _svc;

    public SettlementServiceTests()
    {
        var workflowMock = new Mock<IWorkflowEngine>();
        workflowMock
            .Setup(w => w.FireAsync(It.IsAny<Guid>(), It.IsAny<string>(),
                                    It.IsAny<Guid>(), It.IsAny<string?>(),
                                    It.IsAny<CancellationToken>()))
            .ReturnsAsync(new TransitionResult(true, "CLAIM_IN_PROCESS", "SETTLEMENT_DONE", "RECORD_SETTLEMENT"));

        _svc = new SettlementReconciliationService(
            _fix.Db, workflowMock.Object,
            NullLogger<SettlementReconciliationService>.Instance);
    }

    // ── GetByCaseIdAsync ─────────────────────────────────────────────────────

    [Fact]
    public async Task GetByCaseIdAsync_ReturnsSettlementDtos()
    {
        var c = _fix.SeedCase();
        _fix.SeedSettlement(c.Id, settledAmount: 30_000m, claimAmount: 50_000m);
        _fix.SeedSettlement(c.Id, settledAmount: 15_000m, claimAmount: 50_000m);

        var dtos = await _svc.GetByCaseIdAsync(c.Id);

        dtos.Should().HaveCount(2);
        dtos.Should().AllSatisfy(d => d.Should().BeOfType<SettlementDto>());
        dtos.Should().OnlyContain(d => d.CoverageCase_Id == c.Id);
    }

    [Fact]
    public async Task GetByCaseIdAsync_ExcludesSoftDeletedSettlements()
    {
        var c = _fix.SeedCase();
        var s = _fix.SeedSettlement(c.Id);
        s.DeletedAt = DateTime.UtcNow;
        await _fix.Db.SaveChangesAsync();

        var dtos = await _svc.GetByCaseIdAsync(c.Id);
        dtos.Should().BeEmpty();
    }

    // ── RecordSettlementAsync ────────────────────────────────────────────────

    [Fact]
    public async Task RecordSettlementAsync_FullPayment_ReturnsFullSettlementDto()
    {
        var c = _fix.SeedCase(state: "CLAIM_IN_PROCESS");

        var req = new RecordSettlementRequest(
            ClaimPacketId:    null,
            SettledAmount:    50_000m,
            ClaimAmount:      50_000m,
            PaymentReference: "UTR-123456",
            PaymentMode:      "NEFT",
            PaymentDate:      DateOnly.FromDateTime(DateTime.Today),
            BankReference:    "BNK-REF",
            Remarks:          "Full payment received",
            LineItems:        null);

        var dto = await _svc.RecordSettlementAsync(c.Id, _fix.ActorId, req);

        dto.Should().NotBeNull();
        dto.Should().BeOfType<SettlementDto>();
        dto.SettlementType.Should().Be("full");
        dto.SettledAmount.Should().Be(50_000m);
        dto.OutstandingAmount.Should().Be(0m);
        dto.PaymentMode.Should().Be("NEFT");
        dto.SettlementNumber.Should().StartWith("STL-");
    }

    [Fact]
    public async Task RecordSettlementAsync_PartialPayment_ReturnsPartialSettlementDto()
    {
        var c = _fix.SeedCase(state: "CLAIM_IN_PROCESS");

        var req = new RecordSettlementRequest(
            ClaimPacketId:    null,
            SettledAmount:    30_000m,
            ClaimAmount:      50_000m,
            PaymentReference: "UTR-PARTIAL",
            PaymentMode:      "RTGS",
            PaymentDate:      DateOnly.FromDateTime(DateTime.Today),
            BankReference:    null,
            Remarks:          null,
            LineItems:        null);

        var dto = await _svc.RecordSettlementAsync(c.Id, _fix.ActorId, req);

        dto.SettlementType.Should().Be("partial");
        dto.OutstandingAmount.Should().Be(20_000m);
    }

    [Fact]
    public async Task RecordSettlementAsync_UnknownCase_ThrowsKeyNotFoundException()
    {
        var req = new RecordSettlementRequest(null, 10_000m, 10_000m, null, null, null, null, null, null);
        Func<Task> act = () => _svc.RecordSettlementAsync(Guid.NewGuid(), _fix.ActorId, req);
        await act.Should().ThrowAsync<KeyNotFoundException>();
    }

    // ── GetAgingReportAsync ──────────────────────────────────────────────────

    [Fact]
    public async Task GetAgingReportAsync_ReturnsAllFourBuckets()
    {
        var buckets = await _svc.GetAgingReportAsync();

        buckets.Should().HaveCount(4);
        buckets.Select(b => b.Bucket).Should().Contain(new[] { "0-30 days", "31-60 days", "61-90 days", "90+ days" });
    }

    public void Dispose() => _fix.Dispose();
}
