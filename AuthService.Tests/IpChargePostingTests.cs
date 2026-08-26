using System.Reflection;
using AuthService.Context;
using AuthService.Controllers;
using AuthService.DTOs.Billing;
using AuthService.Models.Domain;
using AuthService.Services;
using AuthService.Services.Interfaces;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging.Abstractions;
using Moq;
using Xunit;

namespace AuthService.Tests;

/// <summary>BILL-032 — atomic catalog-priced batch posting for OT/inventory.</summary>
public class IpChargePostingTests
{
    private static readonly Guid TenantId = Guid.NewGuid();
    private static readonly Guid UserId = Guid.NewGuid();
    private static readonly Guid JourneyId = Guid.NewGuid();

    [Fact]
    public void ChargeItemsRoute_IsInternalPost()
    {
        var method = typeof(InternalIpBillingController).GetMethod(nameof(InternalIpBillingController.ChargeItems));
        Assert.NotNull(method);
        var http = method!.GetCustomAttribute<HttpPostAttribute>();
        Assert.Equal("charge-items", http!.Template);
    }

    [Fact]
    public async Task HappyPath_PostsCatalogPrice_IgnoresCallerCost_AndRaisesObligationChanged()
    {
        var db = new Store();
        var bill = await db.SeedBillAsync(packageAmount: 62000m);
        var variantId = await db.SeedPricedVariantAsync(3200m, "IOL-PREM");
        var sourceRef = Guid.NewGuid();

        var result = await db.Service().ChargeItemsAsync(NewRequest(
            "ImplantUsed:usage-1",
            new ChargeItemLineRequest
            {
                SourceType = BillChargeSource.Implant,
                SourceRefId = sourceRef,
                ServiceVariantId = variantId,
                Quantity = 1,
                UnitPriceOverride = 1m,
                Notes = "purchase rate must not post",
            }));

        Assert.False(result.Replayed);
        Assert.Single(result.Items);
        Assert.Equal(3200m, result.Items[0].UnitPrice);
        Assert.Equal(65200m, result.GrossAmount);
        Assert.Equal(65200m, result.BalanceDue);
        Assert.Contains(BillingCcmsEventTypes.PatientObligationChanged, db.Outbox.Types);

        using var check = db.Reader();
        var item = Assert.Single(await check.OpdBillItems.ToListAsync());
        Assert.Equal(3200m, item.UnitPrice);
        Assert.Equal(BillChargeSource.Implant, item.SourceType);
        Assert.Equal(sourceRef, item.SourceRefId);
        Assert.Equal(65200m, (await check.OpdBills.SingleAsync()).GrossAmount);
        db.Audit.Verify(a => a.StageAsync(
            UserId, "ChargeItemsPosted", "OpdBill", bill.Id,
            It.IsAny<string?>(), It.IsAny<string?>(), It.IsAny<string?>()), Times.Once);
    }

    [Fact]
    public async Task HappyPath_ResolvesByServiceCode()
    {
        var db = new Store();
        await db.SeedBillAsync();
        await db.SeedPricedVariantAsync(1500m, "OT-CHG");

        var result = await db.Service().ChargeItemsAsync(NewRequest(
            "OtCharges:case-1",
            new ChargeItemLineRequest
            {
                SourceType = BillChargeSource.Procedure,
                ServiceCode = "OT-CHG",
                Quantity = 2,
            }));

        Assert.Equal(1500m, result.Items[0].UnitPrice);
        Assert.Equal(2, result.Items[0].Quantity);
        Assert.Equal(3000m, result.Items[0].TotalAmount);
        Assert.Equal(65000m, result.GrossAmount);
    }

