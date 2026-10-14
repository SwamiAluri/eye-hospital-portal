using System.Security.Claims;
using System.Text.Json;
using AuthService.Authorization;
using AuthService.Context;
using AuthService.Controllers;
using AuthService.Models;
using AuthService.Models.Domain;
using AuthService.Models.Identity;
using AuthService.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Xunit;

namespace AuthService.Tests;

public class Patient360OctReadTests
{
    private static readonly Guid UserId = Guid.Parse("11111111-1111-1111-1111-111111111111");
    private static readonly Guid TenantId = Guid.Parse("22222222-2222-2222-2222-222222222222");
    private static readonly Guid OtherTenantId = Guid.Parse("33333333-3333-3333-3333-333333333333");
    private static readonly Guid PatientId = Guid.Parse("44444444-4444-4444-4444-444444444444");
    private static readonly Guid OtherPatientId = Guid.Parse("55555555-5555-5555-5555-555555555555");
    private static readonly Guid BranchA = Guid.Parse("aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa");
    private static readonly Guid BranchB = Guid.Parse("bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb");
    private static readonly Guid BranchC = Guid.Parse("cccccccc-cccc-cccc-cccc-cccccccccccc");

    private static readonly JsonSerializerOptions Camel = new() { PropertyNamingPolicy = JsonNamingPolicy.CamelCase };

    [Fact]
    public void Endpoint_RequiresDiagnosticOctRead()
    {
        var method = typeof(Patient360OctController).GetMethod(nameof(Patient360OctController.GetPatient360Oct));
        var permission = Assert.Single(method!.GetCustomAttributes(typeof(RequirePermissionAttribute), false).Cast<RequirePermissionAttribute>());
        var route = Assert.Single(method.GetCustomAttributes(typeof(HttpGetAttribute), false).Cast<HttpGetAttribute>());
        Assert.Equal("diagnostic.oct.read", permission.PermissionCode);
        Assert.Equal("patients/{patientId:guid}/patient-360", route.Template);
        Assert.NotEqual("patient.view", permission.PermissionCode);
        Assert.NotEqual("examination.view", permission.PermissionCode);
    }

    [Fact]
    public async Task DiagnosticOctRead_AllowsTheRead_AndSubstitutesDoNot()
    {
        Assert.True(await Authorize("diagnostic.oct.read"));
        Assert.False(await Authorize("patient.view"));
        Assert.False(await Authorize("examination.view"));
        Assert.False(await Authorize("CLINICAL:BIOMETRY:VIEW"));
        Assert.False(await Authorize("CLINICAL:SCREENING:VIEW"));
        Assert.False(await Authorize("DIAGNOSTIC:OCT:VIEW"));
        Assert.False(await Authorize("view:oct_imaging"));
        Assert.False(await Authorize(""));
        Assert.True(await Authorize("*"));
    }

    [Fact]
    public async Task MissingOrMalformedTenant_IsUnauthorized_NotAnEmptyPage()
    {
        await using var db = CreateDb();
        SeedChart(db, BranchA);
        await db.SaveChangesAsync();

        var missing = await Controller(db, tenant: null).GetPatient360Oct(PatientId);
        var malformed = await Controller(db, tenant: "not-a-guid").GetPatient360Oct(PatientId);
        Assert.IsType<UnauthorizedObjectResult>(missing);
        Assert.IsType<UnauthorizedObjectResult>(malformed);
        await Assert.ThrowsAsync<UnauthorizedAccessException>(() =>
            Service(db).ListAsync(Guid.Empty, UserId, PatientId, 1, 20));
    }

