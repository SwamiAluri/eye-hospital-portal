using System.Security.Claims;
using AuthService.Authorization;
using AuthService.Context;
using AuthService.Controllers;
using AuthService.DTOs;
using AuthService.Models.Domain;
using AuthService.Models.Identity;
using AuthService.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Xunit;

namespace AuthService.Tests;

public class Patient360IpVitalsReadTests
{
    private static readonly Guid UserId = Guid.Parse("11111111-1111-1111-1111-111111111111");
    private static readonly Guid TenantId = Guid.Parse("22222222-2222-2222-2222-222222222222");
    private static readonly Guid OtherTenantId = Guid.Parse("33333333-3333-3333-3333-333333333333");
    private static readonly Guid PatientId = Guid.Parse("44444444-4444-4444-4444-444444444444");
    private static readonly Guid OtherPatientId = Guid.Parse("55555555-5555-5555-5555-555555555555");
    private static readonly Guid BranchA = Guid.Parse("aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa");
    private static readonly Guid BranchB = Guid.Parse("bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb");

    [Fact]
    public void Endpoint_RequiresIpVitalsRead_AndDoesNotAcceptBranchOrJourneyId()
    {
        var method = typeof(Patient360IpVitalsController).GetMethod(
            nameof(Patient360IpVitalsController.GetPatient360IpVitals));
        var permission = method!.GetCustomAttributes(typeof(RequirePermissionAttribute), false)
            .Cast<RequirePermissionAttribute>()
            .Single();
        var route = method.GetCustomAttributes(typeof(HttpGetAttribute), false)
            .Cast<HttpGetAttribute>()
            .Single();
        Assert.Equal("ip.vitals.read", permission.PermissionCode);
        Assert.Equal("patients/{patientId:guid}/patient-360/ip-vitals", route.Template);
        Assert.DoesNotContain(method.GetParameters(), parameter => parameter.Name == "branchId");
        Assert.DoesNotContain(method.GetParameters(), parameter => parameter.Name == "journeyId");
    }

    [Fact]
    public async Task IpVitalsRead_AllowsTheRead()
    {
        Assert.True(await Authorize("ip.vitals.read"));
    }

    [Theory]
    [InlineData("ip.view")]
    [InlineData("ip_management.view")]
    [InlineData("patient.view")]
    [InlineData("ward.checklist.edit")]
    [InlineData("anaesthesia.monitoring.edit")]
    [InlineData("ip.postop.manage")]
    [InlineData("")]
    public async Task UnrelatedPermission_DoesNotAuthorize(string permission)
    {
        Assert.False(await Authorize(permission));
    }

    [Fact]
    public async Task MissingTenant_IsUnauthorizedNotEmpty()
    {
        await using var db = CreateDb();
        var result = await Controller(db, includeTenant: false).GetPatient360IpVitals(PatientId);
        Assert.IsType<UnauthorizedObjectResult>(result);
    }

    [Fact]
    public async Task AuthorizedRows_ReturnApprovedFieldsOnly()
    {
        await using var db = CreateDb();
        SeedUser(db, BranchA);
        var journey = Journey(BranchA, "Admitted");
        db.PatientJourneys.Add(journey);
        var vital = Vital(journey, null, new DateTime(2026, 4, 1, 8, 0, 0, DateTimeKind.Utc));
        vital.Temperature = 36.6m;
        vital.BloodPressureSystolic = 120;
        vital.BloodPressureDiastolic = 80;
        vital.PulseRate = 72;
        vital.RespiratoryRate = 16;
        vital.OxygenSaturation = 98m;
        vital.Weight = 70m;
        vital.Height = 160m;
        vital.Notes = "do not expose";
        vital.RecordedByUserId = Guid.NewGuid();
        vital.Status = "active";
        db.VitalSigns.Add(vital);
        await db.SaveChangesAsync();

        var page = await Service(db).ListAsync(TenantId, UserId, PatientId, 1, 20);
        var item = Assert.Single(page.Items);
        Assert.Equal("Ward", item.Context);
        Assert.Equal(vital.RecordedAt, item.RecordedAt);
        Assert.Equal(120, item.BloodPressureSystolic);
        Assert.Equal(80, item.BloodPressureDiastolic);
        Assert.Equal(72, item.PulseRate);
        Assert.False(typeof(Patient360IpVitalItemDto).GetProperties().Any(property =>
            property.Name is "Notes" or "RecordedByUserId" or "CreatedAt" or "UpdatedAt" or "Status" or "AdmittedAt"));
    }