    [Fact]
    public async Task DuplicateBatchKey_IsNoOp()
    {
        var db = new Store();
        await db.SeedBillAsync();
        var variantId = await db.SeedPricedVariantAsync(3200m);
        var request = NewRequest(
            "ImplantUsed:dup",
            new ChargeItemLineRequest
            {
                SourceType = BillChargeSource.Implant,
                SourceRefId = Guid.NewGuid(),
                ServiceVariantId = variantId,
            });

        var first = await db.Service().ChargeItemsAsync(request);
        var second = await db.Service().ChargeItemsAsync(request);

        Assert.False(first.Replayed);
        Assert.True(second.Replayed);
        Assert.Equal(first.Items[0].Id, second.Items[0].Id);
        using var check = db.Reader();
        Assert.Equal(1, await check.OpdBillItems.CountAsync());
        Assert.Single(db.Outbox.Types);
        db.Audit.Verify(a => a.StageAsync(
            It.IsAny<Guid>(), "ChargeItemsPosted", "OpdBill", It.IsAny<Guid?>(),
            It.IsAny<string?>(), It.IsAny<string?>(), It.IsAny<string?>()), Times.Once);
    }

    [Fact]
    public async Task UnknownCatalogItem_EnqueuesException_AndPostsNothing()
    {
        var db = new Store();
        await db.SeedBillAsync();

        var ex = await Assert.ThrowsAsync<ChargePostingException>(() =>
            db.Service().ChargeItemsAsync(NewRequest(
                "ImplantUsed:unknown",
                new ChargeItemLineRequest
                {
                    SourceType = BillChargeSource.Implant,
                    SourceRefId = Guid.NewGuid(),
                    ServiceVariantId = Guid.NewGuid(),
                    UnitPriceOverride = 9999m,
                })));

        Assert.Equal(ChargePostingCodes.UnknownCatalogItem, ex.Code);
        using var check = db.Reader();
        Assert.Empty(await check.OpdBillItems.ToListAsync());
        Assert.Equal(62000m, (await check.OpdBills.SingleAsync()).GrossAmount);
        Assert.Single(await check.ChargeExceptions.ToListAsync());
        Assert.Empty(db.Outbox.Types);
    }

    [Fact]
    public async Task FinalizedBill_ReturnsActionableCode()
    {
        var db = new Store();
        var bill = await db.SeedBillAsync();
        bill.IsFinalized = true;
        db.Context.OpdBills.Update(bill);
        await db.Context.SaveChangesAsync();
        var variantId = await db.SeedPricedVariantAsync(3200m);

        var ex = await Assert.ThrowsAsync<ChargePostingException>(() =>
            db.Service().ChargeItemsAsync(NewRequest(
                "ImplantUsed:final",
                new ChargeItemLineRequest
                {
                    SourceType = BillChargeSource.Implant,
                    SourceRefId = Guid.NewGuid(),
                    ServiceVariantId = variantId,
                })));

        Assert.Equal(ChargePostingCodes.BillFinalized, ex.Code);
        Assert.Equal(bill.Id, ex.BillId);
        using var check = db.Reader();
        Assert.Empty(await check.OpdBillItems.ToListAsync());
    }

    [Fact]
    public async Task LockedBill_ReturnsActionableCode()
    {
        var db = new Store();
        var bill = await db.SeedBillAsync();
        bill.IsLocked = true;
        db.Context.OpdBills.Update(bill);
        await db.Context.SaveChangesAsync();
        var variantId = await db.SeedPricedVariantAsync(3200m);

        var ex = await Assert.ThrowsAsync<ChargePostingException>(() =>
            db.Service().ChargeItemsAsync(NewRequest(
                "ImplantUsed:locked",
                new ChargeItemLineRequest
                {
                    SourceType = BillChargeSource.Implant,
                    SourceRefId = Guid.NewGuid(),
                    ServiceVariantId = variantId,
                })));

        Assert.Equal(ChargePostingCodes.BillLocked, ex.Code);
    }

    [Fact]
    public async Task CancelledBill_ReturnsActionableCode_NotBillNotFound()
    {
        var db = new Store();
        var bill = await db.SeedBillAsync();
        bill.Status = "cancelled";
        bill.DeletedAt = DateTime.UtcNow;
        db.Context.OpdBills.Update(bill);
        await db.Context.SaveChangesAsync();
        var variantId = await db.SeedPricedVariantAsync(3200m);

        var ex = await Assert.ThrowsAsync<ChargePostingException>(() =>
            db.Service().ChargeItemsAsync(NewRequest(
                "ImplantUsed:cancelled",
                new ChargeItemLineRequest
                {
                    SourceType = BillChargeSource.Implant,
                    SourceRefId = Guid.NewGuid(),
                    ServiceVariantId = variantId,
                })));

        Assert.Equal(ChargePostingCodes.BillCancelled, ex.Code);
        Assert.Equal(bill.Id, ex.BillId);
        using var check = db.Reader();
        Assert.Empty(await check.OpdBillItems.ToListAsync());
    }

