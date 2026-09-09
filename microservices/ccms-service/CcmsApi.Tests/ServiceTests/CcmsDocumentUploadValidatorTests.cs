using CcmsApi.Models.Domain;
using CcmsApi.Services;
using FluentAssertions;
using Xunit;

namespace CcmsApi.Tests.ServiceTests;

public sealed class CcmsDocumentUploadValidatorTests
{
    [Fact]
    public void IsCompleteFileDocument_rejects_metadata_only_row()
    {
        var doc = new CcmsDocument
        {
            DocumentType = "insurance_card_front",
            DocumentName = "insurance card front",
            BlobUrl = "",
            FileSizeBytes = 0,
            MimeType = null,
        };
        CcmsDocumentUploadValidator.IsCompleteFileDocument(doc).Should().BeFalse();
    }

    [Fact]
    public void IsCompleteFileDocument_accepts_http_blob_with_size_and_mime()
    {
        var doc = new CcmsDocument
        {
            DocumentType = "id_proof",
            DocumentName = "id.pdf",
            BlobUrl = "http://127.0.0.1:10000/devstoreaccount1/ccms-documents/cases/x/id.pdf",
            FileSizeBytes = 1024,
            MimeType = "application/pdf",
        };
        CcmsDocumentUploadValidator.IsCompleteFileDocument(doc).Should().BeTrue();
    }

    [Fact]
    public void EnsureCompleteFileDocument_throws_for_incomplete_row()
    {
        var doc = new CcmsDocument
        {
            DocumentType = "id_proof",
            DocumentName = "id.pdf",
            BlobUrl = "",
            FileSizeBytes = 0,
            MimeType = null,
        };
        var act = () => CcmsDocumentUploadValidator.EnsureCompleteFileDocument(doc);
        act.Should().Throw<InvalidOperationException>();
    }
}
