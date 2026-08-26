using CcmsApi.Data;
using CcmsApi.Models.Domain;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;

namespace CcmsApi.Services;

/// <summary>
/// Computes insurance vs patient share from the final bill.
/// Splits bill based on approved coverage, copay%, deductible, and exclusions.
/// After saving, fires FINALIZE_BILL → PREPARE_CLAIM workflow transitions.
/// </summary>
public class CoverageAllocationEngine
{
    private readonly CcmsDbContext _db;
    private readonly IWorkflowEngine _workflow;
    private readonly AuthServiceClient? _auth;
    private readonly ILogger<CoverageAllocationEngine> _log;

    public CoverageAllocationEngine(
        CcmsDbContext db,
        IWorkflowEngine workflow,
        ILogger<CoverageAllocationEngine> log,
        AuthServiceClient? auth = null)
    {
        _db       = db;
        _workflow = workflow;
        _log      = log;
        _auth     = auth;
    }

    /// <summary>
    /// Authoritative payer vs patient split. Copay and deductible reduce the
    /// insurer slice; excluded lines stay on the patient. Used by
    /// <see cref="AllocateAsync"/> and enhancement reallocation — do not fork.
    /// </summary>
    public static AllocationSplit ComputeSplit(
        decimal totalBillAmount,
        decimal approvedLimit,
        decimal copayPercent,
        decimal deductibleAmount,
        decimal excludedTotal = 0)
    {
        var totalBill = Math.Max(0, totalBillAmount);
        var excluded = Math.Clamp(excludedTotal, 0, totalBill);
        var payableTotal = totalBill - excluded;
        var limit = Math.Max(0, approvedLimit);
        var coveredByInsurance = Math.Min(payableTotal, limit);
        var copayPct = Math.Max(0, copayPercent);
        var copay = Math.Round(coveredByInsurance * copayPct / 100m, 2);
        var deductible = Math.Max(0, deductibleAmount);
        var insuranceShare = Math.Max(coveredByInsurance - copay - deductible, 0);
        var patientShare = Math.Max(payableTotal - insuranceShare, 0) + excluded;
        return new AllocationSplit(
            limit, payableTotal, coveredByInsurance, copay, insuranceShare, patientShare, excluded);
    }

    /// <summary>
    /// TPA limit is the higher of latest authorization and case projection so
    /// an approved enhancement (which raises <c>coverageCase.ApprovedAmount</c>
    /// without rewriting the original preauth row) is visible to allocation.
    /// </summary>
    public static decimal ResolveApprovedLimit(decimal? authorizationApprovedAmount, decimal caseApprovedAmount)
        => Math.Max(Math.Max(0, authorizationApprovedAmount ?? 0), Math.Max(0, caseApprovedAmount));

    /// <summary>
    /// Recover copay % from a stored summary so enhancement can re-run
    /// <see cref="ComputeSplit"/> without a new request body.
    /// </summary>
    public static decimal InferCopayPercent(decimal insuranceShare, decimal copayAmount, decimal deductibleAmount)
    {
        if (copayAmount <= 0) return 0;
        var coveredByInsurance = insuranceShare + copayAmount + Math.Max(0, deductibleAmount);
        if (coveredByInsurance <= 0) return 0;
        return Math.Round(copayAmount * 100m / coveredByInsurance, 4);
    }

