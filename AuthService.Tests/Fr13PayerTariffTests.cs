using AuthService.Context;
using AuthService.DTOs.Billing;
using AuthService.Models.Domain;
using AuthService.Services;
using AuthService.Services.Interfaces;
using Microsoft.AspNetCore.Http;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging.Abstractions;
using Moq;
using Xunit;

namespace AuthService.Tests;

/// <summary>FR-1.3 — payer-specific tariff must reach OpdBillItem on explosion and ChargeItems.</summary>
public class Fr13PayerTariffTests
{
    private static readonly Guid TenantId = Guid.NewGuid();
    private static readonly Guid UserId = Guid.NewGuid();
    private static readonly Guid JourneyId = Guid.NewGuid();
    private static readonly Guid PatientId = Guid.NewGuid();
    private static readonly Guid BranchId = Guid.NewGuid();
    private static readonly Guid PayerP1 = Guid.Parse("a1000001-0000-4000-8000-000000000001");
    private static readonly Guid PayerP2 = Guid.Parse("a1000002-0000-4000-8000-000000000002");

    [Fact]
    public async Task Explode_UsesPayerTariff_NotGlobal()
    {
        var db = new Store();
        var (procId, iolId) = await db.SeedMappedPackageWithGlobalsAsync(procedure: 80_000m, iol: 15_000m, agreed: 90_000m);
        await db.SeedPayerPriceAsync(procId, PayerP1, 70_000m, newerThanGlobal: true);
        await db.SeedPayerPriceAsync(iolId, PayerP1, 12_000m, newerThanGlobal: true);
        await db.SeedCoverageAsync(PayerP1);

        await db.Service().EnsureInpatientBillAsync(Ensure(90_000m), UserId);

        using var check = db.Reader();
        var packageItems = await check.OpdBillItems
            .Where(i => i.SourceType == BillChargeSource.Package && i.ServiceVariantId != null)
            .ToListAsync();
        Assert.Equal(70_000m, packageItems.Single(i => i.ServiceVariantId == procId).UnitPrice);
        Assert.Equal(12_000m, packageItems.Single(i => i.ServiceVariantId == iolId).UnitPrice);
        Assert.Equal(90_000m, (await check.OpdBills.SingleAsync()).GrossAmount);
    }

    [Fact]
    public async Task Explode_DifferentPayer_SelectsThatPayersTariff()
    {
        var db = new Store();
        var (procId, _) = await db.SeedMappedPackageWithGlobalsAsync(80_000m, 15_000m, 90_000m);
        await db.SeedPayerPriceAsync(procId, PayerP1, 70_000m, newerThanGlobal: true);
        await db.SeedPayerPriceAsync(procId, PayerP2, 65_000m, newerThanGlobal: true);
        await db.SeedCoverageAsync(PayerP2);

        await db.Service().EnsureInpatientBillAsync(Ensure(90_000m), UserId);

        using var check = db.Reader();
        var proc = await check.OpdBillItems.SingleAsync(i => i.ServiceVariantId == procId);
        Assert.Equal(65_000m, proc.UnitPrice);
    }

    [Fact]
    public async Task Explode_NoPayerTariff_FallsBackToGlobal()
    {
        var db = new Store();
        var (procId, iolId) = await db.SeedMappedPackageWithGlobalsAsync(80_000m, 15_000m, 90_000m);
        await db.SeedCoverageAsync(PayerP1);

        await db.Service().EnsureInpatientBillAsync(Ensure(90_000m), UserId);

        using var check = db.Reader();
        Assert.Equal(80_000m, (await check.OpdBillItems.SingleAsync(i => i.ServiceVariantId == procId)).UnitPrice);
        Assert.Equal(15_000m, (await check.OpdBillItems.SingleAsync(i => i.ServiceVariantId == iolId)).UnitPrice);
    }

