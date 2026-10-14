using CcmsApi.Data;
using CcmsApi.Models.Domain;
using CcmsApi.Models.Dtos;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;

namespace CcmsApi.Services;

public class ClaimPacketGeneratorService
{
    private readonly CcmsDbContext _db;
    private readonly IWorkflowEngine _workflow;
    private readonly ILogger<ClaimPacketGeneratorService> _log;
    private readonly AuthServiceClient? _auth;

    private static int _claimSeq = 0;

    public ClaimPacketGeneratorService(
        CcmsDbContext db,
        IWorkflowEngine workflow,
        ILogger<ClaimPacketGeneratorService> log,
        AuthServiceClient? auth = null)
    {
        _db       = db;
        _workflow = workflow;
        _log      = log;
        _auth     = auth;
    }

    // ── Mapping ───────────────────────────────────────────────────────────────
    internal static ClaimPacketDto ToDto(CcmsClaimPacket c) => new(
        c.Id, c.CoverageCase_Id, c.ClaimNumber, c.ClaimedAmount,
        c.ClaimType, c.SubmissionMode, c.Status,
        c.SubmittedAt, c.AcknowledgedAt, c.TpaClaimNumber,
        c.ExpectedSettlementDate, c.CreatedAt, c.UpdatedAt, c.QueryStatus);

    public async Task<ClaimPacketDto> GenerateClaimAsync(
        Guid coverageCaseId, Guid actorUserId,
        GenerateClaimRequest req, CancellationToken ct = default)
    {
        var coverageCase = await _db.CoverageCases
            .FirstOrDefaultAsync(c => c.Id == coverageCaseId && c.DeletedAt == null, ct)
            ?? throw new KeyNotFoundException($"Coverage case {coverageCaseId} not found.");

        var billing = await _db.BillingSummaries
            .AsNoTracking()
            .Where(b => b.CoverageCase_Id == coverageCaseId && b.DeletedAt == null)
            .OrderByDescending(b => b.CreatedAt)
            .FirstOrDefaultAsync(ct);
        if (billing is null)
            throw new InvalidOperationException("Cannot generate claim: allocate the bill on the Billing tab first.");

        var claimNumber = await GenerateClaimNumberAsync(coverageCase.TenantId, ct);

        var packet = new CcmsClaimPacket
        {
            Id                      = Guid.NewGuid(),
            TenantId                = coverageCase.TenantId,
            CoverageCase_Id         = coverageCaseId,
            ClaimNumber             = claimNumber,
            ClaimedAmount           = billing?.InsuranceShareAmount ?? req.ClaimedAmount,
            ClaimType               = req.ClaimType ?? "cashless",
            SubmissionMode          = req.SubmissionMode ?? "manual",
            CreatedAt               = DateTime.UtcNow,
            UpdatedAt               = DateTime.UtcNow,
            CreatedByUserId         = actorUserId,
            UpdatedByUserId         = actorUserId,
            Status                  = "active"
        };

        _db.ClaimPackets.Add(packet);

        // Workflow: BILL_FINALIZED → CLAIM_READY (seed trigger: PREPARE_CLAIM)
        if (coverageCase.WorkflowInstanceId.HasValue)
        {
            await _workflow.FireAsync(
                coverageCase.WorkflowInstanceId.Value,
                "PREPARE_CLAIM", actorUserId, null, ct);
        }

        var previousState = coverageCase.CurrentState;
        coverageCase.CurrentState    = "CLAIM_READY";
        coverageCase.UpdatedAt       = DateTime.UtcNow;
        coverageCase.UpdatedByUserId = actorUserId;
        coverageCase.RowVersion      += 1;
        QueueClaimStatusAudit(coverageCase, previousState, "CLAIM_READY", actorUserId);

        await _db.SaveChangesAsync(ct);
        _log.LogInformation("Claim packet {ClaimNo} generated for case {CaseId}", claimNumber, coverageCaseId);
        await NotifyClaimStatusAsync(coverageCase, "CLAIM_READY", actorUserId, ct);
        return ToDto(packet);
    }

