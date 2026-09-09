using System.Net;
using System.Text;
using System.Text.Json;
using Azure.Storage.Blobs;
using CcmsApi.Data;
using CcmsApi.Functions;
using CcmsApi.Models.Domain;
using CcmsApi.Services;
using CcmsApi.Tests.Fixtures;
using CcmsApi.Tests.Helpers;
using FluentAssertions;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging.Abstractions;
using Xunit;
using static CcmsApi.Tests.Helpers.FunctionHttpTestDoubles;

namespace CcmsApi.Tests.ServiceTests;

/// <summary>
/// COV-002 regression: blob_url from Uri.ToString() percent-encodes parentheses while Azurite
/// stores the literal key. Retrieval must decode before GetBlobClient lookup.
/// </summary>
public sealed class Cov002PercentEncodedBlobRegressionTests : IDisposable
{
    private const string FileName = "Order Details (1).pdf";
    private static readonly byte[] MinimalPdf = "%PDF-1.4\n%EOF\n"u8.ToArray();

    private readonly InMemoryDbFixture _fix = new();

    private static IConfiguration CreateConfig() =>
        new ConfigurationBuilder()
            .AddInMemoryCollection(new Dictionary<string, string?>
            {
                ["AzureWebJobsStorage"] = "UseDevelopmentStorage=true",
                ["Jwt__Key"] = "your-secret-key-min-32-characters-change-this",
                ["Jwt__Issuer"] = "EyeHospitalAuth",
                ["Jwt__Audience"] = "EyeHospitalAPI",
            })
            .Build();

    private DocumentEngineService CreateService() =>
        new(_fix.Db, CreateConfig(), NullLogger<DocumentEngineService>.Instance);

    private DocumentFunctions CreateFunctions(DocumentEngineService svc)
    {
        var tenantCtx = new TenantContext();
        var jwt = new JwtService(CreateConfig(), tenantCtx);
        return new DocumentFunctions(svc, jwt);
    }

    private static async Task<bool> IsAzuriteAvailableAsync()
    {
        try
        {
            var client = CcmsBlobClients.CreateServiceClient("UseDevelopmentStorage=true");
            var container = client.GetBlobContainerClient("ccms-documents");
            await container.CreateIfNotExistsAsync();
            return true;
        }
        catch
        {
            return false;
        }
    }

