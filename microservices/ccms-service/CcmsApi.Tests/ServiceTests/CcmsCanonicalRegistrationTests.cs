using System.Net.Sockets;
using System.Security.Cryptography;
using System.Text;
using CcmsApi.Data;
using CcmsApi.Models.Domain;
using CcmsApi.Services;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging.Abstractions;
using Moq;
using Xunit;

namespace CcmsApi.Tests.ServiceTests;

public class CcmsCanonicalRegistrationTests
{
    private static readonly Guid TenantId = Guid.Parse("aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa");
    private static readonly Guid PatientId = Guid.Parse("bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb");
    private static readonly Guid UserId = Guid.Parse("cccccccc-cccc-cccc-cccc-cccccccccccc");

    [Fact]
    public async Task UploadFileAsync_RegistersCanonical_WithSha256OfBytes()
    {
        if (!await IsAzuriteAvailableAsync())
            return;

        await using var db = CreateDb();
        var coverage = SeedCase(db);
        var bytes = Encoding.UTF8.GetBytes("%PDF-1.4 policy-a");
        var expectedHash = Convert.ToHexString(SHA256.HashData(bytes)).ToLowerInvariant();
        Guid? registeredDocId = null;
        string? registeredHash = null;
        var auth = new Mock<AuthServiceClient>(MockBehavior.Loose, new HttpClient(), NullLogger<AuthServiceClient>.Instance);
        auth.Setup(a => a.RegisterCcmsDocumentCanonicalAsync(
                TenantId, PatientId, UserId, It.IsAny<Guid>(), expectedHash, bytes.LongLength,
                It.IsAny<string>(), It.IsAny<string>(), "policy_document",
                "ccms-documents", It.IsAny<string>(), It.IsAny<CancellationToken>()))
            .Callback<Guid, Guid, Guid, Guid, string, long, string, string, string, string, string, CancellationToken>(
                (_, _, _, docId, hash, _, _, _, _, _, _, _) =>
                {
                    registeredDocId = docId;
                    registeredHash = hash;
                })
            .ReturnsAsync(Guid.NewGuid());
        auth.Setup(a => a.RemoveCcmsDocumentAssociationAsync(It.IsAny<Guid>(), It.IsAny<Guid>(), It.IsAny<CancellationToken>()))
            .Returns(Task.CompletedTask);

        var svc = Service(db, auth.Object);
        var doc = await svc.UploadFileAsync(
            coverage.Id, UserId, new MemoryStream(bytes), "policy.pdf", "application/pdf", "policy_document");

        Assert.Equal(doc.Id, registeredDocId);
        Assert.Equal(expectedHash, registeredHash);
    }

