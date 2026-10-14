using System.Reflection;
using System.Security.Claims;
using System.Text.Json;
using AuthService.Authorization;
using AuthService.Context;
using AuthService.Controllers;
using AuthService.Models.Domain;
using AuthService.Models.Identity;
using AuthService.Services;
// UsersController referenced for user.view doctor-search contract regression.
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging.Abstractions;
using Moq;
using Xunit;

namespace AuthService.Tests;

public class LaboratoryCatalogTests
{
    private static readonly Guid UserId = Guid.Parse("11111111-1111-1111-1111-111111111111");
    private static readonly Guid TenantId = Guid.Parse("22222222-2222-2222-2222-222222222222");
    private static readonly Guid OtherTenantId = Guid.Parse("33333333-3333-3333-3333-333333333333");
    private static readonly Guid DoctorId = Guid.Parse("44444444-4444-4444-4444-444444444444");
    private static readonly Guid NonDoctorId = Guid.Parse("55555555-5555-5555-5555-555555555555");

    [Fact]
    public void CatalogSearchEndpoints_RequirePatientView()
    {
        Assert.Equal("patient.view", AttributeOf(typeof(LaboratoryCatalogController), nameof(LaboratoryCatalogController.SearchTests)));
        Assert.Equal("patient.view", AttributeOf(typeof(LaboratoryCatalogController), nameof(LaboratoryCatalogController.SearchPanels)));
    }

    [Fact]
    public void CatalogCreateAndCatalogOrder_RequirePatientUpdate()
    {
        Assert.Equal("patient.update", AttributeOf(typeof(LaboratoryCatalogController), nameof(LaboratoryCatalogController.CreateTest)));
        Assert.Equal("patient.update", AttributeOf(typeof(LabReportsController), nameof(LabReportsController.CreateFromCatalog)));
    }

    [Fact]
    public void OrderingClinicianSearch_RequiresPatientView_NotUserView()
    {
        Assert.Equal(
            "patient.view",
            AttributeOf(typeof(LaboratoryCatalogController), nameof(LaboratoryCatalogController.SearchOrderingClinicians)));
        // UsersController doctor search remains broad user.view — Laboratory must not depend on it.
        Assert.Equal(
            "user.view",
            AttributeOf(typeof(UsersController), nameof(UsersController.SearchDoctors)));
    }

    [Fact]
    public async Task SearchOrderingClinicians_ReturnsActiveDoctors_ExcludesNonDoctors()
    {
        await using var db = CreateDb();
        SeedDoctor(db);
        SeedNonDoctor(db);
        await db.SaveChangesAsync();

        var result = await Catalog(db).SearchOrderingClinicians(search: "Ada", take: 20);
        var ok = Assert.IsType<OkObjectResult>(result);
        var json = JsonSerializer.Serialize(ok.Value);
        Assert.Contains("Ada", json);
        Assert.Contains(DoctorId.ToString(), json);
        Assert.DoesNotContain(NonDoctorId.ToString(), json);
        Assert.DoesNotContain("Ned", json);
    }

    [Fact]
    public async Task SearchOrderingClinicians_EmptyMatch_ReturnsOkEmpty_NotUnauthorized()
    {
        await using var db = CreateDb();
        SeedDoctor(db);
        await db.SaveChangesAsync();
        var result = await Catalog(db).SearchOrderingClinicians(search: "zzzz-no-match", take: 20);
        var ok = Assert.IsType<OkObjectResult>(result);
        var json = JsonSerializer.Serialize(ok.Value);
        Assert.Contains("\"count\":0", json);
    }

    [Fact]
    public async Task SearchTests_ReturnsCbcWhenActiveDefinitionExists()
    {
        await using var db = CreateDb();
        var cbc = TestDef(TenantId, "Complete Blood Count", "CBC", "hematology", active: true);
        cbc.SpecimenOptions.Add(Specimen(cbc.Id, "Blood"));
        db.LaboratoryTestDefinitions.Add(cbc);
        await db.SaveChangesAsync();

        var result = await Catalog(db).SearchTests(search: "CBC", activeOnly: true);
        var ok = Assert.IsType<OkObjectResult>(result);
        var json = JsonSerializer.Serialize(ok.Value);
        Assert.Contains("CBC", json);
        Assert.Contains("Complete Blood Count", json);
    }

