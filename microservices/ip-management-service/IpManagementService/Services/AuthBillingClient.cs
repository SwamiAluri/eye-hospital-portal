using System.Net.Http.Json;
using System.Text.Json;
using Microsoft.Extensions.Logging;

namespace IpManagementService.Services;

public record AuthIpFinancialSummary(
    Guid? OpdBillId,
    string? BillNumber,
    decimal PackageEstimate,
    decimal BilledAmount,
    decimal DiscountTotal,
    decimal PatientResponsibility,
    decimal InsuranceResponsibility,
    decimal TotalCollected,
    decimal Advances,
    decimal RefundsAndReversals,
    decimal BalanceDue,
    string FinancialStatus,
    bool IsFinalized,
    bool HasPendingClaim,
    IReadOnlyList<string> FinancialBlockers,
            IReadOnlyList<AuthIpPaymentLine> Payments,
            decimal PatientPaid = 0,
            decimal PatientBalance = 0,
            decimal? CcmsPatientShare = null,
            bool CcmsPatientShareAvailable = false);

public record AuthIpPaymentLine(
    Guid Id,
    string? PaymentKind,
    decimal Amount,
    string? ReceiptNumber,
    DateTime PaymentDate,
    string? PaymentMode);

public interface IAuthBillingClient
{
    Task<Guid> EnsureBillAsync(Guid tenantId, Guid branchId, Guid patientId, Guid journeyId, decimal packageAmount, Guid actorUserId);
    Task<AuthIpFinancialSummary> GetSummaryAsync(Guid journeyId);
    Task RecordPaymentAsync(Guid opdBillId, Guid actorUserId, string kind, string paymentMode, decimal amount, string? reference, string? notes, string? idempotencyKey);
    Task ReversePaymentAsync(Guid opdBillId, Guid originalPaymentId, Guid actorUserId, string reason);
    Task ApplyCoverageAllocationAsync(Guid journeyId, decimal payerResponsibility, decimal patientResponsibility, Guid actorUserId);
    Task SoftDeleteBillsForJourneysAsync(IReadOnlyList<Guid> journeyIds, Guid actorUserId);
    Task<AuthChargeItemsResult> ChargeItemsAsync(
        Guid tenantId,
        Guid patientJourneyId,
        Guid actorUserId,
        string idempotencyKey,
        IReadOnlyList<AuthChargeItemLine> lines);

    Task EnqueueChargeExceptionAsync(
        Guid tenantId,
        Guid? patientJourneyId,
        Guid? itemId,
        Guid? sourceRefId,
        string sourceType,
        string reason,
        string idempotencyKey,
        decimal quantity,
        Guid? opdBillId = null,
        string? status = null);
}

public record AuthChargeItemLine(
    string SourceType,
    Guid? SourceRefId,
    Guid? ServiceVariantId,
    string? ServiceCode,
    decimal Quantity,
    string? Notes,
    Guid? ItemId = null,
    bool IsCredit = false);

public record AuthChargeItemsResult(Guid BillId, bool Replayed, int PostedCount = 0, int SuppressedCount = 0, int ExceptionCount = 0);

/// <summary>BILL-032. Distinct codes (BILL_FINALIZED, BILL_LOCKED, UNKNOWN_CATALOG_ITEM) so OT/inventory can queue.</summary>
public sealed class AuthChargePostingException : InvalidOperationException
{
    public AuthChargePostingException(string code, string message, Guid? billId)
        : base(message)
    {
        Code = code;
        BillId = billId;
    }

    public string Code { get; }
    public Guid? BillId { get; }

    public bool IsClosedBill =>
        Code is "BILL_FINALIZED" or "BILL_LOCKED" or "BILL_CANCELLED";
}

public sealed class NoOpAuthBillingClient : IAuthBillingClient
{
    public Task<Guid> EnsureBillAsync(Guid tenantId, Guid branchId, Guid patientId, Guid journeyId, decimal packageAmount, Guid actorUserId)
        => Task.FromResult(Guid.Empty);

    public Task<AuthIpFinancialSummary> GetSummaryAsync(Guid journeyId)
        => Task.FromResult(new AuthIpFinancialSummary(
            null, null, 0, 0, 0, 0, 0, 0, 0, 0, 0, "not_created", false, false,
            ["Billing service not configured."], []));

    public Task RecordPaymentAsync(Guid opdBillId, Guid actorUserId, string kind, string paymentMode, decimal amount, string? reference, string? notes, string? idempotencyKey)
        => throw new InvalidOperationException("Billing service is not configured. IP cannot record financial books locally.");

