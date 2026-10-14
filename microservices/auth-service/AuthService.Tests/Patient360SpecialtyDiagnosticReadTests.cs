using System.Security.Claims;
using System.Text.Json;
using AuthService.Authorization;
using AuthService.Context;
using AuthService.Controllers;
using AuthService.DTOs;
using AuthService.Models;
using AuthService.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Xunit;

namespace AuthService.Tests;

public class Patient360BiometryReadTests
{
    private static readonly Guid UserId = Guid.Parse("11111111-1111-1111-1111-111111111111");
    private static readonly Guid TenantId = Guid.Parse("22222222-2222-2222-2222-222222222222");
    private static readonly Guid OtherTenantId = Guid.Parse("33333333-3333-3333-3333-333333333333");
    private static readonly Guid PatientId = Guid.Parse("44444444-4444-4444-4444-444444444444");
    private static readonly Guid OtherPatientId = Guid.Parse("55555555-5555-5555-5555-555555555555");

    [Fact]
    public void Endpoint_RequiresBiometryView()
    {
        var method = typeof(BiometryController).GetMethod(nameof(BiometryController.GetPatient360));
        var permission = method!.GetCustomAttributes(typeof(RequirePermissionAttribute), false)
            .Cast<RequirePermissionAttribute>()
            .Single();
        var route = method.GetCustomAttributes(typeof(HttpGetAttribute), false)
            .Cast<HttpGetAttribute>()
            .Single();
        Assert.Equal("CLINICAL:BIOMETRY:VIEW", permission.PermissionCode);
        Assert.Equal("patients/{patientId:guid}/patient-360", route.Template);
        Assert.NotNull(typeof(BiometryController).GetCustomAttributes(typeof(AuthorizeAttribute), true).SingleOrDefault());
    }

    [Fact]
    public async Task BiometryView_AllowsTheRead()
    {
        Assert.True(await Authorize("CLINICAL:BIOMETRY:VIEW"));
    }

    [Fact]
    public async Task MissingPermission_DoesNotAuthorize()
    {
        Assert.False(await Authorize());
        Assert.False(await Authorize("CLINICAL:EXAMINATION:VIEW"));
        Assert.False(await Authorize("CLINICAL:SCREENING:VIEW"));
    }

    [Fact]
    public async Task MissingTenant_IsRejected()
    {
        await using var db = CreateDb();
        var controller = new BiometryController(Service(db))
        {
            ControllerContext = new ControllerContext
            {
                HttpContext = new DefaultHttpContext
                {
                    User = new ClaimsPrincipal(new ClaimsIdentity(new[]
                    {
                        new Claim(ClaimTypes.NameIdentifier, UserId.ToString()),
                    }, "test")),
                },
            },
        };

        var result = await controller.GetPatient360(PatientId);
        Assert.IsType<UnauthorizedObjectResult>(result);
    }

    [Fact]
    public async Task EmptyTenant_IsRejectedByTheRead()
    {
        await using var db = CreateDb();
        await Assert.ThrowsAsync<UnauthorizedAccessException>(() =>
            Service(db).ListPatient360Async(Guid.Empty, PatientId, 1, 20));
    }

    [Fact]
    public async Task SameTenantSamePatient_ReturnsStoredMeasurements()
    {
        await using var db = CreateDb();
        var row = Record(TenantId, PatientId, new DateTime(2026, 9, 2, 8, 30, 0, DateTimeKind.Utc));
        row.Notes = "secret-note";
        row.IolCalculations = "{\"formula\":\"secret-worksheet\"}";
        row.ExaminerId = Guid.NewGuid();
        db.BiometryRecords.Add(row);
        await db.SaveChangesAsync();

        var page = await Service(db).ListPatient360Async(TenantId, PatientId, 1, 20);
        var item = Assert.Single(page.Items);
        Assert.Equal(row.Id, item.Id);
        Assert.Equal(row.ExaminationDate, item.ExaminationDate);
        Assert.Equal("OD", item.Eye);
        Assert.Equal("active", item.Status);
        Assert.Equal("IOL Master", item.Device);
        Assert.Equal("700", item.DeviceModel);
        Assert.Equal(23.5m, item.AxialLength);
        Assert.Equal(43.1m, item.K1);
        Assert.Equal(44.2m, item.K2);
        Assert.Equal(20.5m, item.CalculatedIol);
        Assert.Equal("SRK-T", item.SelectedFormula);
        Assert.Equal(1, page.TotalCount);
        var json = JsonSerializer.Serialize(item);
        Assert.DoesNotContain("secret-note", json);
        Assert.DoesNotContain("secret-worksheet", json);
        Assert.DoesNotContain("ExaminerId", json);
        Assert.DoesNotContain("BranchId", json);
    }

