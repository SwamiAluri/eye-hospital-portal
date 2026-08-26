using System.Text.Json;
using IpManagementService.Data;
using IpManagementService.Models.Domain;
using IpManagementService.Models.Dtos;
using IpManagementService.Services;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging.Abstractions;
using Xunit;

namespace IpManagementService.Tests;

public class ImplantUsageTests : IDisposable
{
    private readonly ServiceProvider _provider;
    private readonly IpManagementDbContext _db;
    private readonly RecordingBillingClient _billing;
    private readonly RecordingInventoryClient _inventory;
    private readonly IntegrationOutboxService _outbox;
    private readonly ImplantUsageService _svc;
    private readonly Guid _tenantId = Guid.NewGuid();
    private readonly Guid _actorId = Guid.NewGuid();
    private readonly Guid _branchId = Guid.NewGuid();
    private IolCatalogMaster _catalog = null!;

    public ImplantUsageTests()
    {
        var services = new ServiceCollection();
        services.AddDbContext<IpManagementDbContext>(o =>
            o.UseInMemoryDatabase(Guid.NewGuid().ToString("N")));
        _provider = services.BuildServiceProvider();
        _db = _provider.GetRequiredService<IpManagementDbContext>();
        _billing = new RecordingBillingClient();
        _inventory = new RecordingInventoryClient();
        var ccms = new NoOpCcmsAdmissionClient();
        var handler = new ImplantChargeHandler(
            _db, _billing, NullLogger<ImplantChargeHandler>.Instance, _inventory);
        _outbox = new IntegrationOutboxService(_db, ccms, NullLogger<IntegrationOutboxService>.Instance, handler);
        _svc = new ImplantUsageService(_db, _outbox);
        _catalog = SeedCatalog();
    }

    [Fact]
    public async Task RecordImplanted_EmitsOutboxWithUsageStatus_AndChargesOnceOnProcess()
    {
        var journey = SeedJourney(ClinicalState.InOT, "OD");
        var dto = await _svc.RecordAsync(journey.Id, _tenantId, _actorId, ImplantedRequest("88213"));

        Assert.Equal(ImplantUsageStatus.Implanted, dto.UsageStatus);
        Assert.Equal(ImplantChargeStatus.Pending, dto.ChargeStatus);
        var evt = Assert.Single(_db.IntegrationOutboxEvents);
        Assert.Equal(IntegrationEventTypes.ImplantUsed, evt.EventType);
        Assert.Contains("\"usageStatus\":\"Implanted\"", evt.PayloadJson);

        var n = await _outbox.ProcessPendingAsync();
        Assert.Equal(1, n);
        var post = Assert.Single(_billing.Posts);
        Assert.Equal($"ImplantUsed:{dto.Id:N}", post.Key);
        Assert.False(Assert.Single(post.Lines).IsCredit);
        Assert.Equal("Implant", post.Lines[0].SourceType);
        Assert.Equal(dto.Id, post.Lines[0].SourceRefId);

        var saved = await _db.JourneyImplantUsages.AsNoTracking().SingleAsync(u => u.Id == dto.Id);
        Assert.Equal(ImplantChargeStatus.Posted, saved.ChargeStatus);
        Assert.Equal(_inventory.LastLedgerId, saved.InventoryTxnId);
        Assert.Single(_inventory.Calls);

        await _outbox.ProcessPendingAsync();
        Assert.Single(_billing.Posts);
    }

    [Fact]
    public async Task PackageCovered_SetsCoveredNotPosted()
    {
        _billing.NextSuppressedCount = 1;
        var journey = SeedJourney(ClinicalState.InOT, "OD");
        var dto = await _svc.RecordAsync(journey.Id, _tenantId, _actorId, ImplantedRequest("88214"));
        await _outbox.ProcessPendingAsync();

        var saved = await _db.JourneyImplantUsages.AsNoTracking().SingleAsync(u => u.Id == dto.Id);
        Assert.Equal(ImplantChargeStatus.Covered, saved.ChargeStatus);
        Assert.False(Assert.Single(_billing.Posts).Lines[0].IsCredit);
        Assert.Equal(OutboxStatuses.Processed, Assert.Single(_db.IntegrationOutboxEvents).Status);
    }

    [Fact]
    public async Task UnprovenIol_MarksException_WithoutCredit()
    {
        _billing.NextExceptionCount = 1;
        var journey = SeedJourney(ClinicalState.InOT, "OD");
        var dto = await _svc.RecordAsync(journey.Id, _tenantId, _actorId, ImplantedRequest("88215"));
        await _outbox.ProcessPendingAsync();

        var saved = await _db.JourneyImplantUsages.AsNoTracking().SingleAsync(u => u.Id == dto.Id);
        Assert.Equal(ImplantChargeStatus.Exception, saved.ChargeStatus);
        Assert.Equal(OutboxStatuses.Processed, Assert.Single(_db.IntegrationOutboxEvents).Status);
    }

    [Fact]
    public async Task CoveredReversal_DoesNotPostCredit()
    {
        _billing.NextSuppressedCount = 1;
        var journey = SeedJourney(ClinicalState.InOT, "OD");
        var dto = await _svc.RecordAsync(journey.Id, _tenantId, _actorId, ImplantedRequest("88216"));
        await _outbox.ProcessPendingAsync();
        Assert.Equal(ImplantChargeStatus.Covered,
            (await _db.JourneyImplantUsages.AsNoTracking().SingleAsync()).ChargeStatus);

        var updated = await _svc.UpdateAsync(journey.Id, _tenantId, _actorId, dto.Id, new UpdateImplantRequest
        {
            UsageStatus = ImplantUsageStatus.Wasted,
            Reason = "Wrong serial scanned",
        });
        Assert.Equal(ImplantChargeStatus.Covered, updated.ChargeStatus);

        await _outbox.ProcessPendingAsync();
        Assert.Single(_billing.Posts);
        Assert.False(_billing.Posts[0].Lines[0].IsCredit);
        var saved = await _db.JourneyImplantUsages.AsNoTracking().SingleAsync();
        Assert.Equal(ImplantChargeStatus.Suppressed, saved.ChargeStatus);
    }