    [Fact]
    public async Task CrossTenantPatient_AndDeletedPatient_AreNotEmptySuccess()
    {
        await using var db = CreateDb();
        SeedUser(db, BranchA);
        db.Patients.Add(Patient(OtherTenantId, PatientId));
        db.Patients.Add(Patient(TenantId, OtherPatientId, deleted: true));
        db.OctImagingScans.Add(Scan(OtherTenantId, PatientId, BranchA, new DateTime(2026, 7, 1, 0, 0, 0, DateTimeKind.Utc)));
        await db.SaveChangesAsync();

        Assert.IsType<NotFoundObjectResult>(await Controller(db, TenantId.ToString()).GetPatient360Oct(PatientId));
        await Assert.ThrowsAsync<KeyNotFoundException>(() =>
            Service(db).ListAsync(TenantId, UserId, OtherPatientId, 1, 20));
    }

    [Fact]
    public async Task ReturnsMetadataOnly_AndExcludesForeignDeletedNullAndUnauthorizedRows()
    {
        await using var db = CreateDb();
        SeedChart(db, BranchA, BranchB);
        var keptHigh = Scan(TenantId, PatientId, BranchA, new DateTime(2026, 7, 2, 9, 0, 0, DateTimeKind.Utc));
        keptHigh.Id = Guid.Parse("ffffffff-ffff-ffff-ffff-ffffffffffff");
        var keptLow = Scan(TenantId, PatientId, BranchB, new DateTime(2026, 7, 2, 9, 0, 0, DateTimeKind.Utc));
        keptLow.Id = Guid.Parse("00000000-0000-0000-0000-000000000001");
        var older = Scan(TenantId, PatientId, BranchA, new DateTime(2026, 6, 1, 9, 0, 0, DateTimeKind.Utc));
        db.OctImagingScans.AddRange(
            keptHigh,
            keptLow,
            older,
            Scan(TenantId, OtherPatientId, BranchA, new DateTime(2026, 8, 1, 0, 0, 0, DateTimeKind.Utc)),
            Scan(OtherTenantId, PatientId, BranchA, new DateTime(2026, 8, 2, 0, 0, 0, DateTimeKind.Utc)),
            Scan(TenantId, PatientId, BranchA, new DateTime(2026, 8, 3, 0, 0, 0, DateTimeKind.Utc), deleted: true),
            Scan(TenantId, PatientId, null, new DateTime(2026, 8, 4, 0, 0, 0, DateTimeKind.Utc)),
            Scan(TenantId, PatientId, BranchC, new DateTime(2026, 8, 5, 0, 0, 0, DateTimeKind.Utc)));
        await db.SaveChangesAsync();

        var page = await Service(db).ListAsync(TenantId, UserId, PatientId, 1, 20);
        Assert.Equal(3, page.TotalCount);
        Assert.Equal(new[] { keptHigh.Id, keptLow.Id, older.Id }, page.Items.Select(item => item.Id).ToArray());

        var json = JsonSerializer.Serialize(page, Camel);
        Assert.Contains("macula", json, StringComparison.OrdinalIgnoreCase);
        Assert.DoesNotContain("secret-path", json);
        Assert.DoesNotContain("secret-thumb", json);
        Assert.DoesNotContain("secret-file", json);
        Assert.DoesNotContain("secret-note", json);
        Assert.DoesNotContain("secret-diagnosis", json);
        Assert.DoesNotContain("secret-tech", json);
        Assert.DoesNotContain("imagePaths", json);
        Assert.DoesNotContain("thumbnailPath", json);
        Assert.DoesNotContain("dataFilePath", json);
        Assert.DoesNotContain("notes", json, StringComparison.OrdinalIgnoreCase);
        Assert.DoesNotContain("diagnosis", json, StringComparison.OrdinalIgnoreCase);
        Assert.DoesNotContain("centralThickness", json);
        Assert.DoesNotContain("pathologyDetected", json);
        Assert.DoesNotContain("fluidDetected", json);
        Assert.DoesNotContain("technicianId", json);
        Assert.DoesNotContain("patientName", json);
        Assert.DoesNotContain("branchId", json);
        Assert.Empty(page.Items[0].GetType().GetProperties().Select(property => property.Name)
            .Intersect(new[]
            {
                "ImagePaths", "ThumbnailPath", "DataFilePath", "Notes", "Diagnosis",
                "CentralThickness", "PathologyDetected", "FluidDetected", "TechnicianId",
            }));

        var empty = await EmptyBranchService(db);
        Assert.Empty(empty.Items);
        Assert.Equal(0, empty.TotalCount);
        Assert.Equal(20, empty.PageSize);
    }

