using System.Linq;
using System.Reflection;
using AuthService.Authorization;
using AuthService.Context;
using AuthService.Controllers;
using AuthService.DTOs.Billing;
using AuthService.Models.Domain;
using AuthService.Services;
using Microsoft.AspNetCore.Http;
using Microsoft.EntityFrameworkCore;
using Moq;
using Xunit;

namespace AuthService.Tests;

public class ChargeReconciliationTests
{
    private static readonly Guid TenantId = Guid.NewGuid();
    private static readonly Guid JourneyId = Guid.NewGuid();
    private static readonly Guid PatientId = Guid.NewGuid();
    private static readonly Guid UserId = Guid.NewGuid();

    [Fact]
    public void Routes_RequireBillView()
    {
        foreach (var name in new[]
        {
            nameof(ChargeReconciliationController.Get),
            nameof(ChargeReconciliationController.Run),
            nameof(ChargeReconciliationController.Wastage),
            nameof(ChargeReconciliationController.Completeness),
        })
        {
            var method = typeof(ChargeReconciliationController).GetMethod(name);
            Assert.NotNull(method);
            var attr = method!.GetCustomAttribute<RequirePermissionAttribute>();
            Assert.Equal("bill.view", attr!.PermissionCode);
        }
    }

    [Fact]
    public async Task Bucket1_ImplantedNotCharged()
    {
        var db = new Store();
        var itemId = Guid.NewGuid();
        await db.SeedPatientAsync();
        await db.SeedBillAsync();
        var variantId = await db.SeedPricedVariantAsync(14000m);
        await db.SeedItemMapAsync(itemId, variantId);
        await db.SeedUsageAsync(itemId, "Implanted", "Pending", serial: "88213");

        var report = await db.Service().GetReportAsync(TenantId, DateTime.UtcNow.AddDays(-1), DateTime.UtcNow.AddDays(1));
        var bucket = report.Buckets.Single(b => b.Number == 1);
        Assert.Equal(1, bucket.Count);
        Assert.Equal(14000m, bucket.Value);
        Assert.Equal("Outbox not yet posted", Assert.Single(report.ImplantedNotCharged).Reason);
        Assert.Empty(report.ChargedNotImplanted);
    }

    [Fact]
    public async Task Bucket2_ChargedNotImplanted()
    {
        var db = new Store();
        await db.SeedPatientAsync();
        var bill = await db.SeedBillAsync();
        var variantId = await db.SeedPricedVariantAsync(3200m);
        db.Context.OpdBillItems.Add(Line(bill.Id, BillChargeSource.Implant, variantId, 3200m, Guid.NewGuid(), "Alcon SN60WF"));
        await db.Context.SaveChangesAsync();

        var report = await db.Service().GetReportAsync(TenantId, DateTime.UtcNow.AddDays(-1), DateTime.UtcNow.AddDays(1));
        Assert.Equal(1, report.Buckets.Single(b => b.Number == 2).Count);
        Assert.Equal("None found", Assert.Single(report.ChargedNotImplanted).Reason);
        Assert.Empty(report.ImplantedNotCharged);
    }

    [Fact]
    public async Task Bucket3_StockOutWithoutUsage()
    {
        var db = new Store();
        var itemId = Guid.NewGuid();
        db.Context.InvItemMasterReads.Add(new InvItemMasterRead
        {
            Id = itemId, TenantId = TenantId, ItemName = "Trypan blue", ItemType = "Consumable", Status = "active",
        });
        db.Context.InvStockLedgerReads.Add(new InvStockLedgerRead
        {
            Id = Guid.NewGuid(),
            TenantId = TenantId,
            StoreId = Guid.NewGuid(),
            ItemId = itemId,
            TransactionType = "OT_ISSUE",
            QuantityOut = 1,
            UnitRate = 50,
            CreatedAt = DateTime.UtcNow,
            TransactionDate = DateTime.UtcNow.Date,
        });
        await db.Context.SaveChangesAsync();

        var report = await db.Service().GetReportAsync(TenantId, DateTime.UtcNow.AddDays(-1), DateTime.UtcNow.AddDays(1));
        Assert.Equal(1, report.Buckets.Single(b => b.Number == 3).Count);
        Assert.Contains("no clinical usage", Assert.Single(report.StockOutNoUsage).Reason);
    }

