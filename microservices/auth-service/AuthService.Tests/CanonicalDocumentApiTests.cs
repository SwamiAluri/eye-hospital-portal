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
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging.Abstractions;
using Moq;
using Xunit;

namespace AuthService.Tests;

public class CanonicalDocumentApiTests
{
    private static readonly Guid UserId = Guid.Parse("11111111-1111-1111-1111-111111111111");
    private static readonly Guid TenantId = Guid.Parse("22222222-2222-2222-2222-222222222222");
    private static readonly Guid OtherTenantId = Guid.Parse("33333333-3333-3333-3333-333333333333");

    [Fact]
    public async Task UploadPermission_AllowsUploadPolicy()
    {
        Assert.True(await Authorize(CanonicalDocumentPermissions.Upload));
    }

    [Theory]
    [InlineData("patient.view")]
    [InlineData("patient.update")]
    [InlineData("patient.patient_document.read")]
    [InlineData("patient.patient_document.download")]
    public async Task SiblingPermission_DoesNotAuthorizeUpload(string permission)
    {
        Assert.False(await Authorize(permission, CanonicalDocumentPermissions.Upload));
    }

    [Theory]
    [InlineData("patient.view")]
    [InlineData("patient.update")]
    [InlineData("patient.patient_document.upload")]
    public async Task SiblingPermission_DoesNotAuthorizeRead(string permission)
    {
        Assert.False(await Authorize(permission, CanonicalDocumentPermissions.Read));
    }

    [Theory]
    [InlineData("patient.view")]
    [InlineData("patient.update")]
    [InlineData("patient.patient_document.read")]
    public async Task SiblingPermission_DoesNotAuthorizeDownload(string permission)
    {
        Assert.False(await Authorize(permission, CanonicalDocumentPermissions.Download));
    }

    [Fact]
    public async Task Unauthenticated_IsRejected()
    {
        var requirement = new PermissionRequirement(CanonicalDocumentPermissions.Upload);
        var user = new ClaimsPrincipal(new ClaimsIdentity());
        var context = new AuthorizationHandlerContext(new[] { requirement }, user, null);
        await using var db = CreateDb();
        await new PermissionAuthorizationHandler(db).HandleAsync(context);
        Assert.False(context.HasSucceeded);
        Assert.True(context.HasFailed);
    }

    [Fact]
    public void Endpoints_BindDedicatedPermissions_NotPatientUpdate()
    {
        var type = typeof(PatientCanonicalDocumentsController);
        Assert.Equal(
            CanonicalDocumentPermissions.Upload,
            AttributeOf(type, nameof(PatientCanonicalDocumentsController.Upload)));
        Assert.Equal(
            CanonicalDocumentPermissions.Read,
            AttributeOf(type, nameof(PatientCanonicalDocumentsController.List)));
        Assert.Equal(
            CanonicalDocumentPermissions.Download,
            AttributeOf(type, nameof(PatientCanonicalDocumentsController.Content)));
        Assert.Equal(
            CanonicalDocumentPermissions.Delete,
            AttributeOf(type, nameof(PatientCanonicalDocumentsController.Delete)));
        Assert.DoesNotContain("patient.update", File.ReadAllText(ControllerSource()));
        Assert.DoesNotContain("patient.view", File.ReadAllText(ControllerSource()));
    }

    [Fact]
    public async Task Upload_Pdf_CreatesDocumentAssociationAndBlob()
    {
        await using var db = CreateDb();
        var patientId = Guid.NewGuid();
        db.Patients.Add(Patient(TenantId, patientId));
        await db.SaveChangesAsync();
        var stored = new List<(string Container, string Key)>();
        var blob = Blob(stored);

        var result = await Service(db, blob).UploadGeneralAsync(
            TenantId, patientId, UserId, PdfFile("note.pdf"), null);

        Assert.NotEqual(Guid.Empty, result.Id);
        Assert.Equal("note.pdf", result.FileName);
        Assert.Equal("application/pdf", result.MimeType);
        Assert.Single(stored);
        Assert.Equal("patient-documents", stored[0].Container);
        Assert.Equal($"{TenantId:N}/{result.Id:N}", stored[0].Key);
        Assert.Equal(1, await db.CanonicalDocuments.CountAsync());
        Assert.Equal(1, await db.CanonicalDocumentAssociations.CountAsync());
        var association = await db.CanonicalDocumentAssociations.SingleAsync();
        Assert.Equal("mpi", association.Domain);
        Assert.Equal("patient", association.EntityType);
        Assert.Equal(patientId, association.EntityId);
        var row = await db.CanonicalDocuments.SingleAsync();
        Assert.DoesNotContain(result.FileName, row.StorageObjectKey, StringComparison.Ordinal);
        Assert.False(string.IsNullOrEmpty(row.ContentHash));
    }