    [Fact]
    public async Task SearchTests_ReturnsActiveTenantOnly_ExcludesOtherTenantInactiveSoftDeleted()
    {
        await using var db = CreateDb();
        var live = TestDef(TenantId, "CBC", "CBC01", "hematology", active: true);
        var inactive = TestDef(TenantId, "Inactive CBC", "CBC-IN", "hematology", active: false);
        var soft = TestDef(TenantId, "Soft CBC", "CBC-DEL", "hematology", active: true);
        soft.DeletedAt = DateTime.UtcNow;
        var other = TestDef(OtherTenantId, "Other CBC", "CBC-X", "hematology", active: true);
        db.LaboratoryTestDefinitions.AddRange(live, inactive, soft, other);
        await db.SaveChangesAsync();

        var result = await Catalog(db).SearchTests(search: "CBC", activeOnly: true);
        var ok = Assert.IsType<OkObjectResult>(result);
        var json = JsonSerializer.Serialize(ok.Value);
        Assert.Contains("CBC01", json);
        Assert.DoesNotContain("CBC-IN", json);
        Assert.DoesNotContain("CBC-DEL", json);
        Assert.DoesNotContain("CBC-X", json);
    }

    [Fact]
    public async Task SearchPanels_AndMembership_ReturnPanelWithActiveMembers()
    {
        await using var db = CreateDb();
        var t1 = TestDef(TenantId, "Hemoglobin", "HGB", "hematology");
        var t2 = TestDef(TenantId, "WBC", "WBC", "hematology");
        db.LaboratoryTestDefinitions.AddRange(t1, t2);
        var panel = new LaboratoryPanel
        {
            Id = Guid.NewGuid(),
            TenantId = TenantId,
            Name = "CBC Panel",
            LocalCode = "CBC-P",
            Category = "hematology",
            IsActive = true,
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow,
            Items =
            {
                new LaboratoryPanelItem
                {
                    Id = Guid.NewGuid(),
                    TenantId = TenantId,
                    TestDefinitionId = t1.Id,
                    DisplayOrder = 0,
                    IsRequired = true,
                },
                new LaboratoryPanelItem
                {
                    Id = Guid.NewGuid(),
                    TenantId = TenantId,
                    TestDefinitionId = t2.Id,
                    DisplayOrder = 1,
                    IsRequired = true,
                },
            },
        };
        foreach (var item in panel.Items) item.PanelId = panel.Id;
        db.LaboratoryPanels.Add(panel);
        await db.SaveChangesAsync();

        var search = await Catalog(db).SearchPanels(search: "CBC");
        var searchOk = Assert.IsType<OkObjectResult>(search);
        Assert.Contains("CBC-P", JsonSerializer.Serialize(searchOk.Value));

        var detail = await Catalog(db).GetPanel(panel.Id);
        var detailOk = Assert.IsType<OkObjectResult>(detail);
        var detailJson = JsonSerializer.Serialize(detailOk.Value);
        Assert.Contains("Hemoglobin", detailJson);
        Assert.Contains("WBC", detailJson);
    }

    [Fact]
    public async Task CreateTest_PersistsSpecimenOptionsAndAnalytes()
    {
        await using var db = CreateDb();
        var result = await Catalog(db).CreateTest(new LaboratoryTestDefinitionWriteRequest
        {
            Name = "Urinalysis",
            LocalCode = "UA",
            Category = "pathology",
            SpecimenTypes = new List<string> { "Urine" },
            Analytes = new List<LaboratoryAnalyteWriteRequest>
            {
                new() { Name = "pH", LocalCode = "PH", ValueType = "numeric", Unit = "" },
            },
        });

        var created = Assert.IsType<CreatedAtActionResult>(result);
        Assert.Equal(1, await db.LaboratoryTestDefinitions.CountAsync());
        var stored = await db.LaboratoryTestDefinitions
            .Include(t => t.SpecimenOptions)
            .Include(t => t.Analytes)
            .SingleAsync();
        Assert.Equal("UA", stored.LocalCode);
        Assert.Single(stored.SpecimenOptions);
        Assert.Equal("Urine", stored.SpecimenOptions.First().SpecimenType);
        Assert.Single(stored.Analytes);
        Assert.Contains("pH", JsonSerializer.Serialize(created.Value));
    }

