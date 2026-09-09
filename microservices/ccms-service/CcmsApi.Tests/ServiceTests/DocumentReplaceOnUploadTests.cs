using CcmsApi.Services;
using CcmsApi.Tests.Fixtures;
using FluentAssertions;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging.Abstractions;

namespace CcmsApi.Tests.ServiceTests;

public class DocumentReplaceOnUploadTests : IDisposable
{
    private readonly InMemoryDbFixture _fix = new();

    private static DocumentEngineService CreateSvc(InMemoryDbFixture fix) =>
        new(fix.Db, new ConfigurationBuilder().Build(), NullLogger<DocumentEngineService>.Instance);

    private static UploadDocumentRequest MetaUpload(
        string documentType, string name, string blobUrl) =>
        new("preauth", documentType, name, blobUrl, 100, "application/pdf");

    [Fact]
    public async Task UploadAsync_soft_deletes_prior_same_type_only()
    {
        var c = _fix.SeedCase();
        var svc = CreateSvc(_fix);
        const string blob = "http://127.0.0.1:10000/devstoreaccount1/ccms-documents/cases/x/a.pdf";

        var idProof1 = await svc.UploadAsync(
            c.Id, _fix.ActorId, MetaUpload("id_proof", "id1.pdf", blob));
        var policy = await svc.UploadAsync(
            c.Id, _fix.ActorId, MetaUpload("policy_document", "policy.pdf", blob));
        var idProof2 = await svc.UploadAsync(
            c.Id, _fix.ActorId, MetaUpload("id_proof", "id2.pdf", blob));

        idProof2.Id.Should().NotBe(idProof1.Id);

        var active = await _fix.Db.Documents
            .Where(d => d.CoverageCase_Id == c.Id && d.DeletedAt == null)
            .ToListAsync();
        active.Should().HaveCount(2);
        active.Select(d => d.DocumentType).Should().BeEquivalentTo(["id_proof", "policy_document"]);
        active.Single(d => d.DocumentType == "id_proof").Id.Should().Be(idProof2.Id);

        var deleted = await _fix.Db.Documents
            .Where(d => d.CoverageCase_Id == c.Id && d.DeletedAt != null)
            .ToListAsync();
        deleted.Should().ContainSingle(d => d.Id == idProof1.Id);
    }

    [Fact]
    public async Task GetReadAccessUrlAsync_returns_pointer_url_unchanged()
    {
        var c = _fix.SeedCase();
        var svc = CreateSvc(_fix);
        var attached = await svc.AttachBiometryRecordAsync(
            c.Id, _fix.ActorId, Guid.Parse("aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee"));

        var access = await svc.GetReadAccessUrlAsync(attached.Id, c.Id);

        access.IsPointer.Should().BeTrue();
        access.Url.Should().Be(attached.BlobUrl);
        access.ExpiresAt.Should().BeNull();
    }

    [Fact]
    public async Task GetByCaseAsync_returns_persisted_upload_after_save()
    {
        var c = _fix.SeedCase();
        var svc = CreateSvc(_fix);
        const string blob = "http://127.0.0.1:10000/devstoreaccount1/ccms-documents/cases/x/id.pdf";

        var uploaded = await svc.UploadAsync(
            c.Id, _fix.ActorId, MetaUpload("id_proof", "id.pdf", blob));

        var listed = await svc.GetByCaseAsync(c.Id);
        listed.Should().ContainSingle(d => d.Id == uploaded.Id && d.DeletedAt == null);
        listed.Single().DocumentType.Should().Be("id_proof");
        listed.Single().BlobUrl.Should().Be(blob);
        listed.Single().FileSizeBytes.Should().BeGreaterThan(0);
    }

    public void Dispose() => _fix.Dispose();
}
