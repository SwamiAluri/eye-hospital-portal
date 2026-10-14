using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using AuthService.Context;
using AuthService.DTOs.Visit;
using AuthService.DTOs.Billing;
using AuthService.Models.Domain;
using AuthService.Services.Interfaces;

namespace AuthService.Services;

public class VisitService : IVisitService
{
    private readonly AppDbContext _context;
    private readonly IOpdBillService _opdBillService;
    private readonly IOptometryQueueService _optometryQueueService;
    private readonly IQueueDisplayNotifier _queueDisplayNotifier;
    private readonly ILogger<VisitService> _logger;

    public VisitService(
        AppDbContext context,
        IOpdBillService opdBillService,
        IOptometryQueueService optometryQueueService,
        IQueueDisplayNotifier queueDisplayNotifier,
        ILogger<VisitService> logger)
    {
        _context = context;
        _opdBillService = opdBillService;
        _optometryQueueService = optometryQueueService;
        _queueDisplayNotifier = queueDisplayNotifier;
        _logger = logger;
    }

    public async Task<VisitDto?> GetByIdAsync(Guid id)
    {
        var visit = await _context.Visits
            .Include(v => v.Patient)
            .Include(v => v.Appointment)
            .Include(v => v.Branch)
            .Include(v => v.Consultant)
            .Include(v => v.Department)
            .Include(v => v.OpdBill)
            .Include(v => v.CheckedInByUser)
            .Include(v => v.AssignedToUser)
            .Include(v => v.CompletedByUser)
            .Where(v => v.Id == id && v.DeletedAt == null)
            .FirstOrDefaultAsync();

        return visit == null ? null : MapToDto(visit);
    }

    public async Task<VisitDto?> GetByAppointmentIdAsync(Guid appointmentId)
    {
        var visit = await _context.Visits
            .Include(v => v.Patient)
            .Include(v => v.Appointment)
            .Include(v => v.Branch)
            .Include(v => v.Consultant)
            .Include(v => v.Department)
            .Include(v => v.OpdBill)
            .Where(v => v.AppointmentId == appointmentId && v.DeletedAt == null)
            .FirstOrDefaultAsync();

        return visit == null ? null : MapToDto(visit);
    }

    public async Task<List<VisitListDto>> GetByPatientIdAsync(Guid tenantId, Guid patientId, int page = 1, int pageSize = 20)
    {
        var visits = await _context.Visits
            .Include(v => v.Patient)
            .Include(v => v.Consultant)
            .Where(v => v.PatientId == patientId && v.TenantId == tenantId && v.DeletedAt == null)
            .OrderByDescending(v => v.CreatedAt)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .ToListAsync();

        return visits.Select(MapToListDto).ToList();
    }

    public async Task<List<VisitListDto>> GetByBranchIdAsync(Guid branchId, DateTime? date = null, string? status = null, int page = 1, int pageSize = 50)
    {
        var query = _context.Visits
            .Include(v => v.Patient)
            .Include(v => v.Consultant)
            .Include(v => v.AssignedToUser)
            .Where(v => v.BranchId == branchId && v.DeletedAt == null);

        if (date.HasValue)
        {
            var startOfDay = date.Value.Date;
            var endOfDay = startOfDay.AddDays(1);
            query = query.Where(v => v.CreatedAt >= startOfDay && v.CreatedAt < endOfDay);
        }

        if (!string.IsNullOrEmpty(status))
        {
            query = query.Where(v => v.Status == status);
        }

        var visits = await query
            .OrderByDescending(v => v.CreatedAt)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .ToListAsync();

        return visits.Select(MapToListDto).ToList();
    }