    [Fact]
    public async Task Explode_NoPayerContext_UsesGlobal()
    {
        var db = new Store();
        var (procId, _) = await db.SeedMappedPackageWithGlobalsAsync(80_000m, 15_000m, 90_000m);
        await db.SeedPayerPriceAsync(procId, PayerP1, 70_000m, newerThanGlobal: true);
        // No coverage case → no payer

        await db.Service().EnsureInpatientBillAsync(Ensure(90_000m), UserId);

        using var check = db.Reader();
        Assert.Equal(80_000m, (await check.OpdBillItems.SingleAsync(i => i.ServiceVariantId == procId)).UnitPrice);
    }

    [Fact]
    public async Task Explode_NeverSelectsOtherPayersTariff()
    {
        var db = new Store();
        var (procId, _) = await db.SeedMappedPackageWithGlobalsAsync(80_000m, 15_000m, 90_000m);
        // P2 row is newer / higher EffectiveFrom so a naive lookup would prefer it
        await db.SeedPayerPriceAsync(procId, PayerP2, 99_000m, newerThanGlobal: true);
        await db.SeedPayerPriceAsync(procId, PayerP1, 70_000m, newerThanGlobal: false);
        await db.SeedCoverageAsync(PayerP1);

        await db.Service().EnsureInpatientBillAsync(Ensure(90_000m), UserId);

        using var check = db.Reader();
        Assert.Equal(70_000m, (await check.OpdBillItems.SingleAsync(i => i.ServiceVariantId == procId)).UnitPrice);
    }

    [Fact]
    public async Task Explode_MixedPackage_PayerAndGlobalPerComponent()
    {
        var db = new Store();
        var (procId, iolId) = await db.SeedMappedPackageWithGlobalsAsync(80_000m, 15_000m, 90_000m);
        await db.SeedPayerPriceAsync(procId, PayerP1, 70_000m, newerThanGlobal: true);
        // IOL: global only
        await db.SeedCoverageAsync(PayerP1);

        await db.Service().EnsureInpatientBillAsync(Ensure(90_000m), UserId);

        using var check = db.Reader();
        Assert.Equal(70_000m, (await check.OpdBillItems.SingleAsync(i => i.ServiceVariantId == procId)).UnitPrice);
        Assert.Equal(15_000m, (await check.OpdBillItems.SingleAsync(i => i.ServiceVariantId == iolId)).UnitPrice);
        var bill = await check.OpdBills.SingleAsync();
        Assert.Equal(90_000m, bill.GrossAmount);
        Assert.Equal(90_000m, bill.NetAmount);
        Assert.Equal(90_000m, bill.BalanceDue);
    }

    [Fact]
    public async Task Explode_WithPayerTariff_IsIdempotent()
    {
        var db = new Store();
        var (procId, _) = await db.SeedMappedPackageWithGlobalsAsync(80_000m, 15_000m, 90_000m);
        await db.SeedPayerPriceAsync(procId, PayerP1, 70_000m, newerThanGlobal: true);
        await db.SeedCoverageAsync(PayerP1);
        var svc = db.Service();

        await svc.EnsureInpatientBillAsync(Ensure(90_000m), UserId);
        await svc.EnsureInpatientBillAsync(Ensure(90_000m), UserId);

        using var check = db.Reader();
        Assert.Equal(3, await check.OpdBillItems.CountAsync());
        Assert.Equal(70_000m, (await check.OpdBillItems.SingleAsync(i => i.ServiceVariantId == procId)).UnitPrice);
    }

