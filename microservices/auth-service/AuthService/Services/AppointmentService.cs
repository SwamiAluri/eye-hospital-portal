using AuthService.Context;
using AuthService.Models.Domain;
using AuthService.Models.Domain.Dtos;
using Microsoft.EntityFrameworkCore;
using System.Linq;

namespace AuthService.Services;

public interface IAppointmentService
{
    Task<PagedResult<Appointment>> GetAllAppointmentsAsync(
        Guid tenantId, 
        DateTime? fromDate = null, 
        DateTime? toDate = null,
        string? status = null,
        int page = 1, 
        int pageSize = 10);
    Task<PagedResult<Appointment>> GetDoctorAppointmentsAsync(
        Guid doctorId, 
        Guid tenantId, 
        DateTime? fromDate = null,
        DateTime? toDate = null,
        string? status = null,
        int page = 1, 
        int pageSize = 10);
    Task<PagedResult<Appointment>> GetPatientAppointmentsAsync(
        Guid patientId, 
        Guid tenantId,
        DateTime? fromDate = null,
        DateTime? toDate = null,
        string? status = null,
        int page = 1, 
        int pageSize = 10);
    Task<Appointment?> GetAppointmentByIdAsync(Guid id, Guid tenantId);
    Task<Appointment> CreateAppointmentAsync(Appointment appointment);
    Task<Appointment?> UpdateAppointmentAsync(Appointment appointment);
    Task<Appointment?> CancelAppointmentAsync(Guid id, Guid tenantId, string reason);
    Task<bool> DeleteAppointmentAsync(Guid id, Guid tenantId);
    Task<bool> IsDoctorAvailable(Guid doctorId, DateTime appointmentDate, int durationMinutes, Guid? excludeAppointmentId = null);
    
    // Enhanced methods
    Task<ConflictCheckResponse> CheckConflictsAsync(ConflictCheckRequest request, Guid tenantId);
    Task<DoctorAvailabilityResponse> GetDoctorAvailabilityAsync(DoctorAvailabilityRequest request, Guid tenantId);
    Task<SuggestedSlotsResponse> GetSuggestedTimeSlotsAsync(SuggestedSlotsRequest request, Guid tenantId);
    Task<Appointment> RescheduleAppointmentAsync(RescheduleAppointmentRequest request, Guid tenantId);
    Task<BulkOperationResponse> BulkUpdateAppointmentsAsync(BulkUpdateAppointmentsRequest request, Guid tenantId);
    Task<BulkOperationResponse> BulkCancelAppointmentsAsync(BulkCancelAppointmentsRequest request, Guid tenantId);
    Task<AppointmentStatsResponse> GetStatisticsAsync(AppointmentStatsRequest request, Guid tenantId);
    Task<RecurringAppointmentsResponse> CreateRecurringAppointmentsAsync(CreateRecurringRequest request, Guid tenantId);
    Task<RecurringAppointmentsResponse> UpdateRecurringSeriesAsync(Guid parentAppointmentId, Appointment updatedData, Guid tenantId);
    Task<ReminderResponse> SendReminderAsync(SendReminderRequest request, Guid tenantId);
    Task<UpcomingRemindersResponse> GetUpcomingRemindersAsync(DateTime startDate, Guid tenantId);
    Task<DoctorAvailabilityResponse> ManageDoctorAvailabilityAsync(ManageAvailabilityRequest request, Guid tenantId);
    Task BlockTimeSlotsAsync(Guid doctorId, BlockedTimeDto blockedTime, Guid tenantId);
}

public class AppointmentService : IAppointmentService
{
    private readonly AppDbContext _context;
    private readonly ILogger<AppointmentService> _logger;

    public AppointmentService(AppDbContext context, ILogger<AppointmentService> logger)
    {
        _context = context;
        _logger = logger;
    }

    public async Task<PagedResult<Appointment>> GetAllAppointmentsAsync(
        Guid tenantId, 
        DateTime? fromDate = null, 
        DateTime? toDate = null,
        string? status = null,
        int page = 1, 
        int pageSize = 10)
    {
        var query = _context.Appointments
            .Include(a => a.Patient)
            .Include(a => a.Doctor)
            .Where(a => a.TenantId == tenantId);

        if (fromDate.HasValue)
            query = query.Where(a => a.AppointmentDate >= fromDate.Value);

        if (toDate.HasValue)
            query = query.Where(a => a.AppointmentDate <= toDate.Value);

        if (!string.IsNullOrEmpty(status))
            query = query.Where(a => a.Status.ToLower() == status.ToLower());

        var totalCount = await query.CountAsync();
        
        var items = await query
            .OrderBy(a => a.AppointmentDate)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .ToListAsync();

        return new PagedResult<Appointment>
        {
            Items = items,
            TotalCount = totalCount,
            CurrentPage = page,
            PageSize = pageSize
        };
    }

