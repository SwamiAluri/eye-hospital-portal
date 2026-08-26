using System.Text.Json;
using IpManagementService.Data;
using IpManagementService.Models.Domain;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;

namespace IpManagementService.Services;

public interface IImplantChargeHandler
{
    Task HandleAsync(IntegrationOutboxEvent evt, CancellationToken ct = default);
}

/// <summary>
/// OT-020 outbox consumer. Charges only Implanted usage. Wastage is a hospital write-off (D2).
/// Inventory stock decrement / wastage ledger is the other consumer of the same event.
/// Billing/inventory outages retry the outbox — they never roll back the clinical row.
/// </summary>
public sealed class ImplantChargeHandler : IImplantChargeHandler
{
    private readonly IpManagementDbContext _db;
    private readonly IAuthBillingClient _billing;
    private readonly IInventoryImplantClient _inventory;
    private readonly ILogger<ImplantChargeHandler> _log;

    private static readonly JsonSerializerOptions Json = new() { PropertyNameCaseInsensitive = true };

    public ImplantChargeHandler(
        IpManagementDbContext db,
        IAuthBillingClient billing,
        ILogger<ImplantChargeHandler> log,
        IInventoryImplantClient? inventory = null)
    {
        _db = db;
        _billing = billing;
        _log = log;
        _inventory = inventory ?? new NoOpInventoryImplantClient();
    }

    public async Task HandleAsync(IntegrationOutboxEvent evt, CancellationToken ct = default)
    {
        var payload = JsonSerializer.Deserialize<ImplantEventPayload>(evt.PayloadJson, Json)
                      ?? throw new InvalidOperationException("Implant outbox payload is empty.");
        if (payload.ImplantUsageId == Guid.Empty)
            throw new InvalidOperationException("implantUsageId is required on implant outbox events.");

        var usage = await _db.JourneyImplantUsages.FirstOrDefaultAsync(
            u => u.Id == payload.ImplantUsageId && u.DeletedAt == null, ct)
            ?? throw new InvalidOperationException($"Implant usage {payload.ImplantUsageId} not found.");

        if (evt.EventType == IntegrationEventTypes.ImplantUsed)
            await HandleUsedAsync(usage, payload, evt, ct);
        else if (evt.EventType == IntegrationEventTypes.ImplantUsageReversed)
            await HandleReversedAsync(usage, payload, evt, ct);
    }

    private async Task HandleUsedAsync(
        JourneyImplantUsage usage, ImplantEventPayload payload, IntegrationOutboxEvent evt, CancellationToken ct)
    {
        // Unscanned/new Returned rows are clinical notes only. Stock restore is
        // HandleReversedAsync after a prior Implanted / write-off issue.
        if (usage.UsageStatus is ImplantUsageStatus.Returned or ImplantUsageStatus.Reversed)
        {
            usage.ChargeStatus = ImplantChargeStatus.Suppressed;
            usage.UpdatedAt = DateTime.UtcNow;
            await _db.SaveChangesAsync(ct);
            return;
        }

        await ApplyInventoryAsync(usage, payload, isReversal: false, ct);

        if (usage.UsageStatus != ImplantUsageStatus.Implanted)
        {
            usage.ChargeStatus = ImplantChargeStatus.Suppressed;
            usage.UpdatedAt = DateTime.UtcNow;
            await _db.SaveChangesAsync(ct);
            return;
        }

        try
        {
            var result = await _billing.ChargeItemsAsync(
                usage.TenantId,
                usage.JourneyId,
                payload.ActorUserId ?? usage.ScannedByUserId ?? Guid.Empty,
                evt.IdempotencyKey,
                [
                    new AuthChargeItemLine(
                        BillChargeSourceName.Implant,
                        usage.Id,
                        ServiceVariantId: null,
                        ServiceCode: usage.CatalogRef,
                        Quantity: 1,
                        Notes: $"Implant {usage.Brand} {usage.Model} {usage.SerialNumber}".Trim(),
                        ItemId: usage.ItemId,
                        IsCredit: false),
                ]);
            if (result.PostedCount > 0)
                usage.ChargeStatus = ImplantChargeStatus.Posted;
            else if (result.SuppressedCount > 0)
                usage.ChargeStatus = ImplantChargeStatus.Covered;
            else if (result.ExceptionCount > 0)
                usage.ChargeStatus = ImplantChargeStatus.Exception;
            else
                usage.ChargeStatus = ImplantChargeStatus.Pending;
            usage.UpdatedAt = DateTime.UtcNow;
            await _db.SaveChangesAsync(ct);
            _log.LogInformation(
                "Implant charge {UsageId} bill {BillId} status={Status} posted={Posted} suppressed={Suppressed} exceptions={Exceptions}",
                usage.Id, result.BillId, usage.ChargeStatus, result.PostedCount, result.SuppressedCount, result.ExceptionCount);
        }
        catch (AuthChargePostingException ex) when (
            ex.Code is "UNKNOWN_CATALOG_ITEM" or "UNPRICED_CATALOG_ITEM")
        {
            usage.ChargeStatus = ImplantChargeStatus.Exception;
            usage.UpdatedAt = DateTime.UtcNow;
            await _db.SaveChangesAsync(ct);
            _log.LogWarning("Implant {UsageId} parked on charge exception queue: {Code}", usage.Id, ex.Code);
        }
        catch (AuthChargePostingException ex) when (ex.IsClosedBill)
        {
            await ParkClosedBillAsync(usage, evt, ex, isCredit: false, ct);
        }
    }