    [Fact]
    public async Task Upload_JpegAndPng_Succeed()
    {
        await using var db = CreateDb();
        var patientId = Guid.NewGuid();
        db.Patients.Add(Patient(TenantId, patientId));
        await db.SaveChangesAsync();
        var service = Service(db, Blob());

        var jpeg = await service.UploadGeneralAsync(TenantId, patientId, UserId, JpegFile("eye.jpg"), null);
        var png = await service.UploadGeneralAsync(
            TenantId,
            patientId,
            UserId,
            PngFile("scan.png"),
            new CanonicalDocumentUploadRequest(null, CanonicalDocumentDuplicateResolutions.KeepBoth, null));
        Assert.Equal("image/jpeg", jpeg.MimeType);
        Assert.Equal("image/png", png.MimeType);
    }

    [Theory]
    [InlineData("file.doc", new byte[] { 0xD0, 0xCF, 0x11, 0xE0 }, "application/msword")]
    [InlineData("file.docx", new byte[] { 0x50, 0x4B, 0x03, 0x04 }, "application/vnd.openxmlformats-officedocument.wordprocessingml.document")]
    [InlineData("file.gif", new byte[] { 0x47, 0x49, 0x46, 0x38, 0x39, 0x61 }, "image/gif")]
    [InlineData("file.dcm", new byte[] { 0x00, 0x00, 0x00, 0x00, 0x00 }, "application/dicom")]
    public async Task Upload_RejectedTypes(string name, byte[] bytes, string mime)
    {
        await using var db = CreateDb();
        var patientId = Guid.NewGuid();
        db.Patients.Add(Patient(TenantId, patientId));
        await db.SaveChangesAsync();

        var ex = await Assert.ThrowsAsync<ArgumentException>(() =>
            Service(db, Blob()).UploadGeneralAsync(TenantId, patientId, UserId, FileOf(name, mime, bytes), null));
        Assert.Equal("File type is not allowed.", ex.Message);
        Assert.Equal(0, await db.CanonicalDocuments.CountAsync());
    }

    [Fact]
    public async Task Upload_Over20Mb_Rejected()
    {
        await using var db = CreateDb();
        var patientId = Guid.NewGuid();
        db.Patients.Add(Patient(TenantId, patientId));
        await db.SaveChangesAsync();
        var huge = new byte[CanonicalDocumentFileRules.MaxBytes + 1];
        Buffer.BlockCopy(PdfBytes(), 0, huge, 0, PdfBytes().Length);

        var ex = await Assert.ThrowsAsync<ArgumentException>(() =>
            Service(db, Blob()).UploadGeneralAsync(
                TenantId, patientId, UserId, FileOf("big.pdf", "application/pdf", huge), null));
        Assert.Contains("20 MB", ex.Message);
        Assert.Equal(0, await db.CanonicalDocuments.CountAsync());
    }

    [Fact]
    public async Task Upload_UnsafeName_IsSanitized()
    {
        await using var db = CreateDb();
        var patientId = Guid.NewGuid();
        db.Patients.Add(Patient(TenantId, patientId));
        await db.SaveChangesAsync();

        var result = await Service(db, Blob()).UploadGeneralAsync(
            TenantId, patientId, UserId, FileOf("../secret/../note.pdf", "application/pdf", PdfBytes()), null);
        Assert.Equal("note.pdf", result.FileName);
    }

    [Fact]
    public async Task Upload_MatchingClassification_RequiresResolution()
    {
        await using var db = CreateDb();
        var patientId = Guid.NewGuid();
        db.Patients.Add(Patient(TenantId, patientId));
        await db.SaveChangesAsync();
        var service = Service(db, Blob());
        await service.UploadGeneralAsync(TenantId, patientId, UserId, PdfFile("id.pdf"), null);

        var other = FileOf("other.pdf", "application/pdf", Encoding.ASCII.GetBytes("%PDF-1.4 other"));
        var ex = await Assert.ThrowsAsync<CanonicalDocumentDuplicateException>(() =>
            service.UploadGeneralAsync(TenantId, patientId, UserId, other, null));
        Assert.Equal("id.pdf", ex.Candidate.FileName);
        Assert.False(ex.Candidate.ContentHashMatch);
        Assert.Equal(1, await db.CanonicalDocuments.CountAsync());
    }

