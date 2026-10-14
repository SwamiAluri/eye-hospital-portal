using System.Security.Claims;
using AuthService.Authorization;
using AuthService.Context;
using AuthService.Controllers;
using AuthService.Models.Counselor;
using AuthService.Models.Domain;
using AuthService.Models.Identity;
using AuthService.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging.Abstractions;
using Xunit;

namespace AuthService.Tests;

/// <summary>
/// Patient 360 counselling session context. Permission is counseling_sessions.read.
/// Uses the follow-up branch allow-list. Does not return the operational session DTO.
/// </summary>
public class CounselingSessionPatient360ReadTests
{
    private static readonly Guid UserId = Guid.Parse("11111111-1111-1111-1111-111111111111");
    private static readonly Guid TenantId = Guid.Parse("22222222-2222-2222-2222-222222222222");
    private static readonly Guid OtherTenantId = Guid.Parse("33333333-3333-3333-3333-333333333333");

    [Fact]
    public async Task CounselingSessionsRead_Allows_ThePatientRead()
    {
        Assert.True(await Authorize("counseling_sessions.read"));
    }

    [Fact]
    public async Task Unauthenticated_IsRejected_BeforeDataLoad()
    {
        var requirement = new PermissionRequirement("counseling_sessions.read");
        var user = new ClaimsPrincipal(new ClaimsIdentity());
        var context = new AuthorizationHandlerContext(new[] { requirement }, user, null);
        await using var db = CreateDb();
        await new PermissionAuthorizationHandler(db).HandleAsync(context);

        Assert.False(context.HasSucceeded);
        Assert.True(context.HasFailed);
    }

    [Fact]
    public async Task MissingPermission_DoesNotAuthorize()
    {
        Assert.False(await Authorize());
    }

    [Theory]
    [InlineData("patient.view")]
    [InlineData("counseling_sessions.update")]
    [InlineData("counseling_sessions.reassign")]
    [InlineData("session_notes.read")]
    [InlineData("transcription.view")]
    public async Task SiblingPermission_DoesNotAuthorize(string permission)
    {
        Assert.False(await Authorize(permission));
    }

    [Fact]
    public void Endpoint_RequiresExactlyCounselingSessionsRead()
    {
        var method = typeof(CounselingController).GetMethod(nameof(CounselingController.GetPatient360SessionContext));
        var permission = method!.GetCustomAttributes(typeof(RequirePermissionAttribute), false)
            .Cast<RequirePermissionAttribute>()
            .Single();
        var route = method.GetCustomAttributes(typeof(HttpGetAttribute), false)
            .Cast<HttpGetAttribute>()
            .Single();
        Assert.Equal("counseling_sessions.read", permission.PermissionCode);
        Assert.Equal("patients/{patientId:guid}/patient-360/sessions", route.Template);
        Assert.NotNull(typeof(CounselingController).GetCustomAttributes(typeof(AuthorizeAttribute), true).SingleOrDefault());
    }

