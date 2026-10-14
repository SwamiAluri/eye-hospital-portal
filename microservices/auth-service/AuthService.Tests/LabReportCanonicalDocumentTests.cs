using System.Reflection;
using System.Security.Claims;
using System.Text;
using AuthService.Authorization;
using AuthService.Context;
using AuthService.Controllers;
using AuthService.Models.Domain;
using AuthService.Services;
using AuthService.Services.Interfaces;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging.Abstractions;
using Moq;
using Xunit;
using PermissionAuthorizationHandler = AuthService.Services.PermissionAuthorizationHandler;
using PermissionRequirement = AuthService.Services.PermissionRequirement;

namespace AuthService.Tests;

public class LabReportCanonicalDocumentTests
{
    private static readonly Guid UserId = Guid.Parse("11111111-1111-1111-1111-111111111111");
    private static readonly Guid TenantId = Guid.Parse("22222222-2222-2222-2222-222222222222");
    private static readonly Guid OtherTenantId = Guid.Parse("33333333-3333-3333-3333-333333333333");

    [Fact]
    public void AttachEndpoint_RequiresPatientUpdate()
    {
        Assert.Equal(
            "patient.update",
            AttributeOf(typeof(LabReportsController), nameof(LabReportsController.AttachReport)));
    }

    [Fact]
    public void ContentEndpoint_RequiresPatientView_NotPatientDocumentDownload()
    {
        Assert.Equal(
            "patient.view",
            AttributeOf(typeof(LabReportsController), nameof(LabReportsController.ReportContent)));
        var source = File.ReadAllText(Path.Combine(Repo("AuthService"), "Controllers", "LabReportsController.cs"));
        Assert.DoesNotContain("patient.patient_document.download", source, StringComparison.Ordinal);
        Assert.DoesNotContain("lab.document", source, StringComparison.Ordinal);
    }

    [Fact]
    public void AssociationConstants_AreLabLabReport()
    {
        Assert.Equal("lab", CanonicalDocumentAssociations.LabDomain);
        Assert.Equal("LabReport", CanonicalDocumentAssociations.LabReportEntityType);
    }

    [Fact]
    public async Task Attach_ValidFile_CreatesCanonicalAndAssociation_WithoutChangingClinicalFields()
    {
        await using var db = CreateDb();
        var patientId = Guid.NewGuid();
        var report = Lab(TenantId, patientId, status: "in_progress", reportUrl: "https://external.example/old.pdf");
        report.ResultValue = "4.5";
        db.LabReports.Add(report);
        await db.SaveChangesAsync();

        var stored = new List<(string Container, string Key, byte[] Bytes)>();
        var updated = await Service(db, Blob(stored)).AttachReportAsync(
            TenantId, report.Id, PdfFile("cbc.pdf"), UserId);

        Assert.NotNull(updated.CanonicalDocumentId);
        Assert.Equal("cbc.pdf", updated.CanonicalFileName);
        Assert.Equal("application/pdf", updated.CanonicalMimeType);
        Assert.Equal("in_progress", updated.Status);
        Assert.Equal("4.5", updated.ResultValue);
        Assert.Equal("https://external.example/old.pdf", updated.ReportUrl);

        Assert.Equal(1, await db.CanonicalDocuments.CountAsync());
        Assert.Equal(1, await db.CanonicalDocumentAssociations.CountAsync());
        var association = await db.CanonicalDocumentAssociations.SingleAsync();
        Assert.Equal(CanonicalDocumentAssociations.LabDomain, association.Domain);
        Assert.Equal(CanonicalDocumentAssociations.LabReportEntityType, association.EntityType);
        Assert.Equal(report.Id, association.EntityId);
        Assert.Equal(updated.CanonicalDocumentId, association.DocumentId);
        Assert.Single(stored);
        Assert.Equal("patient-documents", stored[0].Container);

        var reloaded = await db.LabReports.AsNoTracking().SingleAsync(r => r.Id == report.Id);
        Assert.Equal("in_progress", reloaded.Status);
        Assert.Equal("4.5", reloaded.ResultValue);
        Assert.Equal("https://external.example/old.pdf", reloaded.ReportUrl);
    }