    public async Task<List<VisitQueueDto>> GetQueueAsync(Guid branchId, string? station = null, Guid? assignedTo = null)
    {
        var query = _context.Visits
            .Include(v => v.Patient)
            .Include(v => v.AssignedToUser)
            .Include(v => v.Appointment)
            .Where(v => v.BranchId == branchId 
                && v.DeletedAt == null
                && v.Status != "completed"
                && v.Status != "cancelled");

        query = ApplyStationFilter(query, station);

        if (assignedTo.HasValue)
        {
            query = query.Where(v => v.AssignedTo == assignedTo);
        }

        var visits = await query
            .OrderBy(v => v.IsEmergency ? 0 : 1)
            .ThenBy(v => v.CheckedInAt)
            .ToListAsync();

        return visits.Select(v => new VisitQueueDto
        {
            Id = v.Id,
            TokenNumber = v.TokenNumber,
            PatientName = $"{v.Patient?.FirstName} {v.Patient?.LastName}".Trim(),
            PatientMrn = v.Patient?.MedicalRecordNumber ?? "",
            VisitType = v.VisitType,
            Status = v.Status,
            CheckedInAt = v.CheckedInAt,
            WaitingMinutes = v.CheckedInAt.HasValue 
                ? (int)(DateTime.UtcNow - v.CheckedInAt.Value).TotalMinutes 
                : 0,
            CurrentStation = v.CurrentStation,
            AssignedTo = v.AssignedTo,
            AssignedToName = v.AssignedToUser != null 
                ? $"{v.AssignedToUser.FirstName} {v.AssignedToUser.LastName}".Trim() 
                : null,
            IsEmergency = v.IsEmergency,
            Priority = v.Appointment?.Priority ?? "normal"
        }).ToList();
    }

    public async Task<CheckInValidationDto> ValidateCheckInAsync(Guid appointmentId)
    {
        var result = new CheckInValidationDto();

        // 1. Check appointment exists
        var appointment = await _context.Appointments
            .Include(a => a.Patient)
            .Where(a => a.Id == appointmentId && a.DeletedAt == null)
            .FirstOrDefaultAsync();

        if (appointment == null)
        {
            result.AppointmentValid = false;
            result.AppointmentMessage = "Appointment not found";
            return result;
        }

        result.AppointmentValid = true;
        result.AppointmentMessage = "Appointment found";

        // 2. Check patient exists
        if (appointment.Patient == null)
        {
            result.PatientValid = false;
            result.PatientMessage = "Patient not found";
            return result;
        }

        result.PatientValid = true;
        result.PatientMessage = "Patient registered";

        // 3. Check bill exists
        var bill = await _context.OpdBills
            .Where(b => b.AppointmentId == appointmentId && b.DeletedAt == null)
            .FirstOrDefaultAsync();

        if (bill == null)
        {
            result.BillValid = false;
            result.BillMessage = "Bill not generated";
            return result;
        }

        result.BillValid = true;
        result.BillMessage = $"Bill #{bill.BillNumber}";
        result.BillId = bill.Id;

        // 4. Check payment status
        if (bill.IsFreeVisit)
        {
            result.PaymentValid = true;
            result.PaymentMessage = "Free visit - no payment required";
            result.AmountDue = 0;
        }
        else if (bill.IsCredit && bill.CreditApprovedBy != null)
        {
            result.PaymentValid = true;
            result.PaymentMessage = "Credit approved";
            result.AmountDue = bill.BalanceDue;
        }
        else if (bill.Status == "paid")
        {
            result.PaymentValid = true;
            result.PaymentMessage = "Payment complete";
            result.AmountDue = 0;
        }
        else
        {
            result.PaymentValid = false;
            result.PaymentMessage = $"Payment pending: ₹{bill.BalanceDue:N2}";
            result.AmountDue = bill.BalanceDue;
        }

        return result;
    }

