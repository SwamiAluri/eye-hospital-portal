using System;
using System.Collections.Generic;
using System.Linq;
using System.Net.Http;
using System.Net.Http.Json;
using System.Text.Json;
using System.Threading.Tasks;
using AuthService.Context;
using AuthService.Models;
using AuthService.Models.Domain;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;

namespace AuthService.Services
{
    /// <summary>
    /// Implements the OT finalize scheduling state machine.
    /// All mutations write an audit log entry and increment the version counter.
    /// </summary>
    public class OtFinalizeService : IOtFinalizeService
    {
        private readonly AppDbContext _db;
        private readonly IHttpClientFactory _httpFactory;
        private readonly IConfiguration _config;
        private readonly ILogger<OtFinalizeService> _logger;

        public OtFinalizeService(
            AppDbContext db,
            IHttpClientFactory httpFactory,
            IConfiguration config,
            ILogger<OtFinalizeService> logger)
        {
            _db = db;
            _httpFactory = httpFactory;
            _config = config;
            _logger = logger;
        }

        // ─────────────────────────────────────────────────────────────────────
        // UPSERT — create or update when counsellor marks Done + Schedule
        // ─────────────────────────────────────────────────────────────────────

        public async Task<OtScheduleResponse> UpsertFromCounsellorAsync(
            UpsertOtScheduleRequest request, Guid tenantId, Guid userId)
        {
            // Self-heal: backfill Uhid and PatientName from Patient table if not provided by frontend
            if ((string.IsNullOrEmpty(request.Uhid) || string.IsNullOrEmpty(request.PatientName))
                && request.PatientId != Guid.Empty)
            {
                var patient = await _db.Patients.AsNoTracking()
                    .FirstOrDefaultAsync(p => p.Id == request.PatientId);
                if (patient != null)
                {
                    if (string.IsNullOrEmpty(request.Uhid))
                        request.Uhid = patient.HealthId ?? patient.MedicalRecordNumber;
                    if (string.IsNullOrEmpty(request.PatientName))
                        request.PatientName = $"{patient.FirstName} {patient.LastName}".Trim();
                }
            }

            await EnrichRequestFromOpdAsync(request, tenantId);

            // Find existing active record for this patient (unique partial index)
            var existing = await _db.OtFinalizeSchedules
                .Where(s => s.TenantId == tenantId
                         && s.PatientId == request.PatientId
                         && s.DeletedAt == null
                         && s.Status != OtFinalizeStatus.Cancelled
                         && s.Status != OtFinalizeStatus.SurgeryDone)
                .FirstOrDefaultAsync();

            if (existing != null)
            {
                // UPDATE — counsellor changed schedule while already in OT pipeline
                var oldSnapshot = Snapshot(existing);
                // Heal stored Uhid/PatientName if they were null when first created
                if (string.IsNullOrEmpty(existing.Uhid) && !string.IsNullOrEmpty(request.Uhid))
                    existing.Uhid = request.Uhid;
                if (string.IsNullOrEmpty(existing.PatientName) && !string.IsNullOrEmpty(request.PatientName))
                    existing.PatientName = request.PatientName;
                existing.SurgeryName   = OpdClinicalCopy.FirstNonEmpty(request.SurgeryName, existing.SurgeryName)
                                         ?? existing.SurgeryName;
                existing.Eye           = OpdClinicalCopy.FirstNonEmpty(request.Eye, existing.Eye);
                existing.PatientType   = request.PatientType;
                existing.PaymentMode   = request.PaymentMode;
                existing.DoctorId      = request.DoctorId;
                existing.DoctorName    = request.DoctorName;
                existing.TheatreId     = request.TheatreId;
                existing.TheatreName   = request.TheatreName;
                existing.StartTime       = request.StartTime;
                existing.EndTime         = request.EndTime;
                existing.ReportingTime   = request.ReportingTime;
                existing.PackageName     = request.PackageName;
                existing.PackageRate     = request.PackageRate;
                existing.AnesthesiaType  = request.AnesthesiaType;
                existing.AnesthetistName = request.AnesthetistName;
                existing.IolPower        = OpdClinicalCopy.FirstNonEmpty(request.IolPower, existing.IolPower);
                existing.Remarks         = request.Remarks;

                // Any change resets to NotConfirmed for revalidation
                var oldStatus = existing.Status;
                if (existing.Status != OtFinalizeStatus.Cancelled &&
                    existing.Status != OtFinalizeStatus.SurgeryDone)
                {
                    existing.Status   = OtFinalizeStatus.NotConfirmed;
                    existing.IsLocked = false;
                }

                existing.Version++;
                existing.UpdatedAt       = DateTime.UtcNow;
                existing.UpdatedByUserId = userId;

                await AddAuditAsync(existing.Id, "Upsert", oldStatus, existing.Status,
                                    oldSnapshot, Snapshot(existing), userId.ToString());
                await _db.SaveChangesAsync();
                if (existing.StartTime.HasValue)
                    _ = NotifyJourneyRebookAsync(existing.Id, tenantId, existing.StartTime, userId);
                _ = NotifyJourneyOpdCopyAsync(existing, tenantId, userId, forceRefresh: false);
                return ToResponse(existing);
            }
            else
            {
                // INSERT — first time this patient enters the OT pipeline
                var entity = new OtFinalizeSchedule
                {
                    TenantId              = tenantId,
                    PatientId             = request.PatientId,
                    Uhid                  = request.Uhid,
                    PatientName           = request.PatientName,
                    SurgeryName           = request.SurgeryName,
                    Eye                   = request.Eye,
                    PatientType           = request.PatientType,
                    PaymentMode           = request.PaymentMode,
                    DoctorId              = request.DoctorId,
                    DoctorName            = request.DoctorName,
                    TheatreId             = request.TheatreId,
                    TheatreName           = request.TheatreName,
                    StartTime             = request.StartTime,
                    EndTime               = request.EndTime,
                    ReportingTime         = request.ReportingTime,
                    PackageName           = request.PackageName,
                    PackageRate           = request.PackageRate,
                    AnesthesiaType        = request.AnesthesiaType,
                    AnesthetistName       = request.AnesthetistName,
                    IolPower              = request.IolPower,
                    Remarks               = request.Remarks,
                    Status                = OtFinalizeStatus.NotConfirmed,
                    Version               = 1,
                    IsLocked              = false,
                    CounsellingSessionId  = request.CounsellingSessionId,
                    CreatedByUserId       = userId,
                    UpdatedByUserId       = userId,
                };
                _db.OtFinalizeSchedules.Add(entity);
                await _db.SaveChangesAsync();

                await AddAuditAsync(entity.Id, "Upsert", null, entity.Status,
                                    null, Snapshot(entity), userId.ToString());
                await _db.SaveChangesAsync();
                if (entity.StartTime.HasValue)
                    _ = NotifyJourneyRebookAsync(entity.Id, tenantId, entity.StartTime, userId);
                _ = NotifyJourneyOpdCopyAsync(entity, tenantId, userId, forceRefresh: false);
                return ToResponse(entity);
            }
        }