    [Fact]
    public async Task PartialFailure_RollsBackTheWholeBatch()
    {
        var db = new Store();
        await db.SeedBillAsync();
        var priced = await db.SeedPricedVariantAsync(3200m);

        var ex = await Assert.ThrowsAsync<ChargePostingException>(() =>
            db.Service().ChargeItemsAsync(NewRequest(
                "OtBatch:partial",
                new ChargeItemLineRequest
                {
                    SourceType = BillChargeSource.Implant,
                    SourceRefId = Guid.NewGuid(),
                    ServiceVariantId = priced,
                },
                new ChargeItemLineRequest
                {
                    SourceType = BillChargeSource.Consumable,
                    SourceRefId = Guid.NewGuid(),
                    ServiceVariantId = Guid.NewGuid(),
                })));

        Assert.Equal(ChargePostingCodes.UnknownCatalogItem, ex.Code);
        using var check = db.Reader();
        Assert.Empty(await check.OpdBillItems.ToListAsync());
        Assert.Equal(62000m, (await check.OpdBills.SingleAsync()).GrossAmount);
        Assert.Single(await check.ChargeExceptions.ToListAsync());
        Assert.Empty(db.Outbox.Types);
    }

    [Fact]
    public async Task CreditLine_PostsNegativeCatalogPrice_AndDoesNotDelete()
    {
        var db = new Store();
        await db.SeedBillAsync();
        var variantId = await db.SeedPricedVariantAsync(3200m);
        var usageId = Guid.NewGuid();

        await db.Service().ChargeItemsAsync(NewRequest(
            $"ImplantUsed:{usageId:N}",
            new ChargeItemLineRequest
            {
                SourceType = BillChargeSource.Implant,
                SourceRefId = usageId,
                ServiceVariantId = variantId,
            }));

        var credit = await db.Service().ChargeItemsAsync(NewRequest(
            $"ImplantUsageReversed:{usageId:N}",
            new ChargeItemLineRequest
            {
                SourceType = BillChargeSource.Implant,
                SourceRefId = usageId,
                ServiceVariantId = variantId,
                IsCredit = true,
            }));

        Assert.Equal(-3200m, credit.Items[0].UnitPrice);
        Assert.Equal(62000m, credit.GrossAmount);
        using var check = db.Reader();
        Assert.Equal(2, await check.OpdBillItems.CountAsync());
        Assert.All(await check.OpdBillItems.ToListAsync(), i => Assert.Null(i.DeletedAt));
    }

    [Fact]
    public async Task ResolvesByItemId_ThroughCatalogMap()
    {
        var db = new Store();
        await db.SeedBillAsync();
        var variantId = await db.SeedPricedVariantAsync(14000m);
        var itemId = Guid.NewGuid();
        db.Context.ServiceVariantItemMaps.Add(new ServiceVariantItemMap
        {
            Id = Guid.NewGuid(),
            TenantId = TenantId,
            ItemId = itemId,
            ServiceVariantId = variantId,
            IsChargeable = true,
            EffectiveFrom = DateTime.UtcNow.AddDays(-1),
            CreatedAt = DateTime.UtcNow,
        });
        await db.Context.SaveChangesAsync();

        var result = await db.Service().ChargeItemsAsync(NewRequest(
            "ImplantUsed:item-map",
            new ChargeItemLineRequest
            {
                SourceType = BillChargeSource.Implant,
                SourceRefId = Guid.NewGuid(),
                ItemId = itemId,
                UnitPriceOverride = 1m,
            }));

        Assert.Equal(14000m, result.Items[0].UnitPrice);
        Assert.Equal(76000m, result.GrossAmount);
    }