    public async Task<CheckInResultDto> CheckInAsync(CheckInRequestDto request, Guid userId)
    {
        var result = new CheckInResultDto();

        // Validate check-in requirements
        var validation = await ValidateCheckInAsync(request.AppointmentId);
        result.Validation = validation;

        // If not emergency and validation fails
        if (!request.IsEmergency && !validation.CanCheckIn)
        {
            result.Success = false;
            result.Message = GetValidationFailureMessage(validation);
            return result;
        }

        // If emergency but basic validation fails
        if (request.IsEmergency && !validation.CanEmergencyCheckIn)
        {
            result.Success = false;
            result.Message = GetValidationFailureMessage(validation);
            return result;
        }

        // Get appointment details
        var appointment = await _context.Appointments
            .Include(a => a.Patient)
            .Where(a => a.Id == request.AppointmentId)
            .FirstOrDefaultAsync();

        if (appointment == null)
        {
            result.Success = false;
            result.Message = "Appointment not found";
            return result;
        }

        // Check if already checked in
        var existingVisit = await _context.Visits
            .Where(v => v.AppointmentId == request.AppointmentId && v.DeletedAt == null)
            .FirstOrDefaultAsync();

        if (existingVisit != null)
        {
            result.Success = false;
            result.Message = "Patient already checked in for this appointment";
            result.Visit = MapToDto(existingVisit);
            return result;
        }

        // Get bill (might not exist for emergency)
        var bill = await _context.OpdBills
            .Where(b => b.AppointmentId == request.AppointmentId && b.DeletedAt == null)
            .FirstOrDefaultAsync();

        // Branch must be derived from bill or user profile (no hardcoded / first-branch fallback).
        var branchId = bill?.BranchId;
        if (branchId == null || branchId == Guid.Empty)
        {
            var user = await _context.Users.Where(u => u.Id == userId).Select(u => new { u.BranchId }).FirstOrDefaultAsync();
            branchId = user?.BranchId;
        }
        if (branchId == null || branchId == Guid.Empty)
        {
            result.Success = false;
            result.Message = "Branch is not configured for this check-in (missing bill branch and user branch)";
            return result;
        }

        // Generate token
        var tokenNumber = await GenerateTokenAsync(branchId.Value);
        var tokenParts = tokenNumber.Split('-');
        var tokenSequence = int.Parse(tokenParts.Last());

        // Create Visit
        var visit = new Visit
        {
            Id = Guid.NewGuid(),
            TenantId = appointment.TenantId,
            PatientId = appointment.PatientId,
            AppointmentId = appointment.Id,
            OpdBillId = bill?.Id,
            BranchId = branchId.Value,
            ConsultantId = appointment.DoctorId,
            DepartmentId = appointment.DepartmentId,
            VisitType = appointment.AppointmentType?.ToLower() ?? "new",
            VisitCategory = bill?.IsFreeVisit == true ? "free" : "paid",
            Status = "checked_in",
            TokenNumber = tokenNumber,
            TokenSequence = tokenSequence,
            CheckedInAt = DateTime.UtcNow,
            CheckedInBy = userId,
            CurrentStation = "reception",
            IsEmergency = request.IsEmergency,
            EmergencyAuthorizedBy = request.IsEmergency ? userId : null,
            EmergencyReason = request.EmergencyReason,
            Notes = request.Notes,
            CreatedAt = DateTime.UtcNow,
            CreatedByUserId = userId
        };

        _context.Visits.Add(visit);

        // Update appointment status
        appointment.Status = "checked_in";
        appointment.UpdatedAt = DateTime.UtcNow;

        await _context.SaveChangesAsync();

        await _queueDisplayNotifier.NotifyBranchDisplayUpdatedAsync(visit.TenantId, visit.BranchId);

        _logger.LogInformation("Patient checked in: Visit {VisitId}, Token {Token}, Emergency: {IsEmergency}",
            visit.Id, tokenNumber, request.IsEmergency);

        // Reload with relations
        var createdVisit = await GetByIdAsync(visit.Id);
        
        result.Success = true;
        result.Message = "Check-in successful";
        result.Visit = createdVisit;
        result.TokenNumber = tokenNumber;

        return result;
    }