        // ─────────────────────────────────────────────────────────────────────
        // GET FINALIZE LIST
        // ─────────────────────────────────────────────────────────────────────

        public async Task<List<OtScheduleResponse>> GetFinalizeListAsync(
            OtScheduleFilters filters, Guid tenantId)
        {
            var query = _db.OtFinalizeSchedules
                .Where(s => s.TenantId == tenantId && s.DeletedAt == null)
                .AsQueryable();

            if (filters.Date.HasValue)
            {
                var date = filters.Date.Value.Date;
                query = query.Where(s => s.StartTime.HasValue &&
                    s.StartTime.Value.Date == date);
            }

            if (!string.IsNullOrWhiteSpace(filters.Uhid))
                query = query.Where(s => s.Uhid != null &&
                    s.Uhid.ToLower().Contains(filters.Uhid.ToLower()));

            if (!string.IsNullOrWhiteSpace(filters.Name))
                query = query.Where(s =>
                    s.PatientName.ToLower().Contains(filters.Name.ToLower()));

            if (!string.IsNullOrWhiteSpace(filters.Status))
                query = query.Where(s => s.Status == filters.Status);

            if (filters.CounsellingSessionId.HasValue)
                query = query.Where(s => s.CounsellingSessionId == filters.CounsellingSessionId.Value);

            var results = await query
                .OrderBy(s => s.StartTime)
                .ToListAsync();

            // Batch-load patients to backfill missing Uhid / PatientName from denormalised rows
            var missingIds = results
                .Where(s => string.IsNullOrEmpty(s.Uhid) || string.IsNullOrEmpty(s.PatientName))
                .Select(s => s.PatientId).Distinct().ToList();

            var patientCache = new Dictionary<Guid, (string? Uhid, string PatientName)>();
            if (missingIds.Count > 0)
            {
                patientCache = await _db.Patients
                    .Where(p => missingIds.Contains(p.Id))
                    .ToDictionaryAsync(
                        p => p.Id,
                        p => (Uhid: (string?)(p.HealthId ?? p.MedicalRecordNumber),
                              PatientName: $"{p.FirstName} {p.LastName}".Trim()));
            }

            // Batch-load counselling sessions for backfill + checklist computation
            var allSessionIds = results
                .Where(s => s.CounsellingSessionId.HasValue)
                .Select(s => s.CounsellingSessionId!.Value).Distinct().ToList();

            var sessionCache = new Dictionary<Guid, (string? Surgery, string? Eye, bool AnesthesiaConsent, string PatientType, decimal? PackageAmount)>();
            if (allSessionIds.Count > 0)
            {
                sessionCache = await _db.CounselingSession
                    .Where(cs => allSessionIds.Contains(cs.Id))
                    .ToDictionaryAsync(
                        cs => cs.Id,
                        cs => (
                            Surgery: cs.RecommendedSurgery,
                            Eye: cs.SurgeryTentativeEye,
                            AnesthesiaConsent: cs.AnesthesiaConsent,
                            PatientType: cs.PatientType,
                            PackageAmount: cs.PackageAmount
                        ));
            }

            return results.Select(e =>
            {
                var r = ToResponse(e);
                if (patientCache.TryGetValue(e.PatientId, out var pd))
                {
                    if (string.IsNullOrEmpty(r.Uhid))        r.Uhid = pd.Uhid;
                    if (string.IsNullOrEmpty(r.PatientName)) r.PatientName = pd.PatientName;
                }
                if (e.CounsellingSessionId.HasValue &&
                    sessionCache.TryGetValue(e.CounsellingSessionId.Value, out var sd))
                {
                    if (!string.IsNullOrEmpty(sd.Surgery))
                        r.SurgeryName = sd.Surgery!;
                    if (string.IsNullOrEmpty(r.Eye) && !string.IsNullOrEmpty(sd.Eye))
                        r.Eye = sd.Eye;
                    // Backfill package rate from session when entity row has none
                    if (!r.PackageRate.HasValue && sd.PackageAmount.HasValue)
                        r.PackageRate = sd.PackageAmount;
                    // Compute checklist summary for list view columns
                    r.InvestigationsStatus = "Pending"; // no dedicated tracking field yet
                    var paymentDone = !string.IsNullOrWhiteSpace(sd.PatientType);
                    var consentDone = sd.AnesthesiaConsent;
                    r.ChecklistSummary = (paymentDone && consentDone) ? "AllClear" : "Pending";
                }
                return r;
            }).ToList();
        }

        // ─────────────────────────────────────────────────────────────────────
        // EDIT SLOT
        // ─────────────────────────────────────────────────────────────────────

        public async Task<OtScheduleResponse> UpdateSlotAsync(
            Guid id, UpdateSlotRequest request, Guid tenantId, Guid userId)
        {
            var entity = await GetOrThrowAsync(id, tenantId);
            GuardLocked(entity);

            var oldSnapshot = Snapshot(entity);
            var oldStatus = entity.Status;

            entity.DoctorId   = request.DoctorId   ?? entity.DoctorId;
            entity.DoctorName = request.DoctorName  ?? entity.DoctorName;
            entity.TheatreId  = request.TheatreId   ?? entity.TheatreId;
            entity.TheatreName = request.TheatreName ?? entity.TheatreName;
            entity.StartTime  = request.StartTime   ?? entity.StartTime;
            entity.EndTime    = request.EndTime      ?? entity.EndTime;

            // Any edit on a Confirmed record resets it to NotConfirmed (revalidation required)
            if (entity.Status == OtFinalizeStatus.Confirmed)
                entity.Status = OtFinalizeStatus.NotConfirmed;

            entity.Version++;
            entity.UpdatedAt       = DateTime.UtcNow;
            entity.UpdatedByUserId = userId;

            await AddAuditAsync(entity.Id, "EditSlot", oldStatus, entity.Status,
                                oldSnapshot, Snapshot(entity), userId.ToString());
            await _db.SaveChangesAsync();
            return ToResponse(entity);
        }

        // ─────────────────────────────────────────────────────────────────────
        // CONFIRM (with conflict check)
        // ─────────────────────────────────────────────────────────────────────

