using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using AuthService.Context;
using AuthService.Models.Counselor;
using AuthService.Models.Domain;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;

namespace AuthService.Services
{
    public class CounselorCommunicationService : ICounselorCommunicationService
    {
        private readonly AppDbContext _context;
        private readonly ILogger<CounselorCommunicationService> _logger;

        public CounselorCommunicationService(AppDbContext context, ILogger<CounselorCommunicationService> logger)
        {
            _context = context;
            _logger = logger;
        }

        // ── Communication Logs ────────────────────────────────────────────────

        public async Task<IEnumerable<CommLogDto>> GetCommLogsAsync(Guid sessionId, Guid tenantId)
        {
            var logs = await _context.CounselorCommunicationLogs
                .Where(l => l.SessionId == sessionId && l.TenantId == tenantId && l.DeletedAt == null)
                .OrderByDescending(l => l.CommunicationAt)
                .ToListAsync();

            return logs.Select(ToCommLogDto);
        }

        public async Task<CommLogDto> AddCommLogAsync(Guid sessionId, CreateCommLogRequest request, Guid tenantId, Guid counselorId)
        {
            var session = await _context.CounselingSession
                .FirstOrDefaultAsync(s => s.Id == sessionId && s.TenantId == tenantId && s.DeletedAt == null)
                ?? throw new InvalidOperationException($"Session {sessionId} not found");

            // Phase 3I Slice 7 (PD-S7-02/05/06 — M18): expected Version required; fail closed; stale → 409 upstream.
            if (!request.Version.HasValue)
                throw new ArgumentException("Version is required.");
            if (session.Version != request.Version.Value)
                throw new InvalidOperationException(SessionConcurrency.StaleMessage);

            var log = new CounselorCommunicationLog
            {
                Id             = Guid.NewGuid(),
                TenantId       = tenantId,
                SessionId      = sessionId,
                PatientId      = session.PatientId,
                CounselorId    = counselorId,
                Channel        = request.Channel,
                Direction      = request.Direction,
                CommunicationAt = request.CommunicationAt ?? DateTime.UtcNow,
                Outcome        = CounselorCommunicationContracts.NormalizeCommOutcome(request.Outcome),
                CallDurationMinutes = request.CallDurationMinutes,
                MessageBody    = request.MessageBody,
                ResponseSummary = request.ResponseSummary,
                NextAction     = request.NextAction,
                NextActionDate = request.NextActionDate,
                TemplateId     = request.TemplateId,
                CreatedAt      = DateTime.UtcNow,
                UpdatedAt      = DateTime.UtcNow,
                CreatedByUserId = counselorId,
                UpdatedByUserId = counselorId,
                Status         = "active"
            };

            _context.CounselorCommunicationLogs.Add(log);

            // Update session escalation tracking
            session.LastContactDate    = log.CommunicationAt.Date;
            session.LastContactOutcome = log.Outcome;
            if (request.Direction == "Outbound")
                session.ContactAttemptCount++;

            // Auto-clear Overdue status if contact was successful (answered)
            if (session.EscalationStatus == "Overdue" && log.Outcome.StartsWith("Answered"))
                session.EscalationStatus = "Normal";

            await _context.SaveChangesAsync();
            var dto = ToCommLogDto(log);
            dto.SessionVersion = session.Version;
            return dto;
        }

        // ── Callback Requests ─────────────────────────────────────────────────

        public async Task<IEnumerable<CallbackRequestDto>> GetCallbacksAsync(
            Guid tenantId, Guid? branchId, DateTime? date, string? status)
        {
            var query = _context.CounselorCallbackRequests
                .Where(c => c.TenantId == tenantId && c.DeletedAt == null);

            if (branchId.HasValue)
                query = query.Where(c => c.BranchId == branchId.Value);

            if (date.HasValue)
                query = query.Where(c => c.CallbackDate.Date == date.Value.Date);

            if (!string.IsNullOrEmpty(status))
                query = query.Where(c => c.CallbackStatus == status);

            var results = await query
                .OrderBy(c => c.CallbackDate)
                .ThenBy(c => c.CallbackTime)
                .ThenBy(c => c.Priority)
                .ToListAsync();

            return results.Select(ToCallbackDto);
        }

