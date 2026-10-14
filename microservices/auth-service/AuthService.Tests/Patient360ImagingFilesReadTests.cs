using System.Security.Claims;
using System.Text.Json;
using AuthService.Authorization;
using AuthService.Context;
using AuthService.Controllers;
using AuthService.Models.Domain;
using AuthService.Models.Domain.Dtos;
using AuthService.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Xunit;

namespace AuthService.Tests;

public class Patient360ImagingFilesReadTests
{
    private static readonly Guid TenantId = Guid.Parse("22222222-2222-2222-2222-222222222222");
    private static readonly Guid OtherTenantId = Guid.Parse("33333333-3333-3333-3333-333333333333");
    private static readonly Guid PatientId = Guid.Parse("44444444-4444-4444-4444-444444444444");
    private static readonly Guid OtherPatientId = Guid.Parse("55555555-5555-5555-5555-555555555555");
    private static readonly Guid UserId = Guid.Parse("11111111-1111-1111-1111-111111111111");
    private const string SecretUrl = "https://storage.example/blob/secret-image.png?sig=signed";

    [Fact]
    public void Endpoint_RequiresExaminationView_OnThePatientScopedRoute()
    {
        var method = typeof(ImagingController).GetMethod(nameof(ImagingController.GetPatient360Images));
        var permission = method!.GetCustomAttributes(typeof(RequirePermissionAttribute), false)
            .Cast<RequirePermissionAttribute>()
            .Single();
        var route = method.GetCustomAttributes(typeof(HttpGetAttribute), false)
            .Cast<HttpGetAttribute>()
            .Single();
        Assert.Equal("examination.view", permission.PermissionCode);
        Assert.Equal("patient/{patientId:guid}/patient-360/images", route.Template);
        Assert.DoesNotContain(method.GetParameters(), parameter => parameter.Name == "branchId");
    }

    [Fact]
    public async Task ExaminationView_AllowsTheRead_AndAnUnrelatedPermissionDoesNot()
    {
        Assert.True(await Authorize("examination.view"));
        Assert.False(await Authorize("patient.view"));
        Assert.False(await Authorize(""));
    }

    [Fact]
    public async Task MissingTenant_IsUnauthorizedNotEmpty()
    {
        await using var db = CreateDb();
        var result = await Controller(db, includeTenant: false).GetPatient360Images(PatientId);
        Assert.IsType<UnauthorizedObjectResult>(result);
    }

    [Fact]
    public async Task AuthorizedRows_ReturnApprovedFieldsOnly_AndHideStoredUrls()
    {
        await using var db = CreateDb();
        var order = Order(TenantId, PatientId);
        db.ImagingOrders.Add(order);
        db.ImagingImages.Add(Image(order, "macula.png", "oct", new DateTime(2026, 4, 2, 9, 0, 0, DateTimeKind.Utc)));
        await db.SaveChangesAsync();

        var ok = Assert.IsType<OkObjectResult>(await Controller(db, includeTenant: true).GetPatient360Images(PatientId));
        var page = Assert.IsType<Patient360ImagingFilePageDto>(ok.Value);
        var row = Assert.Single(page.Items);
        Assert.Equal("macula.png", row.FileName);
        Assert.Equal("oct", row.Modality);
        Assert.Equal(2048, row.FileSize);
        Assert.Equal("image/png", row.ContentType);

        var json = JsonSerializer.Serialize(page, new JsonSerializerOptions { PropertyNamingPolicy = JsonNamingPolicy.CamelCase });
        Assert.DoesNotContain("imageUrl", json, StringComparison.OrdinalIgnoreCase);
        Assert.DoesNotContain("thumbnailUrl", json, StringComparison.OrdinalIgnoreCase);
        Assert.DoesNotContain("storagePath", json, StringComparison.OrdinalIgnoreCase);
        Assert.DoesNotContain("signed", json, StringComparison.OrdinalIgnoreCase);
        Assert.DoesNotContain("downloadUrl", json, StringComparison.OrdinalIgnoreCase);
        Assert.DoesNotContain("previewUrl", json, StringComparison.OrdinalIgnoreCase);
        Assert.DoesNotContain(SecretUrl, json);
        Assert.DoesNotContain("blob", json, StringComparison.OrdinalIgnoreCase);
        Assert.DoesNotContain(
            typeof(Patient360ImagingFileDto).GetProperties(),
            property => property.PropertyType == typeof(byte[]));
    }

    [Fact]
    public void Dto_DoesNotDeclareStorageOrByteProperties()
    {
        var names = typeof(Patient360ImagingFileDto).GetProperties().Select(property => property.Name).ToArray();
        Assert.DoesNotContain("ImageUrl", names);
        Assert.DoesNotContain("ThumbnailUrl", names);
        Assert.DoesNotContain("StoragePath", names);
        Assert.DoesNotContain("BlobPath", names);
        Assert.DoesNotContain("SignedUrl", names);
        Assert.DoesNotContain("DownloadUrl", names);
        Assert.DoesNotContain("PreviewUrl", names);
        Assert.DoesNotContain(names, name => name.Contains("Url", StringComparison.OrdinalIgnoreCase));
    }