    [Fact]
    public async Task OtherPatientAndCrossTenant_AreExcluded()
    {
        await using var db = CreateDb();
        SeedUser(db, BranchA);
        var other = Journey(BranchA, "Admitted");
        other.PatientId = OtherPatientId;
        db.PatientJourneys.Add(other);
        db.VitalSigns.Add(Vital(other, null, DateTime.UtcNow));

        var foreignJourney = Journey(BranchA, "Admitted");
        foreignJourney.TenantId = OtherTenantId;
        db.PatientJourneys.Add(foreignJourney);
        var foreignVital = Vital(foreignJourney, null, DateTime.UtcNow);
        foreignVital.TenantId = OtherTenantId;
        db.VitalSigns.Add(foreignVital);

        var mismatchedVitalTenant = Journey(BranchA, "Discharged");
        db.PatientJourneys.Add(mismatchedVitalTenant);
        var mismatched = Vital(mismatchedVitalTenant, null, DateTime.UtcNow);
        mismatched.TenantId = OtherTenantId;
        db.VitalSigns.Add(mismatched);
        await db.SaveChangesAsync();

        var page = await Service(db).ListAsync(TenantId, UserId, PatientId, 1, 20);
        Assert.Empty(page.Items);
    }

    [Fact]
    public async Task BranchRules_IncludeAuthorizedAndExcludeTheRest()
    {
        await using var db = CreateDb();
        SeedUser(db, BranchA, BranchB);
        var first = Journey(BranchA, "PostOp");
        var second = Journey(BranchB, "Discharged");
        db.PatientJourneys.AddRange(first, second);
        db.VitalSigns.Add(Vital(first, null, new DateTime(2026, 3, 1, 0, 0, 0, DateTimeKind.Utc)));
        db.VitalSigns.Add(Vital(second, "PreOp", new DateTime(2026, 3, 2, 0, 0, 0, DateTimeKind.Utc)));
        await db.SaveChangesAsync();

        var page = await Service(db).ListAsync(TenantId, UserId, PatientId, 1, 20);
        Assert.Equal(2, page.TotalCount);
        Assert.Contains(page.Items, item => item.Context == "Ward");
        Assert.Contains(page.Items, item => item.Context == "PreOp");
    }

    [Fact]
    public async Task UnauthorizedBranch_IsExcluded()
    {
        await using var db = CreateDb();
        SeedUser(db, BranchA);
        var hidden = Journey(BranchB, "Admitted");
        db.PatientJourneys.Add(hidden);
        db.VitalSigns.Add(Vital(hidden, null, DateTime.UtcNow));
        await db.SaveChangesAsync();

        var page = await Service(db).ListAsync(TenantId, UserId, PatientId, 1, 20);
        Assert.Empty(page.Items);
        Assert.Equal(0, page.TotalCount);
    }

    [Fact]
    public async Task EmptyAuthorizedBranchSet_ReturnsAuthorizedEmpty()
    {
        await using var db = CreateDb();
        db.Users.Add(User(null));
        var journey = Journey(BranchA, "Admitted");
        db.PatientJourneys.Add(journey);
        db.VitalSigns.Add(Vital(journey, null, DateTime.UtcNow));
        await db.SaveChangesAsync();

        var page = await Service(db).ListAsync(TenantId, UserId, PatientId, 1, 20);
        Assert.Empty(page.Items);
        Assert.Equal(0, page.TotalCount);
        Assert.Equal(20, page.PageSize);
    }

    [Fact]
    public async Task ApprovedStatesAreIncluded_AndExcludedStatesStayOut()
    {
        await using var db = CreateDb();
        SeedUser(db, BranchA);
        foreach (var state in Patient360IpVitalsService.IncludedStates)
        {
            var journey = Journey(BranchA, state);
            db.PatientJourneys.Add(journey);
            db.VitalSigns.Add(Vital(journey, null, new DateTime(2026, 1, 1, 0, 0, 0, DateTimeKind.Utc)));
        }

        foreach (var state in new[] { "Expected", "AdmissionCancelled", "NotAState" })
        {
            var journey = Journey(BranchA, state);
            db.PatientJourneys.Add(journey);
            db.VitalSigns.Add(Vital(journey, null, new DateTime(2026, 2, 1, 0, 0, 0, DateTimeKind.Utc)));
        }

        await db.SaveChangesAsync();
        var page = await Service(db).ListAsync(TenantId, UserId, PatientId, 1, 20);
        Assert.Equal(Patient360IpVitalsService.IncludedStates.Length, page.TotalCount);
    }

