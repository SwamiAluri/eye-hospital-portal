using System.Security.Claims;
using System.Text.Json;
using AuthService.Authorization;
using AuthService.Context;
using AuthService.Controllers;
using AuthService.Models.Domain;
using AuthService.Models.Identity;
using AuthService.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Xunit;

namespace AuthService.Tests;

public class Patient360InpatientHistoryReadTests
{
    private static readonly Guid UserId = Guid.Parse("11111111-1111-1111-1111-111111111111");
    private static readonly Guid TenantId = Guid.Parse("22222222-2222-2222-2222-222222222222");
    private static readonly Guid OtherTenantId = Guid.Parse("33333333-3333-3333-3333-333333333333");
    private static readonly Guid PatientId = Guid.Parse("44444444-4444-4444-4444-444444444444");
    private static readonly Guid OtherPatientId = Guid.Parse("55555555-5555-5555-5555-555555555555");
    private static readonly Guid BranchA = Guid.Parse("aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa");
    private static readonly Guid BranchB = Guid.Parse("bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb");

    [Fact]
    public void Endpoint_RequiresIpManagementView_AndDoesNotAcceptBranchId()
    {
        var method = typeof(PatientJourneyHistoryController).GetMethod(
            nameof(PatientJourneyHistoryController.GetPatient360InpatientHistory));
        var permission = method!.GetCustomAttributes(typeof(RequirePermissionAttribute), false)
            .Cast<RequirePermissionAttribute>()
            .Single();
        var route = method.GetCustomAttributes(typeof(HttpGetAttribute), false)
            .Cast<HttpGetAttribute>()
            .Single();
        Assert.Equal("ip_management.view", permission.PermissionCode);
        Assert.Equal("patients/{patientId:guid}/patient-360/inpatient-history", route.Template);
        Assert.DoesNotContain(method.GetParameters(), parameter => parameter.Name == "branchId");
        Assert.NotNull(typeof(PatientJourneyHistoryController).GetCustomAttributes(typeof(AuthorizeAttribute), true).SingleOrDefault());
    }

    [Fact]
    public async Task IpManagementView_AllowsTheRead()
    {
        Assert.True(await Authorize("ip_management.view"));
    }

    [Fact]
    public async Task PatientViewAlone_DoesNotAuthorize()
    {
        Assert.False(await Authorize("patient.view"));
        Assert.False(await Authorize());
    }

    [Fact]
    public async Task MissingTenant_IsRejected()
    {
        await using var db = CreateDb();
        var controller = Controller(db, includeTenant: false);
        var result = await controller.GetPatient360InpatientHistory(PatientId);
        Assert.IsType<UnauthorizedObjectResult>(result);
    }

    [Fact]
    public async Task EmptyTenant_IsRejectedByTheRead()
    {
        await using var db = CreateDb();
        await Assert.ThrowsAsync<UnauthorizedAccessException>(() =>
            Service(db).ListPatient360Async(Guid.Empty, UserId, PatientId, 1, 20));
    }

    [Fact]
    public async Task AuthorizedBranchA_ReturnsThatJourneyOnly()
    {
        await using var db = CreateDb();
        SeedUser(db, BranchA);
        var included = Journey(BranchA, "Discharged", new DateTime(2026, 1, 2, 0, 0, 0, DateTimeKind.Utc));
        included.ProcedureName = "secret-procedure";
        included.Uhid = "MRN-SECRET";
        db.PatientJourneys.Add(included);
        db.PatientJourneys.Add(Journey(BranchB, "Discharged", new DateTime(2026, 2, 2, 0, 0, 0, DateTimeKind.Utc)));
        await db.SaveChangesAsync();

        var page = await Service(db).ListPatient360Async(TenantId, UserId, PatientId, 1, 20);
        var item = Assert.Single(page.Items);
        Assert.Equal(included.Id, item.Id);
        Assert.Equal(included.AdmittedAt, item.AdmittedAt);
        Assert.Equal(included.DischargedAt, item.DischargedAt);
        Assert.Equal("Discharged", item.ClinicalState);
        var json = JsonSerializer.Serialize(item);
        Assert.DoesNotContain("secret-procedure", json);
        Assert.DoesNotContain("MRN-SECRET", json);
        Assert.DoesNotContain("ProcedureName", json);
    }

    [Fact]
    public async Task CallerAuthorizedForAAndB_ReceivesBoth()
    {
        await using var db = CreateDb();
        SeedUser(db, BranchA, BranchB);
        db.PatientJourneys.Add(Journey(BranchA, "Discharged", new DateTime(2026, 1, 1, 0, 0, 0, DateTimeKind.Utc)));
        db.PatientJourneys.Add(Journey(BranchB, "AdmissionCancelled", new DateTime(2026, 3, 1, 0, 0, 0, DateTimeKind.Utc)));
        await db.SaveChangesAsync();

        var page = await Service(db).ListPatient360Async(TenantId, UserId, PatientId, 1, 20);
        Assert.Equal(2, page.TotalCount);
        Assert.Contains(page.Items, item => item.ClinicalState == "Discharged");
        Assert.Contains(page.Items, item => item.ClinicalState == "AdmissionCancelled");
    }