    public async Task<CcmsBillingSummary> AllocateAsync(
        Guid coverageCaseId, Guid actorUserId,
        AllocateBillRequest req, CancellationToken ct = default)
    {
        var coverageCase = await _db.CoverageCases
            .FirstOrDefaultAsync(c => c.Id == coverageCaseId && c.DeletedAt == null, ct)
            ?? throw new KeyNotFoundException($"Coverage case {coverageCaseId} not found.");

        // Get the latest approved authorization
        var auth = await _db.CoverageAuthorizations
            .AsNoTracking()
            .Where(a => a.CoverageCase_Id == coverageCaseId && a.DeletedAt == null)
            .OrderByDescending(a => a.CreatedAt)
            .FirstOrDefaultAsync(ct);

        var approvedLimit = ResolveApprovedLimit(auth?.ApprovedAmount, coverageCase.ApprovedAmount);
        if (approvedLimit <= 0)
            throw new InvalidOperationException(
                "Cannot allocate bill: record TPA approval with an approved amount first.");

        var excludedTotal = req.LineItems?.Where(li => li.IsExcluded).Sum(li => li.BilledAmount) ?? 0;
        var split = ComputeSplit(
            req.TotalBillAmount,
            approvedLimit,
            req.CopayPercent ?? 0,
            req.DeductibleAmount ?? 0,
            excludedTotal);

        var summary = new CcmsBillingSummary
        {
            Id                    = Guid.NewGuid(),
            TenantId              = coverageCase.TenantId,
            CoverageCase_Id       = coverageCaseId,
            BillId                = req.BillId,
            BillDate              = req.BillDate ?? DateTime.UtcNow,
            TotalBillAmount       = req.TotalBillAmount,
            InsuranceShareAmount  = split.InsuranceShare,
            PatientShareAmount    = split.PatientShare,
            CopayAmount           = split.CopayAmount,
            DeductibleAmount      = Math.Max(0, req.DeductibleAmount ?? 0),
            DisallowedAmount      = split.DisallowedAmount,
            CreatedAt             = DateTime.UtcNow,
            UpdatedAt             = DateTime.UtcNow,
            CreatedByUserId       = actorUserId,
            UpdatedByUserId       = actorUserId,
            Status                = "active"
        };

        _db.BillingSummaries.Add(summary);

        // Create line-item allocations
        if (req.LineItems is not null)
        {
            // Proportional coverage ratio (avoid division by zero)
            var coverageRatio = split.PayableTotal > 0 ? split.InsuranceShare / split.PayableTotal : 0;

            foreach (var li in req.LineItems)
            {
                decimal liCovered;
                decimal liDisallowed;
                decimal liPatient;
                string? disallowReason;

                if (li.IsExcluded)
                {
                    liCovered    = 0;
                    liDisallowed = li.BilledAmount;
                    liPatient    = li.BilledAmount;
                    disallowReason = li.DisallowedReason ?? "Excluded from coverage";
                }
                else
                {
                    liCovered      = Math.Round(li.BilledAmount * coverageRatio, 2);
                    liDisallowed   = 0;
                    liPatient      = li.BilledAmount - liCovered;
                    disallowReason = null;
                }

                _db.CoverageAllocations.Add(new CcmsCoverageAllocation
                {
                    Id                   = Guid.NewGuid(),
                    TenantId             = coverageCase.TenantId,
                    BillingSummaryId     = summary.Id,
                    LineItemType         = li.Type,
                    LineItemCode         = li.Code,
                    LineItemDescription  = li.Description,
                    BilledAmount         = li.BilledAmount,
                    CoveredAmount        = liCovered,
                    DisallowedAmount     = liDisallowed,
                    DisallowedReason     = disallowReason,
                    PatientPayable       = liPatient,
                    CreatedAt            = DateTime.UtcNow,
                    UpdatedAt            = DateTime.UtcNow,
                    CreatedByUserId      = actorUserId,
                    UpdatedByUserId      = actorUserId,
                    Status               = "active"
                });
            }
        }

        // Update coverage case with bill totals
        coverageCase.UpdatedAt       = DateTime.UtcNow;
        coverageCase.UpdatedByUserId = actorUserId;
        coverageCase.RowVersion      += 1;

        await _db.SaveChangesAsync(ct);
        _log.LogInformation("Bill allocated for case {CaseId}: Ins={Ins}, Pat={Pat}",
            coverageCaseId, split.InsuranceShare, split.PatientShare);

        // Advance workflow: FINALIZE_BILL → PREPARE_CLAIM (non-blocking; may already be past these states)
        if (coverageCase.WorkflowInstanceId.HasValue)
        {
            foreach (var trigger in new[] { "FINALIZE_BILL", "PREPARE_CLAIM" })
            {
                try
                {
                    await _workflow.FireAsync(
                        coverageCase.WorkflowInstanceId.Value, trigger, actorUserId,
                        "Auto-fired after bill allocation", ct);
                }
                catch (Exception ex)
                {
                    _log.LogWarning(ex, "{Trigger} fire failed for case {CaseId} (may be benign)", trigger, coverageCaseId);
                }
            }
        }

        if (_auth is not null && coverageCase.JourneyId is { } jid)
        {
            await _auth.ApplyCoverageAllocationAsync(
                jid, split.InsuranceShare, split.PatientShare, actorUserId, ct);
        }

        return summary;
    }