    [Fact]
    public async Task UnmappedItemId_FallsThroughToServiceCode()
    {
        var db = new Store();
        await db.SeedBillAsync();
        await db.SeedPricedVariantAsync(14000m, "IOL-CAT");

        var result = await db.Service().ChargeItemsAsync(NewRequest(
            "ImplantUsed:code-fallback",
            new ChargeItemLineRequest
            {
                SourceType = BillChargeSource.Implant,
                SourceRefId = Guid.NewGuid(),
                ItemId = Guid.NewGuid(),
                ServiceCode = "IOL-CAT",
            }));

        Assert.Equal(14000m, result.Items[0].UnitPrice);
        Assert.Equal(76000m, result.GrossAmount);
        Assert.Equal(0, result.ExceptionCount);
    }

    [Fact]
    public async Task ConsumableHappyPath_PostsCatalogPrice_IgnoresPurchaseRate()
    {
        var db = new Store();
        await db.SeedBillAsync();
        var variantId = await db.SeedPricedVariantAsync(450m);
        var itemId = Guid.NewGuid();
        var consumableId = Guid.NewGuid();
        await db.SeedItemMapAsync(itemId, variantId);
        await db.SeedConsumableAsync(consumableId, itemId);

        var result = await db.Service().ChargeItemsAsync(NewRequest(
            $"ConsumablesConsumed:{consumableId:N}",
            new ChargeItemLineRequest
            {
                SourceType = BillChargeSource.Consumable,
                SourceRefId = consumableId,
                ItemId = itemId,
                Quantity = 2,
                UnitPriceOverride = 1m,
            }));

        Assert.False(result.Replayed);
        Assert.Equal(0, result.ExceptionCount);
        Assert.Equal(0, result.SuppressedCount);
        Assert.Equal(450m, result.Items[0].UnitPrice);
        Assert.Equal(2, result.Items[0].Quantity);
        Assert.Equal(900m, result.Items[0].TotalAmount);
        using var check = db.Reader();
        Assert.Equal("Posted", (await check.InvSurgeryConsumableReads.SingleAsync()).ChargeStatus);
        Assert.Equal(result.Items[0].Id, (await check.InvSurgeryConsumableReads.SingleAsync()).ChargeItemId);
        Assert.Equal(BillChargeSource.Consumable, (await check.OpdBillItems.SingleAsync()).SourceType);
    }

    [Fact]
    public async Task ConsumableUnmapped_EnqueuesException_PostsNothing_DoesNotThrow()
    {
        var db = new Store();
        await db.SeedBillAsync();
        var consumableId = Guid.NewGuid();
        var itemId = Guid.NewGuid();
        await db.SeedConsumableAsync(consumableId, itemId);

        var result = await db.Service().ChargeItemsAsync(NewRequest(
            $"ConsumablesConsumed:{consumableId:N}",
            new ChargeItemLineRequest
            {
                SourceType = BillChargeSource.Consumable,
                SourceRefId = consumableId,
                ItemId = itemId,
                UnitPriceOverride = 9999m,
            }));

        Assert.Equal(1, result.ExceptionCount);
        Assert.Empty(result.Items);
        using var check = db.Reader();
        Assert.Empty(await check.OpdBillItems.ToListAsync());
        Assert.Equal(62000m, (await check.OpdBills.SingleAsync()).GrossAmount);
        Assert.Single(await check.ChargeExceptions.ToListAsync());
        Assert.Equal("Exception", (await check.InvSurgeryConsumableReads.SingleAsync()).ChargeStatus);
        Assert.Empty(db.Outbox.Types);
    }

