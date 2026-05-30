using System.Net.Http.Headers;
using System.Text;
using System.Text.Json;
using CcmsApi.Data;
using CcmsApi.Models.Domain;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;

namespace CcmsApi.Services;

public class CommunicationDispatchService
{
    private readonly CcmsDbContext _db;
    private readonly CommunicationEngineService _comm;
    private readonly IHttpClientFactory _httpFactory;
    private readonly IConfiguration _config;
    private readonly ILogger<CommunicationDispatchService> _log;

    private static readonly JsonSerializerOptions NotifyJsonOpts = new()
    {
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
        DefaultIgnoreCondition = System.Text.Json.Serialization.JsonIgnoreCondition.WhenWritingNull,
    };

    public CommunicationDispatchService(
        CcmsDbContext db,
        CommunicationEngineService comm,
        IHttpClientFactory httpFactory,
        IConfiguration config,
        ILogger<CommunicationDispatchService> log)
    {
        _db = db;
        _comm = comm;
        _httpFactory = httpFactory;
        _config = config;
        _log = log;
    }

    private string NotificationBaseUrl =>
        _config["NotificationService__BaseUrl"]
        ?? _config["Values:NotificationService__BaseUrl"]
        ?? "http://localhost:7073";

    public async Task<SendCommunicationResult> SendAndLogAsync(
        Guid coverageCaseId,
        Guid actorUserId,
        SendCommunicationRequest req,
        CancellationToken ct = default)
    {
        var coverageCase = await _db.CoverageCases.AsNoTracking()
            .FirstOrDefaultAsync(c => c.Id == coverageCaseId && c.DeletedAt == null, ct)
            ?? throw new KeyNotFoundException($"Coverage case {coverageCaseId} not found.");

        var channel = req.Channel.Trim().ToLowerInvariant();
        var body = req.Body ?? "";
        var to = req.RecipientRef?.Trim() ?? "";

        bool success = true;
        string? messageId = null;
        string? error = null;

        var dispatchChannels = new HashSet<string> { "sms", "whatsapp", "email" };
        if (dispatchChannels.Contains(channel))
        {
            if (string.IsNullOrWhiteSpace(to))
            {
                success = false;
                error = "Recipient address is required for email/SMS dispatch.";
            }
            else
            {
            try
            {
                // Explicit camelCase JSON — notification service requires lowercase "channel" and "to".
                var payload = new Dictionary<string, string?>
                {
                    ["channel"] = channel,
                    ["to"] = to,
                    ["subject"] = req.Subject,
                    ["body"] = body,
                    ["tenantId"] = coverageCase.TenantId.ToString(),
                };
                var jsonBody = JsonSerializer.Serialize(payload, NotifyJsonOpts);
                _log.LogDebug("Notification dispatch payload for case {CaseId}: {Payload}", coverageCaseId, jsonBody);

                var notifyBase = NotificationBaseUrl.TrimEnd('/');
                using var client = _httpFactory.CreateClient();
                client.Timeout = TimeSpan.FromSeconds(30);

                using var content = new StringContent(jsonBody, Encoding.UTF8, "application/json");
                content.Headers.ContentType = new MediaTypeHeaderValue("application/json");

                using var msg = new HttpRequestMessage(HttpMethod.Post, $"{notifyBase}/api/notifications/dispatch")
                {
                    Content = content,
                };
                var internalKey = _config["NotificationService__InternalApiKey"]
                    ?? _config["Values:NotificationService__InternalApiKey"]
                    ?? _config["AuthService__InternalApiKey"]
                    ?? _config["Values:AuthService__InternalApiKey"];
                if (!string.IsNullOrWhiteSpace(internalKey))
                    msg.Headers.Add("X-Internal-Key", internalKey);

                var response = await client.SendAsync(msg, ct);
                var json = await response.Content.ReadAsStringAsync(ct);
                if (response.IsSuccessStatusCode)
                {
                    using var doc = JsonDocument.Parse(json);
                    success = doc.RootElement.TryGetProperty("success", out var s) && s.GetBoolean();
                    if (doc.RootElement.TryGetProperty("messageId", out var mid) && mid.ValueKind == JsonValueKind.String)
                        messageId = mid.GetString();
                    if (doc.RootElement.TryGetProperty("error", out var err) && err.ValueKind == JsonValueKind.String)
                        error = err.GetString();
                }
                else
                {
                    success = false;
                    var detail = string.IsNullOrWhiteSpace(json) ? null : json.Trim().Trim('"');
                    error = detail is { Length: > 0 }
                        ? $"Notification service returned {(int)response.StatusCode}: {detail}"
                        : $"Notification service returned {(int)response.StatusCode}";
                    _log.LogWarning(
                        "Notification dispatch failed for case {CaseId}: {Status} {Detail}",
                        coverageCaseId, (int)response.StatusCode, detail);
                }
            }
            catch (Exception ex)
            {
                _log.LogWarning(ex, "Notification dispatch failed for case {CaseId}", coverageCaseId);
                success = false;
                error = ex.Message;
            }
            }
        }

        var logBody = !success && !string.IsNullOrEmpty(error)
            ? $"{body}\n[Error: {error}]".Trim()
            : body;

        var log = await _comm.LogAsync(coverageCaseId, actorUserId, new LogCommunicationRequest(
            Channel: channel,
            Direction: req.Direction ?? "outbound",
            RecipientType: req.RecipientType,
            RecipientRef: req.RecipientRef,
            Subject: req.Subject,
            Body: logBody,
            TemplateCode: req.TemplateCode,
            DeliveryStatus: success ? "sent" : "failed",
            ExternalMessageId: messageId
        ), ct);

        return new SendCommunicationResult(log, success, messageId, error);
    }
}

public record SendCommunicationRequest(
    string  Channel,
    string  RecipientType,
    string? RecipientRef,
    string? Subject,
    string? Body,
    string? TemplateCode,
    string? Direction
);

public record SendCommunicationResult(
    CcmsCommunicationLog Log,
    bool Success,
    string? MessageId,
    string? Error
);
