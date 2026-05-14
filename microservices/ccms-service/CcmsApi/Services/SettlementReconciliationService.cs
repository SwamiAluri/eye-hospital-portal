using CcmsApi.Data;
using CcmsApi.Models.Domain;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;

namespace CcmsApi.Services;

public class SettlementReconciliationService
{
    private readonly CcmsDbContext _db;
    private readonly IWorkflowEngine _workflow;
    private readonly ILogger<SettlementReconciliationService> _log;

    public SettlementReconciliationService(CcmsDbContext db, IWorkflowEngine workflow, ILogger<SettlementReconciliationService> log)
    {
        _db       = db;
        _workflow = workflow;
        _log      = log;
    }

    public async Task<CcmsSettlement> RecordSettlementAsync(
        Guid coverageCaseId, Guid actorUserId,
        RecordSettlementRequest req, CancellationToken ct = default)
    {
        var coverageCase = await _db.CoverageCases
            .FirstOrDefaultAsync(c => c.Id == coverageCaseId && c.DeletedAt == null, ct)
            ?? throw new KeyNotFoundException($"Coverage case {coverageCaseId} not found.");

        var outstanding = Math.Max(req.ClaimAmount - req.SettledAmount, 0);

        var settlement = new CcmsSettlement
        {
            Id                      = Guid.NewGuid(),
            TenantId                = coverageCase.TenantId,
            CoverageCase_Id         = coverageCaseId,
            ClaimPacketId           = req.ClaimPacketId,
            SettlementType          = req.SettlementType ?? "full",
            SettledAmount           = req.SettledAmount,
            PaymentReference        = req.PaymentReference,
            PaymentMode             = req.PaymentMode,
            SettledAt               = req.PaymentDate.HasValue
                                        ? req.PaymentDate.Value.ToDateTime(TimeOnly.MinValue)
                                        : DateTime.UtcNow,
            ReconciliationNotes     = req.Remarks,
            ReconciliationStatus    = "pending",
            CreatedAt               = DateTime.UtcNow,
            UpdatedAt               = DateTime.UtcNow,
            CreatedByUserId         = actorUserId,
            UpdatedByUserId         = actorUserId,
            Status                  = "active"
        };

        _db.Settlements.Add(settlement);

        // Determine workflow event
        string triggerEvent;
        string newState;
        if (outstanding <= 0)
        {
            triggerEvent = "RECEIVE_FULL_SETTLEMENT";
            newState     = "FULL_SETTLEMENT";
        }
        else
        {
            triggerEvent = "RECEIVE_PARTIAL_SETTLEMENT";
            newState     = "PARTIAL_SETTLEMENT";
        }

        if (coverageCase.WorkflowInstanceId.HasValue)
            await _workflow.FireAsync(coverageCase.WorkflowInstanceId.Value, triggerEvent, actorUserId, null, ct);

        coverageCase.CurrentState    = newState;
        coverageCase.UpdatedAt       = DateTime.UtcNow;
        coverageCase.UpdatedByUserId = actorUserId;
        coverageCase.RowVersion      += 1;

        // Line items
        if (req.LineItems is not null)
        {
            foreach (var li in req.LineItems)
            {
                _db.SettlementLineItems.Add(new CcmsSettlementLineItem
                {
                    Id                 = Guid.NewGuid(),
                    TenantId           = coverageCase.TenantId,
                    SettlementId       = settlement.Id,
                    LineItemType       = li.LineType,
                    Description        = li.Description,
                    ClaimedAmount      = li.ClaimedAmount,
                    SettledAmount      = li.SettledAmount,
                    DisallowedAmount   = Math.Max(li.ClaimedAmount - li.SettledAmount, 0),
                    DisallowedReason   = li.DisallowedReason,
                    CreatedAt          = DateTime.UtcNow,
                    UpdatedAt          = DateTime.UtcNow,
                    CreatedByUserId    = actorUserId,
                    UpdatedByUserId    = actorUserId,
                    Status             = "active"
                });
            }
        }

        await _db.SaveChangesAsync(ct);
        _log.LogInformation("Settlement {SettlementId} recorded for case {CaseId}: {Amount}",
            settlement.Id, coverageCaseId, req.SettledAmount);
        return settlement;
    }

    public async Task ReconcileAsync(
        Guid coverageCaseId, Guid actorUserId, CancellationToken ct = default)
    {
        var coverageCase = await _db.CoverageCases
            .FirstOrDefaultAsync(c => c.Id == coverageCaseId && c.DeletedAt == null, ct)
            ?? throw new KeyNotFoundException($"Coverage case {coverageCaseId} not found.");

        if (coverageCase.WorkflowInstanceId.HasValue)
            await _workflow.FireAsync(coverageCase.WorkflowInstanceId.Value, "RECONCILE", actorUserId, null, ct);

        coverageCase.CurrentState    = "RECONCILED";
        coverageCase.UpdatedAt       = DateTime.UtcNow;
        coverageCase.UpdatedByUserId = actorUserId;
        coverageCase.RowVersion      += 1;

        await _db.SaveChangesAsync(ct);
    }

    public async Task<List<CcmsSettlement>> GetByCaseIdAsync(
        Guid coverageCaseId, CancellationToken ct = default)
        => await _db.Settlements.AsNoTracking()
            .Where(s => s.CoverageCase_Id == coverageCaseId && s.DeletedAt == null)
            .OrderByDescending(s => s.CreatedAt)
            .ToListAsync(ct);

    // ── Settlement Aging Report ───────────────────────────────────────────────

    public async Task<List<AgingBucket>> GetAgingReportAsync(CancellationToken ct = default)
    {
        var now = DateTime.UtcNow;

        // Submitted claims not yet fully settled
        var submittedClaims = await _db.ClaimPackets
            .AsNoTracking()
            .Where(c => c.DeletedAt == null && c.SubmittedAt != null)
            .Select(c => new { c.ClaimedAmount, c.SubmittedAt })
            .ToListAsync(ct);

        var order = new[] { "0-30 days", "31-60 days", "61-90 days", "90+ days" };

        var grouped = submittedClaims
            .GroupBy(c =>
            {
                var days = (int)(now - c.SubmittedAt!.Value).TotalDays;
                return days <= 30 ? "0-30 days"  :
                       days <= 60 ? "31-60 days" :
                       days <= 90 ? "61-90 days" : "90+ days";
            })
            .ToDictionary(g => g.Key, g => new AgingBucket(g.Key, g.Count(), g.Sum(x => x.ClaimedAmount)));

        return order
            .Select(b => grouped.TryGetValue(b, out var bucket) ? bucket : new AgingBucket(b, 0, 0m))
            .ToList();
    }
}

public record RecordSettlementRequest(
    Guid?    ClaimPacketId,
    string?  SettlementType,
    decimal  SettledAmount,
    decimal  ClaimAmount,
    string?  PaymentReference,
    string?  PaymentMode,
    DateOnly? PaymentDate,
    string?  BankReference,
    string?  Remarks,
    List<SettlementLineItemRequest>? LineItems
);

public record SettlementLineItemRequest(
    string  LineType,
    string  Description,
    decimal ClaimedAmount,
    decimal SettledAmount,
    string? DisallowedReason
);

public record AgingBucket(string Bucket, int Count, decimal TotalAmount);