    public async Task<VisitDto?> SendToAsync(SendToRequestDto request, Guid userId)
    {
        var visit = await _context.Visits
            .Where(v => v.Id == request.VisitId && v.DeletedAt == null)
            .FirstOrDefaultAsync();

        if (visit == null)
        {
            return null;
        }

        visit.CurrentStation = NormalizeStation(request.Station);

        visit.AssignedTo = request.AssignToUserId;
        visit.AssignedAt = request.AssignToUserId.HasValue ? DateTime.UtcNow : null;
        if (request.AssignToUserId == null)
        {
            visit.ActiveRoomCode = null;
        }
        visit.UpdatedAt = DateTime.UtcNow;
        visit.UpdatedByUserId = userId;

        visit.Status = visit.CurrentStation switch
        {
            "reception" => "checked_in",
            "optometrist" => "with_optometrist",
            "doctor" => "with_doctor",
            "counselor" or "counsellor" => "with_counselor",
            "imaging" => "at_imaging",
            "billing" => "at_billing",
            "pharmacy" => "at_pharmacy",
            "optical" => "at_optical",
            "completed" => "completed",
            _ => "in_progress"
        };

        await _context.SaveChangesAsync();

        await _queueDisplayNotifier.NotifyBranchDisplayUpdatedAsync(visit.TenantId, visit.BranchId);

        var reasonCode = request.ReasonCode ?? request.Reason;
        if (visit.CurrentStation == "optometrist")
        {
            await _optometryQueueService.RecordStationEventAsync(
                visit.TenantId,
                visit.BranchId,
                visit.Id,
                visit.PatientId,
                "optometrist",
                "queued",
                userId,
                reasonCode: reasonCode ?? "INITIAL_REFRACTION",
                reasonNotes: request.Reason,
                assignedToUserId: request.AssignToUserId);
        }

        _logger.LogInformation("Visit {VisitId} sent to {Station}, assigned to {AssignedTo}",
            visit.Id, visit.CurrentStation, request.AssignToUserId);

        return await GetByIdAsync(visit.Id);
    }

    private static string NormalizeStation(string station)
    {
        var s = (station ?? string.Empty).Trim().ToLowerInvariant();
        return s switch
        {
            "optometry" => "optometrist",
            "counselling" => "counselor",
            "counsellor" => "counselor",
            _ => s,
        };
    }

    private static IQueryable<Visit> ApplyStationFilter(IQueryable<Visit> query, string? station)
    {
        if (string.IsNullOrEmpty(station))
        {
            return query;
        }

        var normalized = NormalizeStation(station);
        if (normalized == "optometrist")
        {
            return query.Where(v =>
                v.CurrentStation == "optometrist" || v.CurrentStation == "optometry");
        }

        return query.Where(v => v.CurrentStation == normalized);
    }

    /// <summary>
    /// Route by appointment even when check-in has not happened yet.
    /// If a visit does not exist for this appointment, creates a visit with a token and marks it checked-in.
    /// </summary>
    public async Task<VisitDto?> SendToByAppointmentAsync(Guid appointmentId, SendToRequestDto request, Guid userId)
    {
        var existing = await _context.Visits.Where(v => v.AppointmentId == appointmentId && v.DeletedAt == null).FirstOrDefaultAsync();
        if (existing == null)
        {
            var appointment = await _context.Appointments
                .Include(a => a.Patient)
                .Where(a => a.Id == appointmentId && a.DeletedAt == null)
                .FirstOrDefaultAsync();
            if (appointment == null) return null;

            // Use user branch; bill may not exist yet when routing before payment/check-in.
            var user = await _context.Users.Where(u => u.Id == userId).Select(u => new { u.BranchId }).FirstOrDefaultAsync();
            var branchId = user?.BranchId;
            if (branchId == null || branchId == Guid.Empty) return null;

            var tokenNumber = await GenerateTokenAsync(branchId.Value);
            var tokenParts = tokenNumber.Split('-');
            var tokenSequence = int.Parse(tokenParts.Last());

            existing = new Visit
            {
                Id = Guid.NewGuid(),
                TenantId = appointment.TenantId,
                PatientId = appointment.PatientId,
                AppointmentId = appointment.Id,
                BranchId = branchId.Value,
                ConsultantId = appointment.DoctorId,
                DepartmentId = appointment.DepartmentId,
                VisitType = appointment.AppointmentType?.ToLower() ?? "new",
                VisitCategory = "paid",
                Status = "checked_in",
                TokenNumber = tokenNumber,
                TokenSequence = tokenSequence,
                CheckedInAt = DateTime.UtcNow,
                CheckedInBy = userId,
                CurrentStation = "reception",
                CreatedAt = DateTime.UtcNow,
                CreatedByUserId = userId
            };
            _context.Visits.Add(existing);
            await _context.SaveChangesAsync();
        }

        // Now route using existing SendTo logic.
        request.VisitId = existing.Id;
        return await SendToAsync(request, userId);
    }

