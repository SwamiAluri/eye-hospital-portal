using System;
using System.Collections.Generic;
using System.Linq;
using System.Security.Claims;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Http;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using AuthService.Context;
using AuthService.DTOs.Billing;
using AuthService.Models.Domain;
using AuthService.Services.Interfaces;

namespace AuthService.Services;

public partial class OpdBillService : IOpdBillService
{
    private readonly AppDbContext _context;
    private readonly ILogger<OpdBillService> _logger;
    private readonly IBillingCcmsOutboxService _ccmsOutbox;
    private readonly INotificationService? _notifications;
    private readonly IAuditService? _audit;
    private readonly IHttpContextAccessor? _http;
    private readonly IBillItemService? _billItems;
    private readonly IChargeCatalogResolver? _catalog;
    private readonly IChargeReconciliationService? _reconciliation;
    private readonly ICcmsPatientShareLookup? _patientShare;

    public OpdBillService(
        AppDbContext context,
        ILogger<OpdBillService> logger,
        IBillingCcmsOutboxService ccmsOutbox,
        INotificationService? notifications = null,
        IAuditService? audit = null,
        IHttpContextAccessor? http = null,
        IBillItemService? billItems = null,
        IChargeCatalogResolver? catalog = null,
        IChargeReconciliationService? reconciliation = null,
        ICcmsPatientShareLookup? patientShare = null)
    {
        _context = context;
        _logger = logger;
        _ccmsOutbox = ccmsOutbox;
        _notifications = notifications;
        _audit = audit;
        _http = http;
        _billItems = billItems;
        _catalog = catalog;
        _reconciliation = reconciliation;
        _patientShare = patientShare;
    }

    private Task RequireBillPermissionAsync(params string[] codes)
        => BillingMutationAuth.RequireAsync(_http, _context, codes);

    /// <summary>
    /// Stages the financial audit row on the shared DbContext. Callers must invoke
    /// this <b>before</b> the SaveChangesAsync that commits the money change, so both
    /// land in one transaction.
    /// </summary>
    /// <remarks>
    /// Deliberately fails closed. This previously swallowed every exception and
    /// returned silently when no audit service was registered, which meant a payment
    /// could be committed with no record of who took it. An unauditable financial
    /// mutation must not happen at all.
    /// </remarks>
    private async Task StageFinancialAuditAsync(
        Guid userId, string action, Guid billId, string? oldValue, string? newValue, string? reason, Guid? journeyId)
    {
        if (_audit is null)
        {
            throw new InvalidOperationException(
                $"Financial audit is unavailable; refusing to record {action} on bill {billId}.");
        }

        await _audit.StageAsync(
            userId,
            action,
            "OpdBill",
            billId,
            details: JsonSerializer.Serialize(new
            {
                reason,
                journeyId,
                correlationId = billId,
                entity = "OpdBill",
            }),
            oldValue: oldValue,
            newValue: newValue);
    }

    private void NotifyBillingRealtime(Guid tenantId, string type, Guid billId, Guid? journeyId)
    {
        if (_notifications is null || tenantId == Guid.Empty) return;
        _ = _notifications.SendTenantNotificationAsync(
            tenantId,
            type,
            type,
            BillingRealtimeEvents.IdentityDetails(billId, journeyId));
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
        await RequireBillPermissionAsync("bill.create", "bill.update");
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
        await StageFinancialAuditAsync(userId, "BillCreated", bill.Id, null, "generated", request.Notes, bill.PatientJourneyId);
        await _context.SaveChangesAsync();
        NotifyBillingRealtime(bill.TenantId, BillingRealtimeEvents.BillCreated, bill.Id, bill.PatientJourneyId);

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
        await RequireBillPermissionAsync("bill.update");
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

        var kind = OpdBillLedgerCalculator.NormalizeKind(request.PaymentKind);
        if (request.Amount <= 0)
            throw new ArgumentException("Payment amount must be greater than zero.");

        var idempotencyKey = NormalizeMoneyIdempotencyKey(request.IdempotencyKey);
        if (idempotencyKey is not null)
        {
            var existing = await FindPaymentByIdempotencyKeyAsync(bill.TenantId, idempotencyKey);
            if (existing != null)
                return await GetByIdAsync(bill.Id);
        }

        if (kind is OpdBillLedgerCalculator.Payment or OpdBillLedgerCalculator.Advance)
        {
            await RecalculateBillFromLedgerAsync(bill, userId);
            await EnsurePatientCollectibleCapAsync(bill, request);
        }

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
            CardNetwork = request.CardTransactionId,
            UpiTransactionId = request.UpiTransactionId,
            UpiId = request.UpiVpa,
            BankName = request.GatewayName,
            PaymentDate = DateTime.UtcNow,
            ReceivedBy = userId,
            ReceiptNumber = receiptNumber,
            Status = "completed",
            PaymentKind = kind,
            IdempotencyKey = idempotencyKey,
            CreatedAt = DateTime.UtcNow,
            CreatedByUserId = userId
        };

        _context.OpdBillPayments.Add(payment);
        await RecalculateBillFromLedgerAsync(bill, userId);
        if (bill.PatientJourneyId is { } journeyId)
        {
            _ccmsOutbox.Enqueue(
                bill.TenantId,
                BillingCcmsEventTypes.PaymentReceived,
                bill.Id,
                new
                {
                    tenantId = bill.TenantId,
                    journeyId,
                    billId = bill.Id,
                    paymentId = payment.Id,
                    amount = request.Amount,
                    actorUserId = userId,
                    eventType = BillingCcmsEventTypes.PaymentReceived,
                    occurredAt = DateTime.UtcNow,
                },
                $"{BillingCcmsEventTypes.PaymentReceived}:billing:{bill.Id:N}:{payment.Id:N}");
        }
        await StageFinancialAuditAsync(
            userId, kind, bill.Id, null, request.Amount.ToString("F2"), idempotencyKey, bill.PatientJourneyId);
        try
        {
            await _context.SaveChangesAsync();
        }
        catch (DbUpdateException ex) when (BillConcurrency.IsUniqueViolation(ex) && idempotencyKey is not null)
        {
            DetachAddedPaymentsForBill(bill.Id);
            return await GetByIdAsync(bill.Id);
        }

        NotifyBillingRealtime(
            bill.TenantId,
            BillingRealtimeEvents.FromPaymentKind(request.PaymentKind),
            bill.Id,
            bill.PatientJourneyId);

