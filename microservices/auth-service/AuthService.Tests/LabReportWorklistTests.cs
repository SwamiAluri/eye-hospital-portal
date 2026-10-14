using System.Reflection;
using System.Security.Claims;
using AuthService.Authorization;
using AuthService.Context;
using AuthService.Controllers;
using AuthService.Models.Domain;
using AuthService.Services;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging.Abstractions;
using Moq;
using Xunit;

namespace AuthService.Tests;

public class LabReportWorklistTests
{
    private static readonly Guid UserId = Guid.Parse("11111111-1111-1111-1111-111111111111");
    private static readonly Guid TenantId = Guid.Parse("22222222-2222-2222-2222-222222222222");
    private static readonly Guid OtherTenantId = Guid.Parse("33333333-3333-3333-3333-333333333333");

    [Fact]
    public void ListEndpoint_RequiresPatientView()
    {
        Assert.Equal(
            "patient.view",
            AttributeOf(typeof(LabReportsController), nameof(LabReportsController.List)));
    }

    /// <summary>
    /// L1 405 regression: collection route must expose GET List (not POST-only Create).
    /// </summary>
    [Fact]
    public void ListEndpoint_IsHttpGet_OnBareCollectionRoute()
    {
        var method = typeof(LabReportsController)
            .GetMethods(BindingFlags.Instance | BindingFlags.Public | BindingFlags.DeclaredOnly)
            .Single(m => m.Name == nameof(LabReportsController.List));

        var httpGet = method.GetCustomAttributes(typeof(HttpGetAttribute), inherit: false)
            .Cast<HttpGetAttribute>()
            .Single();
        Assert.True(string.IsNullOrEmpty(httpGet.Template),
            "List must be [HttpGet] on api/lab-reports (no sub-template), or browsers get 405.");

        Assert.Empty(method.GetCustomAttributes(typeof(HttpPostAttribute), inherit: false));
    }

    [Fact]
    public void CreateEndpoint_RequiresPatientUpdate()
    {
        Assert.Equal(
            "patient.update",
            AttributeOf(typeof(LabReportsController), nameof(LabReportsController.Create)));
    }

    [Fact]
    public async Task List_ReturnsTenantRows_WithPatientIdentity_ExcludesOtherTenantAndSoftDeleted()
    {
        await using var db = CreateDb();
        var patientA = Patient(TenantId, "Alice", "Alpha", "MRN-A");
        var patientB = Patient(TenantId, "Bob", "Beta", "MRN-B");
        var otherPatient = Patient(OtherTenantId, "Other", "Tenant", "MRN-X");
        db.Patients.AddRange(patientA, patientB, otherPatient);

        var live = Lab(TenantId, patientA.Id, "CBC", "ordered");
        var softDeleted = Lab(TenantId, patientB.Id, "BMP", "ordered");
        softDeleted.DeletedAt = DateTime.UtcNow;
        var otherTenant = Lab(OtherTenantId, otherPatient.Id, "CBC", "ordered");
        db.LabReports.AddRange(live, softDeleted, otherTenant);
        await db.SaveChangesAsync();

        var result = await Controller(db).List(cancellationToken: CancellationToken.None);
        var ok = Assert.IsType<OkObjectResult>(result);
        var rows = Assert.IsAssignableFrom<IEnumerable<LabReport>>(ok.Value).ToList();

        Assert.Single(rows);
        Assert.Equal(live.Id, rows[0].Id);
        Assert.Equal("Alice Alpha", rows[0].PatientDisplayName);
        Assert.Equal("MRN-A", rows[0].MedicalRecordNumber);
    }

    [Fact]
    public async Task List_EmptyTenant_ReturnsOkEmptyArray()
    {
        await using var db = CreateDb();
        var result = await Controller(db).List(cancellationToken: CancellationToken.None);
        var ok = Assert.IsType<OkObjectResult>(result);
        Assert.Equal(StatusCodes.Status200OK, ok.StatusCode ?? StatusCodes.Status200OK);
        var rows = Assert.IsAssignableFrom<IEnumerable<LabReport>>(ok.Value).ToList();
        Assert.Empty(rows);
    }

    [Fact]
    public async Task List_MissingTenantClaim_ReturnsUnauthorized()
    {
        await using var db = CreateDb();
        var controller = Controller(db);
        controller.ControllerContext = new ControllerContext
        {
            HttpContext = new DefaultHttpContext
            {
                User = new ClaimsPrincipal(new ClaimsIdentity(new[]
                {
                    new Claim("sub", UserId.ToString()),
                }, "test")),
            },
        };

        var result = await controller.List(cancellationToken: CancellationToken.None);
        Assert.IsType<UnauthorizedResult>(result);
    }

