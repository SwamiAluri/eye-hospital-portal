using CcmsApi.Data;
using CcmsApi.Models.Domain;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;

namespace CcmsApi.Services;

/// <summary>
/// Performs and records eligibility checks for a coverage case.
/// Checks can be manual (counsellor-entered) or automated (API call to payer portal).
/// On success the case transitions: DRAFT / POLICY_CAPTURED → ELIGIBILITY_VERIFIED.
/// </summary>
public class EligibilityService
{
    private readonly CcmsDbContext _db;
    private readonly IWorkflowEngine _workflow;
    private readonly ILogger<EligibilityService> _log;

    public EligibilityService(CcmsDbContext db, IWorkflowEngine workflow, ILogger<EligibilityService> log)
    {
        _db       = db;
        _workflow = workflow;
        _log      = log;
    }

    // ── Queries ──────────────────────────────────────────────────────────────

    public async Task<List<CcmsEligibilityCheck>> GetByCaseAsync(
        Guid caseId, CancellationToken ct = default)
        => await _db.EligibilityChecks.AsNoTracking()
            .Where(e => e.CoverageCase_Id == caseId && e.DeletedAt == null)
            .OrderByDescending(e => e.CheckedAt)
            .ToListAsync(ct);

    // ── Create / perform a check ─────────────────────────────────────────────

    public async Task<CcmsEligibilityCheck> PerformCheckAsync(
        Guid caseId,
        Guid actorId,
        EligibilityCheckRequest req,
        CancellationToken ct = default)
    {
        var coverageCase = await _db.CoverageCases
            .FirstOrDefaultAsync(c => c.Id == caseId && c.DeletedAt == null, ct)
            ?? throw new KeyNotFoundException($"Coverage case {caseId} not found.");

        var check = new CcmsEligibilityCheck
        {
            Id                        = Guid.NewGuid(),
            TenantId                  = coverageCase.TenantId,
            CoverageCase_Id           = caseId,
            PolicyNumber              = req.PolicyNumber,
            MembershipId              = req.MembershipId,
            CheckMethod               = req.CheckMethod ?? "manual",
            ResponseCode              = req.ResponseCode ?? "manual_entry",
            IsEligible                = req.IsEligible,
            EligibilityResponseJson   = req.EligibilityResponseJson,
            CheckedAt                 = DateTime.UtcNow,
            CreatedAt                 = DateTime.UtcNow,
            UpdatedAt                 = DateTime.UtcNow,
            CreatedByUserId           = actorId,
            UpdatedByUserId           = actorId,
            Status                    = "active",
        };

        _db.EligibilityChecks.Add(check);

        // Advance workflow when eligible — align with seed matrix (108):
        // DRAFT/POLICY_CAPTURED → VERIFY_ELIGIBILITY → ELIGIBILITY_PENDING
        // ELIGIBILITY_PENDING   → ELIGIBILITY_APPROVED → ELIGIBILITY_VERIFIED
        if (req.IsEligible && coverageCase.WorkflowInstanceId.HasValue)
        {
            var state = coverageCase.CurrentState;
            string? trigger = null;
            string? newState = null;

            if (state is "DRAFT" or "POLICY_CAPTURED" or "AUTHORIZATION_REQUIRED")
            {
                trigger  = "VERIFY_ELIGIBILITY";
                newState = "ELIGIBILITY_PENDING";
            }
            else if (state is "ELIGIBILITY_PENDING")
            {
                trigger  = "ELIGIBILITY_APPROVED";
                newState = "ELIGIBILITY_VERIFIED";
            }

            if (trigger is not null && newState is not null)
            {
                await _workflow.FireAsync(
                    coverageCase.WorkflowInstanceId.Value,
                    trigger, actorId, null, ct);

                coverageCase.CurrentState    = newState;
                coverageCase.UpdatedAt       = DateTime.UtcNow;
                coverageCase.UpdatedByUserId = actorId;
                coverageCase.RowVersion     += 1;
            }
        }
        else if (!req.IsEligible && coverageCase.WorkflowInstanceId.HasValue
                 && coverageCase.CurrentState is "ELIGIBILITY_PENDING")
        {
            await _workflow.FireAsync(
                coverageCase.WorkflowInstanceId.Value,
                "ELIGIBILITY_FAILED", actorId, null, ct);
            coverageCase.CurrentState    = "REJECTED";
            coverageCase.UpdatedAt       = DateTime.UtcNow;
            coverageCase.UpdatedByUserId = actorId;
            coverageCase.RowVersion     += 1;
        }

        await _db.SaveChangesAsync(ct);
        _log.LogInformation(
            "Eligibility check {CheckId} recorded for case {CaseId}: eligible={Eligible}",
            check.Id, caseId, req.IsEligible);
        return check;
    }
}

public record EligibilityCheckRequest(
    string  PolicyNumber,
    string? MembershipId,
    bool    IsEligible,
    string? CheckMethod,           // manual | api | portal
    string? ResponseCode,
    string? EligibilityResponseJson
);