    [Fact]
    public async Task AnotherPatient_AndCrossTenantRows_AreExcluded()
    {
        await using var db = CreateDb();
        var own = Order(TenantId, PatientId);
        var otherPatient = Order(TenantId, OtherPatientId);
        var otherTenantOrder = Order(OtherTenantId, PatientId);
        db.ImagingOrders.AddRange(own, otherPatient, otherTenantOrder);
        var visible = Image(own, "own.png", "fundus", new DateTime(2026, 5, 1, 0, 0, 0, DateTimeKind.Utc));
        var foreignPatient = Image(otherPatient, "other-patient.png", "fundus", new DateTime(2026, 5, 2, 0, 0, 0, DateTimeKind.Utc));
        var foreignOrder = Image(otherTenantOrder, "other-tenant-order.png", "fundus", new DateTime(2026, 5, 3, 0, 0, 0, DateTimeKind.Utc));
        foreignOrder.TenantId = TenantId;
        var foreignImage = Image(own, "other-tenant-image.png", "fundus", new DateTime(2026, 5, 4, 0, 0, 0, DateTimeKind.Utc));
        foreignImage.TenantId = OtherTenantId;
        db.ImagingImages.AddRange(visible, foreignPatient, foreignOrder, foreignImage);
        await db.SaveChangesAsync();

        var page = await Service(db).ListAsync(TenantId, PatientId, 1, 20);
        var row = Assert.Single(page.Items);
        Assert.Equal(visible.Id, row.Id);
        Assert.Equal(1, page.TotalCount);
    }

    [Fact]
    public async Task SoftDeletedImage_IsExcluded_AndEmptyIsAuthorized()
    {
        await using var db = CreateDb();
        var order = Order(TenantId, PatientId);
        db.ImagingOrders.Add(order);
        var deleted = Image(order, "gone.png", "ffa", new DateTime(2026, 1, 1, 0, 0, 0, DateTimeKind.Utc));
        deleted.DeletedAt = DateTime.UtcNow;
        db.ImagingImages.Add(deleted);
        await db.SaveChangesAsync();

        var page = await Service(db).ListAsync(TenantId, PatientId, 1, 20);
        Assert.Empty(page.Items);
        Assert.Equal(0, page.TotalCount);
        Assert.Equal(20, page.PageSize);
    }

    [Fact]
    public async Task Paging_FiltersBeforeTake_AndOrdersByUploadedAtThenId()
    {
        await using var db = CreateDb();
        var order = Order(TenantId, PatientId);
        var other = Order(TenantId, OtherPatientId);
        db.ImagingOrders.AddRange(order, other);
        var older = Image(order, "older.png", "oct", new DateTime(2026, 1, 1, 0, 0, 0, DateTimeKind.Utc));
        var newer = Image(order, "newer.png", "oct", new DateTime(2026, 6, 1, 0, 0, 0, DateTimeKind.Utc));
        var tieHigh = Image(order, "tie-high.png", "oct", new DateTime(2026, 3, 1, 0, 0, 0, DateTimeKind.Utc));
        var tieLow = Image(order, "tie-low.png", "oct", new DateTime(2026, 3, 1, 0, 0, 0, DateTimeKind.Utc));
        if (tieHigh.Id.CompareTo(tieLow.Id) < 0)
            (tieHigh.Id, tieLow.Id) = (tieLow.Id, tieHigh.Id);
        db.ImagingImages.Add(Image(other, "foreign.png", "oct", new DateTime(2026, 12, 1, 0, 0, 0, DateTimeKind.Utc)));
        for (var i = 0; i < 20; i++)
            db.ImagingImages.Add(Image(order, $"mid-{i}.png", "oct", new DateTime(2025, 1, 1, 0, 0, 0, DateTimeKind.Utc).AddDays(i)));
        db.ImagingImages.AddRange(older, newer, tieLow, tieHigh);
        await db.SaveChangesAsync();

        var capped = await Service(db).ListAsync(TenantId, PatientId, 1, 500);
        Assert.Equal(Patient360DiagnosticPaging.MaxPageSize, capped.PageSize);
        Assert.Equal(24, capped.TotalCount);
        Assert.Equal(newer.Id, capped.Items[0].Id);
        Assert.DoesNotContain(capped.Items, item => item.FileName == "foreign.png");
        Assert.Equal(
            new[] { tieHigh.Id, tieLow.Id },
            capped.Items.Where(item => item.UploadedAt == tieHigh.UploadedAt).Select(item => item.Id).ToArray());

        var second = await Service(db).ListAsync(TenantId, PatientId, 2, 20);
        Assert.Equal(4, second.Items.Count);
        Assert.Equal(20, second.PageSize);
        Assert.Contains(capped.Items, item => item.Id == older.Id);
        Assert.DoesNotContain(second.Items, item => item.Id == newer.Id);

        var defaults = await Service(db).ListAsync(TenantId, PatientId, 0, 0);
        Assert.Equal(1, defaults.PageNumber);
        Assert.Equal(20, defaults.PageSize);
        Assert.Equal(20, defaults.Items.Count);
    }

