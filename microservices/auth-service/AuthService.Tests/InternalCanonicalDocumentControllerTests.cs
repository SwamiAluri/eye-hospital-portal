using System.Security.Cryptography;
using AuthService.Context;
using AuthService.Controllers;
using AuthService.Models.Domain;
using AuthService.Services;
using AuthService.Services.Interfaces;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging.Abstractions;
using Moq;
using Xunit;

namespace AuthService.Tests;

public class InternalCanonicalDocumentControllerTests
{
    private static readonly Guid TenantId = Guid.Parse("aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa");
    private static readonly Guid PatientId = Guid.Parse("bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb");
    private static readonly Guid UserId = Guid.Parse("cccccccc-cccc-cccc-cccc-cccccccccccc");
    private const string InternalKey = "test-internal-key";

    [Fact]
    public async Task RegisterExternal_CreatesCanonicalAndCcmsAssociation_WithoutBlobCopy()
    {
        await using var db = CreateDb();
        var stored = new List<(string Container, string Key)>();
        var identity = new CanonicalDocumentIdentityService(
            db, Blob(stored), NullLogger<CanonicalDocumentIdentityService>.Instance);
        var bytes = PdfBytes();
        var hash = Convert.ToHexString(SHA256.HashData(bytes)).ToLowerInvariant();
        var ccmsDocId = Guid.NewGuid();
        var ctl = Controller(db, identity);

        var result = await ctl.RegisterExternal(new InternalCanonicalDocumentController.RegisterExternalRequest(
            TenantId,
            PatientId,
            UserId,
            ccmsDocId,
            hash,
            bytes.Length,
            "policy.pdf",
            "application/pdf",
            "policy_document",
            "ccms-documents",
            "cases/x/policy.pdf"), CancellationToken.None);

        var ok = Assert.IsType<OkObjectResult>(result);
        var body = Assert.IsType<InternalCanonicalDocumentController.RegisterExternalResponse>(ok.Value);
        Assert.NotEqual(Guid.Empty, body.CanonicalDocumentId);
        Assert.True(body.Created);
        Assert.Empty(stored);
        Assert.Equal(1, await db.CanonicalDocuments.CountAsync());
        Assert.Equal("ccms-documents", (await db.CanonicalDocuments.SingleAsync()).StorageContainer);
        var assoc = await db.CanonicalDocumentAssociations.SingleAsync();
        Assert.Equal(CanonicalDocumentAssociations.CcmsDomain, assoc.Domain);
        Assert.Equal(CanonicalDocumentAssociations.CcmsDocumentEntityType, assoc.EntityType);
        Assert.Equal(ccmsDocId, assoc.EntityId);
    }

    [Fact]
    public async Task RegisterExternal_SameHash_ReusesCanonical_AddsAssociationIdempotently()
    {
        await using var db = CreateDb();
        var identity = new CanonicalDocumentIdentityService(
            db, Blob(), NullLogger<CanonicalDocumentIdentityService>.Instance);
        var bytes = PdfBytes();
        var hash = Convert.ToHexString(SHA256.HashData(bytes)).ToLowerInvariant();
        var ctl = Controller(db, identity);

        var first = await ctl.RegisterExternal(Req(Guid.NewGuid(), hash, bytes.Length), CancellationToken.None);
        var firstBody = Assert.IsType<InternalCanonicalDocumentController.RegisterExternalResponse>(
            Assert.IsType<OkObjectResult>(first).Value);
        var secondDocId = Guid.NewGuid();
        var second = await ctl.RegisterExternal(Req(secondDocId, hash, bytes.Length), CancellationToken.None);
        var secondBody = Assert.IsType<InternalCanonicalDocumentController.RegisterExternalResponse>(
            Assert.IsType<OkObjectResult>(second).Value);

        Assert.Equal(firstBody.CanonicalDocumentId, secondBody.CanonicalDocumentId);
        Assert.False(secondBody.Created);
        Assert.Equal(1, await db.CanonicalDocuments.CountAsync());
        Assert.Equal(2, await db.CanonicalDocumentAssociations.CountAsync());

        var again = await ctl.RegisterExternal(Req(secondDocId, hash, bytes.Length), CancellationToken.None);
        Assert.IsType<OkObjectResult>(again);
        Assert.Equal(2, await db.CanonicalDocumentAssociations.CountAsync());
    }