    [Fact]
    public async Task Bucket3_IgnoresStoreTransfers()
    {
        var db = new Store();
        var itemId = Guid.NewGuid();
        db.Context.InvStockLedgerReads.Add(new InvStockLedgerRead
        {
            Id = Guid.NewGuid(),
            TenantId = TenantId,
            StoreId = Guid.NewGuid(),
            ItemId = itemId,
            TransactionType = "TRANSFER_OUT",
            QuantityOut = 1,
            CreatedAt = DateTime.UtcNow,
            TransactionDate = DateTime.UtcNow.Date,
        });
        await db.Context.SaveChangesAsync();

        var report = await db.Service().GetReportAsync(TenantId, DateTime.UtcNow.AddDays(-1), DateTime.UtcNow.AddDays(1));
        Assert.Equal(0, report.Buckets.Single(b => b.Number == 3).Count);
    }

    [Fact]
    public async Task Bucket4_PackageConsumableOverlap()
    {
        var db = new Store();
        await db.SeedPatientAsync();
        var bill = await db.SeedBillAsync();
        var variantId = await db.SeedPricedVariantAsync(1200m);
        db.Context.OpdBillItems.Add(Line(bill.Id, BillChargeSource.Package, variantId, 0, null, "Viscoelastic in package"));
        db.Context.OpdBillItems.Add(Line(bill.Id, BillChargeSource.Consumable, variantId, 1200m, Guid.NewGuid(), "Viscoelastic (OVD)"));
        await db.Context.SaveChangesAsync();

        var report = await db.Service().GetReportAsync(TenantId, DateTime.UtcNow.AddDays(-1), DateTime.UtcNow.AddDays(1));
        var bucket = report.Buckets.Single(b => b.Number == 4);
        Assert.Equal(1, bucket.Count);
        Assert.Equal(1200m, bucket.Value);
    }

    [Fact]
    public async Task Bucket5_UnmappedExceptions()
    {
        var db = new Store();
        var itemId = Guid.NewGuid();
        db.Context.InvItemMasterReads.Add(new InvItemMasterRead
        {
            Id = itemId, TenantId = TenantId, ItemName = "PanOptix", ItemType = "IOL", Status = "active",
        });
        db.Context.ChargeExceptions.Add(new ChargeException
        {
            Id = Guid.NewGuid(),
            TenantId = TenantId,
            ItemId = itemId,
            SourceType = "Implant",
            Quantity = 1,
            EstimatedValue = 18000,
            Status = ChargeExceptionStatus.Open,
            Reason = "No catalog mapping",
            CreatedAt = DateTime.UtcNow,
        });
        await db.Context.SaveChangesAsync();

        var report = await db.Service().GetReportAsync(TenantId, DateTime.UtcNow.AddDays(-1), DateTime.UtcNow.AddDays(1));
        Assert.Equal(1, report.Buckets.Single(b => b.Number == 5).Count);
        Assert.Equal(18000m, report.Buckets.Single(b => b.Number == 5).Value);
    }

    [Fact]
    public async Task Wastage_TotalsMatchLedgerWhenSeededTogether()
    {
        var db = new Store();
        var itemId = Guid.NewGuid();
        var ledgerId = Guid.NewGuid();
        await db.SeedPatientAsync();
        db.Context.InvItemMasterReads.Add(new InvItemMasterRead
        {
            Id = itemId, TenantId = TenantId, ItemName = "SN60WF", ItemType = "IOL", Status = "active",
        });
        db.Context.InvStockLedgerReads.Add(new InvStockLedgerRead
        {
            Id = ledgerId,
            TenantId = TenantId,
            StoreId = Guid.NewGuid(),
            ItemId = itemId,
            TransactionType = "IMPLANT_WASTE",
            QuantityOut = 1,
            UnitRate = 14000,
            TotalValue = 14000,
            CreatedAt = DateTime.UtcNow,
            TransactionDate = DateTime.UtcNow.Date,
        });
        await db.SeedUsageAsync(itemId, "Opened_Unused", "Suppressed",
            serial: "88214", reason: "Wrong power", inventoryTxnId: ledgerId);
        await db.Context.SaveChangesAsync();

        var wastage = await db.Service().GetWastageAsync(TenantId, DateTime.UtcNow.AddDays(-1), DateTime.UtcNow.AddDays(1));
        Assert.Equal(14000m, wastage.UsageTotalCost);
        Assert.Equal(14000m, wastage.LedgerTotalCost);
        Assert.Equal(0m, wastage.Delta);
        Assert.True(Assert.Single(wastage.Lines).HasLedgerMatch);
        Assert.Equal("Wrong power", wastage.ByReason.Single().Key);
    }

