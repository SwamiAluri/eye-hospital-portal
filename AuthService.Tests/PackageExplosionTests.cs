using AuthService.Context;
using AuthService.DTOs.Billing;
using AuthService.Models.Domain;
using AuthService.Services;
using Microsoft.AspNetCore.Http;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging.Abstractions;
using Moq;
using Xunit;

namespace AuthService.Tests;

/// <summary>BILL-031 — D1 exploded package lines + discount on ensure-bill.</summary>
public class PackageExplosionTests
{
    private static readonly Guid TenantId = Guid.NewGuid();
    private static readonly Guid UserId = Guid.NewGuid();
    private static readonly Guid JourneyId = Guid.NewGuid();
    private static readonly Guid PatientId = Guid.NewGuid();
    private static readonly Guid BranchId = Guid.NewGuid();

    [Fact]
    public async Task Explode_SumOfItemsEqualsGrossAndAgreedPackage()
    {
        var db = new Store();
        var template = await db.SeedMappedPackageAsync(procedure: 80000m, iol: 15000m, agreed: 90000m);

        await db.Service().EnsureInpatientBillAsync(Ensure(agreed: 90000m), UserId);

        using var check = db.Reader();
        var items = await check.OpdBillItems.OrderBy(i => i.CreatedAt).ToListAsync();
        Assert.Equal(3, items.Count);
        Assert.Equal(90000m, items.Sum(i => i.TotalAmount));
        var saved = await check.OpdBills.SingleAsync();
        Assert.Equal(90000m, saved.GrossAmount);
        Assert.Equal(0m, saved.AdditionalCharges);
        Assert.Equal(BillChargeSource.PackageDiscount, items.Single(i => i.TotalAmount < 0).SourceType);
        Assert.Equal(template.Id, items.Single(i => i.SourceType == BillChargeSource.PackageDiscount).SourceRefId);
        Assert.Contains(BillingCcmsEventTypes.PatientObligationChanged, db.Outbox.Types);
    }

    [Fact]
    public async Task Explode_IsIdempotentOnRerun()
    {
        var db = new Store();
        await db.SeedMappedPackageAsync(80000m, 15000m, 90000m);
        var service = db.Service();

        await service.EnsureInpatientBillAsync(Ensure(90000m), UserId);
        await service.EnsureInpatientBillAsync(Ensure(90000m), UserId);

        using var check = db.Reader();
        Assert.Equal(3, await check.OpdBillItems.CountAsync());
        Assert.Equal(90000m, (await check.OpdBills.SingleAsync()).GrossAmount);
    }

    [Fact]
    public async Task UnmappedComponent_DoesNotCreateAShortBill()
    {
        var db = new Store();
        await db.SeedPackageTemplateAsync();
        db.Context.PackageComponentMaps.Add(new PackageComponentMap
        {
            Id = Guid.NewGuid(),
            TenantId = TenantId,
            PackageTemplateId = db.TemplateId,
            ComponentKey = "Procedure",
            ComponentName = "Procedure",
            ServiceVariantId = null,
            SortOrder = 0,
            CreatedAt = DateTime.UtcNow,
        });
        await db.Context.SaveChangesAsync();
        await db.SeedSessionAndJourneyAsync();

        var ex = await Assert.ThrowsAsync<ChargePostingException>(
            () => db.Service().EnsureInpatientBillAsync(Ensure(90000m), UserId));

        Assert.Equal(ChargePostingCodes.PackageComponentUnmapped, ex.Code);
        using var check = db.Reader();
        Assert.Empty(await check.OpdBills.ToListAsync());
        Assert.Empty(await check.OpdBillItems.ToListAsync());
        Assert.Single(await check.ChargeExceptions.ToListAsync());
    }

