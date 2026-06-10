using AuthService.Context;
using AuthService.Models.Domain;
using AuthService.Services.Interfaces;
using Microsoft.EntityFrameworkCore;
using Microsoft.AspNetCore.SignalR;
using AuthService.Hubs;

namespace AuthService.Services;

public class DoctorQueueService : IDoctorQueueService
{
    private readonly AppDbContext _context;
    private readonly ILogger<DoctorQueueService> _logger;
    private readonly IHubContext<QueueHub> _hubContext;
    private readonly IQueueDisplayNotifier _queueDisplayNotifier;

    public DoctorQueueService(
        AppDbContext context,
        ILogger<DoctorQueueService> logger,
        IHubContext<QueueHub> hubContext,
        IQueueDisplayNotifier queueDisplayNotifier)
    {
        _context = context;
        _logger = logger;
        _hubContext = hubContext;
        _queueDisplayNotifier = queueDisplayNotifier;
    }

    public async Task<List<QueueItem>> GetDoctorQueueAsync(Guid tenantId, string? date = null)
    {
        try
        {
            var targetDate = string.IsNullOrEmpty(date) 
                ? DateTime.UtcNow.Date 
                : DateTime.Parse(date).Date;

            var queueItemsFromDb = await _context.QueueItems
                .Where(q => q.TenantId == tenantId && 
                           q.QueueType == "Doctor" &&
                           (q.Status == "waiting" || q.Status == "in_consultation") &&
                           q.CheckedInAt.Date == targetDate)
                .Include(q => q.Patient)
                .Include(q => q.Appointment)
                .ToListAsync();

            // Mixed priority algorithm - map string priorities to int for sorting:
            // emergency → 0, urgent → 1, follow-up → 2, normal → 3
            var getPriorityValue = (string? priority) => priority?.ToLower() switch
            {
                "emergency" => 0,
                "urgent" => 1,
                "follow-up" => 2,
                _ => 3
            };
            
            var queueItems = queueItemsFromDb
                .OrderBy(q => getPriorityValue(q.Priority))
                .ThenBy(q => q.CheckedInAt)
                .ToList();

            return queueItems;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error getting doctor queue for tenant {TenantId}", tenantId);
            return new List<QueueItem>();
        }
    }

    public async Task<object> GetDoctorStatsAsync(Guid doctorId, Guid tenantId)
    {
        try
        {
            var today = DateTime.UtcNow.Date;

            var stats = new
            {
                totalConsultationsToday = await _context.QueueItems
                    .CountAsync(q => q.TenantId == tenantId &&
                                    q.QueueType == "Doctor" &&
                                    q.Status == "completed" &&
                                    q.CheckedInAt.Date == today),

                currentWaiting = await _context.QueueItems
                    .CountAsync(q => q.TenantId == tenantId &&
                                    q.QueueType == "Doctor" &&
                                    q.Status == "waiting"),

                inConsultation = await _context.QueueItems
                    .CountAsync(q => q.TenantId == tenantId &&
                                    q.QueueType == "Doctor" &&
                                    q.Status == "in_consultation"),

                emergencyCases = await _context.QueueItems
                    .CountAsync(q => q.TenantId == tenantId &&
                                    q.QueueType == "Doctor" &&
                                    q.Status == "waiting" &&
                                    q.Priority == "emergency"),

                urgentCases = await _context.QueueItems
                    .CountAsync(q => q.TenantId == tenantId &&
                                    q.QueueType == "Doctor" &&
                                    q.Status == "waiting" &&
                                    q.Priority == "urgent"),

                averageWaitTime = await _context.QueueItems
                    .Where(q => q.TenantId == tenantId &&
                               q.QueueType == "Doctor" &&
                               q.Status == "waiting")
                    .Select(q => (DateTime.UtcNow - q.CheckedInAt).TotalMinutes)
                    .DefaultIfEmpty(0)
                    .AverageAsync()
            };

            return stats;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error getting doctor stats for doctor {DoctorId}", doctorId);
            return new { error = "Failed to retrieve statistics" };
        }
    }

