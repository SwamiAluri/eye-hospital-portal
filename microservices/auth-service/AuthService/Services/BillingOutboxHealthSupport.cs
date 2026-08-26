using System.Text.Json;
using System.Text.Json.Nodes;
using AuthService.Models.Domain;

namespace AuthService.Services;

public record BillingOutboxTypeStats(string EventType, int Pending, int Retrying, int Dead);

public record BillingOutboxStats(
    int Pending,
    int Failed,
    int Dead,
    int Processed,
    int Processing,
    int Published24h,
    DateTime? OldestPendingAt,
    IReadOnlyList<BillingOutboxTypeStats> ByType);

public record BillingOutboxDeadLetterDto(
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

public record BillingOutboxEventDetailDto(
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

public record BillingOutboxRequeueRequest(List<Guid>? EventIds, string? EventType);

public record BillingOutboxAbandonRequest(Guid EventId, string Reason, string? CompensatingAction);

public static class BillingOutboxHealthSupport
{
    public const string SourceBilling = "Billing";
    public const string PermIntegrationAdmin = "integration.admin";

    private static readonly HashSet<string> SensitiveKeys = new(StringComparer.OrdinalIgnoreCase)
    {
        "patientName", "firstName", "lastName", "fullName", "givenName", "familyName",
        "phone", "phoneNumber", "mobile", "contactNumber", "contact",
        "email", "aadhaar", "aadhar", "dob", "dateOfBirth", "address",
        "mrn", "uhid",
    };

    public static bool IsFinancial(string eventType) => eventType is
        BillingCcmsEventTypes.BillFinalized
        or BillingCcmsEventTypes.PaymentReceived
        or BillingCcmsEventTypes.PaymentReversed
        or BillingCcmsEventTypes.PatientObligationChanged;

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