    [Fact]
    public async Task Upload_percent_encoded_parentheses_pdf_round_trips_content_and_access_url()
    {
        if (!await IsAzuriteAvailableAsync())
            return;

        var coverageCase = _fix.SeedCase();
        var svc = CreateService();

        await using var uploadStream = new MemoryStream(MinimalPdf);
        var uploaded = await svc.UploadFileAsync(
            coverageCase.Id,
            _fix.ActorId,
            uploadStream,
            FileName,
            "application/pdf",
            "doctor_referral",
            "preauth");

        uploaded.BlobUrl.Should().NotBeNullOrWhiteSpace();
        uploaded.BlobUrl.Should().Contain("%281%29", "Uri.ToString() encodes parentheses in persisted blob_url");

        var decodedBlobName = DocumentEngineService.ExtractBlobName(uploaded.BlobUrl!);
        decodedBlobName.Should().Contain("Order Details (1).pdf");
        decodedBlobName.Should().NotContain("%281%29");

        var container = CcmsBlobClients
            .CreateServiceClient("UseDevelopmentStorage=true")
            .GetBlobContainerClient("ccms-documents");

        (await container.GetBlobClient(decodedBlobName).ExistsAsync()).Value.Should().BeTrue(
            "blob must exist under the literal filename with parentheses");

        var marker = "/ccms-documents/";
        var rawEncodedPath = uploaded.BlobUrl![(uploaded.BlobUrl!.IndexOf(marker, StringComparison.OrdinalIgnoreCase) + marker.Length)..];
        var encodedBlobName = rawEncodedPath.Contains('?')
            ? rawEncodedPath[..rawEncodedPath.IndexOf('?', StringComparison.Ordinal)]
            : rawEncodedPath;
        (await container.GetBlobClient(encodedBlobName).ExistsAsync()).Value.Should().BeFalse(
            "lookup using the encoded blob key must not find the object");

        var blobContent = await svc.OpenBlobReadStreamAsync(uploaded.Id, coverageCase.Id);
        blobContent.ContentType.Should().Be("application/pdf");
        using var reader = new BinaryReader(blobContent.Stream, Encoding.UTF8, leaveOpen: false);
        var header = reader.ReadBytes(4);
        header.Should().Equal(new byte[] { 0x25, 0x50, 0x44, 0x46 });

        var access = await svc.GetReadAccessUrlAsync(uploaded.Id, coverageCase.Id);
        access.Url.Should().NotBeNullOrWhiteSpace();
        access.IsPointer.Should().BeFalse();

        var token = TestJwtFactory.CreateBearerToken(_fix.ActorId, _fix.TenantId, CreateConfig());
        var context = CreateContext();
        var request = CreateGetRequest(
            context,
            $"http://localhost/api/ccms/documents/{uploaded.Id}/content?coverageCaseId={coverageCase.Id}",
            new Dictionary<string, string>
            {
                ["Authorization"] = $"Bearer {token}",
                ["X-Tenant-ID"] = _fix.TenantId.ToString(),
            });

        var functions = CreateFunctions(svc);
        var httpResponse = await functions.GetDocumentContent(request, uploaded.Id);

        httpResponse.StatusCode.Should().Be(HttpStatusCode.OK);
        httpResponse.Headers.TryGetValues("Content-Type", out var contentTypes).Should().BeTrue();
        contentTypes!.First().Should().Be("application/pdf");

        httpResponse.Body.Position = 0;
        var bodyHeader = new byte[4];
        _ = await httpResponse.Body.ReadAsync(bodyHeader);
        bodyHeader.Should().Equal(new byte[] { 0x25, 0x50, 0x44, 0x46 });
    }

    [Fact]
    public async Task GetDocumentContent_returns_404_for_genuinely_missing_blob()
    {
        if (!await IsAzuriteAvailableAsync())
            return;

        var coverageCase = _fix.SeedCase();
        var svc = CreateService();
        var missingBlobUrl =
            $"http://127.0.0.1:10000/devstoreaccount1/ccms-documents/cases/{coverageCase.Id}/missing-{Guid.NewGuid():N}.pdf";

        var doc = await svc.UploadAsync(
            coverageCase.Id,
            _fix.ActorId,
            new UploadDocumentRequest(
                "preauth",
                "doctor_referral",
                FileName,
                missingBlobUrl,
                MinimalPdf.Length,
                "application/pdf"));

        var token = TestJwtFactory.CreateBearerToken(_fix.ActorId, _fix.TenantId, CreateConfig());
        var context = CreateContext();
        var request = CreateGetRequest(
            context,
            $"http://localhost/api/ccms/documents/{doc.Id}/content?coverageCaseId={coverageCase.Id}",
            new Dictionary<string, string>
            {
                ["Authorization"] = $"Bearer {token}",
                ["X-Tenant-ID"] = _fix.TenantId.ToString(),
            });

        var functions = CreateFunctions(svc);
        var httpResponse = await functions.GetDocumentContent(request, doc.Id);

        httpResponse.StatusCode.Should().Be(HttpStatusCode.NotFound);
        httpResponse.StatusCode.Should().NotBe(HttpStatusCode.OK);

        httpResponse.Body.Position = 0;
        using var sr = new StreamReader(httpResponse.Body, Encoding.UTF8);
        var body = await sr.ReadToEndAsync();
        body.Should().Contain("Document file is not available in storage");

        using var json = JsonDocument.Parse(body);
        json.RootElement.GetProperty("error").GetString().Should().Contain("Document file is not available in storage");
    }

    public void Dispose() => _fix.Dispose();
}