    [Fact]
    public async Task DeletedVitalAndDeletedJourney_AreExcluded()
    {
        await using var db = CreateDb();
        SeedUser(db, BranchA);
        var live = Journey(BranchA, "Admitted");
        var deletedJourney = Journey(BranchA, "Admitted");
        deletedJourney.DeletedAt = DateTime.UtcNow;
        db.PatientJourneys.AddRange(live, deletedJourney);
        var deletedVital = Vital(live, null, DateTime.UtcNow);
        deletedVital.DeletedAt = DateTime.UtcNow;
        db.VitalSigns.Add(deletedVital);
        db.VitalSigns.Add(Vital(deletedJourney, null, DateTime.UtcNow));
        await db.SaveChangesAsync();

        var page = await Service(db).ListAsync(TenantId, UserId, PatientId, 1, 20);
        Assert.Empty(page.Items);
    }

    [Fact]
    public async Task ContextFilter_KeepsWardAndPreOpOnly()
    {
        await using var db = CreateDb();
        SeedUser(db, BranchA);
        var journey = Journey(BranchA, "InOT");
        db.PatientJourneys.Add(journey);
        db.VitalSigns.Add(Vital(journey, null, new DateTime(2026, 5, 1, 0, 0, 0, DateTimeKind.Utc)));
        db.VitalSigns.Add(Vital(journey, "PreOp", new DateTime(2026, 5, 2, 0, 0, 0, DateTimeKind.Utc)));
        db.VitalSigns.Add(Vital(journey, "PostOp", new DateTime(2026, 5, 3, 0, 0, 0, DateTimeKind.Utc)));
        db.VitalSigns.Add(Vital(journey, "Routine", new DateTime(2026, 5, 4, 0, 0, 0, DateTimeKind.Utc)));
        db.VitalSigns.Add(Vital(journey, "Other", new DateTime(2026, 5, 5, 0, 0, 0, DateTimeKind.Utc)));
        await db.SaveChangesAsync();

        var page = await Service(db).ListAsync(TenantId, UserId, PatientId, 1, 20);
        Assert.Equal(new[] { "PreOp", "Ward" }, page.Items.Select(item => item.Context).ToArray());
    }

    [Fact]
    public async Task OrderAndPaging_AreDeterministicAndCapped()
    {
        await using var db = CreateDb();
        SeedUser(db, BranchA);
        var journey = Journey(BranchA, "Admitted");
        db.PatientJourneys.Add(journey);
        var older = Vital(journey, null, new DateTime(2026, 1, 1, 0, 0, 0, DateTimeKind.Utc));
        var newer = Vital(journey, null, new DateTime(2026, 6, 1, 0, 0, 0, DateTimeKind.Utc));
        var tieHigh = Vital(journey, null, new DateTime(2026, 3, 1, 0, 0, 0, DateTimeKind.Utc));
        var tieLow = Vital(journey, null, new DateTime(2026, 3, 1, 0, 0, 0, DateTimeKind.Utc));
        if (tieHigh.Id.CompareTo(tieLow.Id) < 0)
            (tieHigh.Id, tieLow.Id) = (tieLow.Id, tieHigh.Id);
        for (var i = 0; i < 20; i++)
            db.VitalSigns.Add(Vital(journey, null, new DateTime(2025, 1, 1, 0, 0, 0, DateTimeKind.Utc).AddDays(i)));
        db.VitalSigns.AddRange(older, newer, tieLow, tieHigh);
        await db.SaveChangesAsync();

        var capped = await Service(db).ListAsync(TenantId, UserId, PatientId, 1, 500);
        Assert.Equal(Patient360DiagnosticPaging.MaxPageSize, capped.PageSize);
        Assert.Equal(24, capped.TotalCount);
        Assert.Equal(newer.Id, capped.Items[0].Id);
        Assert.Equal(new[] { tieHigh.Id, tieLow.Id }, capped.Items.Where(item => item.RecordedAt == tieHigh.RecordedAt).Select(item => item.Id).ToArray());

        var second = await Service(db).ListAsync(TenantId, UserId, PatientId, 2, 20);
        Assert.Equal(4, second.Items.Count);
        Assert.Equal(20, second.PageSize);

        var defaults = await Service(db).ListAsync(TenantId, UserId, PatientId, 0, 0);
        Assert.Equal(1, defaults.PageNumber);
        Assert.Equal(20, defaults.PageSize);
    }