    [Fact]
    public async Task PatientBranchDoesNotAuthorizeAJourneyInAnotherBranch()
    {
        await using var db = CreateDb();
        SeedUser(db, BranchA);
        db.Patients.Add(new Patient
        {
            Id = PatientId,
            TenantId = TenantId,
            BranchId = BranchA,
            MedicalRecordNumber = "MRN-1",
            FirstName = "Ada",
            LastName = "Lovelace",
            ContactNumber = "9999999999",
            DateOfBirth = new DateTime(1980, 1, 1),
            Gender = "Female",
        });
        db.PatientJourneys.Add(Journey(BranchB, "Discharged", new DateTime(2026, 4, 1, 0, 0, 0, DateTimeKind.Utc)));
        await db.SaveChangesAsync();

        var page = await Service(db).ListPatient360Async(TenantId, UserId, PatientId, 1, 20);
        Assert.Empty(page.Items);
        Assert.Equal(0, page.TotalCount);
    }

    [Fact]
    public async Task CrossTenantJourney_IsExcluded()
    {
        await using var db = CreateDb();
        SeedUser(db, BranchA);
        var foreign = Journey(BranchA, "Discharged", DateTime.UtcNow);
        foreign.TenantId = OtherTenantId;
        db.PatientJourneys.Add(foreign);
        await db.SaveChangesAsync();

        var page = await Service(db).ListPatient360Async(TenantId, UserId, PatientId, 1, 20);
        Assert.Empty(page.Items);
    }

    [Fact]
    public async Task OtherPatient_IsExcluded()
    {
        await using var db = CreateDb();
        SeedUser(db, BranchA);
        var other = Journey(BranchA, "Discharged", DateTime.UtcNow);
        other.PatientId = OtherPatientId;
        other.Uhid = "MRN-1";
        db.PatientJourneys.Add(other);
        await db.SaveChangesAsync();

        var page = await Service(db).ListPatient360Async(TenantId, UserId, PatientId, 1, 20);
        Assert.Empty(page.Items);
    }

    [Fact]
    public async Task NoAuthorizedBranches_ReturnsEmptyPage()
    {
        await using var db = CreateDb();
        db.Users.Add(User(null));
        db.PatientJourneys.Add(Journey(BranchA, "Discharged", DateTime.UtcNow));
        await db.SaveChangesAsync();

        var page = await Service(db).ListPatient360Async(TenantId, UserId, PatientId, 1, 20);
        Assert.Empty(page.Items);
        Assert.Equal(0, page.TotalCount);
        Assert.Equal(20, page.PageSize);
    }

    [Fact]
    public async Task SoftDeletedAndInFlightAndCancelledSurgery_AreExcluded()
    {
        await using var db = CreateDb();
        SeedUser(db, BranchA);
        var deleted = Journey(BranchA, "Discharged", new DateTime(2026, 5, 1, 0, 0, 0, DateTimeKind.Utc));
        deleted.DeletedAt = DateTime.UtcNow;
        db.PatientJourneys.Add(deleted);
        db.PatientJourneys.Add(Journey(BranchA, "CancelledSurgery", new DateTime(2026, 5, 2, 0, 0, 0, DateTimeKind.Utc)));
        foreach (var state in new[]
        {
            "Expected", "Admitted", "ReadyForSurgery", "SentToOT", "InOT",
            "SurgeryCompleted", "PostOp", "ReadyForDischarge",
        })
        {
            db.PatientJourneys.Add(Journey(BranchA, state, new DateTime(2026, 5, 3, 0, 0, 0, DateTimeKind.Utc)));
        }
        var kept = Journey(BranchA, "AdmissionCancelled", new DateTime(2026, 6, 1, 0, 0, 0, DateTimeKind.Utc));
        db.PatientJourneys.Add(kept);
        await db.SaveChangesAsync();

        var page = await Service(db).ListPatient360Async(TenantId, UserId, PatientId, 1, 20);
        var item = Assert.Single(page.Items);
        Assert.Equal(kept.Id, item.Id);
        Assert.Equal("AdmissionCancelled", item.ClinicalState);
    }