    public async Task<QueueItem?> CallNextPatientAsync(Guid doctorId, Guid tenantId)
    {
        try
        {
            var waitingPatients = await _context.QueueItems
                .Where(q => q.TenantId == tenantId &&
                           q.QueueType == "Doctor" &&
                           q.Status == "waiting")
                .Include(q => q.Patient)
                .ToListAsync();

            // Priority mapping: emergency → 0, urgent → 1, follow-up → 2, normal → 3
            var getPriorityValue = (string? priority) => priority?.ToLower() switch
            {
                "emergency" => 0,
                "urgent" => 1,
                "follow-up" => 2,
                _ => 3
            };

            var nextPatient = waitingPatients
                .OrderBy(q => getPriorityValue(q.Priority))
                .ThenBy(q => q.CheckedInAt)
                .FirstOrDefault();

            if (nextPatient != null)
            {
                // Notify via SignalR
                var patientName = nextPatient.Patient != null 
                    ? $"{nextPatient.Patient.FirstName} {nextPatient.Patient.LastName}"
                    : "Unknown Patient";
                
                await _hubContext.Clients.Group($"branch-{nextPatient.BranchId}")
                    .SendAsync("PatientCalled", new
                    {
                        queueItemId = nextPatient.Id,
                        tokenNumber = nextPatient.TokenNumber,
                        patientName,
                        queueType = "Doctor"
                    });

                _logger.LogInformation("Doctor {DoctorId} called next patient: {TokenNumber}", 
                    doctorId, nextPatient.TokenNumber);
            }

            return nextPatient;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error calling next patient for doctor {DoctorId}", doctorId);
            return null;
        }
    }

    public async Task<QueueItem?> StartConsultationAsync(Guid queueItemId, Guid doctorId, Guid tenantId)
    {
        try
        {
            var queueItem = await _context.QueueItems
                .Include(q => q.Patient)
                .FirstOrDefaultAsync(q => q.Id == queueItemId && q.TenantId == tenantId);

            if (queueItem == null)
            {
                return null;
            }

            queueItem.Status = "in_consultation";
            queueItem.CalledAt = DateTime.UtcNow;
            queueItem.UpdatedAt = DateTime.UtcNow;
            
            await _context.SaveChangesAsync();
            await _queueDisplayNotifier.NotifyBranchDisplayUpdatedAsync(tenantId, queueItem.BranchId);

            // Notify via SignalR
            var patientName = queueItem.Patient != null 
                ? $"{queueItem.Patient.FirstName} {queueItem.Patient.LastName}"
                : "Unknown Patient";
            
            await _hubContext.Clients.Group($"branch-{queueItem.BranchId}")
                .SendAsync("ConsultationStarted", new
                {
                    queueItemId = queueItem.Id,
                    tokenNumber = queueItem.TokenNumber,
                    patientName,
                    doctorId
                });

            _logger.LogInformation("Consultation started for patient {TokenNumber} with doctor {DoctorId}", 
                queueItem.TokenNumber, doctorId);

            return queueItem;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error starting consultation for queue item {QueueItemId}", queueItemId);
            return null;
        }
    }

    public async Task<QueueItem?> CompleteConsultationAsync(Guid queueItemId, Guid tenantId)
    {
        try
        {
            var queueItem = await _context.QueueItems
                .FirstOrDefaultAsync(q => q.Id == queueItemId && q.TenantId == tenantId);

            if (queueItem == null)
            {
                return null;
            }

            queueItem.Status = "completed";
            queueItem.CompletedAt = DateTime.UtcNow;
            queueItem.UpdatedAt = DateTime.UtcNow;
            
            await _context.SaveChangesAsync();
            await _queueDisplayNotifier.NotifyBranchDisplayUpdatedAsync(tenantId, queueItem.BranchId);

            // Notify via SignalR
            await _hubContext.Clients.Group($"branch-{queueItem.BranchId}")
                .SendAsync("ConsultationCompleted", new
                {
                    queueItemId = queueItem.Id,
                    tokenNumber = queueItem.TokenNumber
                });

            _logger.LogInformation("Consultation completed for patient {TokenNumber}", queueItem.TokenNumber);

            return queueItem;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error completing consultation for queue item {QueueItemId}", queueItemId);
            return null;
        }
    }

    public async Task<QueueItem?> SkipPatientAsync(Guid queueItemId, string reason, Guid tenantId)
    {
        try
        {
            var queueItem = await _context.QueueItems
                .FirstOrDefaultAsync(q => q.Id == queueItemId && q.TenantId == tenantId);

            if (queueItem == null)
            {
                return null;
            }

            queueItem.Status = "skipped";
            // TODO: Add Notes field to QueueItem model or create separate SkipReason table
            // queueItem.Notes = $"Skipped: {reason}";
            queueItem.UpdatedAt = DateTime.UtcNow;
            
            await _context.SaveChangesAsync();
            await _queueDisplayNotifier.NotifyBranchDisplayUpdatedAsync(tenantId, queueItem.BranchId);

            _logger.LogInformation("Patient {TokenNumber} skipped. Reason: {Reason}", 
                queueItem.TokenNumber, reason);

            return queueItem;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error skipping patient for queue item {QueueItemId}", queueItemId);
            return null;
        }
    }