    [Fact]
    public async Task UploadFileAsync_Replace_RemovesPriorAssociation_Only()
    {
        if (!await IsAzuriteAvailableAsync())
            return;

        await using var db = CreateDb();
        var coverage = SeedCase(db);
        var priorId = Guid.NewGuid();
        db.Documents.Add(new CcmsDocument
        {
            Id = priorId,
            TenantId = TenantId,
            CoverageCase_Id = coverage.Id,
            DocumentCategory = "preauth",
            DocumentType = "policy_document",
            DocumentName = "old.pdf",
            BlobUrl = $"http://127.0.0.1:10000/devstoreaccount1/ccms-documents/cases/{coverage.Id}/old.pdf",
            FileSizeBytes = 10,
            MimeType = "application/pdf",
            UploadedAt = DateTime.UtcNow.AddDays(-1),
            UploadedByUserId = UserId,
            CreatedAt = DateTime.UtcNow.AddDays(-1),
            UpdatedAt = DateTime.UtcNow.AddDays(-1),
            CreatedByUserId = UserId,
            UpdatedByUserId = UserId,
            Status = "active",
        });
        await db.SaveChangesAsync();

        var removed = new List<Guid>();
        var auth = new Mock<AuthServiceClient>(MockBehavior.Loose, new HttpClient(), NullLogger<AuthServiceClient>.Instance);
        auth.Setup(a => a.RemoveCcmsDocumentAssociationAsync(TenantId, It.IsAny<Guid>(), It.IsAny<CancellationToken>()))
            .Callback<Guid, Guid, CancellationToken>((_, id, _) => removed.Add(id))
            .Returns(Task.CompletedTask);
        auth.Setup(a => a.RegisterCcmsDocumentCanonicalAsync(
                It.IsAny<Guid>(), It.IsAny<Guid>(), It.IsAny<Guid>(), It.IsAny<Guid>(),
                It.IsAny<string>(), It.IsAny<long>(), It.IsAny<string>(), It.IsAny<string>(),
                It.IsAny<string>(), It.IsAny<string>(), It.IsAny<string>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(Guid.NewGuid());

        var svc = Service(db, auth.Object);
        var bytes = Encoding.UTF8.GetBytes("%PDF-1.4 replacement");
        await svc.UploadFileAsync(
            coverage.Id, UserId, new MemoryStream(bytes), "new.pdf", "application/pdf", "policy_document");

        Assert.Contains(priorId, removed);
        Assert.NotNull(await db.Documents.SingleAsync(d => d.Id == priorId && d.DeletedAt != null));
    }

    [Fact]
    public async Task DeleteAsync_RemovesCanonicalAssociation()
    {
        await using var db = CreateDb();
        var coverage = SeedCase(db);
        var doc = Doc(coverage.Id, "policy_document", $"http://127.0.0.1/ccms-documents/cases/{coverage.Id}/a.pdf");
        db.Documents.Add(doc);
        await db.SaveChangesAsync();

        Guid? removed = null;
        var auth = new Mock<AuthServiceClient>(MockBehavior.Loose, new HttpClient(), NullLogger<AuthServiceClient>.Instance);
        auth.Setup(a => a.RemoveCcmsDocumentAssociationAsync(TenantId, doc.Id, It.IsAny<CancellationToken>()))
            .Callback<Guid, Guid, CancellationToken>((_, id, _) => removed = id)
            .Returns(Task.CompletedTask);

        var svc = Service(db, auth.Object);
        await svc.DeleteAsync(doc.Id, UserId);
        Assert.Equal(doc.Id, removed);
        Assert.NotNull((await db.Documents.SingleAsync(d => d.Id == doc.Id)).DeletedAt);
    }

    [Fact]
    public async Task EnsureCanonical_RejectsPointerDocuments()
    {
        await using var db = CreateDb();
        var coverage = SeedCase(db);
        var pointer = Doc(coverage.Id, "dicom_study", "pacs://study/1.2.3");
        pointer.MimeType = "application/dicom";
        pointer.FileSizeBytes = 0;
        db.Documents.Add(pointer);
        await db.SaveChangesAsync();

        var auth = new Mock<AuthServiceClient>(MockBehavior.Strict, new HttpClient(), NullLogger<AuthServiceClient>.Instance);
        var svc = Service(db, auth.Object);
        var result = await svc.EnsureCanonicalRegistrationAsync(pointer.Id, UserId);
        Assert.Null(result);
    }

    [Fact]
    public async Task ListMetadata_InsuranceOnly_ExcludesPointersAndNonInsuranceTypes()
    {
        await using var db = CreateDb();
        var coverage = SeedCase(db);
        db.Documents.AddRange(
            Doc(coverage.Id, "policy_document", $"http://127.0.0.1/ccms-documents/cases/{coverage.Id}/a.pdf"),
            Doc(coverage.Id, "dicom_study", "pacs://study/1.2.3"),
            Doc(coverage.Id, "random_type", $"http://127.0.0.1/ccms-documents/cases/{coverage.Id}/b.pdf"));
        await db.SaveChangesAsync();

        var svc = Service(db, auth: null);
        var page = await svc.ListMetadataByPatientIdAsync(TenantId, PatientId, insuranceOnly: true);
        Assert.Equal(1, page.Total);
        Assert.Equal("policy_document", Assert.Single(page.Items).DocumentType);
        Assert.False(Assert.Single(page.Items).IsPointer);
    }

    [Fact]
    public async Task ListMetadata_EnrichesCanonicalDocumentId_FromAuthLookup()
    {
        await using var db = CreateDb();
        var coverage = SeedCase(db);
        var doc = Doc(coverage.Id, "policy_document", $"http://127.0.0.1/ccms-documents/cases/{coverage.Id}/a.pdf");
        db.Documents.Add(doc);
        await db.SaveChangesAsync();
        var canonicalId = Guid.NewGuid();

        var auth = new Mock<AuthServiceClient>(MockBehavior.Loose, new HttpClient(), NullLogger<AuthServiceClient>.Instance);
        auth.Setup(a => a.LookupCcmsCanonicalIdsAsync(It.IsAny<IEnumerable<Guid>>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(new Dictionary<Guid, Guid> { [doc.Id] = canonicalId });

        var svc = Service(db, auth.Object);
        var page = await svc.ListMetadataByPatientIdAsync(TenantId, PatientId);
        Assert.Equal(canonicalId, Assert.Single(page.Items).CanonicalDocumentId);
    }

    [Fact]
    public void Rules_Sha256Identity_AndInsuranceEligibility()
    {
        var bytes = Encoding.UTF8.GetBytes("same-bytes");
        var hash = CcmsCanonicalDocumentRules.ComputeSha256Hex(bytes);
        Assert.Equal(64, hash.Length);
        Assert.Equal(hash, CcmsCanonicalDocumentRules.ComputeSha256Hex(bytes));
        Assert.False(CcmsCanonicalDocumentRules.IsEligibleFileBackedForCanonical("pacs://study/1", "dicom_study"));
        Assert.True(CcmsCanonicalDocumentRules.IsInsuranceIntakeType("policy_document"));
        Assert.False(CcmsCanonicalDocumentRules.IsInsuranceIntakeType("PolicyDocument"));
        Assert.True(CcmsCanonicalDocumentRules.IsPatient360InsuranceRow(
            "policy_document", "active", "http://x/ccms-documents/a.pdf", null));
    }

    private static async Task<bool> IsAzuriteAvailableAsync()
    {
        try
        {
            using var client = new TcpClient();
            var connect = client.ConnectAsync("127.0.0.1", 10000);
            var completed = await Task.WhenAny(connect, Task.Delay(500));
            return completed == connect && client.Connected;
        }
        catch
        {
            return false;
        }
    }

    private static CcmsDocument Doc(Guid caseId, string type, string url) => new()
    {
        Id = Guid.NewGuid(),
        TenantId = TenantId,
        CoverageCase_Id = caseId,
        DocumentCategory = "preauth",
        DocumentType = type,
        DocumentName = type + ".pdf",
        BlobUrl = url,
        FileSizeBytes = 12,
        MimeType = "application/pdf",
        UploadedAt = DateTime.UtcNow,
        UploadedByUserId = UserId,
        CreatedAt = DateTime.UtcNow,
        UpdatedAt = DateTime.UtcNow,
        CreatedByUserId = UserId,
        UpdatedByUserId = UserId,
        Status = "active",
    };

    private static CcmsCoverageCase SeedCase(CcmsDbContext db)
    {
        var coverage = new CcmsCoverageCase
        {
            Id = Guid.NewGuid(),
            TenantId = TenantId,
            CaseNumber = "CC-3B",
            PatientId = PatientId,
            CurrentState = "DRAFT",
            PayerType = "insurance",
            Status = "active",
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow,
        };
        db.CoverageCases.Add(coverage);
        db.SaveChanges();
        return coverage;
    }

    private static DocumentEngineService Service(CcmsDbContext db, AuthServiceClient? auth)
    {
        var config = new ConfigurationBuilder()
            .AddInMemoryCollection(new Dictionary<string, string?>
            {
                ["AzureWebJobsStorage"] = "UseDevelopmentStorage=true",
            })
            .Build();
        return new DocumentEngineService(db, config, NullLogger<DocumentEngineService>.Instance, auth);
    }

    private static CcmsDbContext CreateDb()
    {
        var options = new DbContextOptionsBuilder<CcmsDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString("N"))
            .Options;
        return new CcmsDbContext(options);
    }
}