    [Fact]
    public async Task OtherPatient_IsExcluded()
    {
        await using var db = CreateDb();
        db.BiometryRecords.Add(Record(TenantId, OtherPatientId, DateTime.UtcNow));
        await db.SaveChangesAsync();
        Assert.Empty((await Service(db).ListPatient360Async(TenantId, PatientId, 1, 20)).Items);
    }

    [Fact]
    public async Task OtherTenant_IsEmpty()
    {
        await using var db = CreateDb();
        db.BiometryRecords.Add(Record(OtherTenantId, PatientId, DateTime.UtcNow));
        await db.SaveChangesAsync();
        var page = await Service(db).ListPatient360Async(TenantId, PatientId, 1, 20);
        Assert.Empty(page.Items);
        Assert.Equal(0, page.TotalCount);
    }

    [Fact]
    public async Task DeletedRecord_IsExcluded()
    {
        await using var db = CreateDb();
        var row = Record(TenantId, PatientId, DateTime.UtcNow);
        row.DeletedAt = DateTime.UtcNow;
        db.BiometryRecords.Add(row);
        await db.SaveChangesAsync();
        Assert.Empty((await Service(db).ListPatient360Async(TenantId, PatientId, 1, 20)).Items);
    }

    [Fact]
    public async Task OtherBranch_RemainsVisible_AndOrderIsStable()
    {
        await using var db = CreateDb();
        var older = Record(TenantId, PatientId, new DateTime(2026, 1, 1, 0, 0, 0, DateTimeKind.Utc));
        older.BranchId = Guid.Parse("aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa");
        older.Device = "Older device";
        var newer = Record(TenantId, PatientId, new DateTime(2026, 9, 1, 0, 0, 0, DateTimeKind.Utc));
        newer.BranchId = Guid.Parse("bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb");
        newer.Device = "Newer device";
        db.BiometryRecords.AddRange(older, newer);
        await db.SaveChangesAsync();

        var page1 = await Service(db).ListPatient360Async(TenantId, PatientId, 1, 1);
        var page1Again = await Service(db).ListPatient360Async(TenantId, PatientId, 1, 1);
        var page2 = await Service(db).ListPatient360Async(TenantId, PatientId, 2, 1);

        Assert.Equal(2, page1.TotalCount);
        Assert.Equal(newer.Id, Assert.Single(page1.Items).Id);
        Assert.Equal(page1.Items[0].Id, page1Again.Items[0].Id);
        Assert.Equal(older.Id, Assert.Single(page2.Items).Id);
    }

    [Fact]
    public async Task PageSize_IsCapped()
    {
        await using var db = CreateDb();
        db.BiometryRecords.Add(Record(TenantId, PatientId, DateTime.UtcNow));
        await db.SaveChangesAsync();
        var page = await Service(db).ListPatient360Async(TenantId, PatientId, 0, 500);
        Assert.Equal(1, page.PageNumber);
        Assert.Equal(Patient360DiagnosticPaging.MaxPageSize, page.PageSize);
        Assert.Single(page.Items);
    }

    private static async Task<bool> Authorize(params string[] permissions)
    {
        var requirement = new PermissionRequirement("CLINICAL:BIOMETRY:VIEW");
        var claims = new List<Claim>
        {
            new(ClaimTypes.NameIdentifier, UserId.ToString()),
            new("tenant_id", TenantId.ToString()),
        };
        claims.AddRange(permissions.Select(code => new Claim("permission", code)));
        var user = new ClaimsPrincipal(new ClaimsIdentity(claims, "test"));
        var context = new AuthorizationHandlerContext(new[] { requirement }, user, null);
        await using var db = CreateDb();
        await new PermissionAuthorizationHandler(db).HandleAsync(context);
        return context.HasSucceeded;
    }

    private static BiometryService Service(AppDbContext db) =>
        new(db, new HttpContextAccessor { HttpContext = new DefaultHttpContext() });

    private static AppDbContext CreateDb()
    {
        var options = new DbContextOptionsBuilder<AppDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString("N"))
            .Options;
        return new AppDbContext(options, new HttpContextAccessor { HttpContext = new DefaultHttpContext() });
    }

    private static BiometryRecord Record(Guid tenantId, Guid patientId, DateTime when) => new()
    {
        Id = Guid.NewGuid(),
        TenantId = tenantId,
        PatientId = patientId,
        Eye = "OD",
        AxialLength = 23.5m,
        K1 = 43.1m,
        K2 = 44.2m,
        K1Axis = 90,
        Acd = 3.1m,
        Device = "IOL Master",
        DeviceModel = "700",
        TargetRefraction = -0.5m,
        CalculatedIol = 20.5m,
        SelectedFormula = "SRK-T",
        ExaminationDate = when,
        ExaminerId = Guid.NewGuid(),
        Status = "active",
        CreatedAt = when,
        UpdatedAt = when,
    };
}