    [Fact]
    public async Task FiltersRunBeforePaging_AndPageSizeIsCapped()
    {
        await using var db = CreateDb();
        SeedUser(db, BranchA);
        for (var i = 0; i < 30; i++)
            db.PatientJourneys.Add(Journey(BranchA, "Expected", new DateTime(2026, 1, 1, 0, 0, 0, DateTimeKind.Utc).AddDays(i)));
        var closed = Journey(BranchA, "Discharged", new DateTime(2020, 1, 1, 0, 0, 0, DateTimeKind.Utc));
        db.PatientJourneys.Add(closed);
        await db.SaveChangesAsync();

        var page = await Service(db).ListPatient360Async(TenantId, UserId, PatientId, 1, 500);
        Assert.Equal(Patient360DiagnosticPaging.MaxPageSize, page.PageSize);
        var item = Assert.Single(page.Items);
        Assert.Equal(closed.Id, item.Id);
        Assert.Equal(1, page.TotalCount);
    }

    [Fact]
    public async Task DefaultPageSize_Is20_AndOrderIsAdmittedAtDescNullsLastThenId()
    {
        await using var db = CreateDb();
        SeedUser(db, BranchA);
        var older = Journey(BranchA, "Discharged", new DateTime(2024, 1, 1, 0, 0, 0, DateTimeKind.Utc));
        var newer = Journey(BranchA, "Discharged", new DateTime(2026, 1, 1, 0, 0, 0, DateTimeKind.Utc));
        var missing = Journey(BranchA, "Discharged", null);
        var sameDayHigh = Journey(BranchA, "Discharged", new DateTime(2025, 1, 1, 0, 0, 0, DateTimeKind.Utc));
        var sameDayLow = Journey(BranchA, "Discharged", new DateTime(2025, 1, 1, 0, 0, 0, DateTimeKind.Utc));
        if (sameDayHigh.Id.CompareTo(sameDayLow.Id) < 0)
            (sameDayHigh.Id, sameDayLow.Id) = (sameDayLow.Id, sameDayHigh.Id);
        db.PatientJourneys.AddRange(older, newer, missing, sameDayLow, sameDayHigh);
        await db.SaveChangesAsync();

        var page = await Service(db).ListPatient360Async(TenantId, UserId, PatientId, 1, 0);
        Assert.Equal(20, page.PageSize);
        Assert.Equal(5, page.TotalCount);
        Assert.Equal(
            new[] { newer.Id, sameDayHigh.Id, sameDayLow.Id, older.Id, missing.Id },
            page.Items.Select(item => item.Id).ToArray());
    }

    [Fact]
    public void ReadDoesNotOnboardJourneysOrMatchDisplayIdentity()
    {
        var source = File.ReadAllText(Path.Combine(
            FindServiceRoot(), "Services", "PatientJourneyHistoryService.cs"));
        Assert.DoesNotContain("OnboardExpectedJourneysAsync", source);
        Assert.DoesNotContain("MedicalRecordNumber", source);
        Assert.DoesNotContain("FirstName", source);
        Assert.DoesNotContain("ContactNumber", source);
        Assert.Contains("journey.PatientId == patientId", source);
        Assert.Contains("requestedBranchId: null", source);
    }

    private static async Task<bool> Authorize(params string[] permissions)
    {
        var requirement = new PermissionRequirement("ip_management.view");
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

    private static PatientJourneyHistoryController Controller(AppDbContext db, bool includeTenant)
    {
        var claims = new List<Claim> { new(ClaimTypes.NameIdentifier, UserId.ToString()) };
        if (includeTenant)
            claims.Add(new Claim("TenantId", TenantId.ToString()));
        return new PatientJourneyHistoryController(Service(db))
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

    private static PatientJourneyHistoryService Service(AppDbContext db) =>
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
        UserName = "history@hospital.com",
        Email = "history@hospital.com",
        NormalizedEmail = "HISTORY@HOSPITAL.COM",
        NormalizedUserName = "HISTORY@HOSPITAL.COM",
    };

    private static PatientJourneyReadOnly Journey(Guid branchId, string state, DateTime? admittedAt) => new()
    {
        Id = Guid.NewGuid(),
        TenantId = TenantId,
        PatientId = PatientId,
        BranchId = branchId,
        ClinicalState = state,
        IsDischarged = state == "Discharged",
        AdmittedAt = admittedAt,
        DischargedAt = state == "Discharged" ? admittedAt?.AddDays(1) : null,
        CreatedAt = new DateTime(2020, 1, 1, 0, 0, 0, DateTimeKind.Utc),
        Uhid = "UHID-DISPLAY",
        ProcedureName = "Cataract",
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
            if (File.Exists(Path.Combine(candidate, "Services", "PatientJourneyHistoryService.cs")))
                return candidate;
            var local = Path.Combine(dir.FullName, "AuthService");
            if (File.Exists(Path.Combine(local, "Services", "PatientJourneyHistoryService.cs")))
                return local;
            dir = dir.Parent;
        }
        throw new DirectoryNotFoundException("PatientJourneyHistoryService.cs");
    }
}