    [Fact]
    public async Task OpenedUnused_EmitsOutbox_AndSuppressesCharge()
    {
        var journey = SeedJourney(ClinicalState.InOT, "OD");
        var dto = await _svc.RecordAsync(journey.Id, _tenantId, _actorId, new RecordImplantRequest
        {
            ItemId = _catalog.Id,
            SerialNumber = "W-1",
            Eye = "OD",
            UsageStatus = ImplantUsageStatus.OpenedUnused,
            WastageReason = "Wrong power",
        });

        Assert.Equal(ImplantChargeStatus.Suppressed, dto.ChargeStatus);
        var evt = Assert.Single(_db.IntegrationOutboxEvents);
        Assert.Contains("\"usageStatus\":\"Opened_Unused\"", evt.PayloadJson);

        await _outbox.ProcessPendingAsync();
        Assert.Empty(_billing.Posts);
        Assert.Single(_inventory.Calls);
        Assert.Equal(ImplantUsageStatus.OpenedUnused, _inventory.Calls[0].UsageStatus);
        var saved = await _db.JourneyImplantUsages.AsNoTracking().SingleAsync(u => u.Id == dto.Id);
        Assert.Equal(_inventory.LastLedgerId, saved.InventoryTxnId);
    }

    [Fact]
    public async Task WastedWithoutReason_IsRejected()
    {
        var journey = SeedJourney(ClinicalState.InOT, "OD");
        await Assert.ThrowsAsync<ArgumentException>(() =>
            _svc.RecordAsync(journey.Id, _tenantId, _actorId, new RecordImplantRequest
            {
                ItemId = _catalog.Id,
                SerialNumber = "W-2",
                Eye = "OD",
                UsageStatus = ImplantUsageStatus.Wasted,
            }));
        Assert.Empty(_db.JourneyImplantUsages);
        Assert.Empty(_db.IntegrationOutboxEvents);
    }

    [Fact]
    public async Task EyeMismatch_IsHardBlock()
    {
        var journey = SeedJourney(ClinicalState.InOT, "OD");
        var ex = await Assert.ThrowsAsync<ArgumentException>(() =>
            _svc.RecordAsync(journey.Id, _tenantId, _actorId, ImplantedRequest("88213", eye: "OS")));
        Assert.Contains("operating eye is OD", ex.Message);
        Assert.Empty(_db.JourneyImplantUsages);
    }

    [Fact]
    public async Task DuplicateSerial_IsHardBlock()
    {
        var first = SeedJourney(ClinicalState.InOT, "OD");
        await _svc.RecordAsync(first.Id, _tenantId, _actorId, ImplantedRequest("88213"));
        var second = SeedJourney(ClinicalState.InOT, "OD");
        await Assert.ThrowsAsync<InvalidOperationException>(() =>
            _svc.RecordAsync(second.Id, _tenantId, _actorId, ImplantedRequest("88213")));
    }

    [Fact]
    public async Task WrongClinicalState_IsRejected()
    {
        var journey = SeedJourney(ClinicalState.Admitted, "OD");
        await Assert.ThrowsAsync<ArgumentException>(() =>
            _svc.RecordAsync(journey.Id, _tenantId, _actorId, ImplantedRequest("88213")));
    }

    [Fact]
    public async Task UnresolvableCatalog_IsRejected_WithoutOutbox()
    {
        var journey = SeedJourney(ClinicalState.InOT, "OD");
        await Assert.ThrowsAsync<ArgumentException>(() =>
            _svc.RecordAsync(journey.Id, _tenantId, _actorId, new RecordImplantRequest
            {
                CatalogRef = "NOT-A-REAL-IOL",
                SerialNumber = "88213",
                Eye = "OD",
                UsageStatus = ImplantUsageStatus.Implanted,
            }));
        Assert.Empty(_db.IntegrationOutboxEvents);
    }

    [Fact]
    public async Task Reversal_AfterCharge_PostsCredit_NeverDeletes()
    {
        var journey = SeedJourney(ClinicalState.InOT, "OD");
        var dto = await _svc.RecordAsync(journey.Id, _tenantId, _actorId, ImplantedRequest("88117"));
        await _outbox.ProcessPendingAsync();
        Assert.False(Assert.Single(_billing.Posts).Lines[0].IsCredit);

        var updated = await _svc.UpdateAsync(journey.Id, _tenantId, _actorId, dto.Id, new UpdateImplantRequest
        {
            UsageStatus = ImplantUsageStatus.Wasted,
            Reason = "Wrong serial scanned",
        });
        Assert.Equal(ImplantUsageStatus.Wasted, updated.UsageStatus);
        Assert.Equal(ImplantChargeStatus.CreditPending, updated.ChargeStatus);
        Assert.Equal(2, _db.IntegrationOutboxEvents.Count());

        await _outbox.ProcessPendingAsync();
        Assert.Equal(2, _billing.Posts.Count);
        Assert.True(_billing.Posts[1].Lines[0].IsCredit);
        Assert.StartsWith("ImplantUsageReversed:", _billing.Posts[1].Key);

        Assert.Single(_db.JourneyImplantUsages);
        var saved = await _db.JourneyImplantUsages.AsNoTracking().SingleAsync();
        Assert.Equal(ImplantChargeStatus.Credited, saved.ChargeStatus);
        Assert.Equal(ImplantUsageStatus.Wasted, saved.UsageStatus);
        Assert.Equal(2, _inventory.Calls.Count);
        Assert.Equal(ImplantUsageStatus.Implanted, _inventory.Calls[0].UsageStatus);
        Assert.Equal(ImplantUsageStatus.Wasted, _inventory.Calls[1].UsageStatus);
    }