    [Fact]
    public async Task ChargeItems_Debit_PostsResolvedPayerPrice()
    {
        var db = new Store();
        await db.SeedBillAsync();
        var variantId = await db.SeedPricedVariantAsync(5_000m, "EXTRA-1");
        await db.SeedPayerPriceAsync(variantId, PayerP2, 9_999m, newerThanGlobal: true);
        await db.SeedPayerPriceAsync(variantId, PayerP1, 4_200m, newerThanGlobal: false);
        await db.SeedCoverageAsync(PayerP1);

        var result = await db.Service().ChargeItemsAsync(new ChargeItemsRequest
        {
            TenantId = TenantId,
            PatientJourneyId = JourneyId,
            ActorUserId = UserId,
            IdempotencyKey = "Extra:payer-1",
            Lines =
            [
                new ChargeItemLineRequest
                {
                    SourceType = BillChargeSource.Manual,
                    SourceRefId = Guid.NewGuid(),
                    ServiceVariantId = variantId,
                    Quantity = 1,
                    UnitPriceOverride = 1m, // caller purchase rate must not win
                },
            ],
        });

        Assert.Equal(4_200m, Assert.Single(result.Items).UnitPrice);
        using var check = db.Reader();
        Assert.Equal(4_200m, (await check.OpdBillItems.SingleAsync()).UnitPrice);
    }

    [Fact]
    public async Task StageBillItem_WithoutOverride_IgnoresOtherPayerRows()
    {
        var db = new Store();
        var bill = await db.SeedBillAsync();
        var variantId = await db.SeedPricedVariantAsync(5_000m, "BASE-1");
        // Newer payer row would win a naive EffectiveFrom-only query
        await db.SeedPayerPriceAsync(variantId, PayerP1, 9_999m, newerThanGlobal: true);

        var items = new BillItemService(db.Context, NullLogger<BillItemService>.Instance);
        var staged = await items.StageBillItemAsync(new AddBillItemRequest
        {
            OpdBillId = bill.Id,
            ServiceVariantId = variantId,
            Quantity = 1,
            SourceType = BillChargeSource.Manual,
            IdempotencyKey = "Stage:no-payer",
        }, TenantId, UserId);

        Assert.Equal(5_000m, staged.Item.UnitPrice);
    }

    [Fact]
    public async Task StageBillItem_ExplicitOverride_Unchanged()
    {
        var db = new Store();
        var bill = await db.SeedBillAsync();
        var variantId = await db.SeedPricedVariantAsync(5_000m, "OVR-1");
        await db.SeedPayerPriceAsync(variantId, PayerP1, 4_200m, newerThanGlobal: true);

        var items = new BillItemService(db.Context, NullLogger<BillItemService>.Instance);
        var staged = await items.StageBillItemAsync(new AddBillItemRequest
        {
            OpdBillId = bill.Id,
            ServiceVariantId = variantId,
            Quantity = 1,
            UnitPriceOverride = 3_333m,
            SourceType = BillChargeSource.Manual,
            IdempotencyKey = "Stage:override",
        }, TenantId, UserId);

        Assert.Equal(3_333m, staged.Item.UnitPrice);
    }

    [Fact]
    public async Task Resolver_PayerPrecedence_MatchesLedgerExpectations()
    {
        var db = new Store();
        var variantId = await db.SeedPricedVariantAsync(5_000m);
        await db.SeedPayerPriceAsync(variantId, PayerP1, 4_200m, newerThanGlobal: true);
        await db.SeedPayerPriceAsync(variantId, PayerP2, 3_900m, newerThanGlobal: true);
        var resolver = new ChargeCatalogResolver(db.Context);

        Assert.Equal(4_200m, (await resolver.ResolveVariantAsync(TenantId, variantId, payerId: PayerP1)).UnitPrice);
        Assert.Equal(3_900m, (await resolver.ResolveVariantAsync(TenantId, variantId, payerId: PayerP2)).UnitPrice);
        Assert.Equal(5_000m, (await resolver.ResolveVariantAsync(TenantId, variantId)).UnitPrice);
    }

