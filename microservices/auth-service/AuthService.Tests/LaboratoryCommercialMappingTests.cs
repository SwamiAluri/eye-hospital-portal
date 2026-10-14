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

/// <summary>L3-COM-01 Laboratory commercial mapping / chargeability foundation.</summary>
public class LaboratoryCommercialMappingTests
{
    private static readonly Guid UserId = Guid.Parse("11111111-1111-1111-1111-111111111111");
    private static readonly Guid TenantId = Guid.Parse("22222222-2222-2222-2222-222222222222");
    private static readonly Guid OtherTenantId = Guid.Parse("33333333-3333-3333-3333-333333333333");

    [Fact]
    public void CommercialMutations_RequirePatientUpdate_NotBillAdmin()
    {
        Assert.Equal(
            "patient.update",
            AttributeOf(typeof(LaboratoryCatalogController), nameof(LaboratoryCatalogController.MapServiceVariant)));
        Assert.Equal(
            "patient.update",
            AttributeOf(typeof(LaboratoryCatalogController), nameof(LaboratoryCatalogController.UnmapServiceVariant)));
        Assert.Equal(
            "patient.update",
            AttributeOf(typeof(LaboratoryCatalogController), nameof(LaboratoryCatalogController.SetNonBillable)));
        Assert.Equal(
            "patient.update",
            AttributeOf(typeof(LaboratoryCatalogController), nameof(LaboratoryCatalogController.SearchServiceVariants)));
        Assert.Equal(
            "patient.view",
            AttributeOf(typeof(LaboratoryCatalogController), nameof(LaboratoryCatalogController.GetCommercialState)));
    }

    [Fact]
    public async Task MapServiceVariant_ValidActive_SucceedsAndAudits()
    {
        await using var db = CreateDb();
        var audit = new Mock<IAuditService>();
        audit.Setup(a => a.StageAsync(
                It.IsAny<Guid>(), It.IsAny<string>(), It.IsAny<string>(), It.IsAny<Guid?>(),
                It.IsAny<string?>(), It.IsAny<string?>(), It.IsAny<string?>()))
            .Returns(Task.CompletedTask);

        var test = TestDef(TenantId, "Complete Blood Count", "CBC001", "Haematology");
        var variant = ActiveVariant("LAB-CBC", "CBC Lab Charge");
        SeedPrice(db, variant.Id, 350m);
        db.LaboratoryTestDefinitions.Add(test);
        db.ServiceVariants.Add(variant);
        await db.SaveChangesAsync();

        var result = await Catalog(db, audit).MapServiceVariant(
            test.Id,
            new LaboratoryCommercialMapRequest { ServiceVariantId = variant.Id });

        var ok = Assert.IsType<OkObjectResult>(result);
        var state = Assert.IsType<LaboratoryCommercialStateDto>(ok.Value);
        Assert.Equal(LaboratoryCommercialStates.Mapped, state.CommercialState);
        Assert.Equal(variant.Id, state.ServiceVariantId);
        Assert.True(state.FinanciallyActionable);
        Assert.Equal(variant.Id, (await db.LaboratoryTestDefinitions.SingleAsync()).ServiceVariantId);

        audit.Verify(a => a.StageAsync(
            UserId,
            "LaboratoryCommercialMap",
            "LaboratoryTestDefinition",
            test.Id,
            It.IsAny<string?>(),
            It.IsAny<string?>(),
            It.IsAny<string?>()), Times.Once);
    }

    [Fact]
    public async Task MapServiceVariant_InactiveRejected()
    {
        await using var db = CreateDb();
        var test = TestDef(TenantId, "CBC", "CBC001", "Haematology");
        var variant = ActiveVariant("LAB-X", "Inactive");
        variant.IsActive = false;
        db.LaboratoryTestDefinitions.Add(test);
        db.ServiceVariants.Add(variant);
        await db.SaveChangesAsync();

        var result = await Catalog(db).MapServiceVariant(
            test.Id,
            new LaboratoryCommercialMapRequest { ServiceVariantId = variant.Id });

        Assert.IsType<BadRequestObjectResult>(result);
        Assert.Null((await db.LaboratoryTestDefinitions.SingleAsync()).ServiceVariantId);
    }