    [Fact]
    public void ReadDoesNotTouchNurseRecordsOrTheJourneyVitalsRoute()
    {
        var service = File.ReadAllText(Path.Combine(FindServiceRoot(), "Services", "Patient360IpVitalsService.cs"));
        Assert.DoesNotContain("nurse_record", service);
        Assert.DoesNotContain("NurseRecord", service);
        Assert.DoesNotContain("Notes", service);
        Assert.Contains("vital.TenantId == tenantId", service);
        Assert.Contains("journey.PatientId == patientId", service);
        Assert.Contains("requestedBranchId: null", service);

        var journeyRoute = File.ReadAllText(Path.Combine(
            FindIpRoot(), "Functions", "VitalSignFunctions.cs"));
        Assert.Contains("journeys/{id}/vitals", journeyRoute);
        Assert.DoesNotContain("patient-360/ip-vitals", journeyRoute);
        Assert.DoesNotContain("ip.vitals.read", journeyRoute);
    }

    private static async Task<bool> Authorize(string permission)
    {
        var requirement = new PermissionRequirement("ip.vitals.read");
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

    private static Patient360IpVitalsController Controller(AppDbContext db, bool includeTenant)
    {
        var claims = new List<Claim> { new(ClaimTypes.NameIdentifier, UserId.ToString()) };
        if (includeTenant)
            claims.Add(new Claim("TenantId", TenantId.ToString()));
        return new Patient360IpVitalsController(Service(db))
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

    private static Patient360IpVitalsService Service(AppDbContext db) =>
        new(db, new FollowupBranchAccessService(db));

    private static void SeedUser(AppDbContext db, params Guid[] branches)
    {
        db.Users.Add(User(branches[0]));
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

    private static AppUser User(Guid? branchId) => new()
    {
        Id = UserId,
        TenantId = TenantId,
        BranchId = branchId,
        UserName = "vitals@hospital.com",
        Email = "vitals@hospital.com",
        NormalizedEmail = "VITALS@HOSPITAL.COM",
        NormalizedUserName = "VITALS@HOSPITAL.COM",
    };

    private static PatientJourneyReadOnly Journey(Guid branchId, string state) => new()
    {
        Id = Guid.NewGuid(),
        TenantId = TenantId,
        PatientId = PatientId,
        BranchId = branchId,
        ClinicalState = state,
        IsDischarged = state == "Discharged",
        AdmittedAt = new DateTime(2026, 1, 1, 0, 0, 0, DateTimeKind.Utc),
        CreatedAt = new DateTime(2020, 1, 1, 0, 0, 0, DateTimeKind.Utc),
    };

    private static VitalSignReadOnly Vital(PatientJourneyReadOnly journey, string? context, DateTime recordedAt) => new()
    {
        Id = Guid.NewGuid(),
        TenantId = journey.TenantId,
        JourneyId = journey.Id,
        RecordedAt = recordedAt,
        Context = context,
        RecordedByUserId = UserId,
        CreatedAt = recordedAt,
        UpdatedAt = recordedAt,
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
            if (File.Exists(Path.Combine(candidate, "Services", "Patient360IpVitalsService.cs")))
                return candidate;
            var local = Path.Combine(dir.FullName, "AuthService");
            if (File.Exists(Path.Combine(local, "Services", "Patient360IpVitalsService.cs")))
                return local;
            dir = dir.Parent;
        }

        throw new DirectoryNotFoundException("AuthService root not found");
    }

    private static string FindIpRoot()
    {
        var dir = new DirectoryInfo(AppContext.BaseDirectory);
        while (dir != null)
        {
            var candidate = Path.Combine(dir.FullName, "microservices", "ip-management-service", "IpManagementService");
            if (File.Exists(Path.Combine(candidate, "Functions", "VitalSignFunctions.cs")))
                return candidate;
            dir = dir.Parent;
        }

        throw new DirectoryNotFoundException("IpManagementService root not found");
    }
}
