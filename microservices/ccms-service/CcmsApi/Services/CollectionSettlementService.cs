using CcmsApi.Data;
using CcmsApi.Models.Domain;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;

namespace CcmsApi.Services;

public interface ICollectionSettlementService
{
    Task<CollectionApplyResult> ApplyAsync(BillingLedgerEvent evt, CancellationToken ct = default);
}

public static class BillingLedgerEventTypes
{
    public const string PaymentReceived = "PaymentReceived";
    public const string PaymentReversed = "PaymentReversed";
    public const string PatientObligationChanged = "PatientObligationChanged";

    public static string Normalize(string? value)
    {
        var v = (value ?? string.Empty).Trim();
        if (v.Equals("payment-received", StringComparison.OrdinalIgnoreCase)
            || v.Equals(PaymentReceived, StringComparison.OrdinalIgnoreCase))
            return PaymentReceived;
        if (v.Equals("payment-reversed", StringComparison.OrdinalIgnoreCase)
            || v.Equals(PaymentReversed, StringComparison.OrdinalIgnoreCase))
            return PaymentReversed;
        if (v.Equals("patient-obligation-changed", StringComparison.OrdinalIgnoreCase)
            || v.Equals(PatientObligationChanged, StringComparison.OrdinalIgnoreCase))
            return PatientObligationChanged;
        return v;
    }
}

public sealed record BillingLedgerEvent(
    string EventType,
    Guid TenantId,
    Guid? JourneyId,
    Guid? SessionId,
    Guid? BillId,
    Guid? PaymentId,
    decimal Amount,
    Guid? ActorUserId,
    DateTime? OccurredAt,
    string? IdempotencyKey = null);

public sealed record CollectionApplyResult(
    bool Applied,
    bool Duplicate,
    Guid? CoverageCaseId,
    string? PreviousState,
    string? NewState,
    decimal NetCollected,
    decimal PatientObligation);

/// <summary>
/// CCMS-060. Applies billing collection events to a coverage-case projection
/// and advances SETTLEMENT_PENDING → PARTIAL_SETTLEMENT | FULL_SETTLEMENT when
/// patient obligation is known and the workflow permits. Does not write IP
/// clinical state. Cashless TPA cases (obligation 0) keep settlement on the
/// Record Settlement path.
/// </summary>
public sealed class CollectionSettlementService : ICollectionSettlementService
{
    private static readonly HashSet<string> SettlementTrack = new(StringComparer.OrdinalIgnoreCase)
    {
        "CLAIM_IN_PROCESS", "SETTLEMENT_PENDING", "PARTIAL_SETTLEMENT",
    };

    private readonly CcmsDbContext _db;
    private readonly IWorkflowEngine _workflow;
    private readonly ILogger<CollectionSettlementService> _log;

    public CollectionSettlementService(
        CcmsDbContext db,
        IWorkflowEngine workflow,
        ILogger<CollectionSettlementService> log)
    {
        _db = db;
        _workflow = workflow;
        _log = log;
    }