    [Fact]
    public async Task CreateFromCatalog_SingleTest_DerivesMetadata_IgnoresClientOverrides()
    {
        await using var db = CreateDb();
        SeedDoctor(db);
        var patient = Patient(TenantId, "Pat", "One", "MRN-1");
        db.Patients.Add(patient);
        var test = TestDef(TenantId, "Complete Blood Count", "CBC", "hematology");
        test.SpecimenOptions.Add(new LaboratoryTestSpecimenOption
        {
            Id = Guid.NewGuid(),
            TenantId = TenantId,
            TestDefinitionId = test.Id,
            SpecimenType = "Blood",
            IsDefault = true,
            DisplayOrder = 0,
        });
        db.LaboratoryTestDefinitions.Add(test);
        await db.SaveChangesAsync();

        // Client cannot submit contradictory name/code/category — DTO has no such fields.
        var request = new LaboratoryCatalogOrderRequest
        {
            PatientId = patient.Id,
            TestDefinitionId = test.Id,
            OrderedById = DoctorId,
            ClinicalIndication = "Pre-op screening",
            Notes = "Fasting",
            Priority = "urgent",
            SpecimenType = "Blood",
        };

        var result = await Reports(db).CreateFromCatalog(request);
        var created = Assert.IsType<CreatedAtActionResult>(result);
        var body = Assert.IsType<LabReport>(created.Value);

        Assert.Equal("Complete Blood Count", body.TestName);
        Assert.Equal("CBC", body.TestCode);
        Assert.Equal("hematology", body.TestCategory);
        Assert.Equal("Blood", body.SpecimenType);
        Assert.Equal(test.Id, body.TestDefinitionId);
        Assert.Null(body.PanelId);
        Assert.Equal(DoctorId, body.OrderedById);
        Assert.Equal("Pre-op screening", body.ClinicalIndication);
        Assert.Equal("Fasting", body.Notes);
        Assert.Equal("urgent", body.Priority);
        Assert.Equal("ordered", body.Status);
        Assert.Single(body.Items);
        Assert.Equal("CBC", body.Items.First().TestCode);

        // Explicit regression: catalog-order DTO has no free-text metadata override fields.
        Assert.Null(typeof(LaboratoryCatalogOrderRequest).GetProperty("TestName"));
        Assert.Null(typeof(LaboratoryCatalogOrderRequest).GetProperty("TestCode"));
        Assert.Null(typeof(LaboratoryCatalogOrderRequest).GetProperty("TestCategory"));
        Assert.Null(typeof(LaboratoryCatalogOrderRequest).GetProperty("OrderedByName"));
    }

    [Fact]
    public async Task CreateFromCatalog_Panel_CreatesMultipleLabReportItems()
    {
        await using var db = CreateDb();
        SeedDoctor(db);
        var patient = Patient(TenantId, "Pat", "Two", "MRN-2");
        db.Patients.Add(patient);
        var t1 = TestDef(TenantId, "Hemoglobin", "HGB", "hematology");
        t1.SpecimenOptions.Add(Specimen(t1.Id, "Blood"));
        var t2 = TestDef(TenantId, "Platelets", "PLT", "hematology");
        t2.SpecimenOptions.Add(Specimen(t2.Id, "Blood"));
        db.LaboratoryTestDefinitions.AddRange(t1, t2);
        var panel = new LaboratoryPanel
        {
            Id = Guid.NewGuid(),
            TenantId = TenantId,
            Name = "CBC Panel",
            LocalCode = "CBC-P",
            Category = "hematology",
            IsActive = true,
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow,
            Items =
            {
                new LaboratoryPanelItem
                {
                    Id = Guid.NewGuid(),
                    TenantId = TenantId,
                    TestDefinitionId = t1.Id,
                    DisplayOrder = 0,
                    IsRequired = true,
                },
                new LaboratoryPanelItem
                {
                    Id = Guid.NewGuid(),
                    TenantId = TenantId,
                    TestDefinitionId = t2.Id,
                    DisplayOrder = 1,
                    IsRequired = true,
                },
            },
        };
        foreach (var i in panel.Items) i.PanelId = panel.Id;
        db.LaboratoryPanels.Add(panel);
        await db.SaveChangesAsync();

        var result = await Reports(db).CreateFromCatalog(new LaboratoryCatalogOrderRequest
        {
            PatientId = patient.Id,
            PanelId = panel.Id,
            OrderedById = DoctorId,
            ClinicalIndication = "Anemia workup",
            Priority = "routine",
        });

        var created = Assert.IsType<CreatedAtActionResult>(result);
        var body = Assert.IsType<LabReport>(created.Value);
        Assert.Equal("CBC Panel", body.TestName);
        Assert.Equal("CBC-P", body.TestCode);
        Assert.Equal(panel.Id, body.PanelId);
        Assert.Null(body.TestDefinitionId);
        Assert.Equal(2, body.Items.Count);
        Assert.Equal(new[] { "HGB", "PLT" }, body.Items.OrderBy(i => i.DisplayOrder).Select(i => i.TestCode).ToArray());
        Assert.Equal(1, await db.LabReports.CountAsync());
        Assert.Equal(2, await db.LabReportItems.CountAsync());
    }

