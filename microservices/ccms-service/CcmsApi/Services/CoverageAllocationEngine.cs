using CcmsApi.Data;
using CcmsApi.Models.Domain;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;

namespace CcmsApi.Services;

/// <summary>
/// Computes insurance vs patient share from the final bill.
/// Splits bill based on approved coverage, copay%, deductible, and exclusions.
/// </summary>
public class CoverageAllocationEngine
{
    private readonly CcmsDbContext _db;
    private readonly ILogger<CoverageAllocationEngine> _log;

    public CoverageAllocationEngine(CcmsDbContext db, ILogger<CoverageAllocationEngine> log)
    {
        _db  = db;
        _log = log;
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

        var totalBill       = req.TotalBillAmount;
        var approvedLimit   = auth?.ApprovedAmount ?? 0;
        var copayPct        = req.CopayPercent ?? 0;
        var deductible      = req.DeductibleAmount ?? 0;

        // Compute allocation
        var coveredByInsurance = Math.Min(totalBill, approvedLimit);
        var copay              = Math.Round(coveredByInsurance * copayPct / 100m, 2);
        var effectiveCovered   = coveredByInsurance - copay - deductible;
        effectiveCovered       = Math.Max(effectiveCovered, 0);
        var patientShare       = totalBill - effectiveCovered;
        patientShare           = Math.Max(patientShare, 0);
        var disallowed         = totalBill - effectiveCovered - patientShare;

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
            foreach (var li in req.LineItems)
            {
                var liCovered    = Math.Min(li.BilledAmount, effectiveCovered > 0 ? li.BilledAmount : 0);
                var liPatient    = li.BilledAmount - liCovered;
                var liDisallowed = 0m;

                if (li.IsExcluded)
                {
                    liCovered    = 0;
                    liPatient    = li.BilledAmount;
                    liDisallowed = 0;
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
                    DisallowedReason     = li.IsExcluded ? "Excluded from coverage" : null,
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
}

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
    bool    IsExcluded
);