    [Fact]
    public async Task RegisterLmsOfficialPdf_UsesEnterpriseLmsAssociation_NotPathologyLabReport()
    {
        await using var db = CreateDb();
        var stored = new List<(string Container, string Key)>();
        var identity = new CanonicalDocumentIdentityService(
            db, Blob(stored), NullLogger<CanonicalDocumentIdentityService>.Instance);
        var bytes = PdfBytes();
        var hash = Convert.ToHexString(SHA256.HashData(bytes)).ToLowerInvariant();
        var artifactId = Guid.NewGuid();
        var ctl = Controller(db, identity);

        var result = await ctl.RegisterLmsOfficialPdf(
            new InternalCanonicalDocumentController.RegisterLmsOfficialPdfRequest(
                TenantId,
                PatientId,
                UserId,
                artifactId,
                Convert.ToBase64String(bytes),
                "RPT-1.pdf",
                "application/pdf",
                hash,
                bytes.Length),
            CancellationToken.None);

        var ok = Assert.IsType<OkObjectResult>(result);
        var body = Assert.IsType<InternalCanonicalDocumentController.RegisterExternalResponse>(ok.Value);
        Assert.NotEqual(Guid.Empty, body.CanonicalDocumentId);
        Assert.True(body.Created);
        Assert.NotEmpty(stored);
        var assoc = await db.CanonicalDocumentAssociations.SingleAsync();
        Assert.Equal(CanonicalDocumentAssociations.EnterpriseLmsDomain, assoc.Domain);
        Assert.Equal(CanonicalDocumentAssociations.LmsReportOfficialPdfArtifactEntityType, assoc.EntityType);
        Assert.Equal(artifactId, assoc.EntityId);
        Assert.NotEqual(CanonicalDocumentAssociations.LabDomain, assoc.Domain);
        Assert.NotEqual(CanonicalDocumentAssociations.LabReportEntityType, assoc.EntityType);
    }

    [Fact]
    public async Task RemoveAssociation_DoesNotDeleteCanonical_WhenOtherAssociationExists()
    {
        await using var db = CreateDb();
        var identity = new CanonicalDocumentIdentityService(
            db, Blob(), NullLogger<CanonicalDocumentIdentityService>.Instance);
        var bytes = PdfBytes();
        var hash = Convert.ToHexString(SHA256.HashData(bytes)).ToLowerInvariant();
        var ctl = Controller(db, identity);
        var ccmsDocId = Guid.NewGuid();

        var registered = Assert.IsType<InternalCanonicalDocumentController.RegisterExternalResponse>(
            Assert.IsType<OkObjectResult>(
                await ctl.RegisterExternal(Req(ccmsDocId, hash, bytes.Length), CancellationToken.None)).Value);

        await identity.EnsureAssociationAsync(
            registered.CanonicalDocumentId,
            CanonicalDocumentAssociations.CounsellingDomain,
            CanonicalDocumentAssociations.CounsellingPatientEntityType,
            PatientId,
            "PolicyDocument",
            UserId);

        var remove = await ctl.RemoveAssociation(
            new InternalCanonicalDocumentController.RemoveAssociationRequest(TenantId, ccmsDocId),
            CancellationToken.None);
        Assert.IsType<OkObjectResult>(remove);

        var doc = await db.CanonicalDocuments.SingleAsync();
        Assert.Null(doc.DeletedAt);
        Assert.Equal(1, await db.CanonicalDocumentAssociations.CountAsync());
        Assert.Equal(CanonicalDocumentAssociations.CounsellingDomain,
            (await db.CanonicalDocumentAssociations.SingleAsync()).Domain);
    }