        return await GetByIdAsync(bill.Id);
    }

    public async Task<OpdBillDto?> ApproveCreditAsync(ApplyCreditDto request, Guid userId)
    {
        await RequireBillPermissionAsync("bill.update");
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

        await StageFinancialAuditAsync(
            userId, "CreditApproved", bill.Id, null, "credit_approved", request.CreditNotes, bill.PatientJourneyId);
        await _context.SaveChangesAsync();

        _logger.LogInformation("Credit approved for Bill {BillNumber} by User {UserId}",
            bill.BillNumber, userId);

        return await GetByIdAsync(bill.Id);
    }

    public async Task<OpdBillDto?> ApplyDiscountAsync(ApplyDiscountDto request, Guid userId)
    {
        await RequireBillPermissionAsync("bill.update");
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

        var idempotencyKey = ResolveDiscountIdempotencyKey(request);
        var existingDiscount = await FindPaymentByIdempotencyKeyAsync(bill.TenantId, idempotencyKey);
        if (existingDiscount != null)
            return await GetByIdAsync(bill.Id);

        var discountAmount = Math.Round(bill.GrossAmount * (request.DiscountPercentage / 100m), 2, MidpointRounding.AwayFromZero);
        if (discountAmount <= 0)
            throw new ArgumentException("Discount amount must be greater than zero.");

        _context.OpdBillPayments.Add(new OpdBillPayment
        {
            Id = Guid.NewGuid(),
            TenantId = bill.TenantId,
            OpdBillId = bill.Id,
            PaymentReference = await GeneratePaymentReferenceAsync(bill.TenantId),
            PaymentMode = "adjustment",
            Amount = discountAmount,
            PaymentDate = DateTime.UtcNow,
            ReceivedBy = userId,
            ReceiptNumber = await GenerateReceiptNumberAsync(bill.TenantId),
            Status = "completed",
            PaymentKind = OpdBillLedgerCalculator.Discount,
            IdempotencyKey = idempotencyKey,
            CreatedAt = DateTime.UtcNow,
            CreatedByUserId = userId
        });

        await RecalculateBillFromLedgerAsync(bill, userId);
        await StageFinancialAuditAsync(
            userId, "Discount", bill.Id, null, discountAmount.ToString("F2"), request.DiscountReason, bill.PatientJourneyId);
        try
        {
            await _context.SaveChangesAsync();
        }
        catch (DbUpdateException ex) when (BillConcurrency.IsUniqueViolation(ex))
        {
            DetachAddedPaymentsForBill(bill.Id);
            return await GetByIdAsync(bill.Id);
        }

        _logger.LogInformation("Discount applied to Bill {BillNumber}: {DiscountPercent}% - {Reason}",
            bill.BillNumber, request.DiscountPercentage, request.DiscountReason);
        NotifyBillingRealtime(bill.TenantId, BillingRealtimeEvents.PatientObligationChanged, bill.Id, bill.PatientJourneyId);

        return await GetByIdAsync(bill.Id);
    }

    public Task<OpdBillDto?> FinalizeBillAsync(Guid billId, Guid userId)
        => FinalizeBillCoreAsync(billId, userId, alsoLock: false);

    /// <summary>
    /// Compatibility lock. Financial finalization is owned by
    /// <see cref="FinalizeBillCoreAsync"/> — this method must not set
    /// <c>IsFinalized</c> on its own.
    /// </summary>
    public Task<OpdBillDto?> LockBillAsync(Guid billId, Guid userId)
        => FinalizeBillCoreAsync(billId, userId, alsoLock: true);

    private async Task<OpdBillDto?> FinalizeBillCoreAsync(Guid billId, Guid userId, bool alsoLock)
    {
        await RequireBillPermissionAsync("bill.update");
        var bill = await _context.OpdBills
            .Where(b => b.Id == billId && b.DeletedAt == null)
            .FirstOrDefaultAsync();

        if (bill == null)
        {
            return null;
        }

        if (bill.IsFinalized)
        {
            if (alsoLock)
                await PersistLockIfNeededAsync(bill, userId);
            return await GetByIdAsync(bill.Id);
        }

        await RecalculateBillFromLedgerAsync(bill, userId);
        await EnsureInpatientFinalizationAllowedAsync(bill);
        bill.IsFinalized = true;
        bill.FinalizedAt = DateTime.UtcNow;
        bill.FinalizedByUserId = userId;
        if (bill.BalanceDue > 0)
            bill.Status = "partially_paid";
        bill.UpdatedAt = DateTime.UtcNow;
        bill.UpdatedByUserId = userId;
        ApplyLockFields(bill, userId, alsoLock);

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

        _ccmsOutbox.Enqueue(
            bill.TenantId,
            BillingCcmsEventTypes.BillFinalized,
            bill.Id,
            new
            {
                payloadVersion = 1,
                tenantId = bill.TenantId,
                journeyId = bill.PatientJourneyId,
                sessionId,
                counsellingSessionId = sessionId,
                billId = bill.Id,
                totalAmount = bill.NetAmount,
                actorUserId = userId,
                correlationId = bill.Id,
                occurredAt = DateTime.UtcNow,
                source = alsoLock ? "billing.opd.lock" : "billing.opd.finalize",
            },
            $"{BillingCcmsEventTypes.BillFinalized}:billing:{bill.Id:N}");

        await StageFinancialAuditAsync(userId, "BillFinalized", bill.Id, "open", "finalized", null, bill.PatientJourneyId);
        if (alsoLock)
            await StageFinancialAuditAsync(userId, "BillLocked", bill.Id, "unlocked", "locked", "financial override lock", bill.PatientJourneyId);
        await _context.SaveChangesAsync();

        _logger.LogInformation(
            alsoLock
                ? "Bill {BillNumber} finalized and locked by user {UserId}"
                : "Bill {BillNumber} finalized by user {UserId}",
            bill.BillNumber, userId);

        NotifyBillingRealtime(bill.TenantId, BillingRealtimeEvents.BillFinalized, bill.Id, bill.PatientJourneyId);

        return await GetByIdAsync(bill.Id);
    }

    private static void ApplyLockFields(OpdBill bill, Guid userId, bool alsoLock)
    {
        if (!alsoLock || bill.IsLocked)
            return;
        bill.IsLocked = true;
        bill.LockedAt = DateTime.UtcNow;
        bill.LockedByUserId = userId;
    }

    private async Task PersistLockIfNeededAsync(OpdBill bill, Guid userId)
    {
        if (bill.IsLocked)
            return;

        ApplyLockFields(bill, userId, alsoLock: true);
        bill.UpdatedAt = DateTime.UtcNow;
        bill.UpdatedByUserId = userId;
        await StageFinancialAuditAsync(userId, "BillLocked", bill.Id, "unlocked", "locked", "financial override lock", bill.PatientJourneyId);
        await _context.SaveChangesAsync();
        _logger.LogInformation("Bill {BillNumber} locked by user {UserId}", bill.BillNumber, userId);
    }

    /// <summary>
    /// IP/day-care lock: completeness + unpaid <em>patient</em> remaining. TPA settlement
    /// does not block. OPD bills without a journey keep the pre-existing finalize path.
    /// </summary>
    private async Task EnsureInpatientFinalizationAllowedAsync(OpdBill bill)
    {
        if (bill.PatientJourneyId is not Guid journeyId || journeyId == Guid.Empty)
            return;

        if (_reconciliation is null)
            throw new InvalidOperationException(
                "Cannot finalize inpatient bill: charge completeness is unavailable.");

        var completeness = await _reconciliation.GetCompletenessAsync(bill.TenantId, bill.Id, journeyId);
        if (completeness.ImplantsMissingCharge > 0
            || completeness.ConsumablesPending > 0
            || completeness.ExceptionsOpen > 0)
        {
            var detail = completeness.Warnings.Count > 0
                ? string.Join(" ", completeness.Warnings)
                : "Charge completeness is incomplete.";
            throw new InvalidOperationException(
                $"Cannot finalize: {detail} Resolve missing or unmapped charges before locking the bill.");
        }

        var (obligation, _, _) = await ResolvePatientObligationAsync(
            bill, bill.NetAmount, bill.InsuranceClaimAmount, bill.AmountPaid, failClosedIfCoverageShareUnavailable: true);
        if (obligation.PatientBalance > 0.009m)
            throw new InvalidOperationException(
                $"Cannot finalize: patient balance due ₹{obligation.PatientBalance:N2}. TPA/payer settlement does not block finalize.");
    }

    /// <summary>
    /// Same CCMS patient share the IP discharge gate reads from validate-admission.
    /// When a coverage case exists, that share wins over billed − InsuranceClaimAmount.
    /// </summary>
    private async Task<(PatientObligationCalculator.Snapshot Obligation, decimal? CcmsShare, bool CcmsAvailable)>
        ResolvePatientObligationAsync(
            OpdBill bill,
            decimal billedAmount,
            decimal payerResponsibility,
            decimal collected,
            bool failClosedIfCoverageShareUnavailable)
    {
        decimal? ccmsShare = null;
        var ccmsAvailable = false;
        if (bill.PatientJourneyId is Guid journeyId && journeyId != Guid.Empty && _patientShare is not null)
        {
            var lookup = await _patientShare.GetAsync(bill.TenantId, journeyId);
            ccmsAvailable = lookup.ServiceAvailable;
            if (!lookup.ServiceAvailable)
            {
                if (failClosedIfCoverageShareUnavailable
                    && (bill.IsInsurance || bill.InsuranceClaimAmount > 0))
                {
                    throw new InvalidOperationException(
                        "Cannot finalize: CCMS patient obligation is unavailable. Discharge and finalize use the same coverage share.");
                }
            }
            else if (lookup.HasCoverageCase)
            {
                ccmsShare = lookup.PatientShare;
            }
        }

        var obligation = PatientObligationCalculator.Compute(
            billedAmount, payerResponsibility, collected, ccmsShare);
        return (obligation, ccmsShare, ccmsAvailable);
    }

    private static bool IsPayerSettlementTender(string? paymentMode)
        => string.Equals(paymentMode?.Trim(), "insurance", StringComparison.OrdinalIgnoreCase);

    /// <summary>
    /// Patient cash/card/UPI/online cannot exceed remaining patient obligation
    /// (live CCMS share when a coverage case exists). Insurance tenders still
    /// cap on TPA-inclusive ledger remaining. Advance is not a bypass.
    /// </summary>
    private async Task EnsurePatientCollectibleCapAsync(OpdBill bill, AddPaymentDto request)
    {
        if (IsPayerSettlementTender(request.PaymentMode))
        {
            if (request.Amount > bill.BalanceDue && bill.BalanceDue >= 0)
            {
                throw new ArgumentException(
                    $"Payment amount ({request.Amount:N2}) exceeds balance due ({bill.BalanceDue:N2})");
            }
            return;
        }

        decimal cap;
        var insured = bill.IsInsurance || bill.InsuranceClaimAmount > 0;
        if (bill.PatientJourneyId is Guid && bill.PatientJourneyId != Guid.Empty)
        {
            var (obligation, _, ccmsAvailable) = await ResolvePatientObligationAsync(
                bill, bill.NetAmount, bill.InsuranceClaimAmount, bill.AmountPaid,
                failClosedIfCoverageShareUnavailable: false);
            if (insured && _patientShare is not null && !ccmsAvailable)
            {
                throw new ArgumentException(
                    "Cannot collect: CCMS patient obligation is unavailable.");
            }
            cap = PatientObligationCalculator.CollectiblePatientCap(obligation, bill.BalanceDue);
        }
        else
        {
            cap = bill.BalanceDue >= 0 ? bill.BalanceDue : 0;
        }

        if (request.Amount > cap)
        {
            throw new ArgumentException(
                $"Payment amount ({request.Amount:N2}) exceeds collectible patient due ({cap:N2})");
        }
    }

    public async Task<OpdBillDto?> CancelBillAsync(Guid billId, string reason, Guid userId)
    {
        await RequireBillPermissionAsync("bill.update");
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

        await StageFinancialAuditAsync(userId, "BillCancelled", bill.Id, "open", "cancelled", reason, bill.PatientJourneyId);
        await _context.SaveChangesAsync();

        _logger.LogInformation("Bill {BillNumber} cancelled: {Reason}", bill.BillNumber, reason);

        return await GetByIdAsync(bill.Id);
    }

    public async Task<OpdBillDto?> UnlockBillAsync(Guid billId, string reason, Guid userId)
    {
        await RequireBillPermissionAsync("bill.update");
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

        await StageFinancialAuditAsync(userId, "BillUnlocked", bill.Id, "locked", "unlocked", reason, bill.PatientJourneyId);
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

    private async Task<long> NextSequenceValueAsync(string sequenceName)
    {
        var sql = sequenceName switch
        {
            "opd_receipt_number_seq" => "SELECT nextval('opd_receipt_number_seq') AS \"Value\"",
            "opd_payment_reference_seq" => "SELECT nextval('opd_payment_reference_seq') AS \"Value\"",
            "opd_bill_number_seq" => "SELECT nextval('opd_bill_number_seq') AS \"Value\"",
            _ => throw new InvalidOperationException($"Unknown billing sequence '{sequenceName}'.")
        };
        return await _context.Database.SqlQueryRaw<long>(sql).SingleAsync();
    }

    private async Task<long> NextSequenceValueAsync(params string[] sequenceNames)
    {
        Exception? last = null;
        foreach (var name in sequenceNames)
        {
            try
            {
                return await NextSequenceValueAsync(name);
            }
            catch (Exception ex)
            {
                last = ex;
            }
        }
        throw last ?? new InvalidOperationException("No billing sequence is available.");
    }

    private async Task<string> GeneratePaymentReferenceAsync(Guid tenantId)
    {
        var prefix = $"PAY-{DateTime.UtcNow:yyyyMMdd}";
        try
        {
            var sequence = await NextSequenceValueAsync("opd_payment_reference_seq", "opd_bill_number_seq");
            return $"{prefix}-{sequence:D8}";
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Payment reference sequence unavailable; using unique fallback.");
            return $"{prefix}-{Guid.NewGuid():N}";
        }
    }

    private async Task<string> GenerateReceiptNumberAsync(Guid tenantId)
    {
        var prefix = $"RCP-{DateTime.UtcNow:yyyyMMdd}";
        long sequence;
        try
        {
            sequence = await NextSequenceValueAsync("opd_receipt_number_seq");
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Receipt sequence unavailable; using unique fallback receipt.");
            sequence = Math.Abs(Guid.NewGuid().GetHashCode());
        }

        return $"{prefix}-{sequence:D8}";
    }

    public async Task RecalculateBillFromLedgerAsync(OpdBill bill, Guid userId)
    {
        // AddPayment / complete-refund post the ledger line then recalculate
        // before SaveChanges. A database-only query would miss the in-flight row
        // and persist AmountPaid = 0 beside a completed payment.
        var persisted = await _context.OpdBillPayments
            .AsNoTracking()
            .Where(p => p.OpdBillId == bill.Id)
            .Select(p => new { p.Id, p.PaymentKind, p.Amount, p.Status })
            .ToListAsync();
        var added = _context.OpdBillPayments.Local
            .Where(p => p.OpdBillId == bill.Id && _context.Entry(p).State == EntityState.Added)
            .Select(p => new { p.Id, p.PaymentKind, p.Amount, p.Status })
            .ToList();

        var lines = persisted.Concat(added)
            .Select(p => new OpdBillLedgerCalculator.Line(
                string.IsNullOrWhiteSpace(p.PaymentKind) ? OpdBillLedgerCalculator.Payment : p.PaymentKind,
                p.Amount,
                p.Status))
            .ToList();

        var snap = OpdBillLedgerCalculator.Compute(
            bill.GrossAmount,
            bill.TaxAmount,
            bill.InsuranceClaimAmount,
            bill.IsFinalized,
            lines);

        bill.DiscountAmount = snap.DiscountTotal;
        bill.NetAmount = snap.BilledAmount;
        bill.AmountPaid = snap.Collected;
        bill.BalanceDue = snap.BalanceDue;
        if (bill.Status is not ("cancelled" or "credit_approved"))
            bill.Status = snap.DerivedStatus;
        bill.UpdatedAt = DateTime.UtcNow;
        bill.UpdatedByUserId = userId;
    }

    /// <summary>Append-only refund line already posted; notify hub + CCMS without rewriting payment history.</summary>
    public void PublishRefundPosted(OpdBill bill, Guid refundId, Guid actorUserId)
    {
        if (bill.PatientJourneyId is { } journeyId)
        {
            _ccmsOutbox.Enqueue(
                bill.TenantId,
                BillingCcmsEventTypes.PatientObligationChanged,
                bill.Id,
                new
                {
                    tenantId = bill.TenantId,
                    journeyId,
                    billId = bill.Id,
                    refundId,
                    actorUserId,
                    eventType = BillingRealtimeEvents.RefundCreated,
                    occurredAt = DateTime.UtcNow,
                },
                $"{BillingCcmsEventTypes.PatientObligationChanged}:billing:{bill.Id:N}:refund:{refundId:N}");
        }
        NotifyBillingRealtime(bill.TenantId, BillingRealtimeEvents.RefundCreated, bill.Id, bill.PatientJourneyId);
    }

    public async Task<OpdBillDto> EnsureInpatientBillAsync(EnsureInpatientBillRequest request, Guid userId)
    {
        if (request.PatientJourneyId == Guid.Empty)
            throw new ArgumentException("PatientJourneyId is required.");

        var packageAmount = Math.Max(0, request.PackageAmount);
        var existing = await _context.OpdBills.FirstOrDefaultAsync(
            b => b.PatientJourneyId == request.PatientJourneyId && b.DeletedAt == null);

        if (existing != null && (existing.IsFinalized || existing.IsLocked))
            return (await GetByIdAsync(existing.Id))!;

        var bill = existing ?? new OpdBill
        {
            Id = Guid.NewGuid(),
            TenantId = request.TenantId,
            BillNumber = $"IP-{DateTime.UtcNow.Year}-{Guid.NewGuid().ToString("N")[..8].ToUpperInvariant()}",
            PatientId = request.PatientId,
            AppointmentId = null,
            PatientJourneyId = request.PatientJourneyId,
            BranchId = request.BranchId,
            BillDate = DateTime.UtcNow,
            AdditionalCharges = packageAmount,
            GrossAmount = packageAmount,
            NetAmount = packageAmount,
            AmountPaid = 0,
            BalanceDue = packageAmount,
            Status = "generated",
            Notes = request.Notes ?? "Inpatient journey bill",
            GeneratedBy = userId,
            CreatedAt = DateTime.UtcNow,
            CreatedByUserId = userId
        };

        var isNew = existing is null;
        PackageExplosionPlan? plan = null;
        if (!bill.IsFinalized && !bill.IsLocked && _billItems is not null && _catalog is not null)
            plan = await PlanPackageExplosionAsync(bill, request);

        if (plan is { Failed.Count: > 0 })
        {
            foreach (var fail in plan.Failed)
            {
                await _catalog!.EnqueueUnmappedAsync(bill.TenantId, new ChargeExceptionEnqueueRequest
                {
                    PackageTemplateId = plan.TemplateId,
                    PackageComponentId = fail.ComponentId,
                    SourceType = BillChargeSource.Package,
                    SourceRefId = fail.ComponentId,
                    OpdBillId = isNew ? null : bill.Id,
                    PatientJourneyId = request.PatientJourneyId,
                    Quantity = 1,
                    EstimatedValue = 0,
                    Reason = fail.Reason,
                    IdempotencyKey = fail.IdempotencyKey,
                });
            }

            throw new ChargePostingException(
                ChargePostingCodes.PackageComponentUnmapped,
                "Package explosion blocked: one or more components are unmapped. Nothing was posted.",
                isNew ? null : bill.Id,
                plan.Failed.Select(f => f.Reason).ToList());
        }

        if (isNew)
        {
            _context.OpdBills.Add(bill);
            await StageFinancialAuditAsync(userId, "BillCreated", bill.Id, null, "generated", request.Notes, bill.PatientJourneyId);
            await _context.SaveChangesAsync();
            NotifyBillingRealtime(bill.TenantId, BillingRealtimeEvents.BillCreated, bill.Id, bill.PatientJourneyId);
        }

        var exploded = false;
        if (plan is { Lines.Count: > 0 })
        {
            exploded = await ApplyPackagePlanAsync(bill, plan, userId);
            if (exploded)
            {
                await StageFinancialAuditAsync(
                    userId, "PackageExploded", bill.Id, null, bill.GrossAmount.ToString("F2"), "BILL-031", bill.PatientJourneyId);
                if (bill.PatientJourneyId is { } journeyId)
                {
                    _ccmsOutbox.Enqueue(
                        bill.TenantId,
                        BillingCcmsEventTypes.PatientObligationChanged,
                        bill.Id,
                        new
                        {
                            tenantId = bill.TenantId,
                            journeyId,
                            billId = bill.Id,
                            actorUserId = userId,
                            eventType = BillingRealtimeEvents.PatientObligationChanged,
                            occurredAt = DateTime.UtcNow,
                        },
                        $"{BillingCcmsEventTypes.PatientObligationChanged}:billing:{bill.Id:N}:package:{plan.TemplateId:N}");
                }
            }
        }
        else if (!isNew && packageAmount > 0 && packageAmount != bill.GrossAmount)
        {
            var hasPackageLines = await _context.Set<OpdBillItem>().AnyAsync(i =>
                i.OpdBillId == bill.Id && i.DeletedAt == null
                && (i.SourceType == BillChargeSource.Package || i.SourceType == BillChargeSource.PackageDiscount));
            if (!hasPackageLines)
            {
                bill.AdditionalCharges = packageAmount;
                bill.GrossAmount = packageAmount;
                await RecalculateBillFromLedgerAsync(bill, userId);
            }
        }

        await _context.SaveChangesAsync();
        if (exploded)
            NotifyBillingRealtime(bill.TenantId, BillingRealtimeEvents.PatientObligationChanged, bill.Id, bill.PatientJourneyId);
        return (await GetByIdAsync(bill.Id))!;
    }

    public async Task<OpdBillDto> EnsureIpBillForJourneyAsync(Guid patientJourneyId, Guid userId)
    {
        await RequireBillPermissionAsync("bill.create");
        await RequireBillPermissionAsync("ip.billing.collect", "bill.update");

        if (patientJourneyId == Guid.Empty)
            throw new ArgumentException("PatientJourneyId is required.");

        var journey = await _context.PatientJourneys
            .AsNoTracking()
            .FirstOrDefaultAsync(j => j.Id == patientJourneyId);
        if (journey is null)
            throw new KeyNotFoundException("Patient journey was not found.");
        if (!IpEnsureBillRules.IsEligible(journey))
            throw new InvalidOperationException("A bill cannot be created for a cancelled or discharged admission.");
        if (journey.BranchId is null || journey.BranchId == Guid.Empty)
            throw new InvalidOperationException("This admission has no branch; a bill cannot be created.");

        return await EnsureInpatientBillAsync(new EnsureInpatientBillRequest
        {
            TenantId = journey.TenantId,
            BranchId = journey.BranchId.Value,
            PatientId = journey.PatientId,
            PatientJourneyId = journey.Id,
            PackageAmount = journey.PackageAmount ?? 0,
            ActorUserId = userId,
            Notes = "Cashier census collect",
        }, userId);
    }

    public async Task<InpatientFinancialSummaryDto> GetInpatientSummaryAsync(Guid patientJourneyId)
    {
        var bill = await _context.OpdBills
            .Include(b => b.Payments)
            .FirstOrDefaultAsync(b => b.PatientJourneyId == patientJourneyId && b.DeletedAt == null);

        if (bill == null)
        {
            return new InpatientFinancialSummaryDto
            {
                FinancialStatus = "not_created",
                FinancialBlockers = ["No Billing OpdBill is linked to this journey."]
            };
        }

        var lines = (bill.Payments ?? [])
            .Select(p => new OpdBillLedgerCalculator.Line(
                string.IsNullOrWhiteSpace(p.PaymentKind) ? OpdBillLedgerCalculator.Payment : p.PaymentKind,
                p.Amount,
                p.Status))
            .ToList();
        var snap = OpdBillLedgerCalculator.Compute(
            bill.GrossAmount, bill.TaxAmount, bill.InsuranceClaimAmount, bill.IsFinalized, lines);
        var (obligation, ccmsShare, ccmsAvailable) = await ResolvePatientObligationAsync(
            bill, snap.BilledAmount, snap.InsuranceResponsibility, snap.Collected,
            failClosedIfCoverageShareUnavailable: false);

        var blockers = new List<string>();
        if (obligation.PatientBalance > 0)
            blockers.Add($"Patient balance due ₹{obligation.PatientBalance:N2}.");
        if (bill.IsInsurance && snap.InsuranceResponsibility > 0 && !bill.IsFinalized)
            blockers.Add("Insurance/TPA claim is pending settlement in Billing.");
        if (_patientShare is not null && bill.PatientJourneyId is Guid && !ccmsAvailable
            && (bill.IsInsurance || bill.InsuranceClaimAmount > 0))
            blockers.Add("CCMS patient share is unavailable; obligation is using the Billing projection until CCMS responds.");

        return new InpatientFinancialSummaryDto
        {
            OpdBillId = bill.Id,
            BillNumber = bill.BillNumber,
            PackageEstimate = bill.GrossAmount,
            BilledAmount = snap.BilledAmount,
            DiscountTotal = snap.DiscountTotal,
            PatientResponsibility = obligation.PatientResponsibility,
            InsuranceResponsibility = obligation.PayerResponsibility,
            PatientPaid = obligation.PatientPaid,
            PatientBalance = obligation.PatientBalance,
            CcmsPatientShare = ccmsShare,
            CcmsPatientShareAvailable = ccmsShare.HasValue,
            TotalCollected = snap.Collected,
            Advances = snap.Advances,
            RefundsAndReversals = snap.RefundsAndReversals,
            BalanceDue = snap.BalanceDue,
            FinancialStatus = snap.DerivedStatus,
            IsFinalized = bill.IsFinalized,
            HasPendingClaim = bill.IsInsurance && snap.InsuranceResponsibility > 0,
            FinancialBlockers = blockers,
            Payments = bill.Payments?.Select(p => new OpdBillPaymentDto
            {
                Id = p.Id,
                PaymentReference = p.PaymentReference,
                PaymentMode = p.PaymentMode,
                Amount = p.Amount,
                PaymentDate = p.PaymentDate,
                ReceiptNumber = p.ReceiptNumber,
                PaymentKind = p.PaymentKind,
            }).ToList() ?? []
        };
    }

    public async Task<InpatientFinancialSummaryDto?> ApplyCoverageAllocationAsync(ApplyCoverageAllocationRequest request)
    {
        OpdBill? bill = null;
        if (request.OpdBillId is { } billId && billId != Guid.Empty)
            bill = await _context.OpdBills.Include(b => b.Payments)
                .FirstOrDefaultAsync(b => b.Id == billId && b.DeletedAt == null);
        if (bill is null && request.PatientJourneyId is { } journeyId && journeyId != Guid.Empty)
            bill = await _context.OpdBills.Include(b => b.Payments)
                .FirstOrDefaultAsync(b => b.PatientJourneyId == journeyId && b.DeletedAt == null);
        if (bill is null) return null;

        bill.IsInsurance = request.PayerResponsibility > 0;
        bill.InsuranceClaimAmount = Math.Max(0, request.PayerResponsibility);
        bill.UpdatedAt = DateTime.UtcNow;
        bill.UpdatedByUserId = request.ActorUserId == Guid.Empty ? bill.CreatedByUserId : request.ActorUserId;
        await RecalculateBillFromLedgerAsync(bill, bill.UpdatedByUserId ?? bill.CreatedByUserId);
        if (bill.PatientJourneyId is { } jid)
        {
            var actor = request.ActorUserId == Guid.Empty ? bill.CreatedByUserId : request.ActorUserId;
            _ccmsOutbox.Enqueue(
                bill.TenantId,
                BillingCcmsEventTypes.PatientObligationChanged,
                bill.Id,
                new
                {
                    tenantId = bill.TenantId,
                    journeyId = jid,
                    billId = bill.Id,
                    amount = request.PatientResponsibility,
                    actorUserId = actor,
                    eventType = BillingCcmsEventTypes.PatientObligationChanged,
                    occurredAt = DateTime.UtcNow,
                },
                $"{BillingCcmsEventTypes.PatientObligationChanged}:billing:{bill.Id:N}:{request.PayerResponsibility:0.00}:{request.PatientResponsibility:0.00}");
        }
        await _context.SaveChangesAsync();
        NotifyBillingRealtime(bill.TenantId, BillingRealtimeEvents.PatientObligationChanged, bill.Id, bill.PatientJourneyId);
        if (bill.PatientJourneyId is not Guid linkedJourney)
            return null;
        var summary = await GetInpatientSummaryAsync(linkedJourney);
        if (request.PatientResponsibility > 0)
        {
            var ob = PatientObligationCalculator.Compute(
                summary.BilledAmount,
                summary.InsuranceResponsibility,
                summary.TotalCollected,
                request.PatientResponsibility);
            summary.PatientResponsibility = ob.PatientResponsibility;
            summary.PatientPaid = ob.PatientPaid;
            summary.PatientBalance = ob.PatientBalance;
        }
        return summary;
    }

    public async Task<IpBillingDashboardDto> GetIpBillingDashboardAsync(
        Guid branchId, string? preset, DateTime? fromUtc, DateTime? toUtc)
    {
        await RequireBillPermissionAsync(
            "bill.view", "opd_bill.view", "bill.update", "ip.view", "ward.checklist.edit");
        var (from, to, label) = IpBillingDashboardCalculator.ResolveRange(preset, fromUtc, toUtc, DateTime.UtcNow);

        var bills = await _context.OpdBills
            .AsNoTracking()
            .Include(b => b.Payments)
            .Include(b => b.Patient)
            .Where(b => b.BranchId == branchId && b.DeletedAt == null && b.PatientJourneyId != null)
            .Where(b =>
                (b.BillDate >= from && b.BillDate < to)
                || b.Payments.Any(p => p.PaymentDate >= from && p.PaymentDate < to)
                || b.BalanceDue > 0
                || b.RefundStatus == "requested"
                || b.RefundStatus == "approved")
            .ToListAsync();

        var journeyIds = bills
            .Where(b => b.PatientJourneyId.HasValue)
            .Select(b => b.PatientJourneyId!.Value)
            .Distinct()
            .ToList();

        var journeys = new Dictionary<Guid, PatientJourneyReadOnly>();
        try
        {
            journeys = await _context.PatientJourneys.AsNoTracking()
                .Where(j => journeyIds.Contains(j.Id) && j.DeletedAt == null)
                .ToDictionaryAsync(j => j.Id);
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "patient_journey join unavailable for IP billing dashboard");
        }

        var ccmsByJourney = new Dictionary<Guid, CcmsCoverageCaseReadOnly>();
        try
        {
            var cases = await _context.CcmsCoverageCases.AsNoTracking()
                .Where(c => c.DeletedAt == null && c.JourneyId != null && journeyIds.Contains(c.JourneyId.Value))
                .ToListAsync();
            ccmsByJourney = cases
                .GroupBy(c => c.JourneyId!.Value)
                .ToDictionary(g => g.Key, g => g.OrderByDescending(x => x.ApprovedAmount).First());
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "ccms_coverage_cases join unavailable for IP billing dashboard");
        }

        var facts = bills.Select(b =>
        {
            var patient = b.Patient;
            var name = patient == null
                ? "Unknown patient"
                : string.Join(" ", new[] { patient.FirstName, patient.LastName }.Where(s => !string.IsNullOrWhiteSpace(s)));
            PatientJourneyReadOnly? journey = null;
            if (b.PatientJourneyId is { } jid)
                journeys.TryGetValue(jid, out journey);
            CcmsCoverageCaseReadOnly? ccms = null;
            if (b.PatientJourneyId is { } cid)
                ccmsByJourney.TryGetValue(cid, out ccms);

            var mrn = !string.IsNullOrWhiteSpace(journey?.Uhid)
                ? journey!.Uhid
                : patient?.MedicalRecordNumber;

            return new IpBillingDashboardCalculator.BillFact(
                b.Id,
                b.PatientId,
                b.PatientJourneyId,
                b.BillNumber,
                b.BillDate,
                b.GrossAmount,
                b.TaxAmount,
                b.InsuranceClaimAmount,
                b.IsFinalized,
                b.IsInsurance,
                b.Status,
                string.IsNullOrWhiteSpace(name) ? "Unknown patient" : name,
                mrn,
                b.InsuranceProvider,
                (b.Payments ?? [])
                    .Select(p => new IpBillingDashboardCalculator.PaymentFact(
                        p.PaymentKind, p.Amount, p.Status, p.PaymentDate, p.PaymentMode))
                    .ToList(),
                journey?.AdmittedAt,
                ccms?.PayerType,
                IsCcmsClaimOpen(ccms?.CurrentState));
        }).ToList();

        var result = IpBillingDashboardCalculator.Compute(facts, from, to, label);

        var unbilled = new UnbilledActivityDto();
        IReadOnlyDictionary<Guid, JourneyChargeStatusDto> chargeByJourney =
            new Dictionary<Guid, JourneyChargeStatusDto>();
        if (_reconciliation is not null)
        {
            var tenantId = ResolveTenantId(bills);
            if (tenantId != Guid.Empty)
            {
                try
                {
                    unbilled = await _reconciliation.GetUnbilledActivityAsync(tenantId, branchId, from, to);
                    var statusIds = result.Patients
                        .Where(p => p.JourneyId is Guid)
                        .Select(p => p.JourneyId!.Value)
                        .Distinct()
                        .ToList();
                    chargeByJourney = await _reconciliation.GetChargeStatusByJourneyAsync(tenantId, statusIds);
                }
                catch (Exception ex)
                {
                    _logger.LogWarning(ex, "Charge reconciliation unavailable for IP billing dashboard");
                }
            }
        }

        return new IpBillingDashboardDto
        {
            FromUtc = result.FromUtc,
            ToUtcExclusive = result.ToUtcExclusive,
            RangeLabel = result.RangeLabel,
            BilledDateBasis = result.BilledDateBasis,
            CollectionDateBasis = result.CollectionDateBasis,
            AdmissionDateBasis = result.AdmissionDateBasis,
            PatientCount = result.PatientCount,
            PendingRefundCount = bills.Count(b =>
                b.RefundStatus.Equals("requested", StringComparison.OrdinalIgnoreCase)
                || b.RefundStatus.Equals("approved", StringComparison.OrdinalIgnoreCase)),
            PendingRefundAmount = bills
                .Where(b =>
                    b.RefundStatus.Equals("requested", StringComparison.OrdinalIgnoreCase)
                    || b.RefundStatus.Equals("approved", StringComparison.OrdinalIgnoreCase))
                .Sum(b => b.RefundAmount ?? 0),
            PendingCreditApprovalCount = bills.Count(b => b.IsCredit && b.CreditApprovedAt == null),
            PackageEstimate = result.PackageEstimate,
            TotalBilled = result.TotalBilled,
            TotalCollected = result.TotalCollected,
            PatientOutstanding = result.PatientOutstanding,
            PayerOutstanding = result.PayerOutstanding,
            Refunds = result.Refunds,
            Adjustments = result.Adjustments,
            Pipeline = result.Pipeline.Select(p => new IpBillingNamedCountDto
            {
                Key = p.Key, Label = p.Label, Count = p.Count, BilledAmount = p.BilledAmount
            }).ToList(),
            PaymentInstruments = result.PaymentInstruments.Select(p => new IpBillingNamedAmountDto
            {
                Key = p.Key, Label = p.Label, Amount = p.Amount
            }).ToList(),
            PayerMix = result.PayerMix.Select(p => new IpBillingNamedAmountDto
            {
                Key = p.Key, Label = p.Label, Amount = p.Amount
            }).ToList(),
            Aging = result.Aging.Select(a => new IpBillingAgingDto
            {
                Key = a.Key, Label = a.Label, Count = a.Count,
                PatientOutstanding = a.PatientOutstanding, PayerOutstanding = a.PayerOutstanding
            }).ToList(),
            UnbilledActivityCount = unbilled.Count,
            UnbilledActivityAmount = unbilled.Amount,
            UnbilledImplantCount = unbilled.ImplantCount,
            UnbilledConsumableCount = unbilled.ConsumableCount,
            UnmappedExceptionCount = unbilled.UnmappedExceptionCount,
            Patients = result.Patients.Select(r =>
            {
                JourneyChargeStatusDto? status = null;
                if (r.JourneyId is Guid jid)
                    chargeByJourney.TryGetValue(jid, out status);
                return new IpBillingPatientRowDto
                {
                    BillId = r.BillId,
                    PatientId = r.PatientId,
                    JourneyId = r.JourneyId,
                    PatientName = r.PatientName,
                    Mrn = r.Mrn,
                    AdmissionDate = r.AdmissionDate,
                    BillDate = r.BillDate,
                    BillNumber = r.BillNumber,
                    BilledAmount = r.BilledAmount,
                    PatientResponsibility = r.PatientResponsibility,
                    PayerResponsibility = r.PayerResponsibility,
                    Collected = r.Collected,
                    PatientOutstanding = r.PatientOutstanding,
                    PayerOutstanding = r.PayerOutstanding,
                    Lifecycle = r.Lifecycle,
                    LastTransactionAt = r.LastTransactionAt,
                    ChargeStatus = status?.Status ?? ChargeStatusClassifier.Complete,
                    ChargeStatusLabel = status?.Label ?? "Complete",
                };
            }).ToList()
        };
    }

    private Guid ResolveTenantId(IReadOnlyList<OpdBill> bills)
    {
        var http = _http?.HttpContext;
        var raw = http?.User.FindFirst("tenant_id")?.Value
                  ?? http?.User.FindFirst("TenantId")?.Value
                  ?? http?.Request.Headers["X-Tenant-ID"].FirstOrDefault();
        if (Guid.TryParse(raw, out var fromClaim) && fromClaim != Guid.Empty)
            return fromClaim;
        if (http?.Items["TenantId"] is Guid fromItems && fromItems != Guid.Empty)
            return fromItems;
        if (http?.Items["TenantId"] is string s && Guid.TryParse(s, out var parsed) && parsed != Guid.Empty)
            return parsed;
        return bills.Select(b => b.TenantId).FirstOrDefault(t => t != Guid.Empty);
    }

    private static bool IsCcmsClaimOpen(string? state)
    {
        if (string.IsNullOrWhiteSpace(state)) return false;
        var s = state.ToUpperInvariant();
        if (s.Contains("SETTLED") || s.Contains("CLOSED") || s.Contains("VOID") || s.Contains("CANCEL"))
            return false;
        return s.Contains("CLAIM") || s.Contains("CASE_OPEN") || s.Contains("PREAUTH");
    }

    public async Task<OpdBillDto?> ReversePaymentAsync(ReversePaymentRequest request, Guid userId)
    {
        await RequireBillPermissionAsync("bill.update", "opd_bill.refund");
        var original = await _context.OpdBillPayments
            .FirstOrDefaultAsync(p => p.Id == request.OriginalPaymentId && p.OpdBillId == request.OpdBillId);
        if (original == null) return null;

        if (original.PaymentKind is OpdBillLedgerCalculator.Reversal or OpdBillLedgerCalculator.Refund)
            throw new InvalidOperationException("Cannot reverse a reversal or refund line.");

        var reversalKey = $"rev:{original.Id:N}";
        var already = await _context.OpdBillPayments.FirstOrDefaultAsync(
            p => p.ReversedPaymentId == original.Id && p.PaymentKind == OpdBillLedgerCalculator.Reversal)
            ?? await FindPaymentByIdempotencyKeyAsync(original.TenantId, reversalKey);
        if (already != null)
            return await GetByIdAsync(request.OpdBillId);

        var bill = await _context.OpdBills.FirstAsync(b => b.Id == request.OpdBillId && b.DeletedAt == null);
        if (bill.IsFinalized)
            throw new InvalidOperationException("Bill is finalized and cannot be modified");

        _context.OpdBillPayments.Add(new OpdBillPayment
        {
            Id = Guid.NewGuid(),
            TenantId = bill.TenantId,
            OpdBillId = bill.Id,
            PaymentReference = await GeneratePaymentReferenceAsync(bill.TenantId),
            PaymentMode = original.PaymentMode,
            Amount = original.Amount,
            PaymentDate = DateTime.UtcNow,
            ReceivedBy = userId,
            ReceiptNumber = await GenerateReceiptNumberAsync(bill.TenantId),
            Status = "completed",
            PaymentKind = OpdBillLedgerCalculator.Reversal,
            ReversedPaymentId = original.Id,
            IdempotencyKey = reversalKey,
            CreatedAt = DateTime.UtcNow,
            CreatedByUserId = userId
        });
        await RecalculateBillFromLedgerAsync(bill, userId);
        if (bill.PatientJourneyId is { } jid)
        {
            _ccmsOutbox.Enqueue(
                bill.TenantId,
                BillingCcmsEventTypes.PaymentReversed,
                bill.Id,
                new
                {
                    tenantId = bill.TenantId,
                    journeyId = jid,
                    billId = bill.Id,
                    paymentId = original.Id,
                    amount = original.Amount,
                    actorUserId = userId,
                    eventType = BillingCcmsEventTypes.PaymentReversed,
                    occurredAt = DateTime.UtcNow,
                },
                $"{BillingCcmsEventTypes.PaymentReversed}:billing:{bill.Id:N}:{original.Id:N}");
        }
        await StageFinancialAuditAsync(userId, "Reversal", bill.Id, original.Id.ToString(), original.Amount.ToString("F2"), request.Reason, bill.PatientJourneyId);
        try
        {
            await _context.SaveChangesAsync();
        }
        catch (DbUpdateException ex) when (BillConcurrency.IsUniqueViolation(ex))
        {
            DetachAddedPaymentsForBill(bill.Id);
            return await GetByIdAsync(bill.Id);
        }
        NotifyBillingRealtime(bill.TenantId, BillingRealtimeEvents.PaymentReversed, bill.Id, bill.PatientJourneyId);
        return await GetByIdAsync(bill.Id);
    }

    private Task<OpdBillPayment?> FindPaymentByIdempotencyKeyAsync(Guid tenantId, string idempotencyKey)
        => _context.OpdBillPayments.FirstOrDefaultAsync(
            p => p.TenantId == tenantId && p.IdempotencyKey == idempotencyKey);

    private static string? NormalizeMoneyIdempotencyKey(string? key)
        => string.IsNullOrWhiteSpace(key) ? null : key.Trim();

    /// <summary>
    /// Client retry key wins. Legacy callers without a key still cannot double-post the same
    /// percent + reason (double-click). A second intentional discount must send a unique key.
    /// </summary>
    private static string ResolveDiscountIdempotencyKey(ApplyDiscountDto request)
    {
        var supplied = NormalizeMoneyIdempotencyKey(request.IdempotencyKey);
        if (supplied is not null) return supplied;

        var reason = (request.DiscountReason ?? string.Empty).Trim().ToUpperInvariant();
        var hash = Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(reason)))[..8];
        return $"disc:{request.OpdBillId:N}:{request.DiscountPercentage:0.##}:{hash}";
    }

    private void DetachAddedPaymentsForBill(Guid billId)
    {
        foreach (var entry in _context.ChangeTracker.Entries<OpdBillPayment>()
                     .Where(e => e.State == EntityState.Added && e.Entity.OpdBillId == billId)
                     .ToList())
        {
            entry.State = EntityState.Detached;
        }
    }

    public async Task<int> SoftDeleteInpatientBillsForUatAsync(IReadOnlyList<Guid> journeyIds, Guid userId)
    {
        if (journeyIds.Count == 0) return 0;
        var bills = await _context.OpdBills
            .Where(b => b.PatientJourneyId != null
                        && journeyIds.Contains(b.PatientJourneyId.Value)
                        && b.DeletedAt == null)
            .ToListAsync();
        var now = DateTime.UtcNow;
        foreach (var bill in bills)
        {
            bill.DeletedAt = now;
            bill.UpdatedAt = now;
            bill.UpdatedByUserId = userId;
            bill.Notes = $"{bill.Notes} | UAT-RESET";
        }
        await _context.SaveChangesAsync();
        return bills.Count;
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
            AppointmentId = bill.AppointmentId ?? Guid.Empty,
            PatientJourneyId = bill.PatientJourneyId,
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
            IsLocked = bill.IsLocked,
            IsFinalized = bill.IsFinalized,
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
                    PaymentKind = p.PaymentKind,
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