    [Fact]
    public async Task Attach_PatientIdDerivedFromLabReport_NotClient()
    {
        await using var db = CreateDb();
        var patientId = Guid.NewGuid();
        var report = Lab(TenantId, patientId);
        db.LabReports.Add(report);
        await db.SaveChangesAsync();
        var stored = new List<(string Container, string Key, byte[] Bytes)>();

        await Service(db, Blob(stored)).AttachReportAsync(TenantId, report.Id, PdfFile("a.pdf"), UserId);

        var canonical = await db.CanonicalDocuments.SingleAsync();
        Assert.Equal(patientId, canonical.PatientId);
        Assert.NotEqual(Guid.Empty, patientId);
    }

    [Fact]
    public async Task Attach_WrongTenant_NotFound()
    {
        await using var db = CreateDb();
        var report = Lab(TenantId, Guid.NewGuid());
        db.LabReports.Add(report);
        await db.SaveChangesAsync();
        var stored = new List<(string Container, string Key, byte[] Bytes)>();

        await Assert.ThrowsAsync<KeyNotFoundException>(() =>
            Service(db, Blob(stored)).AttachReportAsync(OtherTenantId, report.Id, PdfFile("a.pdf"), UserId));
        Assert.Empty(stored);
        Assert.Equal(0, await db.CanonicalDocuments.CountAsync());
    }

    [Fact]
    public async Task Attach_SoftDeletedLabReport_NotFound()
    {
        await using var db = CreateDb();
        var report = Lab(TenantId, Guid.NewGuid());
        report.DeletedAt = DateTime.UtcNow;
        db.LabReports.Add(report);
        await db.SaveChangesAsync();
        var stored = new List<(string Container, string Key, byte[] Bytes)>();

        await Assert.ThrowsAsync<KeyNotFoundException>(() =>
            Service(db, Blob(stored)).AttachReportAsync(TenantId, report.Id, PdfFile("a.pdf"), UserId));
        Assert.Empty(stored);
    }

    [Fact]
    public async Task Attach_SameBytes_Idempotent_ReusesCanonical()
    {
        await using var db = CreateDb();
        var patientId = Guid.NewGuid();
        var report = Lab(TenantId, patientId);
        db.LabReports.Add(report);
        await db.SaveChangesAsync();
        var stored = new List<(string Container, string Key, byte[] Bytes)>();
        var service = Service(db, Blob(stored));

        var first = await service.AttachReportAsync(TenantId, report.Id, PdfFile("a.pdf"), UserId);
        var second = await service.AttachReportAsync(TenantId, report.Id, PdfFile("a.pdf"), UserId);

        Assert.Equal(first.CanonicalDocumentId, second.CanonicalDocumentId);
        Assert.Equal(1, await db.CanonicalDocuments.CountAsync());
        Assert.Equal(1, await db.CanonicalDocumentAssociations.CountAsync());
        Assert.Single(stored);
    }

    [Fact]
    public async Task Attach_DifferentBytes_WhenAlreadyAttached_Conflicts_WithoutReplace()
    {
        await using var db = CreateDb();
        var patientId = Guid.NewGuid();
        var report = Lab(TenantId, patientId);
        db.LabReports.Add(report);
        await db.SaveChangesAsync();
        var stored = new List<(string Container, string Key, byte[] Bytes)>();
        var service = Service(db, Blob(stored));

        var first = await service.AttachReportAsync(TenantId, report.Id, PdfFile("a.pdf"), UserId);
        var ex = await Assert.ThrowsAsync<LabReportAttachmentConflictException>(() =>
            service.AttachReportAsync(
                TenantId,
                report.Id,
                FileOf("b.pdf", "application/pdf", Encoding.ASCII.GetBytes("%PDF-1.4 other")),
                UserId));

        Assert.Equal(first.CanonicalDocumentId, ex.ExistingCanonicalDocumentId);
        Assert.Equal(1, await db.CanonicalDocuments.CountAsync());
        Assert.Equal(1, await db.CanonicalDocumentAssociations.CountAsync());
        Assert.Equal(first.CanonicalDocumentId, (await db.CanonicalDocumentAssociations.SingleAsync()).DocumentId);
    }

