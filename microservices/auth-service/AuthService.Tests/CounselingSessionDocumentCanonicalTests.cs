using System.Security.Claims;
using System.Text;
using AuthService.Authorization;
using AuthService.Context;
using AuthService.Controllers;
using AuthService.Models.Counselor;
using AuthService.Models.Domain;
using AuthService.Services;
using AuthService.Services.Interfaces;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Http;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging.Abstractions;
using Moq;
using Xunit;

namespace AuthService.Tests;

public class CounselingSessionDocumentCanonicalTests
{
    private static readonly Guid UserId = Guid.Parse("11111111-1111-1111-1111-111111111111");
    private static readonly Guid OtherUserId = Guid.Parse("44444444-4444-4444-4444-444444444444");
    private static readonly Guid TenantId = Guid.Parse("22222222-2222-2222-2222-222222222222");
    private static readonly Guid OtherTenantId = Guid.Parse("33333333-3333-3333-3333-333333333333");

    [Theory]
    [InlineData("ReferralLetter")]
    [InlineData("InsuranceCard")]
    [InlineData("Other")]
    public void CertifiedTypes_Normalize(string type)
    {
        Assert.True(CounselingSessionDocumentTypes.TryNormalizeGenericUploadType(type, out var normalized, out _));
        Assert.Equal(type, normalized);
    }

    [Theory]
    [InlineData("referral.pdf")]
    [InlineData("General Document")]
    [InlineData("general")]
    [InlineData("AudioRecording")]
    [InlineData("")]
    [InlineData(null)]
    public void InvalidOrExcludedTypes_Rejected(string? type)
    {
        Assert.False(CounselingSessionDocumentTypes.TryNormalizeGenericUploadType(type, out _, out var error));
        Assert.False(string.IsNullOrWhiteSpace(error));
    }

    [Fact]
    public void UploadEndpoint_RequiresSessionDocumentsCreate()
    {
        Assert.Equal(
            "session_documents.create",
            AttributeOf(typeof(CounselingController), nameof(CounselingController.UploadSessionDocument)));
    }

    [Fact]
    public void ContentEndpoint_RequiresSessionDocumentsRead_NotPatientDocumentDownload()
    {
        Assert.Equal(
            "session_documents.read",
            AttributeOf(
                typeof(CounselingSessionDocumentPatientReadController),
                nameof(CounselingSessionDocumentPatientReadController.CanonicalContent)));
        var source = File.ReadAllText(Path.Combine(Repo("AuthService"), "Controllers", "CounselingSessionDocumentPatientReadController.cs"));
        Assert.DoesNotContain("patient.patient_document.download", source, StringComparison.Ordinal);
        Assert.DoesNotContain("patient.patient_document.read", source, StringComparison.Ordinal);
    }

    [Fact]
    public async Task PatientDocumentDownload_DoesNotAuthorizeCounsellingContent()
    {
        Assert.False(await Authorize("patient.patient_document.download", "session_documents.read"));
        Assert.True(await Authorize("session_documents.read", "session_documents.read"));
    }

    [Fact]
    public async Task Upload_PersistsBytes_CreatesCanonicalAndAssociation()
    {
        await using var db = CreateDb();
        var patientId = Guid.NewGuid();
        var session = Session(TenantId, patientId);
        db.CounselingSession.Add(session);
        await db.SaveChangesAsync();

        var stored = new List<(string Container, string Key, byte[] Bytes)>();
        var blob = Blob(stored);

        var dto = await Service(db, blob).UploadAsync(
            TenantId, session.Id, PdfFile("referral.pdf"), "ReferralLetter", "referral.pdf", UserId);

        Assert.Equal("ReferralLetter", dto.DocumentType);
        Assert.StartsWith("canonical:", dto.FilePath, StringComparison.Ordinal);
        Assert.Equal(1, await db.CounselingSessionDocuments.CountAsync());
        Assert.Equal(1, await db.CanonicalDocuments.CountAsync());
        Assert.Equal(1, await db.CanonicalDocumentAssociations.CountAsync());

        var canonical = await db.CanonicalDocuments.SingleAsync();
        Assert.Equal(patientId, canonical.PatientId);
        Assert.Equal(TenantId, canonical.TenantId);
        Assert.Equal("ReferralLetter", canonical.Classification);
        Assert.Equal("patient-documents", canonical.StorageContainer);
        Assert.Equal($"{TenantId:N}/{canonical.Id:N}", canonical.StorageObjectKey);
        Assert.Single(stored);
        Assert.Equal("patient-documents", stored[0].Container);
        Assert.Equal(canonical.StorageObjectKey, stored[0].Key);
        Assert.True(stored[0].Bytes.Length > 0);

        var association = await db.CanonicalDocumentAssociations.SingleAsync();
        Assert.Equal(CanonicalDocumentAssociations.CounsellingDomain, association.Domain);
        Assert.Equal(CanonicalDocumentAssociations.CounselingSessionDocumentEntityType, association.EntityType);
        Assert.Equal(dto.Id, association.EntityId);
        Assert.Equal(canonical.Id, association.DocumentId);
        Assert.DoesNotContain("mpi", association.Domain, StringComparison.Ordinal);
    }