    [Fact]
    public void ExistingOrderRead_IsUnchanged_AndThisServiceDoesNotProjectStorage()
    {
        var orders = typeof(ImagingController).GetMethod(nameof(ImagingController.GetPatientOrders));
        var images = typeof(ImagingController).GetMethod(nameof(ImagingController.GetOrderImages));
        Assert.Equal(
            "patient/{patientId}",
            orders!.GetCustomAttributes(typeof(HttpGetAttribute), false).Cast<HttpGetAttribute>().Single().Template);
        Assert.Equal(
            "examination.view",
            orders.GetCustomAttributes(typeof(RequirePermissionAttribute), false).Cast<RequirePermissionAttribute>().Single().PermissionCode);
        Assert.Equal(
            "{orderId}/images",
            images!.GetCustomAttributes(typeof(HttpGetAttribute), false).Cast<HttpGetAttribute>().Single().Template);

        var service = File.ReadAllText(Path.Combine(FindServiceRoot(), "Services", "Patient360ImagingFilesService.cs"));
        Assert.DoesNotContain("ImageUrl", service);
        Assert.DoesNotContain("ThumbnailUrl", service);
        Assert.DoesNotContain("ImageStoragePath", service);
        Assert.DoesNotContain("FollowupBranchAccess", service);
        Assert.DoesNotContain("OctImaging", service);

        var operational = File.ReadAllText(Path.Combine(FindServiceRoot(), "Services", "ImagingService.cs"));
        Assert.Contains("GetPatientOrdersAsync", operational);
        Assert.Contains("o.PatientId == patientId && o.TenantId == tenantId", operational);
        Assert.DoesNotContain("patient-360/images", operational);
    }

    private static async Task<bool> Authorize(string permission)
    {
        var requirement = new PermissionRequirement("examination.view");
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

    private static ImagingController Controller(AppDbContext db, bool includeTenant)
    {
        var claims = new List<Claim>();
        if (includeTenant)
            claims.Add(new Claim("TenantId", TenantId.ToString()));
        return new ImagingController(null!, null!, Service(db), null!)
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

    private static Patient360ImagingFilesService Service(AppDbContext db) => new(db);

    private static ImagingOrder Order(Guid tenantId, Guid patientId) => new()
    {
        Id = Guid.NewGuid(),
        TenantId = tenantId,
        PatientId = patientId,
        ImagingType = "Fundus",
        OrderingDoctorId = UserId,
        OrderedAt = new DateTime(2026, 1, 1, 0, 0, 0, DateTimeKind.Utc),
        Status = "Completed",
        ImageStoragePath = "container/should-not-leak",
    };

    private static ImagingImage Image(ImagingOrder order, string fileName, string modality, DateTime uploadedAt) => new()
    {
        Id = Guid.NewGuid(),
        TenantId = order.TenantId,
        ImagingOrderId = order.Id,
        ImageUrl = SecretUrl,
        ThumbnailUrl = "https://storage.example/thumb.png",
        FileName = fileName,
        FileSize = 2048,
        ContentType = "image/png",
        Modality = modality,
        UploadedByUserId = UserId,
        UploadedAt = uploadedAt,
        CreatedAt = uploadedAt,
        UpdatedAt = uploadedAt,
        Status = "active",
    };

    private static AppDbContext CreateDb()
    {
        var options = new DbContextOptionsBuilder<AppDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString("N"))
            .Options;
        return new AppDbContext(options, new HttpContextAccessor { HttpContext = new DefaultHttpContext() });
    }

    private static string FindServiceRoot()
    {
        var dir = new DirectoryInfo(AppContext.BaseDirectory);
        while (dir != null)
        {
            var candidate = Path.Combine(dir.FullName, "microservices", "auth-service", "AuthService");
            if (File.Exists(Path.Combine(candidate, "Services", "Patient360ImagingFilesService.cs")))
                return candidate;
            var local = Path.Combine(dir.FullName, "AuthService");
            if (File.Exists(Path.Combine(local, "Services", "Patient360ImagingFilesService.cs")))
                return local;
            dir = dir.Parent;
        }

        throw new DirectoryNotFoundException("AuthService root not found");
    }
}