    [Fact]
    public async Task Attach_SameBytesAsExistingGeneral_ReusesCanonical_AddsLabAssociation()
    {
        await using var db = CreateDb();
        var patientId = Guid.NewGuid();
        var report = Lab(TenantId, patientId);
        db.LabReports.Add(report);
        await db.SaveChangesAsync();
        var stored = new List<(string Container, string Key, byte[] Bytes)>();
        var blob = Blob(stored);
        var identity = new CanonicalDocumentIdentityService(db, blob, NullLogger<CanonicalDocumentIdentityService>.Instance);

        var general = await identity.ResolveOrCreateAsync(
            TenantId, patientId, UserId, PdfBytes(), "shared.pdf", "application/pdf", "general");
        await identity.EnsureAssociationAsync(
            general.Document.Id,
            CanonicalDocumentAssociations.MpiDomain,
            CanonicalDocumentAssociations.PatientEntityType,
            patientId,
            "general",
            UserId);

        var attached = await Service(db, blob).AttachReportAsync(TenantId, report.Id, PdfFile("lab.pdf"), UserId);

        Assert.Equal(general.Document.Id, attached.CanonicalDocumentId);
        Assert.Equal(1, await db.CanonicalDocuments.CountAsync());
        Assert.Equal(2, await db.CanonicalDocumentAssociations.CountAsync());
        Assert.Single(stored);
    }

    [Fact]
    public async Task Attach_RejectsEmptyFile()
    {
        await using var db = CreateDb();
        var report = Lab(TenantId, Guid.NewGuid());
        db.LabReports.Add(report);
        await db.SaveChangesAsync();

        await Assert.ThrowsAsync<ArgumentException>(() =>
            Service(db, Blob()).AttachReportAsync(
                TenantId, report.Id, FileOf("empty.pdf", "application/pdf", Array.Empty<byte>()), UserId));
    }

    [Fact]
    public async Task OpenContent_StreamsAssociatedDocument()
    {
        await using var db = CreateDb();
        var patientId = Guid.NewGuid();
        var report = Lab(TenantId, patientId);
        db.LabReports.Add(report);
        await db.SaveChangesAsync();
        var stored = new List<(string Container, string Key, byte[] Bytes)>();
        var blob = Blob(stored);
        var attached = await Service(db, blob).AttachReportAsync(TenantId, report.Id, PdfFile("a.pdf"), UserId);

        var key = $"{TenantId:N}/{attached.CanonicalDocumentId:N}";
        var pdf = PdfBytes();
        var readBlob = new Mock<IBlobStorageService>();
        readBlob.Setup(b => b.OpenReadExactAsync("patient-documents", key, It.IsAny<CancellationToken>()))
            .ReturnsAsync(new ExactBlobRead
            {
                Content = new MemoryStream(pdf),
                ContentType = "application/pdf",
                ContentLength = pdf.Length,
            });

        var content = await Service(db, readBlob.Object).OpenContentAsync(TenantId, report.Id);
        Assert.NotNull(content);
        Assert.Equal("application/pdf", content!.ContentType);
        Assert.Equal("a.pdf", content.FileName);
    }

    [Fact]
    public async Task OpenContent_WrongTenant_ReturnsNull()
    {
        await using var db = CreateDb();
        var report = Lab(TenantId, Guid.NewGuid());
        db.LabReports.Add(report);
        await db.SaveChangesAsync();
        var stored = new List<(string Container, string Key, byte[] Bytes)>();
        await Service(db, Blob(stored)).AttachReportAsync(TenantId, report.Id, PdfFile("a.pdf"), UserId);

        var content = await Service(db, Blob()).OpenContentAsync(OtherTenantId, report.Id);
        Assert.Null(content);
    }