        public async Task<OtScheduleResponse> ConfirmAsync(Guid id, Guid tenantId, Guid userId)
        {
            var entity = await GetOrThrowAsync(id, tenantId);

            if (entity.Status != OtFinalizeStatus.NotConfirmed)
                throw new InvalidOperationException(
                    $"Cannot confirm: record is '{entity.Status}', expected 'NotConfirmed'.");

            // Conflict check — exact start_time match with same doctor or same theatre
            if (entity.StartTime.HasValue)
            {
                var conflictQuery = _db.OtFinalizeSchedules.Where(s =>
                    s.TenantId == tenantId &&
                    s.Id != entity.Id &&
                    s.DeletedAt == null &&
                    s.StartTime == entity.StartTime &&
                    (s.Status == OtFinalizeStatus.Confirmed ||
                     s.Status == OtFinalizeStatus.Finalised ||
                     s.Status == OtFinalizeStatus.OTPrepared));

                bool hasConflict = false;
                string conflictReason = string.Empty;

                if (entity.DoctorId.HasValue)
                {
                    hasConflict = await conflictQuery
                        .AnyAsync(s => s.DoctorId == entity.DoctorId);
                    if (hasConflict) conflictReason = $"Doctor '{entity.DoctorName}' already has a case at this time.";
                }

                if (!hasConflict && entity.TheatreId.HasValue)
                {
                    hasConflict = await conflictQuery
                        .AnyAsync(s => s.TheatreId == entity.TheatreId);
                    if (hasConflict) conflictReason = $"Theatre '{entity.TheatreName}' is already booked at this time.";
                }

                if (hasConflict)
                    throw new InvalidOperationException($"Scheduling conflict: {conflictReason}");
            }

            var oldStatus = entity.Status;
            entity.Status          = OtFinalizeStatus.Confirmed;
            entity.Version++;
            entity.UpdatedAt       = DateTime.UtcNow;
            entity.UpdatedByUserId = userId;

            await AddAuditAsync(entity.Id, "Confirm", oldStatus, entity.Status,
                                null, Snapshot(entity), userId.ToString());
            await _db.SaveChangesAsync();
            return ToResponse(entity);
        }

        // ─────────────────────────────────────────────────────────────────────
        // FINALISE
        // ─────────────────────────────────────────────────────────────────────

        public async Task<OtScheduleResponse> FinaliseAsync(Guid id, Guid tenantId, Guid userId)
        {
            var entity = await GetOrThrowAsync(id, tenantId);

            if (entity.Status != OtFinalizeStatus.Confirmed)
                throw new InvalidOperationException(
                    $"Cannot finalise: record is '{entity.Status}', expected 'Confirmed'.");

            var oldStatus = entity.Status;
            entity.Status          = OtFinalizeStatus.Finalised;
            entity.Version++;
            entity.UpdatedAt       = DateTime.UtcNow;
            entity.UpdatedByUserId = userId;

            await AddAuditAsync(entity.Id, "Finalise", oldStatus, entity.Status,
                                null, Snapshot(entity), userId.ToString());
            await _db.SaveChangesAsync();
            return ToResponse(entity);
        }

        // ─────────────────────────────────────────────────────────────────────
        // CANCEL + back-sync to counselling service
        // ─────────────────────────────────────────────────────────────────────

        public async Task<OtScheduleResponse> CancelAsync(Guid id, Guid tenantId, Guid userId)
        {
            var entity = await GetOrThrowAsync(id, tenantId);

            var oldStatus = entity.Status;
            entity.Status    = OtFinalizeStatus.Cancelled;
            entity.IsLocked  = false;
            entity.Version++;
            entity.UpdatedAt       = DateTime.UtcNow;
            entity.UpdatedByUserId = userId;

            await AddAuditAsync(entity.Id, "Cancel", oldStatus, entity.Status,
                                null, Snapshot(entity), userId.ToString());
            await _db.SaveChangesAsync();

            // Auto back-sync: if linked to a counselling session, set it to RepeatCounselling
            if (entity.CounsellingSessionId.HasValue)
            {
                await BackSyncToCounsellingAsync(entity.CounsellingSessionId.Value, entity.Id);
            }

            return ToResponse(entity);
        }

        // ─────────────────────────────────────────────────────────────────────
        // REOPEN (OTPrepared → Confirmed)
        // ─────────────────────────────────────────────────────────────────────

        public async Task<OtScheduleResponse> ReopenAsync(Guid id, Guid tenantId, Guid userId)
        {
            var entity = await GetOrThrowAsync(id, tenantId);

            var oldStatus = entity.Status;

            if (entity.Status == OtFinalizeStatus.OTPrepared)
            {
                entity.Status = OtFinalizeStatus.Confirmed;
            }
            else if (entity.Status == OtFinalizeStatus.Cancelled)
            {
                entity.Status = OtFinalizeStatus.NotConfirmed;
            }
            else
            {
                throw new InvalidOperationException(
                    $"Cannot reopen: record is '{entity.Status}', expected 'OTPrepared' or 'Cancelled'.");
            }

            entity.IsLocked  = false;
            entity.Version++;
            entity.UpdatedAt       = DateTime.UtcNow;
            entity.UpdatedByUserId = userId;

            await AddAuditAsync(entity.Id, "Reopen", oldStatus, entity.Status,
                                null, Snapshot(entity), userId.ToString());
            await _db.SaveChangesAsync();
            return ToResponse(entity);
        }

        // ─────────────────────────────────────────────────────────────────────
        // PREPARE OT LIST (batch lock)
        // ─────────────────────────────────────────────────────────────────────

