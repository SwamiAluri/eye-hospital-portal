using Microsoft.EntityFrameworkCore;
using IpManagementService.Data;
using IpManagementService.Models.Domain;
using IpManagementService.Models.Dtos;

namespace IpManagementService.Services;

/// <summary>
/// Records ward-level advance/payment transactions against a patient journey.
///
/// Phase 2 ownership clarification:
///   • Canonical hospital charges / bill finalization → Billing (Auth OpdBillService)
///   • Coverage allocation / claims / settlement → CCMS
///   • This service is a clinical-ward projection helper (advances, receipts shown in IP)
///     and must not become a competing billing engine.
///   • IP FinancialState.Settled is only a BillFinalized *bridge* when OPD finalize
///     is not used for that journey.
/// </summary>
public class BillingService
{
    private readonly IpManagementDbContext _db;

    public BillingService(IpManagementDbContext db)
    {
        _db = db;
    }

    public async Task<List<BillingTransactionDto>> ListAsync(Guid journeyId, Guid tenantId)
    {
        return await _db.BillingTransactions
            .Where(t => t.PatientJourneyId == journeyId && t.TenantId == tenantId && t.DeletedAt == null)
            .OrderBy(t => t.CreatedAt)
            .Select(t => new BillingTransactionDto(
                t.Id, t.TransactionType, t.PaymentMode, t.Amount,
                t.ReferenceNumber, t.ReceiptNumber, t.Notes, t.CreatedAt))
            .ToListAsync();
    }

    public async Task<BillingTransactionDto?> GetByIdAsync(Guid txnId, Guid journeyId, Guid tenantId)
    {
        return await _db.BillingTransactions
            .Where(t => t.Id == txnId && t.PatientJourneyId == journeyId && t.TenantId == tenantId && t.DeletedAt == null)
            .Select(t => new BillingTransactionDto(
                t.Id, t.TransactionType, t.PaymentMode, t.Amount,
                t.ReferenceNumber, t.ReceiptNumber, t.Notes, t.CreatedAt))
            .FirstOrDefaultAsync();
    }

    public async Task<BillingTransactionDto> AddAsync(
        Guid journeyId, Guid tenantId, Guid branchId, Guid userId, AddBillingTransactionRequest req)
    {
        var journey = await _db.PatientJourneys.FirstOrDefaultAsync(
            j => j.Id == journeyId && j.TenantId == tenantId && j.DeletedAt == null)
            ?? throw new KeyNotFoundException($"Journey {journeyId} not found.");

        if (journey.IsBillingLocked)
            throw new InvalidOperationException("Billing is locked for this patient.");

        var tx = new IpBillingTransaction
        {
            TenantId         = tenantId,
            BranchId         = branchId,
            PatientJourneyId = journeyId,
            TransactionType  = req.TransactionType,
            PaymentMode      = req.PaymentMode,
            Amount           = req.Amount,
            ReferenceNumber  = req.ReferenceNumber,
            Notes            = req.Notes,
            ReceiptNumber    = Guid.NewGuid().ToString("N")[..8].ToUpper(), // naive receipt no.
            CreatedAt        = DateTime.UtcNow,
            UpdatedAt        = DateTime.UtcNow,
            CreatedByUserId  = userId,
            UpdatedByUserId  = userId,
        };
        _db.BillingTransactions.Add(tx);

        // Update running total on journey
        if (req.TransactionType is "Payment" or "Advance")
            journey.TotalPaid += req.Amount;
        if (req.TransactionType == "Advance")
            journey.TotalAdvances += req.Amount;
        journey.UpdatedAt       = DateTime.UtcNow;
        journey.UpdatedByUserId = userId;

        await _db.SaveChangesAsync();

        return new BillingTransactionDto(
            tx.Id, tx.TransactionType, tx.PaymentMode, tx.Amount,
            tx.ReferenceNumber, tx.ReceiptNumber, tx.Notes, tx.CreatedAt);
    }
}