    public async Task<PagedResult<Appointment>> GetDoctorAppointmentsAsync(
        Guid doctorId, 
        Guid tenantId, 
        DateTime? fromDate = null,
        DateTime? toDate = null,
        string? status = null,
        int page = 1, 
        int pageSize = 10)
    {
        var query = _context.Appointments
            .Include(a => a.Patient)
            .Where(a => a.DoctorId == doctorId && a.TenantId == tenantId);

        if (fromDate.HasValue)
            query = query.Where(a => a.AppointmentDate >= fromDate.Value);

        if (toDate.HasValue)
            query = query.Where(a => a.AppointmentDate <= toDate.Value);

        if (!string.IsNullOrEmpty(status))
            query = query.Where(a => a.Status.ToLower() == status.ToLower());

        var totalCount = await query.CountAsync();
        
        var items = await query
            .OrderBy(a => a.AppointmentDate)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .ToListAsync();

        return new PagedResult<Appointment>
        {
            Items = items,
            TotalCount = totalCount,
            CurrentPage = page,
            PageSize = pageSize
        };
    }

    public async Task<PagedResult<Appointment>> GetPatientAppointmentsAsync(
        Guid patientId, 
        Guid tenantId,
        DateTime? fromDate = null,
        DateTime? toDate = null,
        string? status = null,
        int page = 1, 
        int pageSize = 10)
    {
        var query = _context.Appointments
            .Include(a => a.Doctor)
            .Where(a => a.PatientId == patientId && a.TenantId == tenantId && a.DeletedAt == null);

        if (fromDate.HasValue)
            query = query.Where(a => a.AppointmentDate >= fromDate.Value);

        if (toDate.HasValue)
            query = query.Where(a => a.AppointmentDate <= toDate.Value);

        if (!string.IsNullOrEmpty(status))
            query = query.Where(a => a.Status.ToLower() == status.ToLower());

        var totalCount = await query.CountAsync();
        
        var items = await query
            .OrderByDescending(a => a.AppointmentDate)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .ToListAsync();

        return new PagedResult<Appointment>
        {
            Items = items,
            TotalCount = totalCount,
            CurrentPage = page,
            PageSize = pageSize
        };
    }

    public async Task<Appointment?> GetAppointmentByIdAsync(Guid id, Guid tenantId)
    {
        return await _context.Appointments
            .Include(a => a.Patient)
            .Include(a => a.Doctor)
            .FirstOrDefaultAsync(a => a.Id == id && a.TenantId == tenantId);
    }

    public async Task<Appointment> CreateAppointmentAsync(Appointment appointment)
    {
        if (appointment.Id == Guid.Empty)
        {
            appointment.Id = Guid.NewGuid();
        }

        // Skip availability check for Emergency priority appointments
        if (appointment.Priority != "Emergency" && 
            !await IsDoctorAvailable(
                appointment.DoctorId, 
                appointment.AppointmentDate, 
                appointment.DurationMinutes))
        {
            throw new InvalidOperationException("Doctor is not available at the selected time.");
        }

        appointment.Status = "Scheduled";
        appointment.CreatedAt = DateTime.UtcNow;
        appointment.UpdatedAt = DateTime.UtcNow;

        _context.Appointments.Add(appointment);
        await _context.SaveChangesAsync();
        
        return appointment;
    }

    public async Task<Appointment?> UpdateAppointmentAsync(Appointment appointment)
    {
        var existingAppointment = await _context.Appointments
            .FirstOrDefaultAsync(a => a.Id == appointment.Id && a.TenantId == appointment.TenantId);

        if (existingAppointment == null)
        {
            return null;
        }

        // Skip availability check for Emergency priority appointments
        if (appointment.Priority != "Emergency" &&
            !await IsDoctorAvailable(
                appointment.DoctorId, 
                appointment.AppointmentDate, 
                appointment.DurationMinutes,
                appointment.Id))
        {
            throw new InvalidOperationException("Doctor is not available at the selected time.");
        }

        appointment.UpdatedAt = DateTime.UtcNow;
        _context.Entry(existingAppointment).CurrentValues.SetValues(appointment);
        await _context.SaveChangesAsync();
        
        return existingAppointment;
    }

