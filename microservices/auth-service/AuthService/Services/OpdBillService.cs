using System;
using System.Collections.Generic;
using System.Linq;
using System.Text.Json;
using System.Threading.Tasks;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using AuthService.Context;
using AuthService.DTOs.Billing;
using AuthService.Models.Domain;
using AuthService.Services.Interfaces;

namespace AuthService.Services;

public class OpdBillService : IOpdBillService
{
    private readonly AppDbContext _context;
    private readonly ILogger<OpdBillService> _logger;
    private readonly ICcmsBillFinalizedClient _ccms;

    public OpdBillService(
        AppDbContext context,
        ILogger<OpdBillService> logger,
        ICcmsBillFinalizedClient ccms)
    {
        _context = context;
        _logger = logger;
        _ccms = ccms;
    }

    public async Task<OpdBillDto?> GetByIdAsync(Guid id)
    {
        var bill = await _context.OpdBills
            .Include(b => b.Patient)
            .Include(b => b.Branch)
            .Include(b => b.Payments)
            .Where(b => b.Id == id && b.DeletedAt == null)
            .FirstOrDefaultAsync();

        return bill == null ? null : MapToDto(bill);
    }

    public async Task<OpdBillDto?> GetByAppointmentIdAsync(Guid appointmentId)
    {
        var bill = await _context.OpdBills
            .Include(b => b.Patient)
            .Include(b => b.Branch)
            .Include(b => b.Payments)
            .Where(b => b.AppointmentId == appointmentId && b.DeletedAt == null)
            .FirstOrDefaultAsync();

        return bill == null ? null : MapToDto(bill);
    }

    // Day 8: Auto-Billing Prompt (Jan 31, 2026)
    public async Task<OpdBillDto?> GetByVisitIdAsync(Guid visitId)
    {
        // Get visit to find appointment
        var visit = await _context.Visits
            .Where(v => v.Id == visitId && v.DeletedAt == null)
            .FirstOrDefaultAsync();

        if (visit == null)
        {
            return null;
        }

        var bill = await _context.OpdBills
            .Include(b => b.Patient)
            .Include(b => b.Branch)
            .Include(b => b.Payments)
            .Where(b => b.AppointmentId == visit.AppointmentId && b.DeletedAt == null)
            .FirstOrDefaultAsync();

        return bill == null ? null : MapToDto(bill);
    }

    public async Task<List<OpdBillListDto>> GetByPatientIdAsync(Guid patientId, int page = 1, int pageSize = 20)
    {
        var bills = await _context.OpdBills
            .Include(b => b.Patient)
            .Where(b => b.PatientId == patientId && b.DeletedAt == null)
            .OrderByDescending(b => b.CreatedAt)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .ToListAsync();

        return bills.Select(MapToListDto).ToList();
    }

    public async Task<List<OpdBillListDto>> GetByBranchIdAsync(Guid branchId, DateTime? fromDate = null, DateTime? toDate = null, string? status = null, int page = 1, int pageSize = 50)
    {
        var query = _context.OpdBills
            .Include(b => b.Patient)
            .Where(b => b.BranchId == branchId && b.DeletedAt == null);

        if (fromDate.HasValue)
        {
            query = query.Where(b => b.CreatedAt >= fromDate.Value);
        }

        if (toDate.HasValue)
        {
            query = query.Where(b => b.CreatedAt <= toDate.Value);
        }

        if (!string.IsNullOrEmpty(status))
        {
            query = query.Where(b => b.Status == status);
        }

        var bills = await query
            .OrderByDescending(b => b.CreatedAt)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .ToListAsync();

        return bills.Select(MapToListDto).ToList();
    }