    [Fact]
    public async Task AuthorizedEmpty_WhenThePatientHasNoEligibleScans()
    {
        await using var db = CreateDb();
        SeedChart(db, BranchA);
        await db.SaveChangesAsync();
        var page = await Service(db).ListAsync(TenantId, UserId, PatientId, 1, 20);
        Assert.Empty(page.Items);
        Assert.Equal(0, page.TotalCount);
    }

    [Fact]
    public async Task Paging_FiltersBeforeTheWindow_AndCapsAtOneHundred()
    {
        await using var db = CreateDb();
        SeedChart(db, BranchA);
        var when = new DateTime(2026, 5, 1, 0, 0, 0, DateTimeKind.Utc);
        for (var i = 0; i < 21; i++)
            db.OctImagingScans.Add(Scan(TenantId, PatientId, BranchA, when.AddMinutes(i)));
        db.OctImagingScans.Add(Scan(TenantId, PatientId, BranchA, when.AddDays(1), deleted: true));
        db.OctImagingScans.Add(Scan(TenantId, PatientId, null, when.AddDays(2)));
        await db.SaveChangesAsync();

        var first = await Service(db).ListAsync(TenantId, UserId, PatientId, 1, 20);
        var second = await Service(db).ListAsync(TenantId, UserId, PatientId, 2, 20);
        var capped = await Service(db).ListAsync(TenantId, UserId, PatientId, 0, 500);
        Assert.Equal(21, first.TotalCount);
        Assert.Equal(20, first.Items.Count);
        Assert.Equal(20, first.PageSize);
        Assert.Single(second.Items);
        Assert.Equal(100, capped.PageSize);
        Assert.Equal(21, capped.Items.Count);
        Assert.True(first.Items[0].ScanDate >= first.Items[1].ScanDate);
    }

    [Fact]
    public void OperationalOctRoutes_AreUnchanged()
    {
        var root = FindAuthRoot();
        var controller = File.ReadAllText(Path.Combine(root, "Controllers", "OctImagingController.cs"));
        var service = File.ReadAllText(Path.Combine(root, "Services", "OctImagingService.cs"));
        Assert.DoesNotContain("diagnostic.oct.read", controller);
        Assert.DoesNotContain("patient-360", controller);
        Assert.DoesNotContain("RequirePermission", controller);
        Assert.DoesNotContain("Patient360", service);
        Assert.Contains("[HttpGet(\"patient/{patientId}\")]", controller);
    }

    private static async Task<DTOs.Patient360OctPageDto> EmptyBranchService(AppDbContext db)
    {
        db.Users.RemoveRange(db.Users);
        db.UserBranches.RemoveRange(db.UserBranches);
        db.Users.Add(new AppUser
        {
            Id = UserId,
            TenantId = TenantId,
            BranchId = null,
            UserName = "oct@hospital.com",
            Email = "oct@hospital.com",
            NormalizedEmail = "OCT@HOSPITAL.COM",
            NormalizedUserName = "OCT@HOSPITAL.COM",
        });
        await db.SaveChangesAsync();
        return await Service(db).ListAsync(TenantId, UserId, PatientId, 1, 20);
    }

    private static async Task<bool> Authorize(string permission)
    {
        var requirement = new PermissionRequirement("diagnostic.oct.read");
        var claims = new List<Claim>
        {
            new(ClaimTypes.NameIdentifier, UserId.ToString()),
            new("tenant_id", TenantId.ToString()),
        };
        if (!string.IsNullOrEmpty(permission))
            claims.Add(new Claim("permission", permission));
        var user = new ClaimsPrincipal(new ClaimsIdentity(claims, "test"));
        var context = new AuthorizationHandlerContext(new[] { requirement }, user, null);
        await using var db = CreateDb();
        await new PermissionAuthorizationHandler(db).HandleAsync(context);
        return context.HasSucceeded;
    }