    public Task ReversePaymentAsync(Guid opdBillId, Guid originalPaymentId, Guid actorUserId, string reason)
        => Task.CompletedTask;

    public Task ApplyCoverageAllocationAsync(Guid journeyId, decimal payerResponsibility, decimal patientResponsibility, Guid actorUserId)
        => Task.CompletedTask;

    public Task SoftDeleteBillsForJourneysAsync(IReadOnlyList<Guid> journeyIds, Guid actorUserId)
        => Task.CompletedTask;

    public Task<AuthChargeItemsResult> ChargeItemsAsync(
        Guid tenantId,
        Guid patientJourneyId,
        Guid actorUserId,
        string idempotencyKey,
        IReadOnlyList<AuthChargeItemLine> lines)
        => throw new InvalidOperationException("Billing service is not configured. IP cannot post charges locally.");

    public Task EnqueueChargeExceptionAsync(
        Guid tenantId,
        Guid? patientJourneyId,
        Guid? itemId,
        Guid? sourceRefId,
        string sourceType,
        string reason,
        string idempotencyKey,
        decimal quantity,
        Guid? opdBillId = null,
        string? status = null)
        => throw new InvalidOperationException("Billing service is not configured. IP cannot queue charge exceptions locally.");
}

public sealed class AuthBillingClient : IAuthBillingClient
{
    private readonly HttpClient _http;
    private readonly ILogger<AuthBillingClient> _log;
    private static readonly JsonSerializerOptions Json = new() { PropertyNameCaseInsensitive = true };

    public AuthBillingClient(HttpClient http, ILogger<AuthBillingClient> log)
    {
        _http = http;
        _log = log;
    }

    public async Task<Guid> EnsureBillAsync(Guid tenantId, Guid branchId, Guid patientId, Guid journeyId, decimal packageAmount, Guid actorUserId)
    {
        var resp = await _http.PostAsJsonAsync("api/internal/ip-billing/ensure-bill", new
        {
            tenantId,
            branchId,
            patientId,
            patientJourneyId = journeyId,
            packageAmount,
            actorUserId,
        });
        var body = await resp.Content.ReadAsStringAsync();
        if (!resp.IsSuccessStatusCode)
            throw new InvalidOperationException($"Ensure IP bill failed ({(int)resp.StatusCode}): {body}");
        using var doc = JsonDocument.Parse(body);
        if (doc.RootElement.TryGetProperty("id", out var idEl) && Guid.TryParse(idEl.GetString(), out var id))
            return id;
        if (idEl.ValueKind == JsonValueKind.String) return Guid.Parse(idEl.GetString()!);
        return idEl.GetGuid();
    }

    public async Task<AuthIpFinancialSummary> GetSummaryAsync(Guid journeyId)
    {
        var resp = await _http.GetAsync($"api/internal/ip-billing/summary/{journeyId}");
        var body = await resp.Content.ReadAsStringAsync();
        if (!resp.IsSuccessStatusCode)
            throw new InvalidOperationException($"IP financial summary failed ({(int)resp.StatusCode}): {body}");
        return JsonSerializer.Deserialize<AuthIpFinancialSummary>(body, Json)
               ?? throw new InvalidOperationException("Empty financial summary.");
    }

    public async Task RecordPaymentAsync(
        Guid opdBillId, Guid actorUserId, string kind, string paymentMode, decimal amount,
        string? reference, string? notes, string? idempotencyKey)
    {
        var resp = await _http.PostAsJsonAsync($"api/internal/ip-billing/payment?actorUserId={actorUserId}", new
        {
            opdBillId,
            paymentMode,
            amount,
            notes,
            paymentKind = kind,
            idempotencyKey = idempotencyKey ?? reference,
        });
        if (!resp.IsSuccessStatusCode)
        {
            var body = await resp.Content.ReadAsStringAsync();
            throw new InvalidOperationException($"Billing payment failed ({(int)resp.StatusCode}): {body}");
        }
    }

    public async Task ReversePaymentAsync(Guid opdBillId, Guid originalPaymentId, Guid actorUserId, string reason)
    {
        var resp = await _http.PostAsJsonAsync($"api/internal/ip-billing/reverse?actorUserId={actorUserId}", new
        {
            opdBillId,
            originalPaymentId,
            reason,
        });
        if (!resp.IsSuccessStatusCode)
            throw new InvalidOperationException($"Billing reverse failed ({(int)resp.StatusCode}): {await resp.Content.ReadAsStringAsync()}");
    }