    public async Task<ClaimPacketDto> SubmitClaimAsync(
        Guid claimPacketId, Guid actorUserId, string? tpaClaimNumber = null, CancellationToken ct = default)
    {
        var packet = await _db.ClaimPackets
            .FirstOrDefaultAsync(c => c.Id == claimPacketId && c.DeletedAt == null, ct)
            ?? throw new KeyNotFoundException($"Claim packet {claimPacketId} not found.");

        packet.SubmittedAt       = DateTime.UtcNow;
        packet.TpaClaimNumber    = tpaClaimNumber ?? packet.TpaClaimNumber;
        packet.UpdatedAt         = DateTime.UtcNow;
        packet.UpdatedByUserId   = actorUserId;
        packet.RowVersion        += 1;

        var coverageCase = await _db.CoverageCases
            .FirstOrDefaultAsync(c => c.Id == packet.CoverageCase_Id && c.DeletedAt == null, ct);

        if (coverageCase is not null)
        {
            if (coverageCase.WorkflowInstanceId.HasValue)
                await _workflow.FireAsync(coverageCase.WorkflowInstanceId.Value, "SUBMIT_CLAIM", actorUserId, null, ct);
            var previousState = coverageCase.CurrentState;
            coverageCase.CurrentState    = "CLAIM_SUBMITTED";
            coverageCase.UpdatedAt       = DateTime.UtcNow;
            coverageCase.UpdatedByUserId = actorUserId;
            coverageCase.RowVersion      += 1;
            QueueClaimStatusAudit(coverageCase, previousState, "CLAIM_SUBMITTED", actorUserId);
        }

        await _db.SaveChangesAsync(ct);
        await NotifyClaimStatusAsync(coverageCase, "CLAIM_SUBMITTED", actorUserId, ct);
        return ToDto(packet);
    }

    public async Task<ClaimPacketDto> AcknowledgeClaimAsync(
        Guid claimPacketId, Guid actorUserId, string? tpaAckReference = null, CancellationToken ct = default)
    {
        var packet = await _db.ClaimPackets
            .FirstOrDefaultAsync(c => c.Id == claimPacketId && c.DeletedAt == null, ct)
            ?? throw new KeyNotFoundException($"Claim packet {claimPacketId} not found.");

        packet.AcknowledgedAt    = DateTime.UtcNow;
        packet.TpaClaimNumber    = tpaAckReference ?? packet.TpaClaimNumber;
        packet.UpdatedAt         = DateTime.UtcNow;
        packet.UpdatedByUserId   = actorUserId;
        packet.RowVersion        += 1;

        var coverageCase = await _db.CoverageCases
            .FirstOrDefaultAsync(c => c.Id == packet.CoverageCase_Id && c.DeletedAt == null, ct);

        if (coverageCase is not null)
        {
            if (coverageCase.WorkflowInstanceId.HasValue)
                await _workflow.FireAsync(coverageCase.WorkflowInstanceId.Value, "CLAIM_ACKNOWLEDGED", actorUserId, null, ct);
            var previousState = coverageCase.CurrentState;
            coverageCase.CurrentState    = "CLAIM_IN_PROCESS";
            coverageCase.UpdatedAt       = DateTime.UtcNow;
            coverageCase.UpdatedByUserId = actorUserId;
            coverageCase.RowVersion      += 1;
            QueueClaimStatusAudit(coverageCase, previousState, "CLAIM_IN_PROCESS", actorUserId);
        }

        await _db.SaveChangesAsync(ct);
        _log.LogInformation("Claim packet {ClaimId} acknowledged", claimPacketId);
        await NotifyClaimStatusAsync(coverageCase, "CLAIM_IN_PROCESS", actorUserId, ct);
        return ToDto(packet);
    }