    public async Task<OpdBillDto> CreateBillAsync(CreateOpdBillDto request, Guid userId)
    {
        // Get appointment details
        var appointment = await _context.Appointments
            .Include(a => a.Patient)
            .Include(a => a.Department)
            .Where(a => a.Id == request.AppointmentId && a.DeletedAt == null)
            .FirstOrDefaultAsync();

        if (appointment == null)
        {
            throw new ArgumentException("Appointment not found");
        }

        // Check if bill already exists
        var existingBill = await _context.OpdBills
            .Where(b => b.AppointmentId == request.AppointmentId && b.DeletedAt == null)
            .FirstOrDefaultAsync();

        if (existingBill != null)
        {
            throw new InvalidOperationException("Bill already exists for this appointment");
        }

        // Generate bill number
        var billNumber = await GenerateBillNumberAsync(appointment.TenantId);

        // Use values from request
        decimal consultationFee = request.IsFreeVisit ? 0 : request.ConsultationFee;
        decimal registrationFee = request.RegistrationFee;
        decimal additionalCharges = request.AdditionalCharges;

        var billItems = new List<OpdBillItemDto>();

        // Add consultation item if fee > 0
        if (consultationFee > 0)
        {
            billItems.Add(new OpdBillItemDto
            {
                Sequence = 1,
                ItemType = "consultation",
                ItemCode = "CONS",
                ItemName = "Consultation Fee",
                Quantity = 1,
                UnitPrice = consultationFee,
                DiscountPercent = 0,
                Amount = consultationFee
            });
        }

        // Add registration item if fee > 0
        if (registrationFee > 0)
        {
            billItems.Add(new OpdBillItemDto
            {
                Sequence = billItems.Count + 1,
                ItemType = "registration",
                ItemCode = "REG",
                ItemName = "Registration Fee",
                Quantity = 1,
                UnitPrice = registrationFee,
                DiscountPercent = 0,
                Amount = registrationFee
            });
        }

        // Add custom items if provided
        if (request.Items != null)
        {
            int seq = billItems.Count + 1;
            foreach (var item in request.Items)
            {
                var amount = item.UnitPrice * item.Quantity * (1 - item.DiscountPercent / 100);
                billItems.Add(new OpdBillItemDto
                {
                    Sequence = seq++,
                    ItemType = item.ItemType,
                    ItemCode = item.ItemCode,
                    ItemName = item.ItemName,
                    Quantity = item.Quantity,
                    UnitPrice = item.UnitPrice,
                    DiscountPercent = item.DiscountPercent,
                    Amount = amount
                });
            }
        }

        decimal grossAmount = consultationFee + registrationFee + additionalCharges;
        decimal discountAmount = 0;
        decimal discountPercentage = request.DiscountPercentage ?? 0;

        if (discountPercentage > 0)
        {
            discountAmount = grossAmount * (discountPercentage / 100);
        }

        decimal taxAmount = request.TaxAmount;
        decimal netAmount = grossAmount - discountAmount + taxAmount;

        var bill = new OpdBill
        {
            Id = Guid.NewGuid(),
            TenantId = appointment.TenantId,
            BillNumber = billNumber,
            PatientId = request.PatientId,
            AppointmentId = appointment.Id,
            BranchId = request.BranchId,  // Use branchId from request
            BillDate = DateTime.UtcNow,
            ConsultationFee = consultationFee,
            RegistrationFee = registrationFee,
            AdditionalCharges = additionalCharges,
            GrossAmount = grossAmount,
            DiscountAmount = discountAmount,
            DiscountPercentage = discountPercentage,
            TaxAmount = taxAmount,
            NetAmount = netAmount,
            AmountPaid = 0,
            BalanceDue = netAmount,
            Status = request.IsFreeVisit ? "paid" : "generated",
            IsFreeVisit = request.IsFreeVisit,
            FreeVisitReason = request.FreeVisitReason,
            BillItems = JsonSerializer.Serialize(billItems),
            Notes = request.Notes,
            GeneratedBy = userId,
            CreatedAt = DateTime.UtcNow,
            CreatedByUserId = userId
        };

        _context.OpdBills.Add(bill);
        await _context.SaveChangesAsync();

        _logger.LogInformation("OPD Bill created: {BillNumber} for Patient {PatientId}, Amount: {Amount}, Free: {IsFree}",
            billNumber, request.PatientId, netAmount, request.IsFreeVisit);

        return (await GetByIdAsync(bill.Id))!;
    }

