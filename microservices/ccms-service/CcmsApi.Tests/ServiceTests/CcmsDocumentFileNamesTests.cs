using CcmsApi.Services;
using FluentAssertions;
using Microsoft.Net.Http.Headers;
using Xunit;

namespace CcmsApi.Tests.ServiceTests;

public class CcmsDocumentFileNamesTests
{
    [Theory]
    [InlineData("ef-diag.pdf", null, "id_proof", "ef-diag.pdf")]
    [InlineData("ef-diag.pdf", "", "id_proof", "ef-diag.pdf")]
    [InlineData("ef-diag.pdf", "   ", "id_proof", "ef-diag.pdf")]
    [InlineData(null, "override.pdf", "id_proof", "override.pdf")]
    [InlineData(null, null, "id_proof", "id proof")]
    [InlineData("", "", "policy_document", "policy document")]
    public void Resolve_never_returns_empty(
        string? multipart,
        string? explicitName,
        string documentType,
        string expected)
    {
        CcmsDocumentFileNames.Resolve(multipart, explicitName, documentType)
            .Should().Be(expected);
    }

    [Fact]
    public void Resolve_strips_path_from_multipart_filename()
    {
        CcmsDocumentFileNames.Resolve(@"C:\fakepath\card-front.pdf", null, "insurance_card_front")
            .Should().Be("card-front.pdf");
    }

    [Fact]
    public void FromContentDisposition_reads_filename_star()
    {
        var disposition = ContentDispositionHeaderValue.Parse(
            "form-data; name=\"file\"; filename*=UTF-8''referral-forensic.pdf");
        CcmsDocumentFileNames.FromContentDisposition(disposition)
            .Should().Be("referral-forensic.pdf");
    }
}