    [Fact]
    public async Task RegisterExternal_RejectsMissingInternalKey()
    {
        await using var db = CreateDb();
        var identity = new CanonicalDocumentIdentityService(
            db, Blob(), NullLogger<CanonicalDocumentIdentityService>.Instance);
        var ctl = Controller(db, identity, authorize: false);
        var result = await ctl.RegisterExternal(
            Req(Guid.NewGuid(), "abc", 1), CancellationToken.None);
        Assert.IsType<UnauthorizedObjectResult>(result);
    }

    [Fact]
    public async Task OpenLmsOfficialPdfContent_Streams_EnterpriseLms_Association()
    {
        await using var db = CreateDb();
        var content = new Dictionary<(string Container, string Key), byte[]>();
        var blob = Blob(contentByKey: content);
        var identity = new CanonicalDocumentIdentityService(
            db, blob, NullLogger<CanonicalDocumentIdentityService>.Instance);
        var bytes = PdfBytes();
        var hash = Convert.ToHexString(SHA256.HashData(bytes)).ToLowerInvariant();
        var artifactId = Guid.NewGuid();
        var ctl = ControllerWithBlob(db, identity, blob);

        var registered = Assert.IsType<InternalCanonicalDocumentController.RegisterExternalResponse>(
            Assert.IsType<OkObjectResult>(
                await ctl.RegisterLmsOfficialPdf(
                    new InternalCanonicalDocumentController.RegisterLmsOfficialPdfRequest(
                        TenantId, PatientId, UserId, artifactId,
                        Convert.ToBase64String(bytes), "UAT-RPT.pdf", "application/pdf", hash, bytes.Length),
                    CancellationToken.None)).Value);

        var open = await ctl.OpenLmsOfficialPdfContent(
            new InternalCanonicalDocumentController.LmsOfficialPdfContentRequest(
                TenantId, artifactId, registered.CanonicalDocumentId),
            CancellationToken.None);
        var file = Assert.IsType<FileStreamResult>(open);
        Assert.Equal("application/pdf", file.ContentType);
        Assert.Equal("UAT-RPT.pdf", file.FileDownloadName);
        using var ms = new MemoryStream();
        await file.FileStream.CopyToAsync(ms);
        Assert.Equal(bytes, ms.ToArray());
    }

    [Fact]
    public async Task OpenLmsOfficialPdfContent_Rejects_Wrong_Key_And_Pathology_Association()
    {
        await using var db = CreateDb();
        var content = new Dictionary<(string Container, string Key), byte[]>();
        var blob = Blob(contentByKey: content);
        var identity = new CanonicalDocumentIdentityService(
            db, blob, NullLogger<CanonicalDocumentIdentityService>.Instance);
        var ctl = ControllerWithBlob(db, identity, blob, authorize: false);
        var denied = await ctl.OpenLmsOfficialPdfContent(
            new InternalCanonicalDocumentController.LmsOfficialPdfContentRequest(TenantId, Guid.NewGuid()),
            CancellationToken.None);
        Assert.IsType<UnauthorizedObjectResult>(denied);

        var ctlOk = ControllerWithBlob(db, identity, blob);
        var bytes = PdfBytes();
        var hash = Convert.ToHexString(SHA256.HashData(bytes)).ToLowerInvariant();
        var labReportId = Guid.NewGuid();
        var resolve = await identity.ResolveOrCreateAsync(
            TenantId, PatientId, UserId, bytes, "lab.pdf", "application/pdf", "LabReport", CancellationToken.None);
        await identity.EnsureAssociationAsync(
            resolve.Document.Id,
            CanonicalDocumentAssociations.LabDomain,
            CanonicalDocumentAssociations.LabReportEntityType,
            labReportId,
            "LabReport",
            UserId);

        var missing = await ctlOk.OpenLmsOfficialPdfContent(
            new InternalCanonicalDocumentController.LmsOfficialPdfContentRequest(TenantId, labReportId),
            CancellationToken.None);
        Assert.IsType<NotFoundObjectResult>(missing);
    }

