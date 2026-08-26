using AuthService.Context;
using AuthService.Controllers;
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

public class ChargeCatalogResolverTests
{
    private static readonly Guid TenantId = Guid.NewGuid();
    private static readonly Guid UserId = Guid.NewGuid();

    [Fact]
    public async Task ResolveItem_Unmapped_WhenNoRow()
    {
        var db = new Store();
        var result = await db.Resolver().ResolveItemAsync(TenantId, Guid.NewGuid());
        Assert.Equal(ChargeResolveKind.Unmapped, result.Kind);
        Assert.False(result.CanPost);
        Assert.Null(result.UnitPrice);
    }

    [Fact]
    public async Task ResolveItem_NonChargeable_DoesNotReturnAPrice()
    {
        var db = new Store();
        var itemId = Guid.NewGuid();
        var variantId = await db.SeedPricedVariantAsync(14000m);
        db.Context.ServiceVariantItemMaps.Add(new ServiceVariantItemMap
        {
            Id = Guid.NewGuid(),
            TenantId = TenantId,
            ItemId = itemId,
            ServiceVariantId = variantId,
            IsChargeable = false,
            NonChargeableReason = "Included in package",
            EffectiveFrom = DateTime.UtcNow.AddDays(-1),
            CreatedAt = DateTime.UtcNow,
        });
        await db.Context.SaveChangesAsync();

        var result = await db.Resolver().ResolveItemAsync(TenantId, itemId);
        Assert.Equal(ChargeResolveKind.NonChargeable, result.Kind);
        Assert.Null(result.UnitPrice);
        Assert.False(result.CanPost);
    }

    [Fact]
    public async Task ResolveItem_ExpiredMapping_IsUnmapped()
    {
        var db = new Store();
        var itemId = Guid.NewGuid();
        var variantId = await db.SeedPricedVariantAsync(500m);
        db.Context.ServiceVariantItemMaps.Add(new ServiceVariantItemMap
        {
            Id = Guid.NewGuid(),
            TenantId = TenantId,
            ItemId = itemId,
            ServiceVariantId = variantId,
            IsChargeable = true,
            EffectiveFrom = DateTime.UtcNow.AddDays(-30),
            EffectiveTo = DateTime.UtcNow.AddDays(-1),
            CreatedAt = DateTime.UtcNow.AddDays(-30),
        });
        await db.Context.SaveChangesAsync();

        var result = await db.Resolver().ResolveItemAsync(TenantId, itemId);
        Assert.Equal(ChargeResolveKind.Unmapped, result.Kind);
    }

    [Fact]
    public async Task ResolveItem_Mapped_ReturnsCatalogPriceNotPurchaseRate()
    {
        var db = new Store();
        var itemId = Guid.NewGuid();
        var variantId = await db.SeedPricedVariantAsync(3200m);
        db.Context.ServiceVariantItemMaps.Add(new ServiceVariantItemMap
        {
            Id = Guid.NewGuid(),
            TenantId = TenantId,
            ItemId = itemId,
            ServiceVariantId = variantId,
            IsChargeable = true,
            EffectiveFrom = DateTime.UtcNow.AddMinutes(-1),
            CreatedAt = DateTime.UtcNow,
        });
        await db.Context.SaveChangesAsync();

        var result = await db.Resolver().ResolveItemAsync(TenantId, itemId);
        Assert.Equal(ChargeResolveKind.Mapped, result.Kind);
        Assert.Equal(3200m, result.UnitPrice);
        Assert.Equal(variantId, result.ServiceVariantId);
    }

    [Fact]
    public async Task ResolveVariant_PayerTariff_OverridesGlobalCatalogPrice()
    {
        var db = new Store();
        var payerId = Guid.NewGuid();
        var variantId = await db.SeedPricedVariantAsync(5000m);
        db.Context.VariantPrices.Add(new VariantPrice
        {
            Id = Guid.NewGuid(),
            VariantId = variantId,
            PayerId = payerId,
            Amount = 4200m,
            IsActive = true,
            EffectiveFrom = DateOnly.FromDateTime(DateTime.UtcNow),
        });
        await db.Context.SaveChangesAsync();

        var withPayer = await db.Resolver().ResolveVariantAsync(TenantId, variantId, payerId: payerId);
        Assert.Equal(4200m, withPayer.UnitPrice);

        var catalog = await db.Resolver().ResolveVariantAsync(TenantId, variantId);
        Assert.Equal(5000m, catalog.UnitPrice);
    }

    [Fact]
    public async Task EnqueueUnmapped_IsIdempotent()
    {
        var db = new Store();
        var resolver = db.Resolver();
        var req = new ChargeExceptionEnqueueRequest
        {
            ItemId = Guid.NewGuid(),
            SourceType = "Consumable",
            EstimatedValue = 1200,
            IdempotencyKey = "ConsumablesConsumed:abc",
        };
        var first = await resolver.EnqueueUnmappedAsync(TenantId, req);
        var second = await resolver.EnqueueUnmappedAsync(TenantId, req);
        Assert.Equal(first.Id, second.Id);
        Assert.Equal(1, await db.Context.ChargeExceptions.CountAsync());
        Assert.Equal(ChargeExceptionStatus.Open, first.Status);
    }