    [Fact]
    public async Task Completeness_WarnsWhenImplantChargeMissing()
    {
        var db = new Store();
        await db.SeedPatientAsync();
        var bill = await db.SeedBillAsync();
        await db.SeedUsageAsync(Guid.NewGuid(), "Implanted", "Pending");
        await db.SeedUsageAsync(Guid.NewGuid(), "Implanted", "Posted");

        var dto = await db.Service().GetCompletenessAsync(TenantId, bill.Id, null);
        Assert.Equal(2, dto.ImplantsRecorded);
        Assert.Equal(1, dto.ImplantsCharged);
        Assert.Equal(1, dto.ImplantsMissingCharge);
        Assert.Contains("2 implants recorded, 1 charge missing", dto.Warnings);
    }

    [Fact]
    public async Task Completeness_CoveredImplant_CountsAsCharged()
    {
        var db = new Store();
        await db.SeedPatientAsync();
        var bill = await db.SeedBillAsync();
        await db.SeedUsageAsync(Guid.NewGuid(), "Implanted", "Covered");
        await db.SeedUsageAsync(Guid.NewGuid(), "Implanted", "Posted");

        var dto = await db.Service().GetCompletenessAsync(TenantId, bill.Id, null);
        Assert.Equal(2, dto.ImplantsRecorded);
        Assert.Equal(2, dto.ImplantsCharged);
        Assert.Equal(0, dto.ImplantsMissingCharge);
        Assert.Empty(dto.Warnings);
    }

    [Fact]
    public async Task Completeness_CreditedImplant_CountsAsCharged()
    {
        var db = new Store();
        await db.SeedPatientAsync();
        var bill = await db.SeedBillAsync();
        await db.SeedUsageAsync(Guid.NewGuid(), "Implanted", "Credited");

        var dto = await db.Service().GetCompletenessAsync(TenantId, bill.Id, null);
        Assert.Equal(1, dto.ImplantsRecorded);
        Assert.Equal(1, dto.ImplantsCharged);
        Assert.Equal(0, dto.ImplantsMissingCharge);
        Assert.Empty(dto.Warnings);
    }

    [Fact]
    public async Task Completeness_UnmappedJourneyConsumable_IsPending()
    {
        var db = new Store();
        await db.SeedPatientAsync();
        var bill = await db.SeedBillAsync();
        await db.SeedConsumableAsync(Guid.NewGuid(), 1, "UnmappedJourney");

        var dto = await db.Service().GetCompletenessAsync(TenantId, bill.Id, null);
        Assert.Equal(1, dto.ConsumablesPending);
        Assert.Contains(dto.Warnings, w => w.Contains("consumable", StringComparison.OrdinalIgnoreCase));
    }

    [Fact]
    public async Task Completeness_OpenException_IsWarned()
    {
        var db = new Store();
        await db.SeedPatientAsync();
        var bill = await db.SeedBillAsync();
        db.Context.ChargeExceptions.Add(new ChargeException
        {
            Id = Guid.NewGuid(),
            TenantId = TenantId,
            PatientJourneyId = JourneyId,
            OpdBillId = bill.Id,
            SourceType = "Consumable",
            Status = ChargeExceptionStatus.Open,
            Reason = "No catalog mapping",
            CreatedAt = DateTime.UtcNow,
        });
        await db.Context.SaveChangesAsync();

        var dto = await db.Service().GetCompletenessAsync(TenantId, bill.Id, null);
        Assert.Equal(1, dto.ExceptionsOpen);
        Assert.Contains(dto.Warnings, w => w.Contains("exception", StringComparison.OrdinalIgnoreCase));
    }