    public async Task<BillingCheckDto> CheckBillingRulesAsync(Guid appointmentId)
    {
        var appointment = await _context.Appointments
            .Include(a => a.Patient)
            .Where(a => a.Id == appointmentId)
            .FirstOrDefaultAsync();

        if (appointment == null)
        {
            throw new ArgumentException("Appointment not found");
        }

        var visitType = appointment.AppointmentType?.ToLower() ?? "new";
        
        var result = new BillingCheckDto
        {
            PatientId = appointment.PatientId,
            AppointmentId = appointmentId,
            VisitType = visitType,
            IsFreeVisit = false,
            RecommendedFee = 500 // Default consultation fee
        };

        // Get applicable billing rule
        var rule = await _context.BillingRules
            .Where(r => r.TenantId == appointment.TenantId 
                && r.IsActive 
                && r.DeletedAt == null
                && r.VisitType == result.VisitType)
            .OrderBy(r => r.Priority)
            .FirstOrDefaultAsync();

        if (rule != null)
        {
            result.AppliedRule = MapRuleToDto(rule);
            result.RecommendedFee = rule.DefaultFee;

            // Check if free visit applies
            if (result.VisitType != "new")
            {
                // Get previous visits for this patient
                var previousVisits = await _context.Visits
                    .Where(v => v.PatientId == appointment.PatientId 
                        && v.DeletedAt == null
                        && v.CreatedAt >= DateTime.UtcNow.AddDays(-rule.FreeDays))
                    .OrderByDescending(v => v.CreatedAt)
                    .ToListAsync();

                result.PreviousVisitsInPeriod = previousVisits.Count;
                result.LastVisitDate = previousVisits.FirstOrDefault()?.CreatedAt;

                // Check free visit conditions
                bool withinDays = previousVisits.Any();
                bool withinVisitCount = previousVisits.Count < rule.FreeVisits;

                switch (rule.Condition)
                {
                    case "first_reached":
                        result.IsFreeVisit = withinDays && withinVisitCount;
                        break;
                    case "days_only":
                        result.IsFreeVisit = withinDays;
                        break;
                    case "visits_only":
                        result.IsFreeVisit = withinVisitCount;
                        break;
                }

                if (result.IsFreeVisit)
                {
                    result.FreeVisitReason = $"{result.VisitType} visit within {rule.FreeDays} days";
                    if (rule.FreeVisits > 0)
                    {
                        result.FreeVisitReason += $" (visit {previousVisits.Count + 1} of {rule.FreeVisits})";
                    }
                    result.RecommendedFee = 0;
                }
            }
        }

        return result;
    }