    [Fact]
    public async Task OpenLmsOfficialPdfContent_Rejects_Tenant_Mismatch_And_Canonical_Mismatch()
    {
        await using var db = CreateDb();
        var content = new Dictionary<(string Container, string Key), byte[]>();
        var blob = Blob(contentByKey: content);
        var identity = new CanonicalDocumentIdentityService(
            db, blob, NullLogger<CanonicalDocumentIdentityService>.Instance);
        var bytes = PdfBytes();
        var hash = Convert.ToHexString(SHA256.HashData(bytes)).ToLowerInvariant();
        var artifactId = Guid.NewGuid();
        var ctl = ControllerWithBlob(db, identity, blob);
        var registered = Assert.IsType<InternalCanonicalDocumentController.RegisterExternalResponse>(
            Assert.IsType<OkObjectResult>(
                await ctl.RegisterLmsOfficialPdf(
                    new InternalCanonicalDocumentController.RegisterLmsOfficialPdfRequest(
                        TenantId, PatientId, UserId, artifactId,
                        Convert.ToBase64String(bytes), "R.pdf", "application/pdf", hash, bytes.Length),
                    CancellationToken.None)).Value);

        var wrongTenantHeader = ControllerWithBlob(db, identity, blob, tenantHeader: Guid.NewGuid());
        var mismatch = await wrongTenantHeader.OpenLmsOfficialPdfContent(
            new InternalCanonicalDocumentController.LmsOfficialPdfContentRequest(TenantId, artifactId),
            CancellationToken.None);
        Assert.IsType<BadRequestObjectResult>(mismatch);

        var badDoc = await ctl.OpenLmsOfficialPdfContent(
            new InternalCanonicalDocumentController.LmsOfficialPdfContentRequest(
                TenantId, artifactId, Guid.NewGuid()),
            CancellationToken.None);
        Assert.IsType<BadRequestObjectResult>(badDoc);
        _ = registered;
    }

    [Fact]
    public async Task LookupByEntities_ReturnsMappedCanonicalIds()
    {
        await using var db = CreateDb();
        var identity = new CanonicalDocumentIdentityService(
            db, Blob(), NullLogger<CanonicalDocumentIdentityService>.Instance);
        var ctl = Controller(db, identity);
        var bytes = PdfBytes();
        var hash = Convert.ToHexString(SHA256.HashData(bytes)).ToLowerInvariant();
        var ccmsDocId = Guid.NewGuid();
        var registered = Assert.IsType<InternalCanonicalDocumentController.RegisterExternalResponse>(
            Assert.IsType<OkObjectResult>(
                await ctl.RegisterExternal(Req(ccmsDocId, hash, bytes.Length), CancellationToken.None)).Value);

        var lookup = await ctl.LookupByEntities(
            new InternalCanonicalDocumentController.LookupByEntitiesRequest(
                CanonicalDocumentAssociations.CcmsDomain,
                CanonicalDocumentAssociations.CcmsDocumentEntityType,
                new[] { ccmsDocId }),
            CancellationToken.None);
        var ok = Assert.IsType<OkObjectResult>(lookup);
        var payload = ok.Value!;
        var itemsProp = payload.GetType().GetProperty("items")!.GetValue(payload) as IEnumerable<object>;
        Assert.NotNull(itemsProp);
        var item = Assert.Single(itemsProp!.Cast<InternalCanonicalDocumentController.LookupByEntitiesItem>());
        Assert.Equal(ccmsDocId, item.EntityId);
        Assert.Equal(registered.CanonicalDocumentId, item.CanonicalDocumentId);
    }