    [Fact]
    public async Task OpenedUnused_ReturnFromPostOp_EmitsReversal_AndRestoresStock()
    {
        var journey = SeedJourney(ClinicalState.InOT, "OD");
        var dto = await _svc.RecordAsync(journey.Id, _tenantId, _actorId, new RecordImplantRequest
        {
            ItemId = _catalog.Id,
            SerialNumber = "RET-1",
            Eye = "OD",
            UsageStatus = ImplantUsageStatus.OpenedUnused,
            WastageReason = "Wrong power opened",
        });
        await _outbox.ProcessPendingAsync();
        Assert.Single(_inventory.Calls);

        journey.ClinicalState = ClinicalState.PostOp;
        await _db.SaveChangesAsync();

        var updated = await _svc.UpdateAsync(journey.Id, _tenantId, _actorId, dto.Id, new UpdateImplantRequest
        {
            UsageStatus = ImplantUsageStatus.Returned,
            Reason = "Unopened remainder returned to store",
        });
        Assert.Equal(ImplantUsageStatus.Returned, updated.UsageStatus);
        Assert.Contains(_db.IntegrationOutboxEvents, e => e.EventType == IntegrationEventTypes.ImplantUsageReversed);

        await _outbox.ProcessPendingAsync();
        Assert.Equal(2, _inventory.Calls.Count);
        Assert.Equal(ImplantUsageStatus.Returned, _inventory.Calls[1].UsageStatus);
        Assert.Empty(_billing.Posts);
    }

    [Fact]
    public async Task RecordReturn_MatchingSerial_PatchesRegistry_InsteadOfLegacyOnly()
    {
        var journey = SeedJourney(ClinicalState.InOT, "OD");
        var dto = await _svc.RecordAsync(journey.Id, _tenantId, _actorId, ImplantedRequest("RET-9"));
        await _outbox.ProcessPendingAsync();
        Assert.Single(_billing.Posts);

        journey.ClinicalState = ClinicalState.PostOp;
        await _db.SaveChangesAsync();

        var returned = await _svc.RecordReturnAsync(journey.Id, _tenantId, _actorId, new RecordIolReturnRequest(
            IolPower: "21",
            IolBatch: "B-2291",
            IolBarcode: "RET-9",
            Reason: "Explanted and returned to CSSD"));
        Assert.Equal(dto.Id, returned.Id);
        Assert.Equal(ImplantUsageStatus.Returned, returned.UsageStatus);

        await _outbox.ProcessPendingAsync();
        Assert.Equal(2, _billing.Posts.Count);
        Assert.True(_billing.Posts[1].Lines[0].IsCredit);
        Assert.Equal(2, _inventory.Calls.Count);
    }

    [Fact]
    public async Task RecordReturn_WithoutMatch_CreatesSuppressedReturnedRow()
    {
        var journey = SeedJourney(ClinicalState.PostOp, "OD");
        var dto = await _svc.RecordReturnAsync(journey.Id, _tenantId, _actorId, new RecordIolReturnRequest(
            IolPower: "22.5",
            IolBatch: "B-NEW",
            IolBarcode: "UNSCANNED-1",
            Reason: "Unopened lens returned from trolley"));
        Assert.Equal(ImplantUsageStatus.Returned, dto.UsageStatus);
        Assert.Equal(ImplantChargeStatus.Suppressed, dto.ChargeStatus);

        await _outbox.ProcessPendingAsync();
        Assert.Empty(_billing.Posts);
        Assert.Empty(_inventory.Calls);
    }

    [Fact]
    public async Task ReverseBeforeCharge_SuppressesBothLegs()
    {
        var journey = SeedJourney(ClinicalState.InOT, "OD");
        var dto = await _svc.RecordAsync(journey.Id, _tenantId, _actorId, ImplantedRequest("88118"));
        await _svc.UpdateAsync(journey.Id, _tenantId, _actorId, dto.Id, new UpdateImplantRequest
        {
            UsageStatus = ImplantUsageStatus.Reversed,
            Reason = "Wrong serial scanned before charge",
        });

        await _outbox.ProcessPendingAsync();
        Assert.Empty(_billing.Posts);
        var saved = await _db.JourneyImplantUsages.AsNoTracking().SingleAsync();
        Assert.Equal(ImplantChargeStatus.Suppressed, saved.ChargeStatus);
    }

    [Fact]
    public async Task VerifyBarcode_DoesNotEmitImplantUsed()
    {
        var journey = SeedJourney(ClinicalState.InOT, "OD");
        var flags = new VerifyIolBarcodeResponse(true, _catalog.ProductCode, "ok");
        var resolved = await _svc.ResolveBarcodeAsync(journey.Id, _tenantId, _actorId, _catalog.ProductCode!, flags);
        Assert.Equal(_catalog.Id, resolved.CatalogId);
        Assert.Equal(_catalog.Brand, resolved.Brand);
        Assert.Empty(_db.JourneyImplantUsages);
        Assert.Empty(_db.IntegrationOutboxEvents);
    }

