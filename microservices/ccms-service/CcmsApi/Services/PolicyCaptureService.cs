using CcmsApi.Data;
using CcmsApi.Models.Domain;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;

namespace CcmsApi.Services;

/// <summary>
/// Records / updates the detailed policy snapshot for a coverage case
/// and advances the workflow to POLICY_CAPTURED.
/// </summary>
public class PolicyCaptureService
{
    private readonly CcmsDbContext _db;
    private readonly IWorkflowEngine _workflow;
    private readonly ILogger<PolicyCaptureService> _log;

    public PolicyCaptureService(CcmsDbContext db, IWorkflowEngine workflow, ILogger<PolicyCaptureService> log)
    {
        _db       = db;
        _workflow = workflow;
        _log      = log;
    }

    // ── Queries ──────────────────────────────────────────────────────────────

    public async Task<List<CcmsPolicyCapture>> GetByCaseAsync(
        Guid caseId, CancellationToken ct = default)
        => await _db.PolicyCaptures.AsNoTracking()
            .Where(p => p.CoverageCase_Id == caseId && p.DeletedAt == null)
            .OrderByDescending(p => p.CapturedAt)
            .ToListAsync(ct);

    public async Task<CcmsPolicyCapture?> GetLatestAsync(
        Guid caseId, CancellationToken ct = default)
        => await _db.PolicyCaptures.AsNoTracking()
            .Where(p => p.CoverageCase_Id == caseId && p.DeletedAt == null)
            .OrderByDescending(p => p.CapturedAt)
            .FirstOrDefaultAsync(ct);

    // ── Capture / upsert ─────────────────────────────────────────────────────

    public async Task<CcmsPolicyCapture> CaptureAsync(
        Guid caseId,
        Guid actorId,
        PolicyCaptureRequest req,
        CancellationToken ct = default)
    {
        var coverageCase = await _db.CoverageCases
            .FirstOrDefaultAsync(c => c.Id == caseId && c.DeletedAt == null, ct)
            ?? throw new KeyNotFoundException($"Coverage case {caseId} not found.");

        var capture = new CcmsPolicyCapture
        {
            Id                    = Guid.NewGuid(),
            TenantId              = coverageCase.TenantId,
            CoverageCase_Id       = caseId,
            PolicyNumber          = req.PolicyNumber,
            MemberName            = req.MemberName,
            MemberDob             = req.MemberDob,
            PolicyStartDate       = req.PolicyStartDate ?? DateOnly.MinValue,
            PolicyEndDate         = req.PolicyEndDate   ?? DateOnly.MaxValue,
            SumInsured            = req.SumInsured,
            BalanceSumInsured     = req.BalanceSumInsured,
            CumulativeBonusAmount = req.CumulativeBonusAmount,
            RoomEntitlement       = req.RoomEntitlement,
            PolicyDocsJson        = req.PolicyDocsJson,
            CapturedAt            = DateTime.UtcNow,
            CreatedAt             = DateTime.UtcNow,
            UpdatedAt             = DateTime.UtcNow,
            CreatedByUserId       = actorId,
            UpdatedByUserId       = actorId,
            Status                = "active",
        };

        _db.PolicyCaptures.Add(capture);

        // Advance workflow: DRAFT / ELIGIBILITY_VERIFIED → POLICY_CAPTURED
        var capturable = new[] { "DRAFT", "ELIGIBILITY_VERIFIED", "ELIGIBILITY_PENDING" };
        if (capturable.Contains(coverageCase.CurrentState, StringComparer.OrdinalIgnoreCase)
            && coverageCase.WorkflowInstanceId.HasValue)
        {
            await _workflow.FireAsync(
                coverageCase.WorkflowInstanceId.Value,
                "CAPTURE_POLICY",
                actorId, null, ct);

            coverageCase.CurrentState    = "POLICY_CAPTURED";
            coverageCase.UpdatedAt       = DateTime.UtcNow;
            coverageCase.UpdatedByUserId = actorId;
            coverageCase.RowVersion     += 1;
        }

        await _db.SaveChangesAsync(ct);
        _log.LogInformation(
            "Policy captured {CaptureId} for case {CaseId}", capture.Id, caseId);
        return capture;
    }
}

public record PolicyCaptureRequest(
    string   PolicyNumber,
    string?  MemberName,
    DateOnly? MemberDob,
    DateOnly? PolicyStartDate,
    DateOnly? PolicyEndDate,
    decimal  SumInsured,
    decimal  BalanceSumInsured,
    decimal  CumulativeBonusAmount,
    string?  RoomEntitlement,
    string?  PolicyDocsJson
);