    [Fact]
    public async Task OpenContent_MissingAssociation_ReturnsNull()
    {
        await using var db = CreateDb();
        var report = Lab(TenantId, Guid.NewGuid());
        db.LabReports.Add(report);
        await db.SaveChangesAsync();

        var content = await Service(db, Blob()).OpenContentAsync(TenantId, report.Id);
        Assert.Null(content);
    }

    [Fact]
    public async Task OpenContent_CanonicalWithoutLabAssociation_ReturnsNull()
    {
        await using var db = CreateDb();
        var patientId = Guid.NewGuid();
        var report = Lab(TenantId, patientId);
        var canonicalId = Guid.NewGuid();
        db.LabReports.Add(report);
        db.CanonicalDocuments.Add(new CanonicalDocument
        {
            Id = canonicalId,
            TenantId = TenantId,
            PatientId = patientId,
            StorageBackend = "azure-blob",
            StorageContainer = "patient-documents",
            StorageObjectKey = $"{TenantId:N}/{canonicalId:N}",
            FileName = "g.pdf",
            MimeType = "application/pdf",
            SizeBytes = 12,
            ContentHash = "abc",
            Classification = "general",
            Status = "active",
            CreatedByUserId = UserId,
            CreatedAt = DateTime.UtcNow,
        });
        db.CanonicalDocumentAssociations.Add(new CanonicalDocumentAssociation
        {
            Id = Guid.NewGuid(),
            DocumentId = canonicalId,
            Domain = CanonicalDocumentAssociations.MpiDomain,
            EntityType = CanonicalDocumentAssociations.PatientEntityType,
            EntityId = patientId,
            Category = "general",
            Role = "primary",
            CreatedByUserId = UserId,
            CreatedAt = DateTime.UtcNow,
        });
        await db.SaveChangesAsync();

        var content = await Service(db, Blob()).OpenContentAsync(TenantId, report.Id);
        Assert.Null(content);
    }

    [Fact]
    public async Task PopulateCanonical_SetsMetadataOnReports()
    {
        await using var db = CreateDb();
        var patientId = Guid.NewGuid();
        var report = Lab(TenantId, patientId);
        db.LabReports.Add(report);
        await db.SaveChangesAsync();
        var stored = new List<(string Container, string Key, byte[] Bytes)>();
        await Service(db, Blob(stored)).AttachReportAsync(TenantId, report.Id, PdfFile("cbc.pdf"), UserId);

        var list = await db.LabReports.Where(r => r.Id == report.Id).ToListAsync();
        await Service(db, Blob()).PopulateCanonicalAsync(TenantId, list);

        Assert.NotNull(list[0].CanonicalDocumentId);
        Assert.Equal("cbc.pdf", list[0].CanonicalFileName);
    }

    [Fact]
    public async Task Controller_AttachConflict_Returns409()
    {
        await using var db = CreateDb();
        var patientId = Guid.NewGuid();
        var report = Lab(TenantId, patientId);
        db.LabReports.Add(report);
        await db.SaveChangesAsync();
        var stored = new List<(string Container, string Key, byte[] Bytes)>();
        var service = Service(db, Blob(stored));
        await service.AttachReportAsync(TenantId, report.Id, PdfFile("a.pdf"), UserId);

        var controller = Controller(db, service);
        var result = await controller.AttachReport(
            report.Id,
            FileOf("b.pdf", "application/pdf", Encoding.ASCII.GetBytes("%PDF-1.4 other")),
            CancellationToken.None);

        var conflict = Assert.IsType<ConflictObjectResult>(result);
        Assert.Equal(StatusCodes.Status409Conflict, conflict.StatusCode);
    }