    public async Task<CcmsBillingSummary?> GetByCaseIdAsync(
        Guid coverageCaseId, CancellationToken ct = default)
        => await _db.BillingSummaries.AsNoTracking()
            .Where(b => b.CoverageCase_Id == coverageCaseId && b.DeletedAt == null)
            .OrderByDescending(b => b.CreatedAt)
            .FirstOrDefaultAsync(ct);

    public async Task<List<CcmsCoverageAllocation>> GetAllocationsBySummaryAsync(
        Guid summaryId, CancellationToken ct = default)
        => await _db.CoverageAllocations.AsNoTracking()
            .Where(a => a.BillingSummaryId == summaryId && a.DeletedAt == null)
            .ToListAsync(ct);

    /// Loads the latest billing summary for a case together with all its line allocations.
    public async Task<BillingSummaryWithAllocations?> GetWithAllocationsAsync(
        Guid coverageCaseId, CancellationToken ct = default)
    {
        var summary = await GetByCaseIdAsync(coverageCaseId, ct);
        if (summary is null) return null;

        var allocations = await GetAllocationsBySummaryAsync(summary.Id, ct);
        return new BillingSummaryWithAllocations(summary, allocations);
    }

    /// <summary>
    /// After enhancement raises the case approved limit, re-run allocation from
    /// the latest billing summary and push the engine split to Billing.
    /// Returns null when no bill has been allocated yet — callers must not
    /// invent payer = approved limit / patient = 0.
    /// </summary>
    public async Task<CcmsBillingSummary?> ReallocateToCurrentApprovedLimitAsync(
        Guid coverageCaseId, Guid actorUserId, CancellationToken ct = default)
    {
        var existing = await GetWithAllocationsAsync(coverageCaseId, ct);
        if (existing is null)
            return null;

        var copayPct = InferCopayPercent(
            existing.Summary.InsuranceShareAmount,
            existing.Summary.CopayAmount,
            existing.Summary.DeductibleAmount);

        List<BillLineItemRequest>? lines = existing.Allocations.Count == 0
            ? null
            : existing.Allocations.Select(a => new BillLineItemRequest(
                a.LineItemType,
                a.LineItemCode,
                a.LineItemDescription,
                a.BilledAmount,
                IsExcluded: a.DisallowedAmount > 0 && a.CoveredAmount <= 0,
                a.DisallowedReason)).ToList();

        return await AllocateAsync(
            coverageCaseId,
            actorUserId,
            new AllocateBillRequest(
                existing.Summary.BillId,
                existing.Summary.BillDate,
                existing.Summary.TotalBillAmount,
                copayPct,
                existing.Summary.DeductibleAmount,
                lines),
            ct);
    }
}

public record AllocationSplit(
    decimal ApprovedLimit,
    decimal PayableTotal,
    decimal CoveredByInsurance,
    decimal CopayAmount,
    decimal InsuranceShare,
    decimal PatientShare,
    decimal DisallowedAmount
);

public record BillingSummaryWithAllocations(
    CcmsBillingSummary Summary,
    List<CcmsCoverageAllocation> Allocations
);

public record AllocateBillRequest(
    Guid?    BillId,
    DateTime? BillDate,
    decimal  TotalBillAmount,
    decimal? CopayPercent,
    decimal? DeductibleAmount,
    List<BillLineItemRequest>? LineItems
);

public record BillLineItemRequest(
    string  Type,
    string? Code,
    string  Description,
    decimal BilledAmount,
    bool    IsExcluded,
    string? DisallowedReason = null
);