    [Fact]
    public async Task MapServiceVariant_OtherTenantTest_Rejected()
    {
        await using var db = CreateDb();
        var otherTest = TestDef(OtherTenantId, "Other CBC", "CBC-X", "Haematology");
        var variant = ActiveVariant("LAB-CBC", "CBC");
        db.LaboratoryTestDefinitions.Add(otherTest);
        db.ServiceVariants.Add(variant);
        await db.SaveChangesAsync();

        var result = await Catalog(db).MapServiceVariant(
            otherTest.Id,
            new LaboratoryCommercialMapRequest { ServiceVariantId = variant.Id });

        Assert.IsType<NotFoundResult>(result);
        Assert.Null((await db.LaboratoryTestDefinitions.SingleAsync()).ServiceVariantId);
    }

    [Fact]
    public async Task UnmapServiceVariant_Succeeds()
    {
        await using var db = CreateDb();
        var variant = ActiveVariant("LAB-CBC", "CBC");
        var test = TestDef(TenantId, "CBC", "CBC001", "Haematology");
        test.ServiceVariantId = variant.Id;
        db.ServiceVariants.Add(variant);
        db.LaboratoryTestDefinitions.Add(test);
        await db.SaveChangesAsync();

        var result = await Catalog(db).UnmapServiceVariant(test.Id);
        var ok = Assert.IsType<OkObjectResult>(result);
        var state = Assert.IsType<LaboratoryCommercialStateDto>(ok.Value);
        Assert.Equal(LaboratoryCommercialStates.Unmapped, state.CommercialState);
        Assert.Null((await db.LaboratoryTestDefinitions.SingleAsync()).ServiceVariantId);
    }

    [Fact]
    public async Task SetNonBillable_Succeeds_AndDistinguishesFromUnmapped()
    {
        await using var db = CreateDb();
        var unmapped = TestDef(TenantId, "Lipid", "LIPID001", "Biochemistry");
        var nonBillable = TestDef(TenantId, "Internal QC", "QC-INT", "Quality");
        db.LaboratoryTestDefinitions.AddRange(unmapped, nonBillable);
        await db.SaveChangesAsync();

        var set = await Catalog(db).SetNonBillable(
            nonBillable.Id,
            new LaboratoryNonBillableRequest { IsNonBillable = true });
        var ok = Assert.IsType<OkObjectResult>(set);
        var nb = Assert.IsType<LaboratoryCommercialStateDto>(ok.Value);
        Assert.Equal(LaboratoryCommercialStates.NonBillable, nb.CommercialState);

        var um = await Catalog(db).GetCommercialState(unmapped.Id);
        var umOk = Assert.IsType<OkObjectResult>(um);
        var umState = Assert.IsType<LaboratoryCommercialStateDto>(umOk.Value);
        Assert.Equal(LaboratoryCommercialStates.Unmapped, umState.CommercialState);
        Assert.NotEqual(umState.CommercialState, nb.CommercialState);
    }

    [Fact]
    public async Task NonBillable_WithServiceVariant_Rejected()
    {
        await using var db = CreateDb();
        var variant = ActiveVariant("LAB-CBC", "CBC");
        var test = TestDef(TenantId, "CBC", "CBC001", "Haematology");
        test.ServiceVariantId = variant.Id;
        db.ServiceVariants.Add(variant);
        db.LaboratoryTestDefinitions.Add(test);
        await db.SaveChangesAsync();

        var result = await Catalog(db).SetNonBillable(
            test.Id,
            new LaboratoryNonBillableRequest { IsNonBillable = true });

        Assert.IsType<BadRequestObjectResult>(result);
        Assert.False((await db.LaboratoryTestDefinitions.SingleAsync()).IsNonBillable);
        Assert.Equal(variant.Id, (await db.LaboratoryTestDefinitions.SingleAsync()).ServiceVariantId);
    }

    [Fact]
    public async Task Map_WhileNonBillable_Rejected()
    {
        await using var db = CreateDb();
        var variant = ActiveVariant("LAB-CBC", "CBC");
        var test = TestDef(TenantId, "CBC", "CBC001", "Haematology");
        test.IsNonBillable = true;
        db.ServiceVariants.Add(variant);
        db.LaboratoryTestDefinitions.Add(test);
        await db.SaveChangesAsync();

        var result = await Catalog(db).MapServiceVariant(
            test.Id,
            new LaboratoryCommercialMapRequest { ServiceVariantId = variant.Id });

        Assert.IsType<BadRequestObjectResult>(result);
    }