    public async Task<QueueItem?> ReferToSpecialistAsync(Guid queueItemId, Guid specialistId, string notes, Guid tenantId)
    {
        try
        {
            var queueItem = await _context.QueueItems
                .FirstOrDefaultAsync(q => q.Id == queueItemId && q.TenantId == tenantId);

            if (queueItem == null)
            {
                return null;
            }

            // Update queue item
            // TODO: Create referral record in separate referrals table with notes
            // queueItem.Notes = $"Referred to specialist. Notes: {notes}";
            queueItem.Status = "referred";
            queueItem.UpdatedAt = DateTime.UtcNow;
            
            await _context.SaveChangesAsync();

            _logger.LogInformation("Patient {TokenNumber} referred to specialist {SpecialistId}", 
                queueItem.TokenNumber, specialistId);

            return queueItem;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error referring patient to specialist for queue item {QueueItemId}", queueItemId);
            return null;
        }
    }

    public async Task<QueueItem?> ReferToImagingAsync(Guid queueItemId, string investigationType, Guid tenantId)
    {
        try
        {
            var queueItem = await _context.QueueItems
                .FirstOrDefaultAsync(q => q.Id == queueItemId && q.TenantId == tenantId);

            if (queueItem == null)
            {
                return null;
            }

            // Update queue item status
            // TODO: Create imaging order record with notes
            // queueItem.Notes = $"Referred to imaging: {investigationType}";
            queueItem.Status = "referred";
            queueItem.UpdatedAt = DateTime.UtcNow;
            
            await _context.SaveChangesAsync();

            _logger.LogInformation("Patient {TokenNumber} referred to imaging for {InvestigationType}", 
                queueItem.TokenNumber, investigationType);

            return queueItem;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error referring patient to imaging for queue item {QueueItemId}", queueItemId);
            return null;
        }
    }

    public async Task<QueueItem?> ReferToCounselorAsync(Guid queueItemId, string reason, Guid tenantId)
    {
        try
        {
            var queueItem = await _context.QueueItems
                .FirstOrDefaultAsync(q => q.Id == queueItemId && q.TenantId == tenantId);

            if (queueItem == null)
            {
                return null;
            }

            // Create new queue item for counselor
            var counselorQueueItem = new QueueItem
            {
                Id = Guid.NewGuid(),
                TenantId = tenantId,
                BranchId = queueItem.BranchId,
                PatientId = queueItem.PatientId,
                AppointmentId = queueItem.AppointmentId,
                QueueType = "Counselor",
                TokenNumber = $"C{DateTime.UtcNow:HHmmss}",
                Status = "waiting",
                // TODO: Add Source and Notes fields to QueueItem model
                // Source = "DoctorReferral",
                Priority = "follow-up",
                // Notes = $"Referred from doctor. Reason: {reason}",
                CheckedInAt = DateTime.UtcNow,
                CreatedAt = DateTime.UtcNow,
                UpdatedAt = DateTime.UtcNow
            };

            _context.QueueItems.Add(counselorQueueItem);
            await _context.SaveChangesAsync();

            _logger.LogInformation("Patient {TokenNumber} referred to counselor for {Reason}", 
                queueItem.TokenNumber, reason);

            return counselorQueueItem;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error referring patient to counselor for queue item {QueueItemId}", queueItemId);
            return null;
        }
    }
}

public class OptometryService : IOptometryService
{
    private readonly AppDbContext _context;
    private readonly ILogger<OptometryService> _logger;

    public OptometryService(AppDbContext context, ILogger<OptometryService> logger)
    {
        _context = context;
        _logger = logger;
    }

    public async Task<object?> GetLatestOptometryDataAsync(Guid patientId, Guid tenantId)
    {
        try
        {
            // Get latest optometry examination for the patient
            var latestExam = await _context.ClinicalExaminations
                .Where(e => e.PatientId == patientId && 
                           e.TenantId == tenantId &&
                           e.ExaminationType == "Optometry")
                .OrderByDescending(e => e.ExaminationDate)
                .FirstOrDefaultAsync();

            if (latestExam == null)
            {
                return null;
            }

            // Return basic optometry data
            // Note: Detailed optometry fields are stored in ExaminationNotes as JSON
            return new
            {
                examinationId = latestExam.Id,
                examinationDate = latestExam.ExaminationDate,
                chiefComplaint = latestExam.ChiefComplaint,
                examinationNotes = latestExam.ExaminationNotes, // Contains full optometry JSON data
                diagnosis = latestExam.Diagnosis,
                followUpDate = latestExam.FollowUpDate
            };
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error getting latest optometry data for patient {PatientId}", patientId);
            return null;
        }
    }
}
