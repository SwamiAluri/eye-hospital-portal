using System.Net;
using System.Text.Json;
using System.Text.Json.Serialization;
using Microsoft.Azure.Functions.Worker;
using Microsoft.Azure.Functions.Worker.Http;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;
using NotificationService.Services.Email;
using NotificationService.Services.Sms;

namespace NotificationService.Functions;

public class DispatchNotification
{
    private readonly ILogger<DispatchNotification> _logger;
    private readonly ISmsService _sms;
    private readonly IEmailService _email;
    private readonly IConfiguration _config;

    public DispatchNotification(
        ILogger<DispatchNotification> logger,
        ISmsService sms,
        IEmailService email,
        IConfiguration config)
    {
        _logger = logger;
        _sms = sms;
        _email = email;
        _config = config;
    }

    [Function("DispatchNotification")]
    public async Task<HttpResponseData> Run(
        [HttpTrigger(AuthorizationLevel.Anonymous, "post", Route = "notifications/dispatch")] HttpRequestData req)
    {
        var expectedKey = _config["InternalApiKey"] ?? _config["AuthService__InternalApiKey"] ?? "";
        if (!string.IsNullOrEmpty(expectedKey))
        {
            req.Headers.TryGetValues("X-Internal-Key", out var keys);
            var provided = keys?.FirstOrDefault();
            if (!string.Equals(provided, expectedKey, StringComparison.Ordinal))
            {
                var unauthorized = req.CreateResponse(HttpStatusCode.Unauthorized);
                await unauthorized.WriteStringAsync("Invalid internal key.");
                return unauthorized;
            }
        }

        DispatchRequest? body;
        try
        {
            body = await JsonSerializer.DeserializeAsync<DispatchRequest>(req.Body, new JsonSerializerOptions
            {
                PropertyNameCaseInsensitive = true,
            });
        }
        catch
        {
            return req.CreateResponse(HttpStatusCode.BadRequest);
        }

        if (body is null || string.IsNullOrWhiteSpace(body.Channel) || string.IsNullOrWhiteSpace(body.To))
        {
            var bad = req.CreateResponse(HttpStatusCode.BadRequest);
            await bad.WriteStringAsync("channel and to are required.");
            return bad;
        }

        var channel = body.Channel.Trim().ToLowerInvariant();
        bool success;
        string? messageId;
        string? error;

        switch (channel)
        {
            case "sms":
            case "whatsapp":
                (success, messageId, error) = await _sms.SendTextAsync(body.To, body.Body ?? "");
                break;
            case "email":
                (success, messageId, error) = await _email.SendGenericEmailAsync(
                    body.To,
                    body.Subject ?? "Hospital Portal — Coverage & Claims",
                    $"<p>{System.Net.WebUtility.HtmlEncode(body.Body ?? "")}</p>",
                    body.Body);
                break;
            case "portal":
            case "phone":
            case "in_person":
                success = true;
                messageId = "logged-only";
                error = null;
                break;
            default:
                var unk = req.CreateResponse(HttpStatusCode.BadRequest);
                await unk.WriteStringAsync($"Unsupported channel: {body.Channel}");
                return unk;
        }

        var resp = req.CreateResponse(success ? HttpStatusCode.OK : HttpStatusCode.BadGateway);
        await resp.WriteAsJsonAsync(new { success, messageId, error });
        return resp;
    }

    private sealed class DispatchRequest
    {
        [JsonPropertyName("channel")]
        public string Channel { get; set; } = "";

        [JsonPropertyName("to")]
        public string To { get; set; } = "";

        [JsonPropertyName("subject")]
        public string? Subject { get; set; }

        [JsonPropertyName("body")]
        public string? Body { get; set; }

        [JsonPropertyName("tenantId")]
        public string? TenantId { get; set; }
    }
}