    [Fact]
    public async Task ConsumablePackageOverlap_IsSuppressed_NotDoubleCharged()
    {
        var db = new Store();
        var bill = await db.SeedBillAsync();
        var variantId = await db.SeedPricedVariantAsync(450m);
        var itemId = Guid.NewGuid();
        var consumableId = Guid.NewGuid();
        await db.SeedItemMapAsync(itemId, variantId);
        await db.SeedConsumableAsync(consumableId, itemId);
        db.Context.OpdBillItems.Add(new OpdBillItem
        {
            Id = Guid.NewGuid(),
            TenantId = TenantId,
            OpdBillId = bill.Id,
            ServiceVariantId = variantId,
            ServiceName = "Package visc",
            Quantity = 1,
            UnitPrice = 0,
            SourceType = BillChargeSource.Package,
            CreatedByUserId = UserId,
            CreatedAt = DateTime.UtcNow,
        });
        await db.Context.SaveChangesAsync();
        db.Context.ChangeTracker.Clear();

        var result = await db.Service().ChargeItemsAsync(NewRequest(
            $"ConsumablesConsumed:{consumableId:N}",
            new ChargeItemLineRequest
            {
                SourceType = BillChargeSource.Consumable,
                SourceRefId = consumableId,
                ItemId = itemId,
            }));

        Assert.Equal(1, result.SuppressedCount);
        Assert.Empty(result.Items);
        using var check = db.Reader();
        Assert.Equal(1, await check.OpdBillItems.CountAsync());
        Assert.Equal(BillChargeSource.Package, (await check.OpdBillItems.SingleAsync()).SourceType);
        Assert.Empty(await check.ChargeExceptions.ToListAsync());
        Assert.Equal("Suppressed", (await check.InvSurgeryConsumableReads.SingleAsync()).ChargeStatus);
        Assert.Empty(db.Outbox.Types);
    }

    [Fact]
    public async Task ConsumableNonChargeable_IsSuppressed()
    {
        var db = new Store();
        await db.SeedBillAsync();
        var variantId = await db.SeedPricedVariantAsync(450m);
        var itemId = Guid.NewGuid();
        var consumableId = Guid.NewGuid();
        await db.SeedItemMapAsync(itemId, variantId, chargeable: false);
        await db.SeedConsumableAsync(consumableId, itemId);

        var result = await db.Service().ChargeItemsAsync(NewRequest(
            $"ConsumablesConsumed:{consumableId:N}",
            new ChargeItemLineRequest
            {
                SourceType = BillChargeSource.Consumable,
                SourceRefId = consumableId,
                ItemId = itemId,
            }));

        Assert.Equal(1, result.SuppressedCount);
        Assert.Empty(result.Items);
        using var check = db.Reader();
        Assert.Empty(await check.OpdBillItems.ToListAsync());
        Assert.Empty(await check.ChargeExceptions.ToListAsync());
        Assert.Equal("Suppressed", (await check.InvSurgeryConsumableReads.SingleAsync()).ChargeStatus);
    }

    [Fact]
    public void ChargeExceptionRoute_IsInternalPost()
    {
        var method = typeof(InternalIpBillingController).GetMethod(nameof(InternalIpBillingController.EnqueueChargeException));
        Assert.NotNull(method);
        var http = method!.GetCustomAttribute<HttpPostAttribute>();
        Assert.Equal("charge-exception", http!.Template);
    }

    [Fact]
    public async Task ConsumableDuplicateBatch_IsNoOp()
    {
        var db = new Store();
        await db.SeedBillAsync();
        var variantId = await db.SeedPricedVariantAsync(450m);
        var itemId = Guid.NewGuid();
        var consumableId = Guid.NewGuid();
        await db.SeedItemMapAsync(itemId, variantId);
        var request = NewRequest(
            $"ConsumablesConsumed:{consumableId:N}",
            new ChargeItemLineRequest
            {
                SourceType = BillChargeSource.Consumable,
                SourceRefId = consumableId,
                ItemId = itemId,
            });

        var first = await db.Service().ChargeItemsAsync(request);
        var second = await db.Service().ChargeItemsAsync(request);

        Assert.False(first.Replayed);
        Assert.True(second.Replayed);
        using var check = db.Reader();
        Assert.Equal(1, await check.OpdBillItems.CountAsync());
        Assert.Single(db.Outbox.Types);
    }

