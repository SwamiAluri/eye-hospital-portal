using CcmsApi.Data;
using CcmsApi.Models.Domain;
using CcmsApi.Models.Dtos;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using Npgsql;

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

    // ── Mapping ───────────────────────────────────────────────────────────────
    internal static SettlementDto ToDto(CcmsSettlement s, List<CcmsSettlementLineItem>? lineItems = null) => new(
        s.Id, s.CoverageCase_Id, s.ClaimPacketId,
        s.SettlementNumber, s.SettlementType,
        s.SettledAmount, s.ClaimAmount, s.OutstandingAmount,
        s.PaymentMode, s.PaymentReference, s.PaymentDate,
        s.BankReference, s.SettledAt,
        s.ReconciliationStatus, s.ReconciliationNotes, s.ReconciliationAt,
        s.CreatedAt, s.UpdatedAt,
        lineItems?.Select(li => new SettlementLineItemDto(
            li.Id, li.LineItemType, li.Description,
            li.ClaimedAmount, li.SettledAmount, li.DisallowedAmount, li.DisallowedReason
        )).ToList());

    public async Task<SettlementDto> RecordSettlementAsync(
        Guid coverageCaseId, Guid actorUserId,
        RecordSettlementRequest req, CancellationToken ct = default)
    {
        var coverageCase = await _db.CoverageCases
            .FirstOrDefaultAsync(c => c.Id == coverageCaseId && c.DeletedAt == null, ct)
            ?? throw new KeyNotFoundException($"Coverage case {coverageCaseId} not found.");

        var hasClaim = await _db.ClaimPackets
            .AnyAsync(c => c.CoverageCase_Id == coverageCaseId && c.DeletedAt == null, ct);
        if (!hasClaim)
            throw new InvalidOperationException("Cannot record settlement: generate a claim packet first.");

        // Compute cumulative outstanding across all prior settlements for this case
        var previouslySettled = await _db.Settlements
            .AsNoTracking()
            .Where(s => s.CoverageCase_Id == coverageCaseId && s.DeletedAt == null)
            .SumAsync(s => s.SettledAmount, ct);

        var totalSettledAfter = previouslySettled + req.SettledAmount;
        var outstanding = Math.Max(req.ClaimAmount - totalSettledAfter, 0);

        var settlementNumber = await GenerateSettlementNumberAsync(coverageCase.TenantId, ct);

        var settlement = new CcmsSettlement
        {
            Id                      = Guid.NewGuid(),
            TenantId                = coverageCase.TenantId,
            CoverageCase_Id         = coverageCaseId,
            ClaimPacketId           = req.ClaimPacketId,
            SettlementNumber        = settlementNumber,
            SettlementType          = outstanding <= 0 ? "full" : "partial",
            SettledAmount           = req.SettledAmount,
            ClaimAmount             = req.ClaimAmount,
            OutstandingAmount       = outstanding,
            PaymentReference        = req.PaymentReference,
            PaymentMode             = req.PaymentMode,
            PaymentDate             = req.PaymentDate,
            BankReference           = req.BankReference,
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

        // Step 1: if case is CLAIM_IN_PROCESS, move to SETTLEMENT_PENDING first (seed trigger)
        if (coverageCase.CurrentState == "CLAIM_IN_PROCESS" && coverageCase.WorkflowInstanceId.HasValue)
        {
            await _workflow.FireAsync(coverageCase.WorkflowInstanceId.Value, "RECEIVE_SETTLEMENT", actorUserId, null, ct);
            coverageCase.CurrentState = "SETTLEMENT_PENDING";
        }

        // Step 2: determine partial vs full (seed triggers: PARTIAL_PAYMENT / FULL_PAYMENT)
        string triggerEvent;
        string newState;
        if (outstanding <= 0)
        {
            triggerEvent = "FULL_PAYMENT";
            newState     = "FULL_SETTLEMENT";
        }
        else
        {
            triggerEvent = "PARTIAL_PAYMENT";
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

        var lineItemEntities = req.LineItems is not null
            ? await _db.SettlementLineItems.AsNoTracking()
                .Where(li => li.SettlementId == settlement.Id)
                .ToListAsync(ct)
            : null;

        return ToDto(settlement, lineItemEntities);
    }

    public async Task ReconcileAsync(
        Guid coverageCaseId, Guid actorUserId, CancellationToken ct = default)
    {
        var coverageCase = await _db.CoverageCases
            .FirstOrDefaultAsync(c => c.Id == coverageCaseId && c.DeletedAt == null, ct)
            ?? throw new KeyNotFoundException($"Coverage case {coverageCaseId} not found.");

        var settlementCount = await _db.Settlements
            .CountAsync(s => s.CoverageCase_Id == coverageCaseId && s.DeletedAt == null, ct);
        if (settlementCount == 0)
            throw new InvalidOperationException("Cannot reconcile: record at least one settlement payment first.");

        var allowedStates = new[] { "PARTIAL_SETTLEMENT", "FULL_SETTLEMENT", "SETTLEMENT_PENDING" };
        if (!allowedStates.Contains(coverageCase.CurrentState, StringComparer.OrdinalIgnoreCase))
            throw new InvalidOperationException(
                $"Cannot reconcile from state '{coverageCase.CurrentState}'. Record settlement payment(s) first.");

        if (coverageCase.WorkflowInstanceId.HasValue)
            await _workflow.FireAsync(coverageCase.WorkflowInstanceId.Value, "RECONCILE", actorUserId, null, ct);

        coverageCase.CurrentState    = "RECONCILED";
        coverageCase.UpdatedAt       = DateTime.UtcNow;
        coverageCase.UpdatedByUserId = actorUserId;
        coverageCase.RowVersion      += 1;

        await _db.SaveChangesAsync(ct);
    }

    public async Task CloseCaseAsync(
        Guid coverageCaseId, Guid actorUserId, CancellationToken ct = default)
    {
        var coverageCase = await _db.CoverageCases
            .FirstOrDefaultAsync(c => c.Id == coverageCaseId && c.DeletedAt == null, ct)
            ?? throw new KeyNotFoundException($"Coverage case {coverageCaseId} not found.");

        if (!string.Equals(coverageCase.CurrentState, "RECONCILED", StringComparison.OrdinalIgnoreCase))
            throw new InvalidOperationException("Cannot close case: reconcile settlement first.");

        if (!coverageCase.WorkflowInstanceId.HasValue)
            throw new InvalidOperationException("No workflow instance attached to this case.");

        await _workflow.FireAsync(
            coverageCase.WorkflowInstanceId.Value, "CLOSE_CASE", actorUserId, null, ct);

        coverageCase.CurrentState    = "CLOSED";
        coverageCase.UpdatedAt       = DateTime.UtcNow;
        coverageCase.UpdatedByUserId = actorUserId;
        coverageCase.RowVersion      += 1;

        await _db.SaveChangesAsync(ct);
        _log.LogInformation("Coverage case {CaseId} closed", coverageCaseId);
    }

    public async Task<List<SettlementDto>> GetByCaseIdAsync(
        Guid coverageCaseId, CancellationToken ct = default)
    {
        var settlements = await _db.Settlements.AsNoTracking()
            .Where(s => s.CoverageCase_Id == coverageCaseId && s.DeletedAt == null)
            .OrderByDescending(s => s.CreatedAt)
            .ToListAsync(ct);

        var ids = settlements.Select(s => s.Id).ToList();
        var lineItems = await _db.SettlementLineItems.AsNoTracking()
            .Where(li => ids.Contains(li.SettlementId) && li.DeletedAt == null)
            .ToListAsync(ct);
        var bySettlement = lineItems.GroupBy(li => li.SettlementId)
            .ToDictionary(g => g.Key, g => g.ToList());

        return settlements.Select(s =>
            ToDto(s, bySettlement.TryGetValue(s.Id, out var lis) ? lis : null)
        ).ToList();
    }

    /// <summary>
    /// Patient-id settlement collection. Patient identity is the coverage case.
    /// Tenant and soft-delete apply to both the settlement and the case.
    /// No branch predicate. Order matches <see cref="GetByCaseIdAsync"/>: CreatedAt descending.
    /// </summary>
    public async Task<PagedResult<Patient360SettlementDto>> ListByPatientIdAsync(
        Guid tenantId, Guid patientId, int page = 1, int pageSize = 20, CancellationToken ct = default)
    {
        if (tenantId == Guid.Empty)
            throw new UnauthorizedAccessException("Tenant ID not found in token");

        var (pageNumber, size) = CcmsPatientListPaging.Normalize(page, pageSize);
        var filtered =
            from settlement in _db.Settlements.AsNoTracking()
            join coverageCase in _db.CoverageCases.AsNoTracking()
                on settlement.CoverageCase_Id equals coverageCase.Id
            where settlement.TenantId == tenantId
               && coverageCase.TenantId == tenantId
               && coverageCase.PatientId == patientId
               && settlement.DeletedAt == null
               && coverageCase.DeletedAt == null
            select new { settlement, coverageCase.CaseNumber };

        var total = await filtered.CountAsync(ct);
        var rows = await filtered
            .OrderByDescending(row => row.settlement.CreatedAt)
            .ThenByDescending(row => row.settlement.Id)
            .Skip((pageNumber - 1) * size)
            .Take(size)
            .ToListAsync(ct);

        var claimIds = rows
            .Where(row => row.settlement.ClaimPacketId.HasValue)
            .Select(row => row.settlement.ClaimPacketId!.Value)
            .Distinct()
            .ToList();
        var claimNumbers = claimIds.Count == 0
            ? new Dictionary<Guid, string>()
            : await _db.ClaimPackets.AsNoTracking()
                .Where(packet => claimIds.Contains(packet.Id)
                    && packet.TenantId == tenantId
                    && packet.DeletedAt == null)
                .ToDictionaryAsync(packet => packet.Id, packet => packet.ClaimNumber, ct);

        var items = rows.Select(row =>
        {
            string? claimNumber = null;
            if (row.settlement.ClaimPacketId.HasValue)
                claimNumbers.TryGetValue(row.settlement.ClaimPacketId.Value, out claimNumber);
            var settlement = row.settlement;
            return new Patient360SettlementDto(
                settlement.Id,
                settlement.SettlementNumber,
                settlement.SettlementType,
                settlement.SettledAmount,
                settlement.ClaimAmount,
                settlement.PaymentMode,
                settlement.PaymentReference,
                settlement.PaymentDate,
                settlement.SettledAt,
                settlement.ReconciliationStatus,
                settlement.CreatedAt,
                row.CaseNumber,
                claimNumber);
        }).ToList();

        return new PagedResult<Patient360SettlementDto>(items, total, pageNumber, size);
    }

    // ── Settlement number generation ─────────────────────────────────────────

    private async Task<string> GenerateSettlementNumberAsync(Guid tenantId, CancellationToken ct)
    {
        var conn = _db.Database.GetDbConnection();
        if (conn.State != System.Data.ConnectionState.Open)
            await conn.OpenAsync(ct);

        // Table created by migration 126_ccms_settlement_align.sql
        using var cmd = conn.CreateCommand();
        cmd.CommandText =
            """
            INSERT INTO ccms_settlement_sequences (tenant_id, last_sequence)
            VALUES (@tid, 1)
            ON CONFLICT (tenant_id)
            DO UPDATE SET last_sequence = ccms_settlement_sequences.last_sequence + 1
            RETURNING last_sequence
            """;
        var p = cmd.CreateParameter(); p.ParameterName = "tid"; p.Value = tenantId; cmd.Parameters.Add(p);
        var seq = (long)(await cmd.ExecuteScalarAsync(ct))!;
        var ym  = DateTime.UtcNow.ToString("yyMM");
        return $"STL-{ym}-{seq:D6}";
    }

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