    [Fact]
    public async Task NullServiceVariant_RemainsUnmapped_UnlessExplicitNonBillable()
    {
        await using var db = CreateDb();
        var test = TestDef(TenantId, "CBC", "CBC001", "Haematology");
        db.LaboratoryTestDefinitions.Add(test);
        await db.SaveChangesAsync();

        var result = await Catalog(db).GetCommercialState(test.Id);
        var ok = Assert.IsType<OkObjectResult>(result);
        var state = Assert.IsType<LaboratoryCommercialStateDto>(ok.Value);
        Assert.Null(state.ServiceVariantId);
        Assert.False(state.IsNonBillable);
        Assert.Equal(LaboratoryCommercialStates.Unmapped, state.CommercialState);
    }

    [Fact]
    public async Task Resolver_MappedWhenPriced_UnpricedWhenNoPrice()
    {
        await using var db = CreateDb();
        var pricedVariant = ActiveVariant("LAB-P", "Priced");
        var unpricedVariant = ActiveVariant("LAB-U", "Unpriced");
        SeedPrice(db, pricedVariant.Id, 120m);
        var priced = TestDef(TenantId, "Priced Test", "PT1", "Haematology");
        priced.ServiceVariantId = pricedVariant.Id;
        var unpriced = TestDef(TenantId, "Unpriced Test", "UT1", "Haematology");
        unpriced.ServiceVariantId = unpricedVariant.Id;
        db.ServiceVariants.AddRange(pricedVariant, unpricedVariant);
        db.LaboratoryTestDefinitions.AddRange(priced, unpriced);
        await db.SaveChangesAsync();

        var mapped = Assert.IsType<LaboratoryCommercialStateDto>(
            Assert.IsType<OkObjectResult>(await Catalog(db).GetCommercialState(priced.Id)).Value);
        var bare = Assert.IsType<LaboratoryCommercialStateDto>(
            Assert.IsType<OkObjectResult>(await Catalog(db).GetCommercialState(unpriced.Id)).Value);

        Assert.Equal(LaboratoryCommercialStates.Mapped, mapped.CommercialState);
        Assert.Equal(nameof(ChargeResolveKind.Mapped), mapped.ResolverKind);
        Assert.Equal(LaboratoryCommercialStates.Unpriced, bare.CommercialState);
        Assert.Equal(nameof(ChargeResolveKind.Unpriced), bare.ResolverKind);
    }

    [Fact]
    public async Task SearchTests_ExposesCommercialState_NoUnitPriceField()
    {
        await using var db = CreateDb();
        var test = TestDef(TenantId, "CBC", "CBC001", "Haematology");
        db.LaboratoryTestDefinitions.Add(test);
        await db.SaveChangesAsync();

        var result = await Catalog(db).SearchTests(search: "CBC");
        var ok = Assert.IsType<OkObjectResult>(result);
        var json = JsonSerializer.Serialize(ok.Value);
        Assert.Contains("UNMAPPED", json);
        Assert.Contains("commercialState", json);
        Assert.DoesNotContain("unitPrice", json, StringComparison.OrdinalIgnoreCase);
    }

    [Fact]
    public async Task CreateFromCatalog_UnmappedTest_StillWorks_NoOpdBillMutation()
    {
        await using var db = CreateDb();
        SeedDoctor(db);
        var patient = new Patient
        {
            Id = Guid.NewGuid(),
            TenantId = TenantId,
            FirstName = "Pat",
            LastName = "Lab",
            MedicalRecordNumber = "MRN-COM01",
            DateOfBirth = new DateTime(1990, 1, 1),
            Gender = "unknown",
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow,
        };
        db.Patients.Add(patient);
        var cbc001 = TestDef(TenantId, "Complete Blood Count (CBC)", "CBC001", "Haematology");
        cbc001.SpecimenOptions.Add(Specimen(cbc001.Id, "Blood (EDTA)"));
        var cbcPanel = TestDef(TenantId, "Complete Blood Count (CBC)", "CBC", "Pre-Operative Panel");
        cbcPanel.SpecimenOptions.Add(Specimen(cbcPanel.Id, "Blood"));
        db.LaboratoryTestDefinitions.AddRange(cbc001, cbcPanel);
        await db.SaveChangesAsync();

        var billsBefore = await db.OpdBills.CountAsync();
        var itemsBefore = await db.OpdBillItems.CountAsync();

        var documents = new Mock<ILabReportCanonicalDocumentService>();
        documents
            .Setup(d => d.PopulateCanonicalAsync(It.IsAny<Guid>(), It.IsAny<IReadOnlyList<LabReport>>(), It.IsAny<CancellationToken>()))
            .Returns(Task.CompletedTask);
        var reports = new LabReportsController(db, documents.Object, Microsoft.Extensions.Logging.Abstractions.NullLogger<LabReportsController>.Instance);
        reports.ControllerContext = Ctx();

        var result = await reports.CreateFromCatalog(new LaboratoryCatalogOrderRequest
        {
            PatientId = patient.Id,
            TestDefinitionId = cbc001.Id,
            OrderedById = Guid.Parse("44444444-4444-4444-4444-444444444444"),
            ClinicalIndication = "COM-01 regression",
            Priority = "routine",
            SpecimenType = "Blood (EDTA)",
        });

        Assert.IsType<CreatedAtActionResult>(result);
        Assert.Equal(1, await db.LabReports.CountAsync());
        Assert.Equal(billsBefore, await db.OpdBills.CountAsync());
        Assert.Equal(itemsBefore, await db.OpdBillItems.CountAsync());

        // CBC001 and CBC remain distinct catalog identities.
        Assert.Equal(2, await db.LaboratoryTestDefinitions.CountAsync());
        Assert.Contains(await db.LaboratoryTestDefinitions.ToListAsync(), t => t.LocalCode == "CBC001");
        Assert.Contains(await db.LaboratoryTestDefinitions.ToListAsync(), t => t.LocalCode == "CBC");
    }

