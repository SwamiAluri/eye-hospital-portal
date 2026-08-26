using CcmsApi.Services;
using CcmsApi.Tests.Fixtures;
using FluentAssertions;
using Microsoft.Extensions.Logging.Abstractions;
using Moq;
using Xunit;

namespace CcmsApi.Tests.ServiceTests;

public class CollectionSettlementServiceTests : IDisposable
{
    private readonly InMemoryDbFixture _fix = new();
    private readonly Mock<IWorkflowEngine> _workflow = new();
    private readonly CollectionSettlementService _svc;
    private readonly Guid _journeyId = Guid.NewGuid();
    private readonly Guid _instanceId = Guid.NewGuid();

    public CollectionSettlementServiceTests()
    {
        _workflow
            .Setup(w => w.FireAsync(
                It.IsAny<Guid>(), It.IsAny<string>(), It.IsAny<Guid>(),
                It.IsAny<string?>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync((Guid _, string trigger, Guid _, string? __, CancellationToken ___) =>
                new TransitionResult(true, "SETTLEMENT_PENDING",
                    trigger == "FULL_PAYMENT" ? "FULL_SETTLEMENT"
                    : trigger == "RECEIVE_SETTLEMENT" ? "SETTLEMENT_PENDING"
                    : "PARTIAL_SETTLEMENT",
                    trigger));

        _svc = new CollectionSettlementService(
            _fix.Db, _workflow.Object, NullLogger<CollectionSettlementService>.Instance);
    }

    [Fact]
    public async Task PaymentReceived_MovesSettlementPendingToPartial()
    {
        SeedSettlementCase("SETTLEMENT_PENDING");

        var first = await _svc.ApplyAsync(Obligation(40_000m));
        first.Applied.Should().BeTrue();
        first.NewState.Should().Be("SETTLEMENT_PENDING");

        var pay = await _svc.ApplyAsync(Payment(20_000m, Guid.NewGuid()));

        pay.Applied.Should().BeTrue();
        pay.Duplicate.Should().BeFalse();
        pay.NetCollected.Should().Be(20_000m);
        pay.PatientObligation.Should().Be(40_000m);
        pay.NewState.Should().Be("PARTIAL_SETTLEMENT");
        _workflow.Verify(w => w.FireAsync(
            _instanceId, "PARTIAL_PAYMENT", It.IsAny<Guid>(), It.IsAny<string?>(), It.IsAny<CancellationToken>()),
            Times.Once);
    }

    [Fact]
    public async Task PaymentReceived_FullObligation_MovesToFullSettlement()
    {
        SeedSettlementCase("SETTLEMENT_PENDING");
        await _svc.ApplyAsync(Obligation(40_000m));

        var pay = await _svc.ApplyAsync(Payment(40_000m, Guid.NewGuid()));

        pay.NewState.Should().Be("FULL_SETTLEMENT");
        pay.NetCollected.Should().Be(40_000m);
        _workflow.Verify(w => w.FireAsync(
            _instanceId, "FULL_PAYMENT", It.IsAny<Guid>(), It.IsAny<string?>(), It.IsAny<CancellationToken>()),
            Times.Once);
    }

    [Fact]
    public async Task Replay_SamePaymentId_IsNoOp()
    {
        SeedSettlementCase("SETTLEMENT_PENDING");
        await _svc.ApplyAsync(Obligation(40_000m));
        var paymentId = Guid.NewGuid();

        var first = await _svc.ApplyAsync(Payment(20_000m, paymentId));
        var replay = await _svc.ApplyAsync(Payment(20_000m, paymentId));

        first.Applied.Should().BeTrue();
        replay.Duplicate.Should().BeTrue();
        replay.Applied.Should().BeFalse();
        replay.NetCollected.Should().Be(20_000m);
        replay.NewState.Should().Be("PARTIAL_SETTLEMENT");
        _workflow.Verify(w => w.FireAsync(
            _instanceId, "PARTIAL_PAYMENT", It.IsAny<Guid>(), It.IsAny<string?>(), It.IsAny<CancellationToken>()),
            Times.Once);
    }

    [Fact]
    public async Task TwoPayments_CompletePartialThenFull()
    {
        SeedSettlementCase("SETTLEMENT_PENDING");
        await _svc.ApplyAsync(Obligation(40_000m));

        (await _svc.ApplyAsync(Payment(25_000m, Guid.NewGuid()))).NewState.Should().Be("PARTIAL_SETTLEMENT");
        var full = await _svc.ApplyAsync(Payment(15_000m, Guid.NewGuid()));

        full.NetCollected.Should().Be(40_000m);
        full.NewState.Should().Be("FULL_SETTLEMENT");
        _workflow.Verify(w => w.FireAsync(
            _instanceId, "FULL_PAYMENT", It.IsAny<Guid>(), It.IsAny<string?>(), It.IsAny<CancellationToken>()),
            Times.Once);
    }

    [Fact]
    public async Task PaymentReversed_ReducesCollected_DoesNotRewindWorkflow()
    {
        SeedSettlementCase("SETTLEMENT_PENDING");
        await _svc.ApplyAsync(Obligation(40_000m));
        var paymentId = Guid.NewGuid();
        await _svc.ApplyAsync(Payment(40_000m, paymentId));

        var reversed = await _svc.ApplyAsync(new BillingLedgerEvent(
            BillingLedgerEventTypes.PaymentReversed,
            _fix.TenantId, _journeyId, null, Guid.NewGuid(), paymentId, 40_000m,
            _fix.ActorId, DateTime.UtcNow));

        reversed.Applied.Should().BeTrue();
        reversed.NetCollected.Should().Be(0m);
        reversed.NewState.Should().Be("FULL_SETTLEMENT");
    }

    [Fact]
    public async Task Cashless_ZeroObligation_DoesNotAdvanceTpaSettlement()
    {
        SeedSettlementCase("SETTLEMENT_PENDING");

        var pay = await _svc.ApplyAsync(Payment(5_000m, Guid.NewGuid()));

        pay.Applied.Should().BeTrue();
        pay.NetCollected.Should().Be(5_000m);
        pay.NewState.Should().Be("SETTLEMENT_PENDING");
        _workflow.Verify(w => w.FireAsync(
            It.IsAny<Guid>(), It.IsAny<string>(), It.IsAny<Guid>(),
            It.IsAny<string?>(), It.IsAny<CancellationToken>()),
            Times.Never);
    }

    [Fact]
    public async Task UnknownJourney_IsIgnored()
    {
        var result = await _svc.ApplyAsync(Payment(1_000m, Guid.NewGuid(), Guid.NewGuid()));
        result.Applied.Should().BeFalse();
        result.CoverageCaseId.Should().BeNull();
    }

    [Fact]
    public async Task WorkflowRejected_KeepsProjection_LeavesState()
    {
        SeedSettlementCase("SETTLEMENT_PENDING");
        await _svc.ApplyAsync(Obligation(10_000m));
        _workflow.Reset();
        _workflow
            .Setup(w => w.FireAsync(
                It.IsAny<Guid>(), It.IsAny<string>(), It.IsAny<Guid>(),
                It.IsAny<string?>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(new TransitionResult(false, "SETTLEMENT_PENDING", "SETTLEMENT_PENDING",
                "PARTIAL_PAYMENT", "not valid"));

        var pay = await _svc.ApplyAsync(Payment(4_000m, Guid.NewGuid()));

        pay.Applied.Should().BeTrue();
        pay.NetCollected.Should().Be(4_000m);
        pay.NewState.Should().Be("SETTLEMENT_PENDING");
    }

    private void SeedSettlementCase(string state)
    {
        var c = _fix.SeedCase(state: state);
        c.JourneyId = _journeyId;
        c.WorkflowInstanceId = _instanceId;
        _fix.Db.SaveChanges();
    }

    private BillingLedgerEvent Obligation(decimal amount)
        => new(BillingLedgerEventTypes.PatientObligationChanged,
            _fix.TenantId, _journeyId, null, Guid.NewGuid(), null, amount,
            _fix.ActorId, DateTime.UtcNow, $"ob:{amount:0.00}");

    private BillingLedgerEvent Payment(decimal amount, Guid paymentId, Guid? journeyId = null)
        => new(BillingLedgerEventTypes.PaymentReceived,
            _fix.TenantId, journeyId ?? _journeyId, null, Guid.NewGuid(), paymentId, amount,
            _fix.ActorId, DateTime.UtcNow);

    public void Dispose() => _fix.Dispose();
}
