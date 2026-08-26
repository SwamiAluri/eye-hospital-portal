using System.Text.Json;
using IpManagementService.Models.Domain;
using Microsoft.Extensions.Logging;

namespace IpManagementService.Services;

public interface IConsumableChargeHandler
{
    Task HandleAsync(IntegrationOutboxEvent evt, CancellationToken ct = default);
}

/// <summary>
/// INV-050 / P0-5B outbox consumer. Debits catalog-priced Consumable lines from
/// ConsumablesConsumed and credits returned qty from ConsumablesReturned (IsCredit).
/// Missing journey is exception-queued, not charged. Closed bills park NeedsAdjustment
/// and never reopen. Billing outages retry the outbox — they never roll back stock.
/// </summary>
public sealed class ConsumableChargeHandler : IConsumableChargeHandler
{
    private readonly IAuthBillingClient _billing;
    private readonly ILogger<ConsumableChargeHandler> _log;

    private static readonly JsonSerializerOptions Json = new() { PropertyNameCaseInsensitive = true };

    public ConsumableChargeHandler(IAuthBillingClient billing, ILogger<ConsumableChargeHandler> log)
    {
        _billing = billing;
        _log = log;
    }

    public async Task HandleAsync(IntegrationOutboxEvent evt, CancellationToken ct = default)
    {
        var isCredit = evt.EventType == IntegrationEventTypes.ConsumablesReturned;
        var payload = JsonSerializer.Deserialize<ConsumablesConsumedPayload>(evt.PayloadJson, Json)
                      ?? throw new InvalidOperationException($"{evt.EventType} payload is empty.");
        if (payload.ConsumptionId == Guid.Empty)
            throw new InvalidOperationException("consumptionId is required on consumable charge events.");
        if (payload.Lines is null || payload.Lines.Count == 0)
            throw new InvalidOperationException($"{evt.EventType} must include at least one line.");

        if (payload.JourneyId is not Guid journeyId || journeyId == Guid.Empty)
        {
            foreach (var line in payload.Lines)
            {
                await _billing.EnqueueChargeExceptionAsync(
                    payload.TenantId != Guid.Empty ? payload.TenantId : evt.TenantId,
                    null,
                    line.ItemId,
                    line.ConsumableId,
                    BillChargeSourceName.Consumable,
                    isCredit
                        ? "Missing journey_id on OT consumable return."
                        : "Missing journey_id on OT consumable issue.",
                    $"{evt.IdempotencyKey}:{BillChargeSourceName.Consumable}:{line.ConsumableId:N}",
                    line.Quantity <= 0 ? 1 : line.Quantity);
            }

            _log.LogWarning(
                "{EventType} {ConsumptionId} parked on charge exception queue (unmapped journey).",
                evt.EventType, payload.ConsumptionId);
            return;
        }

        try
        {
            var result = await _billing.ChargeItemsAsync(
                payload.TenantId != Guid.Empty ? payload.TenantId : evt.TenantId,
                journeyId,
                payload.ActorUserId ?? Guid.Empty,
                evt.IdempotencyKey,
                payload.Lines.Select(l => new AuthChargeItemLine(
                    BillChargeSourceName.Consumable,
                    l.ConsumableId,
                    ServiceVariantId: null,
                    ServiceCode: null,
                    Quantity: l.Quantity <= 0 ? 1 : l.Quantity,
                    Notes: isCredit ? "Credit consumable return" : null,
                    ItemId: l.ItemId,
                    IsCredit: isCredit)).ToList());

            _log.LogInformation(
                "Posted consumable {Kind} batch {ConsumptionId} bill {BillId} replayed={Replayed}",
                isCredit ? "credit" : "charge", payload.ConsumptionId, result.BillId, result.Replayed);
        }
        catch (AuthChargePostingException ex) when (ex.IsClosedBill)
        {
            var tenantId = payload.TenantId != Guid.Empty ? payload.TenantId : evt.TenantId;
            foreach (var line in payload.Lines)
            {
                await _billing.EnqueueChargeExceptionAsync(
                    tenantId,
                    journeyId,
                    line.ItemId,
                    line.ConsumableId,
                    BillChargeSourceName.Consumable,
                    ex.Message,
                    $"{evt.IdempotencyKey}:{BillChargeSourceName.Consumable}:{line.ConsumableId:N}",
                    line.Quantity <= 0 ? 1 : line.Quantity,
                    ex.BillId,
                    "NeedsAdjustment");
            }

            _log.LogWarning(
                "{EventType} {ConsumptionId} parked NeedsAdjustment ({Code}); bill was not reopened.",
                evt.EventType, payload.ConsumptionId, ex.Code);
        }
    }

    private sealed class ConsumablesConsumedPayload
    {
        public Guid TenantId { get; set; }
        public Guid? JourneyId { get; set; }
        public Guid ConsumptionId { get; set; }
        public Guid? ActorUserId { get; set; }
        public List<ConsumableLine> Lines { get; set; } = [];
    }

    private sealed class ConsumableLine
    {
        public Guid ConsumableId { get; set; }
        public Guid ItemId { get; set; }
        public decimal Quantity { get; set; }
    }
}