    private static Patient360OctController Controller(AppDbContext db, string? tenant)
    {
        var claims = new List<Claim> { new(ClaimTypes.NameIdentifier, UserId.ToString()) };
        if (tenant != null)
            claims.Add(new Claim("TenantId", tenant));
        return new Patient360OctController(Service(db))
        {
            ControllerContext = new ControllerContext
            {
                HttpContext = new DefaultHttpContext
                {
                    User = new ClaimsPrincipal(new ClaimsIdentity(claims, "test")),
                },
            },
        };
    }

    private static Patient360OctReadService Service(AppDbContext db) =>
        new(db, new FollowupBranchAccessService(db));

    private static void SeedChart(AppDbContext db, params Guid[] branches)
    {
        SeedUser(db, branches);
        db.Patients.Add(Patient(TenantId, PatientId));
        db.Patients.Add(Patient(TenantId, OtherPatientId));
    }

    private static void SeedUser(AppDbContext db, params Guid[] branches)
    {
        db.Users.Add(new AppUser
        {
            Id = UserId,
            TenantId = TenantId,
            BranchId = branches[0],
            UserName = "oct@hospital.com",
            Email = "oct@hospital.com",
            NormalizedEmail = "OCT@HOSPITAL.COM",
            NormalizedUserName = "OCT@HOSPITAL.COM",
        });
        foreach (var branchId in branches)
        {
            db.UserBranches.Add(new UserBranch
            {
                Id = Guid.NewGuid(),
                TenantId = TenantId,
                UserId = UserId,
                BranchId = branchId,
                Status = "active",
                EffectiveFrom = DateTime.UtcNow.AddDays(-2),
                IsDefault = branchId == branches[0],
            });
        }
    }

    private static Patient Patient(Guid tenantId, Guid id, bool deleted = false) => new()
    {
        Id = id,
        TenantId = tenantId,
        MedicalRecordNumber = "MRN-" + id.ToString()[..8],
        FirstName = "Ada",
        LastName = "Lovelace",
        DateOfBirth = new DateTime(1980, 1, 1, 0, 0, 0, DateTimeKind.Utc),
        Gender = "Female",
        DeletedAt = deleted ? DateTime.UtcNow : null,
    };

    private static OctImagingScan Scan(Guid tenantId, Guid patientId, Guid? branchId, DateTime when, bool deleted = false) => new()
    {
        Id = Guid.NewGuid(),
        TenantId = tenantId,
        PatientId = patientId,
        BranchId = branchId,
        Eye = "OD",
        ScanDate = when,
        ScanType = "Macula",
        ScanPattern = "Raster",
        ScanSize = "6x6mm",
        Device = "Cirrus",
        DeviceModel = "5000",
        Status = "active",
        Notes = "secret-note",
        Diagnosis = "secret-diagnosis",
        ImagePaths = "[\"secret-path\"]",
        ThumbnailPath = "secret-thumb",
        DataFilePath = "secret-file",
        CentralThickness = 250,
        PathologyDetected = true,
        FluidDetected = true,
        TechnicianId = Guid.Parse("99999999-9999-9999-9999-999999999999"),
        CreatedAt = when,
        UpdatedAt = when,
        DeletedAt = deleted ? when : null,
    };

    private static AppDbContext CreateDb()
    {
        var options = new DbContextOptionsBuilder<AppDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString("N"))
            .Options;
        return new AppDbContext(options, new HttpContextAccessor { HttpContext = new DefaultHttpContext() });
    }

    private static string FindAuthRoot()
    {
        var dir = new DirectoryInfo(AppContext.BaseDirectory);
        while (dir != null)
        {
            var candidate = Path.Combine(dir.FullName, "microservices", "auth-service", "AuthService");
            if (File.Exists(Path.Combine(candidate, "Controllers", "OctImagingController.cs")))
                return candidate;
            dir = dir.Parent;
        }

        throw new DirectoryNotFoundException("AuthService root not found");
    }
}
