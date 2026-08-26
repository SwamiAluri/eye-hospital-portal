using System.Net.Http.Json;
using System.Text.Json;
using IpManagementService.Models.Domain;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;

namespace IpManagementService.Services;

/// <summary>
/// Optional outbound ADT (A01 admit / A02 transfer / A03 discharge).
/// No-op when Hl7:AdtEndpoint is unset. Does not write PatientJourney.
/// </summary>
public interface IHl7AdtPublisher
{
    Task PublishAsync(IntegrationOutboxEvent evt, CancellationToken ct = default);
}

public sealed class Hl7AdtPublisher : IHl7AdtPublisher
{
    private readonly HttpClient _http;
    private readonly IConfiguration _config;
    private readonly ILogger<Hl7AdtPublisher> _log;

    public Hl7AdtPublisher(HttpClient http, IConfiguration config, ILogger<Hl7AdtPublisher> log)
    {
        _http = http;
        _config = config;
        _log = log;
    }

    public async Task PublishAsync(IntegrationOutboxEvent evt, CancellationToken ct = default)
    {
        var endpoint = _config["Hl7:AdtEndpoint"];
        if (string.IsNullOrWhiteSpace(endpoint))
            return;

        var messageType = evt.EventType switch
        {
            IntegrationEventTypes.JourneyAdmitted => "ADT^A01",
            IntegrationEventTypes.BedTransferred => "ADT^A02",
            IntegrationEventTypes.PatientClinicallyDischarged => "ADT^A03",
            _ => null,
        };
        if (messageType is null)
            return;

        using var resp = await _http.PostAsJsonAsync(endpoint, new
        {
            messageType,
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
                $"HL7 ADT {messageType} failed HTTP {(int)resp.StatusCode}: {Trim(body)}");
        }
        _log.LogInformation("HL7 {MessageType} published for {EventType} {JourneyId}",
            messageType, evt.EventType, evt.AggregateId);
    }

    private static string Trim(string value)
        => value.Length <= 400 ? value : value[..400];
}
