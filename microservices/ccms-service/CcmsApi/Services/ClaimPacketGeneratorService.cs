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

    private static int _claimSeq = 0;

    public ClaimPacketGeneratorService(CcmsDbContext db, IWorkflowEngine workflow, ILogger<ClaimPacketGeneratorService> log)
    {
        _db       = db;
        _workflow = workflow;
        _log      = log;
    }

    // ── Mapping ───────────────────────────────────────────────────────────────
    internal static ClaimPacketDto ToDto(CcmsClaimPacket c) => new(
        c.Id, c.CoverageCase_Id, c.ClaimNumber, c.ClaimedAmount,
        c.ClaimType, c.SubmissionMode, c.Status,
        c.SubmittedAt, c.AcknowledgedAt, c.TpaClaimNumber,
        c.ExpectedSettlementDate, c.CreatedAt, c.UpdatedAt);

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

        coverageCase.CurrentState    = "CLAIM_READY";
        coverageCase.UpdatedAt       = DateTime.UtcNow;
        coverageCase.UpdatedByUserId = actorUserId;
        coverageCase.RowVersion      += 1;

        await _db.SaveChangesAsync(ct);
        _log.LogInformation("Claim packet {ClaimNo} generated for case {CaseId}", claimNumber, coverageCaseId);
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
            coverageCase.CurrentState    = "CLAIM_SUBMITTED";
            coverageCase.UpdatedAt       = DateTime.UtcNow;
            coverageCase.UpdatedByUserId = actorUserId;
            coverageCase.RowVersion      += 1;
        }

        await _db.SaveChangesAsync(ct);
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
            coverageCase.CurrentState    = "CLAIM_IN_PROCESS";
            coverageCase.UpdatedAt       = DateTime.UtcNow;
            coverageCase.UpdatedByUserId = actorUserId;
            coverageCase.RowVersion      += 1;
        }

        await _db.SaveChangesAsync(ct);
        _log.LogInformation("Claim packet {ClaimId} acknowledged", claimPacketId);
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