        public async Task<CallbackRequestDto> GetCallbacksBySessionAsync(Guid sessionId, Guid tenantId)
        {
            var cb = await _context.CounselorCallbackRequests
                .Where(c => c.SessionId == sessionId && c.TenantId == tenantId && c.DeletedAt == null)
                .OrderByDescending(c => c.CreatedAt)
                .FirstOrDefaultAsync()
                ?? throw new InvalidOperationException($"No callbacks found for session {sessionId}");

            return ToCallbackDto(cb);
        }

        public async Task<CallbackRequestDto> ScheduleCallbackAsync(
            Guid sessionId, ScheduleCallbackRequest request, Guid tenantId, Guid createdByUserId)
        {
            var session = await _context.CounselingSession
                .FirstOrDefaultAsync(s => s.Id == sessionId && s.TenantId == tenantId && s.DeletedAt == null)
                ?? throw new InvalidOperationException($"Session {sessionId} not found");

            var cb = new CounselorCallbackRequest
            {
                Id                  = Guid.NewGuid(),
                TenantId            = tenantId,
                SessionId           = sessionId,
                PatientId           = session.PatientId,
                BranchId            = session.BranchId ?? Guid.Empty,
                AssignedToUserId    = request.AssignedToUserId ?? createdByUserId,
                CallbackType        = CounselorCommunicationContracts.NormalizeCallbackType(request.CallbackType),
                Channel             = CounselorCommunicationContracts.NormalizeCallbackChannel(request.Channel),
                CallbackDate        = request.CallbackDate.Date,
                CallbackTime        = request.CallbackTime,
                CallbackNotes       = request.CallbackNotes,
                PatientPreferredTime = request.PatientPreferredTime,
                CallbackStatus      = "Scheduled",
                Priority            = request.Priority,
                CreatedAt           = DateTime.UtcNow,
                UpdatedAt           = DateTime.UtcNow,
                CreatedByUserId     = createdByUserId,
                UpdatedByUserId     = createdByUserId,
                Status              = "active"
            };

            _context.CounselorCallbackRequests.Add(cb);
            await _context.SaveChangesAsync();
            return ToCallbackDto(cb);
        }

        public async Task<CallbackRequestDto> CompleteCallbackAsync(
            Guid callbackId, CompleteCallbackRequest request, Guid tenantId, Guid completedByUserId)
        {
            var cb = await _context.CounselorCallbackRequests
                .FirstOrDefaultAsync(c => c.Id == callbackId && c.TenantId == tenantId && c.DeletedAt == null)
                ?? throw new InvalidOperationException($"Callback {callbackId} not found");

            cb.CallbackStatus      = "Completed";
            cb.CompletedAt         = DateTime.UtcNow;
            cb.CompletedByUserId   = completedByUserId;
            cb.Outcome             = request.Outcome;
            cb.OutcomeNotes        = request.OutcomeNotes;
            cb.UpdatedAt           = DateTime.UtcNow;
            cb.UpdatedByUserId     = completedByUserId;

            await _context.SaveChangesAsync();
            return ToCallbackDto(cb);
        }

        public async Task<CallbackRequestDto> RescheduleCallbackAsync(
            Guid callbackId, RescheduleCallbackRequest request, Guid tenantId, Guid updatedByUserId)
        {
            var original = await _context.CounselorCallbackRequests
                .FirstOrDefaultAsync(c => c.Id == callbackId && c.TenantId == tenantId && c.DeletedAt == null)
                ?? throw new InvalidOperationException($"Callback {callbackId} not found");

            // Mark original as rescheduled
            original.CallbackStatus   = "Rescheduled";
            original.UpdatedAt        = DateTime.UtcNow;
            original.UpdatedByUserId  = updatedByUserId;

            // Create follow-on callback
            var newCb = new CounselorCallbackRequest
            {
                Id                  = Guid.NewGuid(),
                TenantId            = original.TenantId,
                SessionId           = original.SessionId,
                PatientId           = original.PatientId,
                BranchId            = original.BranchId,
                AssignedToUserId    = request.AssignedToUserId ?? original.AssignedToUserId,
                CallbackType        = original.CallbackType,
                Channel             = original.Channel,
                CallbackDate        = request.NewCallbackDate.Date,
                CallbackTime        = request.NewCallbackTime,
                CallbackNotes       = request.RescheduleReason ?? original.CallbackNotes,
                PatientPreferredTime = original.PatientPreferredTime,
                CallbackStatus      = "Scheduled",
                Priority            = original.Priority,
                RescheduledFromId   = original.Id,
                CreatedAt           = DateTime.UtcNow,
                UpdatedAt           = DateTime.UtcNow,
                CreatedByUserId     = updatedByUserId,
                UpdatedByUserId     = updatedByUserId,
                Status              = "active"
            };

            original.RescheduledToId = newCb.Id;
            _context.CounselorCallbackRequests.Add(newCb);
            await _context.SaveChangesAsync();
            return ToCallbackDto(newCb);
        }