    [Fact]
    public async Task ResolveBarcode_UnreadableGs1_DoesNotInsertOrEmit()
    {
        var journey = SeedJourney(ClinicalState.InOT, "OD");
        var flags = new VerifyIolBarcodeResponse(false, null, Gs1BarcodeParser.UnreadableMessage, Symbology: "gs1");
        var resolved = await _svc.ResolveBarcodeAsync(journey.Id, _tenantId, _actorId, "01XX", flags);
        Assert.False(resolved.IsValid);
        Assert.Equal(Gs1BarcodeParser.UnreadableMessage, resolved.Message);
        Assert.Empty(_db.JourneyImplantUsages);
        Assert.Empty(_db.IntegrationOutboxEvents);
    }

    [Fact]
    public async Task ResolveBarcode_UsesGtinFromGs1()
    {
        var gtinCatalog = SeedCatalog("SN60WF", "08901234567890");
        var journey = SeedJourney(ClinicalState.InOT, "OD");
        var flags = new VerifyIolBarcodeResponse(true, "parsed", "Barcode parsed.",
            Gtin: "08901234567890", Serial: "88213", Lot: "B2291", Expiry: "2028-06-30", Symbology: "gs1");
        var gs1 = "(01)08901234567890(21)88213(10)B2291(17)280630";
        var resolved = await _svc.ResolveBarcodeAsync(journey.Id, _tenantId, _actorId, gs1, flags);
        Assert.Equal(gtinCatalog.Id, resolved.CatalogId);
        Assert.Equal("88213", resolved.Serial);
        Assert.Equal("B2291", resolved.Lot);
        Assert.Equal("2028-06-30", resolved.Expiry);
        Assert.Equal("gs1", resolved.Symbology);
        Assert.Empty(_db.IntegrationOutboxEvents);
    }

    [Fact]
    public async Task RecordImplanted_FillsSerialAndLotFromGs1Udi()
    {
        var gtinCatalog = SeedCatalog("SN60WF", "08901234567890");
        var journey = SeedJourney(ClinicalState.InOT, "OD", iolPower: "21.00", iolBarcode: "SN60WF");
        var dto = await _svc.RecordAsync(journey.Id, _tenantId, _actorId, new RecordImplantRequest
        {
            ItemId = gtinCatalog.Id,
            UdiBarcode = "(01)08901234567890(21)88213(10)B2291(17)280630",
            Eye = "OD",
            UsageStatus = ImplantUsageStatus.Implanted,
            Power = 21.00m,
        });
        Assert.Equal("88213", dto.SerialNumber);
        Assert.Equal("B2291", dto.BatchNumber);
        Assert.Contains("(01)", dto.UdiBarcode);
        Assert.Single(_db.IntegrationOutboxEvents);
    }

    [Fact]
    public async Task InventoryOutage_DoesNotRollBackClinicalRow()
    {
        _inventory.ThrowOnApply = true;
        var journey = SeedJourney(ClinicalState.InOT, "OD");
        var dto = await _svc.RecordAsync(journey.Id, _tenantId, _actorId, ImplantedRequest("88998"));
        Assert.Equal(ImplantUsageStatus.Implanted, dto.UsageStatus);

        await _outbox.ProcessPendingAsync();
        var evt = Assert.Single(_db.IntegrationOutboxEvents);
        Assert.Equal(OutboxStatuses.Failed, evt.Status);
        Assert.Single(_db.JourneyImplantUsages);
        Assert.Empty(_billing.Posts);
    }

    [Fact]
    public async Task InventoryUnavailable_DoesNotDeadLetter_AfterMaxRetries()
    {
        _inventory.ThrowOnApply = true;
        var journey = SeedJourney(ClinicalState.InOT, "OD");
        var dto = await _svc.RecordAsync(journey.Id, _tenantId, _actorId, ImplantedRequest("89101"));

        var first = await _outbox.ProcessPendingAsync();
        Assert.Equal(0, first);
        var afterOne = Assert.Single(_db.IntegrationOutboxEvents);
        Assert.Equal(OutboxStatuses.Failed, afterOne.Status);
        Assert.Equal(1, afterOne.RetryCount);

        for (var i = 0; i < 10; i++)
            await _outbox.ProcessPendingAsync();

        var waiting = Assert.Single(_db.IntegrationOutboxEvents);
        Assert.Equal(OutboxStatuses.Failed, waiting.Status);
        Assert.True(waiting.RetryCount >= 8);
        Assert.NotEqual(OutboxStatuses.Dead, waiting.Status);
        Assert.NotEqual(OutboxStatuses.Processed, waiting.Status);
        Assert.Contains("INVENTORY_UNAVAILABLE", waiting.Error ?? "", StringComparison.Ordinal);
        var pending = await _db.JourneyImplantUsages.AsNoTracking().SingleAsync(u => u.Id == dto.Id);
        Assert.Equal(ImplantChargeStatus.Pending, pending.ChargeStatus);
        Assert.Empty(_billing.Posts);
        Assert.Equal(0, await _outbox.ProcessPendingAsync());
    }

