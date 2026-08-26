using System.Net.Http.Json;
using System.Text.Json;
using Microsoft.Extensions.Logging;

namespace IpManagementService.Services;

public record InventoryImplantApplyResult(Guid? LedgerId, bool Replayed, bool Unmapped);

public interface IInventoryImplantClient
{
    Task<InventoryImplantApplyResult> ApplyAsync(
        Guid tenantId,
        Guid actorUserId,
        Guid implantUsageId,
        Guid journeyId,
        Guid? itemId,
        string? catalogRef,
        string? brand,
        string? model,
        string? serialNumber,
        string? batchNumber,
        string? udiBarcode,
        string usageStatus,
        string? wastageReason,
        string? patientName,
        string? patientIpNo,
        CancellationToken ct = default);
}

public sealed class NoOpInventoryImplantClient : IInventoryImplantClient
{
    public Task<InventoryImplantApplyResult> ApplyAsync(
        Guid tenantId, Guid actorUserId, Guid implantUsageId, Guid journeyId,
        Guid? itemId, string? catalogRef, string? brand, string? model,
        string? serialNumber, string? batchNumber, string? udiBarcode,
        string usageStatus, string? wastageReason, string? patientName, string? patientIpNo,
        CancellationToken ct = default)
        => Task.FromResult(new InventoryImplantApplyResult(null, false, true));
}

public sealed class InventoryImplantClient : IInventoryImplantClient
{
    private readonly HttpClient _http;
    private readonly ILogger<InventoryImplantClient> _log;
    private static readonly JsonSerializerOptions Json = new() { PropertyNameCaseInsensitive = true };

    public InventoryImplantClient(HttpClient http, ILogger<InventoryImplantClient> log)
    {
        _http = http;
        _log = log;
    }

    public async Task<InventoryImplantApplyResult> ApplyAsync(
        Guid tenantId,
        Guid actorUserId,
        Guid implantUsageId,
        Guid journeyId,
        Guid? itemId,
        string? catalogRef,
        string? brand,
        string? model,
        string? serialNumber,
        string? batchNumber,
        string? udiBarcode,
        string usageStatus,
        string? wastageReason,
        string? patientName,
        string? patientIpNo,
        CancellationToken ct = default)
    {
        using var req = new HttpRequestMessage(HttpMethod.Post, "internal/implants/apply")
        {
            Content = JsonContent.Create(new
            {
                implantUsageId,
                journeyId,
                itemId,
                catalogRef,
                brand,
                model,
                serialNumber,
                batchNumber,
                udiBarcode,
                usageStatus,
                wastageReason,
                actorUserId,
                patientName,
                patientIpNo,
            }),
        };
        req.Headers.TryAddWithoutValidation("X-Tenant-Id", tenantId.ToString("D"));
        req.Headers.TryAddWithoutValidation("X-User-Id", actorUserId.ToString("D"));

        HttpResponseMessage resp;
        try
        {
            resp = await _http.SendAsync(req, ct);
        }
        catch (HttpRequestException ex)
        {
            throw new InventoryUnavailableException(ex.Message, ex);
        }
        catch (TaskCanceledException ex) when (!ct.IsCancellationRequested)
        {
            throw new InventoryUnavailableException(ex.Message, ex);
        }

        var body = await resp.Content.ReadAsStringAsync(ct);
        if (!resp.IsSuccessStatusCode)
            throw new InventoryUnavailableException($"Implant stock apply failed ({(int)resp.StatusCode}): {body}");

        var parsed = JsonSerializer.Deserialize<WireDto>(string.IsNullOrWhiteSpace(body) ? "{}" : body, Json);
        return new InventoryImplantApplyResult(parsed?.LedgerId, parsed?.Replayed == true, parsed?.Unmapped == true);
    }

    private sealed class WireDto
    {
        public Guid? LedgerId { get; set; }
        public bool Replayed { get; set; }
        public bool Unmapped { get; set; }
    }
}

/// <summary>
/// Inventory HTTP/outage. Outbox keeps ImplantUsed Failed (same class as BILL_NOT_FOUND)
/// until stock apply succeeds; ChargeItems is not claimed.
/// </summary>
public sealed class InventoryUnavailableException : InvalidOperationException
{
    public const string Code = IntegrationOutboxService.InventoryUnavailableCode;

    public InventoryUnavailableException(string message, Exception? inner = null)
        : base(Prefix(message), inner)
    {
    }

    private static string Prefix(string message)
    {
        var text = string.IsNullOrWhiteSpace(message) ? Code : message.Trim();
        return text.StartsWith(Code, StringComparison.Ordinal)
            ? text
            : $"{Code}: {text}";
    }
}