    public async Task<OpdBillDto?> AddPaymentAsync(AddPaymentDto request, Guid userId)
    {
        var bill = await _context.OpdBills
            .Where(b => b.Id == request.OpdBillId && b.DeletedAt == null)
            .FirstOrDefaultAsync();

        if (bill == null)
        {
            return null;
        }

        // Check if bill is finalized (locked)
        if (bill.IsFinalized)
        {
            throw new InvalidOperationException("Bill is finalized and cannot be modified");
        }

        if (bill.Status == "paid")
        {
            throw new InvalidOperationException("Bill is already fully paid");
        }

        if (request.Amount > bill.BalanceDue)
        {
            throw new ArgumentException($"Payment amount ({request.Amount:N2}) exceeds balance due ({bill.BalanceDue:N2})");
        }

        // Generate payment reference
        var paymentRef = await GeneratePaymentReferenceAsync(bill.TenantId);
        var receiptNumber = await GenerateReceiptNumberAsync(bill.TenantId);

        var payment = new OpdBillPayment
        {
            Id = Guid.NewGuid(),
            TenantId = bill.TenantId,
            OpdBillId = bill.Id,
            PaymentReference = paymentRef,
            PaymentMode = request.PaymentMode,
            Amount = request.Amount,
            CardLastFour = request.CardLastFour,
            CardType = request.CardType,
            CardNetwork = request.CardTransactionId, // Map CardTransactionId to CardNetwork
            UpiTransactionId = request.UpiTransactionId,
            UpiId = request.UpiVpa, // Map UpiVpa to UpiId
            BankName = request.GatewayName, // Map GatewayName to BankName for online payments
            PaymentDate = DateTime.UtcNow,
            ReceivedBy = userId,
            ReceiptNumber = receiptNumber,
            Status = "completed",
            CreatedAt = DateTime.UtcNow,
            CreatedByUserId = userId
        };

        _context.OpdBillPayments.Add(payment);

        // Update bill
        bill.AmountPaid += request.Amount;
        bill.BalanceDue -= request.Amount;
        bill.UpdatedAt = DateTime.UtcNow;
        bill.UpdatedByUserId = userId;

        if (bill.BalanceDue <= 0)
        {
            bill.Status = "paid";
        }
        else
        {
            bill.Status = "partially_paid";
        }

        await _context.SaveChangesAsync();

        _logger.LogInformation("Payment added: {PaymentRef} for Bill {BillNumber}, Amount: {Amount}, Mode: {Mode}",
            paymentRef, bill.BillNumber, request.Amount, request.PaymentMode);

        return await GetByIdAsync(bill.Id);
    }

    public async Task<OpdBillDto?> ApproveCreditAsync(ApplyCreditDto request, Guid userId)
    {
        var bill = await _context.OpdBills
            .Where(b => b.Id == request.OpdBillId && b.DeletedAt == null)
            .FirstOrDefaultAsync();

        if (bill == null)
        {
            return null;
        }

        bill.IsCredit = true;
        bill.CreditApprovedBy = userId;
        bill.CreditApprovedAt = DateTime.UtcNow;
        bill.CreditNotes = request.CreditNotes;
        bill.Status = "credit_approved";
        bill.UpdatedAt = DateTime.UtcNow;
        bill.UpdatedByUserId = userId;

        await _context.SaveChangesAsync();

        _logger.LogInformation("Credit approved for Bill {BillNumber} by User {UserId}",
            bill.BillNumber, userId);

        return await GetByIdAsync(bill.Id);
    }

    public async Task<OpdBillDto?> ApplyDiscountAsync(ApplyDiscountDto request, Guid userId)
    {
        var bill = await _context.OpdBills
            .Where(b => b.Id == request.OpdBillId && b.DeletedAt == null)
            .FirstOrDefaultAsync();

        if (bill == null)
        {
            return null;
        }

        // Check if bill is finalized (locked)
        if (bill.IsFinalized)
        {
            throw new InvalidOperationException("Bill is finalized and cannot be modified");
        }

        // Cannot apply discount to paid bill
        if (bill.Status == "paid")
        {
            throw new InvalidOperationException("Cannot apply discount to paid bill");
        }

        bill.DiscountPercentage = request.DiscountPercentage;
        bill.DiscountAmount = bill.GrossAmount * (request.DiscountPercentage / 100);
        
        // Recalculate net amount
        bill.NetAmount = bill.GrossAmount - bill.DiscountAmount + bill.TaxAmount;
        bill.BalanceDue = bill.NetAmount - bill.AmountPaid;
        
        bill.UpdatedAt = DateTime.UtcNow;
        bill.UpdatedByUserId = userId;

        await _context.SaveChangesAsync();

        _logger.LogInformation("Discount applied to Bill {BillNumber}: {DiscountPercent}% - {Reason}",
            bill.BillNumber, request.DiscountPercentage, request.DiscountReason);

        return await GetByIdAsync(bill.Id);
    }

