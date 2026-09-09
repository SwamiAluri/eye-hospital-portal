using CcmsApi.Services;
using FluentAssertions;
using Xunit;

namespace CcmsApi.Tests.ServiceTests;

public class DocumentAccessUrlTests
{
    [Theory]
    [InlineData("biometry://record/aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee")]
    [InlineData("pacs://study/1.2.3.4.5")]
    public void IsPointerUrl_detects_pointer_schemes(string url)
    {
        DocumentEngineService.IsPointerUrl(url).Should().BeTrue();
    }

    [Fact]
    public void IsPointerUrl_rejects_http_blob_urls()
    {
        DocumentEngineService.IsPointerUrl("http://127.0.0.1:10000/devstoreaccount1/ccms-documents/cases/x/a.pdf")
            .Should().BeFalse();
    }

    [Fact]
    public void ExtractBlobName_parses_azurite_and_azure_paths()
    {
        const string azurite =
            "http://127.0.0.1:10000/devstoreaccount1/ccms-documents/cases/abc/20260830_test.pdf";
        const string azure =
            "https://acct.blob.core.windows.net/ccms-documents/cases/abc/20260830_test.pdf";

        DocumentEngineService.ExtractBlobName(azurite)
            .Should().Be("cases/abc/20260830_test.pdf");
        DocumentEngineService.ExtractBlobName(azure)
            .Should().Be("cases/abc/20260830_test.pdf");
    }

    [Fact]
    public void ExtractBlobName_decodes_percent_encoded_parentheses_in_filename()
    {
        const string encoded =
            "http://127.0.0.1:10000/devstoreaccount1/ccms-documents/cases/abc/20260901054942_Order Details %281%29.pdf";

        DocumentEngineService.ExtractBlobName(encoded)
            .Should().Be("cases/abc/20260901054942_Order Details (1).pdf");
    }

    [Fact]
    public void ExtractBlobName_preserves_literal_spaces_and_strips_sas_query()
    {
        const string withSpaces =
            "http://127.0.0.1:10000/devstoreaccount1/ccms-documents/cases/abc/20260901055001_WhatsApp Image 2026-06-09 at 9.34.15 AM.jpeg";
        const string withSas =
            withSpaces + "?sv=2020-10-02&sr=b&sp=r&sig=abc";

        DocumentEngineService.ExtractBlobName(withSpaces)
            .Should().Be("cases/abc/20260901055001_WhatsApp Image 2026-06-09 at 9.34.15 AM.jpeg");
        DocumentEngineService.ExtractBlobName(withSas)
            .Should().Be("cases/abc/20260901055001_WhatsApp Image 2026-06-09 at 9.34.15 AM.jpeg");
    }

    [Fact]
    public void ExtractBlobName_throws_for_unrecognized_url()
    {
        var act = () => DocumentEngineService.ExtractBlobName("https://example.com/other/file.pdf");
        act.Should().Throw<InvalidOperationException>();
    }
}