        // ── Overdue Sessions ──────────────────────────────────────────────────

        public async Task<IEnumerable<OverdueSessionDto>> GetOverdueSessionsAsync(
            Guid tenantId, Guid? branchId, int overdueThresholdDays = 7)
        {
            var cutoffDate = DateTime.UtcNow.Date.AddDays(-overdueThresholdDays);

            var query = _context.CounselingSession
                .Where(s =>
                    s.TenantId == tenantId &&
                    s.DeletedAt == null &&
                    (s.EscalationStatus == "Overdue" || s.EscalationStatus == "Escalated" ||
                     (s.LastContactDate == null || s.LastContactDate.Value.Date <= cutoffDate)) &&
                    (s.Status == "Scheduled" || s.Status == "InProgress" || s.Status == "Completed")
                );

            if (branchId.HasValue)
                query = query.Where(s => s.BranchId == branchId.Value);

            var sessions = await query
                .OrderBy(s => s.LastContactDate)
                .Take(200)
                .ToListAsync();

            var patientIds = sessions.Select(s => s.PatientId).Distinct().ToList();
            var patients   = await _context.Patients
                .Where(p => patientIds.Contains(p.Id) && p.DeletedAt == null)
                .ToDictionaryAsync(p => p.Id);

            var today = DateTime.UtcNow.Date;
            return sessions.Select(s =>
            {
                patients.TryGetValue(s.PatientId, out var p);
                var daysSince = s.LastContactDate.HasValue
                    ? (today - s.LastContactDate.Value.Date).Days
                    : 999;

                return new OverdueSessionDto
                {
                    SessionId             = s.Id,
                    SessionNumber         = s.SessionNumber,
                    PatientId             = s.PatientId,
                    PatientName           = p != null ? $"{p.FirstName} {p.LastName}" : null,
                    PatientPhone          = p?.ContactNumber,
                    PatientType           = s.PatientType,
                    SessionStage          = s.CurrentStage,
                    LastContactDate       = s.LastContactDate,
                    DaysSinceLastContact  = daysSince,
                    ContactAttemptCount   = s.ContactAttemptCount,
                    LastContactOutcome    = s.LastContactOutcome,
                    EscalationStatus      = s.EscalationStatus,
                    BranchId              = s.BranchId,
                    CounselorId           = s.CounselorId
                };
            });
        }

        // ── Quick-Book Surgery from Session ───────────────────────────────────

