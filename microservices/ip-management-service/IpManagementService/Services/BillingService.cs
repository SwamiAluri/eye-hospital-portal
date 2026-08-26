using Microsoft.EntityFrameworkCore;
using IpManagementService.Data;
using IpManagementService.Models.Domain;
using IpManagementService.Models.Dtos;

namespace IpManagementService.Services;

/// <summary>
/// IP facade over Billing. OpdBill is financial SoT. Journey totals are display projections.
/// </summary>
public class BillingService
{
    private readonly IpManagementDbContext _db;
    private readonly IAuthBillingClient _billing;
    private readonly JourneyCommandAuthContext _commandAuth;

    public BillingService(
        IpManagementDbContext db,
        IAuthBillingClient? billing = null,
        JourneyCommandAuthContext? commandAuth = null)
    {
        _db = db;
        _billing = billing ?? new NoOpAuthBillingClient();
        _commandAuth = commandAuth ?? new JourneyCommandAuthContext();
    }

    public async Task<List<BillingTransactionDto>> ListAsync(Guid journeyId, Guid tenantId)
    {
        try
        {
            var summary = await _billing.GetSummaryAsync(journeyId);
            if (summary.Payments.Count > 0)
            {
                return summary.Payments.Select(p => new BillingTransactionDto(
                    p.Id,
                    p.PaymentKind ?? "Payment",
                    p.PaymentMode ?? "",
                    p.Amount,
                    null,
                    p.ReceiptNumber,
                    null,
                    p.PaymentDate)).ToList();
            }
        }
        catch
        {
            // Fall back to historical IP shadow rows for unmapped journeys.
        }

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
        var rows = await ListAsync(journeyId, tenantId);
        return rows.FirstOrDefault(r => r.Id == txnId);
    }

    public async Task<BillingTransactionDto> AddAsync(
        Guid journeyId, Guid tenantId, Guid branchId, Guid userId, AddBillingTransactionRequest req)
    {
        _commandAuth.RequireBillingMutation(req.TransactionType);
        var journey = await _db.PatientJourneys.FirstOrDefaultAsync(
            j => j.Id == journeyId && j.TenantId == tenantId && j.DeletedAt == null)
            ?? throw new KeyNotFoundException($"Journey {journeyId} not found.");

        if (journey.IsBillingLocked)
            throw new InvalidOperationException("Billing is locked for this patient.");
        if (req.Amount <= 0)
            throw new ArgumentException("Transaction amount must be greater than zero.");

        var billId = journey.OpdBillId
            ?? await _billing.EnsureBillAsync(
                tenantId, branchId, journey.PatientId, journeyId, journey.PackageAmount ?? 0m, userId);

        if (billId == Guid.Empty)
            throw new InvalidOperationException(
                "Billing OpdBill could not be created. IP no longer posts a local financial ledger.");

        journey.OpdBillId = billId;
        await _billing.RecordPaymentAsync(
            billId, userId, req.TransactionType, req.PaymentMode, req.Amount,
            req.ReferenceNumber, req.Notes,
            $"{journeyId:N}:{req.TransactionType}:{req.Amount}:{req.ReferenceNumber}");

        await RefreshProjectionAsync(journey, userId);
        await _db.SaveChangesAsync();

        var summary = await _billing.GetSummaryAsync(journeyId);
        var last = summary.Payments.OrderByDescending(p => p.PaymentDate).FirstOrDefault();
        return new BillingTransactionDto(
            last?.Id ?? Guid.Empty,
            last?.PaymentKind ?? req.TransactionType,
            last?.PaymentMode ?? req.PaymentMode,
            last?.Amount ?? req.Amount,
            req.ReferenceNumber,
            last?.ReceiptNumber,
            req.Notes,
            last?.PaymentDate ?? DateTime.UtcNow);
    }

    public Task<AuthIpFinancialSummary> GetFinancialSummaryAsync(Guid journeyId, Guid tenantId)
        => _billing.GetSummaryAsync(journeyId);

    private async Task RefreshProjectionAsync(PatientJourney journey, Guid userId)
    {
        var summary = await _billing.GetSummaryAsync(journey.Id);
        journey.PackageAmount = summary.PackageEstimate;
        journey.TotalPaid = summary.TotalCollected;
        journey.TotalAdvances = summary.Advances;
        journey.UpdatedAt = DateTime.UtcNow;
        journey.UpdatedByUserId = userId;
        if (summary.OpdBillId is { } id && id != Guid.Empty)
            journey.OpdBillId = id;
        if (summary.FinancialStatus == "partially_paid")
            journey.FinancialState = FinancialState.PartiallyPaid;
        else if (journey.FinancialState == FinancialState.NotCreated)
            journey.FinancialState = FinancialState.Confirmed;
    }
}