    [Fact]
    public async Task ConsumableCredit_PostsNegativeCatalogPrice_AndDoesNotDeleteDebit()
    {
        var db = new Store();
        await db.SeedBillAsync();
        var variantId = await db.SeedPricedVariantAsync(450m);
        var itemId = Guid.NewGuid();
        var consumableId = Guid.NewGuid();
        await db.SeedItemMapAsync(itemId, variantId);
        await db.SeedConsumableAsync(consumableId, itemId);

        await db.Service().ChargeItemsAsync(NewRequest(
            $"ConsumablesConsumed:{consumableId:N}",
            new ChargeItemLineRequest
            {
                SourceType = BillChargeSource.Consumable,
                SourceRefId = consumableId,
                ItemId = itemId,
                Quantity = 2,
            }));

        var credit = await db.Service().ChargeItemsAsync(NewRequest(
            $"ConsumablesReturned:{consumableId:N}:return",
            new ChargeItemLineRequest
            {
                SourceType = BillChargeSource.Consumable,
                SourceRefId = consumableId,
                ItemId = itemId,
                Quantity = 2,
                IsCredit = true,
            }));

        Assert.Equal(-450m, credit.Items[0].UnitPrice);
        Assert.Equal(62000m, credit.GrossAmount);
        using var check = db.Reader();
        var items = await check.OpdBillItems.ToListAsync();
        Assert.Equal(2, items.Count);
        Assert.All(items, i => Assert.Null(i.DeletedAt));
        Assert.Contains(items, i => i.UnitPrice == 450m && i.Quantity == 2);
        Assert.Contains(items, i => i.UnitPrice == -450m && i.Quantity == 2);
        Assert.Equal("Credited", (await check.InvSurgeryConsumableReads.SingleAsync()).ChargeStatus);
    }

    [Fact]
    public async Task ConsumableCredit_PostsEvenWhenPackageOverlapsVariant()
    {
        var db = new Store();
        var bill = await db.SeedBillAsync();
        var variantId = await db.SeedPricedVariantAsync(450m);
        var itemId = Guid.NewGuid();
        var consumableId = Guid.NewGuid();
        await db.SeedItemMapAsync(itemId, variantId);
        await db.SeedConsumableAsync(consumableId, itemId);

        await db.Service().ChargeItemsAsync(NewRequest(
            $"ConsumablesConsumed:{consumableId:N}",
            new ChargeItemLineRequest
            {
                SourceType = BillChargeSource.Consumable,
                SourceRefId = consumableId,
                ItemId = itemId,
            }));

        db.Context.OpdBillItems.Add(new OpdBillItem
        {
            Id = Guid.NewGuid(),
            TenantId = TenantId,
            OpdBillId = bill.Id,
            ServiceVariantId = variantId,
            ServiceName = "Package visc",
            Quantity = 1,
            UnitPrice = 0,
            SourceType = BillChargeSource.Package,
            CreatedByUserId = UserId,
            CreatedAt = DateTime.UtcNow,
        });
        await db.Context.SaveChangesAsync();
        db.Context.ChangeTracker.Clear();

        var credit = await db.Service().ChargeItemsAsync(NewRequest(
            $"ConsumablesReturned:{consumableId:N}:return",
            new ChargeItemLineRequest
            {
                SourceType = BillChargeSource.Consumable,
                SourceRefId = consumableId,
                ItemId = itemId,
                IsCredit = true,
            }));

        Assert.Equal(0, credit.SuppressedCount);
        Assert.Equal(-450m, credit.Items[0].UnitPrice);
        using var check = db.Reader();
        Assert.Equal(3, await check.OpdBillItems.CountAsync());
        Assert.Equal("Credited", (await check.InvSurgeryConsumableReads.SingleAsync()).ChargeStatus);
    }

    [Fact]
    public async Task ConsumableCancelledPending_SuppressesDebit()
    {
        var db = new Store();
        await db.SeedBillAsync();
        var variantId = await db.SeedPricedVariantAsync(450m);
        var itemId = Guid.NewGuid();
        var consumableId = Guid.NewGuid();
        await db.SeedItemMapAsync(itemId, variantId);
        await db.SeedConsumableAsync(consumableId, itemId, chargeStatus: "Pending",
            consumableStatus: "Cancelled", deletedAt: DateTime.UtcNow);

        var result = await db.Service().ChargeItemsAsync(NewRequest(
            $"ConsumablesConsumed:{consumableId:N}",
            new ChargeItemLineRequest
            {
                SourceType = BillChargeSource.Consumable,
                SourceRefId = consumableId,
                ItemId = itemId,
            }));

        Assert.Equal(1, result.SuppressedCount);
        Assert.Empty(result.Items);
        using var check = db.Reader();
        Assert.Empty(await check.OpdBillItems.ToListAsync());
        Assert.Equal("Suppressed", (await check.InvSurgeryConsumableReads.SingleAsync()).ChargeStatus);
    }

