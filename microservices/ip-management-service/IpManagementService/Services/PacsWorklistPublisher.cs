using System.Net.Http.Json;
using System.Text.Json;
using IpManagementService.Models.Domain;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;

namespace IpManagementService.Services;

/// <summary>
/// Optional PACS/DICOM modality worklist fan-out. No-op when Pacs:WorklistEndpoint
/// is unset. Does not write PatientJourney; C-FIND attach lives on CCMS documents.
/// </summary>
public interface IPacsWorklistPublisher
{
    Task PublishAsync(IntegrationOutboxEvent evt, CancellationToken ct = default);
}

public sealed class PacsWorklistPublisher : IPacsWorklistPublisher
{
    private readonly HttpClient _http;
    private readonly IConfiguration _config;
    private readonly ILogger<PacsWorklistPublisher> _log;

    public PacsWorklistPublisher(HttpClient http, IConfiguration config, ILogger<PacsWorklistPublisher> log)
    {
        _http = http;
        _config = config;
        _log = log;
    }

    public async Task PublishAsync(IntegrationOutboxEvent evt, CancellationToken ct = default)
    {
        var endpoint = _config["Pacs:WorklistEndpoint"];
        if (string.IsNullOrWhiteSpace(endpoint))
            return;

        var action = evt.EventType switch
        {
            IntegrationEventTypes.JourneyAdmitted => "MWL_ADD",
            IntegrationEventTypes.BedTransferred => "MWL_UPDATE",
            IntegrationEventTypes.PatientClinicallyDischarged => "MWL_COMPLETE",
            _ => null,
        };
        if (action is null)
            return;

        using var resp = await _http.PostAsJsonAsync(endpoint, new
        {
            action,
            eventType = evt.EventType,
            journeyId = evt.AggregateId,
            tenantId = evt.TenantId,
            correlationId = evt.CorrelationId,
            idempotencyKey = evt.IdempotencyKey,
            occurredAt = evt.OccurredAt,
            payload = JsonSerializer.Deserialize<JsonElement>(
                string.IsNullOrWhiteSpace(evt.PayloadJson) ? "{}" : evt.PayloadJson),
        }, ct);
        if (!resp.IsSuccessStatusCode)
        {
            var body = await resp.Content.ReadAsStringAsync(ct);
            throw new InvalidOperationException(
                $"PACS worklist {action} failed HTTP {(int)resp.StatusCode}: {Trim(body)}");
        }
        _log.LogInformation("PACS {Action} published for {EventType} {JourneyId}",
            action, evt.EventType, evt.AggregateId);
    }

    private static string Trim(string value)
        => value.Length <= 400 ? value : value[..400];
}
