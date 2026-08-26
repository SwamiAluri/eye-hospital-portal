using System.Reflection;
using AuthService.Authorization;
using AuthService.Context;
using AuthService.Controllers;
using AuthService.Models.Domain;
using AuthService.Services;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging.Abstractions;
using Moq;
using Xunit;

namespace AuthService.Tests;

public class BillingCcmsOutboxServiceTests : IDisposable
{
    private readonly AppDbContext _db;
    private readonly Mock<ICcmsBillFinalizedClient> _ccms = new();
    private readonly BillingCcmsOutboxService _outbox;

    public BillingCcmsOutboxServiceTests()
    {
        _db = TestDbContextFactory.CreateInMemory();
        _outbox = new BillingCcmsOutboxService(
            _db, _ccms.Object, NullLogger<BillingCcmsOutboxService>.Instance);
    }

    public void Dispose() => _db.Dispose();

    [Fact]
    public async Task DuplicateIdempotencyKey_IsSkipped()
    {
        var billId = Guid.NewGuid();
        var key = $"{BillingCcmsEventTypes.BillFinalized}:billing:{billId:N}";
        _outbox.Enqueue(Guid.NewGuid(), BillingCcmsEventTypes.BillFinalized, billId, new { billId }, key);
        _outbox.Enqueue(Guid.NewGuid(), BillingCcmsEventTypes.BillFinalized, billId, new { billId }, key);
        await _db.SaveChangesAsync();
        Assert.Equal(1, await _db.BillingCcmsOutboxEvents.CountAsync());
    }

    [Fact]
    public async Task ProcessPending_SuccessfulDelivery_MarksProcessed()
    {
        var billId = Guid.NewGuid();
        _outbox.Enqueue(
            Guid.NewGuid(),
            BillingCcmsEventTypes.PaymentReceived,
            billId,
            new { billId, amount = 100m },
            $"{BillingCcmsEventTypes.PaymentReceived}:billing:{billId:N}");
        await _db.SaveChangesAsync();

        var n = await _outbox.ProcessPendingAsync();
        Assert.Equal(1, n);
        Assert.Equal(BillingOutboxStatuses.Processed, (await _db.BillingCcmsOutboxEvents.SingleAsync()).Status);
        _ccms.Verify(
            c => c.DeliverOutboxEventAsync(
                BillingCcmsEventTypes.PaymentReceived,
                It.IsAny<string>(),
                It.IsAny<string>(),
                It.IsAny<CancellationToken>()),
            Times.Once);
    }

    [Fact]
    public async Task ProcessPending_Retry_ThenDead_OnPermanentFailure()
    {
        _ccms.Setup(c => c.DeliverOutboxEventAsync(
                It.IsAny<string>(), It.IsAny<string>(), It.IsAny<string>(), It.IsAny<CancellationToken>()))
            .ThrowsAsync(new InvalidOperationException("CCMS down"));

        var billId = Guid.NewGuid();
        _outbox.Enqueue(
            Guid.NewGuid(),
            BillingCcmsEventTypes.BillFinalized,
            billId,
            new { billId },
            $"{BillingCcmsEventTypes.BillFinalized}:billing:{billId:N}");
        await _db.SaveChangesAsync();

        for (var i = 0; i < 8; i++)
            await _outbox.ProcessPendingAsync();

        var evt = await _db.BillingCcmsOutboxEvents.SingleAsync();
        Assert.Equal(BillingOutboxStatuses.Dead, evt.Status);
        Assert.Equal(8, evt.RetryCount);
        Assert.False(string.IsNullOrWhiteSpace(evt.Error));
    }

    [Fact]
    public async Task Requeue_Dead_ResetsRetryCount_PreservesIdempotencyKey()
    {
        var tenantId = Guid.NewGuid();
        var billId = Guid.NewGuid();
        var key = $"{BillingCcmsEventTypes.PaymentReceived}:billing:{billId:N}";
        var id = Guid.NewGuid();
        _db.BillingCcmsOutboxEvents.Add(new BillingCcmsOutboxEvent
        {
            Id = id,
            TenantId = tenantId,
            EventType = BillingCcmsEventTypes.PaymentReceived,
            AggregateId = billId,
            PayloadJson = """{"billNumber":"RCP-1","patientName":"Suresh Babu"}""",
            IdempotencyKey = key,
            Status = BillingOutboxStatuses.Dead,
            RetryCount = 8,
            Error = "CCMS 503",
            OccurredAt = DateTime.UtcNow,
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow,
        });
        await _db.SaveChangesAsync();

        var n = await _outbox.RequeueAsync(tenantId, new BillingOutboxRequeueRequest([id], null));
        Assert.Equal(1, n);
        var evt = await _db.BillingCcmsOutboxEvents.SingleAsync();
        Assert.Equal(BillingOutboxStatuses.Pending, evt.Status);
        Assert.Equal(0, evt.RetryCount);
        Assert.Equal(key, evt.IdempotencyKey);
    }

    [Fact]
    public async Task Abandon_Financial_RequiresCompensatingAction()
    {
        var tenantId = Guid.NewGuid();
        var id = Guid.NewGuid();
        _db.BillingCcmsOutboxEvents.Add(new BillingCcmsOutboxEvent
        {
            Id = id,
            TenantId = tenantId,
            EventType = BillingCcmsEventTypes.PaymentReceived,
            AggregateId = Guid.NewGuid(),
            PayloadJson = "{}",
            IdempotencyKey = $"PaymentReceived:{id:N}",
            Status = BillingOutboxStatuses.Dead,
            RetryCount = 8,
            OccurredAt = DateTime.UtcNow,
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow,
        });
        await _db.SaveChangesAsync();

        await Assert.ThrowsAsync<ArgumentException>(() =>
            _outbox.AbandonAsync(tenantId, Guid.NewGuid(), new BillingOutboxAbandonRequest(id, "dup", null)));

        await _outbox.AbandonAsync(tenantId, Guid.NewGuid(),
            new BillingOutboxAbandonRequest(id, "dup of earlier receipt", "allocation already in CCMS"));
        Assert.Equal(BillingOutboxStatuses.Abandoned, (await _db.BillingCcmsOutboxEvents.SingleAsync()).Status);
        Assert.Equal($"PaymentReceived:{id:N}", (await _db.BillingCcmsOutboxEvents.SingleAsync()).IdempotencyKey);
    }

    [Fact]
    public void Routes_RequireIntegrationAdmin()
    {
        foreach (var name in new[]
        {
            nameof(BillingOutboxController.Stats),
            nameof(BillingOutboxController.Dead),
            nameof(BillingOutboxController.Requeue),
            nameof(BillingOutboxController.Abandon),
        })
        {
            var method = typeof(BillingOutboxController).GetMethod(name);
            Assert.NotNull(method);
            var attr = method!.GetCustomAttribute<RequirePermissionAttribute>();
            Assert.Equal("integration.admin", attr!.PermissionCode);
        }

        var inspect = typeof(BillingOutboxController).GetMethod(
            nameof(BillingOutboxController.Event), [typeof(Guid)]);
        Assert.NotNull(inspect);
        Assert.Equal(
            "integration.admin",
            inspect!.GetCustomAttribute<RequirePermissionAttribute>()!.PermissionCode);
    }
}