        public async Task PrepareOtListAsync(PrepareOtListRequest request,
                                             Guid tenantId, Guid userId)
        {
            var targetDate = request.Date.Date;

            var scheduleIds = request.Items.Select(i => i.ScheduleId).ToList();

            var entities = await _db.OtFinalizeSchedules
                .Where(s => scheduleIds.Contains(s.Id) &&
                            s.TenantId == tenantId &&
                            s.DeletedAt == null)
                .ToListAsync();

            // Validate: every record must be 'Finalised'
            var notFinalised = entities
                .Where(s => s.Status != OtFinalizeStatus.Finalised)
                .Select(s => $"{s.PatientName} ({s.Status})")
                .ToList();

            if (notFinalised.Any())
                throw new InvalidOperationException(
                    $"Cannot prepare — the following records are not Finalised: {string.Join(", ", notFinalised)}");

            // Build a new-time map for items that carry a time override
            var newTimeMap = request.Items
                .Where(i => i.NewStartTime.HasValue)
                .ToDictionary(i => i.ScheduleId, i => i.NewStartTime!.Value);

            // Apply start-time overrides before conflict check so the comparison uses final times
            foreach (var entity in entities)
            {
                if (newTimeMap.TryGetValue(entity.Id, out var newTime))
                    entity.StartTime = targetDate.Add(newTime.TimeOfDay);
            }

            // Guard: block only when a submitted record's exact start time is already occupied by
            // an OTPrepared record that is NOT part of this batch (i.e. a genuine slot collision).
            // Pull all OTPrepared records for this date into memory, then compare in-process
            // to avoid EF Core DateTime translation issues with Npgsql.
            var targetDateStart = targetDate;
            var targetDateEnd   = targetDate.AddDays(1);

            var existingPrepared = await _db.OtFinalizeSchedules
                .Where(s =>
                    s.TenantId == tenantId &&
                    s.DeletedAt == null &&
                    s.Status == OtFinalizeStatus.OTPrepared &&
                    !scheduleIds.Contains(s.Id) &&
                    s.StartTime.HasValue &&
                    s.StartTime.Value >= targetDateStart &&
                    s.StartTime.Value < targetDateEnd)
                .Select(s => s.StartTime!.Value)
                .ToListAsync();

            if (existingPrepared.Any())
            {
                // Compare by time-of-day (HH:mm) to detect slot collisions
                var occupiedSlots = new HashSet<TimeSpan>(existingPrepared.Select(t => t.TimeOfDay));

                var conflictingIds = entities
                    .Where(s => s.StartTime.HasValue && occupiedSlots.Contains(s.StartTime.Value.TimeOfDay))
                    .Select(s => s.Id)
                    .ToList();

                if (conflictingIds.Any())
                    throw new OtPrepareConflictException(conflictingIds);
            }

            var preparedAt  = DateTime.UtcNow;
            var preparedBy  = request.PreparedBy ?? userId.ToString();
            var sequenceMap = request.Items.ToDictionary(i => i.ScheduleId, i => i.Sequence);

            foreach (var entity in entities)
            {
                await ValidateSameDaySingleEyeGuardAsync(entity, tenantId);

                var oldStatus = entity.Status;
                entity.Status         = OtFinalizeStatus.OTPrepared;
                entity.IsLocked       = true;
                entity.SequenceNo     = sequenceMap.TryGetValue(entity.Id, out var seq) ? seq : null;
                entity.PreparedAt     = preparedAt;
                entity.PreparedBy     = preparedBy;
                entity.Version++;
                entity.UpdatedAt       = DateTime.UtcNow;
                entity.UpdatedByUserId = userId;

                await AddAuditAsync(entity.Id, "Prepare", oldStatus, entity.Status,
                                    null, Snapshot(entity), preparedBy);
            }

            await _db.SaveChangesAsync();

            foreach (var entity in entities)
                _ = NotifyJourneyOpdCopyAsync(entity, tenantId, userId, forceRefresh: false);
        }

        // ─────────────────────────────────────────────────────────────────────
        // GET OT LIST (OTPrepared records for a date)
        // ─────────────────────────────────────────────────────────────────────

        public async Task<List<OtScheduleResponse>> GetOtListAsync(DateTime date, Guid tenantId)
        {
            var targetDate = date.Date;
            var results = await _db.OtFinalizeSchedules
                .Where(s =>
                    s.TenantId == tenantId &&
                    s.DeletedAt == null &&
                    s.Status == OtFinalizeStatus.OTPrepared &&
                    s.StartTime.HasValue &&
                    s.StartTime.Value.Date == targetDate)
                .OrderBy(s => s.SequenceNo ?? int.MaxValue)
                .ThenBy(s => s.StartTime)
                .ToListAsync();

            return results.Select(ToResponse).ToList();
        }

        // ─────────────────────────────────────────────────────────────────────
        // MARK SURGERY DONE (called by IP Management via internal HTTP)
        // ─────────────────────────────────────────────────────────────────────

        /// <inheritdoc />
        public async Task<OtScheduleResponse?> MarkSurgeryDoneAsync(
            Guid id, Guid tenantId, string actorUserId)
        {
            var entity = await _db.OtFinalizeSchedules
                .FirstOrDefaultAsync(s => s.Id == id &&
                                          s.TenantId == tenantId &&
                                          s.DeletedAt == null);

            if (entity == null)
            {
                _logger.LogWarning(
                    "MarkSurgeryDone: OT record {Id} not found for tenant {TenantId}.", id, tenantId);
                return null;
            }

            // Idempotent — already done
            if (entity.Status == OtFinalizeStatus.SurgeryDone)
                return ToResponse(entity);

            // Cancelled records are not updated (surgery was never performed on them)
            if (entity.Status == OtFinalizeStatus.Cancelled)
            {
                _logger.LogWarning(
                    "MarkSurgeryDone: OT record {Id} is Cancelled — skipping SurgeryDone transition.", id);
                return ToResponse(entity);
            }

            var oldStatus = entity.Status;
            entity.Status          = OtFinalizeStatus.SurgeryDone;
            entity.IsLocked        = false; // unlock so staff can view/edit post-discharge if needed
            entity.Version++;
            entity.UpdatedAt       = DateTime.UtcNow;
            entity.UpdatedByUserId = Guid.TryParse(actorUserId, out var uid) ? uid : entity.UpdatedByUserId;

            await AddAuditAsync(entity.Id, "MarkSurgeryDone", oldStatus, entity.Status,
                                null, Snapshot(entity), actorUserId);
            await _db.SaveChangesAsync();

            _logger.LogInformation(
                "MarkSurgeryDone: OT record {Id} transitioned {Old} → SurgeryDone by {Actor}.",
                id, oldStatus, actorUserId);

            return ToResponse(entity);
        }

        // ─────────────────────────────────────────────────────────────────────
        // PRIVATE HELPERS
        // ─────────────────────────────────────────────────────────────────────

        private async Task<OtFinalizeSchedule> GetOrThrowAsync(Guid id, Guid tenantId)
        {
            var entity = await _db.OtFinalizeSchedules
                .FirstOrDefaultAsync(s => s.Id == id &&
                                          s.TenantId == tenantId &&
                                          s.DeletedAt == null);

            if (entity == null)
                throw new KeyNotFoundException($"OT schedule record '{id}' not found.");

            return entity;
        }

        private static void GuardLocked(OtFinalizeSchedule entity)
        {
            if (entity.IsLocked)
                throw new InvalidOperationException(
                    $"Record is locked (status: {entity.Status}). Use 'Reopen OT Case' to make changes.");
        }

        private Task AddAuditAsync(Guid scheduleId, string action,
                                   string? oldStatus, string? newStatus,
                                   string? oldValue, string? newValue,
                                   string changedBy)
        {
            _db.OtFinalizeAuditLogs.Add(new OtFinalizeAuditLog
            {
                ScheduleId  = scheduleId,
                Action      = action,
                OldStatus   = oldStatus,
                NewStatus   = newStatus,
                OldValue    = oldValue,
                NewValue    = newValue,
                ChangedBy   = changedBy,
                ChangedAt   = DateTime.UtcNow,
            });
            return Task.CompletedTask;
        }

        private static string? Snapshot(OtFinalizeSchedule e) =>
            JsonSerializer.Serialize(new
            {
                e.Status, e.DoctorName, e.TheatreName,
                e.StartTime, e.EndTime, e.Version, e.IsLocked,
            });