    [Fact]
    public async Task Upload_WrongTenantSession_Rejected()
    {
        await using var db = CreateDb();
        var session = Session(OtherTenantId, Guid.NewGuid());
        db.CounselingSession.Add(session);
        await db.SaveChangesAsync();
        var stored = new List<(string Container, string Key, byte[] Bytes)>();

        await Assert.ThrowsAsync<KeyNotFoundException>(() =>
            Service(db, Blob(stored)).UploadAsync(
                TenantId, session.Id, PdfFile("a.pdf"), "ReferralLetter", null, UserId));
        Assert.Empty(stored);
        Assert.Equal(0, await db.CanonicalDocuments.CountAsync());
    }

    [Fact]
    public async Task Upload_MissingSession_Rejected()
    {
        await using var db = CreateDb();
        var stored = new List<(string Container, string Key, byte[] Bytes)>();
        await Assert.ThrowsAsync<KeyNotFoundException>(() =>
            Service(db, Blob(stored)).UploadAsync(
                TenantId, Guid.NewGuid(), PdfFile("a.pdf"), "IDProof", null, UserId));
        Assert.Empty(stored);
    }

    [Fact]
    public async Task Upload_FilenameAsType_Rejected()
    {
        await using var db = CreateDb();
        var session = Session(TenantId, Guid.NewGuid());
        db.CounselingSession.Add(session);
        await db.SaveChangesAsync();
        var stored = new List<(string Container, string Key, byte[] Bytes)>();

        var ex = await Assert.ThrowsAsync<ArgumentException>(() =>
            Service(db, Blob(stored)).UploadAsync(
                TenantId, session.Id, PdfFile("card.pdf"), "card.pdf", null, UserId));
        Assert.Contains("certified", ex.Message, StringComparison.OrdinalIgnoreCase);
        Assert.Empty(stored);
    }

    [Fact]
    public async Task Upload_AudioRecording_Rejected()
    {
        await using var db = CreateDb();
        var session = Session(TenantId, Guid.NewGuid());
        db.CounselingSession.Add(session);
        await db.SaveChangesAsync();
        var stored = new List<(string Container, string Key, byte[] Bytes)>();

        await Assert.ThrowsAsync<ArgumentException>(() =>
            Service(db, Blob(stored)).UploadAsync(
                TenantId, session.Id, PdfFile("a.pdf"), "AudioRecording", null, UserId));
        Assert.Empty(stored);
    }

    [Fact]
    public async Task Upload_DbFailure_CompensatesBlob()
    {
        var deleted = new List<string>();
        var uploadedKeys = new List<string>();
        var failingBlob = new Mock<IBlobStorageService>();
        failingBlob.Setup(b => b.UploadExactKeyAsync(It.IsAny<string>(), It.IsAny<string>(), It.IsAny<Stream>(), It.IsAny<string>(), It.IsAny<CancellationToken>()))
            .Callback<string, string, Stream, string, CancellationToken>((_, key, _, _, _) => uploadedKeys.Add(key))
            .Returns(Task.CompletedTask);
        failingBlob.Setup(b => b.DeleteExactKeyAsync(It.IsAny<string>(), It.IsAny<string>(), It.IsAny<CancellationToken>()))
            .Callback<string, string, CancellationToken>((_, key, _) => deleted.Add(key))
            .Returns(Task.CompletedTask);

        await using var bombDb = new SaveFailingDb(CreateOptions());
        bombDb.CounselingSession.Add(Session(TenantId, Guid.NewGuid()));
        await bombDb.SaveChangesAsync();
        bombDb.FailNextSave = true;
        var sessionId = await bombDb.CounselingSession.Select(s => s.Id).SingleAsync();

        await Assert.ThrowsAsync<InvalidOperationException>(() =>
            Service(bombDb, failingBlob.Object).UploadAsync(
                TenantId, sessionId, PdfFile("a.pdf"), "PolicyDocument", null, UserId));

        Assert.Single(uploadedKeys);
        Assert.Contains(uploadedKeys[0], deleted);
    }