    [Fact]
    public async Task ConsumableReturnPostedPending_SuppressesDebit()
    {
        var db = new Store();
        await db.SeedBillAsync();
        var variantId = await db.SeedPricedVariantAsync(450m);
        var itemId = Guid.NewGuid();
        var consumableId = Guid.NewGuid();
        await db.SeedItemMapAsync(itemId, variantId);
        await db.SeedConsumableAsync(consumableId, itemId, chargeStatus: "Pending",
            consumableStatus: "ReturnPosted");

        var result = await db.Service().ChargeItemsAsync(NewRequest(
            $"ConsumablesConsumed:{consumableId:N}",
            new ChargeItemLineRequest
            {
                SourceType = BillChargeSource.Consumable,
                SourceRefId = consumableId,
                ItemId = itemId,
            }));

        Assert.Equal(1, result.SuppressedCount);
        Assert.Empty(result.Items);
        using var check = db.Reader();
        Assert.Empty(await check.OpdBillItems.ToListAsync());
        Assert.Equal("Suppressed", (await check.InvSurgeryConsumableReads.SingleAsync()).ChargeStatus);
    }

    [Fact]
    public async Task Controller_MapsFinalizedTo409WithCode()
    {
        var bills = new Mock<IOpdBillService>();
        bills.Setup(b => b.ChargeItemsAsync(It.IsAny<ChargeItemsRequest>()))
            .ThrowsAsync(new ChargePostingException(
                ChargePostingCodes.BillFinalized,
                "Bill is finalized; queue a post-finalize correction.",
                Guid.NewGuid()));

        var config = new Mock<Microsoft.Extensions.Configuration.IConfiguration>();
        config.Setup(c => c["InternalApi:Key"]).Returns("test-key");
        var controller = new InternalIpBillingController(
            bills.Object,
            config.Object,
            NullLogger<InternalIpBillingController>.Instance);
        controller.ControllerContext = new ControllerContext
        {
            HttpContext = new DefaultHttpContext(),
        };
        controller.Request.Headers["X-Internal-Key"] = "test-key";

        var result = await controller.ChargeItems(NewRequest("k", new ChargeItemLineRequest { ServiceCode = "X" }));

        var conflict = Assert.IsType<ConflictObjectResult>(result);
        Assert.Equal(409, conflict.StatusCode);
        var json = System.Text.Json.JsonSerializer.Serialize(conflict.Value);
        Assert.Contains(ChargePostingCodes.BillFinalized, json);
    }

    private static ChargeItemsRequest NewRequest(string key, params ChargeItemLineRequest[] lines) => new()
    {
        TenantId = TenantId,
        PatientJourneyId = JourneyId,
        ActorUserId = UserId,
        IdempotencyKey = key,
        Lines = [.. lines],
    };

    private sealed class RecordingOutbox : IBillingCcmsOutboxService
    {
        public List<string> Types { get; } = [];
        public void Enqueue(Guid tenantId, string eventType, Guid billId, object payload, string idempotencyKey)
            => Types.Add(eventType);
        public Task EnsureSchemaAsync(CancellationToken ct = default) => Task.CompletedTask;
        public Task<int> ProcessPendingAsync(int batchSize = 25, CancellationToken ct = default) => Task.FromResult(0);
    }

    private sealed class Store
    {
        private readonly string _name = Guid.NewGuid().ToString();
        private readonly IHttpContextAccessor _http;