    public async Task<Appointment?> CancelAppointmentAsync(Guid id, Guid tenantId, string reason)
    {
        var appointment = await _context.Appointments
            .FirstOrDefaultAsync(a => a.Id == id && a.TenantId == tenantId);

        if (appointment == null)
        {
            return null;
        }

        appointment.Status = "Cancelled";
        appointment.CancellationReason = reason;
        appointment.UpdatedAt = DateTime.UtcNow;

        await _context.SaveChangesAsync();
        return appointment;
    }

    public async Task<bool> DeleteAppointmentAsync(Guid id, Guid tenantId)
    {
        var appointment = await _context.Appointments
            .FirstOrDefaultAsync(a => a.Id == id && a.TenantId == tenantId);

        if (appointment == null)
        {
            return false;
        }

        _context.Appointments.Remove(appointment);
        await _context.SaveChangesAsync();
        return true;
    }

    public async Task<bool> IsDoctorAvailable(Guid doctorId, DateTime appointmentDate, int durationMinutes, Guid? excludeAppointmentId = null)
    {
        var endTime = appointmentDate.AddMinutes(durationMinutes);

        var conflictingAppointments = await _context.Appointments
            .Where(a => a.DoctorId == doctorId &&
                       a.Status != "Cancelled" &&
                       a.AppointmentDate < endTime &&
                       a.AppointmentDate.AddMinutes(a.DurationMinutes) > appointmentDate)
            .ToListAsync();

        if (excludeAppointmentId.HasValue)
        {
            conflictingAppointments = conflictingAppointments
                .Where(a => a.Id != excludeAppointmentId.Value)
                .ToList();
        }

        return !conflictingAppointments.Any();
    }

    // ==================== ENHANCED METHODS ====================

    public async Task<ConflictCheckResponse> CheckConflictsAsync(ConflictCheckRequest request, Guid tenantId)
    {
        var response = new ConflictCheckResponse();
        var conflicts = new List<AppointmentConflictDto>();

        var endTime = request.StartTime.Add(TimeSpan.FromMinutes(request.DurationMinutes));

        // Check doctor conflicts
        var doctorAppointments = await _context.Appointments
            .Where(a => a.DoctorId == request.DoctorId &&
                       a.TenantId == tenantId &&
                       a.AppointmentDate.Date == request.AppointmentDate.Date &&
                       a.Status != "Cancelled" &&
                       a.DeletedAt == null &&
                       (request.AppointmentId == null || a.Id != request.AppointmentId))
            .ToListAsync();

        foreach (var apt in doctorAppointments)
        {
            if (apt.StartTime.HasValue && apt.EndTime.HasValue)
            {
                if (!(endTime <= apt.StartTime || request.StartTime >= apt.EndTime))
                {
                    conflicts.Add(new AppointmentConflictDto
                    {
                        ConflictType = "doctor_busy",
                        Message = $"Doctor has an appointment from {apt.StartTime} to {apt.EndTime}",
                        ConflictingAppointmentId = apt.Id,
                        ConflictingAppointmentDate = apt.AppointmentDate,
                        ConflictingStartTime = apt.StartTime,
                        Severity = "high"
                    });
                }
            }
        }

        // Check patient conflicts if patientId provided
        if (request.PatientId.HasValue)
        {
            var patientAppointments = await _context.Appointments
                .Where(a => a.PatientId == request.PatientId &&
                           a.TenantId == tenantId &&
                           a.AppointmentDate.Date == request.AppointmentDate.Date &&
                           a.Status != "Cancelled" &&
                           a.DeletedAt == null &&
                           (request.AppointmentId == null || a.Id != request.AppointmentId))
                .ToListAsync();

            foreach (var apt in patientAppointments)
            {
                if (apt.StartTime.HasValue && apt.EndTime.HasValue)
                {
                    if (!(endTime <= apt.StartTime || request.StartTime >= apt.EndTime))
                    {
                        conflicts.Add(new AppointmentConflictDto
                        {
                            ConflictType = "patient_busy",
                            Message = $"Patient has an appointment from {apt.StartTime} to {apt.EndTime}",
                            ConflictingAppointmentId = apt.Id,
                            ConflictingAppointmentDate = apt.AppointmentDate,
                            ConflictingStartTime = apt.StartTime,
                            Severity = "medium"
                        });
                    }
                }
            }
        }

        // Check doctor availability/breaks
        var dayOfWeek = (int)request.AppointmentDate.DayOfWeek;
        var doctorAvailability = await _context.DoctorAvailabilities
            .Where(da => da.DoctorId == request.DoctorId &&
                        da.TenantId == tenantId &&
                        da.IsActive &&
                        da.DeletedAt == null &&
                        ((da.DayOfWeek == dayOfWeek && da.IsRecurring) ||
                         (da.SpecificDate == request.AppointmentDate.Date)))
            .ToListAsync();

        var workingHours = doctorAvailability
            .Where(da => da.AvailabilityType == "working_hours")
            .ToList();

        if (workingHours.Any())
        {
            var isWithinWorkingHours = workingHours.Any(wh =>
                request.StartTime >= wh.StartTime && endTime <= wh.EndTime);

            if (!isWithinWorkingHours)
            {
                conflicts.Add(new AppointmentConflictDto
                {
                    ConflictType = "outside_hours",
                    Message = "Appointment is outside doctor's working hours",
                    Severity = "high"
                });
            }
        }

        var breaks = doctorAvailability
            .Where(da => da.AvailabilityType == "break")
            .ToList();

        foreach (var brk in breaks)
        {
            if (!(endTime <= brk.StartTime || request.StartTime >= brk.EndTime))
            {
                conflicts.Add(new AppointmentConflictDto
                {
                    ConflictType = "break_time",
                    Message = $"Appointment overlaps with break time ({brk.StartTime} - {brk.EndTime})",
                    Severity = "medium"
                });
            }
        }

        response.Conflicts = conflicts;
        response.HasConflicts = conflicts.Any();

        // Generate suggested alternatives if conflicts exist
        if (response.HasConflicts)
        {
            var suggestedSlots = await GenerateSuggestedSlotsAsync(
                request.DoctorId, request.AppointmentDate, request.DurationMinutes, tenantId);
            response.SuggestedAlternatives = suggestedSlots.Take(3).ToList();
        }

        return response;
    }