    [Fact]
    public async Task PremiumIolUpgrade_IsCatalogDeltaNotPurchaseRate()
    {
        var db = new Store();
        await db.SeedMappedPackageAsync(80000m, 15000m, 100000m);
        var stdIol = await db.SeedIolAsync(15000m);
        var premiumIol = await db.SeedIolAsync(25000m);
        var template = await db.Context.CounsellingPackageTemplates.SingleAsync();
        template.IolId = stdIol;
        await db.Context.SaveChangesAsync();

        var session = await db.Context.CounselingSession.SingleAsync();
        session.RecommendedProcedures = $@"[{{""iolCatalogId"":""{premiumIol}""}}]";
        session.PackageAmount = 100000m;
        await db.Context.SaveChangesAsync();
        db.Context.ChangeTracker.Clear();

        await db.Service().EnsureInpatientBillAsync(Ensure(100000m), UserId);

        using var check = db.Reader();
        var items = await check.OpdBillItems.ToListAsync();
        var upgrade = Assert.Single(items, i => i.ServiceName == "Premium IOL upgrade");
        Assert.Equal(10000m, upgrade.UnitPrice);
        Assert.Equal(100000m, items.Sum(i => i.TotalAmount));
        Assert.Equal(100000m, (await check.OpdBills.SingleAsync()).GrossAmount);
    }

    [Fact]
    public async Task CoverageAllocation_AppliesOverExplodedGross()
    {
        var db = new Store();
        await db.SeedMappedPackageAsync(80000m, 15000m, 90000m);
        var service = db.Service();
        await service.EnsureInpatientBillAsync(Ensure(90000m), UserId);
        var billId = (await db.Context.OpdBills.AsNoTracking().SingleAsync()).Id;

        var summary = await service.ApplyCoverageAllocationAsync(new ApplyCoverageAllocationRequest
        {
            OpdBillId = billId,
            PatientJourneyId = JourneyId,
            PayerResponsibility = 50000m,
            PatientResponsibility = 40000m,
            ActorUserId = UserId,
        });

        Assert.NotNull(summary);
        Assert.Equal(90000m, summary!.BilledAmount);
        Assert.Equal(50000m, summary.InsuranceResponsibility);
        Assert.Equal(40000m, summary.PatientResponsibility);
        Assert.Equal(40000m, summary.PatientBalance);
    }

    [Fact]
    public async Task NoPackageTemplate_KeepsLumpGross()
    {
        var db = new Store();
        db.Context.PatientJourneys.Add(new PatientJourneyReadOnly
        {
            Id = JourneyId,
            TenantId = TenantId,
            PatientId = PatientId,
            BranchId = BranchId,
            ClinicalState = "Admitted",
            CreatedAt = DateTime.UtcNow,
        });
        await db.Context.SaveChangesAsync();

        await db.Service().EnsureInpatientBillAsync(Ensure(62000m), UserId);

        using var check = db.Reader();
        Assert.Empty(await check.OpdBillItems.ToListAsync());
        Assert.Equal(62000m, (await check.OpdBills.SingleAsync()).GrossAmount);
    }

    [Fact]
    public async Task ChargeItemsMatchingIolAllowance_IsCovered_NoSecondImplantLine()
    {
        var db = new Store();
        await db.SeedMappedPackageAsync(80000m, 15000m, 90000m);
        var service = db.Service();
        await service.EnsureInpatientBillAsync(Ensure(90000m), UserId);
        var iolVar = await db.Context.ServiceVariants.AsNoTracking()
            .Where(v => v.VariantCode == "IOL-STD")
            .Select(v => v.Id)
            .SingleAsync();

        var result = await service.ChargeItemsAsync(new ChargeItemsRequest
        {
            TenantId = TenantId,
            PatientJourneyId = JourneyId,
            ActorUserId = UserId,
            IdempotencyKey = "ImplantUsed:covered",
            Lines =
            [
                new ChargeItemLineRequest
                {
                    SourceType = BillChargeSource.Implant,
                    SourceRefId = Guid.NewGuid(),
                    ServiceVariantId = iolVar,
                    Quantity = 1,
                }
            ],
        });

        Assert.Equal(1, result.SuppressedCount);
        Assert.Empty(result.Items);
        Assert.Equal(90000m, result.GrossAmount);
        using var check = db.Reader();
        Assert.Equal(3, await check.OpdBillItems.CountAsync());
        Assert.Empty(await check.ChargeExceptions.ToListAsync());
    }