    public async Task<CollectionApplyResult> ApplyAsync(BillingLedgerEvent evt, CancellationToken ct = default)
    {
        var eventType = BillingLedgerEventTypes.Normalize(evt.EventType);
        if (string.IsNullOrWhiteSpace(eventType))
            return new CollectionApplyResult(false, false, null, null, null, 0, 0);

        var coverageCase = await ResolveCaseAsync(evt, ct);
        if (coverageCase is null)
        {
            _log.LogInformation(
                "CCMS-060 {Event}: no coverage case for journey {Journey} / session {Session} — ignoring",
                eventType, evt.JourneyId, evt.SessionId);
            return new CollectionApplyResult(false, false, null, null, null, 0, 0);
        }

        if (coverageCase.TenantId != evt.TenantId && evt.TenantId != Guid.Empty)
        {
            _log.LogWarning(
                "CCMS-060 {Event}: tenant mismatch for case {CaseId} — ignoring",
                eventType, coverageCase.Id);
            return new CollectionApplyResult(false, false, coverageCase.Id, coverageCase.CurrentState, coverageCase.CurrentState, 0, 0);
        }

        if (await IsDuplicateAsync(coverageCase.TenantId, eventType, evt, ct))
        {
            var existing = await LoadProjectionAsync(coverageCase.Id, ct);
            return new CollectionApplyResult(
                false, true, coverageCase.Id, coverageCase.CurrentState, coverageCase.CurrentState,
                existing?.NetCollected ?? 0, existing?.PatientObligationAmount ?? 0);
        }

        var previousState = coverageCase.CurrentState;
        var actor = evt.ActorUserId ?? Guid.Empty;
        var occurred = evt.OccurredAt ?? DateTime.UtcNow;
        var signedAmount = eventType == BillingLedgerEventTypes.PaymentReversed
            ? -Math.Abs(evt.Amount)
            : Math.Abs(evt.Amount);

        _db.CollectionEvents.Add(new CcmsCollectionEvent
        {
            Id = Guid.NewGuid(),
            TenantId = coverageCase.TenantId,
            CoverageCaseId = coverageCase.Id,
            EventType = eventType,
            SourceRefId = evt.PaymentId,
            BillId = evt.BillId,
            Amount = eventType == BillingLedgerEventTypes.PatientObligationChanged ? evt.Amount : signedAmount,
            IdempotencyKey = string.IsNullOrWhiteSpace(evt.IdempotencyKey) ? null : evt.IdempotencyKey.Trim(),
            OccurredAt = occurred,
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow,
            CreatedByUserId = actor == Guid.Empty ? null : actor,
            UpdatedByUserId = actor == Guid.Empty ? null : actor,
            Status = "active",
        });

        var projection = await LoadProjectionAsync(coverageCase.Id, ct);
        if (projection is null)
        {
            projection = new CcmsCollectionProjection
            {
                Id = Guid.NewGuid(),
                TenantId = coverageCase.TenantId,
                CoverageCaseId = coverageCase.Id,
                CreatedAt = DateTime.UtcNow,
                Status = "active",
            };
            _db.CollectionProjections.Add(projection);
        }

        if (evt.BillId is Guid billId)
            projection.BillId = billId;
        projection.LastOccurredAt = occurred;
        projection.UpdatedAt = DateTime.UtcNow;
        projection.UpdatedByUserId = actor == Guid.Empty ? projection.UpdatedByUserId : actor;
        projection.RowVersion += 1;

        if (eventType == BillingLedgerEventTypes.PatientObligationChanged)
            projection.PatientObligationAmount = Math.Max(0, evt.Amount);
        else
            projection.NetCollected = Math.Max(0, projection.NetCollected + signedAmount);

        await _db.SaveChangesAsync(ct);

        await TryAdvanceSettlementAsync(coverageCase, projection, actor, eventType, ct);
        await _db.SaveChangesAsync(ct);

        return new CollectionApplyResult(
            true, false, coverageCase.Id, previousState, coverageCase.CurrentState,
            projection.NetCollected, projection.PatientObligationAmount);
    }

    private async Task<CcmsCoverageCase?> ResolveCaseAsync(BillingLedgerEvent evt, CancellationToken ct)
    {
        if (evt.JourneyId is Guid journeyId && journeyId != Guid.Empty)
        {
            var byJourney = await _db.CoverageCases
                .FirstOrDefaultAsync(c => c.JourneyId == journeyId && c.DeletedAt == null, ct);
            if (byJourney is not null) return byJourney;
        }

        if (evt.SessionId is Guid sessionId && sessionId != Guid.Empty)
        {
            return await _db.CoverageCases
                .FirstOrDefaultAsync(c => c.SessionId == sessionId && c.DeletedAt == null, ct);
        }

        return null;
    }

    private async Task<CcmsCollectionProjection?> LoadProjectionAsync(Guid caseId, CancellationToken ct)
        => await _db.CollectionProjections
            .FirstOrDefaultAsync(p => p.CoverageCaseId == caseId && p.DeletedAt == null, ct);

    private async Task<bool> IsDuplicateAsync(
        Guid tenantId, string eventType, BillingLedgerEvent evt, CancellationToken ct)
    {
        if (evt.PaymentId is Guid paymentId && paymentId != Guid.Empty)
        {
            var bySource = await _db.CollectionEvents.AsNoTracking()
                .AnyAsync(e => e.TenantId == tenantId && e.EventType == eventType
                               && e.SourceRefId == paymentId && e.DeletedAt == null, ct);
            if (bySource) return true;
        }

        if (!string.IsNullOrWhiteSpace(evt.IdempotencyKey))
        {
            var key = evt.IdempotencyKey.Trim();
            return await _db.CollectionEvents.AsNoTracking()
                .AnyAsync(e => e.TenantId == tenantId && e.IdempotencyKey == key && e.DeletedAt == null, ct);
        }

        return false;
    }