    [Fact]
    public async Task InventoryRecovers_ThenChargeItemsPostsOnce_AndDuplicateRetryIsNoOp()
    {
        _inventory.ThrowOnApply = true;
        var journey = SeedJourney(ClinicalState.InOT, "OD");
        var dto = await _svc.RecordAsync(journey.Id, _tenantId, _actorId, ImplantedRequest("89102"));

        for (var i = 0; i < 10; i++)
            await _outbox.ProcessPendingAsync();
        Assert.Equal(OutboxStatuses.Failed, (await _db.IntegrationOutboxEvents.SingleAsync()).Status);
        Assert.Empty(_billing.Posts);

        _inventory.ThrowOnApply = false;
        var n = await _outbox.ProcessPendingAsync();
        Assert.Equal(1, n);
        Assert.Equal(OutboxStatuses.Processed, (await _db.IntegrationOutboxEvents.SingleAsync()).Status);
        Assert.Single(_billing.Posts);
        Assert.Equal($"ImplantUsed:{dto.Id:N}", _billing.Posts[0].Key);
        var posted = await _db.JourneyImplantUsages.AsNoTracking().SingleAsync(u => u.Id == dto.Id);
        Assert.Equal(ImplantChargeStatus.Posted, posted.ChargeStatus);
        Assert.Equal(_inventory.LastLedgerId, posted.InventoryTxnId);

        await _outbox.ProcessPendingAsync();
        Assert.Single(_billing.Posts);
        Assert.Single(_inventory.Calls);
    }

    [Fact]
    public async Task InventoryRecovers_ClosedBill_ParksNeedsAdjustment()
    {
        _inventory.ThrowOnApply = true;
        var journey = SeedJourney(ClinicalState.InOT, "OD");
        var dto = await _svc.RecordAsync(journey.Id, _tenantId, _actorId, ImplantedRequest("89103"));
        await _outbox.ProcessPendingAsync();
        Assert.Empty(_billing.Posts);

        _inventory.ThrowOnApply = false;
        _billing.ThrowCode = "BILL_FINALIZED";
        await _outbox.ProcessPendingAsync();

        var evt = Assert.Single(_db.IntegrationOutboxEvents);
        Assert.Equal(OutboxStatuses.Processed, evt.Status);
        Assert.Empty(_billing.Posts);
        Assert.Equal("NeedsAdjustment", Assert.Single(_billing.Exceptions).Status);
        var saved = await _db.JourneyImplantUsages.AsNoTracking().SingleAsync(u => u.Id == dto.Id);
        Assert.Equal(ImplantChargeStatus.Pending, saved.ChargeStatus);
    }

    [Fact]
    public async Task InventoryUnavailable_DoesNotConvertCoveredIolIntoImplantCharge()
    {
        _inventory.ThrowOnApply = true;
        _billing.NextSuppressedCount = 1;
        var journey = SeedJourney(ClinicalState.InOT, "OD");
        var dto = await _svc.RecordAsync(journey.Id, _tenantId, _actorId, ImplantedRequest("89104"));

        for (var i = 0; i < 10; i++)
            await _outbox.ProcessPendingAsync();
        Assert.Empty(_billing.Posts);
        Assert.Equal(ImplantChargeStatus.Pending,
            (await _db.JourneyImplantUsages.AsNoTracking().SingleAsync(u => u.Id == dto.Id)).ChargeStatus);

        _inventory.ThrowOnApply = false;
        await _outbox.ProcessPendingAsync();

        var saved = await _db.JourneyImplantUsages.AsNoTracking().SingleAsync(u => u.Id == dto.Id);
        Assert.Equal(ImplantChargeStatus.Covered, saved.ChargeStatus);
        var post = Assert.Single(_billing.Posts);
        Assert.Equal(0, post.Lines.Count(l => l.IsCredit));
        Assert.Equal("Implant", post.Lines[0].SourceType);
        Assert.Equal(OutboxStatuses.Processed, Assert.Single(_db.IntegrationOutboxEvents).Status);
    }

    [Fact]
    public async Task DeadInventoryUnavailable_IsRevivedAndPosted()
    {
        var journey = SeedJourney(ClinicalState.InOT, "OD");
        var dto = await _svc.RecordAsync(journey.Id, _tenantId, _actorId, ImplantedRequest("89105"));
        var evt = Assert.Single(_db.IntegrationOutboxEvents);
        evt.Status = OutboxStatuses.Dead;
        evt.RetryCount = 8;
        evt.Error = "INVENTORY_UNAVAILABLE";
        await _db.SaveChangesAsync();

        var n = await _outbox.ProcessPendingAsync();
        Assert.Equal(1, n);
        Assert.Equal(OutboxStatuses.Processed, (await _db.IntegrationOutboxEvents.SingleAsync()).Status);
        Assert.Single(_billing.Posts);
        var posted = await _db.JourneyImplantUsages.AsNoTracking().SingleAsync(u => u.Id == dto.Id);
        Assert.Equal(ImplantChargeStatus.Posted, posted.ChargeStatus);
    }

    [Fact]
    public async Task BillingOutage_DoesNotRollBackClinicalRow()
    {
        _billing.ThrowOnCharge = true;
        var journey = SeedJourney(ClinicalState.InOT, "OD");
        var dto = await _svc.RecordAsync(journey.Id, _tenantId, _actorId, ImplantedRequest("88999"));
        Assert.Equal(ImplantUsageStatus.Implanted, dto.UsageStatus);

        await _outbox.ProcessPendingAsync();
        var evt = Assert.Single(_db.IntegrationOutboxEvents);
        Assert.Equal(OutboxStatuses.Failed, evt.Status);
        Assert.Single(_db.JourneyImplantUsages);
    }

    [Fact]
    public async Task UnmappedBillingItem_MarksException_AndDoesNotRetryForever()
    {
        _billing.ThrowCode = "UNKNOWN_CATALOG_ITEM";
        var journey = SeedJourney(ClinicalState.InOT, "OD");
        var dto = await _svc.RecordAsync(journey.Id, _tenantId, _actorId, ImplantedRequest("89001"));
        await _outbox.ProcessPendingAsync();
        var saved = await _db.JourneyImplantUsages.AsNoTracking().SingleAsync(u => u.Id == dto.Id);
        Assert.Equal(ImplantChargeStatus.Exception, saved.ChargeStatus);
        Assert.Equal(OutboxStatuses.Processed, Assert.Single(_db.IntegrationOutboxEvents).Status);
    }