    [Fact]
    public async Task Completeness_DoesNotDoubleCountExceptionUsageAndTableRow()
    {
        var db = new Store();
        await db.SeedPatientAsync();
        var bill = await db.SeedBillAsync();
        var itemId = Guid.NewGuid();
        await db.SeedUsageAsync(itemId, "Implanted", "Exception");
        var usageId = db.Context.JourneyImplantUsageReads.Single().Id;
        db.Context.ChargeExceptions.Add(new ChargeException
        {
            Id = Guid.NewGuid(),
            TenantId = TenantId,
            PatientJourneyId = JourneyId,
            ItemId = itemId,
            SourceRefId = usageId,
            SourceType = "Implant",
            Status = ChargeExceptionStatus.Open,
            Reason = "No catalog mapping",
            CreatedAt = DateTime.UtcNow,
        });
        await db.Context.SaveChangesAsync();

        var dto = await db.Service().GetCompletenessAsync(TenantId, bill.Id, null);
        Assert.Equal(1, dto.ExceptionsOpen);
        Assert.Equal(0, dto.ImplantsMissingCharge);
        Assert.Single(dto.Warnings);

        var status = (await db.Service().GetChargeStatusByJourneyAsync(TenantId, [JourneyId]))[JourneyId];
        Assert.Equal(1, status.UnmappedCount);
        Assert.Equal(ChargeStatusClassifier.Unmapped, status.Status);
    }

    [Fact]
    public async Task Completeness_ExceptionUsageWithoutTable_CountsOnce()
    {
        var db = new Store();
        await db.SeedPatientAsync();
        var bill = await db.SeedBillAsync();
        await db.SeedUsageAsync(Guid.NewGuid(), "Implanted", "Exception");

        var dto = await db.Service().GetCompletenessAsync(TenantId, bill.Id, null);
        Assert.Equal(1, dto.ExceptionsOpen);
        Assert.Equal(0, dto.ImplantsMissingCharge);
        Assert.Contains(dto.Warnings, w => w.Contains("exception", StringComparison.OrdinalIgnoreCase));
    }

    [Fact]
    public async Task UnbilledActivity_CoveredImplant_IsExcluded()
    {
        var db = new Store();
        var branchId = Guid.NewGuid();
        var itemId = Guid.NewGuid();
        await db.SeedPatientAsync();
        await db.SeedJourneyAsync(branchId);
        var variant = await db.SeedPricedVariantAsync(14000m);
        await db.SeedItemMapAsync(itemId, variant);
        await db.SeedUsageAsync(itemId, "Implanted", "Covered");

        var dto = await db.Service().GetUnbilledActivityAsync(
            TenantId, branchId, DateTime.UtcNow.AddDays(-1), DateTime.UtcNow.AddDays(1));
        Assert.Equal(0, dto.Count);
        Assert.Equal(0m, dto.Amount);
    }

    [Fact]
    public async Task UnbilledActivity_ImplantPlusConsumable_UsesCatalogPrice()
    {
        var db = new Store();
        var branchId = Guid.NewGuid();
        var itemId = Guid.NewGuid();
        var consumableId = Guid.NewGuid();
        await db.SeedPatientAsync();
        await db.SeedJourneyAsync(branchId);
        var implantVariant = await db.SeedPricedVariantAsync(14000m);
        var consVariant = await db.SeedPricedVariantAsync(250m);
        await db.SeedItemMapAsync(itemId, implantVariant);
        await db.SeedItemMapAsync(consumableId, consVariant);
        await db.SeedUsageAsync(itemId, "Implanted", "Pending");
        await db.SeedConsumableAsync(consumableId, 2, "Pending");

        var from = DateTime.UtcNow.AddDays(-1);
        var to = DateTime.UtcNow.AddDays(1);
        var dto = await db.Service().GetUnbilledActivityAsync(TenantId, branchId, from, to);

        Assert.Equal(1, dto.ImplantCount);
        Assert.Equal(14000m, dto.ImplantAmount);
        Assert.Equal(1, dto.ConsumableCount);
        Assert.Equal(500m, dto.ConsumableAmount);
        Assert.Equal(2, dto.Count);
        Assert.Equal(14500m, dto.Amount);
        Assert.Equal(0, dto.UnmappedExceptionCount);
    }