    [Fact]
    public async Task CreateTest_RejectsNonBillablePlusServiceVariant()
    {
        await using var db = CreateDb();
        var variant = ActiveVariant("LAB-X", "X");
        db.ServiceVariants.Add(variant);
        await db.SaveChangesAsync();

        var result = await Catalog(db).CreateTest(new LaboratoryTestDefinitionWriteRequest
        {
            Name = "Bad",
            LocalCode = "BAD1",
            IsNonBillable = true,
            ServiceVariantId = variant.Id,
            SpecimenTypes = new List<string> { "Blood" },
        });

        Assert.IsType<BadRequestObjectResult>(result);
        Assert.Equal(0, await db.LaboratoryTestDefinitions.CountAsync());
    }

    private static void SeedDoctor(AppDbContext db)
    {
        var role = new AuthService.Models.Identity.AppRole
        {
            Id = Guid.NewGuid(),
            TenantId = TenantId,
            Name = "Doctor",
            NormalizedName = "DOCTOR",
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow,
        };
        var user = new AuthService.Models.Identity.AppUser
        {
            Id = Guid.Parse("44444444-4444-4444-4444-444444444444"),
            TenantId = TenantId,
            UserName = "doc@test.local",
            NormalizedUserName = "DOC@TEST.LOCAL",
            Email = "doc@test.local",
            FirstName = "Ada",
            LastName = "Doctor",
            UserType = "Doctor",
            UserStatus = "active",
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow,
        };
        db.Roles.Add(role);
        db.Users.Add(user);
        db.Set<AuthService.Models.Identity.AppUserRole>().Add(
            new AuthService.Models.Identity.AppUserRole { UserId = user.Id, RoleId = role.Id, IsActive = true });
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

    private static LaboratoryTestSpecimenOption Specimen(Guid testId, string type) =>
        new()
        {
            Id = Guid.NewGuid(),
            TenantId = TenantId,
            TestDefinitionId = testId,
            SpecimenType = type,
            IsDefault = true,
            DisplayOrder = 0,
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

    private static LaboratoryCatalogController Catalog(AppDbContext db, Mock<IAuditService>? audit = null)
    {
        var auditMock = audit ?? new Mock<IAuditService>();
        auditMock.Setup(a => a.StageAsync(
                It.IsAny<Guid>(), It.IsAny<string>(), It.IsAny<string>(), It.IsAny<Guid?>(),
                It.IsAny<string?>(), It.IsAny<string?>(), It.IsAny<string?>()))
            .Returns(Task.CompletedTask);
        var commercial = new LaboratoryCommercialMappingService(
            db,
            new ChargeCatalogResolver(db),
            auditMock.Object);
        var controller = new LaboratoryCatalogController(db, commercial);
        controller.ControllerContext = Ctx();
        return controller;
    }

    private static ControllerContext Ctx() =>
        new()
        {
            HttpContext = new DefaultHttpContext
            {
                User = new ClaimsPrincipal(new ClaimsIdentity(new[]
                {
                    new Claim("TenantId", TenantId.ToString()),
                    new Claim("sub", UserId.ToString()),
                }, "test")),
            },
        };

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