    public async Task<List<ClaimPacketDto>> GetByCaseIdAsync(
        Guid coverageCaseId, CancellationToken ct = default)
        => (await _db.ClaimPackets.AsNoTracking()
            .Where(c => c.CoverageCase_Id == coverageCaseId && c.DeletedAt == null)
            .OrderByDescending(c => c.CreatedAt)
            .ToListAsync(ct))
            .Select(ToDto)
            .ToList();

    /// <summary>
    /// Patient-id claim collection. Tenant and soft-delete follow the coverage-case
    /// patient read: JWT tenant on both the case and the claim packet. No branch predicate.
    /// Order matches <see cref="GetByCaseIdAsync"/>: <c>CreatedAt</c> descending.
    /// </summary>
    public async Task<PagedResult<ClaimPacketDto>> ListByPatientIdAsync(
        Guid tenantId, Guid patientId, int page = 1, int pageSize = 20, CancellationToken ct = default)
    {
        var (pageNumber, size) = CcmsPatientListPaging.Normalize(page, pageSize);
        var filtered =
            from packet in _db.ClaimPackets.AsNoTracking()
            join coverageCase in _db.CoverageCases.AsNoTracking()
                on packet.CoverageCase_Id equals coverageCase.Id
            where packet.TenantId == tenantId
               && coverageCase.TenantId == tenantId
               && coverageCase.PatientId == patientId
               && packet.DeletedAt == null
               && coverageCase.DeletedAt == null
            select packet;

        var total = await filtered.CountAsync(ct);
        var rows = await filtered
            .OrderByDescending(packet => packet.CreatedAt)
            .ThenByDescending(packet => packet.Id)
            .Skip((pageNumber - 1) * size)
            .Take(size)
            .ToListAsync(ct);

        return new PagedResult<ClaimPacketDto>(rows.Select(ToDto).ToList(), total, pageNumber, size);
    }

    // ── Claims Queue (ready/pending submission) ───────────────────────────────

    public async Task<List<ClaimQueueItem>> GetQueueAsync(CancellationToken ct = default)
    {
        var packets = await _db.ClaimPackets
            .AsNoTracking()
            .Where(c => c.DeletedAt == null)
            .OrderBy(c => c.CreatedAt)
            .Take(200)
            .ToListAsync(ct);

        var caseIds = packets.Select(c => c.CoverageCase_Id).Distinct().ToList();
        var casesById = await _db.CoverageCases
            .AsNoTracking()
            .Where(c => caseIds.Contains(c.Id) && c.DeletedAt == null)
            .ToDictionaryAsync(c => c.Id, ct);

        var now = DateTime.UtcNow;
        return packets.Select(cl =>
        {
            casesById.TryGetValue(cl.CoverageCase_Id, out var c);
            return new ClaimQueueItem(
                ClaimId:       cl.Id,
                ClaimNumber:   cl.ClaimNumber,
                CaseId:        cl.CoverageCase_Id,
                CaseNumber:    c?.CaseNumber ?? "–",
                Status:        cl.Status,
                ClaimedAmount: cl.ClaimedAmount,
                SubmittedAt:   cl.SubmittedAt,
                AgeInDays:     (int)(now - cl.CreatedAt).TotalDays
            );
        }).ToList();
    }