public class Patient360RetinopathyReadTests
{
    private static readonly Guid UserId = Guid.Parse("11111111-1111-1111-1111-111111111111");
    private static readonly Guid TenantId = Guid.Parse("22222222-2222-2222-2222-222222222222");
    private static readonly Guid OtherTenantId = Guid.Parse("33333333-3333-3333-3333-333333333333");
    private static readonly Guid PatientId = Guid.Parse("44444444-4444-4444-4444-444444444444");
    private static readonly Guid OtherPatientId = Guid.Parse("55555555-5555-5555-5555-555555555555");

    [Fact]
    public void Endpoint_RequiresScreeningView()
    {
        var method = typeof(RetinopathyScreeningController).GetMethod(nameof(RetinopathyScreeningController.GetPatient360));
        var permission = method!.GetCustomAttributes(typeof(RequirePermissionAttribute), false)
            .Cast<RequirePermissionAttribute>()
            .Single();
        Assert.Equal("CLINICAL:SCREENING:VIEW", permission.PermissionCode);
        var route = method.GetCustomAttributes(typeof(HttpGetAttribute), false).Cast<HttpGetAttribute>().Single();
        Assert.Equal("patients/{patientId:guid}/patient-360", route.Template);
    }

    [Fact]
    public async Task ScreeningView_AllowsTheRead()
    {
        Assert.True(await Authorize("CLINICAL:SCREENING:VIEW"));
    }

    [Fact]
    public async Task MissingPermission_DoesNotAuthorize()
    {
        Assert.False(await Authorize());
        Assert.False(await Authorize("CLINICAL:SCREENING:PERFORM"));
        Assert.False(await Authorize("CLINICAL:BIOMETRY:VIEW"));
    }

    [Fact]
    public async Task MissingTenant_IsRejected()
    {
        await using var db = CreateDb();
        var controller = new RetinopathyScreeningController(Service(db))
        {
            ControllerContext = new ControllerContext
            {
                HttpContext = new DefaultHttpContext
                {
                    User = new ClaimsPrincipal(new ClaimsIdentity(new[]
                    {
                        new Claim(ClaimTypes.NameIdentifier, UserId.ToString()),
                    }, "test")),
                },
            },
        };
        Assert.IsType<UnauthorizedObjectResult>(await controller.GetPatient360(PatientId));
    }

    [Fact]
    public async Task EmptyTenant_IsRejectedByTheRead()
    {
        await using var db = CreateDb();
        await Assert.ThrowsAsync<UnauthorizedAccessException>(() =>
            Service(db).ListPatient360Async(Guid.Empty, PatientId, 1, 20));
    }

    [Fact]
    public async Task SameTenantSamePatient_ReturnsStoredGradeWithoutInterpretationFields()
    {
        await using var db = CreateDb();
        var row = Screening(TenantId, PatientId, new DateTime(2026, 8, 14, 10, 0, 0, DateTimeKind.Utc));
        row.Notes = "secret-note";
        row.ImagePaths = "[\"secret-path\"]";
        row.ThumbnailPath = "secret-thumb";
        row.TreatmentRecommended = "secret-treatment";
        row.AiGrade = "secret-ai";
        row.FollowUpMonths = 6;
        db.RetinopathyScreenings.Add(row);
        await db.SaveChangesAsync();

        var page = await Service(db).ListPatient360Async(TenantId, PatientId, 1, 20);
        var item = Assert.Single(page.Items);
        Assert.Equal("Mild NPDR", item.DrGrade);
        Assert.Equal("OS", item.Eye);
        Assert.Equal("completed", item.Status);
        Assert.True(item.HardExudates);
        Assert.True(item.ReferralRequired);
        Assert.Equal(2, item.HemorrhagesCount);
        var json = JsonSerializer.Serialize(item);
        Assert.DoesNotContain("secret-note", json);
        Assert.DoesNotContain("secret-path", json);
        Assert.DoesNotContain("secret-thumb", json);
        Assert.DoesNotContain("secret-treatment", json);
        Assert.DoesNotContain("secret-ai", json);
        Assert.IsNotType<RetinopathyScreeningDto>(item);
    }