    [Fact]
    public async Task OtShapedCovered_UsesProductCode_EvenWhenImplantIsUnpriced()
    {
        var db = new Store();
        await db.SeedMappedPackageAsync(80000m, 15000m, 90000m);
        var iolId = await db.SeedIolAsync(15000m, "ALCON-SN60WF");
        var template = await db.Context.CounsellingPackageTemplates.SingleAsync();
        template.IolId = iolId;
        await db.Context.SaveChangesAsync();
        db.Context.ChangeTracker.Clear();
        var service = db.Service();
        await service.EnsureInpatientBillAsync(Ensure(90000m), UserId);

        var result = await service.ChargeItemsAsync(new ChargeItemsRequest
        {
            TenantId = TenantId,
            PatientJourneyId = JourneyId,
            ActorUserId = UserId,
            IdempotencyKey = "ImplantUsed:ot-shaped-covered",
            Lines =
            [
                new ChargeItemLineRequest
                {
                    SourceType = BillChargeSource.Implant,
                    SourceRefId = Guid.NewGuid(),
                    ItemId = Guid.NewGuid(),
                    ServiceCode = "ALCON-SN60WF",
                    Quantity = 1,
                }
            ],
        });

        Assert.Equal(1, result.SuppressedCount);
        Assert.Equal(0, result.ExceptionCount);
        Assert.Empty(result.Items);
        Assert.Equal(90000m, result.GrossAmount);
        using var check = db.Reader();
        Assert.Equal(3, await check.OpdBillItems.CountAsync());
        Assert.Empty(await check.ChargeExceptions.ToListAsync());
    }

    [Fact]
    public async Task OtShapedUnproven_UnpricedUnknownSku_ParksNeedsAdjustment()
    {
        var db = new Store();
        await db.SeedMappedPackageAsync(80000m, 15000m, 90000m);
        var service = db.Service();
        await service.EnsureInpatientBillAsync(Ensure(90000m), UserId);

        var result = await service.ChargeItemsAsync(new ChargeItemsRequest
        {
            TenantId = TenantId,
            PatientJourneyId = JourneyId,
            ActorUserId = UserId,
            IdempotencyKey = "ImplantUsed:ot-shaped-unproven",
            Lines =
            [
                new ChargeItemLineRequest
                {
                    SourceType = BillChargeSource.Implant,
                    SourceRefId = Guid.NewGuid(),
                    ItemId = Guid.NewGuid(),
                    ServiceCode = "UNKNOWN-OT-SKU",
                    Quantity = 1,
                }
            ],
        });

        Assert.Equal(1, result.ExceptionCount);
        Assert.Empty(result.Items);
        Assert.Equal(90000m, result.GrossAmount);
        using var check = db.Reader();
        Assert.Equal(3, await check.OpdBillItems.CountAsync());
        var parked = Assert.Single(await check.ChargeExceptions.ToListAsync());
        Assert.Equal(ChargeExceptionStatus.NeedsAdjustment, parked.Status);
    }

    [Fact]
    public async Task ChargeItemsDifferentIolOnOpenSlot_ParksNeedsAdjustment()
    {
        var db = new Store();
        await db.SeedMappedPackageAsync(80000m, 15000m, 90000m);
        var service = db.Service();
        await service.EnsureInpatientBillAsync(Ensure(90000m), UserId);
        var implant = await db.SeedPricedVariantAsync(3200m, "IOL-PREM");

        var posted = await service.ChargeItemsAsync(new ChargeItemsRequest
        {
            TenantId = TenantId,
            PatientJourneyId = JourneyId,
            ActorUserId = UserId,
            IdempotencyKey = "ImplantUsed:after-explode",
            Lines =
            [
                new ChargeItemLineRequest
                {
                    SourceType = BillChargeSource.Implant,
                    SourceRefId = Guid.NewGuid(),
                    ServiceVariantId = implant,
                    Quantity = 1,
                    UnitPriceOverride = 1m,
                }
            ],
        });

        Assert.Equal(90000m, posted.GrossAmount);
        Assert.Equal(1, posted.ExceptionCount);
        Assert.Empty(posted.Items);
        using var check = db.Reader();
        Assert.Equal(3, await check.OpdBillItems.CountAsync());
        var parked = Assert.Single(await check.ChargeExceptions.ToListAsync());
        Assert.Equal(ChargeExceptionStatus.NeedsAdjustment, parked.Status);
    }

