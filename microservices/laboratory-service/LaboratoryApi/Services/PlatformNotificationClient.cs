using System.Net.Http.Json;
using System.Text.Json;
using Microsoft.Extensions.Logging;

namespace LaboratoryApi.Services;

public interface IPlatformNotificationClient
{
    /// <summary>
    /// Emits an in-app tenant notification intent via AuthService internal API.
    /// Does not acknowledge Critical events. Does not send SMS/email.
    /// </summary>
    Task EmitTenantIntentAsync(
        Guid tenantId,
        string type,
        string message,
        string details,
        CancellationToken ct = default);
}

/// <summary>
/// L-CRT-01 — Lab emits notification intents; platform delivers (PD-CRT-09 / AD-CRT-03).
/// </summary>
public sealed class PlatformNotificationClient : IPlatformNotificationClient
{
    public const string CriticalResultIntentType = "lab.result.critical";

    private readonly IHttpClientFactory _httpClientFactory;
    private readonly ILogger<PlatformNotificationClient> _log;

    private static readonly JsonSerializerOptions JsonOpts = new()
    {
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
    };

    public PlatformNotificationClient(
        IHttpClientFactory httpClientFactory,
        ILogger<PlatformNotificationClient> log)
    {
        _httpClientFactory = httpClientFactory;
        _log = log;
    }

    public async Task EmitTenantIntentAsync(
        Guid tenantId,
        string type,
        string message,
        string details,
        CancellationToken ct = default)
    {
        var client = _httpClientFactory.CreateClient("AuthService");
        var payload = new
        {
            tenantId,
            type,
            message,
            details,
        };

        using var request = new HttpRequestMessage(HttpMethod.Post, "api/notifications/internal/push-tenant")
        {
            Content = JsonContent.Create(payload, options: JsonOpts),
        };
        request.Headers.TryAddWithoutValidation("X-Tenant-ID", tenantId.ToString("D"));

        using var response = await client.SendAsync(request, ct);
        if (!response.IsSuccessStatusCode)
        {
            var body = await response.Content.ReadAsStringAsync(ct);
            _log.LogWarning(
                "Critical notification intent failed: status={Status} body={Body}",
                (int)response.StatusCode,
                body.Length > 200 ? body[..200] : body);
            throw new TestingDomainException(
                "Notification infrastructure unavailable.",
                statusCode: 503,
                code: "notification_unavailable");
        }
    }
}
