using System.Net.Http.Json;
using System.Text.Json;
using Microsoft.Extensions.Logging;

namespace LaboratoryApi.Services;

public interface IPlatformAuditClient
{
    Task WriteAsync(
        Guid tenantId,
        Guid actorUserId,
        string action,
        string resourceType,
        Guid? resourceId,
        string? reason = null,
        string? details = null,
        string? oldValues = null,
        string? newValues = null,
        string? correlationId = null,
        CancellationToken ct = default);
}

/// <summary>
/// Writes to platform <c>audit_log</c> via AuthService internal API.
/// LaboratoryApi must never own a parallel audit table.
/// Sends <c>X-Internal-Key</c> (client default) + per-call <c>X-Tenant-ID</c>.
/// </summary>
public sealed class PlatformAuditClient : IPlatformAuditClient
{
    private readonly IHttpClientFactory _httpClientFactory;
    private readonly ILogger<PlatformAuditClient> _log;

    private static readonly JsonSerializerOptions JsonOpts = new()
    {
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
    };

    public PlatformAuditClient(IHttpClientFactory httpClientFactory, ILogger<PlatformAuditClient> log)
    {
        _httpClientFactory = httpClientFactory;
        _log = log;
    }

    public async Task WriteAsync(
        Guid tenantId,
        Guid actorUserId,
        string action,
        string resourceType,
        Guid? resourceId,
        string? reason = null,
        string? details = null,
        string? oldValues = null,
        string? newValues = null,
        string? correlationId = null,
        CancellationToken ct = default)
    {
        var client = _httpClientFactory.CreateClient("AuthService");
        var payload = new
        {
            tenantId,
            actorUserId,
            action,
            resourceType,
            resourceId,
            reason,
            details,
            oldValues,
            newValues,
            correlationId,
        };

        using var request = new HttpRequestMessage(HttpMethod.Post, "api/internal/audit")
        {
            Content = JsonContent.Create(payload, options: JsonOpts),
        };
        // AD-CAT-AUDIT: tenant asserted on the wire, not only in JSON body.
        request.Headers.TryAddWithoutValidation("X-Tenant-ID", tenantId.ToString("D"));

        using var response = await client.SendAsync(request, ct);
        if (!response.IsSuccessStatusCode)
        {
            var body = await response.Content.ReadAsStringAsync(ct);
            _log.LogError(
                "Platform audit write failed: {Status} {Body}",
                (int)response.StatusCode,
                Truncate(body));
            throw new CatalogueDomainException(
                "Catalogue mutation aborted: platform audit write failed.",
                statusCode: 503,
                code: "audit_unavailable");
        }
    }

    private static string Truncate(string? s) =>
        string.IsNullOrEmpty(s) ? string.Empty : s.Length <= 200 ? s : s[..200];
}