    private async Task HandleReversedAsync(
        JourneyImplantUsage usage, ImplantEventPayload payload, IntegrationOutboxEvent evt, CancellationToken ct)
    {
        await ApplyInventoryAsync(usage, payload, isReversal: true, ct);

        if (usage.ChargeStatus is ImplantChargeStatus.Suppressed or ImplantChargeStatus.Credited)
            return;
        if (usage.ChargeStatus is ImplantChargeStatus.Pending or ImplantChargeStatus.Exception
            or ImplantChargeStatus.Covered)
        {
            usage.ChargeStatus = ImplantChargeStatus.Suppressed;
            usage.UpdatedAt = DateTime.UtcNow;
            await _db.SaveChangesAsync(ct);
            return;
        }

        try
        {
            await _billing.ChargeItemsAsync(
                usage.TenantId,
                usage.JourneyId,
                payload.ActorUserId ?? usage.UpdatedByUserId ?? Guid.Empty,
                evt.IdempotencyKey,
                [
                    new AuthChargeItemLine(
                        BillChargeSourceName.Implant,
                        usage.Id,
                        ServiceVariantId: null,
                        ServiceCode: usage.CatalogRef,
                        Quantity: 1,
                        Notes: $"Credit implant reversal {usage.SerialNumber}",
                        ItemId: usage.ItemId,
                        IsCredit: true),
                ]);
            usage.ChargeStatus = ImplantChargeStatus.Credited;
            usage.UpdatedAt = DateTime.UtcNow;
            await _db.SaveChangesAsync(ct);
        }
        catch (AuthChargePostingException ex) when (
            ex.Code is "UNKNOWN_CATALOG_ITEM" or "UNPRICED_CATALOG_ITEM")
        {
            usage.ChargeStatus = ImplantChargeStatus.Exception;
            usage.UpdatedAt = DateTime.UtcNow;
            await _db.SaveChangesAsync(ct);
            _log.LogWarning("Implant reversal {UsageId} parked on charge exception queue: {Code}", usage.Id, ex.Code);
        }
        catch (AuthChargePostingException ex) when (ex.IsClosedBill)
        {
            await ParkClosedBillAsync(usage, evt, ex, isCredit: true, ct);
        }
    }

    private async Task ParkClosedBillAsync(
        JourneyImplantUsage usage, IntegrationOutboxEvent evt, AuthChargePostingException ex, bool isCredit, CancellationToken ct)
    {
        await _billing.EnqueueChargeExceptionAsync(
            usage.TenantId,
            usage.JourneyId,
            usage.ItemId,
            usage.Id,
            BillChargeSourceName.Implant,
            ex.Message,
            $"{evt.IdempotencyKey}:{BillChargeSourceName.Implant}:{usage.Id:N}",
            1,
            ex.BillId,
            "NeedsAdjustment");
        if (!isCredit)
        {
            usage.UpdatedAt = DateTime.UtcNow;
            await _db.SaveChangesAsync(ct);
        }
        _log.LogWarning(
            "Implant {UsageId} parked NeedsAdjustment ({Code}); bill was not reopened.",
            usage.Id, ex.Code);
    }

    private async Task ApplyInventoryAsync(
        JourneyImplantUsage usage, ImplantEventPayload payload, bool isReversal, CancellationToken ct)
    {
        // Original issue already stamped inventory_txn_id. Reversal still must
        // post IMPLANT_RETURN (inventory keys that as rev:{usageId}).
        if (!isReversal && usage.InventoryTxnId is Guid existing && existing != Guid.Empty)
            return;

        var journey = await _db.PatientJourneys.AsNoTracking()
            .FirstOrDefaultAsync(j => j.Id == usage.JourneyId, ct);
        string? patientName = null;
        if (journey is not null && journey.PatientId != Guid.Empty)
        {
            var patient = await _db.Patients.AsNoTracking()
                .FirstOrDefaultAsync(p => p.Id == journey.PatientId, ct);
            if (patient is not null)
                patientName = $"{patient.FirstName} {patient.LastName}".Trim();
        }
        var actor = payload.ActorUserId ?? usage.UpdatedByUserId ?? usage.ScannedByUserId ?? Guid.Empty;
        var result = await _inventory.ApplyAsync(
            usage.TenantId,
            actor,
            usage.Id,
            usage.JourneyId,
            usage.ItemId,
            usage.CatalogRef,
            usage.Brand,
            usage.Model,
            usage.SerialNumber,
            usage.BatchNumber,
            usage.UdiBarcode,
            usage.UsageStatus,
            usage.WastageReason,
            patientName,
            journey?.Uhid,
            ct);
        if (result.LedgerId is Guid ledgerId && ledgerId != Guid.Empty
            && (usage.InventoryTxnId is null || usage.InventoryTxnId == Guid.Empty))
        {
            usage.InventoryTxnId = ledgerId;
            usage.UpdatedAt = DateTime.UtcNow;
            await _db.SaveChangesAsync(ct);
        }
        else if (result.Unmapped)
        {
            _log.LogWarning(
                "Implant {UsageId} has no inventory item mapping; stock ledger not written.",
                usage.Id);
        }
    }

    private sealed class ImplantEventPayload
    {
        public Guid ImplantUsageId { get; set; }
        public Guid? ActorUserId { get; set; }
        public string? UsageStatus { get; set; }
    }
}

/// <summary>Local name so IP does not take a project reference on Auth BillChargeSource.</summary>
internal static class BillChargeSourceName
{
    public const string Implant = "Implant";
    public const string Consumable = "Consumable";
}