    [Fact]
    public async Task Upload_ExactHash_IsDuplicateEvenWhenFilenameDiffers()
    {
        await using var db = CreateDb();
        var patientId = Guid.NewGuid();
        db.Patients.Add(Patient(TenantId, patientId));
        await db.SaveChangesAsync();
        var service = Service(db, Blob());
        await service.UploadGeneralAsync(TenantId, patientId, UserId, PdfFile("first.pdf"), null);

        var ex = await Assert.ThrowsAsync<CanonicalDocumentDuplicateException>(() =>
            service.UploadGeneralAsync(TenantId, patientId, UserId, PdfFile("copy.pdf"), null));
        Assert.True(ex.Candidate.ContentHashMatch);
    }

    [Fact]
    public async Task Upload_DifferentClassification_IsNotDuplicate()
    {
        await using var db = CreateDb();
        var patientId = Guid.NewGuid();
        db.Patients.Add(Patient(TenantId, patientId));
        await db.SaveChangesAsync();
        var service = Service(db, Blob());
        await service.UploadGeneralAsync(
            TenantId, patientId, UserId, PdfFile("a.pdf"), new CanonicalDocumentUploadRequest("id", null, null));
        var second = await service.UploadGeneralAsync(
            TenantId,
            patientId,
            UserId,
            FileOf("b.pdf", "application/pdf", Encoding.ASCII.GetBytes("%PDF-1.4 other")),
            new CanonicalDocumentUploadRequest("referral", null, null));
        Assert.Equal("referral", second.Classification);
        Assert.Equal(2, await db.CanonicalDocuments.CountAsync(d => d.Status == "active"));
    }

    [Fact]
    public async Task Upload_KeepBoth_LeavesPriorActiveAndOrdersNewestFirst()
    {
        await using var db = CreateDb();
        var patientId = Guid.NewGuid();
        db.Patients.Add(Patient(TenantId, patientId));
        await db.SaveChangesAsync();
        var service = Service(db, Blob());
        var first = await service.UploadGeneralAsync(TenantId, patientId, UserId, PdfFile("old.pdf"), null);
        var firstRow = await db.CanonicalDocuments.FindAsync(first.Id);
        firstRow!.CreatedAt = DateTime.UtcNow.AddMinutes(-1);
        await db.SaveChangesAsync();
        var second = await service.UploadGeneralAsync(
            TenantId,
            patientId,
            UserId,
            FileOf("new.pdf", "application/pdf", Encoding.ASCII.GetBytes("%PDF-1.4 keep-both-other")),
            new CanonicalDocumentUploadRequest(null, CanonicalDocumentDuplicateResolutions.KeepBoth, null));

        var page = await service.ListGeneralByPatientAsync(TenantId, patientId, 1, 20);
        Assert.Equal(2, page.Documents.Count);
        Assert.Equal(second.Id, page.Documents[0].Id);
        Assert.Equal(first.Id, page.Documents[1].Id);
        Assert.All(page.Documents, d => Assert.Equal("active", d.Status));
        Assert.Equal("active", (await db.CanonicalDocuments.FindAsync(first.Id))!.Status);
    }

    [Fact]
    public async Task Upload_KeepBoth_ExactHash_ReusesCanonicalIdentity()
    {
        await using var db = CreateDb();
        var patientId = Guid.NewGuid();
        db.Patients.Add(Patient(TenantId, patientId));
        await db.SaveChangesAsync();
        var stored = new List<(string Container, string Key)>();
        var service = Service(db, Blob(stored));
        var first = await service.UploadGeneralAsync(TenantId, patientId, UserId, PdfFile("old.pdf"), null);
        var second = await service.UploadGeneralAsync(
            TenantId,
            patientId,
            UserId,
            PdfFile("copy.pdf"),
            new CanonicalDocumentUploadRequest(null, CanonicalDocumentDuplicateResolutions.KeepBoth, null));

        Assert.Equal(first.Id, second.Id);
        Assert.Equal(1, await db.CanonicalDocuments.CountAsync(d => d.DeletedAt == null));
        Assert.Equal(1, await db.CanonicalDocumentAssociations.CountAsync());
        Assert.Single(stored);
    }