        private static OtScheduleResponse ToResponse(OtFinalizeSchedule e) => new()
        {
            Id                   = e.Id,
            PatientId            = e.PatientId,
            Uhid                 = e.Uhid,
            PatientName          = e.PatientName,
            SurgeryName          = e.SurgeryName,
            Eye                  = e.Eye,
            PatientType          = e.PatientType,
            PaymentMode          = e.PaymentMode,
            DoctorId             = e.DoctorId,
            DoctorName           = e.DoctorName,
            TheatreId            = e.TheatreId,
            TheatreName          = e.TheatreName,
            StartTime            = e.StartTime,
            EndTime              = e.EndTime,
            Status               = e.Status,
            SequenceNo           = e.SequenceNo,
            IsLocked             = e.IsLocked,
            PreparedAt           = e.PreparedAt,
            PreparedBy           = e.PreparedBy,
            Version              = e.Version,
            CounsellingSessionId = e.CounsellingSessionId,
            CreatedAt            = e.CreatedAt,
            UpdatedAt            = e.UpdatedAt,
            // Computed permissions
            CanEdit    = !e.IsLocked && e.Status != OtFinalizeStatus.Cancelled && e.Status != OtFinalizeStatus.SurgeryDone,
            CanConfirm = e.Status == OtFinalizeStatus.NotConfirmed,
            CanFinalise = e.Status == OtFinalizeStatus.Confirmed,
            CanCancel  = e.Status != OtFinalizeStatus.Cancelled && e.Status != OtFinalizeStatus.SurgeryDone,
            CanReopen  = e.Status == OtFinalizeStatus.OTPrepared || e.Status == OtFinalizeStatus.Cancelled,
            PackageName = e.PackageName,
            PackageRate = e.PackageRate,
            // Reporting time — surfaced in list view
            ReportingTime = e.ReportingTime,
            // Derive checklist health from slot assignment completeness
            ChecklistSummary =
                (string.IsNullOrEmpty(e.DoctorName) && string.IsNullOrEmpty(e.TheatreName))
                    ? "Missing"
                    : (!string.IsNullOrEmpty(e.DoctorName) && !string.IsNullOrEmpty(e.TheatreName) && e.StartTime.HasValue)
                        ? "AllClear"
                        : "Pending",
            // Convenience date string — avoids frontend having to parse StartTime ISO string
            ScheduleDate = e.StartTime.HasValue
                ? e.StartTime.Value.ToString("yyyy-MM-dd")
                : null,
        };

        private static OtScheduleDetailResponse ToDetailResponse(
            OtFinalizeSchedule e,
            int? age,
            string? gender,
            DateTime? visitDate,
            string? diagnosis,
            OtChecklistDto checklist) => new()
        {
            // Base fields
            Id                   = e.Id,
            PatientId            = e.PatientId,
            Uhid                 = e.Uhid,
            PatientName          = e.PatientName,
            SurgeryName          = e.SurgeryName,
            Eye                  = e.Eye,
            PatientType          = e.PatientType,
            PaymentMode          = e.PaymentMode,
            DoctorId             = e.DoctorId,
            DoctorName           = e.DoctorName,
            TheatreId            = e.TheatreId,
            TheatreName          = e.TheatreName,
            StartTime            = e.StartTime,
            EndTime              = e.EndTime,
            Status               = e.Status,
            SequenceNo           = e.SequenceNo,
            IsLocked             = e.IsLocked,
            PreparedAt           = e.PreparedAt,
            PreparedBy           = e.PreparedBy,
            Version              = e.Version,
            CounsellingSessionId = e.CounsellingSessionId,
            CreatedAt            = e.CreatedAt,
            UpdatedAt            = e.UpdatedAt,
            CanEdit    = !e.IsLocked && e.Status != OtFinalizeStatus.Cancelled && e.Status != OtFinalizeStatus.SurgeryDone,
            CanConfirm = e.Status == OtFinalizeStatus.NotConfirmed,
            CanFinalise = e.Status == OtFinalizeStatus.Confirmed,
            CanCancel  = e.Status != OtFinalizeStatus.Cancelled && e.Status != OtFinalizeStatus.SurgeryDone,
            CanReopen  = e.Status == OtFinalizeStatus.OTPrepared,
            // Detail fields
            ReportingTime   = e.ReportingTime,
            AnesthesiaType  = e.AnesthesiaType,
            AnesthetistName = e.AnesthetistName,
            IolPower        = e.IolPower,
            Remarks         = e.Remarks,
            CancelReason    = e.CancelReason,
            PackageName     = e.PackageName,
            PackageRate     = e.PackageRate,
            // Enriched patient header
            Age       = age,
            Gender    = gender,
            VisitDate = visitDate,
            Diagnosis = diagnosis,
            // Checklist
            Checklist = checklist,
            BiometryMissingForEye = false,
        };

        /// <summary>
        /// HTTP POST to ip-management to clear pending-rebook when a new surgery date is set.
        /// Non-fatal: OT schedule mutation must not be blocked by ip-management unavailability.
        /// </summary>
        private async Task NotifyJourneyRebookAsync(
            Guid scheduleId, Guid tenantId, DateTime? surgeryScheduledAt, Guid userId)
        {
            if (!surgeryScheduledAt.HasValue) return;
            try
            {
                var baseUrl = _config["IpManagementService:BaseUrl"] ?? "http://localhost:5074/api";
                var key     = _config["InternalApi:Key"] ?? string.Empty;
                var client  = _httpFactory.CreateClient();
                if (!string.IsNullOrEmpty(key))
                    client.DefaultRequestHeaders.Add("X-Internal-Key", key);

                var payload = new
                {
                    otScheduleId        = scheduleId,
                    tenantId,
                    surgeryScheduledAt,
                    actorUserId         = userId.ToString(),
                };
                var response = await client.PostAsJsonAsync(
                    $"{baseUrl.TrimEnd('/')}/ip-management/internal/journey-sync/apply-rebook",
                    payload);

                if (!response.IsSuccessStatusCode)
                {
                    var body = await response.Content.ReadAsStringAsync();
                    _logger.LogWarning(
                        "Journey rebook sync for schedule {ScheduleId} returned {Status}: {Body}",
                        scheduleId, (int)response.StatusCode, body);
                }
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex,
                    "Failed to sync counselling rebook to ip-management for schedule {ScheduleId}.",
                    scheduleId);
            }
        }

        /// <summary>
        /// HTTP POST to the counselling microservice to transition the linked session to RepeatCounselling.
        /// Non-fatal: logs a warning on failure so the OT cancel still succeeds.
        /// </summary>
        private async Task BackSyncToCounsellingAsync(Guid counsellingSessionId, Guid scheduleId)
        {
            try
            {
                var counsellingBaseUrl = _config["CounsellingService:BaseUrl"]
                    ?? "http://localhost:7072";

                var client = _httpFactory.CreateClient("counselling");
                var payload = new { reason = "OT case cancelled", otScheduleId = scheduleId };
                var response = await client.PostAsJsonAsync(
                    $"{counsellingBaseUrl}/counselling/{counsellingSessionId}/cancel-ot",
                    payload);

                if (!response.IsSuccessStatusCode)
                {
                    var body = await response.Content.ReadAsStringAsync();
                    _logger.LogWarning(
                        "Back-sync to counselling session {SessionId} returned {Status}: {Body}",
                        counsellingSessionId, (int)response.StatusCode, body);
                }
            }
            catch (Exception ex)
            {
                // Non-fatal: OT cancel must not be blocked by counselling service unavailability
                _logger.LogWarning(ex,
                    "Failed to back-sync cancellation to counselling session {SessionId}.",
                    counsellingSessionId);
            }
        }

