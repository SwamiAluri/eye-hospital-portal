using System.Security.Cryptography;
using System.Text;
using AuthService.Context;
using AuthService.Models.Domain;
using AuthService.Services;
using AuthService.Services.Interfaces;
using Microsoft.AspNetCore.Http;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging.Abstractions;
using Moq;
using Xunit;

namespace AuthService.Tests;

public class CanonicalDocumentIdentityTests
{
    private static readonly Guid UserId = Guid.Parse("11111111-1111-1111-1111-111111111111");
    private static readonly Guid TenantId = Guid.Parse("22222222-2222-2222-2222-222222222222");
    private static readonly Guid OtherTenantId = Guid.Parse("33333333-3333-3333-3333-333333333333");

    [Fact]
    public void ComputeContentHash_IsSha256LowerHex()
    {
        var bytes = Encoding.ASCII.GetBytes("%PDF-1.4 test");
        var expected = Convert.ToHexString(SHA256.HashData(bytes)).ToLowerInvariant();
        Assert.Equal(expected, Identity(CreateDb(), Blob()).ComputeContentHash(bytes));
    }

    [Fact]
    public async Task SamePatientSameHash_ReusesCanonical_NoSecondBlob()
    {
        await using var db = CreateDb();
        var patientId = Guid.NewGuid();
        var stored = new List<(string Container, string Key)>();
        var identity = Identity(db, Blob(stored));
        var bytes = PdfBytes();

        var first = await identity.ResolveOrCreateAsync(
            TenantId, patientId, UserId, bytes, "a.pdf", "application/pdf", "PolicyDocument");
        var second = await identity.ResolveOrCreateAsync(
            TenantId, patientId, UserId, bytes, "renamed.pdf", "application/pdf", "InsuranceCard");

        Assert.True(first.Created);
        Assert.True(first.BlobUploaded);
        Assert.False(second.Created);
        Assert.False(second.BlobUploaded);
        Assert.Equal(first.Document.Id, second.Document.Id);
        Assert.Equal(1, await db.CanonicalDocuments.CountAsync());
        Assert.Single(stored);
        Assert.Equal(first.Document.FileName, second.Document.FileName);
    }

    [Fact]
    public async Task DifferentPatientSameHash_CreatesSeparateIdentity()
    {
        await using var db = CreateDb();
        var identity = Identity(db, Blob());
        var bytes = PdfBytes();

        var a = await identity.ResolveOrCreateAsync(
            TenantId, Guid.NewGuid(), UserId, bytes, "a.pdf", "application/pdf", "general");
        var b = await identity.ResolveOrCreateAsync(
            TenantId, Guid.NewGuid(), UserId, bytes, "a.pdf", "application/pdf", "general");

        Assert.NotEqual(a.Document.Id, b.Document.Id);
        Assert.Equal(2, await db.CanonicalDocuments.CountAsync());
    }

    [Fact]
    public async Task SamePatientDifferentHash_CreatesSeparateIdentity()
    {
        await using var db = CreateDb();
        var patientId = Guid.NewGuid();
        var identity = Identity(db, Blob());

        var a = await identity.ResolveOrCreateAsync(
            TenantId, patientId, UserId, PdfBytes(), "a.pdf", "application/pdf", "PolicyDocument");
        var b = await identity.ResolveOrCreateAsync(
            TenantId, patientId, UserId, Encoding.ASCII.GetBytes("%PDF-1.4 other"), "b.pdf", "application/pdf", "PolicyDocument");

        Assert.NotEqual(a.Document.Id, b.Document.Id);
        Assert.Equal(2, await db.CanonicalDocuments.CountAsync());
    }

    [Fact]
    public async Task DifferentTenantSamePatientHash_CreatesSeparateIdentity()
    {
        await using var db = CreateDb();
        var patientId = Guid.NewGuid();
        var identity = Identity(db, Blob());
        var bytes = PdfBytes();

        var a = await identity.ResolveOrCreateAsync(
            TenantId, patientId, UserId, bytes, "a.pdf", "application/pdf", "general");
        var b = await identity.ResolveOrCreateAsync(
            OtherTenantId, patientId, UserId, bytes, "a.pdf", "application/pdf", "general");

        Assert.NotEqual(a.Document.Id, b.Document.Id);
    }