    [Fact]
    public async Task ChargeItemsSecondMatchingIol_PostsExtra()
    {
        var db = new Store();
        await db.SeedMappedPackageAsync(80000m, 15000m, 90000m);
        var service = db.Service();
        await service.EnsureInpatientBillAsync(Ensure(90000m), UserId);
        await db.SeedCoveredUsageAsync();
        var iolVar = await db.Context.ServiceVariants.AsNoTracking()
            .Where(v => v.VariantCode == "IOL-STD")
            .Select(v => v.Id)
            .SingleAsync();

        var posted = await service.ChargeItemsAsync(new ChargeItemsRequest
        {
            TenantId = TenantId,
            PatientJourneyId = JourneyId,
            ActorUserId = UserId,
            IdempotencyKey = "ImplantUsed:extra-lens",
            Lines =
            [
                new ChargeItemLineRequest
                {
                    SourceType = BillChargeSource.Implant,
                    SourceRefId = Guid.NewGuid(),
                    ServiceVariantId = iolVar,
                    Quantity = 1,
                }
            ],
        });

        Assert.Equal(105000m, posted.GrossAmount);
        Assert.Equal(0, posted.ExceptionCount);
        Assert.Equal(0, posted.SuppressedCount);
        Assert.Single(posted.Items);
        using var check = db.Reader();
        Assert.Equal(0m, (await check.OpdBills.SingleAsync()).AdditionalCharges);
        Assert.Equal(4, await check.OpdBillItems.CountAsync());
        Assert.Equal(BillChargeSource.Implant, (await check.OpdBillItems
            .SingleAsync(i => i.SourceType == BillChargeSource.Implant)).SourceType);
    }

    [Fact]
    public async Task ChargeItemsReplayCoveredUsage_DoesNotPostExtra()
    {
        var db = new Store();
        await db.SeedMappedPackageAsync(80000m, 15000m, 90000m);
        var service = db.Service();
        await service.EnsureInpatientBillAsync(Ensure(90000m), UserId);
        var usageId = await db.SeedCoveredUsageAsync();
        var iolVar = await db.Context.ServiceVariants.AsNoTracking()
            .Where(v => v.VariantCode == "IOL-STD")
            .Select(v => v.Id)
            .SingleAsync();

        var result = await service.ChargeItemsAsync(new ChargeItemsRequest
        {
            TenantId = TenantId,
            PatientJourneyId = JourneyId,
            ActorUserId = UserId,
            IdempotencyKey = $"ImplantUsed:{usageId:N}",
            Lines =
            [
                new ChargeItemLineRequest
                {
                    SourceType = BillChargeSource.Implant,
                    SourceRefId = usageId,
                    ServiceVariantId = iolVar,
                    Quantity = 1,
                }
            ],
        });

        Assert.Equal(1, result.SuppressedCount);
        Assert.Empty(result.Items);
        Assert.Equal(90000m, result.GrossAmount);
        using var check = db.Reader();
        Assert.Equal(3, await check.OpdBillItems.CountAsync());
        Assert.Empty(await check.ChargeExceptions.ToListAsync());
    }

    [Fact]
    public async Task TwoMatchingUsages_FirstCoveredPersistsSlot_SecondIsExtra()
    {
        var db = new Store();
        await db.SeedMappedPackageAsync(80000m, 15000m, 90000m);
        var service = db.Service();
        await service.EnsureInpatientBillAsync(Ensure(90000m), UserId);
        var iolVar = await db.Context.ServiceVariants.AsNoTracking()
            .Where(v => v.VariantCode == "IOL-STD")
            .Select(v => v.Id)
            .SingleAsync();
        var firstUsage = await db.SeedUsageAsync();
        var secondUsage = await db.SeedUsageAsync();

        var covered = await service.ChargeItemsAsync(ImplantReq($"ImplantUsed:{firstUsage:N}", firstUsage, iolVar));
        Assert.Equal(1, covered.SuppressedCount);
        Assert.Equal(90000m, covered.GrossAmount);
        using (var mid = db.Reader())
        {
            Assert.Equal("Covered", (await mid.JourneyImplantUsageReads.SingleAsync(u => u.Id == firstUsage)).ChargeStatus);
            Assert.Equal("Pending", (await mid.JourneyImplantUsageReads.SingleAsync(u => u.Id == secondUsage)).ChargeStatus);
        }

        var extra = await service.ChargeItemsAsync(ImplantReq($"ImplantUsed:{secondUsage:N}", secondUsage, iolVar));
        Assert.Equal(0, extra.SuppressedCount);
        Assert.Single(extra.Items);
        Assert.Equal(105000m, extra.GrossAmount);
        using var check = db.Reader();
        Assert.Equal(BillChargeSource.Implant, (await check.OpdBillItems
            .SingleAsync(i => i.SourceType == BillChargeSource.Implant)).SourceType);
        Assert.Equal("Covered", (await check.JourneyImplantUsageReads.SingleAsync(u => u.Id == firstUsage)).ChargeStatus);
    }