        // ─────────────────────────────────────────────────────────────────────────
        // GET BY ID (enriched detail for the modal)
        // ─────────────────────────────────────────────────────────────────────────

        public async Task<OtScheduleDetailResponse> GetByIdAsync(Guid id, Guid tenantId)
        {
            var entity = await GetOrThrowAsync(id, tenantId);

            int? age = null;
            string? gender = null;
            DateTime? visitDate = null;
            string? diagnosis = null;

            // Enrich from counselling session + patient
            if (entity.CounsellingSessionId.HasValue)
            {
                var session = await _db.CounselingSession
                    .AsNoTracking()
                    .FirstOrDefaultAsync(s => s.Id == entity.CounsellingSessionId.Value);

                if (session != null)
                {
                    visitDate = session.SessionDate;
                    diagnosis = session.RecommendedSurgery;

                    var patient = await _db.Patients
                        .AsNoTracking()
                        .FirstOrDefaultAsync(p => p.Id == session.PatientId);

                    if (patient != null)
                    {
                        gender = patient.Gender;
                        var today = DateTime.Today;
                        age = today.Year - patient.DateOfBirth.Year;
                        if (patient.DateOfBirth.Date > today.AddYears(-age.Value)) age--;
                    }

                    // Build checklist from counselling session data
                    var checklist = new OtChecklistDto
                    {
                        // Payment: PatientType set means the counsellor recorded payment preference
                        PaymentStatus = !string.IsNullOrWhiteSpace(session.PatientType)
                            ? "Done" : "Pending",
                        // Consent: AnesthesiaConsent flag
                        ConsentStatus = session.AnesthesiaConsent ? "Done" : "Pending",
                        // Investigations: no dedicated tracking field — always Pending
                        InvestigationsStatus = "Pending",
                        // PreAuth: Insurance/CoPay patients need pre-authorisation
                        PreAuthStatus = (session.PatientType == "Insurance" || session.PatientType == "CoPay")
                            ? "Pending" : "NotRequired",
                    };

                    var resp = ToDetailResponse(entity, age, gender, visitDate, diagnosis, checklist);
                    // Override Uhid from patient.HealthId if entity row has null/empty
                    if (string.IsNullOrEmpty(resp.Uhid) && patient != null)
                        resp.Uhid = patient.HealthId ?? patient.MedicalRecordNumber;

                    // Populate patient demographics
                    if (patient != null)
                    {
                        resp.ContactNumber                = patient.ContactNumber;
                        resp.BloodGroup                   = patient.BloodGroup;
                        resp.DateOfBirth                  = patient.DateOfBirth;
                        resp.EmergencyContactName         = patient.EmergencyContactName;
                        resp.EmergencyContactPhone        = patient.EmergencyContactPhone;
                        resp.EmergencyContactRelationship = patient.EmergencyContactRelationship;
                        resp.Address                      = patient.Address;
                    }

                    // Supplement: use session date as surgery date hint when StartTime is null
                    if (!resp.StartTime.HasValue && session.SessionDate != default(DateTime))
                        resp.StartTime = session.SessionDate.Date;

                    // Supplement: enrich clinical fields from session when OT row has nulls
                    if (string.IsNullOrEmpty(resp.Eye) && !string.IsNullOrEmpty(session.SurgeryTentativeEye))
                        resp.Eye = session.SurgeryTentativeEye;
                    if (!string.IsNullOrEmpty(session.RecommendedSurgery))
                        resp.SurgeryName = session.RecommendedSurgery;
                    if (string.IsNullOrEmpty(resp.AnesthesiaType) && !string.IsNullOrEmpty(session.AnesthesiaTypeChoice))
                        resp.AnesthesiaType = session.AnesthesiaTypeChoice;
                    if ((!resp.PackageRate.HasValue || resp.PackageRate == 0) && session.PackageAmount.HasValue)
                        resp.PackageRate = session.PackageAmount;
                    if (string.IsNullOrEmpty(resp.IolPower) && !string.IsNullOrEmpty(session.IolPower))
                        resp.IolPower = session.IolPower;

                    await ApplyBiometryToDetailAsync(resp, tenantId, session.PatientId, session.SurgeryTentativeEye ?? resp.Eye);

                    return resp;
                }
            }

            // No session link — return with empty checklist; load demographics from Patient table
            var fallbackResp = ToDetailResponse(entity, age, gender, visitDate, diagnosis, new OtChecklistDto());
            var fp = await _db.Patients.AsNoTracking()
                .FirstOrDefaultAsync(x => x.Id == entity.PatientId);
            if (fp != null)
            {
                if (string.IsNullOrEmpty(fallbackResp.Uhid))
                    fallbackResp.Uhid = fp.HealthId ?? fp.MedicalRecordNumber;
                fallbackResp.Gender                       = fp.Gender;
                fallbackResp.ContactNumber                = fp.ContactNumber;
                fallbackResp.BloodGroup                   = fp.BloodGroup;
                fallbackResp.DateOfBirth                  = fp.DateOfBirth;
                fallbackResp.EmergencyContactName         = fp.EmergencyContactName;
                fallbackResp.EmergencyContactPhone        = fp.EmergencyContactPhone;
                fallbackResp.EmergencyContactRelationship = fp.EmergencyContactRelationship;
                fallbackResp.Address                      = fp.Address;
            }

            // No counselling_session_id link — try to recover package info from patient's
            // most recent agreed counselling session (handles legacy OT records created before
            // the session link was implemented).
            if (!fallbackResp.PackageRate.HasValue || fallbackResp.PackageRate == 0)
            {
                var latestSession = await _db.CounselingSession
                    .AsNoTracking()
                    .Where(s => s.PatientId == entity.PatientId
                             && s.PatientAgreedToSurgery == true
                             && s.TenantId == entity.TenantId)
                    .OrderByDescending(s => s.UpdatedAt)
                    .FirstOrDefaultAsync();

                if (latestSession != null)
                {
                    // Use the persisted package_amount column first
                    if (latestSession.PackageAmount.HasValue && latestSession.PackageAmount > 0)
                        fallbackResp.PackageRate = latestSession.PackageAmount;

                    // Parse the counsellor blob for packageName and rate fallback
                    if (!string.IsNullOrEmpty(latestSession.PackageAddonsJson))
                    {
                        try
                        {
                            var blob = System.Text.Json.JsonDocument.Parse(latestSession.PackageAddonsJson).RootElement;

                            // Package name — prefer blob's packageName field
                            if (string.IsNullOrEmpty(fallbackResp.PackageName) &&
                                blob.TryGetProperty("packageName", out var pnElem) &&
                                pnElem.ValueKind == System.Text.Json.JsonValueKind.String)
                                fallbackResp.PackageName = pnElem.GetString();

                            // Rate — use blob's rate field when package_amount column was null
                            if ((!fallbackResp.PackageRate.HasValue || fallbackResp.PackageRate == 0) &&
                                blob.TryGetProperty("rate", out var rateElem) &&
                                rateElem.ValueKind == System.Text.Json.JsonValueKind.Number)
                                fallbackResp.PackageRate = rateElem.GetDecimal();
                        }
                        catch { /* ignore malformed JSON */ }
                    }
                }
            }

            await ApplyBiometryToDetailAsync(fallbackResp, tenantId, entity.PatientId, fallbackResp.Eye);
            return fallbackResp;
        }