    private static InternalCanonicalDocumentController.RegisterExternalRequest Req(
        Guid ccmsDocId, string hash, long size) =>
        new(TenantId, PatientId, UserId, ccmsDocId, hash, size, "f.pdf", "application/pdf",
            "policy_document", "ccms-documents", "cases/x/f.pdf");

    private static InternalCanonicalDocumentController Controller(
        AppDbContext db,
        ICanonicalDocumentIdentityService identity,
        bool authorize = true)
    {
        var config = new ConfigurationBuilder()
            .AddInMemoryCollection(new Dictionary<string, string?>
            {
                ["InternalApi:Key"] = InternalKey,
            })
            .Build();
        var ctl = new InternalCanonicalDocumentController(
            identity, Blob(), db, config, NullLogger<InternalCanonicalDocumentController>.Instance);
        var http = new DefaultHttpContext();
        if (authorize)
            http.Request.Headers["X-Internal-Key"] = InternalKey;
        ctl.ControllerContext = new ControllerContext { HttpContext = http };
        return ctl;
    }

    private static InternalCanonicalDocumentController ControllerWithBlob(
        AppDbContext db,
        ICanonicalDocumentIdentityService identity,
        IBlobStorageService blob,
        bool authorize = true,
        Guid? tenantHeader = null)
    {
        var config = new ConfigurationBuilder()
            .AddInMemoryCollection(new Dictionary<string, string?>
            {
                ["InternalApi:Key"] = InternalKey,
            })
            .Build();
        var ctl = new InternalCanonicalDocumentController(
            identity, blob, db, config, NullLogger<InternalCanonicalDocumentController>.Instance);
        var http = new DefaultHttpContext();
        if (authorize)
            http.Request.Headers["X-Internal-Key"] = InternalKey;
        http.Request.Headers["X-Tenant-ID"] = (tenantHeader ?? TenantId).ToString("D");
        ctl.ControllerContext = new ControllerContext { HttpContext = http };
        return ctl;
    }

    private static IBlobStorageService Blob(
        List<(string Container, string Key)>? stored = null,
        Dictionary<(string Container, string Key), byte[]>? contentByKey = null)
    {
        var blob = new Mock<IBlobStorageService>();
        blob.Setup(b => b.UploadExactKeyAsync(
                It.IsAny<string>(), It.IsAny<string>(), It.IsAny<Stream>(), It.IsAny<string>(), It.IsAny<CancellationToken>()))
            .Callback<string, string, Stream, string, CancellationToken>((c, k, s, _, _) =>
            {
                stored?.Add((c, k));
                if (contentByKey is not null)
                {
                    using var ms = new MemoryStream();
                    s.CopyTo(ms);
                    contentByKey[(c, k)] = ms.ToArray();
                }
            })
            .Returns(Task.CompletedTask);
        blob.Setup(b => b.DeleteExactKeyAsync(It.IsAny<string>(), It.IsAny<string>(), It.IsAny<CancellationToken>()))
            .Returns(Task.CompletedTask);
        blob.Setup(b => b.OpenReadExactAsync(
                It.IsAny<string>(), It.IsAny<string>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync((string c, string k, CancellationToken _) =>
            {
                if (contentByKey is null || !contentByKey.TryGetValue((c, k), out var bytes))
                    return null;
                return new ExactBlobRead
                {
                    Content = new MemoryStream(bytes),
                    ContentType = "application/pdf",
                    ContentLength = bytes.Length,
                };
            });
        return blob.Object;
    }

    private static AppDbContext CreateDb()
    {
        var options = new DbContextOptionsBuilder<AppDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString("N"))
            .Options;
        return new AppDbContext(options, new HttpContextAccessor());
    }

    private static byte[] PdfBytes() => "%PDF-1.4 canonical-ccms-test"u8.ToArray();
}