    [Fact]
    public async Task Read_ReturnsApprovedFields_AndPreservesStatus()
    {
        await using var db = CreateDb();
        var patientId = Guid.NewGuid();
        var branchId = Guid.NewGuid();
        var counselorId = Guid.NewGuid();
        db.Users.Add(Counselor(counselorId, "Ada", "Lovelace"));
        var session = Session(TenantId, patientId, branchId, counselorId);
        session.SessionNumber = "CS-14";
        session.SessionType = "Followup";
        session.Status = "InProgress";
        session.SessionDate = new DateTime(2026, 9, 2);
        session.SessionStartTime = new DateTime(2026, 9, 2, 9, 15, 0);
        session.SessionEndTime = new DateTime(2026, 9, 2, 9, 45, 0);
        session.CurrentStage = "Financial";
        session.ClinicalSummary = "{\"diagnosis\":\"secret-dx\"}";
        session.PackageAmount = 9999.50m;
        session.PackageAddonsJson = "{\"packageName\":\"secret-addon\"}";
        session.AdditionalNotes = "secret-note";
        session.AttenderName = "secret-attender";
        session.AttenderPhone = "9990001111";
        session.RecommendedSurgery = "Phaco";
        session.VisitId = Guid.NewGuid();
        session.PatientAgreedToSurgery = true;
        session.PendingDecision = true;
        session.ReasonsForDelay = "secret-delay";
        session.PatientIntention = "Undecided";
        db.CounselingSession.Add(session);
        await db.SaveChangesAsync();

        var rows = await Service(db).ListPatient360SessionContextAsync(TenantId, patientId, new[] { branchId });

        var row = Assert.Single(rows);
        Assert.Equal(session.Id, row.Id);
        Assert.Equal("CS-14", row.SessionNumber);
        Assert.Equal("Followup", row.SessionType);
        Assert.Equal(new DateTime(2026, 9, 2), row.SessionDate);
        Assert.Equal("InProgress", row.Status);
        Assert.Equal("Ada Lovelace", row.CounsellorName);
        Assert.IsNotType<CounselingSessionDto>(row);

        var json = System.Text.Json.JsonSerializer.Serialize(rows);
        Assert.DoesNotContain("counselorId", json, StringComparison.OrdinalIgnoreCase);
        Assert.Contains("InProgress", json);
        Assert.DoesNotContain("Financial", json);
        Assert.DoesNotContain("secret-dx", json);
        Assert.DoesNotContain("9999", json);
        Assert.DoesNotContain("secret-addon", json);
        Assert.DoesNotContain("secret-note", json);
        Assert.DoesNotContain("secret-attender", json);
        Assert.DoesNotContain("9990001111", json);
        Assert.DoesNotContain("Phaco", json);
        Assert.DoesNotContain("secret-delay", json);
        Assert.DoesNotContain("Undecided", json);
        Assert.DoesNotContain("currentStage", json, StringComparison.OrdinalIgnoreCase);
        Assert.DoesNotContain("packageAmount", json, StringComparison.OrdinalIgnoreCase);
        Assert.DoesNotContain("clinicalSummary", json, StringComparison.OrdinalIgnoreCase);
        Assert.DoesNotContain("additionalNotes", json, StringComparison.OrdinalIgnoreCase);
    }

    [Fact]
    public async Task NullCounsellor_ReturnsEmptyName()
    {
        await using var db = CreateDb();
        var patientId = Guid.NewGuid();
        var branchId = Guid.NewGuid();
        db.CounselingSession.Add(Session(TenantId, patientId, branchId, counselorId: null));
        await db.SaveChangesAsync();

        var row = Assert.Single(await Service(db).ListPatient360SessionContextAsync(TenantId, patientId, new[] { branchId }));

        Assert.Equal("", row.CounsellorName);
        Assert.DoesNotContain("Unassigned", System.Text.Json.JsonSerializer.Serialize(row), StringComparison.OrdinalIgnoreCase);
    }

    [Fact]
    public async Task TenantAndPatientIsolation_AndSoftDelete()
    {
        await using var db = CreateDb();
        var patientA = Guid.NewGuid();
        var patientB = Guid.NewGuid();
        var branchId = Guid.NewGuid();
        var kept = Session(TenantId, patientA, branchId, null);
        kept.SessionNumber = "kept";
        var otherPatient = Session(TenantId, patientB, branchId, null);
        otherPatient.SessionNumber = "other-patient";
        var otherTenant = Session(OtherTenantId, patientA, branchId, null);
        otherTenant.SessionNumber = "other-tenant";
        var deleted = Session(TenantId, patientA, branchId, null, deleted: DateTime.UtcNow);
        deleted.SessionNumber = "deleted";
        db.CounselingSession.AddRange(kept, otherPatient, otherTenant, deleted);
        await db.SaveChangesAsync();

        var rows = await Service(db).ListPatient360SessionContextAsync(TenantId, patientA, new[] { branchId });

        Assert.Equal("kept", Assert.Single(rows).SessionNumber);
    }