        // ─────────────────────────────────────────────────────────────────────────
        // UPDATE DETAILS (full modal save)
        // ─────────────────────────────────────────────────────────────────────────

        public async Task<OtScheduleResponse> UpdateDetailsAsync(
            Guid id, UpdateOtDetailsRequest request, Guid tenantId, Guid userId)
        {
            var entity = await GetOrThrowAsync(id, tenantId);
            GuardLocked(entity);

            var oldSnapshot = Snapshot(entity);
            var oldStatus   = entity.Status;

            // Slot fields (null = keep existing)
            if (request.DoctorId.HasValue)       entity.DoctorId      = request.DoctorId;
            if (request.DoctorName != null)      entity.DoctorName    = request.DoctorName;
            if (request.TheatreId.HasValue)      entity.TheatreId     = request.TheatreId;
            if (request.TheatreName != null)     entity.TheatreName   = request.TheatreName;
            if (request.StartTime.HasValue)      entity.StartTime     = request.StartTime;
            if (request.EndTime.HasValue)        entity.EndTime       = request.EndTime;

            // Schedule
            if (request.ReportingTime.HasValue)  entity.ReportingTime = request.ReportingTime;

            // Anesthesia
            if (request.AnesthesiaType != null)  entity.AnesthesiaType  = request.AnesthesiaType;
            if (request.AnesthetistName != null) entity.AnesthetistName = request.AnesthetistName;
            if (request.IolPower != null)        entity.IolPower        = request.IolPower;

            // Notes
            if (request.Remarks != null)         entity.Remarks       = request.Remarks;
            if (request.CancelReason != null)    entity.CancelReason  = request.CancelReason;

            // Package
            if (request.PackageName != null)     entity.PackageName   = request.PackageName;
            if (request.PackageRate.HasValue)    entity.PackageRate   = request.PackageRate;

            // Any edit on Confirmed or Finalised resets to NotConfirmed for revalidation
            if (entity.Status == OtFinalizeStatus.Confirmed ||
                entity.Status == OtFinalizeStatus.Finalised)
            {
                entity.Status   = OtFinalizeStatus.NotConfirmed;
                entity.IsLocked = false;
            }

            entity.Version++;
            entity.UpdatedAt       = DateTime.UtcNow;
            entity.UpdatedByUserId = userId;

            await AddAuditAsync(entity.Id, "UpdateDetails", oldStatus, entity.Status,
                                oldSnapshot, Snapshot(entity), userId.ToString());
            await _db.SaveChangesAsync();
            if (request.StartTime.HasValue)
                _ = NotifyJourneyRebookAsync(entity.Id, tenantId, entity.StartTime, userId);
            _ = NotifyJourneyOpdCopyAsync(entity, tenantId, userId, forceRefresh: false);
            return ToResponse(entity);
        }

        // ── W-01 OPD copy ────────────────────────────────────────────────────

        public async Task<OpdClinicalSnapshotDto> GetOpdClinicalSnapshotAsync(
            Guid tenantId, Guid patientId, Guid? sessionId, string? eyeHint, bool preferBiometry)
        {
            CounselingSession? session = null;
            if (sessionId.HasValue)
            {
                session = await _db.CounselingSession
                    .FirstOrDefaultAsync(s => s.Id == sessionId.Value && s.TenantId == tenantId);
            }

            return await ResolveOpdSnapshotAsync(tenantId, patientId, session, eyeHint, preferBiometry);
        }

        public async Task<OpdClinicalSnapshotDto> RefreshSessionFromOpdAsync(
            Guid sessionId, Guid tenantId, Guid userId)
        {
            var session = await _db.CounselingSession
                .FirstOrDefaultAsync(s => s.Id == sessionId && s.TenantId == tenantId)
                ?? throw new InvalidOperationException("Counselling session not found.");

            var snap = await ResolveOpdSnapshotAsync(
                tenantId, session.PatientId, session, session.SurgeryTentativeEye, preferBiometry: true);

            if (OpdClinicalCopy.ShouldWrite(session.RecommendedSurgery, snap.ProcedureName, forceRefresh: true))
                session.RecommendedSurgery = snap.ProcedureName;
            if (OpdClinicalCopy.ShouldWrite(session.IolPower, snap.IolPower, forceRefresh: true))
                session.IolPower = snap.IolPower;
            session.UpdatedAt = DateTime.UtcNow;
            session.UpdatedByUserId = userId;

            var ot = await _db.OtFinalizeSchedules
                .Where(s => s.CounsellingSessionId == sessionId
                         && s.TenantId == tenantId
                         && s.DeletedAt == null
                         && s.Status != OtFinalizeStatus.Cancelled
                         && s.Status != OtFinalizeStatus.SurgeryDone)
                .OrderByDescending(s => s.UpdatedAt)
                .FirstOrDefaultAsync();

            if (ot != null)
            {
                if (OpdClinicalCopy.ShouldWrite(ot.SurgeryName, snap.ProcedureName, forceRefresh: true))
                    ot.SurgeryName = snap.ProcedureName!;
                if (OpdClinicalCopy.ShouldWrite(ot.IolPower, snap.IolPower, forceRefresh: true))
                    ot.IolPower = snap.IolPower;
                ot.UpdatedAt = DateTime.UtcNow;
                ot.UpdatedByUserId = userId;
            }

            await _db.SaveChangesAsync();

            if (ot != null)
                _ = NotifyJourneyOpdCopyAsync(ot, tenantId, userId, forceRefresh: true);

            return snap;
        }