    public async Task<VisitDto?> AssignToStaffAsync(Guid visitId, Guid staffId, Guid userId)
    {
        var visit = await _context.Visits
            .Where(v => v.Id == visitId && v.DeletedAt == null)
            .FirstOrDefaultAsync();

        if (visit == null)
        {
            return null;
        }

        visit.AssignedTo = staffId;
        visit.AssignedAt = DateTime.UtcNow;
        visit.UpdatedAt = DateTime.UtcNow;
        visit.UpdatedByUserId = userId;

        await _context.SaveChangesAsync();

        return await GetByIdAsync(visit.Id);
    }

    public async Task<VisitDto?> CompleteVisitAsync(CompleteVisitRequestDto request, Guid userId)
    {
        var visit = await _context.Visits
            .Where(v => v.Id == request.VisitId && v.DeletedAt == null)
            .FirstOrDefaultAsync();

        if (visit == null)
        {
            return null;
        }

        visit.Status = "completed";
        visit.CompletedAt = DateTime.UtcNow;
        visit.CompletedBy = userId;
        visit.Outcome = request.Outcome;
        visit.OutcomeNotes = request.OutcomeNotes;
        visit.UpdatedAt = DateTime.UtcNow;
        visit.UpdatedByUserId = userId;

        // Update appointment status
        var appointment = await _context.Appointments
            .Where(a => a.Id == visit.AppointmentId)
            .FirstOrDefaultAsync();

        if (appointment != null)
        {
            appointment.Status = "Completed";
            appointment.UpdatedAt = DateTime.UtcNow;
        }

        await _context.SaveChangesAsync();

        _logger.LogInformation("Visit {VisitId} completed with outcome: {Outcome}",
            visit.Id, request.Outcome);

        return await GetByIdAsync(visit.Id);
    }

    public async Task<string> GenerateTokenAsync(Guid branchId)
    {
        var today = DateTime.UtcNow.Date;
        
        // Get or create token sequence for today
        var tokenSeq = await _context.TokenSequences
            .Where(t => t.BranchId == branchId && t.SequenceDate == today)
            .FirstOrDefaultAsync();

        if (tokenSeq == null)
        {
            // Get branch prefix
            var branch = await _context.Branches
                .Where(b => b.Id == branchId)
                .FirstOrDefaultAsync();

            var prefix = branch?.BranchCode?.ToUpper() ?? "GEN";
            if (prefix.Length > 3) prefix = prefix.Substring(0, 3);

            tokenSeq = new TokenSequence
            {
                Id = Guid.NewGuid(),
                TenantId = branch?.TenantId ?? Guid.Empty,
                BranchId = branchId,
                SequenceDate = today,
                CurrentSequence = 0,
                BranchPrefix = prefix,
                CreatedAt = DateTime.UtcNow
            };
            _context.TokenSequences.Add(tokenSeq);
        }

        // Increment sequence
        tokenSeq.CurrentSequence++;
        tokenSeq.UpdatedAt = DateTime.UtcNow;

        await _context.SaveChangesAsync();

        // Format: HYD-001
        return $"{tokenSeq.BranchPrefix}-{tokenSeq.CurrentSequence:D3}";
    }

    public async Task<int> GetTodayVisitCountAsync(Guid branchId)
    {
        var today = DateTime.UtcNow.Date;
        var tomorrow = today.AddDays(1);

        return await _context.Visits
            .Where(v => v.BranchId == branchId 
                && v.DeletedAt == null
                && v.CreatedAt >= today 
                && v.CreatedAt < tomorrow)
            .CountAsync();
    }

    public async Task<int> GetWaitingCountAsync(Guid branchId, string? station = null)
    {
        var query = _context.Visits
            .Where(v => v.BranchId == branchId 
                && v.DeletedAt == null
                && v.Status != "completed" 
                && v.Status != "cancelled");

        query = ApplyStationFilter(query, station);

        return await query.CountAsync();
    }