    [Fact]
    public async Task BranchAllowList_ExcludesOtherBranches_AndNullBranch()
    {
        await using var db = CreateDb();
        var patientId = Guid.NewGuid();
        var allowed = Guid.NewGuid();
        var denied = Guid.NewGuid();
        var inBranch = Session(TenantId, patientId, allowed, null);
        inBranch.SessionNumber = "in-branch";
        var outBranch = Session(TenantId, patientId, denied, null);
        outBranch.SessionNumber = "out-branch";
        var noBranch = Session(TenantId, patientId, null, null);
        noBranch.SessionNumber = "null-branch";
        db.CounselingSession.AddRange(inBranch, outBranch, noBranch);
        await db.SaveChangesAsync();

        var rows = await Service(db).ListPatient360SessionContextAsync(TenantId, patientId, new[] { allowed });

        Assert.Equal("in-branch", Assert.Single(rows).SessionNumber);
    }

    [Fact]
    public async Task EmptyBranchAllowList_ReturnsNoSessions()
    {
        await using var db = CreateDb();
        var patientId = Guid.NewGuid();
        var branchId = Guid.NewGuid();
        db.CounselingSession.Add(Session(TenantId, patientId, branchId, null));
        await db.SaveChangesAsync();

        var rows = await Service(db).ListPatient360SessionContextAsync(TenantId, patientId, Array.Empty<Guid>());

        Assert.Empty(rows);
    }

    [Fact]
    public async Task DoesNotTruncateAtTheOperationalPageSize()
    {
        await using var db = CreateDb();
        var patientId = Guid.NewGuid();
        var branchId = Guid.NewGuid();
        for (var i = 0; i < 51; i++)
        {
            var session = Session(TenantId, patientId, branchId, null);
            session.SessionDate = new DateTime(2026, 1, 1).AddDays(i);
            session.CreatedAt = session.SessionDate;
            db.CounselingSession.Add(session);
        }
        await db.SaveChangesAsync();

        var rows = await Service(db).ListPatient360SessionContextAsync(TenantId, patientId, new[] { branchId });

        Assert.Equal(51, rows.Count);
    }

    [Fact]
    public async Task OrdersBySessionDate_ThenCreatedAt()
    {
        await using var db = CreateDb();
        var patientId = Guid.NewGuid();
        var branchId = Guid.NewGuid();
        var olderDay = Session(TenantId, patientId, branchId, null);
        olderDay.SessionNumber = "older-day";
        olderDay.SessionDate = new DateTime(2026, 9, 1);
        olderDay.CreatedAt = new DateTime(2026, 9, 3);
        var laterSameDay = Session(TenantId, patientId, branchId, null);
        laterSameDay.SessionNumber = "later-same-day";
        laterSameDay.SessionDate = new DateTime(2026, 9, 2);
        laterSameDay.CreatedAt = new DateTime(2026, 9, 2, 8, 0, 0);
        var earlierSameDay = Session(TenantId, patientId, branchId, null);
        earlierSameDay.SessionNumber = "earlier-same-day";
        earlierSameDay.SessionDate = new DateTime(2026, 9, 2);
        earlierSameDay.CreatedAt = new DateTime(2026, 9, 2, 7, 0, 0);
        db.CounselingSession.AddRange(olderDay, earlierSameDay, laterSameDay);
        await db.SaveChangesAsync();

        var numbers = (await Service(db).ListPatient360SessionContextAsync(TenantId, patientId, new[] { branchId }))
            .Select(row => row.SessionNumber)
            .ToArray();

        Assert.Equal(new[] { "later-same-day", "earlier-same-day", "older-day" }, numbers);
    }