    [Fact]
    public async Task ListMetadata_IncludesCanonicalDocumentId()
    {
        await using var db = CreateDb();
        var patientId = Guid.NewGuid();
        var session = Session(TenantId, patientId);
        db.CounselingSession.Add(session);
        var sourceId = Guid.NewGuid();
        var canonicalId = Guid.NewGuid();
        db.CounselingSessionDocuments.Add(Doc(TenantId, session.Id, sourceId, "a.pdf"));
        db.CanonicalDocuments.Add(new CanonicalDocument
        {
            Id = canonicalId,
            TenantId = TenantId,
            PatientId = patientId,
            StorageBackend = "azure-blob",
            StorageContainer = "patient-documents",
            StorageObjectKey = $"{TenantId:N}/{canonicalId:N}",
            FileName = "a.pdf",
            MimeType = "application/pdf",
            SizeBytes = 10,
            Classification = "ReferralLetter",
            Status = "active",
            CreatedByUserId = UserId,
            CreatedAt = DateTime.UtcNow,
        });
        db.CanonicalDocumentAssociations.Add(new CanonicalDocumentAssociation
        {
            Id = Guid.NewGuid(),
            DocumentId = canonicalId,
            Domain = CanonicalDocumentAssociations.CounsellingDomain,
            EntityType = CanonicalDocumentAssociations.CounselingSessionDocumentEntityType,
            EntityId = sourceId,
            Category = "ReferralLetter",
            Role = "primary",
            CreatedByUserId = UserId,
            CreatedAt = DateTime.UtcNow,
        });
        await db.SaveChangesAsync();

        var page = await Workflow(db).ListMetadataByPatientIdAsync(TenantId, patientId);
        Assert.Single(page.Documents);
        Assert.Equal(canonicalId, page.Documents[0].CanonicalDocumentId);
    }

    [Fact]
    public async Task OpenContent_AuthorizedCounsellingAssociation_ReturnsBytes()
    {
        await using var db = CreateDb();
        var patientId = Guid.NewGuid();
        var session = Session(TenantId, patientId);
        db.CounselingSession.Add(session);
        var sourceId = Guid.NewGuid();
        var canonicalId = Guid.NewGuid();
        var key = $"{TenantId:N}/{canonicalId:N}";
        db.CounselingSessionDocuments.Add(Doc(TenantId, session.Id, sourceId, "a.pdf"));
        db.CanonicalDocuments.Add(new CanonicalDocument
        {
            Id = canonicalId,
            TenantId = TenantId,
            PatientId = patientId,
            StorageBackend = "azure-blob",
            StorageContainer = "patient-documents",
            StorageObjectKey = key,
            FileName = "a.pdf",
            MimeType = "application/pdf",
            SizeBytes = 12,
            Classification = "ReferralLetter",
            Status = "active",
            CreatedByUserId = UserId,
            CreatedAt = DateTime.UtcNow,
        });
        db.CanonicalDocumentAssociations.Add(new CanonicalDocumentAssociation
        {
            Id = Guid.NewGuid(),
            DocumentId = canonicalId,
            Domain = CanonicalDocumentAssociations.CounsellingDomain,
            EntityType = CanonicalDocumentAssociations.CounselingSessionDocumentEntityType,
            EntityId = sourceId,
            Category = "ReferralLetter",
            Role = "primary",
            CreatedByUserId = UserId,
            CreatedAt = DateTime.UtcNow,
        });
        await db.SaveChangesAsync();

        var pdf = PdfBytes();
        var blob = new Mock<IBlobStorageService>();
        blob.Setup(b => b.OpenReadExactAsync("patient-documents", key, It.IsAny<CancellationToken>()))
            .ReturnsAsync(new ExactBlobRead
            {
                Content = new MemoryStream(pdf),
                ContentType = "application/pdf",
                ContentLength = pdf.Length,
            });

        var content = await Service(db, blob.Object).OpenContentForPatientAsync(TenantId, patientId, canonicalId);
        Assert.NotNull(content);
        Assert.Equal("application/pdf", content!.ContentType);
        Assert.Equal("a.pdf", content.FileName);
    }

    [Fact]
    public async Task OpenContent_MpiAssociationOnly_Rejected()
    {
        await using var db = CreateDb();
        var patientId = Guid.NewGuid();
        var canonicalId = Guid.NewGuid();
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
            SizeBytes = 1,
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

        var blob = new Mock<IBlobStorageService>();
        var content = await Service(db, blob.Object).OpenContentForPatientAsync(TenantId, patientId, canonicalId);
        Assert.Null(content);
        blob.Verify(b => b.OpenReadExactAsync(It.IsAny<string>(), It.IsAny<string>(), It.IsAny<CancellationToken>()), Times.Never);
    }