    [Fact]
    public async Task ConcurrentMatchingUsages_OneCoveredOneExtra()
    {
        var db = new Store();
        await db.SeedMappedPackageAsync(80000m, 15000m, 90000m);
        await db.Service().EnsureInpatientBillAsync(Ensure(90000m), UserId);
        var iolVar = await db.Context.ServiceVariants.AsNoTracking()
            .Where(v => v.VariantCode == "IOL-STD")
            .Select(v => v.Id)
            .SingleAsync();
        var firstUsage = await db.SeedUsageAsync();
        var secondUsage = await db.SeedUsageAsync();
        db.Context.ChangeTracker.Clear();

        var left = ImplantReq($"ImplantUsed:{firstUsage:N}", firstUsage, iolVar);
        var right = ImplantReq($"ImplantUsed:{secondUsage:N}", secondUsage, iolVar);
        var taskA = db.ServiceOn(db.Reader()).ChargeItemsAsync(left);
        var taskB = db.ServiceOn(db.Reader()).ChargeItemsAsync(right);

        ChargeItemsResultDto? a = null;
        ChargeItemsResultDto? b = null;
        Exception? stale = null;
        try
        {
            a = await taskA;
        }
        catch (Exception ex) when (BillConcurrency.IsStale(ex))
        {
            stale = ex;
        }

        try
        {
            b = await taskB;
        }
        catch (Exception ex) when (BillConcurrency.IsStale(ex))
        {
            stale = ex;
        }

        if (a is null)
            a = await db.ServiceOn(db.Reader()).ChargeItemsAsync(left);
        if (b is null)
            b = await db.ServiceOn(db.Reader()).ChargeItemsAsync(right);

        var results = new[] { a, b };
        Assert.Equal(1, results.Count(r => r.SuppressedCount == 1 && r.Items.Count == 0));
        Assert.Equal(1, results.Count(r => r.Items.Count == 1));
        Assert.Contains(105000m, results.Select(r => r.GrossAmount));
        using var check = db.Reader();
        Assert.Equal(1, await check.JourneyImplantUsageReads.CountAsync(u => u.ChargeStatus == "Covered"));
        Assert.Equal(1, await check.OpdBillItems.CountAsync(i => i.SourceType == BillChargeSource.Implant));
        _ = stale;
    }

    private static ChargeItemsRequest ImplantReq(string key, Guid usageId, Guid iolVar) => new()
    {
        TenantId = TenantId,
        PatientJourneyId = JourneyId,
        ActorUserId = UserId,
        IdempotencyKey = key,
        Lines =
        [
            new ChargeItemLineRequest
            {
                SourceType = BillChargeSource.Implant,
                SourceRefId = usageId,
                ServiceVariantId = iolVar,
                Quantity = 1,
            }
        ],
    };