    public async Task<DoctorAvailabilityResponse> GetDoctorAvailabilityAsync(DoctorAvailabilityRequest request, Guid tenantId)
    {
        var doctor = await _context.Users.FindAsync(request.DoctorId);
        var response = new DoctorAvailabilityResponse
        {
            DoctorId = request.DoctorId,
            DoctorName = doctor != null ? $"{doctor.FirstName} {doctor.LastName}" : "Unknown",
            Date = request.Date
        };

        var dayOfWeek = (int)request.Date.DayOfWeek;
        var availability = await _context.DoctorAvailabilities
            .Where(da => da.DoctorId == request.DoctorId &&
                        da.TenantId == tenantId &&
                        da.IsActive &&
                        da.DeletedAt == null &&
                        ((da.DayOfWeek == dayOfWeek && da.IsRecurring) ||
                         (da.SpecificDate == request.Date.Date)))
            .ToListAsync();

        response.WorkingHours = availability
            .Where(a => a.AvailabilityType == "working_hours")
            .Select(a => new WorkingHoursDto
            {
                Id = a.Id,
                DayOfWeek = a.DayOfWeek,
                SpecificDate = a.SpecificDate,
                StartTime = a.StartTime,
                EndTime = a.EndTime,
                IsRecurring = a.IsRecurring
            })
            .ToList();

        response.BreakTimes = availability
            .Where(a => a.AvailabilityType == "break")
            .Select(a => new BreakTimeDto
            {
                Id = a.Id,
                StartTime = a.StartTime,
                EndTime = a.EndTime,
                Reason = a.Reason
            })
            .ToList();

        if (request.IncludeBlocked)
        {
            response.BlockedTimes = availability
                .Where(a => a.AvailabilityType == "blocked" || a.AvailabilityType == "meeting" ||
                           a.AvailabilityType == "emergency" || a.AvailabilityType == "personal")
                .Select(a => new BlockedTimeDto
                {
                    Id = a.Id,
                    SpecificDate = a.SpecificDate,
                    StartTime = a.StartTime,
                    EndTime = a.EndTime,
                    Reason = a.Reason ?? "",
                    Type = a.AvailabilityType
                })
                .ToList();
        }

        // Generate available time slots
        response.AvailableSlots = await GenerateAvailableTimeSlots(
            request.DoctorId, request.Date, tenantId);

        return response;
    }