    /// <summary>
    /// Mark visit as walkout (patient left before completion)
    /// </summary>
    public async Task<VisitDto?> MarkWalkoutAsync(Guid visitId, string reason, Guid userId)
    {
        var visit = await _context.Visits
            .Include(v => v.Patient)
            .Include(v => v.Consultant)
            .Where(v => v.Id == visitId && v.DeletedAt == null)
            .FirstOrDefaultAsync();

        if (visit == null)
        {
            throw new InvalidOperationException("Visit not found");
        }

        if (visit.Status == "completed")
        {
            throw new InvalidOperationException("Cannot mark completed visit as walkout");
        }

        visit.Status = "walkout";
        visit.WalkoutReason = reason;
        visit.WalkoutAt = DateTime.UtcNow;
        visit.UpdatedAt = DateTime.UtcNow;
        visit.UpdatedByUserId = userId;

        await _context.SaveChangesAsync();

        _logger.LogInformation("Visit {VisitId} marked as walkout. Reason: {Reason}", visitId, reason);
        return MapToDto(visit);
    }

    /// <summary>
    /// Create emergency override for visit (allows check-in without payment)
    /// </summary>
    public async Task<VisitDto?> CreateEmergencyOverrideAsync(Guid visitId, string reason, Guid authorizedBy)
    {
        var visit = await _context.Visits
            .Include(v => v.Patient)
            .Include(v => v.Consultant)
            .Where(v => v.Id == visitId && v.DeletedAt == null)
            .FirstOrDefaultAsync();

        if (visit == null)
        {
            throw new InvalidOperationException("Visit not found");
        }

        // EmergencyOverride column removed - using IsEmergency + OverrideReason instead
        visit.OverrideReason = reason;
        visit.IsEmergency = true;
        visit.EmergencyReason = reason;
        visit.EmergencyAuthorizedBy = authorizedBy;
        visit.UpdatedAt = DateTime.UtcNow;
        visit.UpdatedByUserId = authorizedBy;

        await _context.SaveChangesAsync();

        _logger.LogInformation("Emergency override created for visit {VisitId} by user {AuthorizedBy}", visitId, authorizedBy);
        return MapToDto(visit);
    }

    // ============ Private Helpers ============

    private VisitDto MapToDto(Visit visit)
    {
        return new VisitDto
        {
            Id = visit.Id,
            TenantId = visit.TenantId,
            PatientId = visit.PatientId,
            PatientName = visit.Patient != null 
                ? $"{visit.Patient.FirstName} {visit.Patient.LastName}".Trim() 
                : null,
            PatientMrn = visit.Patient?.MedicalRecordNumber,
            AppointmentId = visit.AppointmentId,
            OpdBillId = visit.OpdBillId,
            BillNumber = visit.OpdBill?.BillNumber,
            BranchId = visit.BranchId,
            BranchName = visit.Branch?.Name,
            ConsultantId = visit.ConsultantId,
            ConsultantName = visit.Consultant != null 
                ? $"{visit.Consultant.FirstName} {visit.Consultant.LastName}".Trim() 
                : null,
            DepartmentId = visit.DepartmentId,
            DepartmentName = visit.Department?.Name,
            VisitType = visit.VisitType,
            VisitCategory = visit.VisitCategory,
            Status = visit.Status,
            TokenNumber = visit.TokenNumber,
            TokenSequence = visit.TokenSequence,
            CheckedInAt = visit.CheckedInAt,
            CheckedInBy = visit.CheckedInBy,
            CheckedInByName = visit.CheckedInByUser != null 
                ? $"{visit.CheckedInByUser.FirstName} {visit.CheckedInByUser.LastName}".Trim() 
                : null,
            CurrentStation = visit.CurrentStation,
            AssignedTo = visit.AssignedTo,
            AssignedToName = visit.AssignedToUser != null 
                ? $"{visit.AssignedToUser.FirstName} {visit.AssignedToUser.LastName}".Trim() 
                : null,
            AssignedAt = visit.AssignedAt,
            CompletedAt = visit.CompletedAt,
            CompletedBy = visit.CompletedBy,
            CompletedByName = visit.CompletedByUser != null 
                ? $"{visit.CompletedByUser.FirstName} {visit.CompletedByUser.LastName}".Trim() 
                : null,
            Outcome = visit.Outcome,
            OutcomeNotes = visit.OutcomeNotes,
            IsEmergency = visit.IsEmergency,
            EmergencyReason = visit.EmergencyReason,
            Notes = visit.Notes,
            CreatedAt = visit.CreatedAt,
            UpdatedAt = visit.UpdatedAt
        };
    }