    [Fact]
    public void Projection_DoesNotLoadTheOperationalSessionDto_OrMutate()
    {
        var source = ServiceSource();
        var start = source.IndexOf("ListPatient360SessionContextAsync", StringComparison.Ordinal);
        var end = source.IndexOf("ListMetadataByPatientIdAsync", start, StringComparison.Ordinal);
        var body = source[start..end];
        Assert.DoesNotContain("CounselingSessionDto", body);
        Assert.DoesNotContain("GetAllSessionsAsync", body);
        Assert.DoesNotContain("SaveChanges", body);
        Assert.DoesNotContain("PageSize", body);
        Assert.DoesNotContain(".Take(", body);
        Assert.Contains("session.DeletedAt == null", body);
        Assert.Contains("session.BranchId != null", body);
        Assert.Contains("orderby session.SessionDate descending, session.CreatedAt descending", body);
    }

    [Fact]
    public void OperationalPatientSessionEndpoint_RemainsTheDeskRead()
    {
        var source = ControllerSource();
        var start = source.IndexOf("GetPatientSessions", StringComparison.Ordinal);
        var end = source.IndexOf("GetPatient360SessionContext", start, StringComparison.Ordinal);
        var body = source[start..end];
        Assert.Contains("GetAllSessionsAsync", body);
        Assert.Contains("PageSize = 50", body);
        Assert.Contains("patients/{patientId}/sessions", source);
        Assert.DoesNotContain("ListPatient360SessionContextAsync", body);
    }

    private static async Task<bool> Authorize(params string[] permissions)
    {
        var claims = new List<Claim>
        {
            new(ClaimTypes.NameIdentifier, UserId.ToString()),
            new("tenant_id", TenantId.ToString()),
        };
        foreach (var permission in permissions)
            claims.Add(new Claim("permission", permission));
        var user = new ClaimsPrincipal(new ClaimsIdentity(claims, "test"));
        var requirement = new PermissionRequirement("counseling_sessions.read");
        var context = new AuthorizationHandlerContext(new[] { requirement }, user, null);
        await using var db = CreateDb();
        await new PermissionAuthorizationHandler(db).HandleAsync(context);
        return context.HasSucceeded;
    }

    private static CounselingWorkflowService Service(AppDbContext db) =>
        new(
            db,
            NullLogger<CounselingWorkflowService>.Instance,
            null!,
            null!,
            new ConfigurationBuilder().Build(),
            null!,
            null!);

    private static AppUser Counselor(Guid id, string first, string last) =>
        new()
        {
            Id = id,
            UserName = first.ToLowerInvariant() + "@example.test",
            FirstName = first,
            LastName = last,
            TenantId = TenantId,
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow,
        };

    private static CounselingSession Session(
        Guid tenantId,
        Guid patientId,
        Guid? branchId,
        Guid? counselorId,
        DateTime? deleted = null) =>
        new()
        {
            Id = Guid.NewGuid(),
            TenantId = tenantId,
            BranchId = branchId,
            PatientId = patientId,
            CounselorId = counselorId,
            ReferredByDoctorId = Guid.NewGuid(),
            SessionType = "Initial",
            SessionDate = DateTime.UtcNow.Date,
            PatientType = "Cash",
            Status = "Scheduled",
            CreatedAt = DateTime.UtcNow,
            DeletedAt = deleted,
        };

    private static AppDbContext CreateDb()
    {
        var options = new DbContextOptionsBuilder<AppDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString("N"))
            .Options;
        return new AppDbContext(options, new HttpContextAccessor());
    }

    private static string ServiceSource([System.Runtime.CompilerServices.CallerFilePath] string testFile = "")
    {
        var service = Path.GetFullPath(Path.Combine(
            Path.GetDirectoryName(testFile)!,
            "..",
            "AuthService",
            "Services",
            "CounselingWorkflowService.cs"));
        return File.ReadAllText(service);
    }

    private static string ControllerSource([System.Runtime.CompilerServices.CallerFilePath] string testFile = "")
    {
        var controller = Path.GetFullPath(Path.Combine(
            Path.GetDirectoryName(testFile)!,
            "..",
            "AuthService",
            "Controllers",
            "CounselingController.cs"));
        return File.ReadAllText(controller);
    }
}