    public async Task ApplyCoverageAllocationAsync(
        Guid journeyId, decimal payerResponsibility, decimal patientResponsibility, Guid actorUserId)
    {
        var resp = await _http.PostAsJsonAsync("api/internal/ip-billing/apply-coverage-allocation", new
        {
            patientJourneyId = journeyId,
            payerResponsibility,
            patientResponsibility,
            actorUserId,
        });
        if (!resp.IsSuccessStatusCode)
            throw new InvalidOperationException($"Coverage allocation failed ({(int)resp.StatusCode}): {await resp.Content.ReadAsStringAsync()}");
    }

    public async Task SoftDeleteBillsForJourneysAsync(IReadOnlyList<Guid> journeyIds, Guid actorUserId)
    {
        var resp = await _http.PostAsJsonAsync($"api/internal/ip-billing/uat-soft-delete?actorUserId={actorUserId}", new
        {
            journeyIds,
        });
        if (!resp.IsSuccessStatusCode)
            _log.LogWarning("UAT bill cleanup failed: {Status} {Body}", (int)resp.StatusCode, await resp.Content.ReadAsStringAsync());
    }

    public async Task<AuthChargeItemsResult> ChargeItemsAsync(
        Guid tenantId,
        Guid patientJourneyId,
        Guid actorUserId,
        string idempotencyKey,
        IReadOnlyList<AuthChargeItemLine> lines)
    {
        var resp = await _http.PostAsJsonAsync("api/internal/ip-billing/charge-items", new
        {
            tenantId,
            patientJourneyId,
            actorUserId,
            idempotencyKey,
            lines = lines.Select(l => new
            {
                sourceType = l.SourceType,
                sourceRefId = l.SourceRefId,
                serviceVariantId = l.ServiceVariantId,
                serviceCode = l.ServiceCode,
                quantity = l.Quantity,
                notes = l.Notes,
                itemId = l.ItemId,
                isCredit = l.IsCredit,
            }),
        });
        var body = await resp.Content.ReadAsStringAsync();
        if ((int)resp.StatusCode is 409 or 404)
        {
            using var err = JsonDocument.Parse(string.IsNullOrWhiteSpace(body) ? "{}" : body);
            var root = err.RootElement;
            var code = root.TryGetProperty("code", out var codeEl) ? codeEl.GetString() ?? "CHARGE_POSTING_FAILED" : "CHARGE_POSTING_FAILED";
            var message = root.TryGetProperty("error", out var errorEl) ? errorEl.GetString() ?? body : body;
            Guid? billId = null;
            if (root.TryGetProperty("billId", out var billEl) && billEl.ValueKind != JsonValueKind.Null
                && Guid.TryParse(billEl.GetString() ?? billEl.ToString(), out var parsed))
                billId = parsed;
            throw new AuthChargePostingException(code, message, billId);
        }
        if (!resp.IsSuccessStatusCode)
            throw new InvalidOperationException($"Charge items failed ({(int)resp.StatusCode}): {body}");

        var parsedOk = JsonSerializer.Deserialize<ChargeItemsWireDto>(body, Json)
                       ?? throw new InvalidOperationException("Empty charge-items response.");
        return new AuthChargeItemsResult(
            parsedOk.BillId,
            parsedOk.Replayed,
            parsedOk.Items?.Count ?? 0,
            parsedOk.SuppressedCount,
            parsedOk.ExceptionCount);
    }

    public async Task EnqueueChargeExceptionAsync(
        Guid tenantId,
        Guid? patientJourneyId,
        Guid? itemId,
        Guid? sourceRefId,
        string sourceType,
        string reason,
        string idempotencyKey,
        decimal quantity,
        Guid? opdBillId = null,
        string? status = null)
    {
        var resp = await _http.PostAsJsonAsync("api/internal/ip-billing/charge-exception", new
        {
            tenantId,
            patientJourneyId,
            itemId,
            sourceRefId,
            opdBillId,
            sourceType,
            reason,
            idempotencyKey,
            quantity,
            status,
        });
        if (!resp.IsSuccessStatusCode)
            throw new InvalidOperationException(
                $"Charge exception enqueue failed ({(int)resp.StatusCode}): {await resp.Content.ReadAsStringAsync()}");
    }

    private sealed class ChargeItemsWireDto
    {
        public Guid BillId { get; set; }
        public bool Replayed { get; set; }
        public List<ChargeItemWireItem>? Items { get; set; }
        public int SuppressedCount { get; set; }
        public int ExceptionCount { get; set; }
    }

    private sealed class ChargeItemWireItem
    {
        public Guid Id { get; set; }
    }
}