    public async Task<SuggestedSlotsResponse> GetSuggestedTimeSlotsAsync(SuggestedSlotsRequest request, Guid tenantId)
    {
        var response = new SuggestedSlotsResponse();
        var suggestions = new List<SuggestedSlotDto>();

        // Try same day first
        var slotsToday = await GenerateSuggestedSlotsAsync(
            request.DoctorId, request.PreferredDate, request.DurationMinutes, tenantId);
        
        foreach (var slot in slotsToday.Take(request.MaxSuggestions))
        {
            suggestions.Add(new SuggestedSlotDto
            {
                Date = request.PreferredDate,
                StartTime = slot.StartTime,
                EndTime = slot.EndTime,
                Score = 100,
                Reason = "Available on preferred date"
            });
        }

        // If not enough slots, try next 3 days
        if (suggestions.Count < request.MaxSuggestions)
        {
            for (int i = 1; i <= 3 && suggestions.Count < request.MaxSuggestions; i++)
            {
                var nextDate = request.PreferredDate.AddDays(i);
                var slotsNextDay = await GenerateSuggestedSlotsAsync(
                    request.DoctorId, nextDate, request.DurationMinutes, tenantId);
                
                foreach (var slot in slotsNextDay.Take(request.MaxSuggestions - suggestions.Count))
                {
                    suggestions.Add(new SuggestedSlotDto
                    {
                        Date = nextDate,
                        StartTime = slot.StartTime,
                        EndTime = slot.EndTime,
                        Score = 80 - (i * 10),
                        Reason = $"Available {i} day(s) later"
                    });
                }
            }
        }

        response.Suggestions = suggestions.OrderByDescending(s => s.Score).ToList();
        return response;
    }

    public async Task<Appointment> RescheduleAppointmentAsync(RescheduleAppointmentRequest request, Guid tenantId)
    {
        var appointment = await _context.Appointments
            .FirstOrDefaultAsync(a => a.Id == request.AppointmentId && a.TenantId == tenantId);

        if (appointment == null)
            throw new InvalidOperationException("Appointment not found");

        if (request.CheckConflicts)
        {
            var conflictCheck = await CheckConflictsAsync(new ConflictCheckRequest
            {
                AppointmentId = request.AppointmentId,
                DoctorId = appointment.DoctorId,
                PatientId = appointment.PatientId,
                AppointmentDate = request.NewDate,
                StartTime = request.NewStartTime,
                DurationMinutes = appointment.DurationMinutes
            }, tenantId);

            if (conflictCheck.HasConflicts)
                throw new InvalidOperationException(
                    $"Cannot reschedule: {string.Join(", ", conflictCheck.Conflicts.Select(c => c.Message))}");
        }

        appointment.AppointmentDate = request.NewDate;
        appointment.StartTime = request.NewStartTime;
        appointment.EndTime = request.NewStartTime.Add(TimeSpan.FromMinutes(appointment.DurationMinutes));
        appointment.UpdatedAt = DateTime.UtcNow;

        await _context.SaveChangesAsync();
        return appointment;
    }

    public async Task<BulkOperationResponse> BulkUpdateAppointmentsAsync(BulkUpdateAppointmentsRequest request, Guid tenantId)
    {
        var response = new BulkOperationResponse();
        var errors = new List<string>();

        foreach (var appointmentId in request.AppointmentIds)
        {
            try
            {
                var appointment = await _context.Appointments
                    .FirstOrDefaultAsync(a => a.Id == appointmentId && a.TenantId == tenantId);

                if (appointment == null)
                {
                    errors.Add($"Appointment {appointmentId} not found");
                    response.FailureCount++;
                    continue;
                }

                if (!string.IsNullOrEmpty(request.NewStatus))
                    appointment.Status = request.NewStatus;

                if (request.NewDoctorId.HasValue)
                    appointment.DoctorId = request.NewDoctorId.Value;

                if (request.NewDate.HasValue)
                    appointment.AppointmentDate = request.NewDate.Value;

                if (request.NewStartTime.HasValue)
                {
                    appointment.StartTime = request.NewStartTime.Value;
                    appointment.EndTime = request.NewStartTime.Value.Add(
                        TimeSpan.FromMinutes(appointment.DurationMinutes));
                }

                appointment.UpdatedAt = DateTime.UtcNow;
                response.SuccessCount++;
            }
            catch (Exception ex)
            {
                errors.Add($"Failed to update {appointmentId}: {ex.Message}");
                response.FailureCount++;
            }
        }

        await _context.SaveChangesAsync();
        response.Errors = errors;
        return response;
    }