    [Fact]
    public async Task OpenContent_WrongTenant_Rejected()
    {
        await using var db = CreateDb();
        var patientId = Guid.NewGuid();
        var session = Session(TenantId, patientId);
        db.CounselingSession.Add(session);
        var sourceId = Guid.NewGuid();
        var canonicalId = Guid.NewGuid();
        db.CounselingSessionDocuments.Add(Doc(TenantId, session.Id, sourceId, "a.pdf"));
        db.CanonicalDocuments.Add(new CanonicalDocument
        {
            Id = canonicalId,
            TenantId = TenantId,
            PatientId = patientId,
            StorageBackend = "azure-blob",
            StorageContainer = "patient-documents",
            StorageObjectKey = "k",
            FileName = "a.pdf",
            MimeType = "application/pdf",
            SizeBytes = 1,
            Classification = "ReferralLetter",
            Status = "active",
            CreatedByUserId = UserId,
            CreatedAt = DateTime.UtcNow,
        });
        db.CanonicalDocumentAssociations.Add(new CanonicalDocumentAssociation
        {
            Id = Guid.NewGuid(),
            DocumentId = canonicalId,
            Domain = CanonicalDocumentAssociations.CounsellingDomain,
            EntityType = CanonicalDocumentAssociations.CounselingSessionDocumentEntityType,
            EntityId = sourceId,
            Category = "ReferralLetter",
            Role = "primary",
            CreatedByUserId = UserId,
            CreatedAt = DateTime.UtcNow,
        });
        await db.SaveChangesAsync();

        var content = await Service(db, Blob()).OpenContentForPatientAsync(OtherTenantId, patientId, canonicalId);
        Assert.Null(content);
    }

    [Fact]
    public async Task Upload_Appends_DoesNotSupersedePrior()
    {
        await using var db = CreateDb();
        var patientId = Guid.NewGuid();
        var session = Session(TenantId, patientId);
        db.CounselingSession.Add(session);
        await db.SaveChangesAsync();
        var blob = Blob();

        var first = await Service(db, blob).UploadAsync(
            TenantId, session.Id, PdfFile("a.pdf"), "InsuranceCard", null, UserId);
        var second = await Service(db, blob).UploadAsync(
            TenantId,
            session.Id,
            FileOf("b.pdf", "application/pdf", Encoding.ASCII.GetBytes("%PDF-1.4 other-card")),
            "InsuranceCard",
            null,
            UserId);

        Assert.NotEqual(first.Id, second.Id);
        Assert.Equal(2, await db.CounselingSessionDocuments.CountAsync(d => d.DeletedAt == null));
        Assert.Equal(2, await db.CanonicalDocuments.CountAsync(d => d.Status == "active"));
        Assert.Equal(0, await db.CanonicalDocuments.CountAsync(d => d.Status == "superseded"));
    }

    [Fact]
    public async Task Upload_ExpectedPatientMismatch_Rejected()
    {
        await using var db = CreateDb();
        var session = Session(TenantId, Guid.NewGuid());
        db.CounselingSession.Add(session);
        await db.SaveChangesAsync();
        var stored = new List<(string Container, string Key, byte[] Bytes)>();

        await Assert.ThrowsAsync<UnauthorizedAccessException>(() =>
            Service(db, Blob(stored)).UploadAsync(
                TenantId,
                session.Id,
                PdfFile("a.pdf"),
                "ReferralLetter",
                null,
                UserId,
                expectedPatientId: Guid.NewGuid()));
        Assert.Empty(stored);
        Assert.Equal(0, await db.CanonicalDocuments.CountAsync());
    }

    [Fact]
    public async Task Upload_ExpectedPatientMatch_CreatesOnSelectedSessionOnly()
    {
        await using var db = CreateDb();
        var patientId = Guid.NewGuid();
        var sessionA = Session(TenantId, patientId);
        var sessionB = Session(TenantId, patientId);
        db.CounselingSession.AddRange(sessionA, sessionB);
        await db.SaveChangesAsync();
        var stored = new List<(string Container, string Key, byte[] Bytes)>();

        var dto = await Service(db, Blob(stored)).UploadAsync(
            TenantId,
            sessionA.Id,
            PdfFile("referral.pdf"),
            "ReferralLetter",
            null,
            UserId,
            expectedPatientId: patientId);

        Assert.Equal(sessionA.Id, dto.SessionId);
        Assert.Equal(1, await db.CounselingSessionDocuments.CountAsync(d => d.SessionId == sessionA.Id && d.DeletedAt == null));
        Assert.Equal(0, await db.CounselingSessionDocuments.CountAsync(d => d.SessionId == sessionB.Id));
        Assert.Single(stored);

        var page = await Workflow(db).ListMetadataByPatientIdAsync(TenantId, patientId);
        Assert.Single(page.Documents);
        Assert.Equal(sessionA.Id, page.Documents[0].SessionId);
        Assert.Equal(dto.Id, page.Documents[0].Id);
        Assert.NotNull(page.Documents[0].CanonicalDocumentId);
        Assert.Equal(UserId, page.Documents[0].CreatedByUserId);
    }