    public async Task<OpdBillDto?> FinalizeBillAsync(Guid billId, Guid userId)
    {
        var bill = await _context.OpdBills
            .Where(b => b.Id == billId && b.DeletedAt == null)
            .FirstOrDefaultAsync();

        if (bill == null)
        {
            return null;
        }

        // Check if already finalized
        if (bill.IsFinalized)
        {
            throw new InvalidOperationException("Bill is already finalized and cannot be modified");
        }

        // Mark bill as finalized (locked)
        bill.IsFinalized = true;
        bill.FinalizedAt = DateTime.UtcNow;
        bill.FinalizedByUserId = userId;
        bill.Status = "paid"; // Ensure status is paid when finalized
        bill.UpdatedAt = DateTime.UtcNow;
        bill.UpdatedByUserId = userId;

        await _context.SaveChangesAsync();

        _logger.LogInformation("Bill {BillNumber} finalized by user {UserId}", bill.BillNumber, userId);

        // Billing owns finalized bills — notify CCMS for coverage allocation (Phase 2 residual).
        // Look up latest counselling session for this patient as optional SessionId link.
        Guid? sessionId = null;
        try
        {
            sessionId = await _context.CounselingSession
                .Where(s => s.PatientId == bill.PatientId
                            && s.TenantId == bill.TenantId
                            && s.DeletedAt == null)
                .OrderByDescending(s => s.CreatedAt)
                .Select(s => (Guid?)s.Id)
                .FirstOrDefaultAsync();
        }
        catch (Exception ex)
        {
            _logger.LogDebug(ex, "Session lookup for bill-finalized skipped");
        }

        _ = _ccms.NotifyBillFinalizedAsync(
            bill.TenantId,
            journeyId: null,
            sessionId,
            bill.Id,
            bill.NetAmount,
            userId);

        return await GetByIdAsync(bill.Id);
    }

    public async Task<OpdBillDto?> CancelBillAsync(Guid billId, string reason, Guid userId)
    {
        var bill = await _context.OpdBills
            .Where(b => b.Id == billId && b.DeletedAt == null)
            .FirstOrDefaultAsync();

        if (bill == null)
        {
            return null;
        }

        bill.Status = "cancelled";
        bill.Notes = $"Cancelled: {reason}. Previous notes: {bill.Notes}";
        bill.UpdatedAt = DateTime.UtcNow;
        bill.UpdatedByUserId = userId;
        bill.DeletedAt = DateTime.UtcNow; // Soft delete

        await _context.SaveChangesAsync();

        _logger.LogInformation("Bill {BillNumber} cancelled: {Reason}", bill.BillNumber, reason);

        return await GetByIdAsync(bill.Id);
    }

    // Day 5: Bill Locking Methods (Jan 31, 2026)
    public async Task<OpdBillDto?> LockBillAsync(Guid billId, Guid userId)
    {
        var bill = await _context.OpdBills
            .Where(b => b.Id == billId && b.DeletedAt == null)
            .FirstOrDefaultAsync();

        if (bill == null)
        {
            _logger.LogWarning("Bill {BillId} not found for locking", billId);
            return null;
        }

        if (bill.IsLocked)
        {
            _logger.LogWarning("Bill {BillNumber} is already locked", bill.BillNumber);
            throw new InvalidOperationException($"Bill {bill.BillNumber} is already locked");
        }

        // Lock the bill
        bill.IsLocked = true;
        bill.LockedAt = DateTime.UtcNow;
        bill.LockedByUserId = userId;
        bill.UpdatedAt = DateTime.UtcNow;
        bill.UpdatedByUserId = userId;

        // Also finalize the bill if not already finalized
        if (!bill.IsFinalized)
        {
            bill.IsFinalized = true;
            bill.FinalizedAt = DateTime.UtcNow;
            bill.FinalizedByUserId = userId;
        }

        await _context.SaveChangesAsync();

        _logger.LogInformation("Bill {BillNumber} locked by user {UserId}", bill.BillNumber, userId);

        return await GetByIdAsync(bill.Id);
    }