    [Fact]
    public async Task List_FiltersByStatusAndSearch()
    {
        await using var db = CreateDb();
        var patient = Patient(TenantId, "Sam", "Sample", "MRN-42");
        db.Patients.Add(patient);
        db.LabReports.AddRange(
            Lab(TenantId, patient.Id, "Complete Blood Count", "ordered"),
            Lab(TenantId, patient.Id, "Lipid Panel", "completed"));
        await db.SaveChangesAsync();

        var byStatus = await Controller(db).List(status: "ordered", cancellationToken: CancellationToken.None);
        var statusRows = Assert.IsAssignableFrom<IEnumerable<LabReport>>(Assert.IsType<OkObjectResult>(byStatus).Value).ToList();
        Assert.Single(statusRows);
        Assert.Equal("ordered", statusRows[0].Status);

        var bySearch = await Controller(db).List(search: "MRN-42", cancellationToken: CancellationToken.None);
        var searchRows = Assert.IsAssignableFrom<IEnumerable<LabReport>>(Assert.IsType<OkObjectResult>(bySearch).Value).ToList();
        Assert.Equal(2, searchRows.Count);

        var byTest = await Controller(db).List(search: "Lipid", cancellationToken: CancellationToken.None);
        var testRows = Assert.IsAssignableFrom<IEnumerable<LabReport>>(Assert.IsType<OkObjectResult>(byTest).Value).ToList();
        Assert.Single(testRows);
        Assert.Equal("Lipid Panel", testRows[0].TestName);
    }

    [Fact]
    public async Task List_FiltersByPriority_AndClampsTake()
    {
        await using var db = CreateDb();
        var patient = Patient(TenantId, "Pri", "Ority", "MRN-P");
        db.Patients.Add(patient);
        for (var i = 0; i < 5; i++)
        {
            var row = Lab(TenantId, patient.Id, $"Test {i}", "ordered");
            row.Priority = i % 2 == 0 ? "stat" : "routine";
            row.OrderedAt = DateTime.UtcNow.AddMinutes(-i);
            db.LabReports.Add(row);
        }
        await db.SaveChangesAsync();

        var byPriority = await Controller(db).List(priority: "stat", cancellationToken: CancellationToken.None);
        var priorityRows = Assert.IsAssignableFrom<IEnumerable<LabReport>>(Assert.IsType<OkObjectResult>(byPriority).Value).ToList();
        Assert.Equal(3, priorityRows.Count);
        Assert.All(priorityRows, r => Assert.Equal("stat", r.Priority));

        var bounded = await Controller(db).List(take: 2, cancellationToken: CancellationToken.None);
        var boundedRows = Assert.IsAssignableFrom<IEnumerable<LabReport>>(Assert.IsType<OkObjectResult>(bounded).Value).ToList();
        Assert.Equal(2, boundedRows.Count);

        var clampedHigh = await Controller(db).List(take: 9999, cancellationToken: CancellationToken.None);
        var highRows = Assert.IsAssignableFrom<IEnumerable<LabReport>>(Assert.IsType<OkObjectResult>(clampedHigh).Value).ToList();
        Assert.Equal(5, highRows.Count);
    }

    [Fact]
    public async Task Create_DefaultsStatusOrderedAndPriorityRoutine()
    {
        await using var db = CreateDb();
        var patient = Patient(TenantId, "Create", "Patient", "MRN-C");
        db.Patients.Add(patient);
        await db.SaveChangesAsync();

        var request = new LabReport
        {
            PatientId = patient.Id,
            TestName = "HbA1c",
            TestCategory = "biochemistry",
            Status = " ",
            Priority = "",
        };

        var result = await Controller(db).Create(request);
        var created = Assert.IsType<CreatedAtActionResult>(result);
        var body = Assert.IsType<LabReport>(created.Value);
        Assert.Equal("ordered", body.Status);
        Assert.Equal("routine", body.Priority);
        Assert.NotNull(body.OrderedAt);
        Assert.Equal(TenantId, body.TenantId);

        var stored = await db.LabReports.SingleAsync(r => r.Id == body.Id);
        Assert.Equal("ordered", stored.Status);
        Assert.Equal("routine", stored.Priority);
    }

    [Fact]
    public async Task Create_ValidTenantPatient_Succeeds()
    {
        await using var db = CreateDb();
        var patient = Patient(TenantId, "Valid", "Patient", "MRN-OK");
        db.Patients.Add(patient);
        await db.SaveChangesAsync();

        var result = await Controller(db).Create(new LabReport
        {
            PatientId = patient.Id,
            TestName = "CBC",
            TestCategory = "hematology",
        });

        var created = Assert.IsType<CreatedAtActionResult>(result);
        var body = Assert.IsType<LabReport>(created.Value);
        Assert.Equal(patient.Id, body.PatientId);
        Assert.Equal(TenantId, body.TenantId);
        Assert.Equal(1, await db.LabReports.CountAsync());
    }

    [Fact]
    public async Task Create_MissingPatientId_IsRejected_AndCreatesNoRow()
    {
        await using var db = CreateDb();
        var result = await Controller(db).Create(new LabReport
        {
            PatientId = Guid.Empty,
            TestName = "CBC",
            TestCategory = "hematology",
        });

        var bad = Assert.IsType<BadRequestObjectResult>(result);
        Assert.Equal(StatusCodes.Status400BadRequest, bad.StatusCode);
        Assert.Equal(0, await db.LabReports.IgnoreQueryFilters().CountAsync());
    }