    [Fact]
    public async Task Delete_Uploader_SoftDeletes_SourceAndCanonical_RetainsBlob()
    {
        await using var db = CreateDb();
        var patientId = Guid.NewGuid();
        var session = Session(TenantId, patientId);
        db.CounselingSession.Add(session);
        await db.SaveChangesAsync();
        var stored = new List<(string Container, string Key, byte[] Bytes)>();
        var blob = Blob(stored);

        var dto = await Service(db, blob).UploadAsync(
            TenantId, session.Id, PdfFile("a.pdf"), "PreviousReport", null, UserId, patientId);
        Assert.Single(stored);

        var ok = await Workflow(db).DeleteSessionDocumentAsync(TenantId, dto.Id, UserId);
        Assert.True(ok);

        var source = await db.CounselingSessionDocuments.SingleAsync(d => d.Id == dto.Id);
        Assert.NotNull(source.DeletedAt);
        var canonical = await db.CanonicalDocuments.SingleAsync();
        Assert.NotNull(canonical.DeletedAt);
        Assert.Single(stored);
        Assert.Equal(canonical.StorageObjectKey, stored[0].Key);

        var page = await Workflow(db).ListMetadataByPatientIdAsync(TenantId, patientId);
        Assert.Empty(page.Documents);

        var content = await Service(db, blob).OpenContentForPatientAsync(TenantId, patientId, canonical.Id);
        Assert.Null(content);
    }

    [Fact]
    public async Task Delete_NonUploader_Forbidden()
    {
        await using var db = CreateDb();
        var patientId = Guid.NewGuid();
        var session = Session(TenantId, patientId);
        db.CounselingSession.Add(session);
        await db.SaveChangesAsync();

        var dto = await Service(db, Blob()).UploadAsync(
            TenantId, session.Id, PdfFile("a.pdf"), "IDProof", null, UserId, patientId);

        await Assert.ThrowsAsync<UnauthorizedAccessException>(() =>
            Workflow(db).DeleteSessionDocumentAsync(TenantId, dto.Id, OtherUserId));

        Assert.Null((await db.CounselingSessionDocuments.SingleAsync()).DeletedAt);
        Assert.Null((await db.CanonicalDocuments.SingleAsync()).DeletedAt);
    }

    [Fact]
    public async Task Delete_WrongTenant_ReturnsFalse()
    {
        await using var db = CreateDb();
        var patientId = Guid.NewGuid();
        var session = Session(TenantId, patientId);
        db.CounselingSession.Add(session);
        await db.SaveChangesAsync();

        var dto = await Service(db, Blob()).UploadAsync(
            TenantId, session.Id, PdfFile("a.pdf"), "LabReport", null, UserId, patientId);

        var ok = await Workflow(db).DeleteSessionDocumentAsync(OtherTenantId, dto.Id, UserId);
        Assert.False(ok);
        Assert.Null((await db.CounselingSessionDocuments.SingleAsync()).DeletedAt);
    }

    [Fact]
    public void PatientLevelUploadEndpoint_RequiresSessionDocumentsCreate()
    {
        Assert.Equal(
            "session_documents.create",
            AttributeOf(
                typeof(CounselingSessionDocumentPatientReadController),
                nameof(CounselingSessionDocumentPatientReadController.UploadPatientLevel)));
    }

