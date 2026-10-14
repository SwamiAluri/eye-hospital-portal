using System.Reflection;
using System.Security.Claims;
using System.Text.Json;
using AuthService.Authorization;
using AuthService.Context;
using AuthService.Controllers;
using AuthService.Models.Domain;
using AuthService.Services;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Moq;
using Xunit;

namespace AuthService.Tests;

/// <summary>L3-UX-01 Laboratory Order Summary / Estimate Sheet (read-only).</summary>
public class LaboratoryOrderSummaryTests
{
    private static readonly Guid UserId = Guid.Parse("11111111-1111-1111-1111-111111111111");
    private static readonly Guid TenantId = Guid.Parse("22222222-2222-2222-2222-222222222222");
    private static readonly Guid OtherTenantId = Guid.Parse("33333333-3333-3333-3333-333333333333");

    [Fact]
    public void OrderSummary_RequiresPatientView()
    {
        Assert.Equal(
            "patient.view",
            AttributeOf(typeof(LaboratoryCatalogController), nameof(LaboratoryCatalogController.GetOrderSummary)));
    }

    [Fact]
    public async Task UnauthorizedFinancial_OmitsMonetaryAmounts()
    {
        await using var db = CreateDb();
        var test = TestDef(TenantId, "Complete Blood Count", "CBC001", "Haematology");
        var variant = ActiveVariant("LAB-CBC", "CBC Lab Charge");
        test.ServiceVariantId = variant.Id;
        SeedPrice(db, variant.Id, 350m);
        db.LaboratoryTestDefinitions.Add(test);
        db.ServiceVariants.Add(variant);
        await db.SaveChangesAsync();

        var result = await Catalog(db).GetOrderSummary(new LaboratoryOrderSummaryRequest
        {
            Items = new List<LaboratoryOrderSummaryItemRequest>
            {
                new() { TestDefinitionId = test.Id },
            },
        });

        var ok = Assert.IsType<OkObjectResult>(result);
        var summary = Assert.IsType<LaboratoryOrderSummaryDto>(ok.Value);
        Assert.False(summary.FinancialAmountsVisible);
        Assert.Null(summary.EstimateTotal);
        Assert.Single(summary.Lines);
        Assert.Equal(LaboratoryCommercialStates.Mapped, summary.Lines[0].CommercialState);
        Assert.Null(summary.Lines[0].UnitPrice);
        Assert.Null(summary.Lines[0].LineEstimate);

        var json = JsonSerializer.Serialize(summary);
        Assert.DoesNotContain("350", json);
        Assert.DoesNotContain("UnitPrice\":350", json);
        Assert.DoesNotContain("EstimateTotal\":350", json);
    }

    [Fact]
    public async Task AuthorizedFinancial_ReturnsResolverDerivedAmounts()
    {
        await using var db = CreateDb();
        var test = TestDef(TenantId, "Complete Blood Count", "CBC001", "Haematology");
        var variant = ActiveVariant("LAB-CBC", "CBC Lab Charge");
        test.ServiceVariantId = variant.Id;
        SeedPrice(db, variant.Id, 350m);
        db.LaboratoryTestDefinitions.Add(test);
        db.ServiceVariants.Add(variant);
        await db.SaveChangesAsync();

        var result = await Catalog(db, financialClaims: true).GetOrderSummary(new LaboratoryOrderSummaryRequest
        {
            Items = new List<LaboratoryOrderSummaryItemRequest>
            {
                new() { TestDefinitionId = test.Id },
            },
        });

        var ok = Assert.IsType<OkObjectResult>(result);
        var summary = Assert.IsType<LaboratoryOrderSummaryDto>(ok.Value);
        Assert.True(summary.FinancialAmountsVisible);
        Assert.Equal(350m, summary.EstimateTotal);
        Assert.Equal(350m, summary.Lines[0].UnitPrice);
        Assert.Equal(350m, summary.Lines[0].LineEstimate);
        Assert.Equal(1, summary.Lines[0].Quantity);
        Assert.Equal(LaboratoryCommercialStates.Mapped, summary.Lines[0].CommercialState);
    }

    [Fact]
    public async Task Unmapped_DistinctFromUnpriced_AndNonBillable()
    {
        await using var db = CreateDb();
        var unmapped = TestDef(TenantId, "Unmapped", "UM1", "Haematology");
        var nonBillable = TestDef(TenantId, "NonBillable", "NB1", "Haematology");
        nonBillable.IsNonBillable = true;
        var unpriced = TestDef(TenantId, "Unpriced", "UP1", "Haematology");
        var variant = ActiveVariant("LAB-UP", "Unpriced Charge");
        unpriced.ServiceVariantId = variant.Id;
        db.LaboratoryTestDefinitions.AddRange(unmapped, nonBillable, unpriced);
        db.ServiceVariants.Add(variant);
        await db.SaveChangesAsync();

        var result = await Catalog(db, financialClaims: true).GetOrderSummary(new LaboratoryOrderSummaryRequest
        {
            Items = new List<LaboratoryOrderSummaryItemRequest>
            {
                new() { TestDefinitionId = unmapped.Id },
                new() { TestDefinitionId = nonBillable.Id },
                new() { TestDefinitionId = unpriced.Id },
            },
        });

        var ok = Assert.IsType<OkObjectResult>(result);
        var summary = Assert.IsType<LaboratoryOrderSummaryDto>(ok.Value);
        Assert.Equal(3, summary.LineCount);
        Assert.Equal(LaboratoryCommercialStates.Unmapped, summary.Lines[0].CommercialState);
        Assert.Equal(LaboratoryCommercialStates.NonBillable, summary.Lines[1].CommercialState);
        Assert.Equal(LaboratoryCommercialStates.Unpriced, summary.Lines[2].CommercialState);
        Assert.All(summary.Lines, l => Assert.Null(l.UnitPrice));
        Assert.Null(summary.EstimateTotal);
    }