    [Fact]
    public async Task PatientDocumentDownload_DoesNotAuthorizeLabContent()
    {
        Assert.False(await Authorize("patient.patient_document.download", "patient.view"));
        Assert.True(await Authorize("patient.view", "patient.view"));
    }

    private static LabReportsController Controller(AppDbContext db, ILabReportCanonicalDocumentService service)
    {
        var controller = new LabReportsController(db, service, NullLogger<LabReportsController>.Instance);
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

    private static async Task<bool> Authorize(string granted, string required)
    {
        var requirement = new PermissionRequirement(required);
        var identity = new ClaimsIdentity("test");
        identity.AddClaim(new Claim(ClaimTypes.NameIdentifier, UserId.ToString()));
        identity.AddClaim(new Claim("tenant_id", TenantId.ToString()));
        identity.AddClaim(new Claim("permission", granted));
        var context = new AuthorizationHandlerContext(new[] { requirement }, new ClaimsPrincipal(identity), null);
        await using var db = CreateDb();
        await new PermissionAuthorizationHandler(db).HandleAsync(context);
        return context.HasSucceeded;
    }

    private static string AttributeOf(Type type, string method) =>
        type.GetMethods(BindingFlags.Instance | BindingFlags.Public | BindingFlags.DeclaredOnly)
            .Single(m => m.Name == method)
            .GetCustomAttributes(typeof(RequirePermissionAttribute), false)
            .Cast<RequirePermissionAttribute>()
            .Single()
            .PermissionCode;

    private static ILabReportCanonicalDocumentService Service(AppDbContext db, IBlobStorageService blob) =>
        new LabReportCanonicalDocumentService(
            db,
            blob,
            new CanonicalDocumentIdentityService(db, blob, NullLogger<CanonicalDocumentIdentityService>.Instance));

    private static IBlobStorageService Blob(List<(string Container, string Key, byte[] Bytes)>? stored = null)
    {
        var blob = new Mock<IBlobStorageService>();
        blob.Setup(b => b.UploadExactKeyAsync(It.IsAny<string>(), It.IsAny<string>(), It.IsAny<Stream>(), It.IsAny<string>(), It.IsAny<CancellationToken>()))
            .Callback<string, string, Stream, string, CancellationToken>((container, key, stream, _, _) =>
            {
                using var ms = new MemoryStream();
                stream.CopyTo(ms);
                stored?.Add((container, key, ms.ToArray()));
            })
            .Returns(Task.CompletedTask);
        blob.Setup(b => b.DeleteExactKeyAsync(It.IsAny<string>(), It.IsAny<string>(), It.IsAny<CancellationToken>()))
            .Returns(Task.CompletedTask);
        return blob.Object;
    }

    private static LabReport Lab(Guid tenantId, Guid patientId, string status = "ordered", string? reportUrl = null) =>
        new()
        {
            Id = Guid.NewGuid(),
            TenantId = tenantId,
            PatientId = patientId,
            TestName = "CBC",
            TestCategory = "hematology",
            Priority = "routine",
            Status = status,
            ReportUrl = reportUrl,
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow,
        };

    private static IFormFile PdfFile(string name) => FileOf(name, "application/pdf", PdfBytes());

    private static IFormFile FileOf(string name, string mime, byte[] bytes)
    {
        var stream = new MemoryStream(bytes);
        return new FormFile(stream, 0, bytes.Length, "file", name)
        {
            Headers = new HeaderDictionary(),
            ContentType = mime,
        };
    }

    private static byte[] PdfBytes() => Encoding.ASCII.GetBytes("%PDF-1.4 test");

    private static AppDbContext CreateDb() =>
        new(new DbContextOptionsBuilder<AppDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString("N"))
            .Options, new HttpContextAccessor());

    private static string Repo(string project, [System.Runtime.CompilerServices.CallerFilePath] string testFile = "") =>
        Path.GetFullPath(Path.Combine(Path.GetDirectoryName(testFile)!, "..", project));
}