    public async Task<OpdBillDto?> UnlockBillAsync(Guid billId, string reason, Guid userId)
    {
        var bill = await _context.OpdBills
            .Where(b => b.Id == billId && b.DeletedAt == null)
            .FirstOrDefaultAsync();

        if (bill == null)
        {
            _logger.LogWarning("Bill {BillId} not found for unlocking", billId);
            return null;
        }

        if (!bill.IsLocked)
        {
            _logger.LogWarning("Bill {BillNumber} is not locked", bill.BillNumber);
            throw new InvalidOperationException($"Bill {bill.BillNumber} is not locked");
        }

        if (string.IsNullOrWhiteSpace(reason))
        {
            throw new ArgumentException("Unlock reason is required for audit trail", nameof(reason));
        }

        // Unlock the bill
        bill.IsLocked = false;
        bill.UnlockedAt = DateTime.UtcNow;
        bill.UnlockedByUserId = userId;
        bill.UnlockReason = reason;
        bill.UpdatedAt = DateTime.UtcNow;
        bill.UpdatedByUserId = userId;

        await _context.SaveChangesAsync();

        _logger.LogWarning("Bill {BillNumber} unlocked by user {UserId}. Reason: {Reason}", 
            bill.BillNumber, userId, reason);

        return await GetByIdAsync(bill.Id);
    }

    public async Task<bool> IsBillLockedAsync(Guid billId)
    {
        var bill = await _context.OpdBills
            .Where(b => b.Id == billId && b.DeletedAt == null)
            .Select(b => new { b.IsLocked })
            .FirstOrDefaultAsync();

        return bill?.IsLocked ?? false;
    }

    public async Task<List<BillingRuleDto>> GetBillingRulesAsync(Guid? branchId = null)
    {
        var query = _context.BillingRules
            .Include(r => r.Branch)
            .Where(r => r.DeletedAt == null);

        if (branchId.HasValue)
        {
            query = query.Where(r => r.BranchId == branchId || r.BranchId == null);
        }

        var rules = await query
            .OrderBy(r => r.Priority)
            .ToListAsync();

        return rules.Select(MapRuleToDto).ToList();
    }

    public async Task<BillingRuleDto> CreateBillingRuleAsync(CreateBillingRuleDto request, Guid userId)
    {
        // Get tenant from context (simplified)
        var tenantId = Guid.Parse("11111111-1111-1111-1111-111111111111"); // TODO: Get from context

        var rule = new BillingRule
        {
            Id = Guid.NewGuid(),
            TenantId = tenantId,
            BranchId = request.BranchId,
            Name = request.Name,
            VisitType = request.VisitType,
            FreeDays = request.FreeDays,
            FreeVisits = request.FreeVisits,
            Condition = request.Condition,
            DefaultFee = request.DefaultFee,
            Priority = request.Priority,
            Description = request.Description,
            IsActive = true,
            CreatedAt = DateTime.UtcNow,
            CreatedByUserId = userId
        };

        _context.BillingRules.Add(rule);
        await _context.SaveChangesAsync();

        return MapRuleToDto(rule);
    }

    public async Task<BillingRuleDto?> UpdateBillingRuleAsync(Guid id, UpdateBillingRuleDto request, Guid userId)
    {
        var rule = await _context.BillingRules
            .Where(r => r.Id == id && r.DeletedAt == null)
            .FirstOrDefaultAsync();

        if (rule == null)
        {
            return null;
        }

        if (request.Name != null) rule.Name = request.Name;
        if (request.FreeDays.HasValue) rule.FreeDays = request.FreeDays.Value;
        if (request.FreeVisits.HasValue) rule.FreeVisits = request.FreeVisits.Value;
        if (request.Condition != null) rule.Condition = request.Condition;
        if (request.DefaultFee.HasValue) rule.DefaultFee = request.DefaultFee.Value;
        if (request.IsActive.HasValue) rule.IsActive = request.IsActive.Value;
        if (request.Priority.HasValue) rule.Priority = request.Priority.Value;
        if (request.Description != null) rule.Description = request.Description;

        rule.UpdatedAt = DateTime.UtcNow;
        rule.UpdatedByUserId = userId;

        await _context.SaveChangesAsync();

        return MapRuleToDto(rule);
    }