    [Fact]
    public async Task EnqueueUnmapped_NeedsAdjustment_PersistsStatus()
    {
        var db = new Store();
        var row = await db.Resolver().EnqueueUnmappedAsync(TenantId, new ChargeExceptionEnqueueRequest
        {
            ItemId = Guid.NewGuid(),
            SourceType = "Implant",
            EstimatedValue = 3200,
            IdempotencyKey = "ImplantUsed:closed",
            Status = ChargeExceptionStatus.NeedsAdjustment,
            Reason = "Bill is finalized; queue a post-finalize correction.",
        });
        Assert.Equal(ChargeExceptionStatus.NeedsAdjustment, row.Status);
        Assert.Equal(ChargeExceptionStatus.NeedsAdjustment, (await db.Context.ChargeExceptions.SingleAsync()).Status);
    }

    [Fact]
    public async Task CreateMapping_VersionsPreviousRow()
    {
        var db = new Store();
        var itemId = Guid.NewGuid();
        var v1 = await db.SeedPricedVariantAsync(1000m);
        var v2 = await db.SeedPricedVariantAsync(1500m);
        var admin = db.Admin();

        await admin.CreateMappingAsync(TenantId, UserId, new CreateChargeMappingRequest
        {
            ItemId = itemId,
            ServiceVariantId = v1,
        });
        await admin.CreateMappingAsync(TenantId, UserId, new CreateChargeMappingRequest
        {
            ItemId = itemId,
            ServiceVariantId = v2,
        });

        var history = await admin.GetHistoryAsync(TenantId, itemId);
        Assert.Equal(2, history.Count);
        Assert.Single(history.Where(h => h.EffectiveTo == null));
        Assert.Equal(v2, history.Single(h => h.EffectiveTo == null).ServiceVariantId);
    }

    [Fact]
    public void ChargeMappingRoutes_RequireBillAdmin()
    {
        var methods = new[]
        {
            nameof(ChargeMappingController.GetExceptions),
            nameof(ChargeMappingController.Create),
            nameof(ChargeMappingController.Replay),
        };
        foreach (var name in methods)
        {
            var method = typeof(ChargeMappingController).GetMethod(name);
            Assert.NotNull(method);
            var attr = method!.GetCustomAttributes(typeof(AuthService.Authorization.RequirePermissionAttribute), false)
                .Cast<AuthService.Authorization.RequirePermissionAttribute>()
                .Single();
            Assert.Equal("bill.admin", attr.PermissionCode);
        }
    }

    [Fact]
    public async Task ListUnmapped_AttachesLastPatientFromParkedException()
    {
        var db = new Store();
        var itemId = Guid.NewGuid();
        var patientId = Guid.NewGuid();
        var journeyId = Guid.NewGuid();
        db.Context.Patients.Add(new Patient
        {
            Id = patientId,
            TenantId = TenantId,
            MedicalRecordNumber = "UAT-002",
            HealthId = "UAT-002",
            FirstName = "Meena",
            LastName = "Iyer",
            DateOfBirth = new DateTime(1972, 3, 12, 0, 0, 0, DateTimeKind.Utc),
            Gender = "F",
        });
        db.Context.PatientJourneys.Add(new PatientJourneyReadOnly
        {
            Id = journeyId,
            TenantId = TenantId,
            PatientId = patientId,
            Uhid = "UAT-002",
            ClinicalState = "Admitted",
            CreatedAt = DateTime.UtcNow,
        });
        db.Context.ChargeExceptions.Add(new ChargeException
        {
            Id = Guid.NewGuid(),
            TenantId = TenantId,
            ItemId = itemId,
            PatientJourneyId = journeyId,
            SourceType = "IOL",
            Quantity = 1,
            EstimatedValue = 14000m,
            Status = ChargeExceptionStatus.Open,
            Reason = "Unmapped",
            CreatedAt = DateTime.UtcNow,
        });
        await db.Context.SaveChangesAsync();

        var list = await db.Admin().ListUnmappedAsync(TenantId);
        var row = Assert.Single(list.Items);
        Assert.Equal("Meena Iyer", row.LastPatientName);
        Assert.Equal("UAT-002", row.LastUhid);
        Assert.Equal(14000m, row.EstimatedValue);
    }

    private sealed class Store
    {
        private readonly string _name = Guid.NewGuid().ToString();
        private readonly IHttpContextAccessor _http;

        public Store()
        {
            var accessor = new Mock<IHttpContextAccessor>();
            accessor.Setup(a => a.HttpContext).Returns(new DefaultHttpContext());
            _http = accessor.Object;
            Context = NewContext();
        }

        public AppDbContext Context { get; }

        private AppDbContext NewContext() => new(
            new DbContextOptionsBuilder<AppDbContext>().UseInMemoryDatabase(_name).Options,
            _http);

        public ChargeCatalogResolver Resolver() => new(Context);

        public ChargeMappingAdminService Admin()
        {
            var bills = new Mock<IBillItemService>();
            return new ChargeMappingAdminService(Context, Resolver(), bills.Object);
        }

        public async Task<Guid> SeedPricedVariantAsync(decimal amount)
        {
            var id = Guid.NewGuid();
            Context.ServiceVariants.Add(new ServiceVariant
            {
                Id = id,
                CatalogServiceId = Guid.NewGuid(),
                VariantName = "Test variant",
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
    }
}