    public async Task<BulkOperationResponse> BulkCancelAppointmentsAsync(BulkCancelAppointmentsRequest request, Guid tenantId)
    {
        var response = new BulkOperationResponse();
        var errors = new List<string>();

        foreach (var appointmentId in request.AppointmentIds)
        {
            try
            {
                var appointment = await _context.Appointments
                    .FirstOrDefaultAsync(a => a.Id == appointmentId && a.TenantId == tenantId);

                if (appointment == null)
                {
                    errors.Add($"Appointment {appointmentId} not found");
                    response.FailureCount++;
                    continue;
                }

                appointment.Status = "Cancelled";
                appointment.CancellationReason = request.Reason;
                appointment.UpdatedAt = DateTime.UtcNow;
                response.SuccessCount++;

                // TODO: Send notifications if request.SendNotifications is true
            }
            catch (Exception ex)
            {
                errors.Add($"Failed to cancel {appointmentId}: {ex.Message}");
                response.FailureCount++;
            }
        }

        await _context.SaveChangesAsync();
        response.Errors = errors;
        return response;
    }

    public async Task<AppointmentStatsResponse> GetStatisticsAsync(AppointmentStatsRequest request, Guid tenantId)
    {
        var query = _context.Appointments
            .Where(a => a.TenantId == tenantId &&
                       a.AppointmentDate >= request.StartDate &&
                       a.AppointmentDate <= request.EndDate &&
                       a.DeletedAt == null);

        if (request.DoctorId.HasValue)
            query = query.Where(a => a.DoctorId == request.DoctorId);

        if (request.DepartmentId.HasValue)
            query = query.Where(a => a.DepartmentId == request.DepartmentId);

        var appointments = await query
            .Include(a => a.Doctor)
            .Include(a => a.Department)
            .ToListAsync();

        var today = DateTime.UtcNow.Date;
        var todayAppointments = appointments.Where(a => a.AppointmentDate.Date == today).ToList();

        var response = new AppointmentStatsResponse
        {
            TotalToday = todayAppointments.Count,
            CompletedToday = todayAppointments.Count(a => a.Status == "Completed"),
            ScheduledToday = todayAppointments.Count(a => a.Status == "Scheduled"),
            ConfirmedToday = todayAppointments.Count(a => a.Status == "Confirmed"),
            InProgressToday = todayAppointments.Count(a => a.Status == "InProgress"),
            CancelledToday = todayAppointments.Count(a => a.Status == "Cancelled"),
            NoShowToday = todayAppointments.Count(a => a.Status == "NoShow"),
            AverageDurationMinutes = appointments.Any() ? (decimal)appointments.Average(a => a.DurationMinutes) : 0
        };

        // Department breakdown
        response.DepartmentBreakdown = appointments
            .Where(a => a.Department != null)
            .GroupBy(a => new { a.DepartmentId, a.Department!.DepartmentName })
            .Select(g => new DepartmentStatsDto
            {
                DepartmentId = g.Key.DepartmentId!.Value,
                DepartmentName = g.Key.DepartmentName,
                TotalAppointments = g.Count(),
                CompletedAppointments = g.Count(a => a.Status == "Completed"),
                CancelledAppointments = g.Count(a => a.Status == "Cancelled")
            })
            .ToList();

        // Doctor breakdown
        response.DoctorBreakdown = appointments
            .Where(a => a.Doctor != null)
            .GroupBy(a => new { a.DoctorId, a.Doctor!.FirstName, a.Doctor.LastName })
            .Select(g => new DoctorStatsDto
            {
                DoctorId = g.Key.DoctorId,
                DoctorName = $"{g.Key.FirstName} {g.Key.LastName}",
                TotalAppointments = g.Count(),
                CompletedAppointments = g.Count(a => a.Status == "Completed"),
                UtilizationRate = g.Count() > 0 ? (decimal)g.Count(a => a.Status == "Completed") / g.Count() * 100 : 0
            })
            .ToList();

        return response;
    }