    [Fact]
    public async Task BillNotFound_DoesNotDeadLetter_ThenPostsWhenBillExists()
    {
        _billing.ThrowCode = "BILL_NOT_FOUND";
        var journey = SeedJourney(ClinicalState.InOT, "OD");
        var dto = await _svc.RecordAsync(journey.Id, _tenantId, _actorId, ImplantedRequest("89002"));

        for (var i = 0; i < 10; i++)
            await _outbox.ProcessPendingAsync();

        var waiting = Assert.Single(_db.IntegrationOutboxEvents);
        Assert.Equal(OutboxStatuses.Failed, waiting.Status);
        Assert.True(waiting.RetryCount >= 8);
        var pending = await _db.JourneyImplantUsages.AsNoTracking().SingleAsync(u => u.Id == dto.Id);
        Assert.Equal(ImplantChargeStatus.Pending, pending.ChargeStatus);
        Assert.Empty(_billing.Posts);

        _billing.ThrowCode = null;
        await _outbox.ProcessPendingAsync();
        Assert.Equal(OutboxStatuses.Processed, (await _db.IntegrationOutboxEvents.SingleAsync()).Status);
        var posted = await _db.JourneyImplantUsages.AsNoTracking().SingleAsync(u => u.Id == dto.Id);
        Assert.Equal(ImplantChargeStatus.Posted, posted.ChargeStatus);
        Assert.Single(_billing.Posts);
    }

    [Fact]
    public async Task BillFinalized_ParksNeedsAdjustment_DoesNotDeadLetter()
    {
        _billing.ThrowCode = "BILL_FINALIZED";
        var journey = SeedJourney(ClinicalState.InOT, "OD");
        var dto = await _svc.RecordAsync(journey.Id, _tenantId, _actorId, ImplantedRequest("89003"));

        for (var i = 0; i < 10; i++)
            await _outbox.ProcessPendingAsync();

        var evt = Assert.Single(_db.IntegrationOutboxEvents);
        Assert.Equal(OutboxStatuses.Processed, evt.Status);
        Assert.Empty(_billing.Posts);
        var parked = Assert.Single(_billing.Exceptions);
        Assert.Equal("NeedsAdjustment", parked.Status);
        var saved = await _db.JourneyImplantUsages.AsNoTracking().SingleAsync(u => u.Id == dto.Id);
        Assert.Equal(ImplantChargeStatus.Pending, saved.ChargeStatus);
    }

    [Fact]
    public async Task BillLocked_ParksNeedsAdjustment_DoesNotDeadLetter()
    {
        _billing.ThrowCode = "BILL_LOCKED";
        var journey = SeedJourney(ClinicalState.InOT, "OD");
        var dto = await _svc.RecordAsync(journey.Id, _tenantId, _actorId, ImplantedRequest("89004"));

        await _outbox.ProcessPendingAsync();

        var evt = Assert.Single(_db.IntegrationOutboxEvents);
        Assert.Equal(OutboxStatuses.Processed, evt.Status);
        Assert.Empty(_billing.Posts);
        Assert.Equal("NeedsAdjustment", Assert.Single(_billing.Exceptions).Status);
        var saved = await _db.JourneyImplantUsages.AsNoTracking().SingleAsync(u => u.Id == dto.Id);
        Assert.Equal(ImplantChargeStatus.Pending, saved.ChargeStatus);
    }

    [Fact]
    public async Task Planned21_VsScanned2100_IsExactMatch()
    {
        var journey = SeedJourney(ClinicalState.InOT, "OD", iolPower: "21");
        var dto = await _svc.RecordAsync(journey.Id, _tenantId, _actorId, ImplantedRequest("PWR-21", power: 21.00m));
        Assert.Equal(21.00m, dto.Power);
        Assert.Null(dto.Warning);
        Assert.Single(_db.IntegrationOutboxEvents);
    }

    [Fact]
    public async Task Planned2100_VsScanned2150_Is409_WithoutOutbox()
    {
        var journey = SeedJourney(ClinicalState.InOT, "OD", iolPower: "21.00");
        var ex = await Assert.ThrowsAsync<InvalidOperationException>(() =>
            _svc.RecordAsync(journey.Id, _tenantId, _actorId, ImplantedRequest("PWR-215", power: 21.50m)));
        Assert.Contains("+21.50 D", ex.Message);
        Assert.Contains("+21.00 D", ex.Message);
        Assert.Empty(_db.JourneyImplantUsages);
        Assert.Empty(_db.IntegrationOutboxEvents);
    }

    [Fact]
    public async Task CatalogHalfDiopterStep_IsNotTolerance()
    {
        var journey = SeedJourney(ClinicalState.InOT, "OD", iolPower: "+21.00 D");
        await Assert.ThrowsAsync<InvalidOperationException>(() =>
            _svc.RecordAsync(journey.Id, _tenantId, _actorId, ImplantedRequest("PWR-STEP", power: 21.50m)));
    }

    [Fact]
    public async Task EmptyPlannedPower_WarnsAndRecords()
    {
        var journey = SeedJourney(ClinicalState.InOT, "OD");
        var dto = await _svc.RecordAsync(journey.Id, _tenantId, _actorId, ImplantedRequest("PWR-EMPTY", power: 21.00m));
        Assert.Contains("No planned IOL power", dto.Warning);
        Assert.Single(_db.JourneyImplantUsages);
        Assert.Single(_db.IntegrationOutboxEvents);
    }