        public async Task<QuickBookSurgeryResponse> QuickBookFromSessionAsync(
            Guid sessionId, QuickBookFromSessionRequest request, Guid tenantId, Guid bookedByUserId)
        {
            var session = await _context.CounselingSession
                .FirstOrDefaultAsync(s => s.Id == sessionId && s.TenantId == tenantId && s.DeletedAt == null)
                ?? throw new InvalidOperationException($"Session {sessionId} not found");

            // Phase 3I Slice 7 (PD-S7-02/05/06 — M15): expected Version required; fail closed; stale → 409 upstream.
            if (!request.Version.HasValue)
                throw new ArgumentException("Version is required.");
            if (session.Version != request.Version.Value)
                throw new InvalidOperationException(SessionConcurrency.StaleMessage);

            var theater = await _context.OTTheaters
                .FirstOrDefaultAsync(t => t.Id == request.TheaterId && t.TenantId == tenantId && t.DeletedAt == null)
                ?? throw new InvalidOperationException($"Theater {request.TheaterId} not found");

            if (!TimeSpan.TryParse(request.StartTime, out var startTime))
                throw new ArgumentException($"Invalid start time format: {request.StartTime}. Use HH:mm.");

            var endTime = startTime.Add(TimeSpan.FromMinutes(request.EstimatedDurationMinutes));

            // Collision check: same theater, same date/time slot
            var collision = await _context.OTSchedules
                .AnyAsync(s =>
                    s.TheaterId == request.TheaterId &&
                    s.TenantId == tenantId &&
                    s.ScheduledDate.Date == request.ScheduledDate.Date &&
                    s.DeletedAt == null &&
                    s.Status != "Cancelled" &&
                    s.StartTime < endTime &&
                    s.EndTime > startTime);

            if (collision)
                throw new InvalidOperationException("Theater is already booked for the requested time slot");

            var scheduleNumber = $"OT-{DateTime.UtcNow:yyyyMMdd}-{Guid.NewGuid().ToString("N")[..6].ToUpper()}";

            var schedule = new OTSchedule
            {
                Id             = Guid.NewGuid(),
                TenantId       = tenantId,
                BranchId       = theater.BranchId,
                TheaterId      = request.TheaterId,
                SessionId      = sessionId,
                PatientId      = session.PatientId,
                ScheduleNumber = scheduleNumber,
                ScheduledDate  = request.ScheduledDate.Date,
                StartTime      = startTime,
                EndTime        = endTime,
                DurationMinutes = request.EstimatedDurationMinutes,
                SurgeryType    = session.RecommendedSurgery ?? "General",
                EyeOperated   = request.Eye,
                SurgeonId      = request.SurgeonId,
                Status         = "Booked",
                ProcedureDescription = request.Notes,
                CreatedAt      = DateTime.UtcNow,
                CreatedByUserId = bookedByUserId,
                BookingConfirmedByUserId = bookedByUserId,
                ConfirmationTimestamp = DateTime.UtcNow
            };

            _context.OTSchedules.Add(schedule);

            // Mark session as surgery confirmed
            session.PatientAgreedToSurgery = true;
            session.PendingDecision = false;
            session.DecisionDate = DateTime.UtcNow;

            await _context.SaveChangesAsync();

            return new QuickBookSurgeryResponse
            {
                Success        = true,
                ScheduleId     = schedule.Id,
                ScheduleNumber = scheduleNumber,
                Message        = $"Surgery booked successfully for {request.ScheduledDate:MMM dd, yyyy}",
                SessionVersion = session.Version,
            };
        }

        // ── Mapping Helpers ───────────────────────────────────────────────────

        private static CommLogDto ToCommLogDto(CounselorCommunicationLog l) => new()
        {
            Id                  = l.Id,
            SessionId           = l.SessionId,
            PatientId           = l.PatientId,
            CounselorId         = l.CounselorId,
            Channel             = l.Channel,
            Direction           = l.Direction,
            CommunicationAt     = l.CommunicationAt,
            Outcome             = l.Outcome,
            CallDurationMinutes = l.CallDurationMinutes,
            MessageBody         = l.MessageBody,
            ResponseSummary     = l.ResponseSummary,
            NextAction          = l.NextAction,
            NextActionDate      = l.NextActionDate,
            TemplateId          = l.TemplateId,
            CreatedAt           = l.CreatedAt,
            CreatedByUserId     = l.CreatedByUserId
        };

        private static CallbackRequestDto ToCallbackDto(CounselorCallbackRequest c) => new()
        {
            Id                  = c.Id,
            SessionId           = c.SessionId,
            PatientId           = c.PatientId,
            BranchId            = c.BranchId,
            AssignedToUserId    = c.AssignedToUserId,
            CallbackType        = c.CallbackType,
            Channel             = c.Channel,
            CallbackDate        = c.CallbackDate,
            CallbackTime        = c.CallbackTime,
            CallbackNotes       = c.CallbackNotes,
            PatientPreferredTime = c.PatientPreferredTime,
            CallbackStatus      = c.CallbackStatus,
            CompletedAt         = c.CompletedAt,
            OutcomeNotes        = c.OutcomeNotes,
            Outcome             = c.Outcome,
            Priority            = c.Priority,
            CreatedAt           = c.CreatedAt
        };
    }
}