    public async Task<ClaimPacketDto> RaiseClaimQueryAsync(
        Guid claimPacketId, Guid actorUserId, string query, bool additionalInfoRequired, CancellationToken ct = default)
    {
        if (string.IsNullOrWhiteSpace(query))
            throw new ArgumentException("Query text is required.");

        var packet = await _db.ClaimPackets
            .FirstOrDefaultAsync(c => c.Id == claimPacketId && c.DeletedAt == null, ct)
            ?? throw new KeyNotFoundException($"Claim packet {claimPacketId} not found.");

        var coverageCase = await _db.CoverageCases
            .FirstOrDefaultAsync(c => c.Id == packet.CoverageCase_Id && c.DeletedAt == null, ct)
            ?? throw new KeyNotFoundException("Coverage case not found.");

        var allowed = coverageCase.CurrentState is "CLAIM_SUBMITTED" or "CLAIM_IN_PROCESS"
            or "CLAIM_QUERY_RAISED" or "CLAIM_QUERY_RESPONDED";
        if (!allowed)
            throw new InvalidOperationException(
                $"Claim query is only valid after claim submission (state {coverageCase.CurrentState}).");

        packet.QueryStatus = additionalInfoRequired ? "additional_info_required" : "query_raised";
        packet.UpdatedAt = DateTime.UtcNow;
        packet.UpdatedByUserId = actorUserId;

        var auth = await _db.CoverageAuthorizations.AsNoTracking()
            .Where(a => a.CoverageCase_Id == coverageCase.Id && a.DeletedAt == null)
            .OrderByDescending(a => a.UpdatedAt)
            .FirstOrDefaultAsync(ct);

        if (auth is not null)
        {
            _db.ClarificationItems.Add(new CcmsClarificationItem
            {
                Id = Guid.NewGuid(),
                TenantId = coverageCase.TenantId,
                AuthorizationId = auth.Id,
                ClarificationQuery = $"[CLAIM {packet.ClaimNumber}] {query.Trim()}",
                RequestedAt = DateTime.UtcNow,
                CreatedAt = DateTime.UtcNow,
                UpdatedAt = DateTime.UtcNow,
                CreatedByUserId = actorUserId,
                UpdatedByUserId = actorUserId,
                Status = "active",
            });
        }

        coverageCase.ProcessStatus = packet.QueryStatus;
        coverageCase.ProcessStatusUpdatedAt = DateTime.UtcNow;
        var previousState = coverageCase.CurrentState;
        if (coverageCase.CurrentState != "CLAIM_QUERY_RAISED")
            await ApplyClaimWorkflowAsync(coverageCase, "RAISE_CLAIM_QUERY", actorUserId, "CLAIM_QUERY_RAISED", ct);
        coverageCase.UpdatedAt = DateTime.UtcNow;
        coverageCase.UpdatedByUserId = actorUserId;
        QueueClaimStatusAudit(coverageCase, previousState, coverageCase.CurrentState, actorUserId);

        await _db.SaveChangesAsync(ct);
        return ToDto(packet);
    }

    public async Task<ClaimPacketDto> RespondClaimQueryAsync(
        Guid claimPacketId, Guid actorUserId, string response, CancellationToken ct = default)
    {
        if (string.IsNullOrWhiteSpace(response))
            throw new ArgumentException("Response is required.");

        var packet = await _db.ClaimPackets
            .FirstOrDefaultAsync(c => c.Id == claimPacketId && c.DeletedAt == null, ct)
            ?? throw new KeyNotFoundException($"Claim packet {claimPacketId} not found.");

        if (packet.QueryStatus is "none" or "response_submitted")
            throw new InvalidOperationException("No open claim query to respond to.");

        packet.QueryStatus = "response_submitted";
        packet.UpdatedAt = DateTime.UtcNow;
        packet.UpdatedByUserId = actorUserId;

        var coverageCase = await _db.CoverageCases
            .FirstOrDefaultAsync(c => c.Id == packet.CoverageCase_Id && c.DeletedAt == null, ct);
        if (coverageCase is not null)
        {
            coverageCase.ProcessStatus = "claim_query_response_submitted";
            coverageCase.ProcessStatusUpdatedAt = DateTime.UtcNow;
            var previousState = coverageCase.CurrentState;
            await ApplyClaimWorkflowAsync(
                coverageCase, "RESPOND_CLAIM_QUERY", actorUserId, "CLAIM_QUERY_RESPONDED", ct);
            var resumeTrigger = packet.AcknowledgedAt.HasValue ? "CONTINUE_CLAIM" : "RETURN_TO_SUBMITTED";
            var resumeFallback = packet.AcknowledgedAt.HasValue ? "CLAIM_IN_PROCESS" : "CLAIM_SUBMITTED";
            await ApplyClaimWorkflowAsync(coverageCase, resumeTrigger, actorUserId, resumeFallback, ct);
            coverageCase.UpdatedAt = DateTime.UtcNow;
            coverageCase.UpdatedByUserId = actorUserId;
            QueueClaimStatusAudit(coverageCase, previousState, coverageCase.CurrentState, actorUserId);
        }

        var auth = await _db.CoverageAuthorizations
            .Where(a => a.CoverageCase_Id == packet.CoverageCase_Id && a.DeletedAt == null)
            .OrderByDescending(a => a.UpdatedAt)
            .FirstOrDefaultAsync(ct);
        if (auth is not null)
        {
            var open = await _db.ClarificationItems
                .Where(c => c.AuthorizationId == auth.Id && c.RespondedAt == null && c.DeletedAt == null)
                .OrderByDescending(c => c.RequestedAt)
                .FirstOrDefaultAsync(ct);
            if (open is not null)
            {
                open.ClarificationResponse = response.Trim();
                open.RespondedAt = DateTime.UtcNow;
                open.UpdatedAt = DateTime.UtcNow;
                open.UpdatedByUserId = actorUserId;
            }
        }

        await _db.SaveChangesAsync(ct);
        return ToDto(packet);
    }