    [Fact]
    public async Task CrossTenantTest_ReturnsNotFound()
    {
        await using var db = CreateDb();
        var foreign = TestDef(OtherTenantId, "Foreign", "FX1", "Haematology");
        db.LaboratoryTestDefinitions.Add(foreign);
        await db.SaveChangesAsync();

        var result = await Catalog(db).GetOrderSummary(new LaboratoryOrderSummaryRequest
        {
            Items = new List<LaboratoryOrderSummaryItemRequest>
            {
                new() { TestDefinitionId = foreign.Id },
            },
        });

        Assert.IsType<NotFoundObjectResult>(result);
    }

    [Fact]
    public async Task OrderSummary_DoesNotCreateOpdBillOrItems()
    {
        await using var db = CreateDb();
        var test = TestDef(TenantId, "CBC", "CBC001", "Haematology");
        db.LaboratoryTestDefinitions.Add(test);
        await db.SaveChangesAsync();

        var billsBefore = await db.OpdBills.CountAsync();
        var itemsBefore = await db.OpdBillItems.CountAsync();

        var result = await Catalog(db, financialClaims: true).GetOrderSummary(new LaboratoryOrderSummaryRequest
        {
            Items = new List<LaboratoryOrderSummaryItemRequest>
            {
                new() { TestDefinitionId = test.Id },
            },
        });

        Assert.IsType<OkObjectResult>(result);
        Assert.Equal(billsBefore, await db.OpdBills.CountAsync());
        Assert.Equal(itemsBefore, await db.OpdBillItems.CountAsync());
    }

    [Fact]
    public async Task MultiTest_KeepsDistinctLines()
    {
        await using var db = CreateDb();
        var a = TestDef(TenantId, "Test A", "A1", "Haematology");
        var b = TestDef(TenantId, "Test B", "B1", "Chemistry");
        db.LaboratoryTestDefinitions.AddRange(a, b);
        await db.SaveChangesAsync();

        var result = await Catalog(db).GetOrderSummary(new LaboratoryOrderSummaryRequest
        {
            Items = new List<LaboratoryOrderSummaryItemRequest>
            {
                new() { TestDefinitionId = a.Id },
                new() { TestDefinitionId = b.Id },
            },
        });

        var ok = Assert.IsType<OkObjectResult>(result);
        var summary = Assert.IsType<LaboratoryOrderSummaryDto>(ok.Value);
        Assert.Equal(2, summary.SelectedItemCount);
        Assert.Equal(2, summary.LineCount);
        Assert.Contains(summary.Lines, l => l.LocalCode == "A1");
        Assert.Contains(summary.Lines, l => l.LocalCode == "B1");
    }

    private static LaboratoryCatalogController Catalog(AppDbContext db, bool financialClaims = false)
    {
        var audit = new Mock<IAuditService>();
        audit.Setup(a => a.StageAsync(
                It.IsAny<Guid>(), It.IsAny<string>(), It.IsAny<string>(), It.IsAny<Guid?>(),
                It.IsAny<string?>(), It.IsAny<string?>(), It.IsAny<string?>()))
            .Returns(Task.CompletedTask);
        var commercial = new LaboratoryCommercialMappingService(
            db,
            new ChargeCatalogResolver(db),
            audit.Object);
        var controller = new LaboratoryCatalogController(db, commercial);
        controller.ControllerContext = Ctx(financialClaims);
        return controller;
    }

    private static ControllerContext Ctx(bool financialClaims = false)
    {
        var claims = new List<Claim>
        {
            new("TenantId", TenantId.ToString()),
            new("sub", UserId.ToString()),
        };
        if (financialClaims)
            claims.Add(new Claim("permission", "bill.view"));

        return new ControllerContext
        {
            HttpContext = new DefaultHttpContext
            {
                User = new ClaimsPrincipal(new ClaimsIdentity(claims, "test")),
            },
        };
    }

    private static LaboratoryTestDefinition TestDef(
        Guid tenantId, string name, string code, string category) =>
        new()
        {
            Id = Guid.NewGuid(),
            TenantId = tenantId,
            Name = name,
            LocalCode = code,
            Category = category,
            IsActive = true,
            IsNonBillable = false,
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow,
        };

    private static ServiceVariant ActiveVariant(string code, string name) =>
        new()
        {
            Id = Guid.NewGuid(),
            CatalogServiceId = Guid.NewGuid(),
            VariantName = name,
            VariantCode = code,
            PriceType = "FIXED",
            IsActive = true,
            Status = "active",
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow,
        };

    private static void SeedPrice(AppDbContext db, Guid variantId, decimal amount)
    {
        db.VariantPrices.Add(new VariantPrice
        {
            Id = Guid.NewGuid(),
            VariantId = variantId,
            Amount = amount,
            EffectiveFrom = DateOnly.FromDateTime(DateTime.UtcNow.AddDays(-1)),
            IsActive = true,
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow,
        });
    }

    private static string AttributeOf(Type type, string method) =>
        type.GetMethods(BindingFlags.Instance | BindingFlags.Public | BindingFlags.DeclaredOnly)
            .Single(m => m.Name == method)
            .GetCustomAttributes(typeof(RequirePermissionAttribute), false)
            .Cast<RequirePermissionAttribute>()
            .Single()
            .PermissionCode;

    private static AppDbContext CreateDb() =>
        new(new DbContextOptionsBuilder<AppDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString("N"))
            .Options, new HttpContextAccessor());
}