    private static EnsureInpatientBillRequest Ensure(decimal agreed) => new()
    {
        TenantId = TenantId,
        BranchId = BranchId,
        PatientId = PatientId,
        PatientJourneyId = JourneyId,
        PackageAmount = agreed,
        ActorUserId = UserId,
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
        public Guid TemplateId { get; private set; }

        public AppDbContext Reader() => NewContext();

        private AppDbContext NewContext() => new(
            new DbContextOptionsBuilder<AppDbContext>().UseInMemoryDatabase(_name).Options,
            _http);

        public OpdBillService Service() => ServiceOn(Context);

        public OpdBillService ServiceOn(AppDbContext ctx)
        {
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

        public async Task<CounsellingPackageTemplate> SeedMappedPackageAsync(decimal procedure, decimal iol, decimal agreed)
        {
            var template = await SeedPackageTemplateAsync(agreed);
            var procId = await SeedPricedVariantAsync(procedure, "PHACO");
            var iolVar = await SeedPricedVariantAsync(iol, "IOL-STD");
            Context.PackageComponentMaps.Add(new PackageComponentMap
            {
                Id = Guid.NewGuid(),
                TenantId = TenantId,
                PackageTemplateId = template.Id,
                ComponentKey = "Procedure",
                ComponentName = "Phaco surgery",
                ServiceVariantId = procId,
                SortOrder = 0,
                CreatedAt = DateTime.UtcNow,
            });
            Context.PackageComponentMaps.Add(new PackageComponentMap
            {
                Id = Guid.NewGuid(),
                TenantId = TenantId,
                PackageTemplateId = template.Id,
                ComponentKey = "IolAllowance",
                ComponentName = "IOL allowance",
                ServiceVariantId = iolVar,
                SortOrder = 1,
                CreatedAt = DateTime.UtcNow,
            });
            Context.PackageComponentMaps.Add(new PackageComponentMap
            {
                Id = Guid.NewGuid(),
                TenantId = TenantId,
                PackageTemplateId = template.Id,
                ComponentKey = "Viscoelastic",
                ComponentName = "Viscoelastic (included)",
                CoversConsumable = true,
                SortOrder = 2,
                CreatedAt = DateTime.UtcNow,
            });
            await Context.SaveChangesAsync();
            await SeedSessionAndJourneyAsync(agreed);
            return template;
        }

        public async Task<CounsellingPackageTemplate> SeedPackageTemplateAsync(decimal agreed = 90000m)
        {
            var template = new CounsellingPackageTemplate
            {
                Id = Guid.NewGuid(),
                TenantId = TenantId,
                Code = "PHACO-STD",
                Name = "Phaco standard",
                PackageAmount = agreed,
                IsActive = true,
                CreatedAt = DateTime.UtcNow,
            };
            TemplateId = template.Id;
            Context.CounsellingPackageTemplates.Add(template);
            await Context.SaveChangesAsync();
            return template;
        }

        public async Task SeedSessionAndJourneyAsync(decimal agreed = 90000m)
        {
            Context.CounselingSession.Add(new CounselingSession
            {
                Id = Guid.NewGuid(),
                TenantId = TenantId,
                BranchId = BranchId,
                PatientId = PatientId,
                ReferredByDoctorId = Guid.NewGuid(),
                SessionDate = DateTime.UtcNow.Date,
                PatientType = "Cash",
                SelectedPackageId = TemplateId,
                PackageAmount = agreed,
                CreatedAt = DateTime.UtcNow,
            });
            var sessionId = Context.CounselingSession.Local.Last().Id;
            Context.PatientJourneys.Add(new PatientJourneyReadOnly
            {
                Id = JourneyId,
                TenantId = TenantId,
                PatientId = PatientId,
                BranchId = BranchId,
                CounselingSessionId = sessionId,
                PackageAmount = agreed,
                ClinicalState = "Admitted",
                CreatedAt = DateTime.UtcNow,
            });
            await Context.SaveChangesAsync();
            Context.ChangeTracker.Clear();
        }

        public async Task<Guid> SeedPricedVariantAsync(decimal amount, string? code = null)
        {
            var id = Guid.NewGuid();
            Context.ServiceVariants.Add(new ServiceVariant
            {
                Id = id,
                CatalogServiceId = Guid.NewGuid(),
                VariantName = code ?? "Test variant",
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

        public async Task<Guid> SeedUsageAsync(string chargeStatus = "Pending")
        {
            var id = Guid.NewGuid();
            Context.JourneyImplantUsageReads.Add(new JourneyImplantUsageRead
            {
                Id = id,
                TenantId = TenantId,
                JourneyId = JourneyId,
                PatientId = PatientId,
                Eye = "OD",
                UsageStatus = "Implanted",
                ChargeStatus = chargeStatus,
                ScannedAt = DateTime.UtcNow,
            });
            await Context.SaveChangesAsync();
            return id;
        }

        public Task<Guid> SeedCoveredUsageAsync() => SeedUsageAsync("Covered");

        public async Task<Guid> SeedIolAsync(decimal amount, string? productCode = null)
        {
            var id = Guid.NewGuid();
            Context.IolMasters.Add(new IolMaster
            {
                Id = id,
                ModelName = "IOL " + id.ToString("N")[..6],
                BrandManufacturer = "TestBrand",
                ProductCode = productCode,
                IsActive = true,
            });
            Context.IolPrices.Add(new IolPrice
            {
                Id = Guid.NewGuid(),
                IolMasterId = id,
                Amount = amount,
                IsActive = true,
                EffectiveFrom = DateOnly.FromDateTime(DateTime.UtcNow),
            });
            await Context.SaveChangesAsync();
            return id;
        }
    }
}