    [Fact]
    public async Task PatientLevelUpload_DoesNotRequireOrCreateSession()
    {
        await using var db = CreateDb();
        var patientId = Guid.NewGuid();
        db.Patients.Add(Patient(TenantId, patientId));
        await db.SaveChangesAsync();
        var stored = new List<(string Container, string Key, byte[] Bytes)>();

        var meta = await Service(db, Blob(stored)).UploadPatientLevelAsync(
            TenantId, patientId, PdfFile("referral.pdf"), "ReferralLetter", UserId);

        Assert.Equal("ReferralLetter", meta.Classification);
        Assert.Equal(patientId, meta.PatientId);
        Assert.Equal(0, await db.CounselingSession.CountAsync());
        Assert.Equal(0, await db.CounselingSessionDocuments.CountAsync());
        Assert.Equal(1, await db.CanonicalDocuments.CountAsync());
        Assert.Equal(1, await db.CanonicalDocumentAssociations.CountAsync());
        Assert.Single(stored);

        var association = await db.CanonicalDocumentAssociations.SingleAsync();
        Assert.Equal(CanonicalDocumentAssociations.CounsellingDomain, association.Domain);
        Assert.Equal(CanonicalDocumentAssociations.CounsellingPatientEntityType, association.EntityType);
        Assert.Equal(patientId, association.EntityId);
        Assert.Equal(meta.Id, association.DocumentId);

        var page = await Workflow(db).ListMetadataByPatientIdAsync(TenantId, patientId);
        Assert.Single(page.Documents);
        Assert.Null(page.Documents[0].SessionId);
        Assert.Equal(meta.Id, page.Documents[0].Id);
        Assert.Equal(meta.Id, page.Documents[0].CanonicalDocumentId);
        Assert.Equal("ReferralLetter", page.Documents[0].DocumentType);
    }

    [Theory]
    [InlineData("ReferralLetter")]
    [InlineData("PreviousReport")]
    [InlineData("InsuranceCard")]
    [InlineData("PolicyDocument")]
    [InlineData("IDProof")]
    [InlineData("AddressProof")]
    [InlineData("LabReport")]
    [InlineData("Imaging")]
    [InlineData("Other")]
    public async Task PatientLevelUpload_AcceptsCertifiedTypes(string type)
    {
        await using var db = CreateDb();
        var patientId = Guid.NewGuid();
        db.Patients.Add(Patient(TenantId, patientId));
        await db.SaveChangesAsync();

        var meta = await Service(db, Blob()).UploadPatientLevelAsync(
            TenantId, patientId, PdfFile($"{type}.pdf"), type, UserId);

        Assert.Equal(type, meta.Classification);
    }

    [Theory]
    [InlineData("AudioRecording")]
    [InlineData("insurance_card_front")]
    [InlineData("general")]
    [InlineData("")]
    public async Task PatientLevelUpload_RejectsInvalidTypes(string? type)
    {
        await using var db = CreateDb();
        var patientId = Guid.NewGuid();
        db.Patients.Add(Patient(TenantId, patientId));
        await db.SaveChangesAsync();

        await Assert.ThrowsAsync<ArgumentException>(() =>
            Service(db, Blob()).UploadPatientLevelAsync(
                TenantId, patientId, PdfFile("a.pdf"), type, UserId));
        Assert.Equal(0, await db.CanonicalDocuments.CountAsync());
        Assert.Equal(0, await db.CounselingSession.CountAsync());
    }

    [Fact]
    public async Task PatientLevelUpload_LabReportJpeg_WithOctetStream_UsesIdentityResolver()
    {
        await using var db = CreateDb();
        var patientId = Guid.NewGuid();
        db.Patients.Add(Patient(TenantId, patientId));
        await db.SaveChangesAsync();
        var stored = new List<(string Container, string Key, byte[] Bytes)>();
        var blob = Blob(stored);

        var jpeg = FileOf(
            "lab-scan.jpg",
            "application/octet-stream",
            [0xFF, 0xD8, 0xFF, 0xE0, 0x00, 0x10, 0x4A, 0x46, 0x49, 0x46]);

        var meta = await Service(db, blob).UploadPatientLevelAsync(
            TenantId, patientId, jpeg, "LabReport", UserId);

        Assert.Equal("LabReport", meta.Classification);
        Assert.Equal("image/jpeg", meta.MimeType);
        Assert.Equal(1, await db.CanonicalDocuments.CountAsync());
        Assert.Equal(1, await db.CanonicalDocumentAssociations.CountAsync());
        Assert.Single(stored);
        Assert.Equal(CanonicalDocumentStorage.ContainerName, stored[0].Container);

        var association = await db.CanonicalDocumentAssociations.SingleAsync();
        Assert.Equal(CanonicalDocumentAssociations.CounsellingDomain, association.Domain);
        Assert.Equal(CanonicalDocumentAssociations.CounsellingPatientEntityType, association.EntityType);
        Assert.Equal(meta.Id, association.DocumentId);
    }