        public Store()
        {
            var accessor = new Mock<IHttpContextAccessor>();
            var http = new DefaultHttpContext();
            http.Items["TenantId"] = TenantId;
            accessor.Setup(a => a.HttpContext).Returns(http);
            _http = accessor.Object;
            Context = NewContext();
            Outbox = new RecordingOutbox();
            Audit = new Mock<IAuditService>();
            Audit.Setup(a => a.StageAsync(
                    It.IsAny<Guid>(), It.IsAny<string>(), It.IsAny<string>(), It.IsAny<Guid?>(),
                    It.IsAny<string?>(), It.IsAny<string?>(), It.IsAny<string?>()))
                .Returns(Task.CompletedTask);
        }

        public AppDbContext Context { get; }
        public RecordingOutbox Outbox { get; }
        public Mock<IAuditService> Audit { get; }

        public AppDbContext Reader() => NewContext();

        private AppDbContext NewContext() => new(
            new DbContextOptionsBuilder<AppDbContext>().UseInMemoryDatabase(_name).Options,
            _http);

        public OpdBillService Service()
        {
            var ctx = Context;
            return new OpdBillService(
                ctx,
                NullLogger<OpdBillService>.Instance,
                Outbox,
                notifications: null,
                audit: Audit.Object,
                http: _http,
                billItems: new BillItemService(ctx, NullLogger<BillItemService>.Instance),
                catalog: new ChargeCatalogResolver(ctx));
        }

        public async Task<OpdBill> SeedBillAsync(decimal packageAmount = 62000m)
        {
            var bill = new OpdBill
            {
                Id = Guid.NewGuid(),
                TenantId = TenantId,
                BillNumber = "IP-BILL-032-0001",
                PatientId = Guid.NewGuid(),
                PatientJourneyId = JourneyId,
                BranchId = Guid.NewGuid(),
                BillDate = DateTime.UtcNow,
                AdditionalCharges = packageAmount,
                GrossAmount = packageAmount,
                NetAmount = packageAmount,
                BalanceDue = packageAmount,
                Status = "generated",
                GeneratedBy = UserId,
                CreatedByUserId = UserId,
                CreatedAt = DateTime.UtcNow,
                RowVersion = 1,
            };
            Context.OpdBills.Add(bill);
            await Context.SaveChangesAsync();
            Context.ChangeTracker.Clear();
            return bill;
        }

        public async Task<Guid> SeedPricedVariantAsync(decimal amount, string? code = null)
        {
            var id = Guid.NewGuid();
            Context.ServiceVariants.Add(new ServiceVariant
            {
                Id = id,
                CatalogServiceId = Guid.NewGuid(),
                VariantName = "Test variant",
                VariantCode = code ?? "SV-" + id.ToString("N")[..6],
                IsActive = true,
            });
            Context.VariantPrices.Add(new VariantPrice
            {
                Id = Guid.NewGuid(),
                VariantId = id,
                Amount = amount,
                IsActive = true,
                EffectiveFrom = DateOnly.FromDateTime(DateTime.UtcNow),
            });
            await Context.SaveChangesAsync();
            return id;
        }

        public async Task SeedItemMapAsync(Guid itemId, Guid variantId, bool chargeable = true)
        {
            Context.ServiceVariantItemMaps.Add(new ServiceVariantItemMap
            {
                Id = Guid.NewGuid(),
                TenantId = TenantId,
                ItemId = itemId,
                ServiceVariantId = variantId,
                IsChargeable = chargeable,
                NonChargeableReason = chargeable ? null : "Included in package",
                EffectiveFrom = DateTime.UtcNow.AddDays(-1),
                CreatedAt = DateTime.UtcNow,
            });
            await Context.SaveChangesAsync();
        }

        public async Task SeedConsumableAsync(
            Guid consumableId,
            Guid itemId,
            string chargeStatus = "Pending",
            string? consumableStatus = "IssuedInOT",
            DateTime? deletedAt = null)
        {
            Context.InvSurgeryConsumableReads.Add(new InvSurgeryConsumableRead
            {
                Id = consumableId,
                TenantId = TenantId,
                JourneyId = JourneyId,
                ItemId = itemId,
                Quantity = 1,
                Amount = 1,
                ChargeStatus = chargeStatus,
                ConsumableStatus = consumableStatus,
                IssuedAt = DateTime.UtcNow,
                DeletedAt = deletedAt,
            });
            await Context.SaveChangesAsync();
        }
    }
}