    private VisitListDto MapToListDto(Visit visit)
    {
        return new VisitListDto
        {
            Id = visit.Id,
            PatientId = visit.PatientId,
            PatientName = visit.Patient != null 
                ? $"{visit.Patient.FirstName} {visit.Patient.LastName}".Trim() 
                : "",
            PatientMrn = visit.Patient?.MedicalRecordNumber ?? "",
            TokenNumber = visit.TokenNumber,
            VisitType = visit.VisitType,
            Status = visit.Status,
            CurrentStation = visit.CurrentStation,
            AssignedToName = visit.AssignedToUser != null 
                ? $"{visit.AssignedToUser.FirstName} {visit.AssignedToUser.LastName}".Trim() 
                : null,
            ConsultantName = visit.Consultant != null 
                ? $"{visit.Consultant.FirstName} {visit.Consultant.LastName}".Trim() 
                : null,
            CheckedInAt = visit.CheckedInAt,
            IsEmergency = visit.IsEmergency,
            CreatedAt = visit.CreatedAt
        };
    }

    private string GetValidationFailureMessage(CheckInValidationDto validation)
    {
        if (!validation.PatientValid) return validation.PatientMessage ?? "Patient validation failed";
        if (!validation.AppointmentValid) return validation.AppointmentMessage ?? "Appointment validation failed";
        if (!validation.BillValid) return validation.BillMessage ?? "Bill validation failed";
        if (!validation.PaymentValid) return validation.PaymentMessage ?? "Payment validation failed";
        return "Unknown validation error";
    }

    public async Task<OptometryQueuePatientDto?> OpenOptometryExamAsync(
        OptometryOpenExamRequestDto request,
        Guid tenantId,
        Guid userId)
    {
        const string optometristStation = "optometrist";
        var today = DateTime.UtcNow.Date;

        var patient = await _context.Patients
            .FirstOrDefaultAsync(p =>
                p.Id == request.PatientId &&
                p.TenantId == tenantId &&
                p.DeletedAt == null);

        if (patient == null)
        {
            return null;
        }

        var visit = await _context.Visits
            .Include(v => v.Appointment)
            .Where(v =>
                v.TenantId == tenantId &&
                v.BranchId == request.BranchId &&
                v.PatientId == request.PatientId &&
                v.DeletedAt == null &&
                v.CheckedInAt.HasValue &&
                v.CheckedInAt.Value.Date == today &&
                v.Status != "cancelled" &&
                v.Status != "no_show")
            .OrderByDescending(v => v.CheckedInAt)
            .FirstOrDefaultAsync();

        if (visit != null && visit.Status == "completed")
        {
            visit = null;
        }

        if (visit != null)
        {
            var station = (visit.CurrentStation ?? string.Empty).ToLowerInvariant();
            if (station != optometristStation && station != "optometry")
            {
                await SendToAsync(new SendToRequestDto
                {
                    VisitId = visit.Id,
                    Station = optometristStation,
                    ReasonCode = "DOCTOR_REQUESTED",
                    Reason = request.ChiefComplaint,
                }, userId);

                visit = await _context.Visits
                    .Include(v => v.Appointment)
                    .FirstAsync(v => v.Id == visit.Id);
            }
            else
            {
                var latestOptoEvent = await _context.VisitStationEvents
                    .Where(e => e.VisitId == visit.Id && e.Station == optometristStation)
                    .OrderByDescending(e => e.CreatedAt)
                    .Select(e => e.EventType)
                    .FirstOrDefaultAsync();

                if (latestOptoEvent is "completed" or "referred" or "skipped")
                {
                    visit.Status = "with_optometrist";
                    visit.AssignedTo = null;
                    visit.AssignedAt = null;
                    visit.ActiveRoomCode = null;
                    visit.UpdatedAt = DateTime.UtcNow;
                    visit.UpdatedByUserId = userId;
                    await _context.SaveChangesAsync();

                    await _optometryQueueService.RecordStationEventAsync(
                        tenantId,
                        request.BranchId,
                        visit.Id,
                        visit.PatientId,
                        optometristStation,
                        "queued",
                        userId,
                        reasonCode: "DOCTOR_REQUESTED",
                        reasonNotes: request.ChiefComplaint);
                }
            }
        }
        else
        {
            visit = await CreateDirectOptometryVisitAsync(
                tenantId,
                request.BranchId,
                patient,
                userId,
                request.ChiefComplaint);
        }

        await _optometryQueueService.EnsureQueueItemForVisitAsync(visit.Id, tenantId, userId);

        return await _optometryQueueService.StartAsync(
            visit.Id,
            tenantId,
            userId,
            request.RoomCode);
    }