    [Fact]
    public async Task PatientLevelUpload_DoesNotInferLatestSession()
    {
        await using var db = CreateDb();
        var patientId = Guid.NewGuid();
        db.Patients.Add(Patient(TenantId, patientId));
        var session = Session(TenantId, patientId);
        db.CounselingSession.Add(session);
        await db.SaveChangesAsync();

        var meta = await Service(db, Blob()).UploadPatientLevelAsync(
            TenantId, patientId, PdfFile("id.pdf"), "IDProof", UserId);

        Assert.Equal(0, await db.CounselingSessionDocuments.CountAsync());
        var association = await db.CanonicalDocumentAssociations.SingleAsync();
        Assert.Equal(CanonicalDocumentAssociations.CounsellingPatientEntityType, association.EntityType);
        Assert.Equal(patientId, association.EntityId);
        Assert.NotEqual(session.Id, association.EntityId);

        var page = await Workflow(db).ListMetadataByPatientIdAsync(TenantId, patientId);
        Assert.Single(page.Documents);
        Assert.Null(page.Documents[0].SessionId);
        Assert.Equal(meta.Id, page.Documents[0].CanonicalDocumentId);
    }

    [Fact]
    public async Task PatientLevelUpload_TenantIsolation()
    {
        await using var db = CreateDb();
        var patientId = Guid.NewGuid();
        db.Patients.Add(Patient(OtherTenantId, patientId));
        await db.SaveChangesAsync();

        await Assert.ThrowsAsync<KeyNotFoundException>(() =>
            Service(db, Blob()).UploadPatientLevelAsync(
                TenantId, patientId, PdfFile("a.pdf"), "Other", UserId));
        Assert.Equal(0, await db.CanonicalDocuments.CountAsync());
    }

    [Fact]
    public async Task SessionAndPatientLevel_SharePatient360List_WithoutDuplicateBlob()
    {
        await using var db = CreateDb();
        var patientId = Guid.NewGuid();
        db.Patients.Add(Patient(TenantId, patientId));
        var session = Session(TenantId, patientId);
        db.CounselingSession.Add(session);
        await db.SaveChangesAsync();
        var stored = new List<(string Container, string Key, byte[] Bytes)>();
        var blob = Blob(stored);

        var sessionDoc = await Service(db, blob).UploadAsync(
            TenantId, session.Id, PdfFile("session.pdf"), "ReferralLetter", null, UserId, patientId);
        var patientDoc = await Service(db, blob).UploadPatientLevelAsync(
            TenantId, patientId, PdfFile("patient.pdf"), "PreviousReport", UserId);

        // Same bytes → one canonical identity / one blob; two counselling associations / list rows.
        Assert.Single(stored);
        Assert.Equal(1, await db.CanonicalDocuments.CountAsync());
        Assert.Equal(2, await db.CanonicalDocumentAssociations.CountAsync());

        var page = await Workflow(db).ListMetadataByPatientIdAsync(TenantId, patientId);
        Assert.Equal(2, page.Documents.Count);
        Assert.Contains(page.Documents, d => d.Id == sessionDoc.Id && d.SessionId == session.Id);
        Assert.Contains(page.Documents, d => d.Id == patientDoc.Id && d.SessionId == null && d.CanonicalDocumentId == patientDoc.Id);
        Assert.Equal(
            page.Documents.Single(d => d.Id == sessionDoc.Id).CanonicalDocumentId,
            page.Documents.Single(d => d.Id == patientDoc.Id).CanonicalDocumentId);
    }

    [Fact]
    public async Task ListMetadata_ExcludesAudioRecording_KeepsRecordingRowIntact()
    {
        await using var db = CreateDb();
        var patientId = Guid.NewGuid();
        var session = Session(TenantId, patientId);
        db.CounselingSession.Add(session);
        db.CounselingSessionDocuments.Add(new CounselingSessionDocument
        {
            Id = Guid.NewGuid(),
            TenantId = TenantId,
            SessionId = session.Id,
            DocumentName = "recording.webm",
            DocumentType = CounselingSessionDocumentTypes.AudioRecording,
            FilePath = "conversation-recordings/example.webm",
            FileType = "webm",
            FileSizeBytes = 2048,
            Status = "active",
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow,
            CreatedByUserId = UserId,
        });
        db.CounselingSessionDocuments.Add(Doc(TenantId, session.Id, Guid.NewGuid(), "referral.pdf"));
        await db.SaveChangesAsync();

        var page = await Workflow(db).ListMetadataByPatientIdAsync(TenantId, patientId);
        Assert.Single(page.Documents);
        Assert.Equal("referral.pdf", page.Documents[0].DocumentName);
        Assert.DoesNotContain(page.Documents, d => d.DocumentType == CounselingSessionDocumentTypes.AudioRecording);

        var sessionDocs = await Workflow(db).GetSessionDocumentsAsync(TenantId, session.Id);
        Assert.Contains(sessionDocs, d => d.DocumentType == CounselingSessionDocumentTypes.AudioRecording);
    }

