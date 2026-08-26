using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using AuthService.Context;
using AuthService.Models.Domain;
using AuthService.Services;
using Microsoft.AspNetCore.Http;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;

namespace AuthService.Services
{
    /// <summary>
    /// Service for refund management - requests, authorization, and processing
    /// </summary>
    public class RefundService : IRefundService
    {
        private readonly AppDbContext _context;
        private readonly ILogger<RefundService> _logger;
        private readonly OpdBillService _bills;
        private readonly IAuditService? _audit;
        private readonly IHttpContextAccessor? _http;

        public RefundService(
            AppDbContext context,
            ILogger<RefundService> logger,
            OpdBillService bills,
            IAuditService? audit = null,
            IHttpContextAccessor? http = null)
        {
            _context = context;
            _logger = logger;
            _bills = bills;
            _audit = audit;
            _http = http;
        }

        private Task RequireRefundPermissionAsync(params string[] codes)
            => BillingMutationAuth.RequireAsync(_http, _context, codes);

        /// <summary>
        /// Stages the refund audit row on the shared DbContext. Callers must invoke this
        /// <b>before</b> the SaveChangesAsync that commits the refund, so both land in one
        /// transaction. Fails closed: a refund that cannot be audited must not be recorded.
        /// </summary>
        private async Task StageRefundAuditAsync(
            Guid userId, string action, Guid refundId, Guid billId, string? oldValue, string? newValue, string? reason)
        {
            if (_audit is null)
            {
                throw new InvalidOperationException(
                    $"Refund audit is unavailable; refusing to record {action} for refund {refundId} on bill {billId}.");
            }

            await _audit.StageAsync(userId, action, "Refund", refundId, details: reason, oldValue: oldValue, newValue: newValue);
        }

        public async Task<Refund> RequestRefundAsync(
            Guid billId,
            decimal amount,
            string reason,
            Guid requestedBy,
            string? refundMode = null,
            string? notes = null)
        {
            try
            {
                await RequireRefundPermissionAsync("opd_bill.refund");
                _logger.LogInformation("Requesting refund for BillId: {BillId}, Amount: {Amount}", billId, amount);

                if (billId == Guid.Empty)
                {
                    throw new InvalidOperationException("opdBillId is required");
                }

                if (string.IsNullOrWhiteSpace(reason))
                {
                    throw new InvalidOperationException("refundReason is required");
                }

                var billQuery = _context.OpdBills
                    .Where(b => b.Id == billId && b.DeletedAt == null);
                var tenantId = CurrentTenantId();
                if (tenantId.HasValue)
                {
                    billQuery = billQuery.Where(b => b.TenantId == tenantId.Value);
                }

                var bill = await billQuery.FirstOrDefaultAsync();

                if (bill == null)
                {
                    throw new InvalidOperationException("Bill not found");
                }

                if (string.Equals(bill.Status, "cancelled", StringComparison.OrdinalIgnoreCase))
                {
                    throw new InvalidOperationException("Cannot refund a cancelled bill.");
                }

                if (bill.AmountPaid <= 0)
                {
                    throw new InvalidOperationException("Bill has already been fully refunded");
                }

                if (amount <= 0 || amount > bill.AmountPaid)
                {
                    throw new InvalidOperationException($"Invalid refund amount. Amount paid: {bill.AmountPaid}");
                }

                var reserved = await _context.Refunds
                    .Where(r => r.BillId == billId
                        && (r.Status == "pending" || r.Status == "approved"))
                    .SumAsync(r => r.RefundAmount);
                if (amount + reserved > bill.AmountPaid)
                {
                    throw new InvalidOperationException(
                        $"Refund would exceed amount paid. Amount paid: {bill.AmountPaid}; already requested: {reserved}");
                }

                var visit = await _context.Visits
                    .Where(v => v.OpdBillId == billId && v.DeletedAt == null)
                    .FirstOrDefaultAsync();

                var refund = new Refund
                {
                    Id = Guid.NewGuid(),
                    BillId = billId,
                    PatientId = bill.PatientId,
                    VisitId = visit?.Id,
                    RefundAmount = amount,
                    RefundReason = reason.Trim(),
                    RefundMode = string.IsNullOrWhiteSpace(refundMode) ? null : refundMode.Trim(),
                    Notes = string.IsNullOrWhiteSpace(notes) ? null : notes.Trim(),
                    RequestedByUserId = requestedBy,
                    RequestedAt = DateTime.UtcNow,
                    Status = "pending",
                    TenantId = bill.TenantId,
                    CreatedAt = DateTime.UtcNow
                };

                _context.Refunds.Add(refund);
                bill.RefundReason = reason.Trim();
                await ProjectRefundHeaderAsync(bill);

                await StageRefundAuditAsync(requestedBy, "RefundRequested", refund.Id, billId, null, amount.ToString("F2"), reason);
                await _context.SaveChangesAsync();

                _logger.LogInformation("Refund request created successfully. RefundId: {RefundId}", refund.Id);
                return refund;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error requesting refund for BillId: {BillId}", billId);
                throw;
            }
        }

