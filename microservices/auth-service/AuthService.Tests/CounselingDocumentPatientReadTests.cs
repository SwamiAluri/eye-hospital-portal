using System.Security.Claims;
using AuthService.Authorization;
using AuthService.Context;
using AuthService.Controllers;
using AuthService.Models.Counselor;
using AuthService.Models.Domain;
using AuthService.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Http;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging.Abstractions;
using Xunit;

namespace AuthService.Tests;

/// <summary>
/// Patient 360 counselling document metadata. Permission is session_documents.read.
/// Tenant applies to the session and the document. No branch predicate. No file path.
/// </summary>
public class CounselingDocumentPatientReadTests
{
    private static readonly Guid UserId = Guid.Parse("11111111-1111-1111-1111-111111111111");
    private static readonly Guid TenantId = Guid.Parse("22222222-2222-2222-2222-222222222222");
    private static readonly Guid OtherTenantId = Guid.Parse("33333333-3333-3333-3333-333333333333");

    [Fact]
    public async Task SessionDocumentsRead_Allows_ThePatientRead()
    {
        var succeeded = await Authorize("session_documents.read");
        Assert.True(succeeded);
    }

    [Fact]
    public async Task Unauthenticated_IsRejected_BeforeDataLoad()
    {
        var requirement = new PermissionRequirement("session_documents.read");
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
    [InlineData("counseling_sessions.read")]
    [InlineData("counseling_sessions.update")]
    [InlineData("session_documents.create")]
    [InlineData("session_documents.delete")]
    [InlineData("patient.view")]
    public async Task SiblingPermission_DoesNotAuthorize(string permission)
    {
        Assert.False(await Authorize(permission));
    }

    [Fact]
    public void Endpoint_RequiresExactlySessionDocumentsRead()
    {
        var method = typeof(CounselingSessionDocumentPatientReadController).GetMethod(nameof(CounselingSessionDocumentPatientReadController.ByPatient));
        var permission = method!.GetCustomAttributes(typeof(RequirePermissionAttribute), false)
            .Cast<RequirePermissionAttribute>()
            .Single();
        Assert.Equal("session_documents.read", permission.PermissionCode);
        Assert.NotNull(typeof(CounselingSessionDocumentPatientReadController).GetCustomAttributes(typeof(AuthorizeAttribute), true).SingleOrDefault());
    }

    [Fact]
    public async Task Read_ReturnsOnlyThatPatientsDocuments_WithoutFilePath()
    {
        await using var db = CreateDb();
        var patientA = Guid.NewGuid();
        var patientB = Guid.NewGuid();
        var sessionA1 = Session(TenantId, patientA, Guid.NewGuid());
        var sessionA2 = Session(TenantId, patientA, Guid.NewGuid());
        var sessionB = Session(TenantId, patientB, null);
        var other = Session(OtherTenantId, patientA, null);
        var deletedSession = Session(TenantId, patientA, null, deleted: DateTime.UtcNow);
        db.CounselingSession.AddRange(sessionA1, sessionA2, sessionB, other, deletedSession);
        db.CounselingSessionDocuments.AddRange(
            Doc(TenantId, sessionA1.Id, "older.pdf", created: DateTime.UtcNow.AddMinutes(-2)),
            Doc(TenantId, sessionA2.Id, "newer.pdf", created: DateTime.UtcNow),
            Doc(TenantId, sessionA1.Id, "deleted.pdf", deleted: DateTime.UtcNow),
            Doc(TenantId, sessionB.Id, "other-patient.pdf"),
            Doc(OtherTenantId, other.Id, "other-tenant.pdf"),
            Doc(TenantId, deletedSession.Id, "deleted-session.pdf"),
            Doc(OtherTenantId, sessionA1.Id, "tenant-mismatch.pdf"));
        await db.SaveChangesAsync();

        var page = await Service(db).ListMetadataByPatientIdAsync(TenantId, patientA);
        var rows = page.Documents;

        Assert.Equal(new[] { "newer.pdf", "older.pdf" }, rows.Select(r => r.DocumentName).ToArray());
        Assert.Equal(2, page.TotalCount);
        Assert.Equal(1, page.PageNumber);
        Assert.Equal(20, page.PageSize);
        Assert.DoesNotContain(rows, r => r.GetType().GetProperty("FilePath") != null);
        var json = System.Text.Json.JsonSerializer.Serialize(rows);
        Assert.DoesNotContain("files.example", json);
        Assert.DoesNotContain("filePath", json, StringComparison.OrdinalIgnoreCase);
    }

    [Fact]
    public async Task DifferentPatient_ReturnsEmpty()
    {
        await using var db = CreateDb();
        var patientB = Guid.NewGuid();
        var session = Session(TenantId, patientB, null);
        db.CounselingSession.Add(session);
        db.CounselingSessionDocuments.Add(Doc(TenantId, session.Id, "b.pdf"));
        await db.SaveChangesAsync();

        var rows = (await Service(db).ListMetadataByPatientIdAsync(TenantId, Guid.NewGuid())).Documents;

        Assert.Empty(rows);
    }

    [Fact]
    public async Task EmptyPatient_ReturnsEmptyList()
    {
        await using var db = CreateDb();
        var page = await Service(db).ListMetadataByPatientIdAsync(TenantId, Guid.NewGuid());
        Assert.Empty(page.Documents);
        Assert.Equal(0, page.TotalCount);
    }

    [Fact]
    public async Task StoredSessionBranchId_IsNotAQueryPredicate()
    {
        await using var db = CreateDb();
        var patientId = Guid.NewGuid();
        var branchA = Session(TenantId, patientId, Guid.NewGuid());
        var branchB = Session(TenantId, patientId, Guid.NewGuid());
        var noBranch = Session(TenantId, patientId, null);
        db.CounselingSession.AddRange(branchA, branchB, noBranch);
        db.CounselingSessionDocuments.AddRange(
            Doc(TenantId, branchA.Id, "br-a.pdf"),
            Doc(TenantId, branchB.Id, "br-b.pdf"),
            Doc(TenantId, noBranch.Id, "br-null.pdf"));
        await db.SaveChangesAsync();

        var names = (await Service(db).ListMetadataByPatientIdAsync(TenantId, patientId)).Documents
            .Select(r => r.DocumentName)
            .OrderBy(n => n)
            .ToArray();

        Assert.Equal(new[] { "br-a.pdf", "br-b.pdf", "br-null.pdf" }, names);
    }

    [Fact]
    public async Task OnePatientQuery_ReturnsDocumentsFromMultipleSessions()
    {
        await using var db = CreateDb();
        var patientId = Guid.NewGuid();
        var first = Session(TenantId, patientId, null);
        var second = Session(TenantId, patientId, null);
        db.CounselingSession.AddRange(first, second);
        db.CounselingSessionDocuments.AddRange(
            Doc(TenantId, first.Id, "first.pdf"),
            Doc(TenantId, second.Id, "second.pdf"));
        await db.SaveChangesAsync();

        var rows = (await Service(db).ListMetadataByPatientIdAsync(TenantId, patientId)).Documents;

        Assert.Equal(2, rows.Count);
    }

    [Fact]
    public async Task ExistingSessionDocumentList_StillReturnsFilePath()
    {
        await using var db = CreateDb();
        var session = Session(TenantId, Guid.NewGuid(), null);
        db.CounselingSession.Add(session);
        db.CounselingSessionDocuments.Add(Doc(TenantId, session.Id, "existing.pdf"));
        await db.SaveChangesAsync();

        var rows = await Service(db).GetSessionDocumentsAsync(TenantId, session.Id);

        Assert.Equal("existing.pdf", rows[0].DocumentName);
        Assert.Contains("files.example", rows[0].FilePath);
    }

    [Fact]
    public void PatientRead_DoesNotCallTheSessionDocumentList()
    {
        var source = ServiceSource();
        var start = source.IndexOf("ListMetadataByPatientIdAsync", StringComparison.Ordinal);
        var end = source.IndexOf("GetSessionDocumentsAsync", start, StringComparison.Ordinal);
        var body = source[start..end];
        Assert.DoesNotContain("GetSessionDocumentsAsync", body);
        Assert.DoesNotContain("_blobStorageService", body);
        Assert.Contains("session.DeletedAt == null", body);
        Assert.Contains("document.DeletedAt == null", body);
    }

    [Fact]
    public async Task PatientRead_PagesOnTheServer_AndCapsPageSize()
    {
        await using var db = CreateDb();
        var patientId = Guid.NewGuid();
        var session = Session(TenantId, patientId, null);
        db.CounselingSession.Add(session);
        var older = Doc(TenantId, session.Id, "older.pdf", created: DateTime.UtcNow.AddMinutes(-2));
        var newer = Doc(TenantId, session.Id, "newer.pdf", created: DateTime.UtcNow);
        db.CounselingSessionDocuments.AddRange(older, newer);
        await db.SaveChangesAsync();

        var page1 = await Service(db).ListMetadataByPatientIdAsync(TenantId, patientId, page: 1, pageSize: 1);
        var page2 = await Service(db).ListMetadataByPatientIdAsync(TenantId, patientId, page: 2, pageSize: 1);
        var capped = await Service(db).ListMetadataByPatientIdAsync(TenantId, patientId, page: 1, pageSize: 500);
        var again = await Service(db).ListMetadataByPatientIdAsync(TenantId, patientId, page: 1, pageSize: 1);

        Assert.Equal(new[] { "newer.pdf" }, page1.Documents.Select(d => d.DocumentName).ToArray());
        Assert.Equal(new[] { "older.pdf" }, page2.Documents.Select(d => d.DocumentName).ToArray());
        Assert.Equal(2, page1.TotalCount);
        Assert.Equal(2, page2.TotalCount);
        Assert.Equal(page1.Documents[0].DocumentName, again.Documents[0].DocumentName);
        Assert.Equal(100, capped.PageSize);
        Assert.Equal(2, capped.Documents.Count);
        Assert.Equal(2, capped.TotalCount);
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
        var requirement = new PermissionRequirement("session_documents.read");
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

    private static CounselingSession Session(Guid tenantId, Guid patientId, Guid? branchId, DateTime? deleted = null) =>
        new()
        {
            Id = Guid.NewGuid(),
            TenantId = tenantId,
            BranchId = branchId,
            PatientId = patientId,
            ReferredByDoctorId = Guid.NewGuid(),
            SessionType = "Initial",
            SessionDate = DateTime.UtcNow.Date,
            PatientType = "Cash",
            Status = "InProgress",
            CreatedAt = DateTime.UtcNow,
            DeletedAt = deleted,
        };

    private static CounselingSessionDocument Doc(
        Guid tenantId,
        Guid sessionId,
        string name,
        DateTime? created = null,
        DateTime? deleted = null) =>
        new()
        {
            Id = Guid.NewGuid(),
            TenantId = tenantId,
            SessionId = sessionId,
            DocumentName = name,
            DocumentType = "ReferralLetter",
            FilePath = "https://files.example/private/" + name,
            FileType = "pdf",
            FileSizeBytes = 1024,
            Status = "active",
            CreatedAt = created ?? DateTime.UtcNow,
            UpdatedAt = created ?? DateTime.UtcNow,
            CreatedByUserId = UserId,
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
}