    public async Task<bool> DeleteBillingRuleAsync(Guid id, Guid userId)
    {
        var rule = await _context.BillingRules
            .Where(r => r.Id == id && r.DeletedAt == null)
            .FirstOrDefaultAsync();

        if (rule == null)
        {
            return false;
        }

        rule.DeletedAt = DateTime.UtcNow;
        rule.UpdatedByUserId = userId;

        await _context.SaveChangesAsync();

        return true;
    }

    // ============ Private Helpers ============

    private async Task<string> GenerateBillNumberAsync(Guid tenantId)
    {
        var year = DateTime.UtcNow.Year;
        var prefix = $"OPD-{year}";

        var lastBill = await _context.OpdBills
            .Where(b => b.TenantId == tenantId && b.BillNumber.StartsWith(prefix))
            .OrderByDescending(b => b.BillNumber)
            .FirstOrDefaultAsync();

        int sequence = 1;
        if (lastBill != null)
        {
            var parts = lastBill.BillNumber.Split('-');
            if (parts.Length >= 3 && int.TryParse(parts[2], out var lastSeq))
            {
                sequence = lastSeq + 1;
            }
        }

        return $"{prefix}-{sequence:D6}";
    }

    private async Task<string> GeneratePaymentReferenceAsync(Guid tenantId)
    {
        var prefix = $"PAY-{DateTime.UtcNow:yyyyMMdd}";
        
        var lastPayment = await _context.OpdBillPayments
            .Where(p => p.TenantId == tenantId && p.PaymentReference.StartsWith(prefix))
            .OrderByDescending(p => p.PaymentReference)
            .FirstOrDefaultAsync();

        int sequence = 1;
        if (lastPayment != null)
        {
            var parts = lastPayment.PaymentReference.Split('-');
            if (parts.Length >= 3 && int.TryParse(parts[2], out var lastSeq))
            {
                sequence = lastSeq + 1;
            }
        }

        return $"{prefix}-{sequence:D4}";
    }

    private async Task<string> GenerateReceiptNumberAsync(Guid tenantId)
    {
        var prefix = $"RCP-{DateTime.UtcNow:yyyyMMdd}";
        
        var lastPayment = await _context.OpdBillPayments
            .Where(p => p.TenantId == tenantId && p.ReceiptNumber != null && p.ReceiptNumber.StartsWith(prefix))
            .OrderByDescending(p => p.ReceiptNumber)
            .FirstOrDefaultAsync();

        int sequence = 1;
        if (lastPayment?.ReceiptNumber != null)
        {
            var parts = lastPayment.ReceiptNumber.Split('-');
            if (parts.Length >= 3 && int.TryParse(parts[2], out var lastSeq))
            {
                sequence = lastSeq + 1;
            }
        }

        return $"{prefix}-{sequence:D4}";
    }

