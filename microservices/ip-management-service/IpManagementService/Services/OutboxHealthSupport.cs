using System.Text.Json;
using System.Text.Json.Nodes;
using IpManagementService.Models.Domain;

namespace IpManagementService.Services;

public record OutboxTypeStats(string EventType, int Pending, int Retrying, int Dead);

public record OutboxStats(
    int Pending,
    int Failed,
    int Dead,
    int Processed,
    int Processing,
    int Published24h = 0,
    DateTime? OldestPendingAt = null,
    IReadOnlyList<OutboxTypeStats>? ByType = null);

public record OutboxDeadLetterDto(
    Guid Id,
    string Source,
    string EventType,
    Guid AggregateId,
    string AggregateType,
    Guid? CorrelationId,
    string IdempotencyKey,
    DateTime OccurredAt,
    DateTime? LastAttemptAt,
    int RetryCount,
    string? Error,
    string Status,
    string Subject,
    bool MappingRequired,
    bool IsFinancial);

public record OutboxEventDetailDto(
    Guid Id,
    string Source,
    string EventType,
    Guid AggregateId,
    string AggregateType,
    Guid? CorrelationId,
    string IdempotencyKey,
    DateTime OccurredAt,
    DateTime? LastAttemptAt,
    DateTime? ProcessedAt,
    int RetryCount,
    string? Error,
    string Status,
    string Subject,
    bool MappingRequired,
    bool IsFinancial,
    string MaskedPayloadJson,
    string? AbandonReason,
    string? CompensatingAction);

public record OutboxRequeueRequest(List<Guid>? EventIds, string? EventType);

public record OutboxAbandonRequest(Guid EventId, string Reason, string? CompensatingAction);

public static class OutboxHealthSupport
{
    public const string SourceIp = "IP";
    public const string PermIntegrationAdmin = "integration.admin";

    private static readonly HashSet<string> SensitiveKeys = new(StringComparer.OrdinalIgnoreCase)
    {
        "patientName", "firstName", "lastName", "fullName", "givenName", "familyName",
        "phone", "phoneNumber", "mobile", "contactNumber", "contact",
        "email", "aadhaar", "aadhar", "dob", "dateOfBirth", "address",
        "mrn", "uhid",
    };

    public static bool IsFinancial(string eventType) => eventType is
        IntegrationEventTypes.BillFinalized
        or IntegrationEventTypes.PaymentReceived
        or IntegrationEventTypes.PaymentReversed
        or IntegrationEventTypes.PatientObligationChanged
        or IntegrationEventTypes.ImplantUsed
        or IntegrationEventTypes.ImplantUsageReversed
        or IntegrationEventTypes.ConsumablesConsumed
        or IntegrationEventTypes.ConsumablesReturned;

    public static bool IsConsumableCharge(string eventType) => eventType is
        IntegrationEventTypes.ConsumablesConsumed
        or IntegrationEventTypes.ConsumablesReturned;

    public static bool NeedsChargeMapping(string eventType, string? error)
    {
        if (eventType is not (IntegrationEventTypes.ImplantUsed
            or IntegrationEventTypes.ImplantUsageReversed
            or IntegrationEventTypes.ConsumablesConsumed
            or IntegrationEventTypes.ConsumablesReturned))
            return false;
        if (string.IsNullOrWhiteSpace(error)) return false;
        return error.Contains("billable variant", StringComparison.OrdinalIgnoreCase)
               || error.Contains("unmapped", StringComparison.OrdinalIgnoreCase)
               || error.Contains("no mapped", StringComparison.OrdinalIgnoreCase);
    }

    public static string MaskPayload(string? payloadJson)
    {
        try
        {
            var node = JsonNode.Parse(string.IsNullOrWhiteSpace(payloadJson) ? "{}" : payloadJson);
            MaskWalk(node);
            return node?.ToJsonString() ?? "{}";
        }
        catch
        {
            return "{}";
        }
    }

    public static string SubjectFromPayload(string? payloadJson, Guid aggregateId)
    {
        try
        {
            using var doc = JsonDocument.Parse(string.IsNullOrWhiteSpace(payloadJson) ? "{}" : payloadJson);
            var root = doc.RootElement;
            foreach (var key in new[] { "billNumber", "receiptNumber", "serialNumber", "itemCode" })
            {
                if (root.ValueKind == JsonValueKind.Object
                    && root.TryGetProperty(key, out var v)
                    && v.ValueKind == JsonValueKind.String)
                {
                    var s = v.GetString();
                    if (!string.IsNullOrWhiteSpace(s)) return s!;
                }
            }
        }
        catch
        {
            // fall through
        }

        var hex = aggregateId.ToString("N");
        return hex.Length >= 8 ? hex[..8] : hex;
    }

    private static void MaskWalk(JsonNode? node)
    {
        if (node is JsonObject obj)
        {
            foreach (var key in obj.Select(kv => kv.Key).ToList())
            {
                if (SensitiveKeys.Contains(key))
                    obj[key] = "***";
                else
                    MaskWalk(obj[key]);
            }
        }
        else if (node is JsonArray arr)
        {
            foreach (var item in arr)
                MaskWalk(item);
        }
    }
}
