using System;
using System.Collections.Generic;
using System.Threading.Tasks;
using AuthService.DTOs.Visit;
using AuthService.DTOs.Billing;

namespace AuthService.Services.Interfaces;

public interface IVisitService
{
    // Visit CRUD
    Task<VisitDto?> GetByIdAsync(Guid id);
    Task<VisitDto?> GetByAppointmentIdAsync(Guid appointmentId);
    Task<List<VisitListDto>> GetByPatientIdAsync(Guid tenantId, Guid patientId, int page = 1, int pageSize = 20);
    Task<List<VisitListDto>> GetByBranchIdAsync(Guid branchId, DateTime? date = null, string? status = null, int page = 1, int pageSize = 50);
    Task<List<VisitQueueDto>> GetQueueAsync(Guid branchId, string? station = null, Guid? assignedTo = null);
    
    // Check-In Operations
    Task<CheckInValidationDto> ValidateCheckInAsync(Guid appointmentId);
    Task<CheckInResultDto> CheckInAsync(CheckInRequestDto request, Guid userId);
    
    // Queue / Routing Operations
    Task<VisitDto?> SendToAsync(SendToRequestDto request, Guid userId);
    Task<VisitDto?> SendToByAppointmentAsync(Guid appointmentId, SendToRequestDto request, Guid userId);
    Task<VisitDto?> AssignToStaffAsync(Guid visitId, Guid staffId, Guid userId);
    
    // Visit Completion
    Task<VisitDto?> CompleteVisitAsync(CompleteVisitRequestDto request, Guid userId);
    
    // Token Generation
    Task<string> GenerateTokenAsync(Guid branchId);

    /// <summary>
    /// Ensures a visit exists at optometry for today and starts the exam (creates visit/appointment if needed).
    /// </summary>
    Task<OptometryQueuePatientDto?> OpenOptometryExamAsync(
        OptometryOpenExamRequestDto request,
        Guid tenantId,
        Guid userId);
    
    // Statistics
    Task<int> GetTodayVisitCountAsync(Guid branchId);
    Task<int> GetWaitingCountAsync(Guid branchId, string? station = null);
}

public interface IOpdBillService
{
    // Bill CRUD
    Task<OpdBillDto?> GetByIdAsync(Guid id);
    Task<OpdBillDto?> GetByAppointmentIdAsync(Guid appointmentId);
    Task<OpdBillDto?> GetByVisitIdAsync(Guid visitId); // Day 8: Auto-billing validation
    Task<List<OpdBillListDto>> GetByPatientIdAsync(Guid tenantId, Guid patientId, int page = 1, int pageSize = 20);
    Task AuthorizePatientBillReadAsync();
    Task<List<OpdBillListDto>> GetByBranchIdAsync(Guid branchId, DateTime? fromDate = null, DateTime? toDate = null, string? status = null, int page = 1, int pageSize = 50);
    
    // Bill Generation
    Task<OpdBillDto> CreateBillAsync(CreateOpdBillDto request, Guid userId);
    Task<BillingCheckDto> CheckBillingRulesAsync(Guid appointmentId);
    
    // Payment Operations
    Task<OpdBillDto?> AddPaymentAsync(AddPaymentDto request, Guid userId);
    Task<OpdBillDto?> ApproveCreditAsync(ApplyCreditDto request, Guid userId);
    Task<OpdBillDto?> ApplyDiscountAsync(ApplyDiscountDto request, Guid userId);
    
    // Bill Finalization
    Task<OpdBillDto?> FinalizeBillAsync(Guid billId, Guid userId);
    Task<OpdBillDto?> CancelBillAsync(Guid billId, string reason, Guid userId);
    
    // Day 5: Bill Locking (Jan 31, 2026)
    Task<OpdBillDto?> LockBillAsync(Guid billId, Guid userId);
    Task<OpdBillDto?> UnlockBillAsync(Guid billId, string reason, Guid userId);
    Task<bool> IsBillLockedAsync(Guid billId);
    
    // Billing Rules
    Task<List<BillingRuleDto>> GetBillingRulesAsync(Guid? branchId = null);
    Task<BillingRuleDto> CreateBillingRuleAsync(CreateBillingRuleDto request, Guid userId);
    Task<BillingRuleDto?> UpdateBillingRuleAsync(Guid id, UpdateBillingRuleDto request, Guid userId);
    Task<bool> DeleteBillingRuleAsync(Guid id, Guid userId);
    Task<OpdBillDto> EnsureInpatientBillAsync(EnsureInpatientBillRequest request, Guid userId);
    Task<OpdBillDto> EnsureIpBillForJourneyAsync(Guid patientJourneyId, Guid userId);
    Task<InpatientFinancialSummaryDto> GetInpatientSummaryAsync(Guid patientJourneyId);
    Task<InpatientFinancialSummaryDto?> ApplyCoverageAllocationAsync(ApplyCoverageAllocationRequest request);
    Task<IpBillingDashboardDto> GetIpBillingDashboardAsync(Guid branchId, string? preset, DateTime? fromUtc, DateTime? toUtc);
    Task<OpdBillDto?> ReversePaymentAsync(ReversePaymentRequest request, Guid userId);
    Task<int> SoftDeleteInpatientBillsForUatAsync(IReadOnlyList<Guid> journeyIds, Guid userId);
    Task<ChargeItemsResultDto> ChargeItemsAsync(ChargeItemsRequest request);
}