    private OpdBillDto MapToDto(OpdBill bill)
    {
        var dto = new OpdBillDto
        {
            Id = bill.Id,
            TenantId = bill.TenantId,
            BillNumber = bill.BillNumber,
            PatientId = bill.PatientId,
            PatientName = bill.Patient != null 
                ? $"{bill.Patient.FirstName} {bill.Patient.LastName}".Trim() 
                : null,
            PatientMrn = bill.Patient?.MedicalRecordNumber,
            AppointmentId = bill.AppointmentId,
            BranchId = bill.BranchId,
            BranchName = bill.Branch?.Name,
            BillingRuleId = bill.BillingRuleId,
            BillDate = bill.BillDate,
            ConsultationFee = bill.ConsultationFee,
            RegistrationFee = bill.RegistrationFee,
            AdditionalCharges = bill.AdditionalCharges,
            GrossAmount = bill.GrossAmount,
            DiscountAmount = bill.DiscountAmount,
            DiscountPercentage = bill.DiscountPercentage,
            TaxAmount = bill.TaxAmount,
            NetAmount = bill.NetAmount,
            AmountPaid = bill.AmountPaid,
            BalanceDue = bill.BalanceDue,
            Status = bill.Status,
            IsFreeVisit = bill.IsFreeVisit,
            FreeVisitReason = bill.FreeVisitReason,
            IsCredit = bill.IsCredit,
            CreditApprovedBy = bill.CreditApprovedBy,
            CreditApprovedAt = bill.CreditApprovedAt,
            CreditNotes = bill.CreditNotes,
            IsInsurance = bill.IsInsurance,
            InsuranceProvider = bill.InsuranceProvider,
            InsurancePolicyNumber = bill.InsurancePolicyNumber,
            InsuranceClaimAmount = bill.InsuranceClaimAmount,
            GeneratedBy = bill.GeneratedBy,
            Notes = bill.Notes,
            CreatedAt = bill.CreatedAt,
            UpdatedAt = bill.UpdatedAt
        };

        // Parse bill items
        if (!string.IsNullOrEmpty(bill.BillItems))
        {
            try
            {
                dto.BillItems = JsonSerializer.Deserialize<List<OpdBillItemDto>>(bill.BillItems);
            }
            catch
            {
                dto.BillItems = new List<OpdBillItemDto>();
            }
        }

        // Map payments
        if (bill.Payments != null)
        {
            dto.Payments = bill.Payments
                .Select(p => new OpdBillPaymentDto
                {
                    Id = p.Id,
                    PaymentReference = p.PaymentReference,
                    PaymentMode = p.PaymentMode,
                    Amount = p.Amount,
                    PaymentDate = p.PaymentDate,
                    ReceivedByName = p.ReceivedByUser != null 
                        ? $"{p.ReceivedByUser.FirstName} {p.ReceivedByUser.LastName}".Trim() 
                        : null,
                    ReceiptNumber = p.ReceiptNumber,
                    CardType = p.CardType,
                    CardLastFour = p.CardLastFour,
                    UpiId = p.UpiId
                }).ToList();
        }

        return dto;
    }

    private OpdBillListDto MapToListDto(OpdBill bill)
    {
        return new OpdBillListDto
        {
            Id = bill.Id,
            BillNumber = bill.BillNumber,
            PatientName = bill.Patient != null 
                ? $"{bill.Patient.FirstName} {bill.Patient.LastName}".Trim() 
                : "",
            PatientMrn = bill.Patient?.MedicalRecordNumber ?? "",
            BillDate = bill.BillDate,
            NetAmount = bill.NetAmount,
            AmountPaid = bill.AmountPaid,
            BalanceDue = bill.BalanceDue,
            Status = bill.Status,
            IsFreeVisit = bill.IsFreeVisit,
            CreatedAt = bill.CreatedAt
        };
    }

    private BillingRuleDto MapRuleToDto(BillingRule rule)
    {
        return new BillingRuleDto
        {
            Id = rule.Id,
            BranchId = rule.BranchId,
            BranchName = rule.Branch?.Name,
            Name = rule.Name,
            VisitType = rule.VisitType,
            FreeDays = rule.FreeDays,
            FreeVisits = rule.FreeVisits,
            Condition = rule.Condition,
            DefaultFee = rule.DefaultFee,
            IsActive = rule.IsActive,
            Priority = rule.Priority,
            Description = rule.Description
        };
    }
}
