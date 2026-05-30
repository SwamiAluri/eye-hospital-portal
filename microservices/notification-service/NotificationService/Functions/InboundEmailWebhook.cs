using System.Net;
using System.Text;
using System.Text.Json;
using Microsoft.Azure.Functions.Worker;
using Microsoft.Azure.Functions.Worker.Http;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;

namespace NotificationService.Functions;

/// <summary>
/// Receives inbound email webhooks (Azure Event Grid, manual test, or ACS adapter)
/// and forwards to CCMS for logging + parse draft.
/// </summary>
public class InboundEmailWebhook
{
    private readonly ILogger<InboundEmailWebhook> _logger;
    private readonly IConfiguration _config;
    private readonly IHttpClientFactory _httpFactory;

    public InboundEmailWebhook(
        ILogger<InboundEmailWebhook> logger,
        IConfiguration config,
        IHttpClientFactory httpFactory)
    {
        _logger = logger;
        _config = config;
        _httpFactory = httpFactory;
    }

    [Function("InboundEmailWebhook")]
    public async Task<HttpResponseData> Run(
        [HttpTrigger(AuthorizationLevel.Anonymous, "post", Route = "notifications/inbound-email")] HttpRequestData req)
    {
        var expectedKey = _config["InternalApiKey"] ?? _config["AuthService__InternalApiKey"] ?? "";
        if (!string.IsNullOrEmpty(expectedKey))
        {
            req.Headers.TryGetValues("X-Internal-Key", out var keys);
            if (!string.Equals(keys?.FirstOrDefault(), expectedKey, StringComparison.Ordinal))
            {
                var unauthorized = req.CreateResponse(HttpStatusCode.Unauthorized);
                await unauthorized.WriteStringAsync("Invalid internal key.");
                return unauthorized;
            }
        }

        InboundEmailPayload? body;
        try
        {
            body = await JsonSerializer.DeserializeAsync<InboundEmailPayload>(
                req.Body, new JsonSerializerOptions { PropertyNameCaseInsensitive = true });
        }
        catch
        {
            return req.CreateResponse(HttpStatusCode.BadRequest);
        }

        if (body is null || string.IsNullOrWhiteSpace(body.Body))
        {
            var bad = req.CreateResponse(HttpStatusCode.BadRequest);
            await bad.WriteStringAsync("body is required.");
            return bad;
        }

        var ccmsBase = _config["CcmsService__BaseUrl"]
            ?? _config["Values:CcmsService__BaseUrl"]
            ?? "http://localhost:7075";

        using var client = _httpFactory.CreateClient();
        using var msg = new HttpRequestMessage(
            HttpMethod.Post,
            $"{ccmsBase.TrimEnd('/')}/api/ccms/integration/tpa-inbound-email")
        {
            Content = new StringContent(
                JsonSerializer.Serialize(new
                {
                    fromAddress = body.From,
                    subject = body.Subject,
                    body = body.Body,
                    externalMessageId = body.MessageId,
                    inReplyToMessageId = body.InReplyTo,
                    coverageCaseId = body.CoverageCaseId,
                    receivedAt = body.ReceivedAt ?? DateTime.UtcNow,
                }),
                Encoding.UTF8,
                "application/json"),
        };

        if (!string.IsNullOrWhiteSpace(expectedKey))
            msg.Headers.Add("X-Internal-Key", expectedKey);

        var ccmsResp = await client.SendAsync(msg);
        var ccmsJson = await ccmsResp.Content.ReadAsStringAsync();

        var resp = req.CreateResponse(
            ccmsResp.IsSuccessStatusCode ? HttpStatusCode.Created : ccmsResp.StatusCode);
        resp.Headers.Add("Content-Type", "application/json");
        await resp.WriteStringAsync(ccmsJson);
        return resp;
    }

    private sealed class InboundEmailPayload
    {
        public string? From { get; set; }
        public string? Subject { get; set; }
        public string? Body { get; set; }
        public string? MessageId { get; set; }
        public string? InReplyTo { get; set; }
        public Guid? CoverageCaseId { get; set; }
        public DateTime? ReceivedAt { get; set; }
    }
}