    [Fact]
    public async Task UnbilledActivity_PostedImplant_IsExcluded()
    {
        var db = new Store();
        var branchId = Guid.NewGuid();
        var itemId = Guid.NewGuid();
        await db.SeedPatientAsync();
        await db.SeedJourneyAsync(branchId);
        var variant = await db.SeedPricedVariantAsync(14000m);
        await db.SeedItemMapAsync(itemId, variant);
        await db.SeedUsageAsync(itemId, "Implanted", "Posted");

        var dto = await db.Service().GetUnbilledActivityAsync(
            TenantId, branchId, DateTime.UtcNow.AddDays(-1), DateTime.UtcNow.AddDays(1));
        Assert.Equal(0, dto.Count);
        Assert.Equal(0m, dto.Amount);
    }

    [Fact]
    public async Task UnbilledActivity_OtherBranch_IsExcluded()
    {
        var db = new Store();
        var ours = Guid.NewGuid();
        var theirs = Guid.NewGuid();
        var itemId = Guid.NewGuid();
        await db.SeedPatientAsync();
        await db.SeedJourneyAsync(theirs);
        var variant = await db.SeedPricedVariantAsync(14000m);
        await db.SeedItemMapAsync(itemId, variant);
        await db.SeedUsageAsync(itemId, "Implanted", "Pending");

        var dto = await db.Service().GetUnbilledActivityAsync(
            TenantId, ours, DateTime.UtcNow.AddDays(-1), DateTime.UtcNow.AddDays(1));
        Assert.Equal(0, dto.Count);
    }

    [Fact]
    public async Task UnbilledActivity_NeedsAdjustment_IsCounted()
    {
        var db = new Store();
        var branchId = Guid.NewGuid();
        await db.SeedPatientAsync();
        await db.SeedJourneyAsync(branchId);
        db.Context.ChargeExceptions.Add(new ChargeException
        {
            Id = Guid.NewGuid(),
            TenantId = TenantId,
            PatientJourneyId = JourneyId,
            SourceType = "Consumable",
            Status = ChargeExceptionStatus.NeedsAdjustment,
            EstimatedValue = 0,
            CreatedAt = DateTime.UtcNow,
        });
        await db.Context.SaveChangesAsync();

        var dto = await db.Service().GetUnbilledActivityAsync(
            TenantId, branchId, DateTime.UtcNow.AddDays(-1), DateTime.UtcNow.AddDays(1));
        Assert.Equal(1, dto.UnmappedExceptionCount);
    }

    [Fact]
    public async Task ChargeStatus_UnmappedWinsOverMissing()
    {
        var db = new Store();
        await db.SeedPatientAsync();
        await db.SeedUsageAsync(Guid.NewGuid(), "Implanted", "Pending");
        db.Context.ChargeExceptions.Add(new ChargeException
        {
            Id = Guid.NewGuid(),
            TenantId = TenantId,
            PatientJourneyId = JourneyId,
            SourceType = "Implant",
            Status = ChargeExceptionStatus.Open,
            EstimatedValue = 0,
            CreatedAt = DateTime.UtcNow,
        });
        await db.Context.SaveChangesAsync();

        var map = await db.Service().GetChargeStatusByJourneyAsync(TenantId, [JourneyId]);
        var row = map[JourneyId];
        Assert.Equal(ChargeStatusClassifier.Unmapped, row.Status);
        Assert.Equal("1 unmapped", row.Label);
        Assert.Equal(1, row.MissingChargeCount);
        Assert.Equal(1, row.UnmappedCount);
    }

    [Fact]
    public async Task ChargeStatus_PendingImplant_IsMissingCharges()
    {
        var db = new Store();
        await db.SeedPatientAsync();
        await db.SeedUsageAsync(Guid.NewGuid(), "Implanted", "Pending");

        var map = await db.Service().GetChargeStatusByJourneyAsync(TenantId, [JourneyId]);
        var row = map[JourneyId];
        Assert.Equal(ChargeStatusClassifier.MissingCharges, row.Status);
        Assert.Equal("1 missing", row.Label);
    }