    public async Task<RecurringAppointmentsResponse> CreateRecurringAppointmentsAsync(CreateRecurringRequest request, Guid tenantId)
    {
        var response = new RecurringAppointmentsResponse();
        var conflicts = new List<AppointmentConflictDto>();
        var createdAppointments = new List<AppointmentResponse>();

        var currentDate = request.StartDate;
        var occurrenceCount = 0;

        while (occurrenceCount < request.Occurrences && 
               (!request.EndDate.HasValue || currentDate <= request.EndDate.Value))
        {
            var conflictCheck = await CheckConflictsAsync(new ConflictCheckRequest
            {
                DoctorId = request.DoctorId,
                PatientId = request.PatientId,
                AppointmentDate = currentDate,
                StartTime = request.StartTime,
                DurationMinutes = request.DurationMinutes
            }, tenantId);

            if (!conflictCheck.HasConflicts)
            {
                var appointment = new Appointment
                {
                    Id = Guid.NewGuid(),
                    TenantId = tenantId,
                    PatientId = request.PatientId,
                    DoctorId = request.DoctorId,
                    AppointmentDate = currentDate,
                    StartTime = request.StartTime,
                    EndTime = request.StartTime.Add(TimeSpan.FromMinutes(request.DurationMinutes)),
                    AppointmentType = request.AppointmentType,
                    DurationMinutes = request.DurationMinutes,
                    Status = "Scheduled",
                    IsRecurring = true,
                    RecurringPattern = request.RecurringPattern,
                    Notes = request.Notes,
                    CreatedAt = DateTime.UtcNow,
                    UpdatedAt = DateTime.UtcNow
                };

                if (occurrenceCount == 0)
                {
                    appointment.ParentAppointmentId = null;
                }
                else if (createdAppointments.Any())
                {
                    appointment.ParentAppointmentId = Guid.Parse(createdAppointments[0].Id.ToString());
                }

                _context.Appointments.Add(appointment);
                response.Created++;
            }
            else
            {
                response.Conflicts++;
                conflicts.AddRange(conflictCheck.Conflicts);
            }

            // Calculate next occurrence
            currentDate = request.RecurringPattern.ToLower() switch
            {
                "daily" => currentDate.AddDays(1),
                "weekly" => currentDate.AddDays(7),
                "monthly" => currentDate.AddMonths(1),
                _ => currentDate.AddDays(7)
            };
            
            occurrenceCount++;
        }

        await _context.SaveChangesAsync();
        response.ConflictDetails = conflicts;
        return response;
    }

    public async Task<RecurringAppointmentsResponse> UpdateRecurringSeriesAsync(Guid parentAppointmentId, Appointment updatedData, Guid tenantId)
    {
        var response = new RecurringAppointmentsResponse();

        var seriesAppointments = await _context.Appointments
            .Where(a => (a.Id == parentAppointmentId || a.ParentAppointmentId == parentAppointmentId) &&
                       a.TenantId == tenantId &&
                       a.DeletedAt == null)
            .ToListAsync();

        foreach (var appointment in seriesAppointments)
        {
            if (!string.IsNullOrEmpty(updatedData.AppointmentType))
                appointment.AppointmentType = updatedData.AppointmentType;
            
            if (updatedData.DurationMinutes > 0)
                appointment.DurationMinutes = updatedData.DurationMinutes;
            
            if (!string.IsNullOrEmpty(updatedData.Notes))
                appointment.Notes = updatedData.Notes;

            appointment.UpdatedAt = DateTime.UtcNow;
            response.Created++; // Reusing Created counter for updated count
        }

        await _context.SaveChangesAsync();
        return response;
    }

    public async Task<ReminderResponse> SendReminderAsync(SendReminderRequest request, Guid tenantId)
    {
        var appointment = await _context.Appointments
            .Include(a => a.Patient)
            .Include(a => a.Doctor)
            .FirstOrDefaultAsync(a => a.Id == request.AppointmentId && a.TenantId == tenantId);

        if (appointment == null)
            throw new InvalidOperationException("Appointment not found");

        var reminder = new AppointmentReminder
        {
            Id = Guid.NewGuid(),
            TenantId = tenantId,
            AppointmentId = request.AppointmentId,
            ReminderType = request.ReminderType,
            ScheduledTime = DateTime.UtcNow,
            SentAt = DateTime.UtcNow,
            DeliveryStatus = "sent",
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow
        };

        _context.AppointmentReminders.Add(reminder);
        appointment.ReminderSent = true;
        await _context.SaveChangesAsync();

        // TODO: Actual email/SMS sending logic here
        _logger.LogInformation($"Reminder sent for appointment {request.AppointmentId} via {request.ReminderType}");

        return new ReminderResponse
        {
            ReminderId = reminder.Id,
            AppointmentId = reminder.AppointmentId,
            ReminderType = reminder.ReminderType,
            DeliveryStatus = reminder.DeliveryStatus,
            ScheduledTime = reminder.ScheduledTime,
            SentAt = reminder.SentAt
        };
    }