    [Fact]
    public async Task EnsureAssociation_IsIdempotent_AndSupportsMultipleDomains()
    {
        await using var db = CreateDb();
        var patientId = Guid.NewGuid();
        var identity = Identity(db, Blob());
        var resolved = await identity.ResolveOrCreateAsync(
            TenantId, patientId, UserId, PdfBytes(), "a.pdf", "application/pdf", "PolicyDocument");

        var mpi = await identity.EnsureAssociationAsync(
            resolved.Document.Id,
            CanonicalDocumentAssociations.MpiDomain,
            CanonicalDocumentAssociations.PatientEntityType,
            patientId,
            "general",
            UserId);
        var mpiAgain = await identity.EnsureAssociationAsync(
            resolved.Document.Id,
            CanonicalDocumentAssociations.MpiDomain,
            CanonicalDocumentAssociations.PatientEntityType,
            patientId,
            "general",
            UserId);
        var counselling = await identity.EnsureAssociationAsync(
            resolved.Document.Id,
            CanonicalDocumentAssociations.CounsellingDomain,
            CanonicalDocumentAssociations.CounsellingPatientEntityType,
            patientId,
            "PolicyDocument",
            UserId);
        var ccms = await identity.EnsureAssociationAsync(
            resolved.Document.Id,
            CanonicalDocumentAssociations.CcmsDomain,
            CanonicalDocumentAssociations.CcmsDocumentEntityType,
            Guid.NewGuid(),
            "policy_document",
            UserId);

        Assert.Equal(mpi.Id, mpiAgain.Id);
        Assert.Equal(3, await db.CanonicalDocumentAssociations.CountAsync());
        Assert.Equal(CanonicalDocumentAssociations.CcmsDomain, ccms.Domain);
        Assert.NotEqual(mpi.Id, counselling.Id);
    }

    [Fact]
    public async Task RemoveAssociation_KeepsCanonicalWhenOtherAssociationsRemain()
    {
        await using var db = CreateDb();
        var patientId = Guid.NewGuid();
        var identity = Identity(db, Blob());
        var resolved = await identity.ResolveOrCreateAsync(
            TenantId, patientId, UserId, PdfBytes(), "a.pdf", "application/pdf", "PolicyDocument");
        await identity.EnsureAssociationAsync(
            resolved.Document.Id,
            CanonicalDocumentAssociations.MpiDomain,
            CanonicalDocumentAssociations.PatientEntityType,
            patientId,
            "general",
            UserId);
        await identity.EnsureAssociationAsync(
            resolved.Document.Id,
            CanonicalDocumentAssociations.CounsellingDomain,
            CanonicalDocumentAssociations.CounsellingPatientEntityType,
            patientId,
            "PolicyDocument",
            UserId);

        Assert.True(await identity.RemoveAssociationAsync(
            TenantId,
            resolved.Document.Id,
            CanonicalDocumentAssociations.CounsellingDomain,
            CanonicalDocumentAssociations.CounsellingPatientEntityType,
            patientId));

        Assert.Equal(1, await db.CanonicalDocumentAssociations.CountAsync());
        var doc = await db.CanonicalDocuments.SingleAsync();
        Assert.Null(doc.DeletedAt);
    }

    [Fact]
    public async Task RemoveLastAssociation_SoftDeletesCanonical_RetainsRow()
    {
        await using var db = CreateDb();
        var patientId = Guid.NewGuid();
        var identity = Identity(db, Blob());
        var resolved = await identity.ResolveOrCreateAsync(
            TenantId, patientId, UserId, PdfBytes(), "a.pdf", "application/pdf", "general");
        await identity.EnsureAssociationAsync(
            resolved.Document.Id,
            CanonicalDocumentAssociations.MpiDomain,
            CanonicalDocumentAssociations.PatientEntityType,
            patientId,
            "general",
            UserId);

        Assert.True(await identity.RemoveAssociationAsync(
            TenantId,
            resolved.Document.Id,
            CanonicalDocumentAssociations.MpiDomain,
            CanonicalDocumentAssociations.PatientEntityType,
            patientId));

        var doc = await db.CanonicalDocuments.SingleAsync();
        Assert.NotNull(doc.DeletedAt);
        Assert.Equal(0, await db.CanonicalDocumentAssociations.CountAsync());
    }

    [Fact]
    public async Task ExternalResolve_DoesNotUploadPatientDocumentsBlob()
    {
        await using var db = CreateDb();
        var patientId = Guid.NewGuid();
        var stored = new List<(string Container, string Key)>();
        var identity = Identity(db, Blob(stored));
        var hash = identity.ComputeContentHash(PdfBytes());

        var result = await identity.ResolveOrCreateExternalAsync(
            TenantId,
            patientId,
            UserId,
            hash,
            PdfBytes().Length,
            "policy.pdf",
            "application/pdf",
            "policy_document",
            CanonicalDocumentStorage.BackendAzureBlob,
            "ccms-documents",
            "cases/abc/policy.pdf");

        Assert.True(result.Created);
        Assert.False(result.BlobUploaded);
        Assert.Empty(stored);
        Assert.Equal("ccms-documents", result.Document.StorageContainer);

        var again = await identity.ResolveOrCreateExternalAsync(
            TenantId,
            patientId,
            UserId,
            hash,
            PdfBytes().Length,
            "other-name.pdf",
            "application/pdf",
            "policy_document",
            CanonicalDocumentStorage.BackendAzureBlob,
            "ccms-documents",
            "cases/abc/other.pdf");
        Assert.False(again.Created);
        Assert.Equal(result.Document.Id, again.Document.Id);
        Assert.Equal(1, await db.CanonicalDocuments.CountAsync());
    }