    [Fact]
    public async Task CreateFromCatalog_MultipleTests_OneLabReport_MultipleItems()
    {
        await using var db = CreateDb();
        SeedDoctor(db);
        var patient = Patient(TenantId, "Pat", "Multi", "MRN-M");
        db.Patients.Add(patient);
        var cbc = TestDef(TenantId, "Complete Blood Count", "CBC001", "Haematology");
        cbc.SpecimenOptions.Add(Specimen(cbc.Id, "Blood (EDTA)"));
        var lipid = TestDef(TenantId, "Lipid Profile", "LIPID001", "Biochemistry");
        lipid.SpecimenOptions.Add(Specimen(lipid.Id, "Blood (Serum)"));
        var hba1c = TestDef(TenantId, "HbA1c", "HBA1C", "Biochemistry");
        hba1c.SpecimenOptions.Add(Specimen(hba1c.Id, "Blood (EDTA)"));
        db.LaboratoryTestDefinitions.AddRange(cbc, lipid, hba1c);
        await db.SaveChangesAsync();

        var result = await Reports(db).CreateFromCatalog(new LaboratoryCatalogOrderRequest
        {
            PatientId = patient.Id,
            OrderedById = DoctorId,
            ClinicalIndication = "Pre-op panel",
            Priority = "routine",
            Items =
            {
                new LaboratoryCatalogOrderItemRequest { TestDefinitionId = cbc.Id },
                new LaboratoryCatalogOrderItemRequest { TestDefinitionId = lipid.Id },
                new LaboratoryCatalogOrderItemRequest { TestDefinitionId = hba1c.Id },
            },
        });

        var created = Assert.IsType<CreatedAtActionResult>(result);
        var body = Assert.IsType<LabReport>(created.Value);
        Assert.Equal(1, await db.LabReports.CountAsync());
        Assert.Equal(3, await db.LabReportItems.CountAsync());
        Assert.Equal(3, body.Items.Count);
        Assert.Null(body.TestDefinitionId);
        Assert.Null(body.PanelId);
        Assert.Contains("Complete Blood Count", body.TestName);
        Assert.Contains("Lipid Profile", body.TestName);
        Assert.Equal(
            new[] { "CBC001", "LIPID001", "HBA1C" },
            body.Items.OrderBy(i => i.DisplayOrder).Select(i => i.TestCode).ToArray());
        Assert.All(body.Items, i => Assert.Equal(body.Id, i.LabReportId));
    }

    [Fact]
    public async Task CreateFromCatalog_RejectsDuplicateItems()
    {
        await using var db = CreateDb();
        SeedDoctor(db);
        var patient = Patient(TenantId, "Pat", "Dup", "MRN-D");
        db.Patients.Add(patient);
        var cbc = TestDef(TenantId, "CBC", "CBC001", "Haematology");
        cbc.SpecimenOptions.Add(Specimen(cbc.Id, "Blood"));
        db.LaboratoryTestDefinitions.Add(cbc);
        await db.SaveChangesAsync();

        var result = await Reports(db).CreateFromCatalog(new LaboratoryCatalogOrderRequest
        {
            PatientId = patient.Id,
            OrderedById = DoctorId,
            ClinicalIndication = "Check",
            Items =
            {
                new LaboratoryCatalogOrderItemRequest { TestDefinitionId = cbc.Id },
                new LaboratoryCatalogOrderItemRequest { TestDefinitionId = cbc.Id },
            },
        });

        Assert.IsType<BadRequestObjectResult>(result);
        Assert.Equal(0, await db.LabReports.CountAsync());
    }