    [Fact]
    public async Task Upload_Replace_SupersedesWithoutDeletingBlob()
    {
        await using var db = CreateDb();
        var patientId = Guid.NewGuid();
        db.Patients.Add(Patient(TenantId, patientId));
        await db.SaveChangesAsync();
        var stored = new List<(string Container, string Key)>();
        var deleted = new List<(string Container, string Key)>();
        var blob = new Mock<IBlobStorageService>();
        blob.Setup(b => b.UploadExactKeyAsync(It.IsAny<string>(), It.IsAny<string>(), It.IsAny<Stream>(), It.IsAny<string>(), It.IsAny<CancellationToken>()))
            .Callback<string, string, Stream, string, CancellationToken>((container, key, _, _, _) => stored.Add((container, key)))
            .Returns(Task.CompletedTask);
        blob.Setup(b => b.DeleteExactKeyAsync(It.IsAny<string>(), It.IsAny<string>(), It.IsAny<CancellationToken>()))
            .Callback<string, string, CancellationToken>((container, key, _) => deleted.Add((container, key)))
            .Returns(Task.CompletedTask);

        var service = Service(db, blob.Object);
        var first = await service.UploadGeneralAsync(TenantId, patientId, UserId, PdfFile("old.pdf"), null);
        var firstRow = await db.CanonicalDocuments.FindAsync(first.Id);
        firstRow!.CreatedAt = DateTime.UtcNow.AddMinutes(-1);
        await db.SaveChangesAsync();
        var second = await service.UploadGeneralAsync(
            TenantId,
            patientId,
            UserId,
            PdfFile("new.pdf"),
            new CanonicalDocumentUploadRequest(null, CanonicalDocumentDuplicateResolutions.Replace, first.Id));

        var oldRow = await db.CanonicalDocuments.FindAsync(first.Id);
        Assert.Equal("superseded", oldRow!.Status);
        Assert.Equal(second.Id, oldRow.SupersededByDocumentId);
        Assert.Equal("active", (await db.CanonicalDocuments.FindAsync(second.Id))!.Status);
        Assert.Equal(2, stored.Count);
        Assert.Empty(deleted);
        Assert.Equal($"{TenantId:N}/{first.Id:N}", oldRow.StorageObjectKey);

        var page = await service.ListGeneralByPatientAsync(TenantId, patientId, 1, 20);
        Assert.Equal(second.Id, page.Documents[0].Id);
        Assert.Equal("superseded", page.Documents.Single(d => d.Id == first.Id).Status);
    }