        public async Task<Refund?> GetRefundByIdAsync(Guid refundId)
        {
            return await _context.Refunds
                .Include(r => r.Bill)
                .Include(r => r.Patient)
                .Include(r => r.RequestedByUser)
                .Include(r => r.AuthorizedByUser)
                .Where(r => r.Id == refundId)
                .FirstOrDefaultAsync();
        }

        public async Task<List<Refund>> GetRefundsByBillIdAsync(Guid billId)
        {
            return await _context.Refunds
                .Include(r => r.RequestedByUser)
                .Include(r => r.AuthorizedByUser)
                .Where(r => r.BillId == billId)
                .OrderByDescending(r => r.CreatedAt)
                .ToListAsync();
        }

        public async Task<List<Refund>> GetRefundsByPatientIdAsync(Guid patientId)
        {
            return await _context.Refunds
                .Include(r => r.Bill)
                .Include(r => r.RequestedByUser)
                .Include(r => r.AuthorizedByUser)
                .Where(r => r.PatientId == patientId)
                .OrderByDescending(r => r.CreatedAt)
                .ToListAsync();
        }

        public async Task<List<Refund>> GetPendingRefundsAsync(Guid tenantId)
        {
            return await _context.Refunds
                .Include(r => r.Bill)
                .Include(r => r.Patient)
                .Include(r => r.RequestedByUser)
                .Where(r => r.TenantId == tenantId && r.Status == "pending")
                .OrderBy(r => r.RequestedAt)
                .ToListAsync();
        }

        public async Task<Refund> AuthorizeRefundAsync(Guid refundId, bool approved, Guid authorizedBy, string? notes = null)
        {
            try
            {
                await RequireRefundPermissionAsync("opd_bill.refund.authorize");
                var refund = await _context.Refunds
                    .Include(r => r.Bill)
                    .Where(r => r.Id == refundId)
                    .FirstOrDefaultAsync();

                if (refund == null)
                {
                    throw new InvalidOperationException($"Refund with ID {refundId} not found");
                }

                if (refund.Status != "pending")
                {
                    throw new InvalidOperationException($"Refund is not in pending status. Current status: {refund.Status}");
                }

                refund.Status = approved ? "approved" : "rejected";
                refund.AuthorizedByUserId = authorizedBy;
                refund.AuthorizedAt = DateTime.UtcNow;
                
                if (!string.IsNullOrEmpty(notes))
                {
                    refund.Notes = notes;
                }

                if (refund.Bill != null)
                    await ProjectRefundHeaderAsync(refund.Bill);

                await StageRefundAuditAsync(
                    authorizedBy,
                    approved ? "RefundApproved" : "RefundRejected",
                    refundId,
                    refund.BillId,
                    "pending",
                    refund.Status,
                    notes);
                await _context.SaveChangesAsync();

                _logger.LogInformation("Refund {RefundId} {Status} by {AuthorizedBy}", 
                    refundId, refund.Status, authorizedBy);
                return refund;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error authorizing refund {RefundId}", refundId);
                throw;
            }
        }

        public async Task<Refund> CompleteRefundAsync(Guid refundId, string refundMode, string? notes = null)
        {
            try
            {
                await RequireRefundPermissionAsync("opd_bill.refund");
                var refund = await _context.Refunds
                    .Include(r => r.Bill)
                    .Where(r => r.Id == refundId)
                    .FirstOrDefaultAsync();

                if (refund == null)
                {
                    throw new InvalidOperationException($"Refund with ID {refundId} not found");
                }

                if (string.Equals(refund.Status, "completed", StringComparison.OrdinalIgnoreCase))
                {
                    if (refund.Bill != null)
                    {
                        await ProjectRefundHeaderAsync(refund.Bill);
                        await _context.SaveChangesAsync();
                    }
                    return refund;
                }

                if (refund.Status != "approved")
                {
                    throw new InvalidOperationException($"Refund must be approved before completion. Current status: {refund.Status}");
                }

                refund.Status = "completed";
                refund.RefundMode = refundMode;
                
                if (!string.IsNullOrEmpty(notes))
                {
                    refund.Notes = (refund.Notes ?? "") + "\n" + notes;
                }

                if (refund.Bill != null)
                {
                    var refundKey = $"refund:{refund.Id:N}";
                    var alreadyPosted = await _context.OpdBillPayments.AnyAsync(
                        p => p.TenantId == refund.Bill.TenantId && p.IdempotencyKey == refundKey);
                    if (!alreadyPosted)
                    {
                        _context.OpdBillPayments.Add(new OpdBillPayment
                        {
                            Id = Guid.NewGuid(),
                            TenantId = refund.Bill.TenantId,
                            OpdBillId = refund.Bill.Id,
                            PaymentReference = $"REF-{refund.Id:N}",
                            PaymentMode = string.IsNullOrWhiteSpace(refundMode) ? "cash" : refundMode,
                            Amount = refund.RefundAmount,
                            PaymentDate = DateTime.UtcNow,
                            Status = "completed",
                            PaymentKind = OpdBillLedgerCalculator.Refund,
                            IdempotencyKey = refundKey,
                            CreatedAt = DateTime.UtcNow,
                            CreatedByUserId = refund.RequestedByUserId ?? Guid.Empty
                        });
                    }
                    await _bills.RecalculateBillFromLedgerAsync(refund.Bill, refund.RequestedByUserId ?? Guid.Empty);
                    await ProjectRefundHeaderAsync(refund.Bill);
                }

                await StageRefundAuditAsync(
                    refund.RequestedByUserId ?? Guid.Empty,
                    "RefundCompleted",
                    refundId,
                    refund.BillId,
                    "approved",
                    "completed",
                    notes);
                await _context.SaveChangesAsync();

                _logger.LogInformation("Refund {RefundId} completed via {RefundMode}", refundId, refundMode);
                if (refund.Bill != null)
                    _bills.PublishRefundPosted(refund.Bill, refund.Id, refund.RequestedByUserId ?? Guid.Empty);
                return refund;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error completing refund {RefundId}", refundId);
                throw;
            }
        }