    [Fact]
    public async Task ImplantedWithoutPower_WhenPlannedSet_Is400()
    {
        var journey = SeedJourney(ClinicalState.InOT, "OD", iolPower: "21.00");
        var req = ImplantedRequest("PWR-NONE", power: null);
        var ex = await Assert.ThrowsAsync<ArgumentException>(() =>
            _svc.RecordAsync(journey.Id, _tenantId, _actorId, req));
        Assert.Contains("Power is required", ex.Message);
        Assert.Empty(_db.JourneyImplantUsages);
    }

    [Fact]
    public async Task PowerMismatch_OverrideWithoutPermission_WhenBound_Is401()
    {
        var auth = new JourneyCommandAuthContext();
        auth.Bind(["ot.safety.sign", "ip.surgery.complete"]);
        var svc = new ImplantUsageService(_db, _outbox, auth);
        var journey = SeedJourney(ClinicalState.InOT, "OD", iolPower: "21.00");
        var req = ImplantedRequest("PWR-NOP", power: 21.50m);
        req.AcknowledgeMismatch = true;
        req.MismatchReason = "Surgeon selected +21.50 after posterior capsule";
        await Assert.ThrowsAsync<UnauthorizedAccessException>(() =>
            svc.RecordAsync(journey.Id, _tenantId, _actorId, req));
        Assert.Empty(_db.JourneyImplantUsages);
        Assert.Empty(_db.IntegrationOutboxEvents);
    }

    [Fact]
    public async Task PowerMismatch_OverrideWithPermission_RecordsAndAudits()
    {
        var auth = new JourneyCommandAuthContext();
        auth.Bind(["ip.implant.mismatch.override"]);
        var svc = new ImplantUsageService(_db, _outbox, auth);
        var journey = SeedJourney(ClinicalState.InOT, "OD", iolPower: "21.00");
        var req = ImplantedRequest("PWR-OVR", power: 21.50m);
        req.AcknowledgeMismatch = true;
        req.MismatchReason = "Surgeon selected +21.50 after posterior capsule";
        var dto = await svc.RecordAsync(journey.Id, _tenantId, _actorId, req);
        Assert.Equal(21.50m, dto.Power);
        Assert.Contains(_db.JourneyAuditLogs, a => a.Action == "ImplantMismatchOverridden");
        var evt = Assert.Single(_db.IntegrationOutboxEvents);
        Assert.Contains("\"mismatchOverridden\":true", evt.PayloadJson);
    }

    [Fact]
    public async Task Override_ShortReason_Is400()
    {
        var journey = SeedJourney(ClinicalState.InOT, "OD", iolPower: "21.00");
        var req = ImplantedRequest("PWR-SHORT", power: 21.50m);
        req.AcknowledgeMismatch = true;
        req.MismatchReason = "too short";
        var ex = await Assert.ThrowsAsync<ArgumentException>(() =>
            _svc.RecordAsync(journey.Id, _tenantId, _actorId, req));
        Assert.Contains("10 characters", ex.Message);
        Assert.Empty(_db.JourneyImplantUsages);
    }

    [Fact]
    public async Task EyeMismatch_CannotBeOverridden()
    {
        var journey = SeedJourney(ClinicalState.InOT, "OD", iolPower: "21.00");
        var req = ImplantedRequest("EYE-OVR", eye: "OS", power: 21.50m);
        req.AcknowledgeMismatch = true;
        req.MismatchReason = "Surgeon selected +21.50 after posterior capsule";
        var ex = await Assert.ThrowsAsync<ArgumentException>(() =>
            _svc.RecordAsync(journey.Id, _tenantId, _actorId, req));
        Assert.Contains("operating eye is OD", ex.Message);
        Assert.Empty(_db.JourneyImplantUsages);
    }

    [Fact]
    public async Task ModelMismatch_Is409()
    {
        var other = SeedCatalog("SN6AD1", "ALCON-SN6AD1");
        var journey = SeedJourney(ClinicalState.InOT, "OD", iolPower: "21.00", iolBarcode: _catalog.ProductCode);
        var req = ImplantedRequest("MDL-1", power: 21.00m);
        req.ItemId = other.Id;
        var ex = await Assert.ThrowsAsync<InvalidOperationException>(() =>
            _svc.RecordAsync(journey.Id, _tenantId, _actorId, req));
        Assert.Contains("SN6AD1", ex.Message);
        Assert.Contains("SN60WF", ex.Message);
        Assert.Empty(_db.JourneyImplantUsages);
    }

    [Fact]
    public async Task MatchingPlannedModel_AllowsRecord()
    {
        var journey = SeedJourney(ClinicalState.InOT, "OD", iolPower: "21.00", iolBarcode: "SN60WF");
        var dto = await _svc.RecordAsync(journey.Id, _tenantId, _actorId, ImplantedRequest("MDL-OK", power: 21.00m));
        Assert.Equal("SN60WF", dto.Model);
        Assert.Null(dto.Warning);
    }

    [Fact]
    public void PayloadJson_AlwaysIncludesUsageStatus()
    {
        var json = JsonSerializer.Serialize(new { usageStatus = ImplantUsageStatus.Implanted, implantUsageId = Guid.NewGuid() });
        Assert.Contains("usageStatus", json);
    }