    public async Task<UpcomingRemindersResponse> GetUpcomingRemindersAsync(DateTime startDate, Guid tenantId)
    {
        var reminders = await _context.AppointmentReminders
            .Where(r => r.TenantId == tenantId &&
                       r.ScheduledTime >= startDate &&
                       r.DeliveryStatus == "pending")
            .OrderBy(r => r.ScheduledTime)
            .Take(50)
            .ToListAsync();

        return new UpcomingRemindersResponse
        {
            Reminders = reminders.Select(r => new ReminderResponse
            {
                ReminderId = r.Id,
                AppointmentId = r.AppointmentId,
                ReminderType = r.ReminderType,
                DeliveryStatus = r.DeliveryStatus,
                ScheduledTime = r.ScheduledTime,
                SentAt = r.SentAt
            }).ToList()
        };
    }

    public async Task<DoctorAvailabilityResponse> ManageDoctorAvailabilityAsync(ManageAvailabilityRequest request, Guid tenantId)
    {
        var availability = new DoctorAvailability
        {
            Id = Guid.NewGuid(),
            TenantId = tenantId,
            DoctorId = request.DoctorId,
            DayOfWeek = request.DayOfWeek,
            SpecificDate = request.SpecificDate,
            StartTime = request.StartTime,
            EndTime = request.EndTime,
            AvailabilityType = request.AvailabilityType,
            Reason = request.Reason,
            IsRecurring = request.IsRecurring,
            IsActive = true,
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow
        };

        _context.DoctorAvailabilities.Add(availability);
        await _context.SaveChangesAsync();

        return await GetDoctorAvailabilityAsync(new DoctorAvailabilityRequest
        {
            DoctorId = request.DoctorId,
            Date = request.SpecificDate ?? DateTime.UtcNow,
            IncludeBlocked = true
        }, tenantId);
    }

    public async Task BlockTimeSlotsAsync(Guid doctorId, BlockedTimeDto blockedTime, Guid tenantId)
    {
        var availability = new DoctorAvailability
        {
            Id = Guid.NewGuid(),
            TenantId = tenantId,
            DoctorId = doctorId,
            SpecificDate = blockedTime.SpecificDate,
            StartTime = blockedTime.StartTime,
            EndTime = blockedTime.EndTime,
            AvailabilityType = blockedTime.Type,
            Reason = blockedTime.Reason,
            IsRecurring = false,
            IsActive = true,
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow
        };

        _context.DoctorAvailabilities.Add(availability);
        await _context.SaveChangesAsync();
    }

    // ==================== HELPER METHODS ====================

    private async Task<List<TimeSlotDto>> GenerateSuggestedSlotsAsync(Guid doctorId, DateTime date, int durationMinutes, Guid tenantId)
    {
        var slots = new List<TimeSlotDto>();
        var dayOfWeek = (int)date.DayOfWeek;

        var workingHours = await _context.DoctorAvailabilities
            .Where(da => da.DoctorId == doctorId &&
                        da.TenantId == tenantId &&
                        da.AvailabilityType == "working_hours" &&
                        da.IsActive &&
                        ((da.DayOfWeek == dayOfWeek && da.IsRecurring) ||
                         (da.SpecificDate == date.Date)))
            .ToListAsync();

        if (!workingHours.Any())
            return slots;

        var existingAppointments = await _context.Appointments
            .Where(a => a.DoctorId == doctorId &&
                       a.TenantId == tenantId &&
                       a.AppointmentDate.Date == date.Date &&
                       a.Status != "Cancelled")
            .ToListAsync();

        foreach (var wh in workingHours)
        {
            var currentTime = wh.StartTime;
            var slotDuration = TimeSpan.FromMinutes(durationMinutes);

            while (currentTime.Add(slotDuration) <= wh.EndTime)
            {
                var isAvailable = !existingAppointments.Any(apt =>
                    apt.StartTime.HasValue && apt.EndTime.HasValue &&
                    !(currentTime.Add(slotDuration) <= apt.StartTime || currentTime >= apt.EndTime));

                if (isAvailable)
                {
                    slots.Add(new TimeSlotDto
                    {
                        StartTime = currentTime,
                        EndTime = currentTime.Add(slotDuration),
                        IsAvailable = true,
                        DurationMinutes = durationMinutes
                    });
                }

                currentTime = currentTime.Add(TimeSpan.FromMinutes(30)); // 30-minute intervals
            }
        }

        return slots;
    }

    private async Task<List<TimeSlotDto>> GenerateAvailableTimeSlots(Guid doctorId, DateTime date, Guid tenantId)
    {
        return await GenerateSuggestedSlotsAsync(doctorId, date, 30, tenantId); // Default 30-minute slots
    }
}