        public async Task<Refund> RejectRefundAsync(Guid refundId, Guid rejectedBy, string reason)
        {
            return await AuthorizeRefundAsync(refundId, false, rejectedBy, reason);
        }

        public async Task<RefundStatistics> GetRefundStatisticsAsync(Guid tenantId, DateTime? fromDate = null, DateTime? toDate = null)
        {
            try
            {
                var query = _context.Refunds
                    .Where(r => r.TenantId == tenantId);

                if (fromDate.HasValue)
                {
                    query = query.Where(r => r.CreatedAt >= fromDate.Value);
                }

                if (toDate.HasValue)
                {
                    query = query.Where(r => r.CreatedAt <= toDate.Value);
                }

                var refunds = await query.ToListAsync();

                return new RefundStatistics
                {
                    TotalRequests = refunds.Count,
                    PendingRequests = refunds.Count(r => r.Status == "pending"),
                    ApprovedRequests = refunds.Count(r => r.Status == "approved"),
                    CompletedRequests = refunds.Count(r => r.Status == "completed"),
                    RejectedRequests = refunds.Count(r => r.Status == "rejected"),
                    TotalRefundAmount = refunds.Sum(r => r.RefundAmount),
                    CompletedRefundAmount = refunds.Where(r => r.Status == "completed").Sum(r => r.RefundAmount)
                };
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error getting refund statistics for TenantId: {TenantId}", tenantId);
                throw;
            }
        }

        /// <summary>
        /// Header refund_status / refund_amount are projections of refunds rows, not last-write.
        /// pending &gt; approved &gt; completed &gt; rejected. Rejecting a sibling cannot unwind a completed payout.
        /// </summary>
        private async Task ProjectRefundHeaderAsync(OpdBill bill)
        {
            var persisted = await _context.Refunds.AsNoTracking()
                .Where(r => r.BillId == bill.Id)
                .Select(r => new { r.Id, r.Status, r.RefundAmount })
                .ToListAsync();
            var byId = persisted.ToDictionary(r => r.Id, r => (r.Status, r.RefundAmount));
            foreach (var local in _context.Refunds.Local.Where(r => r.BillId == bill.Id))
                byId[local.Id] = (local.Status, local.RefundAmount);

            var rows = byId.Values.ToList();
            if (rows.Any(r => r.Status == "pending"))
            {
                bill.RefundStatus = "requested";
                bill.RefundAmount = rows.Where(r => r.Status == "pending").Sum(r => r.RefundAmount);
            }
            else if (rows.Any(r => r.Status == "approved"))
            {
                bill.RefundStatus = "approved";
                bill.RefundAmount = rows.Where(r => r.Status == "approved").Sum(r => r.RefundAmount);
            }
            else if (rows.Any(r => r.Status == "completed"))
            {
                bill.RefundStatus = "completed";
                bill.RefundAmount = rows.Where(r => r.Status == "completed").Sum(r => r.RefundAmount);
            }
            else if (rows.Any(r => r.Status == "rejected"))
            {
                bill.RefundStatus = "rejected";
                bill.RefundAmount = rows.Where(r => r.Status == "rejected").Sum(r => r.RefundAmount);
            }
            else
            {
                bill.RefundStatus = "none";
                bill.RefundAmount = null;
            }

            bill.UpdatedAt = DateTime.UtcNow;
        }

        private Guid? CurrentTenantId()
        {
            if (_http?.HttpContext?.Items["TenantId"] is Guid fromItems && fromItems != Guid.Empty)
            {
                return fromItems;
            }

            var claim = _http?.HttpContext?.User?.FindFirst("tenant_id")?.Value;
            if (Guid.TryParse(claim, out var fromClaim) && fromClaim != Guid.Empty)
            {
                return fromClaim;
            }

            return null;
        }
    }
}