    [Fact]
    public async Task Content_Superseded_RemainsDownloadable()
    {
        await using var db = CreateDb();
        var patientId = Guid.NewGuid();
        db.Patients.Add(Patient(TenantId, patientId));
        await db.SaveChangesAsync();
        var payload = PdfBytes();
        var blob = new Mock<IBlobStorageService>();
        blob.Setup(b => b.UploadExactKeyAsync(It.IsAny<string>(), It.IsAny<string>(), It.IsAny<Stream>(), It.IsAny<string>(), It.IsAny<CancellationToken>()))
            .Returns(Task.CompletedTask);
        blob.Setup(b => b.OpenReadExactAsync(It.IsAny<string>(), It.IsAny<string>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(new ExactBlobRead { Content = new MemoryStream(payload), ContentType = "application/pdf", ContentLength = payload.Length });

        var service = Service(db, blob.Object);
        var first = await service.UploadGeneralAsync(TenantId, patientId, UserId, PdfFile("old.pdf"), null);
        await service.UploadGeneralAsync(
            TenantId,
            patientId,
            UserId,
            PdfFile("new.pdf"),
            new CanonicalDocumentUploadRequest(null, CanonicalDocumentDuplicateResolutions.Replace, first.Id));

        var content = await service.OpenContentAsync(TenantId, patientId, first.Id);
        Assert.NotNull(content);
    }

    [Fact]
    public async Task Upload_Replace_StaleTarget_IsRejected()
    {
        await using var db = CreateDb();
        var patientId = Guid.NewGuid();
        db.Patients.Add(Patient(TenantId, patientId));
        await db.SaveChangesAsync();
        var service = Service(db, Blob());
        var first = await service.UploadGeneralAsync(TenantId, patientId, UserId, PdfFile("old.pdf"), null);
        await Assert.ThrowsAsync<CanonicalDocumentStaleReplacementException>(() =>
            service.UploadGeneralAsync(
                TenantId,
                patientId,
                UserId,
                PdfFile("new.pdf"),
                new CanonicalDocumentUploadRequest(null, CanonicalDocumentDuplicateResolutions.Replace, Guid.NewGuid())));
        Assert.Equal("active", (await db.CanonicalDocuments.FindAsync(first.Id))!.Status);
    }

    [Fact]
    public async Task List_IsPatientAndTenantScoped_AndOmitsStorage()
    {
        await using var db = CreateDb();
        var patientA = Guid.NewGuid();
        var patientB = Guid.NewGuid();
        db.Patients.AddRange(Patient(TenantId, patientA), Patient(TenantId, patientB));
        await db.SaveChangesAsync();
        var service = Service(db, Blob());
        await service.UploadGeneralAsync(TenantId, patientA, UserId, PdfFile("a.pdf"), null);
        await service.UploadGeneralAsync(
            TenantId,
            patientB,
            UserId,
            PdfFile("b.pdf"),
            null);

        var page = await service.ListGeneralByPatientAsync(TenantId, patientA, 1, 20);
        Assert.Single(page.Documents);
        Assert.Equal("a.pdf", page.Documents[0].FileName);
        var json = System.Text.Json.JsonSerializer.Serialize(page.Documents[0]);
        Assert.DoesNotContain("storageObjectKey", json, StringComparison.OrdinalIgnoreCase);
        Assert.DoesNotContain("storageContainer", json, StringComparison.OrdinalIgnoreCase);
        Assert.DoesNotContain("contentHash", json, StringComparison.OrdinalIgnoreCase);
    }

    [Fact]
    public async Task List_ExcludesSoftDeleted()
    {
        await using var db = CreateDb();
        var patientId = Guid.NewGuid();
        db.Patients.Add(Patient(TenantId, patientId));
        await db.SaveChangesAsync();
        var created = await Service(db, Blob()).UploadGeneralAsync(TenantId, patientId, UserId, PdfFile("gone.pdf"), null);
        var row = await db.CanonicalDocuments.SingleAsync(d => d.Id == created.Id);
        row.DeletedAt = DateTime.UtcNow;
        await db.SaveChangesAsync();

        var page = await Service(db, Blob()).ListGeneralByPatientAsync(TenantId, patientId, 1, 20);
        Assert.Empty(page.Documents);
    }

    [Fact]
    public async Task Content_Authorized_StreamsBytes()
    {
        await using var db = CreateDb();
        var patientId = Guid.NewGuid();
        db.Patients.Add(Patient(TenantId, patientId));
        await db.SaveChangesAsync();
        var payload = PdfBytes();
        var blob = new Mock<IBlobStorageService>();
        blob.Setup(b => b.UploadExactKeyAsync(It.IsAny<string>(), It.IsAny<string>(), It.IsAny<Stream>(), It.IsAny<string>(), It.IsAny<CancellationToken>()))
            .Returns(Task.CompletedTask);
        blob.Setup(b => b.OpenReadExactAsync(It.IsAny<string>(), It.IsAny<string>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(new ExactBlobRead { Content = new MemoryStream(payload), ContentType = "application/pdf", ContentLength = payload.Length });

        var created = await Service(db, blob.Object).UploadGeneralAsync(TenantId, patientId, UserId, PdfFile("a.pdf"), null);
        var content = await Service(db, blob.Object).OpenContentAsync(TenantId, patientId, created.Id);
        Assert.NotNull(content);
        using var reader = new MemoryStream();
        await content!.Content.CopyToAsync(reader);
        Assert.Equal(payload, reader.ToArray());
    }

    [Fact]
    public async Task Content_WrongPatientOrTenantOrMissing_IsUnavailable()
    {
        await using var db = CreateDb();
        var patientA = Guid.NewGuid();
        var patientB = Guid.NewGuid();
        db.Patients.AddRange(Patient(TenantId, patientA), Patient(TenantId, patientB));
        await db.SaveChangesAsync();
        var created = await Service(db, Blob()).UploadGeneralAsync(TenantId, patientA, UserId, PdfFile("a.pdf"), null);

        Assert.Null(await Service(db, Blob()).OpenContentAsync(TenantId, patientB, created.Id));
        Assert.Null(await Service(db, Blob()).OpenContentAsync(OtherTenantId, patientA, created.Id));
        Assert.Null(await Service(db, Blob()).OpenContentAsync(TenantId, patientA, Guid.NewGuid()));
    }

    [Fact]
    public async Task Content_SoftDeleted_Unavailable()
    {
        await using var db = CreateDb();
        var patientId = Guid.NewGuid();
        db.Patients.Add(Patient(TenantId, patientId));
        await db.SaveChangesAsync();
        var created = await Service(db, Blob()).UploadGeneralAsync(TenantId, patientId, UserId, PdfFile("a.pdf"), null);
        var row = await db.CanonicalDocuments.SingleAsync();
        row.DeletedAt = DateTime.UtcNow;
        await db.SaveChangesAsync();
        Assert.Null(await Service(db, Blob()).OpenContentAsync(TenantId, patientId, created.Id));
    }

    [Fact]
    public async Task Upload_BlobFailure_DoesNotPersist()
    {
        await using var db = CreateDb();
        var patientId = Guid.NewGuid();
        db.Patients.Add(Patient(TenantId, patientId));
        await db.SaveChangesAsync();
        var blob = new Mock<IBlobStorageService>();
        blob.Setup(b => b.UploadExactKeyAsync(It.IsAny<string>(), It.IsAny<string>(), It.IsAny<Stream>(), It.IsAny<string>(), It.IsAny<CancellationToken>()))
            .ThrowsAsync(new InvalidOperationException("blob down"));

        await Assert.ThrowsAsync<InvalidOperationException>(() =>
            Service(db, blob.Object).UploadGeneralAsync(TenantId, patientId, UserId, PdfFile("a.pdf"), null));
        Assert.Equal(0, await db.CanonicalDocuments.CountAsync());
        Assert.Equal(0, await db.CanonicalDocumentAssociations.CountAsync());
    }

    [Fact]
    public async Task Upload_DbFailure_CompensatesBlobAndDoesNotSucceed()
    {
        await using var db = CreateFailingDb();
        var patientId = Guid.NewGuid();
        db.Patients.Add(Patient(TenantId, patientId));
        await db.SaveChangesAsync();
        db.FailNextSave = true;
        var deleted = new List<(string Container, string Key)>();
        var blob = new Mock<IBlobStorageService>();
        blob.Setup(b => b.UploadExactKeyAsync(It.IsAny<string>(), It.IsAny<string>(), It.IsAny<Stream>(), It.IsAny<string>(), It.IsAny<CancellationToken>()))
            .Returns(Task.CompletedTask);
        blob.Setup(b => b.DeleteExactKeyAsync(It.IsAny<string>(), It.IsAny<string>(), It.IsAny<CancellationToken>()))
            .Callback<string, string, CancellationToken>((container, key, _) => deleted.Add((container, key)))
            .Returns(Task.CompletedTask);

        await Assert.ThrowsAsync<InvalidOperationException>(() =>
            Service(db, blob.Object).UploadGeneralAsync(TenantId, patientId, UserId, PdfFile("a.pdf"), null));
        Assert.Equal(0, await db.CanonicalDocuments.CountAsync());
        Assert.Single(deleted);
        Assert.Equal("patient-documents", deleted[0].Container);
    }

    [Fact]
    public async Task AssociationUniqueness_IsDefinedInMigration()
    {
        await using var db = CreateDb();
        var patientId = Guid.NewGuid();
        db.Patients.Add(Patient(TenantId, patientId));
        await db.SaveChangesAsync();
        await Service(db, Blob()).UploadGeneralAsync(TenantId, patientId, UserId, PdfFile("a.pdf"), null);
        Assert.Equal(1, await db.CanonicalDocumentAssociations.CountAsync());
        var sql = File.ReadAllText(MigrationSource());
        Assert.Contains(
            "CREATE UNIQUE INDEX IF NOT EXISTS ux_canonical_document_association_once",
            sql,
            StringComparison.Ordinal);
    }

    [Fact]
    public async Task MissingPatient_IsNotFound()
    {
        await using var db = CreateDb();
        await Assert.ThrowsAsync<KeyNotFoundException>(() =>
            Service(db, Blob()).UploadGeneralAsync(TenantId, Guid.NewGuid(), UserId, PdfFile("a.pdf"), null));
    }

    [Fact]
    public void Migration_DefinesUniquenessAndDoesNotTouchLegacyTable()
    {
        var sql = File.ReadAllText(MigrationSource());
        Assert.Contains("canonical_documents", sql, StringComparison.Ordinal);
        Assert.Contains("canonical_document_associations", sql, StringComparison.Ordinal);
        Assert.Contains("ux_canonical_document_association_once", sql, StringComparison.Ordinal);
        Assert.Contains("ix_canonical_documents_tenant_patient", sql, StringComparison.Ordinal);
        Assert.DoesNotContain("patient_document_uploads", sql, StringComparison.Ordinal);
        Assert.DoesNotContain("branch_id", sql, StringComparison.Ordinal);
        Assert.True(File.Exists(MigrationSource().Replace(".cs", ".sql", StringComparison.Ordinal)));
    }

    [Fact]
    public void IdentityService_CompensatesBlobWhenPersistFails()
    {
        var identitySource = File.ReadAllText(IdentityServiceSource());
        Assert.Contains("DeleteExactKeyAsync", identitySource, StringComparison.Ordinal);
        Assert.Contains("UploadExactKeyAsync", identitySource, StringComparison.Ordinal);
        Assert.DoesNotContain("UploadFileAsync", identitySource, StringComparison.Ordinal);

        var generalSource = File.ReadAllText(ServiceSource());
        Assert.Contains("ResolveOrCreateAsync", generalSource, StringComparison.Ordinal);
        Assert.DoesNotContain("UploadFileAsync", generalSource, StringComparison.Ordinal);
    }

    [Fact]
    public void CatalogStillDefinesDocumentPermissions()
    {
        var seeder = File.ReadAllText(Path.Combine(Repo("AuthService"), "SeedData", "PermissionSeeder.cs"));
        Assert.Contains("patient.patient_document.upload", seeder, StringComparison.Ordinal);
        Assert.Contains("patient.patient_document.read", seeder, StringComparison.Ordinal);
        Assert.Contains("patient.patient_document.download", seeder, StringComparison.Ordinal);
        Assert.Contains("patient.patient_document.delete", seeder, StringComparison.Ordinal);
        Assert.DoesNotContain("CanonicalDocumentPermissions", File.ReadAllText(Path.Combine(Repo("AuthService"), "SeedData", "PermissionSeeder.cs")));
    }

    [Fact]
    public async Task SoftDelete_Uploader_HidesFromList_RetainsBlob()
    {
        await using var db = CreateDb();
        var patientId = Guid.NewGuid();
        db.Patients.Add(Patient(TenantId, patientId));
        await db.SaveChangesAsync();
        var stored = new List<(string Container, string Key)>();
        var blob = Blob(stored);

        var created = await Service(db, blob).UploadGeneralAsync(TenantId, patientId, UserId, PdfFile("a.pdf"), null);
        Assert.Single(stored);

        await Service(db, blob).SoftDeleteGeneralAsync(TenantId, patientId, created.Id, UserId);

        var row = await db.CanonicalDocuments.SingleAsync(d => d.Id == created.Id);
        Assert.NotNull(row.DeletedAt);
        Assert.Single(stored);
        Assert.Empty((await Service(db, blob).ListGeneralByPatientAsync(TenantId, patientId, 1, 20)).Documents);
        Assert.Null(await Service(db, blob).OpenContentAsync(TenantId, patientId, created.Id));
    }

    [Fact]
    public async Task SoftDelete_NonUploader_Forbidden()
    {
        await using var db = CreateDb();
        var patientId = Guid.NewGuid();
        db.Patients.Add(Patient(TenantId, patientId));
        await db.SaveChangesAsync();
        var otherUser = Guid.Parse("44444444-4444-4444-4444-444444444444");

        var created = await Service(db, Blob()).UploadGeneralAsync(TenantId, patientId, UserId, PdfFile("a.pdf"), null);

        await Assert.ThrowsAsync<UnauthorizedAccessException>(() =>
            Service(db, Blob()).SoftDeleteGeneralAsync(TenantId, patientId, created.Id, otherUser));
        Assert.Null((await db.CanonicalDocuments.SingleAsync()).DeletedAt);
    }

    [Fact]
    public async Task SoftDelete_WrongTenantOrPatient_NotFound()
    {
        await using var db = CreateDb();
        var patientA = Guid.NewGuid();
        var patientB = Guid.NewGuid();
        db.Patients.AddRange(Patient(TenantId, patientA), Patient(TenantId, patientB));
        await db.SaveChangesAsync();

        var created = await Service(db, Blob()).UploadGeneralAsync(TenantId, patientA, UserId, PdfFile("a.pdf"), null);

        await Assert.ThrowsAsync<KeyNotFoundException>(() =>
            Service(db, Blob()).SoftDeleteGeneralAsync(TenantId, patientB, created.Id, UserId));
        await Assert.ThrowsAsync<KeyNotFoundException>(() =>
            Service(db, Blob()).SoftDeleteGeneralAsync(OtherTenantId, patientA, created.Id, UserId));
        Assert.Null((await db.CanonicalDocuments.SingleAsync()).DeletedAt);
    }

    private static string AttributeOf(Type type, string method) =>
        type.GetMethods(System.Reflection.BindingFlags.Instance | System.Reflection.BindingFlags.Public | System.Reflection.BindingFlags.DeclaredOnly)
            .Single(m => m.Name == method)
            .GetCustomAttributes(typeof(RequirePermissionAttribute), false)
            .Cast<RequirePermissionAttribute>()
            .Single()
            .PermissionCode;

    private static async Task<bool> Authorize(string granted, string? required = null)
    {
        required ??= granted;
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

    private static CanonicalDocumentService Service(AppDbContext db, IBlobStorageService blob)
    {
        var identity = new CanonicalDocumentIdentityService(
            db, blob, NullLogger<CanonicalDocumentIdentityService>.Instance);
        return new CanonicalDocumentService(
            db, blob, NullLogger<CanonicalDocumentService>.Instance, identity);
    }

    private static IBlobStorageService Blob(List<(string Container, string Key)>? stored = null)
    {
        var blob = new Mock<IBlobStorageService>();
        blob.Setup(b => b.UploadExactKeyAsync(It.IsAny<string>(), It.IsAny<string>(), It.IsAny<Stream>(), It.IsAny<string>(), It.IsAny<CancellationToken>()))
            .Callback<string, string, Stream, string, CancellationToken>((container, key, _, _, _) => stored?.Add((container, key)))
            .Returns(Task.CompletedTask);
        blob.Setup(b => b.DeleteExactKeyAsync(It.IsAny<string>(), It.IsAny<string>(), It.IsAny<CancellationToken>()))
            .Returns(Task.CompletedTask);
        return blob.Object;
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

    private static IFormFile PdfFile(string name) => FileOf(name, "application/pdf", PdfBytes());
    private static IFormFile JpegFile(string name) => FileOf(name, "image/jpeg", [0xFF, 0xD8, 0xFF, 0xE0, 0x00]);
    private static IFormFile PngFile(string name) => FileOf(name, "image/png", [0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]);
    private static byte[] PdfBytes() => Encoding.ASCII.GetBytes("%PDF-1.4 test");

    private static IFormFile FileOf(string name, string mime, byte[] bytes)
    {
        var stream = new MemoryStream(bytes);
        return new FormFile(stream, 0, bytes.Length, "file", name)
        {
            Headers = new HeaderDictionary(),
            ContentType = mime,
        };
    }

    private static AppDbContext CreateDb()
    {
        var options = new DbContextOptionsBuilder<AppDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString("N"))
            .Options;
        return new AppDbContext(options, new HttpContextAccessor());
    }

    private static FailingAppDbContext CreateFailingDb()
    {
        var options = new DbContextOptionsBuilder<AppDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString("N"))
            .Options;
        return new FailingAppDbContext(options);
    }

    private sealed class FailingAppDbContext : AppDbContext
    {
        public bool FailNextSave { get; set; }

        public FailingAppDbContext(DbContextOptions<AppDbContext> options)
            : base(options, new HttpContextAccessor())
        {
        }

        public override Task<int> SaveChangesAsync(bool acceptAllChangesOnSuccess, CancellationToken cancellationToken = default)
        {
            if (FailNextSave)
                throw new InvalidOperationException("db down");
            return base.SaveChangesAsync(acceptAllChangesOnSuccess, cancellationToken);
        }
    }

    private static string Repo(string project, [System.Runtime.CompilerServices.CallerFilePath] string thisFile = "")
    {
        var testsDir = Path.GetDirectoryName(thisFile)
            ?? throw new DirectoryNotFoundException();
        var candidate = Path.GetFullPath(Path.Combine(testsDir, "..", project));
        if (!Directory.Exists(candidate))
            throw new DirectoryNotFoundException(candidate);
        return candidate;
    }

    private static string ControllerSource() =>
        Path.Combine(Repo("AuthService"), "Controllers", "PatientCanonicalDocumentsController.cs");

    private static string ServiceSource() =>
        Path.Combine(Repo("AuthService"), "Services", "CanonicalDocumentService.cs");

    private static string IdentityServiceSource() =>
        Path.Combine(Repo("AuthService"), "Services", "CanonicalDocumentIdentityService.cs");

    private static string MigrationSource() =>
        Path.Combine(Repo("AuthService"), "Data", "Migrations", "20261006140000_AddCanonicalDocuments.cs");
}