    [Fact]
    public async Task CreateFromCatalog_ResponseSerializesWithoutCircularReference()
    {
        await using var db = CreateDb();
        SeedDoctor(db);
        var patient = Patient(TenantId, "Pat", "Ser", "MRN-S");
        db.Patients.Add(patient);
        var test = TestDef(TenantId, "CBC", "CBC001", "Haematology");
        test.SpecimenOptions.Add(Specimen(test.Id, "Blood"));
        db.LaboratoryTestDefinitions.Add(test);
        await db.SaveChangesAsync();

        var result = await Reports(db).CreateFromCatalog(new LaboratoryCatalogOrderRequest
        {
            PatientId = patient.Id,
            TestDefinitionId = test.Id,
            OrderedById = DoctorId,
            ClinicalIndication = "Serialize",
            SpecimenType = "Blood",
        });

        var created = Assert.IsType<CreatedAtActionResult>(result);
        var body = Assert.IsType<LabReport>(created.Value);
        // Regression: LabReport ↔ LabReportItem cycle previously aborted HTTP after 201.
        var json = JsonSerializer.Serialize(body);
        Assert.Contains("CBC001", json);
        Assert.Contains("\"items\"", json, StringComparison.OrdinalIgnoreCase);
        var labReportNav = typeof(LabReportItem).GetProperty("LabReport")!;
        Assert.NotEmpty(labReportNav.GetCustomAttributes(typeof(System.Text.Json.Serialization.JsonIgnoreAttribute), false));
    }

    [Fact]
    public async Task CreateFromCatalog_RejectsInvalidSpecimen_InactiveCatalog_InvalidClinician()
    {
        await using var db = CreateDb();
        SeedDoctor(db);
        SeedNonDoctor(db);
        var patient = Patient(TenantId, "Pat", "Three", "MRN-3");
        db.Patients.Add(patient);
        var multi = TestDef(TenantId, "Culture", "CX", "microbiology");
        multi.SpecimenOptions.Add(Specimen(multi.Id, "Swab"));
        multi.SpecimenOptions.Add(Specimen(multi.Id, "Tissue", isDefault: false, order: 1));
        var inactive = TestDef(TenantId, "Old Test", "OLD", "hematology", active: false);
        inactive.SpecimenOptions.Add(Specimen(inactive.Id, "Blood"));
        db.LaboratoryTestDefinitions.AddRange(multi, inactive);
        await db.SaveChangesAsync();

        var badSpecimen = await Reports(db).CreateFromCatalog(new LaboratoryCatalogOrderRequest
        {
            PatientId = patient.Id,
            TestDefinitionId = multi.Id,
            SpecimenType = "Urine",
            OrderedById = DoctorId,
            ClinicalIndication = "Infection",
        });
        Assert.IsType<BadRequestObjectResult>(badSpecimen);
        Assert.Equal(0, await db.LabReports.IgnoreQueryFilters().CountAsync());

        var inactiveResult = await Reports(db).CreateFromCatalog(new LaboratoryCatalogOrderRequest
        {
            PatientId = patient.Id,
            TestDefinitionId = inactive.Id,
            OrderedById = DoctorId,
            ClinicalIndication = "Infection",
            SpecimenType = "Blood",
        });
        Assert.IsType<BadRequestObjectResult>(inactiveResult);

        var badDoctor = await Reports(db).CreateFromCatalog(new LaboratoryCatalogOrderRequest
        {
            PatientId = patient.Id,
            TestDefinitionId = multi.Id,
            SpecimenType = "Swab",
            OrderedById = NonDoctorId,
            ClinicalIndication = "Infection",
        });
        Assert.IsType<BadRequestObjectResult>(badDoctor);

        var missingCatalog = await Reports(db).CreateFromCatalog(new LaboratoryCatalogOrderRequest
        {
            PatientId = patient.Id,
            TestDefinitionId = Guid.NewGuid(),
            OrderedById = DoctorId,
            ClinicalIndication = "Infection",
            SpecimenType = "Blood",
        });
        Assert.IsType<BadRequestObjectResult>(missingCatalog);
    }

    [Fact]
    public async Task LegacyCreate_ClearsCatalogFks_AndLegacyRowsRemainReadable()
    {
        await using var db = CreateDb();
        var patient = Patient(TenantId, "Legacy", "Patient", "MRN-L");
        db.Patients.Add(patient);
        var legacy = new LabReport
        {
            Id = Guid.NewGuid(),
            TenantId = TenantId,
            PatientId = patient.Id,
            TestName = "Free Text CBC",
            TestCode = "FT-CBC",
            TestCategory = "hematology",
            Priority = "routine",
            Status = "ordered",
            OrderedAt = DateTime.UtcNow,
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow,
            TestDefinitionId = null,
            PanelId = null,
            ClinicalIndication = null,
        };
        db.LabReports.Add(legacy);
        await db.SaveChangesAsync();

        var list = await Reports(db).List(cancellationToken: CancellationToken.None);
        var rows = Assert.IsAssignableFrom<IEnumerable<LabReport>>(Assert.IsType<OkObjectResult>(list).Value).ToList();
        Assert.Contains(rows, r => r.Id == legacy.Id && r.TestName == "Free Text CBC" && r.TestDefinitionId == null);

        var create = await Reports(db).Create(new LabReport
        {
            PatientId = patient.Id,
            TestName = "Manual UA",
            TestCategory = "pathology",
            TestDefinitionId = Guid.NewGuid(),
            PanelId = Guid.NewGuid(),
        });
        var body = Assert.IsType<LabReport>(Assert.IsType<CreatedAtActionResult>(create).Value);
        Assert.Null(body.TestDefinitionId);
        Assert.Null(body.PanelId);
    }