    private RecordImplantRequest ImplantedRequest(string serial, string eye = "OD", decimal? power = 21.0m) => new()
    {
        ItemId = _catalog.Id,
        SerialNumber = serial,
        BatchNumber = "B-2291",
        UdiBarcode = "08901234567890",
        Power = power,
        Eye = eye,
        UsageStatus = ImplantUsageStatus.Implanted,
    };

    private PatientJourney SeedJourney(string clinicalState, string eye, string? iolPower = null, string? iolBarcode = null)
    {
        var journey = new PatientJourney
        {
            Id = Guid.NewGuid(),
            TenantId = _tenantId,
            BranchId = _branchId,
            PatientId = Guid.NewGuid(),
            ClinicalState = clinicalState,
            OtState = OtState.InProgress,
            FinancialState = FinancialState.Draft,
            EyeOperated = eye,
            IolPower = iolPower,
            IolBarcode = iolBarcode,
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow,
            Status = "active",
        };
        _db.PatientJourneys.Add(journey);
        _db.SaveChanges();
        return journey;
    }

    private IolCatalogMaster SeedCatalog(string modelName = "SN60WF", string productCode = "ALCON-SN60WF")
    {
        var row = new IolCatalogMaster
        {
            Id = Guid.NewGuid(),
            TenantId = _tenantId,
            ModelName = modelName,
            Brand = "Alcon",
            IolType = "Monofocal",
            ProductCode = productCode,
            DefaultPrice = 14000m,
            IsActive = true,
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow,
            Status = "active",
        };
        _db.IolCatalogMaster.Add(row);
        _db.SaveChanges();
        return row;
    }

    public void Dispose()
    {
        _db.Dispose();
        _provider.Dispose();
    }

    private sealed class RecordingBillingClient : IAuthBillingClient
    {
        public List<(string Key, IReadOnlyList<AuthChargeItemLine> Lines)> Posts { get; } = [];
        public bool ThrowOnCharge { get; set; }
        public string? ThrowCode { get; set; }
        public int NextSuppressedCount { get; set; }
        public int NextExceptionCount { get; set; }

        public Task<Guid> EnsureBillAsync(Guid tenantId, Guid branchId, Guid patientId, Guid journeyId, decimal packageAmount, Guid actorUserId)
            => Task.FromResult(Guid.NewGuid());
        public Task<AuthIpFinancialSummary> GetSummaryAsync(Guid journeyId)
            => Task.FromResult(new AuthIpFinancialSummary(
                null, null, 0, 0, 0, 0, 0, 0, 0, 0, 0, "not_created", false, false, [], []));
        public Task RecordPaymentAsync(Guid opdBillId, Guid actorUserId, string kind, string paymentMode, decimal amount, string? reference, string? notes, string? idempotencyKey)
            => Task.CompletedTask;
        public Task ReversePaymentAsync(Guid opdBillId, Guid originalPaymentId, Guid actorUserId, string reason)
            => Task.CompletedTask;
        public Task ApplyCoverageAllocationAsync(Guid journeyId, decimal payerResponsibility, decimal patientResponsibility, Guid actorUserId)
            => Task.CompletedTask;
        public Task SoftDeleteBillsForJourneysAsync(IReadOnlyList<Guid> journeyIds, Guid actorUserId)
            => Task.CompletedTask;

        public Task<AuthChargeItemsResult> ChargeItemsAsync(
            Guid tenantId,
            Guid patientJourneyId,
            Guid actorUserId,
            string idempotencyKey,
            IReadOnlyList<AuthChargeItemLine> lines)
        {
            if (ThrowOnCharge)
                throw new InvalidOperationException("Billing unavailable");
            if (ThrowCode is not null)
                throw new AuthChargePostingException(ThrowCode, ThrowCode, Guid.NewGuid());
            Posts.Add((idempotencyKey, lines));
            var suppressed = NextSuppressedCount;
            var exceptions = NextExceptionCount;
            NextSuppressedCount = 0;
            NextExceptionCount = 0;
            return Task.FromResult(new AuthChargeItemsResult(
                Guid.NewGuid(),
                false,
                PostedCount: suppressed + exceptions > 0 ? 0 : lines.Count,
                SuppressedCount: suppressed,
                ExceptionCount: exceptions));
        }

        public List<(string Key, string Reason, Guid? JourneyId, string? Status)> Exceptions { get; } = [];

        public Task EnqueueChargeExceptionAsync(
            Guid tenantId,
            Guid? patientJourneyId,
            Guid? itemId,
            Guid? sourceRefId,
            string sourceType,
            string reason,
            string idempotencyKey,
            decimal quantity,
            Guid? opdBillId = null,
            string? status = null)
        {
            Exceptions.Add((idempotencyKey, reason, patientJourneyId, status));
            return Task.CompletedTask;
        }
    }

    private sealed class RecordingInventoryClient : IInventoryImplantClient
    {
        public List<(Guid UsageId, string UsageStatus)> Calls { get; } = [];
        public Guid LastLedgerId { get; } = Guid.NewGuid();
        public bool ThrowOnApply { get; set; }

        public Task<InventoryImplantApplyResult> ApplyAsync(
            Guid tenantId, Guid actorUserId, Guid implantUsageId, Guid journeyId,
            Guid? itemId, string? catalogRef, string? brand, string? model,
            string? serialNumber, string? batchNumber, string? udiBarcode,
            string usageStatus, string? wastageReason, string? patientName, string? patientIpNo,
            CancellationToken ct = default)
        {
            if (ThrowOnApply)
                throw new InventoryUnavailableException("Inventory unavailable");
            Calls.Add((implantUsageId, usageStatus));
            return Task.FromResult(new InventoryImplantApplyResult(LastLedgerId, false, false));
        }
    }
}