    [Fact]
    public async Task Create_NonexistentPatient_IsRejected_AndCreatesNoRow()
    {
        await using var db = CreateDb();
        var result = await Controller(db).Create(new LabReport
        {
            PatientId = Guid.NewGuid(),
            TestName = "CBC",
            TestCategory = "hematology",
        });

        Assert.IsType<BadRequestObjectResult>(result);
        Assert.Equal(0, await db.LabReports.IgnoreQueryFilters().CountAsync());
    }

    [Fact]
    public async Task Create_SoftDeletedPatient_IsRejected_AndCreatesNoRow()
    {
        await using var db = CreateDb();
        var patient = Patient(TenantId, "Gone", "Patient", "MRN-DEL");
        patient.DeletedAt = DateTime.UtcNow;
        db.Patients.Add(patient);
        await db.SaveChangesAsync();

        var result = await Controller(db).Create(new LabReport
        {
            PatientId = patient.Id,
            TestName = "CBC",
            TestCategory = "hematology",
        });

        Assert.IsType<BadRequestObjectResult>(result);
        Assert.Equal(0, await db.LabReports.IgnoreQueryFilters().CountAsync());
    }

    [Fact]
    public async Task Create_OtherTenantPatient_IsRejected_WithoutCreatingRow()
    {
        await using var db = CreateDb();
        var foreign = Patient(OtherTenantId, "Other", "Tenant", "MRN-X");
        db.Patients.Add(foreign);
        await db.SaveChangesAsync();

        var result = await Controller(db).Create(new LabReport
        {
            PatientId = foreign.Id,
            TestName = "CBC",
            TestCategory = "hematology",
        });

        var bad = Assert.IsType<BadRequestObjectResult>(result);
        // Same message as missing/deleted — no cross-tenant existence leak.
        var payload = System.Text.Json.JsonSerializer.Serialize(bad.Value);
        Assert.Contains("Patient not found in this tenant", payload);
        Assert.Equal(0, await db.LabReports.IgnoreQueryFilters().CountAsync());
    }

    [Fact]
    public async Task Create_CallerTenantA_CannotBindTenantBPatient()
    {
        await using var db = CreateDb();
        var tenantBPatient = Patient(OtherTenantId, "Tenant", "B", "MRN-B");
        db.Patients.Add(tenantBPatient);
        await db.SaveChangesAsync();

        // Caller is TenantId (A); patient is OtherTenantId (B).
        var result = await Controller(db).Create(new LabReport
        {
            PatientId = tenantBPatient.Id,
            TestName = "Lipid Panel",
            TestCategory = "biochemistry",
            TenantId = OtherTenantId, // client-supplied tenant must be overwritten/ignored after gate
        });

        Assert.IsType<BadRequestObjectResult>(result);
        Assert.Equal(0, await db.LabReports.IgnoreQueryFilters().CountAsync());
    }

    [Fact]
    public async Task GetByPatient_StillReturnsPatientScopedRows()
    {
        await using var db = CreateDb();
        var p1 = Patient(TenantId, "One", "A", "MRN-1");
        var p2 = Patient(TenantId, "Two", "B", "MRN-2");
        db.Patients.AddRange(p1, p2);
        db.LabReports.AddRange(
            Lab(TenantId, p1.Id, "Test A", "ordered"),
            Lab(TenantId, p2.Id, "Test B", "ordered"));
        await db.SaveChangesAsync();

        var result = await Controller(db).GetByPatient(p1.Id, cancellationToken: CancellationToken.None);
        var rows = Assert.IsAssignableFrom<IEnumerable<LabReport>>(Assert.IsType<OkObjectResult>(result).Value).ToList();
        Assert.Single(rows);
        Assert.Equal(p1.Id, rows[0].PatientId);
    }

    private static LabReportsController Controller(AppDbContext db)
    {
        var documents = new Mock<ILabReportCanonicalDocumentService>();
        documents
            .Setup(d => d.PopulateCanonicalAsync(It.IsAny<Guid>(), It.IsAny<IReadOnlyList<LabReport>>(), It.IsAny<CancellationToken>()))
            .Returns(Task.CompletedTask);

        var controller = new LabReportsController(db, documents.Object, NullLogger<LabReportsController>.Instance);
        var identity = new ClaimsIdentity(new[]
        {
            new Claim("TenantId", TenantId.ToString()),
            new Claim("sub", UserId.ToString()),
        }, "test");
        controller.ControllerContext = new ControllerContext
        {
            HttpContext = new DefaultHttpContext { User = new ClaimsPrincipal(identity) },
        };
        return controller;
    }

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

    private static LabReport Lab(Guid tenantId, Guid patientId, string testName, string status) =>
        new()
        {
            Id = Guid.NewGuid(),
            TenantId = tenantId,
            PatientId = patientId,
            TestName = testName,
            TestCategory = "hematology",
            Priority = "routine",
            Status = status,
            OrderedAt = DateTime.UtcNow,
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow,
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