    [Fact]
    public async Task Explode_FinancialProjection_UsesItemisedGross()
    {
        var db = new Store();
        var (procId, _) = await db.SeedMappedPackageWithGlobalsAsync(80_000m, 15_000m, 90_000m);
        await db.SeedPayerPriceAsync(procId, PayerP1, 70_000m, newerThanGlobal: true);
        await db.SeedCoverageAsync(PayerP1);

        await db.Service().EnsureInpatientBillAsync(Ensure(90_000m), UserId);

        using var check = db.Reader();
        var bill = await check.OpdBills.SingleAsync();
        var itemSum = await check.OpdBillItems.SumAsync(i => i.TotalAmount);
        Assert.Equal(itemSum, bill.GrossAmount);
        Assert.Equal(bill.GrossAmount, bill.NetAmount);
        Assert.Equal(bill.NetAmount, bill.BalanceDue);
        // Obligation projection from ledger (CoverageAllocationEngine remains downstream; not modified).
        var obligation = PatientObligationCalculator.Compute(
            bill.NetAmount, payerResponsibility: 0m, collected: bill.AmountPaid);
        Assert.Equal(90_000m, obligation.PatientResponsibility);
    }

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

        public OpdBillService Service() => new(
            Context,
            NullLogger<OpdBillService>.Instance,
            Outbox,
            notifications: null,
            audit: Audit.Object,
            http: _http,
            billItems: new BillItemService(Context, NullLogger<BillItemService>.Instance),
            catalog: new ChargeCatalogResolver(Context));

        public async Task<(Guid ProcId, Guid IolId)> SeedMappedPackageWithGlobalsAsync(
            decimal procedure, decimal iol, decimal agreed)
        {
            var template = new CounsellingPackageTemplate
            {
                Id = Guid.NewGuid(),
                TenantId = TenantId,
                Code = "PHACO-FR13",
                Name = "Phaco FR13",
                PackageAmount = agreed,
                IsActive = true,
                CreatedAt = DateTime.UtcNow,
            };
            TemplateId = template.Id;
            Context.CounsellingPackageTemplates.Add(template);
            var procId = await SeedPricedVariantAsync(procedure, "PHACO");
            var iolId = await SeedPricedVariantAsync(iol, "IOL-STD");
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
                ServiceVariantId = iolId,
                SortOrder = 1,
                CreatedAt = DateTime.UtcNow,
            });
            Context.CounselingSession.Add(new CounselingSession
            {
                Id = Guid.NewGuid(),
                TenantId = TenantId,
                BranchId = BranchId,
                PatientId = PatientId,
                ReferredByDoctorId = Guid.NewGuid(),
                SessionDate = DateTime.UtcNow.Date,
                PatientType = "Insurance",
                SelectedPackageId = template.Id,
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
            return (procId, iolId);
        }

        public async Task SeedCoverageAsync(Guid insuranceProviderId)
        {
            Context.CcmsCoverageCases.Add(new CcmsCoverageCaseReadOnly
            {
                Id = Guid.NewGuid(),
                JourneyId = JourneyId,
                PatientId = PatientId,
                BranchId = BranchId,
                PayerType = "insurance",
                InsuranceProviderId = insuranceProviderId,
                CurrentState = "APPROVED",
                ApprovedAmount = 70_000m,
            });
            await Context.SaveChangesAsync();
            Context.ChangeTracker.Clear();
        }

        public async Task<OpdBill> SeedBillAsync(decimal packageAmount = 62_000m)
        {
            var bill = new OpdBill
            {
                Id = Guid.NewGuid(),
                TenantId = TenantId,
                BillNumber = "IP-FR13-0001",
                PatientId = PatientId,
                PatientJourneyId = JourneyId,
                BranchId = BranchId,
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
                EffectiveFrom = DateOnly.FromDateTime(DateTime.UtcNow.AddDays(-2)),
            });
            await Context.SaveChangesAsync();
            return id;
        }

        public async Task SeedPayerPriceAsync(Guid variantId, Guid payerId, decimal amount, bool newerThanGlobal)
        {
            Context.VariantPrices.Add(new VariantPrice
            {
                Id = Guid.NewGuid(),
                VariantId = variantId,
                PayerId = payerId,
                Amount = amount,
                IsActive = true,
                EffectiveFrom = DateOnly.FromDateTime(
                    newerThanGlobal ? DateTime.UtcNow : DateTime.UtcNow.AddDays(-10)),
            });
            await Context.SaveChangesAsync();
            Context.ChangeTracker.Clear();
        }
    }
}