    [Fact]
    public async Task OtherPatient_IsExcluded()
    {
        await using var db = CreateDb();
        db.RetinopathyScreenings.Add(Screening(TenantId, OtherPatientId, DateTime.UtcNow));
        await db.SaveChangesAsync();
        Assert.Empty((await Service(db).ListPatient360Async(TenantId, PatientId, 1, 20)).Items);
    }

    [Fact]
    public async Task OtherTenant_IsEmpty()
    {
        await using var db = CreateDb();
        db.RetinopathyScreenings.Add(Screening(OtherTenantId, PatientId, DateTime.UtcNow));
        await db.SaveChangesAsync();
        var page = await Service(db).ListPatient360Async(TenantId, PatientId, 1, 20);
        Assert.Empty(page.Items);
        Assert.Equal(0, page.TotalCount);
    }

    [Fact]
    public async Task DeletedScreening_IsExcluded()
    {
        await using var db = CreateDb();
        var row = Screening(TenantId, PatientId, DateTime.UtcNow);
        row.DeletedAt = DateTime.UtcNow;
        db.RetinopathyScreenings.Add(row);
        await db.SaveChangesAsync();
        Assert.Empty((await Service(db).ListPatient360Async(TenantId, PatientId, 1, 20)).Items);
    }

    [Fact]
    public async Task OtherBranch_RemainsVisible_AndOrderIsStable()
    {
        await using var db = CreateDb();
        var older = Screening(TenantId, PatientId, new DateTime(2026, 2, 1, 0, 0, 0, DateTimeKind.Utc));
        older.BranchId = Guid.Parse("aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa");
        var newer = Screening(TenantId, PatientId, new DateTime(2026, 8, 1, 0, 0, 0, DateTimeKind.Utc));
        newer.BranchId = Guid.Parse("bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb");
        db.RetinopathyScreenings.AddRange(older, newer);
        await db.SaveChangesAsync();

        var page1 = await Service(db).ListPatient360Async(TenantId, PatientId, 1, 1);
        var page1Again = await Service(db).ListPatient360Async(TenantId, PatientId, 1, 1);
        var page2 = await Service(db).ListPatient360Async(TenantId, PatientId, 2, 1);
        Assert.Equal(2, page1.TotalCount);
        Assert.Equal(newer.Id, page1.Items[0].Id);
        Assert.Equal(page1.Items[0].Id, page1Again.Items[0].Id);
        Assert.Equal(older.Id, page2.Items[0].Id);
    }

    [Fact]
    public async Task PageSize_IsCapped()
    {
        await using var db = CreateDb();
        db.RetinopathyScreenings.Add(Screening(TenantId, PatientId, DateTime.UtcNow));
        await db.SaveChangesAsync();
        var page = await Service(db).ListPatient360Async(TenantId, PatientId, -1, 500);
        Assert.Equal(1, page.PageNumber);
        Assert.Equal(100, page.PageSize);
    }

    private static async Task<bool> Authorize(params string[] permissions)
    {
        var requirement = new PermissionRequirement("CLINICAL:SCREENING:VIEW");
        var claims = new List<Claim>
        {
            new(ClaimTypes.NameIdentifier, UserId.ToString()),
            new("tenant_id", TenantId.ToString()),
        };
        claims.AddRange(permissions.Select(code => new Claim("permission", code)));
        var user = new ClaimsPrincipal(new ClaimsIdentity(claims, "test"));
        var context = new AuthorizationHandlerContext(new[] { requirement }, user, null);
        await using var db = CreateDb();
        await new PermissionAuthorizationHandler(db).HandleAsync(context);
        return context.HasSucceeded;
    }

    private static RetinopathyScreeningService Service(AppDbContext db) =>
        new(db, new HttpContextAccessor { HttpContext = new DefaultHttpContext() });

    private static AppDbContext CreateDb()
    {
        var options = new DbContextOptionsBuilder<AppDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString("N"))
            .Options;
        return new AppDbContext(options, new HttpContextAccessor { HttpContext = new DefaultHttpContext() });
    }

    private static RetinopathyScreening Screening(Guid tenantId, Guid patientId, DateTime when) => new()
    {
        Id = Guid.NewGuid(),
        TenantId = tenantId,
        PatientId = patientId,
        Eye = "OS",
        ScreeningDate = when,
        Device = "Fundus camera",
        DeviceModel = "A1",
        DrGrade = "Mild NPDR",
        MacularEdema = "None",
        HemorrhagesCount = 2,
        HardExudates = true,
        ReferralRequired = true,
        Status = "completed",
        CreatedAt = when,
        UpdatedAt = when,
    };
}