    private async Task<Visit> CreateDirectOptometryVisitAsync(
        Guid tenantId,
        Guid branchId,
        Patient patient,
        Guid userId,
        string? chiefComplaint)
    {
        const string optometristStation = "optometrist";
        var today = DateTime.UtcNow.Date;
        var now = DateTime.UtcNow;
        var doctorId = await ResolveDoctorIdForDirectVisitAsync(tenantId, userId);
        var complaint = string.IsNullOrWhiteSpace(chiefComplaint)
            ? "Optometry examination"
            : chiefComplaint.Trim();

        var appointment = await _context.Appointments
            .Where(a =>
                a.TenantId == tenantId &&
                a.PatientId == patient.Id &&
                a.DeletedAt == null &&
                a.AppointmentDate.Date == today)
            .FirstOrDefaultAsync();

        if (appointment == null)
        {
            appointment = new Appointment
            {
                Id = Guid.NewGuid(),
                TenantId = tenantId,
                PatientId = patient.Id,
                DoctorId = doctorId,
                AppointmentDate = today,
                StartTime = new TimeSpan(now.Hour, now.Minute, 0),
                AppointmentType = "optometry-direct",
                DurationMinutes = 15,
                Priority = "normal",
                Status = "checked_in",
                ReasonForVisit = complaint,
                Notes = "Created for direct optometry examination",
                CreatedAt = now,
                UpdatedAt = now,
            };
            _context.Appointments.Add(appointment);
            await _context.SaveChangesAsync();
        }

        var tokenNumber = await GenerateTokenAsync(branchId);
        var tokenParts = tokenNumber.Split('-');
        var tokenSequence = int.Parse(tokenParts.Last());

        var visit = new Visit
        {
            Id = Guid.NewGuid(),
            TenantId = tenantId,
            PatientId = patient.Id,
            AppointmentId = appointment.Id,
            BranchId = branchId,
            ConsultantId = doctorId,
            DepartmentId = appointment.DepartmentId,
            VisitType = "review",
            VisitCategory = "free",
            Status = "with_optometrist",
            TokenNumber = tokenNumber,
            TokenSequence = tokenSequence,
            CheckedInAt = now,
            CheckedInBy = userId,
            CurrentStation = optometristStation,
            Notes = complaint,
            CreatedAt = now,
            CreatedByUserId = userId,
        };

        _context.Visits.Add(visit);
        await _context.SaveChangesAsync();

        await _queueDisplayNotifier.NotifyBranchDisplayUpdatedAsync(tenantId, branchId);

        await _optometryQueueService.RecordStationEventAsync(
            tenantId,
            branchId,
            visit.Id,
            visit.PatientId,
            optometristStation,
            "queued",
            userId,
            reasonCode: "INITIAL_REFRACTION",
            reasonNotes: complaint);

        return visit;
    }

    private async Task<Guid> ResolveDoctorIdForDirectVisitAsync(Guid tenantId, Guid fallbackUserId)
    {
        var doctorId = await _context.Appointments
            .Where(a => a.TenantId == tenantId && a.DeletedAt == null)
            .OrderByDescending(a => a.AppointmentDate)
            .Select(a => a.DoctorId)
            .FirstOrDefaultAsync();

        return doctorId != Guid.Empty ? doctorId : fallbackUserId;
    }
}