    private void QueueClaimStatusAudit(
        CcmsCoverageCase coverageCase, string? previousState, string newStatus, Guid actorUserId)
    {
        _db.ApprovalEvents.Add(new CcmsApprovalEvent
        {
            Id = Guid.NewGuid(),
            TenantId = coverageCase.TenantId,
            CoverageCase_Id = coverageCase.Id,
            EventType = "CLAIM_STATUS_CHANGED",
            EventSource = "api",
            ApprovalStatus = newStatus,
            PreviousState = previousState,
            CorrelationId = coverageCase.Id,
            RecordedByUserId = actorUserId,
            RecordedAt = DateTime.UtcNow,
            CreatedAt = DateTime.UtcNow,
            CreatedByUserId = actorUserId,
            Status = "active",
        });
    }

    private async Task ApplyClaimWorkflowAsync(
        CcmsCoverageCase coverageCase,
        string trigger,
        Guid actorUserId,
        string fallbackState,
        CancellationToken ct)
    {
        if (!coverageCase.WorkflowInstanceId.HasValue)
        {
            coverageCase.CurrentState = fallbackState;
            return;
        }

        var fired = await _workflow.FireAsync(
            coverageCase.WorkflowInstanceId.Value, trigger, actorUserId, null, ct);
        if (!fired.Success)
            throw new InvalidOperationException(
                fired.ErrorMessage ?? $"Cannot fire {trigger} from {fired.FromState}.");
        coverageCase.CurrentState = fired.ToState;
    }

    private async Task NotifyClaimStatusAsync(
        CcmsCoverageCase? coverageCase, string claimStatus, Guid actorUserId, CancellationToken ct)
    {
        if (_auth is null || coverageCase is null) return;
        await _auth.NotifyClaimStatusChangedAsync(
            coverageCase.TenantId,
            coverageCase.JourneyId,
            coverageCase.Id,
            claimStatus,
            actorUserId,
            ct);
    }

    private async Task<string> GenerateClaimNumberAsync(Guid tenantId, CancellationToken ct)
    {
        var seq = System.Threading.Interlocked.Increment(ref _claimSeq);
        var ym  = DateTime.UtcNow.ToString("yyMM");
        return $"CLM-{ym}-{seq:D6}";
    }
}

public record GenerateClaimRequest(
    decimal  ClaimedAmount,
    string?  ClaimType,
    string?  SubmissionMode
);

public record ClaimQueueItem(
    Guid      ClaimId,
    string    ClaimNumber,
    Guid      CaseId,
    string    CaseNumber,
    string    Status,
    decimal   ClaimedAmount,
    DateTime? SubmittedAt,
    int       AgeInDays
);