    [Fact]
    public async Task PatientLevelDelete_Uploader_SoftDeletesCanonical_RetainsBlob()
    {
        await using var db = CreateDb();
        var patientId = Guid.NewGuid();
        db.Patients.Add(Patient(TenantId, patientId));
        await db.SaveChangesAsync();
        var stored = new List<(string Container, string Key, byte[] Bytes)>();
        var blob = Blob(stored);

        var meta = await Service(db, blob).UploadPatientLevelAsync(
            TenantId, patientId, PdfFile("a.pdf"), "LabReport", UserId);

        var ok = await Workflow(db).DeleteSessionDocumentAsync(TenantId, meta.Id, UserId);
        Assert.True(ok);
        Assert.NotNull((await db.CanonicalDocuments.SingleAsync()).DeletedAt);
        Assert.Single(stored);

        var page = await Workflow(db).ListMetadataByPatientIdAsync(TenantId, patientId);
        Assert.Empty(page.Documents);
    }

    [Fact]
    public async Task PatientLevelDelete_NonUploader_Forbidden()
    {
        await using var db = CreateDb();
        var patientId = Guid.NewGuid();
        db.Patients.Add(Patient(TenantId, patientId));
        await db.SaveChangesAsync();

        var meta = await Service(db, Blob()).UploadPatientLevelAsync(
            TenantId, patientId, PdfFile("a.pdf"), "Imaging", UserId);

        await Assert.ThrowsAsync<UnauthorizedAccessException>(() =>
            Workflow(db).DeleteSessionDocumentAsync(TenantId, meta.Id, OtherUserId));
        Assert.Null((await db.CanonicalDocuments.SingleAsync()).DeletedAt);
    }

    private sealed class SaveFailingDb : AppDbContext
    {
        public bool FailNextSave { get; set; }

        public SaveFailingDb(DbContextOptions<AppDbContext> options) : base(options, new HttpContextAccessor())
        {
        }

        public override Task<int> SaveChangesAsync(CancellationToken cancellationToken = default)
        {
            if (FailNextSave)
                throw new InvalidOperationException("forced persist failure");
            return base.SaveChangesAsync(cancellationToken);
        }
    }

    private static string AttributeOf(Type type, string method) =>
        type.GetMethods(System.Reflection.BindingFlags.Instance | System.Reflection.BindingFlags.Public | System.Reflection.BindingFlags.DeclaredOnly)
            .Single(m => m.Name == method)
            .GetCustomAttributes(typeof(RequirePermissionAttribute), false)
            .Cast<RequirePermissionAttribute>()
            .Single()
            .PermissionCode;

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

    private static CounselingSessionDocumentCanonicalService Service(AppDbContext db, IBlobStorageService blob)
    {
        var identity = new CanonicalDocumentIdentityService(
            db, blob, NullLogger<CanonicalDocumentIdentityService>.Instance);
        return new CounselingSessionDocumentCanonicalService(
            db, blob, NullLogger<CounselingSessionDocumentCanonicalService>.Instance, identity);
    }

    private static CounselingWorkflowService Workflow(AppDbContext db) =>
        new(
            db,
            NullLogger<CounselingWorkflowService>.Instance,
            null!,
            null!,
            new ConfigurationBuilder().Build(),
            null!,
            null!);

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

    private static Patient Patient(Guid tenantId, Guid id) =>
        new()
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

    private static CounselingSession Session(Guid tenantId, Guid patientId) =>
        new()
        {
            Id = Guid.NewGuid(),
            TenantId = tenantId,
            PatientId = patientId,
            ReferredByDoctorId = Guid.NewGuid(),
            SessionType = "Initial",
            SessionDate = DateTime.UtcNow.Date,
            PatientType = "Cash",
            Status = "InProgress",
            CreatedAt = DateTime.UtcNow,
        };

    private static CounselingSessionDocument Doc(Guid tenantId, Guid sessionId, Guid id, string name) =>
        new()
        {
            Id = id,
            TenantId = tenantId,
            SessionId = sessionId,
            DocumentName = name,
            DocumentType = "ReferralLetter",
            FilePath = CounselingSessionDocumentTypes.CanonicalFilePathMarker(Guid.NewGuid()),
            FileType = "pdf",
            FileSizeBytes = 1024,
            Status = "active",
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow,
            CreatedByUserId = UserId,
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

    private static DbContextOptions<AppDbContext> CreateOptions() =>
        new DbContextOptionsBuilder<AppDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString("N"))
            .Options;

    private static AppDbContext CreateDb() => new(CreateOptions(), new HttpContextAccessor());

    private static string Repo(string project, [System.Runtime.CompilerServices.CallerFilePath] string testFile = "") =>
        Path.GetFullPath(Path.Combine(Path.GetDirectoryName(testFile)!, "..", project));
}