    [Fact]
    public async Task CrossDomainUpload_SameBytes_ShareOneCanonical()
    {
        await using var db = CreateDb();
        var patientId = Guid.NewGuid();
        db.Patients.Add(Patient(TenantId, patientId));
        await db.SaveChangesAsync();

        var stored = new List<(string Container, string Key)>();
        var blob = Blob(stored);
        var identity = Identity(db, blob);
        var general = new CanonicalDocumentService(db, blob, NullLogger<CanonicalDocumentService>.Instance, identity);

        await general.UploadGeneralAsync(TenantId, patientId, UserId, PdfFile("policy.pdf"), null);
        var counselling = new CounselingSessionDocumentCanonicalService(
            db, blob, NullLogger<CounselingSessionDocumentCanonicalService>.Instance, identity);
        await counselling.UploadPatientLevelAsync(
            TenantId, patientId, PdfFile("policy-copy.pdf"), "PolicyDocument", UserId);

        Assert.Equal(1, await db.CanonicalDocuments.CountAsync(d => d.DeletedAt == null));
        Assert.Equal(2, await db.CanonicalDocumentAssociations.CountAsync());
        Assert.Single(stored);
    }

    [Fact]
    public void Migration_DefinesTenantPatientHashUniqueness()
    {
        var path = Path.Combine(
            Repo("AuthService"),
            "Data",
            "Migrations",
            "20261006183000_CanonicalDocumentContentHashUniqueness.cs");
        var source = File.ReadAllText(path);
        Assert.Contains("ux_canonical_documents_tenant_patient_hash", source, StringComparison.Ordinal);
        Assert.Contains("content_hash", source, StringComparison.Ordinal);
        Assert.Contains("status = 'active'", source, StringComparison.Ordinal);
    }

    [Fact]
    public void AssociationConstants_IncludeCcmsPrep()
    {
        Assert.Equal("ccms", CanonicalDocumentAssociations.CcmsDomain);
        Assert.Equal("CcmsDocument", CanonicalDocumentAssociations.CcmsDocumentEntityType);
    }

    private static CanonicalDocumentIdentityService Identity(AppDbContext db, IBlobStorageService blob) =>
        new(db, blob, NullLogger<CanonicalDocumentIdentityService>.Instance);

    private static IBlobStorageService Blob(List<(string Container, string Key)>? stored = null)
    {
        var blob = new Mock<IBlobStorageService>();
        blob.Setup(b => b.UploadExactKeyAsync(It.IsAny<string>(), It.IsAny<string>(), It.IsAny<Stream>(), It.IsAny<string>(), It.IsAny<CancellationToken>()))
            .Callback<string, string, Stream, string, CancellationToken>((container, key, _, _, _) => stored?.Add((container, key)))
            .Returns(Task.CompletedTask);
        blob.Setup(b => b.DeleteExactKeyAsync(It.IsAny<string>(), It.IsAny<string>(), It.IsAny<CancellationToken>()))
            .Callback<string, string, CancellationToken>((container, key, _) => stored?.RemoveAll(x => x.Container == container && x.Key == key))
            .Returns(Task.CompletedTask);
        return blob.Object;
    }

    private static AppDbContext CreateDb()
    {
        var options = new DbContextOptionsBuilder<AppDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString("N"))
            .Options;
        return new AppDbContext(options, new HttpContextAccessor());
    }

    private static Patient Patient(Guid tenantId, Guid id) => new()
    {
        Id = id,
        TenantId = tenantId,
        MedicalRecordNumber = "MRN-" + id.ToString("N")[..8],
        FirstName = "Test",
        LastName = "Patient",
        DateOfBirth = new DateTime(1990, 1, 1, 0, 0, 0, DateTimeKind.Utc),
        Gender = "Unknown",
        CreatedAt = DateTime.UtcNow,
    };

    private static IFormFile PdfFile(string name)
    {
        var bytes = PdfBytes();
        var stream = new MemoryStream(bytes);
        return new FormFile(stream, 0, bytes.Length, "file", name)
        {
            Headers = new HeaderDictionary(),
            ContentType = "application/pdf",
        };
    }

    private static byte[] PdfBytes() => Encoding.ASCII.GetBytes("%PDF-1.4 test");

    private static string Repo(string project, [System.Runtime.CompilerServices.CallerFilePath] string thisFile = "")
    {
        var testsDir = Path.GetDirectoryName(thisFile)
            ?? throw new DirectoryNotFoundException();
        var candidate = Path.GetFullPath(Path.Combine(testsDir, "..", project));
        if (!Directory.Exists(candidate))
            throw new DirectoryNotFoundException(candidate);
        return candidate;
    }
}
