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
    private readonly ILogger<CoverageAllocationEngine> _log;

    public CoverageAllocationEngine(
        CcmsDbContext db,
        IWorkflowEngine workflow,
        ILogger<CoverageAllocationEngine> log)
    {
        _db       = db;
        _workflow = workflow;
        _log      = log;
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

        var approvedLimit = auth?.ApprovedAmount ?? coverageCase.ApprovedAmount;
        if (approvedLimit <= 0)
            throw new InvalidOperationException(
                "Cannot allocate bill: record TPA approval with an approved amount first.");

        var totalBill       = req.TotalBillAmount;
        var copayPct        = req.CopayPercent ?? 0;
        var deductible      = req.DeductibleAmount ?? 0;

        // Identify disallowed line items first (excluded items never covered)
        var excludedTotal = req.LineItems?.Where(li => li.IsExcluded).Sum(li => li.BilledAmount) ?? 0;
        var payableTotal  = totalBill - excludedTotal;  // eligible for insurance coverage

        // Compute allocation on the payable (non-excluded) portion
        var coveredByInsurance = Math.Min(payableTotal, approvedLimit);
        var copay              = Math.Round(coveredByInsurance * copayPct / 100m, 2);
        var effectiveCovered   = Math.Max(coveredByInsurance - copay - deductible, 0);
        var patientShare       = Math.Max(payableTotal - effectiveCovered, 0) + excludedTotal;
        var disallowed         = excludedTotal;  // excluded = disallowed

        var summary = new CcmsBillingSummary
        {
            Id                    = Guid.NewGuid(),
            TenantId              = coverageCase.TenantId,
            CoverageCase_Id       = coverageCaseId,
            BillId                = req.BillId,
            BillDate              = req.BillDate ?? DateTime.UtcNow,
            TotalBillAmount       = totalBill,
            InsuranceShareAmount  = effectiveCovered,
            PatientShareAmount    = patientShare,
            CopayAmount           = copay,
            DeductibleAmount      = deductible,
            DisallowedAmount      = Math.Max(disallowed, 0),
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
            var coverageRatio = payableTotal > 0 ? effectiveCovered / payableTotal : 0;

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
            coverageCaseId, effectiveCovered, patientShare);

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
}

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
