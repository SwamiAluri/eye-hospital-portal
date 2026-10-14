using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using Microsoft.Extensions.Logging;

namespace LaboratoryApi.Services;

public sealed record RegisterLmsOfficialPdfDocumentRequest(
    Guid TenantId,
    Guid PatientId,
    Guid UserId,
    Guid ArtifactId,
    string ContentBase64,
    string FileName,
    string MimeType,
    string ContentHash,
    long SizeBytes);

public sealed record RegisterLmsOfficialPdfDocumentResponse(
    Guid CanonicalDocumentId,
    bool Created,
    Guid AssociationId);

public sealed record OpenLmsOfficialPdfContentRequest(
    Guid TenantId,
    Guid ArtifactId,
    Guid? CanonicalDocumentId = null);

/// <summary>
/// Owned stream from AuthService LMS Official PDF content open.
/// Dispose after copying to the staff response.
/// </summary>
public sealed class LmsOfficialPdfContentStream : IAsyncDisposable
{
    private readonly HttpResponseMessage _response;

    public LmsOfficialPdfContentStream(
        HttpResponseMessage response,
        Stream content,
        string contentType,
        string? fileName,
        long? contentLength)
    {
        _response = response;
        Content = content;
        ContentType = contentType;
        FileName = fileName;
        ContentLength = contentLength;
    }

    public Stream Content { get; }
    public string ContentType { get; }
    public string? FileName { get; }
    public long? ContentLength { get; }

    public async ValueTask DisposeAsync()
    {
        await Content.DisposeAsync();
        _response.Dispose();
    }
}

public interface IPlatformCanonicalDocumentClient
{
    Task<RegisterLmsOfficialPdfDocumentResponse> RegisterOfficialPdfAsync(
        RegisterLmsOfficialPdfDocumentRequest request, CancellationToken ct = default);

    /// <summary>L-REP-03 CUT C — open private LMS Official PDF bytes (internal Auth stream).</summary>
    Task<LmsOfficialPdfContentStream> OpenOfficialPdfContentAsync(
        OpenLmsOfficialPdfContentRequest request, CancellationToken ct = default);
}

/// <summary>
/// AuthService internal LMS Official PDF CanonicalDocument registration + content open.
/// Uses enterprise_lms / LmsReportOfficialPdfArtifact — never Pathology association. No SAS.
/// </summary>
public sealed class PlatformCanonicalDocumentClient : IPlatformCanonicalDocumentClient
{
    private readonly IHttpClientFactory _httpClientFactory;
    private readonly ILogger<PlatformCanonicalDocumentClient> _log;

    private static readonly JsonSerializerOptions JsonOpts = new()
    {
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
        PropertyNameCaseInsensitive = true,
    };

    public PlatformCanonicalDocumentClient(
        IHttpClientFactory httpClientFactory,
        ILogger<PlatformCanonicalDocumentClient> log)
    {
        _httpClientFactory = httpClientFactory;
        _log = log;
    }

    public async Task<RegisterLmsOfficialPdfDocumentResponse> RegisterOfficialPdfAsync(
        RegisterLmsOfficialPdfDocumentRequest request, CancellationToken ct = default)
    {
        var client = _httpClientFactory.CreateClient("AuthService");
        using var httpRequest = new HttpRequestMessage(
            HttpMethod.Post, "api/internal/canonical-documents/register-lms-official-pdf")
        {
            Content = JsonContent.Create(request, options: JsonOpts),
        };
        httpRequest.Headers.TryAddWithoutValidation("X-Tenant-ID", request.TenantId.ToString("D"));

        using var response = await client.SendAsync(httpRequest, ct);
        var raw = await response.Content.ReadAsStringAsync(ct);

        if (response.StatusCode == HttpStatusCode.Unauthorized)
            throw new TestingDomainException(
                "Canonical document registration unauthorized.", statusCode: 503, code: "platform_auth_failed");
        if (response.StatusCode == HttpStatusCode.BadRequest)
            throw new TestingDomainException(
                ExtractError(raw) ?? "Canonical document registration rejected.",
                statusCode: 400, code: "canonical_registration_invalid");
        if (!response.IsSuccessStatusCode)
        {
            _log.LogError("LMS Official PDF canonical register failed {Status}: {Body}",
                (int)response.StatusCode, Truncate(raw));
            throw new TestingDomainException(
                "Canonical document registration unavailable.", statusCode: 503, code: "platform_unavailable");
        }

        var dto = JsonSerializer.Deserialize<RegisterLmsOfficialPdfDocumentResponse>(raw, JsonOpts);
        if (dto is null || dto.CanonicalDocumentId == Guid.Empty)
            throw new TestingDomainException(
                "Canonical document registration response invalid.", statusCode: 503, code: "platform_unavailable");
        return dto;
    }

    public async Task<LmsOfficialPdfContentStream> OpenOfficialPdfContentAsync(
        OpenLmsOfficialPdfContentRequest request, CancellationToken ct = default)
    {
        var client = _httpClientFactory.CreateClient("AuthService");
        using var httpRequest = new HttpRequestMessage(
            HttpMethod.Post, "api/internal/canonical-documents/lms-official-pdf/content")
        {
            Content = JsonContent.Create(request, options: JsonOpts),
        };
        httpRequest.Headers.TryAddWithoutValidation("X-Tenant-ID", request.TenantId.ToString("D"));

        var response = await client.SendAsync(httpRequest, HttpCompletionOption.ResponseHeadersRead, ct);
        if (response.StatusCode == HttpStatusCode.Unauthorized)
        {
            response.Dispose();
            throw new TestingDomainException(
                "Canonical document content unauthorized.", statusCode: 503, code: "platform_auth_failed");
        }

        if (response.StatusCode == HttpStatusCode.NotFound)
        {
            response.Dispose();
            throw new TestingDomainException(
                "Official PDF content is not available.", statusCode: 404, code: "not_found");
        }

        if (response.StatusCode == HttpStatusCode.BadRequest)
        {
            var raw = await response.Content.ReadAsStringAsync(ct);
            response.Dispose();
            throw new TestingDomainException(
                ExtractError(raw) ?? "Official PDF content request rejected.",
                statusCode: 400, code: "canonical_content_invalid");
        }

        if (!response.IsSuccessStatusCode)
        {
            var raw = await response.Content.ReadAsStringAsync(ct);
            _log.LogError("LMS Official PDF content open failed {Status}: {Body}",
                (int)response.StatusCode, Truncate(raw));
            response.Dispose();
            throw new TestingDomainException(
                "Official PDF content unavailable.", statusCode: 503, code: "platform_unavailable");
        }

        var stream = await response.Content.ReadAsStreamAsync(ct);
        var contentType = response.Content.Headers.ContentType?.MediaType;
        if (string.IsNullOrWhiteSpace(contentType))
            contentType = "application/pdf";
        var fileName = response.Content.Headers.ContentDisposition?.FileName?.Trim('"');
        long? length = response.Content.Headers.ContentLength;

        return new LmsOfficialPdfContentStream(response, stream, contentType, fileName, length);
    }

    private static string? ExtractError(string raw)
    {
        try
        {
            using var doc = JsonDocument.Parse(raw);
            if (doc.RootElement.TryGetProperty("error", out var e))
                return e.GetString();
        }
        catch { /* ignore */ }
        return null;
    }

    private static string Truncate(string? s) =>
        string.IsNullOrEmpty(s) ? string.Empty : s.Length <= 200 ? s : s[..200];
}