        private async Task EnrichRequestFromOpdAsync(UpsertOtScheduleRequest request, Guid tenantId)
        {
            CounselingSession? session = null;
            if (request.CounsellingSessionId.HasValue)
            {
                session = await _db.CounselingSession
                    .FirstOrDefaultAsync(s => s.Id == request.CounsellingSessionId.Value && s.TenantId == tenantId);
            }

            var eyeHint = OpdClinicalCopy.FirstNonEmpty(request.Eye, session?.SurgeryTentativeEye);
            var snap = await ResolveOpdSnapshotAsync(
                tenantId, request.PatientId, session, eyeHint, preferBiometry: false);

            if (string.IsNullOrWhiteSpace(request.SurgeryName) && !string.IsNullOrWhiteSpace(snap.ProcedureName))
                request.SurgeryName = snap.ProcedureName;
            if (string.IsNullOrWhiteSpace(request.Eye) && !string.IsNullOrWhiteSpace(session?.SurgeryTentativeEye))
                request.Eye = session!.SurgeryTentativeEye;
            if (string.IsNullOrWhiteSpace(request.IolPower) && !string.IsNullOrWhiteSpace(snap.IolPower))
                request.IolPower = snap.IolPower;

            if (session != null && OpdClinicalCopy.ShouldWrite(session.IolPower, snap.IolPower, forceRefresh: false))
            {
                session.IolPower = snap.IolPower;
                session.UpdatedAt = DateTime.UtcNow;
            }
        }

        private async Task ApplyBiometryToDetailAsync(
            OtScheduleDetailResponse resp, Guid tenantId, Guid patientId, string? eyeHint)
        {
            var snap = await ResolveOpdSnapshotAsync(tenantId, patientId, session: null, eyeHint, preferBiometry: false);
            if (string.IsNullOrWhiteSpace(resp.IolPower) && !string.IsNullOrWhiteSpace(snap.IolPower))
                resp.IolPower = snap.IolPower;
            resp.BiometryMissingForEye = snap.BiometryMissing;
        }

        private async Task<OpdClinicalSnapshotDto> ResolveOpdSnapshotAsync(
            Guid tenantId,
            Guid patientId,
            CounselingSession? session,
            string? eyeHint,
            bool preferBiometry)
        {
            var eyeRaw = OpdClinicalCopy.FirstNonEmpty(eyeHint, session?.SurgeryTentativeEye);
            var bioEye = OpdClinicalCopy.MapEyeToBiometry(eyeRaw);
            string? biometryIol = null;
            var biometryMissing = false;

            if (bioEye != null)
            {
                var latest = await _db.BiometryRecords
                    .AsNoTracking()
                    .Where(b => b.PatientId == patientId
                             && b.TenantId == tenantId
                             && b.DeletedAt == null
                             && b.Status == "active"
                             && b.Eye == bioEye)
                    .OrderByDescending(b => b.ExaminationDate)
                    .ThenByDescending(b => b.UpdatedAt)
                    .FirstOrDefaultAsync();

                biometryIol = OpdClinicalCopy.IolFromBiometry(latest?.CalculatedIol, latest?.IolCalculations);
                biometryMissing = latest == null || biometryIol == null;
            }

            var iol = OpdClinicalCopy.ResolveIol(
                existing: null,
                sessionIol: session?.IolPower,
                biometryIol: biometryIol,
                preferBiometry: preferBiometry);

            return new OpdClinicalSnapshotDto
            {
                ProcedureName = OpdClinicalCopy.FirstNonEmpty(session?.RecommendedSurgery),
                EyeOperated = OpdClinicalCopy.MapEyeToJourney(eyeRaw),
                IolPower = iol,
                BiometryMissing = biometryMissing,
                EyePhrase = OpdClinicalCopy.EyePhrase(eyeRaw),
                Diagnosis = session?.RecommendedSurgery,
            };
        }

        private async Task NotifyJourneyOpdCopyAsync(
            OtFinalizeSchedule entity, Guid tenantId, Guid userId, bool forceRefresh)
        {
            try
            {
                var baseUrl = _config["IpManagementService:BaseUrl"] ?? "http://localhost:5074/api";
                var key     = _config["InternalApi:Key"] ?? string.Empty;
                var client  = _httpFactory.CreateClient();
                if (!string.IsNullOrEmpty(key))
                    client.DefaultRequestHeaders.Add("X-Internal-Key", key);

                var payload = new
                {
                    otScheduleId   = entity.Id,
                    tenantId,
                    procedureName  = entity.SurgeryName,
                    eyeOperated    = OpdClinicalCopy.MapEyeToJourney(entity.Eye),
                    iolPower       = entity.IolPower,
                    forceRefresh,
                    actorUserId    = userId.ToString(),
                };
                var response = await client.PostAsJsonAsync(
                    $"{baseUrl.TrimEnd('/')}/ip-management/internal/journey-sync/copy-opd",
                    payload);

                if (!response.IsSuccessStatusCode)
                {
                    var body = await response.Content.ReadAsStringAsync();
                    _logger.LogWarning(
                        "Journey OPD copy for schedule {ScheduleId} returned {Status}: {Body}",
                        entity.Id, (int)response.StatusCode, body);
                }
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex,
                    "Failed to sync OPD clinical copy to ip-management for schedule {ScheduleId}.",
                    entity.Id);
            }
        }

        // ── G6: same-day single-eye scheduling guard ─────────────────────────

        private static bool IsBilateralEye(string? eye)
        {
            if (string.IsNullOrWhiteSpace(eye)) return false;
            var e = eye.Trim().ToUpperInvariant();
            return e is "BE" or "OU" or "BOTH" or "BOTH_EYES";
        }

        private static bool IsSingleEye(string? eye)
            => !string.IsNullOrWhiteSpace(eye) && !IsBilateralEye(eye);

        private async Task ValidateSameDaySingleEyeGuardAsync(
            OtFinalizeSchedule entity, Guid tenantId)
        {
            if (!IsSingleEye(entity.Eye) || !entity.StartTime.HasValue) return;

            var surgeryDate = entity.StartTime.Value.Date;

            var conflictingEyes = await _db.OtFinalizeSchedules
                .Where(s =>
                    s.PatientId == entity.PatientId
                    && s.TenantId == tenantId
                    && s.DeletedAt == null
                    && s.Id != entity.Id
                    && s.StartTime != null
                    && s.StartTime.Value.Date == surgeryDate
                    && s.Status != OtFinalizeStatus.Cancelled
                    && s.Status != OtFinalizeStatus.SurgeryDone)
                .Select(s => s.Eye)
                .ToListAsync();

            if (conflictingEyes.Any(e => IsSingleEye(e)))
            {
                throw new InvalidOperationException(
                    $"Same-day single-eye scheduling blocked: {entity.PatientName} already has a single-eye case on {surgeryDate:yyyy-MM-dd}. Use one bilateral (BE) journey or choose a different date.");
            }

            if (conflictingEyes.Any(e => IsBilateralEye(e)))
            {
                throw new InvalidOperationException(
                    $"Same-day scheduling blocked: {entity.PatientName} already has a bilateral (BE) case on {surgeryDate:yyyy-MM-dd}.");
            }
        }
    }
}