    private static OpdBillItem Line(
        Guid billId, string source, Guid? variantId, decimal price, Guid? sourceRef, string name)
        => new()
        {
            Id = Guid.NewGuid(),
            TenantId = TenantId,
            OpdBillId = billId,
            ServiceVariantId = variantId,
            ServiceName = name,
            Quantity = 1,
            UnitPrice = price,
            TotalAmount = price,
            SourceType = source,
            SourceRefId = sourceRef,
            CreatedByUserId = UserId,
            CreatedAt = DateTime.UtcNow,
        };

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
            Context = new AppDbContext(
                new DbContextOptionsBuilder<AppDbContext>().UseInMemoryDatabase(_name).Options,
                _http);
        }

        public AppDbContext Context { get; }

        public ChargeReconciliationService Service()
            => new(Context, new ChargeCatalogResolver(Context));

        public async Task SeedPatientAsync()
        {
            Context.Patients.Add(new Patient
            {
                Id = PatientId,
                TenantId = TenantId,
                MedicalRecordNumber = "UAT-021",
                FirstName = "Amit",
                LastName = "Verma",
                DateOfBirth = new DateTime(1968, 3, 12, 0, 0, 0, DateTimeKind.Utc),
                Gender = "M",
            });
            await Context.SaveChangesAsync();
        }

        public async Task<OpdBill> SeedBillAsync()
        {
            var bill = new OpdBill
            {
                Id = Guid.NewGuid(),
                TenantId = TenantId,
                BillNumber = "IPD-2026-00841",
                PatientId = PatientId,
                PatientJourneyId = JourneyId,
                BranchId = Guid.NewGuid(),
                BillDate = DateTime.UtcNow,
                GrossAmount = 62000m,
                NetAmount = 62000m,
                BalanceDue = 62000m,
                Status = "generated",
                GeneratedBy = UserId,
                CreatedByUserId = UserId,
                CreatedAt = DateTime.UtcNow,
                RowVersion = 1,
            };
            Context.OpdBills.Add(bill);
            await Context.SaveChangesAsync();
            return bill;
        }

        public async Task<Guid> SeedPricedVariantAsync(decimal amount)
        {
            var id = Guid.NewGuid();
            Context.ServiceVariants.Add(new ServiceVariant
            {
                Id = id,
                CatalogServiceId = Guid.NewGuid(),
                VariantName = "Test",
                VariantCode = "SV-" + id.ToString("N")[..6],
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

        public async Task SeedItemMapAsync(Guid itemId, Guid variantId)
        {
            Context.ServiceVariantItemMaps.Add(new ServiceVariantItemMap
            {
                Id = Guid.NewGuid(),
                TenantId = TenantId,
                ItemId = itemId,
                ServiceVariantId = variantId,
                IsChargeable = true,
                EffectiveFrom = DateTime.UtcNow.AddDays(-1),
                CreatedAt = DateTime.UtcNow,
            });
            await Context.SaveChangesAsync();
        }

        public async Task SeedUsageAsync(
            Guid itemId, string usageStatus, string chargeStatus,
            string? serial = null, string? reason = null, Guid? inventoryTxnId = null)
        {
            Context.JourneyImplantUsageReads.Add(new JourneyImplantUsageRead
            {
                Id = Guid.NewGuid(),
                TenantId = TenantId,
                JourneyId = JourneyId,
                PatientId = PatientId,
                Eye = "OD",
                ItemId = itemId,
                SerialNumber = serial,
                UsageStatus = usageStatus,
                ChargeStatus = chargeStatus,
                WastageReason = reason,
                InventoryTxnId = inventoryTxnId,
                ScannedAt = DateTime.UtcNow,
            });
            await Context.SaveChangesAsync();
        }

        public async Task SeedJourneyAsync(Guid branchId)
        {
            Context.PatientJourneys.Add(new PatientJourneyReadOnly
            {
                Id = JourneyId,
                TenantId = TenantId,
                PatientId = PatientId,
                BranchId = branchId,
                ClinicalState = "Admitted",
                CreatedAt = DateTime.UtcNow,
            });
            await Context.SaveChangesAsync();
        }

        public async Task SeedConsumableAsync(Guid itemId, decimal quantity, string chargeStatus)
        {
            Context.InvSurgeryConsumableReads.Add(new InvSurgeryConsumableRead
            {
                Id = Guid.NewGuid(),
                TenantId = TenantId,
                JourneyId = JourneyId,
                ItemId = itemId,
                Quantity = quantity,
                Amount = 0,
                ChargeStatus = chargeStatus,
                IssuedAt = DateTime.UtcNow,
            });
            await Context.SaveChangesAsync();
        }
    }
}