    [Fact]
    public async Task CreateFromCatalog_OtherTenantPatient_Rejected()
    {
        await using var db = CreateDb();
        SeedDoctor(db);
        var foreign = Patient(OtherTenantId, "Other", "Tenant", "MRN-X");
        db.Patients.Add(foreign);
        var test = TestDef(TenantId, "CBC", "CBC", "hematology");
        test.SpecimenOptions.Add(Specimen(test.Id, "Blood"));
        db.LaboratoryTestDefinitions.Add(test);
        await db.SaveChangesAsync();

        var result = await Reports(db).CreateFromCatalog(new LaboratoryCatalogOrderRequest
        {
            PatientId = foreign.Id,
            TestDefinitionId = test.Id,
            OrderedById = DoctorId,
            ClinicalIndication = "Check",
            SpecimenType = "Blood",
        });
        Assert.IsType<BadRequestObjectResult>(result);
        Assert.Equal(0, await db.LabReports.IgnoreQueryFilters().CountAsync());
    }

    private static void SeedDoctor(AppDbContext db)
    {
        var role = new AppRole
        {
            Id = Guid.NewGuid(),
            TenantId = TenantId,
            Name = "Doctor",
            NormalizedName = "DOCTOR",
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow,
        };
        var user = new AppUser
        {
            Id = DoctorId,
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
        db.Set<AppUserRole>().Add(new AppUserRole { UserId = user.Id, RoleId = role.Id, IsActive = true });
    }

    private static void SeedNonDoctor(AppDbContext db)
    {
        var role = new AppRole
        {
            Id = Guid.NewGuid(),
            TenantId = TenantId,
            Name = "Nurse",
            NormalizedName = "NURSE",
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow,
        };
        var user = new AppUser
        {
            Id = NonDoctorId,
            TenantId = TenantId,
            UserName = "nurse@test.local",
            NormalizedUserName = "NURSE@TEST.LOCAL",
            Email = "nurse@test.local",
            FirstName = "Ned",
            LastName = "Nurse",
            UserStatus = "active",
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow,
        };
        db.Roles.Add(role);
        db.Users.Add(user);
        db.UserRoles.Add(new AppUserRole { UserId = user.Id, RoleId = role.Id, IsActive = true });
    }

    private static LaboratoryTestDefinition TestDef(
        Guid tenantId,
        string name,
        string code,
        string category,
        bool active = true) =>
        new()
        {
            Id = Guid.NewGuid(),
            TenantId = tenantId,
            Name = name,
            LocalCode = code,
            Category = category,
            IsActive = active,
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow,
        };

    private static LaboratoryTestSpecimenOption Specimen(
        Guid testId,
        string type,
        bool isDefault = true,
        int order = 0) =>
        new()
        {
            Id = Guid.NewGuid(),
            TenantId = TenantId,
            TestDefinitionId = testId,
            SpecimenType = type,
            IsDefault = isDefault,
            DisplayOrder = order,
        };

    private static Patient Patient(Guid tenantId, string first, string last, string mrn) =>
        new()
        {
            Id = Guid.NewGuid(),
            TenantId = tenantId,
            FirstName = first,
            LastName = last,
            MedicalRecordNumber = mrn,
            DateOfBirth = new DateTime(1990, 1, 1),
            Gender = "unknown",
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow,
        };

    private static LaboratoryCatalogController Catalog(AppDbContext db)
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
        controller.ControllerContext = Ctx();
        return controller;
    }

    private static LabReportsController Reports(AppDbContext db)
    {
        var documents = new Mock<ILabReportCanonicalDocumentService>();
        documents
            .Setup(d => d.PopulateCanonicalAsync(It.IsAny<Guid>(), It.IsAny<IReadOnlyList<LabReport>>(), It.IsAny<CancellationToken>()))
            .Returns(Task.CompletedTask);
        var controller = new LabReportsController(db, documents.Object, NullLogger<LabReportsController>.Instance);
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