    private async Task TryAdvanceSettlementAsync(
        CcmsCoverageCase coverageCase,
        CcmsCollectionProjection projection,
        Guid actorUserId,
        string eventType,
        CancellationToken ct)
    {
        var expected = await ResolveExpectedObligationAsync(coverageCase.Id, projection, ct);
        if (expected <= 0)
        {
            _log.LogInformation(
                "CCMS-060 {Event}: case {CaseId} has no patient obligation — projection updated, settlement FSM left for TPA Record Settlement",
                eventType, coverageCase.Id);
            return;
        }

        if (!SettlementTrack.Contains(coverageCase.CurrentState))
            return;

        string? trigger;
        string? targetState;
        if (projection.NetCollected >= expected)
        {
            trigger = "FULL_PAYMENT";
            targetState = "FULL_SETTLEMENT";
        }
        else if (projection.NetCollected > 0)
        {
            trigger = "PARTIAL_PAYMENT";
            targetState = "PARTIAL_SETTLEMENT";
        }
        else
        {
            return;
        }

        if (string.Equals(coverageCase.CurrentState, targetState, StringComparison.OrdinalIgnoreCase))
            return;

        if (string.Equals(coverageCase.CurrentState, "PARTIAL_SETTLEMENT", StringComparison.OrdinalIgnoreCase)
            && targetState == "PARTIAL_SETTLEMENT")
            return;

        if (!coverageCase.WorkflowInstanceId.HasValue)
        {
            coverageCase.CurrentState = targetState;
            coverageCase.UpdatedAt = DateTime.UtcNow;
            coverageCase.UpdatedByUserId = actorUserId == Guid.Empty ? coverageCase.UpdatedByUserId : actorUserId;
            coverageCase.RowVersion += 1;
            return;
        }

        try
        {
            if (string.Equals(coverageCase.CurrentState, "CLAIM_IN_PROCESS", StringComparison.OrdinalIgnoreCase))
            {
                var receive = await _workflow.FireAsync(
                    coverageCase.WorkflowInstanceId.Value, "RECEIVE_SETTLEMENT", actorUserId,
                    $"Billing {eventType}", ct);
                if (!receive.Success)
                {
                    _log.LogInformation(
                        "CCMS-060 RECEIVE_SETTLEMENT not permitted from {State} for case {CaseId}: {Error}",
                        coverageCase.CurrentState, coverageCase.Id, receive.ErrorMessage);
                    return;
                }
                coverageCase.CurrentState = "SETTLEMENT_PENDING";
            }

            var fired = await _workflow.FireAsync(
                coverageCase.WorkflowInstanceId.Value, trigger, actorUserId,
                $"Billing {eventType} collected={projection.NetCollected} obligation={expected}", ct);
            if (!fired.Success)
            {
                _log.LogInformation(
                    "CCMS-060 {Trigger} not permitted from {State} for case {CaseId}: {Error}",
                    trigger, coverageCase.CurrentState, coverageCase.Id, fired.ErrorMessage);
                return;
            }

            coverageCase.CurrentState = targetState;
            coverageCase.UpdatedAt = DateTime.UtcNow;
            coverageCase.UpdatedByUserId = actorUserId == Guid.Empty ? coverageCase.UpdatedByUserId : actorUserId;
            coverageCase.RowVersion += 1;
        }
        catch (Exception ex)
        {
            _log.LogWarning(ex,
                "CCMS-060 workflow advance failed for case {CaseId} (projection already saved)",
                coverageCase.Id);
        }
    }

    private async Task<decimal> ResolveExpectedObligationAsync(
        Guid caseId, CcmsCollectionProjection projection, CancellationToken ct)
    {
        if (projection.PatientObligationAmount > 0)
            return projection.PatientObligationAmount;

        var share = await _db.BillingSummaries.AsNoTracking()
            .Where(b => b.CoverageCase_Id == caseId && b.DeletedAt == null)
            .OrderByDescending(b => b.BillDate)
            .Select(b => b.PatientShareAmount)
            .FirstOrDefaultAsync(ct);
        return Math.Max(0, share);
    }
}
