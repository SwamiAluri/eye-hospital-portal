using System;
using System.Collections.Generic;
using System.Linq;
using System.Net.Http;
using System.Text;
using System.Text.Json;
using System.Threading.Tasks;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;
using AuthService.Context;
using AuthService.Models.Counselor;
using AuthService.Models.Domain;
using AuthService.Services.Interfaces;

namespace AuthService.Services
{
    public class CounselingWorkflowService : ICounselingWorkflowService
    {
        /// <summary>Phase 3I Slice 5 — approved operational History / platform Audit action names.</summary>
        public static class OwnershipAuditEvents
        {
            public const string EstablishedOnCreate = "OwnershipEstablishedOnCreate";
            public const string Assigned = "OwnershipAssigned";
            public const string Claimed = "OwnershipClaimed";
            public const string Reassigned = "OwnershipReassigned";
            /// <summary>Phase 3I Slice 8 — owned ReQueue clears CounselorId to NULL.</summary>
            public const string Requeued = "OwnershipRequeued";
        }

        private readonly AppDbContext _context;
        private readonly ILogger<CounselingWorkflowService> _logger;
        private readonly Interfaces.IBlobStorageService _blobStorageService;
        private readonly IHttpClientFactory _httpClientFactory;
        private readonly IQueueDisplayNotifier _queueDisplayNotifier;
        private readonly IFollowupBranchAccessService _followupBranchAccess;
        private readonly IAuditService? _audit;
        private readonly string _ccmsBaseUrl;
        private readonly string _internalApiKey;

        public CounselingWorkflowService(
            AppDbContext context, 
            ILogger<CounselingWorkflowService> logger,
            Interfaces.IBlobStorageService blobStorageService,
            IHttpClientFactory httpClientFactory,
            IConfiguration configuration,
            IQueueDisplayNotifier queueDisplayNotifier,
            IFollowupBranchAccessService followupBranchAccess,
            IAuditService? audit = null)
        {
            _context = context;
            _logger = logger;
            _blobStorageService = blobStorageService;
            _httpClientFactory = httpClientFactory;
            _queueDisplayNotifier = queueDisplayNotifier;
            _followupBranchAccess = followupBranchAccess;
            _audit = audit;
            _ccmsBaseUrl = configuration["CcmsService:BaseUrl"] ?? "http://localhost:7075/api";
            _internalApiKey = configuration["InternalApi:Key"] ?? string.Empty;
        }

        /// <summary>
        /// Phase 3I Slice 5 — dual trail (Operational History + immutable StageAsync).
        /// Caller must SaveChanges within the same DB transaction as the ownership mutation.
        /// </summary>
        private async Task StageOwnershipTrailAsync(
            Guid tenantId,
            Guid sessionId,
            Guid? branchId,
            Guid actorUserId,
            Guid? previousCounselorId,
            Guid? newCounselorId,
            string changeType,
            string source,
            string? intent = null,
            string? reason = null)
        {
            if (_audit is null)
            {
                throw new InvalidOperationException(
                    $"Ownership audit is unavailable; refusing to record {changeType} on session {sessionId}.");
            }

            var now = DateTime.UtcNow;
            var oldValue = previousCounselorId?.ToString();
            var newValue = newCounselorId?.ToString();
            // Prefer explicit reason (Reassign); else intent (Claim); else source (Assign).
            var reasonValue = !string.IsNullOrWhiteSpace(reason)
                ? reason.Trim()
                : (!string.IsNullOrWhiteSpace(intent) ? intent.Trim() : source);

            _context.CounselingSessionAuditLog.Add(new CounselingSessionAuditLog
            {
                Id = Guid.NewGuid(),
                TenantId = tenantId,
                SessionId = sessionId,
                ChangeType = changeType,
                OldValue = oldValue,
                NewValue = newValue,
                Reason = reasonValue,
                ChangedByUserId = actorUserId,
                ChangedAt = now,
            });

            var details = JsonSerializer.Serialize(new
            {
                actorUserId,
                previousCounselorId,
                newCounselorId,
                branchId,
                source,
                intent,
                reason = reasonValue,
                correlationId = sessionId,
            });

            await _audit.StageAsync(
                actorUserId,
                changeType,
                "CounselingSession",
                sessionId,
                details: details,
                oldValue: oldValue,
                newValue: newValue);
        }

        /// <inheritdoc />
        /// <summary>
        /// M19 (PD-S7-01, APPROVED Class A system writer) — CCMS fire-and-forget callback.
        /// No client-supplied Version: this is a trusted internal system writer, not a UI mutation.
        /// Relies on the CounselingSession concurrency token purely to detect a genuine race against
        /// another writer between load and save; on that race, SaveChangesAsync's central handler
        /// (see AppDbContext) throws <c>InvalidOperationException(SessionConcurrency.StaleMessage)</c>,
        /// which the caller (InternalCcmsCallbackController) maps to 409 — distinct from the
        /// `false` return used for NotFound.
        /// </summary>
        public async Task<bool> ApplyCcmsCallbackAsync(
            Guid sessionId,
            Guid? tenantId,
            Guid coverageCaseId,
            string caseNumber,
            string eventType,
            string? currentState = null)
        {
            var query = _context.CounselingSession.Where(s => s.Id == sessionId && s.DeletedAt == null);
            if (tenantId.HasValue)
                query = query.Where(s => s.TenantId == tenantId.Value);

            var session = await query.FirstOrDefaultAsync();
            if (session is null) return false;

            var merged = MergeCcmsIntoPackageAddons(
                session.PackageAddonsJson,
                coverageCaseId,
                caseNumber,
                eventType,
                currentState);

            session.PackageAddonsJson = merged;
            session.UpdatedAt = DateTime.UtcNow;
            // Throws InvalidOperationException(SessionConcurrency.StaleMessage) on a genuine concurrent
            // write race (DbUpdateConcurrencyException mapped centrally in AppDbContext.SaveChangesAsync).
            await _context.SaveChangesAsync();
            return true;
        }

        private static string MergeCcmsIntoPackageAddons(
            string? existingJson,
            Guid coverageCaseId,
            string caseNumber,
            string eventType,
            string? currentState)
        {
            var dict = new Dictionary<string, object?>(StringComparer.OrdinalIgnoreCase);

            if (!string.IsNullOrWhiteSpace(existingJson))
            {
                try
                {
                    using var doc = JsonDocument.Parse(existingJson);
                    foreach (var prop in doc.RootElement.EnumerateObject())
                    {
                        dict[prop.Name] = prop.Value.ValueKind switch
                        {
                            JsonValueKind.String  => prop.Value.GetString(),
                            JsonValueKind.Number  => prop.Value.TryGetDecimal(out var d) ? d : prop.Value.GetRawText(),
                            JsonValueKind.True    => true,
                            JsonValueKind.False   => false,
                            JsonValueKind.Null    => null,
                            _                     => prop.Value.GetRawText(),
                        };
                    }
                }
                catch { /* start fresh if blob is corrupt */ }
            }

            dict["ccmsCoverageCaseId"] = coverageCaseId.ToString();
            dict["ccmsCaseNumber"]     = caseNumber;
            dict["ccmsLastEvent"]      = eventType;
            dict["ccmsLinkedAt"]       = DateTime.UtcNow.ToString("o");
            if (!string.IsNullOrWhiteSpace(currentState))
                dict["ccmsCurrentState"] = currentState;

            return JsonSerializer.Serialize(dict);
        }

        private static (bool NotRequiredPreAuth, string? InsurerName, decimal? Estimate,
            Guid? InsuranceProviderId, Guid? TpaProviderId, Guid? GovernmentSchemeId)
            ParseCcmsFieldsFromPackageAddons(string? packageAddonsJson)
        {
            var notRequired = false;
            string? insurerName = null;
            decimal? estimate = null;
            Guid? insuranceProviderId = null;
            Guid? tpaProviderId = null;
            Guid? governmentSchemeId = null;

            if (string.IsNullOrWhiteSpace(packageAddonsJson))
                return (notRequired, insurerName, estimate, insuranceProviderId, tpaProviderId, governmentSchemeId);

            try
            {
                using var doc = JsonDocument.Parse(packageAddonsJson);
                var root = doc.RootElement;

                if (root.TryGetProperty("notRequiredPreAuth", out var nrp))
                {
                    notRequired = nrp.ValueKind == JsonValueKind.True
                        || (nrp.ValueKind == JsonValueKind.String
                            && string.Equals(nrp.GetString(), "true", StringComparison.OrdinalIgnoreCase));
                }

                if (root.TryGetProperty("insuranceCompany", out var ic))
                    insurerName = ic.GetString();

                if (root.TryGetProperty("finalPayableAmount", out var fpa)
                    && fpa.TryGetDecimal(out var fp) && fp > 0)
                    estimate = fp;
                else if (root.TryGetProperty("rate", out var rate) && rate.TryGetDecimal(out var r) && r > 0)
                    estimate = r;

                if (root.TryGetProperty("insuranceProviderId", out var ip)
                    && Guid.TryParse(ip.GetString(), out var ipGuid))
                    insuranceProviderId = ipGuid;

                if (root.TryGetProperty("tpaProviderId", out var tp)
                    && Guid.TryParse(tp.GetString(), out var tpGuid))
                    tpaProviderId = tpGuid;

                if (root.TryGetProperty("governmentSchemeId", out var gs)
                    && Guid.TryParse(gs.GetString(), out var gsGuid))
                    governmentSchemeId = gsGuid;
            }
            catch { /* ignore malformed JSON */ }

            return (notRequired, insurerName, estimate, insuranceProviderId, tpaProviderId, governmentSchemeId);
        }

        // ============================================================================
        // COUNSELING SESSIONS
        // ============================================================================

        public async Task<SessionListResponse> GetAllSessionsAsync(SessionFilters filters)
        {
            try
            {
                var query = _context.CounselingSession
                    .Where(s => s.DeletedAt == null);

                if (filters.TenantId.HasValue)
                    query = query.Where(s => s.TenantId == filters.TenantId.Value);

                // Phase2Z F-04 — authorized branch scope (never trust client BranchId alone).
                if (filters.AccessibleBranchIds != null)
                {
                    if (filters.AccessibleBranchIds.Count == 0)
                    {
                        return new SessionListResponse
                        {
                            Sessions = new List<CounselingSessionDto>(),
                            TotalCount = 0,
                            Page = filters.Page,
                            PageSize = filters.PageSize,
                            TotalPages = 0,
                        };
                    }

                    var branchIds = filters.AccessibleBranchIds as Guid[]
                        ?? filters.AccessibleBranchIds.ToArray();
                    query = query.Where(s =>
                        s.BranchId != null && branchIds.Contains(s.BranchId.Value));
                }
                else if (filters.BranchId.HasValue)
                {
                    // Legacy path when AccessibleBranchIds was not supplied (should not happen for HTTP list).
                    query = query.Where(s => s.BranchId == filters.BranchId.Value);
                }

                if (filters.PatientId.HasValue)
                    query = query.Where(s => s.PatientId == filters.PatientId.Value);

                if (filters.CounselorId.HasValue)
                {
                    var cid = filters.CounselorId.Value;
                    // Phase 3I Slice 11 (PD-S11-04 / PD15 parity): strict CounselorId — same predicate as Analytics.
                    query = query.Where(s => s.CounselorId == cid);
                }

                if (filters.ReferredByDoctorId.HasValue)
                    query = query.Where(s => s.ReferredByDoctorId == filters.ReferredByDoctorId.Value);

                if (!string.IsNullOrEmpty(filters.SessionType))
                    query = query.Where(s => s.SessionType == filters.SessionType);

                if (!string.IsNullOrEmpty(filters.PatientType))
                    query = query.Where(s => s.PatientType == filters.PatientType);

                if (!string.IsNullOrEmpty(filters.Status))
                    query = query.Where(s => s.Status == filters.Status);

                // Phase 4.2: Advanced Filters - Multiple Statuses
                if (filters.Statuses != null && filters.Statuses.Any())
                    query = query.Where(s => filters.Statuses.Contains(s.Status));

                // Phase 4.2: Advanced Filters - Urgencies
                if (filters.Urgencies != null && filters.Urgencies.Any())
                    query = query.Where(s => s.Urgency != null && filters.Urgencies.Contains(s.Urgency));

                // Phase 4.2: Quick Filters - Special presets
                if (!string.IsNullOrEmpty(filters.QuickFilter))
                {
                    var now = DateTime.UtcNow;
                    var today = now.Date;

                    switch (filters.QuickFilter.ToLower())
                    {
                        case "urgent":
                            query = query.Where(s => s.Urgency == "Urgent" || s.Urgency == "Emergency");
                            break;
                        case "today":
                            query = query.Where(s => s.SessionDate.Date == today);
                            break;
                        case "overdue":
                            query = query.Where(s => s.PendingDecision == true && 
                                                   (!s.DecisionDate.HasValue || s.DecisionDate.Value < now));
                            break;
                        case "pending":
                            query = query.Where(s => s.PendingDecision == true);
                            break;
                    }
                }

                if (filters.SessionDateFrom.HasValue)
                    query = query.Where(s => s.SessionDate >= filters.SessionDateFrom.Value);

                if (filters.SessionDateTo.HasValue)
                    query = query.Where(s => s.SessionDate <= filters.SessionDateTo.Value);

                if (filters.PendingDecision.HasValue)
                    query = query.Where(s => s.PendingDecision == filters.PendingDecision.Value);

                if (filters.PatientAgreedToSurgery.HasValue)
                    query = query.Where(s => s.PatientAgreedToSurgery == filters.PatientAgreedToSurgery.Value);

                if (!string.IsNullOrEmpty(filters.RecommendedSurgery))
                    query = query.Where(s => s.RecommendedSurgery != null && s.RecommendedSurgery == filters.RecommendedSurgery);

                if (!string.IsNullOrEmpty(filters.Search))
                {
                    query = query.Where(s => s.SessionNumber != null && s.SessionNumber.Contains(filters.Search));
                }

                // Phase 3I Slice 12 (PD-S12-02 / PD-S12-14) — Reassignment Required operational filter.
                if (filters.ReassignmentRequired == true)
                {
                    query = ApplyReassignmentRequiredFilter(query, filters.TenantId);
                }

                var totalCount = await query.CountAsync();

                var sessions = await query
                    .OrderByDescending(s => s.SessionDate)
                    .ThenByDescending(s => s.CreatedAt)
                    .Skip((filters.Page - 1) * filters.PageSize)
                    .Take(filters.PageSize)
                    .Select(s => new CounselingSessionDto
                    {
                        Id = s.Id,
                        TenantId = s.TenantId,
                        BranchId = s.BranchId,
                        PatientId = s.PatientId,
                        VisitId = s.VisitId,
                        ReferredByDoctorId = s.ReferredByDoctorId,
                        CounselorId = s.CounselorId,
                        SessionNumber = s.SessionNumber,
                        SessionType = s.SessionType,
                        SessionDate = s.SessionDate,
                        SessionStartTime = s.SessionStartTime,
                        SessionEndTime = s.SessionEndTime,
                        DurationMinutes = s.DurationMinutes,
                        PatientType = s.PatientType,
                        ClinicalSummary = s.ClinicalSummary,
                        RecommendedSurgery = s.RecommendedSurgery,
                        RecommendedIol = s.RecommendedIol,
                        IolPower = s.IolPower,
                        RecommendedProcedures = s.RecommendedProcedures,
                        Urgency = s.Urgency,
                        PackageDiscussed = s.PackageDiscussed,
                        PatientAgreedToSurgery = s.PatientAgreedToSurgery,
                        PendingDecision = s.PendingDecision,
                        DecisionDate = s.DecisionDate,
                        ReasonsForDelay = s.ReasonsForDelay,
                        Status = s.Status,
                        Version = s.Version,
                        CreatedAt = s.CreatedAt,
                        SurgeryTentativeDate = s.SurgeryTentativeDate,
                        SurgeryTentativeSurgeonId = s.SurgeryTentativeSurgeonId,
                        SurgeryTentativeTimeSlot = s.SurgeryTentativeTimeSlot,
                        SurgeryTentativeEye = s.SurgeryTentativeEye,
                        ConsentWitnessName = s.ConsentWitnessName,
                        ConsentWitnessRelation = s.ConsentWitnessRelation,
                        VideoConsentRecorded = s.VideoConsentRecorded,
                        ConsentFormsStatus = s.ConsentFormsStatus,
                        AdditionalNotes = s.AdditionalNotes,
                        PatientPresent = s.PatientPresent,
                        AttenderName = s.AttenderName,
                        AttenderPhone = s.AttenderPhone,
                        AttenderRelation = s.AttenderRelation,
                        AttenderIsDecisionMaker = s.AttenderIsDecisionMaker,
                        AttenderNotes = s.AttenderNotes,
                        PatientIntention = s.PatientIntention,
                        SurgeryTimeline = s.SurgeryTimeline,
                        AnesthesiaTypeChoice = s.AnesthesiaTypeChoice,
                        AnesthesiaConsent = s.AnesthesiaConsent
                    })
                    .ToListAsync();

                // Hydrate display names (in-memory after query execution)
                var patientIds = sessions.Select(s => s.PatientId).Distinct().ToList();
                var doctorIds = sessions.Select(s => s.ReferredByDoctorId).Distinct().ToList();
                var counselorIds = sessions.Where(s => s.CounselorId.HasValue)
                    .Select(s => s.CounselorId!.Value).Distinct().ToList();

                // Fetch patient names and MRNs
                var patientData = await _context.Patients
                    .Where(p => patientIds.Contains(p.Id))
                    .Select(p => new { p.Id, FullName = p.FirstName + " " + p.LastName, p.MedicalRecordNumber })
                    .ToListAsync();
                
                var patientNames = patientData.ToDictionary(p => p.Id, p => p.FullName);
                var patientMrns = patientData.ToDictionary(p => p.Id, p => p.MedicalRecordNumber);

                var doctorNames = await _context.Users
                    .Where(u => doctorIds.Contains(u.Id))
                    .ToDictionaryAsync(u => u.Id, u => u.FirstName + " " + u.LastName);

                var counselorNames = await _context.Users
                    .Where(u => counselorIds.Contains(u.Id))
                    .ToDictionaryAsync(u => u.Id, u => u.FirstName + " " + u.LastName);

                // Fetch surgeon names for tentative surgery planning
                var surgeonIds = sessions
                    .Where(s => s.SurgeryTentativeSurgeonId.HasValue)
                    .Select(s => s.SurgeryTentativeSurgeonId!.Value).Distinct().ToList();
                var surgeonNames = surgeonIds.Any()
                    ? await _context.Users
                        .Where(u => surgeonIds.Contains(u.Id))
                        .ToDictionaryAsync(u => u.Id, u => u.FirstName + " " + u.LastName)
                    : new Dictionary<Guid, string>();

                // Populate names and MRNs
                foreach (var session in sessions)
                {
                    session.PatientName = patientNames.GetValueOrDefault(session.PatientId);
                    session.PatientMrn = patientMrns.GetValueOrDefault(session.PatientId);
                    session.DoctorName = doctorNames.GetValueOrDefault(session.ReferredByDoctorId);
                    if (session.CounselorId.HasValue)
                    {
                        session.CounselorName = counselorNames.GetValueOrDefault(session.CounselorId.Value);
                    }
                    if (session.SurgeryTentativeSurgeonId.HasValue)
                    {
                        session.SurgeryTentativeSurgeonName = surgeonNames.GetValueOrDefault(session.SurgeryTentativeSurgeonId.Value);
                    }
                }


                var totalPages = (int)Math.Ceiling((double)totalCount / filters.PageSize);

                _logger.LogInformation("Retrieved {Count} counseling sessions (page {Page}/{TotalPages})", sessions.Count, filters.Page, totalPages);

                return new SessionListResponse
                {
                    Sessions = sessions,
                    TotalCount = totalCount,
                    Page = filters.Page,
                    PageSize = filters.PageSize,
                    TotalPages = totalPages
                };
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error retrieving counseling sessions");
                throw;
            }
        }

        public async Task<CounselingSessionDetailsDto?> GetSessionByIdAsync(Guid tenantId, Guid sessionId)
        {
            try
            {
                var session = await _context.CounselingSession
                    .Where(s => s.Id == sessionId && s.TenantId == tenantId && s.DeletedAt == null)
                    .Select(s => new CounselingSessionDetailsDto
                    {
                        Id = s.Id,
                        TenantId = s.TenantId,
                        BranchId = s.BranchId,
                        PatientId = s.PatientId,
                        VisitId = s.VisitId,
                        ReferredByDoctorId = s.ReferredByDoctorId,
                        CounselorId = s.CounselorId,
                        SessionNumber = s.SessionNumber,
                        SessionType = s.SessionType,
                        SessionDate = s.SessionDate,
                        SessionStartTime = s.SessionStartTime,
                        SessionEndTime = s.SessionEndTime,
                        DurationMinutes = s.DurationMinutes,
                        PatientType = s.PatientType,
                        ClinicalSummary = s.ClinicalSummary,
                        RecommendedSurgery = s.RecommendedSurgery,
                        RecommendedIol = s.RecommendedIol,
                        IolPower = s.IolPower,
                        RecommendedProcedures = s.RecommendedProcedures,
                        Urgency = s.Urgency,
                        PackageDiscussed = s.PackageDiscussed,
                        PatientAgreedToSurgery = s.PatientAgreedToSurgery,
                        PendingDecision = s.PendingDecision,
                        DecisionDate = s.DecisionDate,
                        ReasonsForDelay = s.ReasonsForDelay,
                        Status = s.Status,
                        Version = s.Version,
                        CreatedAt = s.CreatedAt,
                        // Package financials + counsellor JSON blob
                        SelectedPackageId = s.SelectedPackageId,
                        PackageAmount = s.PackageAmount,
                        PackageAddonsJson = s.PackageAddonsJson,
                        CurrentStage = s.CurrentStage,
                        SurgeryTentativeDate = s.SurgeryTentativeDate,
                        SurgeryTentativeSurgeonId = s.SurgeryTentativeSurgeonId,
                        SurgeryTentativeTimeSlot = s.SurgeryTentativeTimeSlot,
                        SurgeryTentativeEye = s.SurgeryTentativeEye,
                        ConsentWitnessName = s.ConsentWitnessName,
                        ConsentWitnessRelation = s.ConsentWitnessRelation,
                        VideoConsentRecorded = s.VideoConsentRecorded,
                        ConsentFormsStatus = s.ConsentFormsStatus,
                        AdditionalNotes = s.AdditionalNotes,
                        PatientPresent = s.PatientPresent,
                        AttenderName = s.AttenderName,
                        AttenderPhone = s.AttenderPhone,
                        AttenderRelation = s.AttenderRelation,
                        AttenderIsDecisionMaker = s.AttenderIsDecisionMaker,
                        AttenderNotes = s.AttenderNotes,
                        PatientIntention = s.PatientIntention,
                        SurgeryTimeline = s.SurgeryTimeline,
                        AnesthesiaTypeChoice = s.AnesthesiaTypeChoice,
                        AnesthesiaConsent = s.AnesthesiaConsent
                    })
                    .FirstOrDefaultAsync();

                if (session != null)
                {
                    // Hydrate display names, MRN, and demographics
                    var patient = await _context.Patients
                        .Where(p => p.Id == session.PatientId)
                        .Select(p => new { p.FirstName, p.LastName, p.MedicalRecordNumber, p.HealthId, p.DateOfBirth, p.Gender })
                        .FirstOrDefaultAsync();
                    if (patient != null)
                    {
                        session.PatientName    = patient.FirstName + " " + patient.LastName;
                        session.PatientMrn     = patient.MedicalRecordNumber;
                        session.PatientHealthId = patient.HealthId;
                        session.PatientGender  = patient.Gender;
                        var dob = patient.DateOfBirth;
                        var age = DateTime.UtcNow.Year - dob.Year;
                        if (dob > DateTime.UtcNow.AddYears(-age)) age--;
                        session.PatientAge = age;
                    }

                    var doctor = await _context.Users
                        .Where(u => u.Id == session.ReferredByDoctorId)
                        .Select(u => new { u.FirstName, u.LastName })
                        .FirstOrDefaultAsync();
                    if (doctor != null)
                    {
                        session.DoctorName = doctor.FirstName + " " + doctor.LastName;
                    }

                    if (session.CounselorId.HasValue)
                    {
                        var counselor = await _context.Users
                            .Where(u => u.Id == session.CounselorId.Value)
                            .Select(u => new { u.FirstName, u.LastName })
                            .FirstOrDefaultAsync();
                        if (counselor != null)
                        {
                            session.CounselorName = counselor.FirstName + " " + counselor.LastName;
                        }
                    }

                    if (session.SurgeryTentativeSurgeonId.HasValue)
                    {
                        var surgeon = await _context.Users
                            .Where(u => u.Id == session.SurgeryTentativeSurgeonId.Value)
                            .Select(u => new { u.FirstName, u.LastName })
                            .FirstOrDefaultAsync();
                        if (surgeon != null)
                        {
                            session.SurgeryTentativeSurgeonName = surgeon.FirstName + " " + surgeon.LastName;
                        }
                    }

                    // Load notes
                    session.Notes = await _context.CounselingSessionNotes
                        .Where(n => n.SessionId == sessionId && n.DeletedAt == null)
                        .Select(n => new SessionNoteDto
                        {
                            Id = n.Id,
                            TenantId = n.TenantId,
                            SessionId = n.SessionId,
                            NoteType = n.NoteType,
                            NoteText = n.NoteText,
                            IsConfidential = n.IsConfidential,
                            Tags = n.Tags,
                            CreatedAt = n.CreatedAt,
                            CreatedByUserId = n.CreatedByUserId
                        })
                        .OrderByDescending(n => n.CreatedAt)
                        .ToListAsync();

                    // Load documents
                    session.Documents = await _context.CounselingSessionDocuments
                        .Where(d => d.SessionId == sessionId && d.DeletedAt == null)
                        .Select(d => new SessionDocumentDto
                        {
                            Id = d.Id,
                            TenantId = d.TenantId,
                            SessionId = d.SessionId,
                            DocumentType = d.DocumentType,
                            DocumentName = d.DocumentName,
                            DocumentDescription = d.DocumentDescription,
                            FilePath = d.FilePath,
                            FileType = d.FileType,
                            FileSizeBytes = d.FileSizeBytes,
                            IsVerified = d.IsVerified,
                            VerifiedByUserId = d.VerifiedByUserId,
                            VerifiedAt = d.VerifiedAt,
                            VerificationNotes = d.VerificationNotes,
                            Status = d.Status,
                            CreatedAt = d.CreatedAt,
                            CreatedByUserId = d.CreatedByUserId
                        })
                        .OrderByDescending(d => d.CreatedAt)
                        .ToListAsync();

                    // Load queue status
                    session.QueueStatus = await _context.CounselorQueue
                        .Where(q => q.SessionId == sessionId && q.DeletedAt == null)
                        .Select(q => new CounselorQueueItemDto
                        {
                            Id = q.Id,
                            TenantId = q.TenantId,
                            BranchId = q.BranchId,
                            SessionId = q.SessionId,
                            PatientId = q.PatientId,
                            TokenNumber = q.TokenNumber,
                            QueueType = q.QueueType,
                            QueuePosition = q.QueuePosition,
                            PriorityScore = q.PriorityScore,
                            UrgencyLevel = q.UrgencyLevel,
                            AddedToQueueAt = q.AddedToQueueAt,
                            EstimatedWaitMinutes = q.EstimatedWaitMinutes,
                            CalledAt = q.CalledAt,
                            StartedAt = q.StartedAt,
                            CompletedAt = q.CompletedAt,
                            ActualWaitMinutes = q.ActualWaitMinutes,
                            Status = q.Status,
                            CreatedAt = q.CreatedAt
                        })
                        .FirstOrDefaultAsync();

                    // Recommendation only. The full priced catalog is loaded by the
                    // counselling procedure picker from the service catalog, not here.
                    ApplyStoredSurgeryRecommendation(session);

                    // Load existing investigation orders for this session
                    try
                    {
                        session.InvestigationOrders = await _context.CounselorLabOrderItems
                            .Where(o => o.SessionId == sessionId && o.TenantId == tenantId && o.DeletedAt == null)
                            .OrderBy(o => o.CreatedAt)
                            .Select(o => new InvestigationOrderItemDto
                            {
                                Id        = o.Id.ToString(),
                                CatalogId = o.LabTestCatalogId.HasValue ? o.LabTestCatalogId.Value.ToString() : null,
                                TestName  = o.TestName,
                                TestCode  = o.TestCode,
                                TestType  = o.TestType,
                                Eye       = o.Eye,
                                Price     = o.Price ?? 0m,
                                Urgency   = o.Urgency,
                                Status    = o.Status,
                                Source    = "counsellor",
                            })
                            .ToListAsync();
                    }
                    catch (Exception exInv)
                    {
                        _logger.LogError(exInv, "Failed to load investigation orders for session {SessionId} — returning empty list", sessionId);
                        session.InvestigationOrders = new();
                    }

                    // Pre-op test suggestions: ServiceVariant has no PreOpTestsRequired — omitted in V2

                } // end if (session != null)

                return session;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error retrieving counseling session {SessionId}", sessionId);
                throw;
            }
        }

        /// <summary>
        /// Session-level recommendation already stored on the row.
        /// Does not read service variants or prices. Cost stays 0 because quote pricing
        /// comes from the service catalog.
        /// </summary>
        private static void ApplyStoredSurgeryRecommendation(CounselingSessionDetailsDto session)
        {
            var seen = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
            if (!string.IsNullOrWhiteSpace(session.RecommendedProcedures))
            {
                try
                {
                    var procs = JsonSerializer.Deserialize<List<JsonElement>>(session.RecommendedProcedures);
                    if (procs != null)
                    {
                        foreach (var p in procs)
                        {
                            if (!p.TryGetProperty("surgeryTypeId", out var tp)
                                || tp.GetString() is not { } tid
                                || string.IsNullOrEmpty(tid))
                            {
                                continue;
                            }

                            var eyeRaw = p.TryGetProperty("eye", out var ep) ? ep.GetString() ?? "" : "";
                            var name = p.TryGetProperty("surgeryName", out var np) ? np.GetString() : null;
                            var category = p.TryGetProperty("surgeryCategory", out var cp) ? cp.GetString() : null;
                            foreach (var eye in RecommendationEyes(eyeRaw, session.SurgeryTentativeEye))
                            {
                                var id = $"type-{tid}-{eye}";
                                if (!seen.Add(id)) continue;
                                session.SurgeriesWithPricing.Add(new SurgeryPricingDto
                                {
                                    Id = id,
                                    SurgeryName = !string.IsNullOrWhiteSpace(name)
                                        ? name!
                                        : session.RecommendedSurgery ?? "",
                                    SurgeryCategory = category ?? "",
                                    Eye = eye,
                                    Cost = 0m,
                                    IsRecommended = true,
                                });
                            }
                        }
                    }
                }
                catch
                {
                    /* malformed JSON — fall through to the text recommendation */
                }
            }

            if (session.SurgeriesWithPricing.Count > 0 || string.IsNullOrWhiteSpace(session.RecommendedSurgery))
                return;

            foreach (var eye in RecommendationEyes(null, session.SurgeryTentativeEye))
            {
                session.SurgeriesWithPricing.Add(new SurgeryPricingDto
                {
                    Id = $"rec-{eye}",
                    SurgeryName = session.RecommendedSurgery,
                    Eye = eye,
                    Cost = 0m,
                    IsRecommended = true,
                });
            }
        }

        private static IEnumerable<string> RecommendationEyes(string? eye, string? tentativeEye)
        {
            var chosen = string.IsNullOrWhiteSpace(eye) ? tentativeEye : eye;
            if (string.Equals(chosen, "BE", StringComparison.OrdinalIgnoreCase))
                return new[] { "RE", "LE" };
            return new[] { string.IsNullOrWhiteSpace(chosen) ? "RE" : chosen! };
        }

        public async Task<CounselingSessionDetailsDto?> GetSessionByNumberAsync(Guid tenantId, string sessionNumber)
        {
            try
            {
                var session = await _context.CounselingSession
                    .Where(s => s.SessionNumber == sessionNumber && s.TenantId == tenantId && s.DeletedAt == null)
                    .FirstOrDefaultAsync();

                if (session == null)
                    return null;

                return await GetSessionByIdAsync(tenantId, session.Id);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error retrieving session by number {SessionNumber}", sessionNumber);
                throw;
            }
        }

        public async Task<SessionOperationResult> CreateSessionAsync(CreateCounselingSessionRequest request, Guid currentUserId)
        {
            // PD-C: authoritative reuse vs new episode (SurgeryDone from OtFinalizeSchedules only).
            var reuseBlock = await TryGetCreateSessionReuseBlockAsync(request.TenantId, request.PatientId);
            if (reuseBlock != null)
                return reuseBlock;

            using var transaction = await _context.Database.BeginTransactionAsync();
            try
            {
                // PD-ADM-01: Admin/non-counsellor create → NULL (Assign later).
                // Counsellor Waiting List Add Patient → actor becomes owner at create.
                // Client-supplied request.CounselorId is ignored — not an ownership bypass.
                // CreatedByUserId remains the audit creator (actor), never a substitute for ownership.
                Guid? ownerCounselorId = null;
                var actor = await _context.Users.AsNoTracking()
                    .FirstOrDefaultAsync(u => u.Id == currentUserId);
                if (actor != null
                    && await IsAssignableCounsellorAsync(currentUserId, actor.UserType, actor.Designation))
                {
                    ownerCounselorId = currentUserId;
                }

                var session = new CounselingSession
                {
                    Id = Guid.NewGuid(),
                    TenantId = request.TenantId,
                    BranchId = request.BranchId,
                    PatientId = request.PatientId,
                    VisitId = request.VisitId,
                    ReferredByDoctorId = request.ReferredByDoctorId,
                    CounselorId = ownerCounselorId,
                    SessionType = request.SessionType,
                    SessionDate = request.SessionDate ?? DateTime.UtcNow.Date,
                    PatientType = request.PatientType,
                    ClinicalSummary = request.ClinicalSummary,
                    RecommendedSurgery = request.RecommendedSurgery,
                    RecommendedIol = request.RecommendedIol,
                    IolPower = request.IolPower,
                    RecommendedProcedures = request.RecommendedProcedures,
                    Urgency = request.Urgency,
                    SessionCategory = request.SessionCategory,
                    SurgeryTentativeEye = request.SurgeryTentativeEye,
                    AdditionalNotes = request.AdditionalNotes,
                    PatientPresent = request.PatientPresent,
                    AttenderName = request.AttenderName,
                    AttenderPhone = request.AttenderPhone,
                    AttenderRelation = request.AttenderRelation,
                    AttenderIsDecisionMaker = request.AttenderIsDecisionMaker,
                    AttenderNotes = request.AttenderNotes,
                    PatientIntention = FollowupQueryContracts.NormalizeWritablePatientIntention(request.PatientIntention),
                    SurgeryTimeline = request.SurgeryTimeline,
                    AnesthesiaTypeChoice = request.AnesthesiaTypeChoice,
                    AnesthesiaConsent = request.AnesthesiaConsent,
                    Status = "Scheduled",
                    CreatedAt = DateTime.UtcNow,
                    CreatedByUserId = currentUserId,
                    UpdatedAt = DateTime.UtcNow,
                    UpdatedByUserId = currentUserId
                };

                _context.CounselingSession.Add(session);

                // Phase 3I Slice 5 (PD-S5-01): counsellor self-ownership → dual trail in same txn.
                if (ownerCounselorId.HasValue)
                {
                    await StageOwnershipTrailAsync(
                        tenantId: request.TenantId,
                        sessionId: session.Id,
                        branchId: request.BranchId,
                        actorUserId: currentUserId,
                        previousCounselorId: null,
                        newCounselorId: ownerCounselorId,
                        changeType: OwnershipAuditEvents.EstablishedOnCreate,
                        source: "Create");
                }

                await _context.SaveChangesAsync();

                // Auto-add to queue if requested
                if (request.AddToQueue && request.BranchId.HasValue)
                {
                    var urgencyLevel = request.Urgency switch
                    {
                        "Emergency" => "Critical",
                        "Urgent" => "High",
                        _ => "Normal"
                    };

                    var queueRequest = new AddToQueueRequest
                    {
                        TenantId = request.TenantId,
                        BranchId = request.BranchId.Value,
                        SessionId = session.Id,
                        PatientId = request.PatientId,
                        QueueType = "Counseling",
                        UrgencyLevel = urgencyLevel
                    };

                    await AddToQueueAsync(queueRequest);
                }

                await transaction.CommitAsync();

                _logger.LogInformation("Created counseling session {SessionId} for patient {PatientId}", session.Id, request.PatientId);

                var createdSession = await GetSessionByIdAsync(request.TenantId, session.Id);

                return new SessionOperationResult
                {
                    Success = true,
                    Message = "Session created successfully",
                    SessionId = session.Id,
                    Session = createdSession
                };
            }
            catch (Exception ex)
            {
                await transaction.RollbackAsync();
                _logger.LogError(ex, "Error creating counseling session");
                var detail = ex.InnerException?.Message ?? ex.Message;
                return new SessionOperationResult
                {
                    Success = false,
                    Message = $"Error creating session: {detail}"
                };
            }
        }

        public async Task<SessionOperationResult> UpdateSessionAsync(Guid tenantId, Guid sessionId, UpdateCounselingSessionRequest request, Guid currentUserId)
        {
            try
            {
                var session = await _context.CounselingSession
                    .FirstOrDefaultAsync(s => s.Id == sessionId && s.TenantId == tenantId && s.DeletedAt == null);

                if (session == null)
                {
                    return new SessionOperationResult
                    {
                        Success = false,
                        FailureKind = SessionOperationFailureKind.NotFound,
                        Message = "Session not found"
                    };
                }

                // Phase 3I Slice 7 (PD-S7-02/05): expected Version is required; stale → Conflict (409).
                var versionDeny = DenyUnlessExpectedVersion(session, request.Version);
                if (versionDeny != null)
                    return versionDeny;

                // Phase 3I Slice 4 (S4-D2): CounselorId must not change via Update.
                if (request.CounselorId.HasValue)
                {
                    return new SessionOperationResult
                    {
                        Success = false,
                        FailureKind = SessionOperationFailureKind.BadRequest,
                        Message =
                            "CounselorId cannot be changed through Update. Use Assign or claim-for-lifecycle."
                    };
                }

                var ownerDeny = DenyUnlessSessionOwner(session, currentUserId);
                if (ownerDeny != null)
                    return ownerDeny;

                // PD-PENDING-READONLY-01: counselling-content mutation only after StartSession → InProgress
                // (or post-start terminal statuses). Entire UpdateSession DTO is counselling content
                // (CounselorId already rejected above). No ownership / Start side effects here.
                if (!AllowsCounselingContentMutation(session.Status))
                {
                    return new SessionOperationResult
                    {
                        Success = false,
                        FailureKind = SessionOperationFailureKind.BadRequest,
                        Message =
                            "Counselling session must be started before it can be edited. Use Start Counseling."
                    };
                }

                // CONTROLLED MUTABILITY: Validate patient type change if requested
                if (request.PatientType != null && request.PatientType != session.PatientType)
                {
                    // Validate stage allows mutation
                    var lockStages = new[] { "Financial", "Consent", "PreSurgery", "Scheduling", "Admission", "Followup", "Completed" };
                    var currentStage = session.CurrentStage ?? "Initial";
                    
                    if (lockStages.Contains(currentStage))
                    {
                        _logger.LogWarning(
                            "Attempted to change patient type from {OldType} to {NewType} for session {SessionId} at stage {Stage}",
                            session.PatientType, request.PatientType, sessionId, currentStage);
                            
                        return new SessionOperationResult
                        {
                            Success = false,
                            Message = $"Patient type cannot be changed after {currentStage} stage. Payment mode is locked once financial stage begins."
                        };
                    }
                    
                    // Validate new patient type is valid
                    var validTypes = new[] { "Cash", "Insurance", "CoPay", "ESH", "CGHS", "Arograshree", "SGHS", "Camp" };
                    if (!validTypes.Contains(request.PatientType))
                    {
                        return new SessionOperationResult
                        {
                            Success = false,
                            Message = $"Invalid patient type: {request.PatientType}. Valid types: {string.Join(", ", validTypes)}"
                        };
                    }
                    
                    // Log the change for audit trail
                    _logger.LogWarning(
                        "Patient type changed from {OldType} to {NewType} for session {SessionId} by user {UserId}",
                        session.PatientType, request.PatientType, sessionId, currentUserId);
                    
                    // Create audit log entry
                    var auditLog = new CounselingSessionAuditLog
                    {
                        Id = Guid.NewGuid(),
                        TenantId = tenantId,
                        SessionId = sessionId,
                        ChangeType = "PatientTypeChanged",
                        OldValue = session.PatientType,
                        NewValue = request.PatientType,
                        Reason = "Payment mode updated by counselor",
                        ChangedByUserId = currentUserId,
                        ChangedAt = DateTime.UtcNow
                    };
                    
                    _context.CounselingSessionAuditLog.Add(auditLog);
                    
                    // Update the patient type
                    session.PatientType = request.PatientType;
                }

                if (!string.IsNullOrWhiteSpace(request.SessionType))
                    session.SessionType = request.SessionType.Trim();

                // CounselorId: locked — ownership only via Assign / claim-for-lifecycle (Slice 4).
                if (request.SessionStartTime.HasValue) session.SessionStartTime = request.SessionStartTime.Value;
                if (request.SessionEndTime.HasValue) session.SessionEndTime = request.SessionEndTime.Value;
                if (request.ClinicalSummary != null) session.ClinicalSummary = request.ClinicalSummary;
                if (request.RecommendedSurgery != null) session.RecommendedSurgery = request.RecommendedSurgery;
                if (request.RecommendedIol != null) session.RecommendedIol = request.RecommendedIol;
                if (request.IolPower != null) session.IolPower = request.IolPower;
                if (request.RecommendedProcedures != null) session.RecommendedProcedures = request.RecommendedProcedures;
                if (request.Urgency != null) session.Urgency = request.Urgency;
                if (request.PackageDiscussed.HasValue) session.PackageDiscussed = request.PackageDiscussed.Value;
                if (request.PatientAgreedToSurgery.HasValue) session.PatientAgreedToSurgery = request.PatientAgreedToSurgery;
                if (request.PendingDecision.HasValue) session.PendingDecision = request.PendingDecision.Value;
                if (request.DecisionDate.HasValue) session.DecisionDate = request.DecisionDate.Value;
                if (request.ReasonsForDelay != null) session.ReasonsForDelay = request.ReasonsForDelay;
                if (request.Status != null) session.Status = request.Status;
                
                // Package Selection Data
                if (request.SelectedPackageId.HasValue) session.SelectedPackageId = request.SelectedPackageId.Value;
                if (request.PackageAmount.HasValue) session.PackageAmount = request.PackageAmount.Value;
                if (request.PackageAddonsJson != null) session.PackageAddonsJson = request.PackageAddonsJson;
                
                // Workflow Stage Tracking
                if (request.CurrentStage != null) session.CurrentStage = request.CurrentStage;

                // Surgery Tentative Planning
                if (request.SurgeryTentativeDate.HasValue) session.SurgeryTentativeDate = request.SurgeryTentativeDate.Value;
                if (request.SurgeryTentativeSurgeonId.HasValue) session.SurgeryTentativeSurgeonId = request.SurgeryTentativeSurgeonId.Value;
                if (request.SurgeryTentativeTimeSlot != null) session.SurgeryTentativeTimeSlot = request.SurgeryTentativeTimeSlot;
                if (request.SurgeryTentativeEye != null) session.SurgeryTentativeEye = request.SurgeryTentativeEye;

                // Consent Details
                if (request.ConsentWitnessName != null) session.ConsentWitnessName = request.ConsentWitnessName;
                if (request.ConsentWitnessRelation != null) session.ConsentWitnessRelation = request.ConsentWitnessRelation;
                if (request.VideoConsentRecorded.HasValue) session.VideoConsentRecorded = request.VideoConsentRecorded.Value;
                if (request.ConsentFormsStatus != null) session.ConsentFormsStatus = request.ConsentFormsStatus;
                if (request.ConsentFormsSigned == true) session.ConsentFormsStatus ??= "{\"allSigned\":true}";

                // Session Notes
                if (request.AdditionalNotes != null) session.AdditionalNotes = request.AdditionalNotes;

                // Attender / Family Member Counseling
                if (request.PatientPresent.HasValue) session.PatientPresent = request.PatientPresent.Value;
                if (request.AttenderName != null) session.AttenderName = request.AttenderName;
                if (request.AttenderPhone != null) session.AttenderPhone = request.AttenderPhone;
                if (request.AttenderRelation != null) session.AttenderRelation = request.AttenderRelation;
                if (request.AttenderIsDecisionMaker.HasValue) session.AttenderIsDecisionMaker = request.AttenderIsDecisionMaker.Value;
                if (request.AttenderNotes != null) session.AttenderNotes = request.AttenderNotes;

                // Patient Intention & Anesthesia — Phase2X write validation
                if (request.PatientIntention != null)
                {
                    session.PatientIntention =
                        FollowupQueryContracts.NormalizeWritablePatientIntention(request.PatientIntention);
                }
                if (request.SurgeryTimeline != null) session.SurgeryTimeline = request.SurgeryTimeline;
                if (request.AnesthesiaTypeChoice != null) session.AnesthesiaTypeChoice = request.AnesthesiaTypeChoice;
                if (request.AnesthesiaConsent.HasValue) session.AnesthesiaConsent = request.AnesthesiaConsent.Value;

                // Calculate duration if both times are set
                if (session.SessionStartTime.HasValue && session.SessionEndTime.HasValue)
                {
                    session.DurationMinutes = await CalculateDurationMinutesAsync(session.SessionStartTime.Value, session.SessionEndTime.Value);
                }

                session.UpdatedAt = DateTime.UtcNow;
                session.UpdatedByUserId = currentUserId;

                // ── Audit trail: write one entry per field that changed ─────────────
                // FieldChanges are computed on the frontend (diff of current vs saved snapshot).
                // We store them so counselors can review what changed in each save.
                // The Reason column carries the fieldName (avoids a schema migration).
                if (request.FieldChanges != null && request.FieldChanges.Count > 0)
                {
                    var now = DateTime.UtcNow;
                    foreach (var fc in request.FieldChanges)
                    {
                        if (string.IsNullOrWhiteSpace(fc.FieldName)) continue;
                        _context.CounselingSessionAuditLog.Add(new CounselingSessionAuditLog
                        {
                            Id = Guid.NewGuid(),
                            TenantId = tenantId,
                            SessionId = sessionId,
                            ChangeType = "FieldChanged",
                            OldValue = fc.OldValue,
                            NewValue = fc.NewValue,
                            Reason = fc.FieldName,   // ← field name stored in Reason column
                            ChangedByUserId = currentUserId,
                            ChangedAt = now,
                        });
                    }
                }
                // ─────────────────────────────────────────────────────────────────────

                await _context.SaveChangesAsync();

                _logger.LogInformation("Updated counseling session {SessionId}", sessionId);

                var updatedSession = await GetSessionByIdAsync(tenantId, sessionId);

                return new SessionOperationResult
                {
                    Success = true,
                    Message = "Session updated successfully",
                    SessionId = sessionId,
                    Session = updatedSession
                };
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error updating counseling session {SessionId}", sessionId);
                return new SessionOperationResult
                {
                    Success = false,
                    Message = $"Error updating session: {ex.Message}"
                };
            }
        }

        /// <summary>
        /// Phase 3I Slice 3 — explicit initial ownership assignment.
        /// Atomic assign-if-null: only one concurrent writer may set CounselorId.
        /// </summary>
        public async Task<AssignSessionResult> AssignSessionAsync(
            Guid tenantId,
            Guid sessionId,
            Guid targetCounselorId,
            int? expectedVersion,
            Guid actorUserId)
        {
            try
            {
                if (targetCounselorId == Guid.Empty)
                {
                    return new AssignSessionResult
                    {
                        Success = false,
                        FailureKind = AssignSessionFailureKind.BadRequest,
                        Message = "CounselorId is required.",
                    };
                }

                // Phase 3I Slice 7 (PD-S7-03/05): fail closed on missing expected Version.
                if (!expectedVersion.HasValue)
                {
                    return new AssignSessionResult
                    {
                        Success = false,
                        FailureKind = AssignSessionFailureKind.BadRequest,
                        Message = "Version is required.",
                    };
                }

                var sessionMeta = await _context.CounselingSession
                    .AsNoTracking()
                    .Where(s => s.Id == sessionId && s.TenantId == tenantId && s.DeletedAt == null)
                    .Select(s => new { s.Id, s.BranchId, s.CounselorId, s.Version, s.PatientAgreedToSurgery })
                    .FirstOrDefaultAsync();

                if (sessionMeta == null)
                {
                    return new AssignSessionResult
                    {
                        Success = false,
                        FailureKind = AssignSessionFailureKind.NotFound,
                        Message = "Session not found",
                    };
                }

                if (sessionMeta.CounselorId.HasValue)
                {
                    return new AssignSessionResult
                    {
                        Success = false,
                        FailureKind = AssignSessionFailureKind.Conflict,
                        Message = "Session is already assigned.",
                        SessionId = sessionId,
                        CounselorId = sessionMeta.CounselorId,
                    };
                }

                // Phase 3I Slice 7 (PD-S7-04/06): stale Version → Conflict (409), before eligibility/branch checks.
                if (sessionMeta.Version != expectedVersion.Value)
                {
                    return new AssignSessionResult
                    {
                        Success = false,
                        FailureKind = AssignSessionFailureKind.Conflict,
                        Message = SessionConcurrency.StaleMessage,
                        SessionId = sessionId,
                        CounselorId = sessionMeta.CounselorId,
                    };
                }

                // Phase 3I Slice 9 (PD-S9-19): SurgeryDone seals ownership mutations — Assign rejected.
                // Historical CounselorId is retained (not cleared). Matches Claim/Reassign/ReQueue.
                var isSurgeryDone = await _context.OtFinalizeSchedules
                    .AsNoTracking()
                    .AnyAsync(o =>
                        o.CounsellingSessionId == sessionId
                        && o.TenantId == tenantId
                        && o.DeletedAt == null
                        && o.Status == OtFinalizeStatus.SurgeryDone);

                if (isSurgeryDone)
                {
                    return new AssignSessionResult
                    {
                        Success = false,
                        FailureKind = AssignSessionFailureKind.BadRequest,
                        Message = "SurgeryDone sessions cannot be assigned.",
                        SessionId = sessionId,
                    };
                }

                // Assign eligibility (server-derived queue status — never trust client status):
                // Waiting (Pending) OR InProgress/Called (Processing) + NULL.
                // PD-B: also Completed + PatientAgreedToSurgery != true + NULL (explicit Assign only).
                // Completed + PatientAgreedToSurgery == true remains claim-for-lifecycle (ReEvaluate).
                var queueStatuses = await _context.CounselorQueue
                    .AsNoTracking()
                    .Where(q =>
                        q.SessionId == sessionId
                        && q.TenantId == tenantId
                        && q.DeletedAt == null)
                    .Select(q => q.Status)
                    .ToListAsync();

                var isAssignableQueue = queueStatuses.Any(s =>
                    s == "Waiting" || s == "InProgress" || s == "Called")
                    || (queueStatuses.Any(s => s == "Completed")
                        && sessionMeta.PatientAgreedToSurgery != true);

                if (!isAssignableQueue)
                {
                    return new AssignSessionResult
                    {
                        Success = false,
                        FailureKind = AssignSessionFailureKind.BadRequest,
                        Message = "Only unassigned Pending or Processing sessions can be assigned.",
                        SessionId = sessionId,
                    };
                }

                // Actor must be authorized for the session's branch (server-derived; ignore client branch).
                // Counsellor and Admin/System Administrator actors are both allowed when they have
                // counseling_sessions.update + branch access; owner is always the validated target.
                try
                {
                    await _followupBranchAccess.ResolveAccessibleBranchesAsync(
                        tenantId, actorUserId, sessionMeta.BranchId);
                }
                catch (UnauthorizedAccessException)
                {
                    return new AssignSessionResult
                    {
                        Success = false,
                        FailureKind = AssignSessionFailureKind.Forbidden,
                        Message = "Not authorized to assign this session.",
                        SessionId = sessionId,
                    };
                }

                var target = await _context.Users
                    .AsNoTracking()
                    .Where(u => u.Id == targetCounselorId && u.DeletedAt == null)
                    .Select(u => new
                    {
                        u.Id,
                        u.TenantId,
                        u.FirstName,
                        u.LastName,
                        u.UserType,
                        u.Designation,
                    })
                    .FirstOrDefaultAsync();

                if (target == null)
                {
                    return new AssignSessionResult
                    {
                        Success = false,
                        FailureKind = AssignSessionFailureKind.NotFound,
                        Message = "Target counsellor not found.",
                        SessionId = sessionId,
                    };
                }

                if (target.TenantId != tenantId)
                {
                    return new AssignSessionResult
                    {
                        Success = false,
                        FailureKind = AssignSessionFailureKind.Forbidden,
                        Message = "Target counsellor is not valid for this session.",
                        SessionId = sessionId,
                    };
                }

                // Phase 3I Slice 12 (PD-S12-17) — unavailable users cannot be ownership targets.
                var targetAvailability = await EvaluateOwnershipTargetAvailabilityAsync(
                    tenantId, targetCounselorId, sessionMeta.BranchId);
                if (!targetAvailability.IsAvailable)
                {
                    return new AssignSessionResult
                    {
                        Success = false,
                        FailureKind = targetAvailability.FailureKind,
                        Message = targetAvailability.Message ?? "Target counsellor is unavailable for ownership.",
                        SessionId = sessionId,
                    };
                }

                var now = DateTime.UtcNow;
                int? newVersion = null;
                await using var ownershipTx = await _context.Database.BeginTransactionAsync();
                try
                {
                    var assignedViaBulk = false;

                    // Prefer atomic assign-if-null on relational providers (PostgreSQL/SQL Server).
                    // EF InMemory does not support ExecuteUpdate — use tracked assign-if-null instead.
                    if (_context.Database.IsRelational())
                    {
                        var affected = await _context.CounselingSession
                            .Where(s => s.Id == sessionId
                                     && s.TenantId == tenantId
                                     && s.DeletedAt == null
                                     && s.CounselorId == null
                                     && s.Version == expectedVersion.Value)
                            .ExecuteUpdateAsync(setters => setters
                                .SetProperty(s => s.CounselorId, targetCounselorId)
                                .SetProperty(s => s.UpdatedAt, now)
                                .SetProperty(s => s.UpdatedByUserId, actorUserId)
                                .SetProperty(s => s.Version, s => s.Version + 1));

                        if (affected > 0)
                        {
                            assignedViaBulk = true;
                            newVersion = expectedVersion.Value + 1;
                        }
                        else
                        {
                            var current = await _context.CounselingSession
                                .AsNoTracking()
                                .Where(s => s.Id == sessionId && s.TenantId == tenantId && s.DeletedAt == null)
                                .Select(s => new { s.CounselorId, s.Version })
                                .FirstOrDefaultAsync();

                            if (current == null)
                            {
                                await ownershipTx.RollbackAsync();
                                return new AssignSessionResult
                                {
                                    Success = false,
                                    FailureKind = AssignSessionFailureKind.NotFound,
                                    Message = "Session not found",
                                };
                            }

                            await ownershipTx.RollbackAsync();
                            return new AssignSessionResult
                            {
                                Success = false,
                                FailureKind = AssignSessionFailureKind.Conflict,
                                Message = current.CounselorId.HasValue
                                    ? "Session is already assigned."
                                    : SessionConcurrency.StaleMessage,
                                SessionId = sessionId,
                                CounselorId = current.CounselorId,
                            };
                        }
                    }

                    if (!assignedViaBulk)
                    {
                        var session = await _context.CounselingSession
                            .FirstOrDefaultAsync(s =>
                                s.Id == sessionId && s.TenantId == tenantId && s.DeletedAt == null);

                        if (session == null)
                        {
                            await ownershipTx.RollbackAsync();
                            return new AssignSessionResult
                            {
                                Success = false,
                                FailureKind = AssignSessionFailureKind.NotFound,
                                Message = "Session not found",
                            };
                        }

                        if (session.CounselorId.HasValue)
                        {
                            await ownershipTx.RollbackAsync();
                            return new AssignSessionResult
                            {
                                Success = false,
                                FailureKind = AssignSessionFailureKind.Conflict,
                                Message = "Session is already assigned.",
                                SessionId = sessionId,
                                CounselorId = session.CounselorId,
                            };
                        }

                        if (session.Version != expectedVersion.Value)
                        {
                            await ownershipTx.RollbackAsync();
                            return new AssignSessionResult
                            {
                                Success = false,
                                FailureKind = AssignSessionFailureKind.Conflict,
                                Message = SessionConcurrency.StaleMessage,
                                SessionId = sessionId,
                                CounselorId = session.CounselorId,
                            };
                        }

                        session.CounselorId = targetCounselorId;
                        session.UpdatedAt = now;
                        session.UpdatedByUserId = actorUserId;
                    }

                    // Phase 3I Slice 5 — dual trail only after successful ownership mutation.
                    await StageOwnershipTrailAsync(
                        tenantId: tenantId,
                        sessionId: sessionId,
                        branchId: sessionMeta.BranchId,
                        actorUserId: actorUserId,
                        previousCounselorId: null,
                        newCounselorId: targetCounselorId,
                        changeType: OwnershipAuditEvents.Assigned,
                        source: "Assign");

                    await _context.SaveChangesAsync();
                    await ownershipTx.CommitAsync();

                    if (!assignedViaBulk)
                    {
                        newVersion = await _context.CounselingSession
                            .AsNoTracking()
                            .Where(s => s.Id == sessionId)
                            .Select(s => (int?)s.Version)
                            .FirstOrDefaultAsync();
                    }
                }
                catch (Exception)
                {
                    await ownershipTx.RollbackAsync();
                    throw;
                }

                var name = $"{target.FirstName} {target.LastName}".Trim();
                _logger.LogInformation(
                    "Assigned counseling session {SessionId} to counselor {CounselorId} by actor {ActorId}",
                    sessionId, targetCounselorId, actorUserId);

                return new AssignSessionResult
                {
                    Success = true,
                    Message = "Session assigned successfully",
                    SessionId = sessionId,
                    CounselorId = targetCounselorId,
                    CounselorName = string.IsNullOrWhiteSpace(name) ? null : name,
                    Version = newVersion,
                };
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error assigning counseling session {SessionId}", sessionId);
                return new AssignSessionResult
                {
                    Success = false,
                    FailureKind = AssignSessionFailureKind.BadRequest,
                    Message = "Error assigning session",
                };
            }
        }

        /// <summary>
        /// Phase 3I — lifecycle ownership claim for Done Re-evaluate / Repeat Start only.
        /// Supports NULL → actor and owned → actor (expected-owner concurrency). Not general Reassign.
        /// </summary>
        public async Task<AssignSessionResult> ClaimSessionForLifecycleAsync(
            Guid tenantId,
            Guid sessionId,
            Guid? expectedCounselorId,
            string intent,
            int? expectedVersion,
            Guid actorUserId)
        {
            try
            {
                var normalizedIntent = (intent ?? string.Empty).Trim();
                if (normalizedIntent != CounselingLifecycleClaimIntent.ReEvaluate
                    && normalizedIntent != CounselingLifecycleClaimIntent.StartRepeat)
                {
                    return new AssignSessionResult
                    {
                        Success = false,
                        FailureKind = AssignSessionFailureKind.BadRequest,
                        Message = "Intent must be ReEvaluate or StartRepeat.",
                    };
                }

                // Phase 3I Slice 7 (PD-S7-03/05): fail closed on missing expected Version.
                if (!expectedVersion.HasValue)
                {
                    return new AssignSessionResult
                    {
                        Success = false,
                        FailureKind = AssignSessionFailureKind.BadRequest,
                        Message = "Version is required.",
                    };
                }

                // Treat Guid.Empty as null for JSON clients that send empty GUID.
                if (expectedCounselorId == Guid.Empty)
                    expectedCounselorId = null;

                var actor = await _context.Users
                    .AsNoTracking()
                    .Where(u => u.Id == actorUserId && u.DeletedAt == null)
                    .Select(u => new { u.Id, u.TenantId, u.FirstName, u.LastName, u.UserType, u.Designation })
                    .FirstOrDefaultAsync();

                if (actor == null)
                {
                    return new AssignSessionResult
                    {
                        Success = false,
                        FailureKind = AssignSessionFailureKind.NotFound,
                        Message = "Actor not found.",
                    };
                }

                if (actor.TenantId != tenantId)
                {
                    return new AssignSessionResult
                    {
                        Success = false,
                        FailureKind = AssignSessionFailureKind.Forbidden,
                        Message = "Not authorized to claim this session.",
                    };
                }

                // Peer lifecycle claim is counsellor-only — Admin/Supervisor reassignment is Slice 6.
                if (!await IsAssignableCounsellorAsync(actorUserId, actor.UserType, actor.Designation))
                {
                    return new AssignSessionResult
                    {
                        Success = false,
                        FailureKind = AssignSessionFailureKind.Forbidden,
                        Message = "Only a counsellor may claim a session for lifecycle work.",
                    };
                }

                var sessionMeta = await _context.CounselingSession
                    .AsNoTracking()
                    .Where(s => s.Id == sessionId && s.TenantId == tenantId && s.DeletedAt == null)
                    .Select(s => new
                    {
                        s.Id,
                        s.BranchId,
                        s.CounselorId,
                        s.PatientAgreedToSurgery,
                        s.Version,
                    })
                    .FirstOrDefaultAsync();

                if (sessionMeta == null)
                {
                    return new AssignSessionResult
                    {
                        Success = false,
                        FailureKind = AssignSessionFailureKind.NotFound,
                        Message = "Session not found",
                    };
                }

                var isUnassigned = !sessionMeta.CounselorId.HasValue;
                Guid? previousOwner = sessionMeta.CounselorId;

                if (isUnassigned)
                {
                    if (expectedCounselorId.HasValue)
                    {
                        return new AssignSessionResult
                        {
                            Success = false,
                            FailureKind = AssignSessionFailureKind.Conflict,
                            Message = "Session ownership changed.",
                            SessionId = sessionId,
                            CounselorId = null,
                        };
                    }
                }
                else
                {
                    if (!expectedCounselorId.HasValue)
                    {
                        return new AssignSessionResult
                        {
                            Success = false,
                            FailureKind = AssignSessionFailureKind.BadRequest,
                            Message = "ExpectedCounselorId is required for already-owned lifecycle claim.",
                            SessionId = sessionId,
                        };
                    }

                    if (sessionMeta.CounselorId!.Value == actorUserId)
                    {
                        var selfName = $"{actor.FirstName} {actor.LastName}".Trim();
                        return new AssignSessionResult
                        {
                            Success = true,
                            Message = "Session already owned by you.",
                            SessionId = sessionId,
                            CounselorId = actorUserId,
                            CounselorName = string.IsNullOrWhiteSpace(selfName) ? null : selfName,
                            Version = sessionMeta.Version,
                        };
                    }

                    if (sessionMeta.CounselorId.Value != expectedCounselorId.Value)
                    {
                        return new AssignSessionResult
                        {
                            Success = false,
                            FailureKind = AssignSessionFailureKind.Conflict,
                            Message = "Session ownership changed.",
                            SessionId = sessionId,
                            CounselorId = sessionMeta.CounselorId,
                        };
                    }
                }

                // Phase 3I Slice 7 (PD-S7-04/06): stale Version → Conflict (409).
                if (sessionMeta.Version != expectedVersion.Value)
                {
                    return new AssignSessionResult
                    {
                        Success = false,
                        FailureKind = AssignSessionFailureKind.Conflict,
                        Message = SessionConcurrency.StaleMessage,
                        SessionId = sessionId,
                        CounselorId = sessionMeta.CounselorId,
                    };
                }

                var queueStatuses = await _context.CounselorQueue
                    .AsNoTracking()
                    .Where(q =>
                        q.SessionId == sessionId
                        && q.TenantId == tenantId
                        && q.DeletedAt == null)
                    .Select(q => q.Status)
                    .ToListAsync();

                if (!queueStatuses.Any(s => s == "Completed"))
                {
                    return new AssignSessionResult
                    {
                        Success = false,
                        FailureKind = AssignSessionFailureKind.BadRequest,
                        Message = "Session is not eligible for this lifecycle claim.",
                        SessionId = sessionId,
                    };
                }

                var isSurgeryDone = await _context.OtFinalizeSchedules
                    .AsNoTracking()
                    .AnyAsync(o =>
                        o.CounsellingSessionId == sessionId
                        && o.TenantId == tenantId
                        && o.DeletedAt == null
                        && o.Status == OtFinalizeStatus.SurgeryDone);

                if (isSurgeryDone)
                {
                    return new AssignSessionResult
                    {
                        Success = false,
                        FailureKind = AssignSessionFailureKind.BadRequest,
                        Message = "SurgeryDone sessions cannot be claimed for counselling lifecycle.",
                        SessionId = sessionId,
                    };
                }

                var agreed = sessionMeta.PatientAgreedToSurgery == true;
                if (normalizedIntent == CounselingLifecycleClaimIntent.ReEvaluate && !agreed)
                {
                    return new AssignSessionResult
                    {
                        Success = false,
                        FailureKind = AssignSessionFailureKind.BadRequest,
                        Message = "ReEvaluate claim requires a Done (agreed) session.",
                        SessionId = sessionId,
                    };
                }

                if (normalizedIntent == CounselingLifecycleClaimIntent.StartRepeat && agreed)
                {
                    return new AssignSessionResult
                    {
                        Success = false,
                        FailureKind = AssignSessionFailureKind.BadRequest,
                        Message = "StartRepeat claim requires a Repeat Counselling session.",
                        SessionId = sessionId,
                    };
                }

                try
                {
                    await _followupBranchAccess.ResolveAccessibleBranchesAsync(
                        tenantId, actorUserId, sessionMeta.BranchId);
                }
                catch (UnauthorizedAccessException)
                {
                    return new AssignSessionResult
                    {
                        Success = false,
                        FailureKind = AssignSessionFailureKind.Forbidden,
                        Message = "Not authorized to claim this session.",
                        SessionId = sessionId,
                    };
                }

                var now = DateTime.UtcNow;
                int? newVersion = null;
                await using var ownershipTx = await _context.Database.BeginTransactionAsync();
                try
                {
                    var claimed = false;

                    if (_context.Database.IsRelational())
                    {
                        int affected;
                        if (isUnassigned)
                        {
                            affected = await _context.CounselingSession
                                .Where(s => s.Id == sessionId
                                         && s.TenantId == tenantId
                                         && s.DeletedAt == null
                                         && s.CounselorId == null
                                         && s.Version == expectedVersion.Value)
                                .ExecuteUpdateAsync(setters => setters
                                    .SetProperty(s => s.CounselorId, actorUserId)
                                    .SetProperty(s => s.UpdatedAt, now)
                                    .SetProperty(s => s.UpdatedByUserId, actorUserId)
                                    .SetProperty(s => s.Version, s => s.Version + 1));
                        }
                        else
                        {
                            affected = await _context.CounselingSession
                                .Where(s => s.Id == sessionId
                                         && s.TenantId == tenantId
                                         && s.DeletedAt == null
                                         && s.CounselorId == expectedCounselorId
                                         && s.Version == expectedVersion.Value)
                                .ExecuteUpdateAsync(setters => setters
                                    .SetProperty(s => s.CounselorId, actorUserId)
                                    .SetProperty(s => s.UpdatedAt, now)
                                    .SetProperty(s => s.UpdatedByUserId, actorUserId)
                                    .SetProperty(s => s.Version, s => s.Version + 1));
                        }

                        if (affected > 0)
                        {
                            claimed = true;
                            newVersion = expectedVersion.Value + 1;
                        }
                        else
                        {
                            var current = await _context.CounselingSession
                                .AsNoTracking()
                                .Where(s => s.Id == sessionId && s.TenantId == tenantId && s.DeletedAt == null)
                                .Select(s => new { s.CounselorId, s.Version })
                                .FirstOrDefaultAsync();

                            await ownershipTx.RollbackAsync();
                            return new AssignSessionResult
                            {
                                Success = false,
                                FailureKind = AssignSessionFailureKind.Conflict,
                                Message = current != null && current.Version != expectedVersion.Value
                                    ? SessionConcurrency.StaleMessage
                                    : "Session ownership changed.",
                                SessionId = sessionId,
                                CounselorId = current?.CounselorId,
                            };
                        }
                    }

                    if (!claimed)
                    {
                        var session = await _context.CounselingSession
                            .FirstOrDefaultAsync(s =>
                                s.Id == sessionId && s.TenantId == tenantId && s.DeletedAt == null);

                        if (session == null)
                        {
                            await ownershipTx.RollbackAsync();
                            return new AssignSessionResult
                            {
                                Success = false,
                                FailureKind = AssignSessionFailureKind.NotFound,
                                Message = "Session not found",
                            };
                        }

                        if (isUnassigned)
                        {
                            if (session.CounselorId.HasValue)
                            {
                                await ownershipTx.RollbackAsync();
                                return new AssignSessionResult
                                {
                                    Success = false,
                                    FailureKind = AssignSessionFailureKind.Conflict,
                                    Message = "Session ownership changed.",
                                    SessionId = sessionId,
                                    CounselorId = session.CounselorId,
                                };
                            }
                        }
                        else if (session.CounselorId != expectedCounselorId)
                        {
                            await ownershipTx.RollbackAsync();
                            return new AssignSessionResult
                            {
                                Success = false,
                                FailureKind = AssignSessionFailureKind.Conflict,
                                Message = "Session ownership changed.",
                                SessionId = sessionId,
                                CounselorId = session.CounselorId,
                            };
                        }

                        if (session.Version != expectedVersion.Value)
                        {
                            await ownershipTx.RollbackAsync();
                            return new AssignSessionResult
                            {
                                Success = false,
                                FailureKind = AssignSessionFailureKind.Conflict,
                                Message = SessionConcurrency.StaleMessage,
                                SessionId = sessionId,
                                CounselorId = session.CounselorId,
                            };
                        }

                        session.CounselorId = actorUserId;
                        session.UpdatedAt = now;
                        session.UpdatedByUserId = actorUserId;
                    }

                    // Phase 3I Slice 5 (PD-S5-02): dual trail only for actual ownership transfer.
                    await StageOwnershipTrailAsync(
                        tenantId: tenantId,
                        sessionId: sessionId,
                        branchId: sessionMeta.BranchId,
                        actorUserId: actorUserId,
                        previousCounselorId: previousOwner,
                        newCounselorId: actorUserId,
                        changeType: OwnershipAuditEvents.Claimed,
                        source: "ClaimForLifecycle",
                        intent: normalizedIntent);

                    await _context.SaveChangesAsync();
                    await ownershipTx.CommitAsync();

                    if (!claimed)
                    {
                        newVersion = await _context.CounselingSession
                            .AsNoTracking()
                            .Where(s => s.Id == sessionId)
                            .Select(s => (int?)s.Version)
                            .FirstOrDefaultAsync();
                    }
                }
                catch (Exception)
                {
                    await ownershipTx.RollbackAsync();
                    throw;
                }

                var name = $"{actor.FirstName} {actor.LastName}".Trim();
                _logger.LogInformation(
                    "Lifecycle claim {Intent} on session {SessionId}: {ExpectedOwner} → {ActorId}",
                    normalizedIntent, sessionId, expectedCounselorId, actorUserId);

                return new AssignSessionResult
                {
                    Success = true,
                    Message = "Session claimed for lifecycle work",
                    SessionId = sessionId,
                    CounselorId = actorUserId,
                    CounselorName = string.IsNullOrWhiteSpace(name) ? null : name,
                    Version = newVersion,
                };
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error claiming counseling session {SessionId} for lifecycle", sessionId);
                return new AssignSessionResult
                {
                    Success = false,
                    FailureKind = AssignSessionFailureKind.BadRequest,
                    Message = "Error claiming session",
                };
            }
        }

        /// <summary>
        /// Phase 3I Slice 6 — supervisory General Reassign (owned A → eligible B).
        /// Atomic WHERE CounselorId == expectedPrevious. Does not Start counselling or change lifecycle.
        /// </summary>
        public async Task<AssignSessionResult> ReassignSessionAsync(
            Guid tenantId,
            Guid sessionId,
            Guid targetCounselorId,
            Guid expectedCounselorId,
            string reason,
            int? expectedVersion,
            Guid actorUserId)
        {
            try
            {
                if (targetCounselorId == Guid.Empty)
                {
                    return new AssignSessionResult
                    {
                        Success = false,
                        FailureKind = AssignSessionFailureKind.BadRequest,
                        Message = "CounselorId is required.",
                    };
                }

                if (expectedCounselorId == Guid.Empty)
                {
                    return new AssignSessionResult
                    {
                        Success = false,
                        FailureKind = AssignSessionFailureKind.BadRequest,
                        Message = "ExpectedCounselorId is required.",
                    };
                }

                var trimmedReason = (reason ?? string.Empty).Trim();
                if (string.IsNullOrWhiteSpace(trimmedReason))
                {
                    return new AssignSessionResult
                    {
                        Success = false,
                        FailureKind = AssignSessionFailureKind.BadRequest,
                        Message = "Reason is required.",
                    };
                }

                if (targetCounselorId == expectedCounselorId)
                {
                    return new AssignSessionResult
                    {
                        Success = false,
                        FailureKind = AssignSessionFailureKind.BadRequest,
                        Message = "Cannot reassign a session to the same counsellor.",
                    };
                }

                // Phase 3I Slice 7 (PD-S7-03/05): fail closed on missing expected Version.
                if (!expectedVersion.HasValue)
                {
                    return new AssignSessionResult
                    {
                        Success = false,
                        FailureKind = AssignSessionFailureKind.BadRequest,
                        Message = "Version is required.",
                    };
                }

                var sessionMeta = await _context.CounselingSession
                    .AsNoTracking()
                    .Where(s => s.Id == sessionId && s.TenantId == tenantId && s.DeletedAt == null)
                    .Select(s => new { s.Id, s.BranchId, s.CounselorId, s.Status, s.Version })
                    .FirstOrDefaultAsync();

                if (sessionMeta == null)
                {
                    return new AssignSessionResult
                    {
                        Success = false,
                        FailureKind = AssignSessionFailureKind.NotFound,
                        Message = "Session not found",
                    };
                }

                if (!sessionMeta.CounselorId.HasValue)
                {
                    return new AssignSessionResult
                    {
                        Success = false,
                        FailureKind = AssignSessionFailureKind.BadRequest,
                        Message = "Unassigned sessions must use Assign, not Reassign.",
                        SessionId = sessionId,
                    };
                }

                if (sessionMeta.CounselorId.Value != expectedCounselorId)
                {
                    return new AssignSessionResult
                    {
                        Success = false,
                        FailureKind = AssignSessionFailureKind.Conflict,
                        Message = "Session ownership changed.",
                        SessionId = sessionId,
                        CounselorId = sessionMeta.CounselorId,
                    };
                }

                // Phase 3I Slice 7 (PD-S7-04/06): stale Version → Conflict (409).
                if (sessionMeta.Version != expectedVersion.Value)
                {
                    return new AssignSessionResult
                    {
                        Success = false,
                        FailureKind = AssignSessionFailureKind.Conflict,
                        Message = SessionConcurrency.StaleMessage,
                        SessionId = sessionId,
                        CounselorId = sessionMeta.CounselorId,
                    };
                }

                var queueStatuses = await _context.CounselorQueue
                    .AsNoTracking()
                    .Where(q =>
                        q.SessionId == sessionId
                        && q.TenantId == tenantId
                        && q.DeletedAt == null)
                    .Select(q => q.Status)
                    .ToListAsync();

                var isPendingQueue = queueStatuses.Any(s => s == "Waiting");
                var isProcessingQueue = queueStatuses.Any(s => s == "InProgress" || s == "Called");
                var isProcessingSession = string.Equals(
                    sessionMeta.Status, "InProgress", StringComparison.OrdinalIgnoreCase);
                var isCompletedTerminal = queueStatuses.Any(s => s == "Completed")
                    && !isPendingQueue
                    && !isProcessingQueue
                    && !isProcessingSession;

                if (isCompletedTerminal)
                {
                    return new AssignSessionResult
                    {
                        Success = false,
                        FailureKind = AssignSessionFailureKind.BadRequest,
                        Message =
                            "Completed or Repeat Counselling sessions cannot use General Reassign. Use lifecycle claim.",
                        SessionId = sessionId,
                    };
                }

                if (!isPendingQueue && !isProcessingQueue && !isProcessingSession)
                {
                    return new AssignSessionResult
                    {
                        Success = false,
                        FailureKind = AssignSessionFailureKind.BadRequest,
                        Message = "Session is not eligible for General Reassign.",
                        SessionId = sessionId,
                    };
                }

                var isSurgeryDone = await _context.OtFinalizeSchedules
                    .AsNoTracking()
                    .AnyAsync(o =>
                        o.CounsellingSessionId == sessionId
                        && o.TenantId == tenantId
                        && o.DeletedAt == null
                        && o.Status == OtFinalizeStatus.SurgeryDone);

                if (isSurgeryDone)
                {
                    return new AssignSessionResult
                    {
                        Success = false,
                        FailureKind = AssignSessionFailureKind.BadRequest,
                        Message = "SurgeryDone sessions cannot be reassigned.",
                        SessionId = sessionId,
                    };
                }

                try
                {
                    await _followupBranchAccess.ResolveAccessibleBranchesAsync(
                        tenantId, actorUserId, sessionMeta.BranchId);
                }
                catch (UnauthorizedAccessException)
                {
                    return new AssignSessionResult
                    {
                        Success = false,
                        FailureKind = AssignSessionFailureKind.Forbidden,
                        Message = "Not authorized to reassign this session.",
                        SessionId = sessionId,
                    };
                }

                var target = await _context.Users
                    .AsNoTracking()
                    .Where(u => u.Id == targetCounselorId && u.DeletedAt == null)
                    .Select(u => new
                    {
                        u.Id,
                        u.TenantId,
                        u.FirstName,
                        u.LastName,
                        u.UserType,
                        u.Designation,
                    })
                    .FirstOrDefaultAsync();

                if (target == null)
                {
                    return new AssignSessionResult
                    {
                        Success = false,
                        FailureKind = AssignSessionFailureKind.NotFound,
                        Message = "Target counsellor not found.",
                    };
                }

                if (target.TenantId != tenantId)
                {
                    return new AssignSessionResult
                    {
                        Success = false,
                        FailureKind = AssignSessionFailureKind.Forbidden,
                        Message = "Target counsellor is not valid for this session.",
                        SessionId = sessionId,
                    };
                }

                // Phase 3I Slice 12 (PD-S12-17) — unavailable users cannot be ownership targets.
                var targetAvailability = await EvaluateOwnershipTargetAvailabilityAsync(
                    tenantId, targetCounselorId, sessionMeta.BranchId);
                if (!targetAvailability.IsAvailable)
                {
                    return new AssignSessionResult
                    {
                        Success = false,
                        FailureKind = targetAvailability.FailureKind,
                        Message = targetAvailability.Message ?? "Target counsellor is unavailable for ownership.",
                        SessionId = sessionId,
                    };
                }

                var previousOwner = sessionMeta.CounselorId.Value;
                var now = DateTime.UtcNow;
                int? newVersion = null;
                await using var ownershipTx = await _context.Database.BeginTransactionAsync();
                try
                {
                    var reassignedViaBulk = false;

                    if (_context.Database.IsRelational())
                    {
                        var affected = await _context.CounselingSession
                            .Where(s => s.Id == sessionId
                                     && s.TenantId == tenantId
                                     && s.DeletedAt == null
                                     && s.CounselorId == expectedCounselorId
                                     && s.Version == expectedVersion.Value)
                            .ExecuteUpdateAsync(setters => setters
                                .SetProperty(s => s.CounselorId, targetCounselorId)
                                .SetProperty(s => s.UpdatedAt, now)
                                .SetProperty(s => s.UpdatedByUserId, actorUserId)
                                .SetProperty(s => s.Version, s => s.Version + 1));

                        if (affected > 0)
                        {
                            reassignedViaBulk = true;
                            newVersion = expectedVersion.Value + 1;
                        }
                        else
                        {
                            var current = await _context.CounselingSession
                                .AsNoTracking()
                                .Where(s => s.Id == sessionId && s.TenantId == tenantId && s.DeletedAt == null)
                                .Select(s => new { s.CounselorId, s.Version })
                                .FirstOrDefaultAsync();

                            if (current == null)
                            {
                                await ownershipTx.RollbackAsync();
                                return new AssignSessionResult
                                {
                                    Success = false,
                                    FailureKind = AssignSessionFailureKind.NotFound,
                                    Message = "Session not found",
                                };
                            }

                            await ownershipTx.RollbackAsync();
                            return new AssignSessionResult
                            {
                                Success = false,
                                FailureKind = AssignSessionFailureKind.Conflict,
                                Message = current.CounselorId == expectedCounselorId
                                    ? SessionConcurrency.StaleMessage
                                    : "Session ownership changed.",
                                SessionId = sessionId,
                                CounselorId = current.CounselorId,
                            };
                        }
                    }

                    if (!reassignedViaBulk)
                    {
                        var session = await _context.CounselingSession
                            .FirstOrDefaultAsync(s =>
                                s.Id == sessionId && s.TenantId == tenantId && s.DeletedAt == null);

                        if (session == null)
                        {
                            await ownershipTx.RollbackAsync();
                            return new AssignSessionResult
                            {
                                Success = false,
                                FailureKind = AssignSessionFailureKind.NotFound,
                                Message = "Session not found",
                            };
                        }

                        if (!session.CounselorId.HasValue
                            || session.CounselorId.Value != expectedCounselorId)
                        {
                            await ownershipTx.RollbackAsync();
                            return new AssignSessionResult
                            {
                                Success = false,
                                FailureKind = AssignSessionFailureKind.Conflict,
                                Message = "Session ownership changed.",
                                SessionId = sessionId,
                                CounselorId = session.CounselorId,
                            };
                        }

                        if (session.Version != expectedVersion.Value)
                        {
                            await ownershipTx.RollbackAsync();
                            return new AssignSessionResult
                            {
                                Success = false,
                                FailureKind = AssignSessionFailureKind.Conflict,
                                Message = SessionConcurrency.StaleMessage,
                                SessionId = sessionId,
                                CounselorId = session.CounselorId,
                            };
                        }

                        session.CounselorId = targetCounselorId;
                        session.UpdatedAt = now;
                        session.UpdatedByUserId = actorUserId;
                    }

                    await StageOwnershipTrailAsync(
                        tenantId: tenantId,
                        sessionId: sessionId,
                        branchId: sessionMeta.BranchId,
                        actorUserId: actorUserId,
                        previousCounselorId: previousOwner,
                        newCounselorId: targetCounselorId,
                        changeType: OwnershipAuditEvents.Reassigned,
                        source: "Reassign",
                        intent: "GeneralReassign",
                        reason: trimmedReason);

                    await _context.SaveChangesAsync();
                    await ownershipTx.CommitAsync();

                    if (!reassignedViaBulk)
                    {
                        newVersion = await _context.CounselingSession
                            .AsNoTracking()
                            .Where(s => s.Id == sessionId)
                            .Select(s => (int?)s.Version)
                            .FirstOrDefaultAsync();
                    }
                }
                catch (Exception)
                {
                    await ownershipTx.RollbackAsync();
                    throw;
                }

                var name = $"{target.FirstName} {target.LastName}".Trim();
                _logger.LogInformation(
                    "Reassigned counseling session {SessionId} from {PreviousOwner} to {CounselorId} by actor {ActorId}",
                    sessionId, previousOwner, targetCounselorId, actorUserId);

                return new AssignSessionResult
                {
                    Success = true,
                    Message = "Session reassigned successfully",
                    SessionId = sessionId,
                    CounselorId = targetCounselorId,
                    CounselorName = string.IsNullOrWhiteSpace(name) ? null : name,
                    Version = newVersion,
                };
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error reassigning counseling session {SessionId}", sessionId);
                return new AssignSessionResult
                {
                    Success = false,
                    FailureKind = AssignSessionFailureKind.BadRequest,
                    Message = "Error reassigning session",
                };
            }
        }

        /// <inheritdoc />
        public async Task<ReQueueSessionResult> ReQueueSessionAsync(
            Guid tenantId,
            Guid sessionId,
            int? expectedVersion,
            Guid? expectedCounselorId,
            string reason,
            string? newIntention,
            string? notes,
            string? sessionType,
            Guid actorUserId)
        {
            try
            {
                var trimmedReason = (reason ?? string.Empty).Trim();
                if (string.IsNullOrWhiteSpace(trimmedReason))
                {
                    return new ReQueueSessionResult
                    {
                        Success = false,
                        FailureKind = AssignSessionFailureKind.BadRequest,
                        Message = "Reason is required.",
                    };
                }

                if (!expectedVersion.HasValue)
                {
                    return new ReQueueSessionResult
                    {
                        Success = false,
                        FailureKind = AssignSessionFailureKind.BadRequest,
                        Message = "Version is required.",
                    };
                }

                var sessionMeta = await _context.CounselingSession
                    .AsNoTracking()
                    .Where(s => s.Id == sessionId && s.TenantId == tenantId && s.DeletedAt == null)
                    .Select(s => new
                    {
                        s.Id,
                        s.BranchId,
                        s.PatientId,
                        s.CounselorId,
                        s.Status,
                        s.Version,
                        s.AdditionalNotes,
                        s.PatientIntention,
                        s.SessionType,
                    })
                    .FirstOrDefaultAsync();

                if (sessionMeta == null)
                {
                    return new ReQueueSessionResult
                    {
                        Success = false,
                        FailureKind = AssignSessionFailureKind.NotFound,
                        Message = "Session not found",
                    };
                }

                // PD-S8-14: SessionId + expectedCounselorId + expectedVersion must identify the row.
                if (sessionMeta.CounselorId != expectedCounselorId)
                {
                    return new ReQueueSessionResult
                    {
                        Success = false,
                        FailureKind = AssignSessionFailureKind.Conflict,
                        Message = "Session ownership changed.",
                        SessionId = sessionId,
                        CounselorId = sessionMeta.CounselorId,
                    };
                }

                if (sessionMeta.Version != expectedVersion.Value)
                {
                    return new ReQueueSessionResult
                    {
                        Success = false,
                        FailureKind = AssignSessionFailureKind.Conflict,
                        Message = SessionConcurrency.StaleMessage,
                        SessionId = sessionId,
                        CounselorId = sessionMeta.CounselorId,
                    };
                }

                var isSurgeryDone = await _context.OtFinalizeSchedules
                    .AsNoTracking()
                    .AnyAsync(o =>
                        o.CounsellingSessionId == sessionId
                        && o.TenantId == tenantId
                        && o.DeletedAt == null
                        && o.Status == OtFinalizeStatus.SurgeryDone);

                if (isSurgeryDone)
                {
                    return new ReQueueSessionResult
                    {
                        Success = false,
                        FailureKind = AssignSessionFailureKind.BadRequest,
                        Message = "SurgeryDone sessions cannot be requeued.",
                        SessionId = sessionId,
                    };
                }

                try
                {
                    await _followupBranchAccess.ResolveAccessibleBranchesAsync(
                        tenantId, actorUserId, sessionMeta.BranchId);
                }
                catch (UnauthorizedAccessException)
                {
                    return new ReQueueSessionResult
                    {
                        Success = false,
                        FailureKind = AssignSessionFailureKind.Forbidden,
                        Message = "Not authorized to requeue this session.",
                        SessionId = sessionId,
                    };
                }

                string? normalizedIntention = null;
                if (!string.IsNullOrEmpty(newIntention))
                {
                    try
                    {
                        normalizedIntention =
                            FollowupQueryContracts.NormalizeWritablePatientIntention(newIntention);
                    }
                    catch (ArgumentException ex)
                    {
                        return new ReQueueSessionResult
                        {
                            Success = false,
                            FailureKind = AssignSessionFailureKind.BadRequest,
                            Message = ex.Message,
                            SessionId = sessionId,
                        };
                    }
                }

                // Phase 3I Slice 8 fix — master UI codes (FOLLOW_UP) → DB CHECK values (Followup).
                // Blank keeps existing SessionType; unknown fails closed before ExecuteUpdateAsync.
                string? normalizedSessionType = null;
                if (!CounselingSessionTypeContracts.TryNormalizeWritableSessionType(
                        sessionType, out normalizedSessionType, out var sessionTypeError))
                {
                    return new ReQueueSessionResult
                    {
                        Success = false,
                        FailureKind = AssignSessionFailureKind.BadRequest,
                        Message = sessionTypeError ?? "Session type is not valid.",
                        SessionId = sessionId,
                    };
                }

                var notesToAppend = !string.IsNullOrWhiteSpace(notes) ? notes.Trim() : trimmedReason;
                var additionalNotes = sessionMeta.AdditionalNotes ?? string.Empty;
                additionalNotes += $"\n[Re-queue {DateTime.UtcNow:yyyy-MM-dd}] {notesToAppend}";

                var previousOwner = sessionMeta.CounselorId;
                var ownershipChanged = previousOwner.HasValue;
                var now = DateTime.UtcNow;
                int? newVersion = null;
                string? tokenNumber = null;
                Guid? queueItemId = null;

                await using var ownershipTx = await _context.Database.BeginTransactionAsync();
                try
                {
                    var clearedViaBulk = false;

                    if (_context.Database.IsRelational())
                    {
                        var intentionValue = normalizedIntention ?? sessionMeta.PatientIntention;
                        var sessionTypeValue = normalizedSessionType ?? sessionMeta.SessionType;

                        var affected = await _context.CounselingSession
                            .Where(s => s.Id == sessionId
                                     && s.TenantId == tenantId
                                     && s.DeletedAt == null
                                     && s.CounselorId == expectedCounselorId
                                     && s.Version == expectedVersion.Value)
                            .ExecuteUpdateAsync(setters => setters
                                .SetProperty(x => x.CounselorId, (Guid?)null)
                                .SetProperty(x => x.UpdatedAt, now)
                                .SetProperty(x => x.UpdatedByUserId, actorUserId)
                                .SetProperty(x => x.Version, x => x.Version + 1)
                                .SetProperty(x => x.AdditionalNotes, additionalNotes)
                                .SetProperty(x => x.PatientIntention, intentionValue)
                                .SetProperty(x => x.SessionType, sessionTypeValue));

                        if (affected > 0)
                        {
                            clearedViaBulk = true;
                            newVersion = expectedVersion.Value + 1;
                        }
                        else
                        {
                            var current = await _context.CounselingSession
                                .AsNoTracking()
                                .Where(s => s.Id == sessionId && s.TenantId == tenantId && s.DeletedAt == null)
                                .Select(s => new { s.CounselorId, s.Version })
                                .FirstOrDefaultAsync();

                            await ownershipTx.RollbackAsync();

                            if (current == null)
                            {
                                return new ReQueueSessionResult
                                {
                                    Success = false,
                                    FailureKind = AssignSessionFailureKind.NotFound,
                                    Message = "Session not found",
                                };
                            }

                            return new ReQueueSessionResult
                            {
                                Success = false,
                                FailureKind = AssignSessionFailureKind.Conflict,
                                Message = current.CounselorId == expectedCounselorId
                                    ? SessionConcurrency.StaleMessage
                                    : "Session ownership changed.",
                                SessionId = sessionId,
                                CounselorId = current.CounselorId,
                            };
                        }
                    }

                    if (!clearedViaBulk)
                    {
                        var session = await _context.CounselingSession
                            .FirstOrDefaultAsync(s =>
                                s.Id == sessionId && s.TenantId == tenantId && s.DeletedAt == null);

                        if (session == null)
                        {
                            await ownershipTx.RollbackAsync();
                            return new ReQueueSessionResult
                            {
                                Success = false,
                                FailureKind = AssignSessionFailureKind.NotFound,
                                Message = "Session not found",
                            };
                        }

                        if (session.CounselorId != expectedCounselorId)
                        {
                            await ownershipTx.RollbackAsync();
                            return new ReQueueSessionResult
                            {
                                Success = false,
                                FailureKind = AssignSessionFailureKind.Conflict,
                                Message = "Session ownership changed.",
                                SessionId = sessionId,
                                CounselorId = session.CounselorId,
                            };
                        }

                        if (session.Version != expectedVersion.Value)
                        {
                            await ownershipTx.RollbackAsync();
                            return new ReQueueSessionResult
                            {
                                Success = false,
                                FailureKind = AssignSessionFailureKind.Conflict,
                                Message = SessionConcurrency.StaleMessage,
                                SessionId = sessionId,
                                CounselorId = session.CounselorId,
                            };
                        }

                        session.CounselorId = null;
                        session.UpdatedAt = now;
                        session.UpdatedByUserId = actorUserId;
                        session.AdditionalNotes = additionalNotes;
                        if (normalizedIntention != null)
                            session.PatientIntention = normalizedIntention;
                        if (normalizedSessionType != null)
                            session.SessionType = normalizedSessionType;
                    }

                    // PD-S8-09/10 — soft-delete prior active/current queue rows (existing DeletedAt
                    // lifecycle); reuse a single active Waiting when present.
                    var existingQueues = await _context.CounselorQueue
                        .Where(q =>
                            q.SessionId == sessionId
                            && q.TenantId == tenantId
                            && q.DeletedAt == null)
                        .OrderBy(q => q.AddedToQueueAt)
                        .ToListAsync();

                    var keepWaiting = existingQueues
                        .FirstOrDefault(q => q.Status == "Waiting");

                    foreach (var q in existingQueues)
                    {
                        if (keepWaiting != null && q.Id == keepWaiting.Id)
                            continue;
                        q.DeletedAt = now;
                        q.UpdatedAt = now;
                    }

                    if (keepWaiting != null)
                    {
                        keepWaiting.UpdatedAt = now;
                        keepWaiting.QueueType = "RepeatCounselling";
                        tokenNumber = keepWaiting.TokenNumber;
                        queueItemId = keepWaiting.Id;
                    }
                    else
                    {
                        var branchId = sessionMeta.BranchId ?? Guid.Empty;
                        var maxPosition = await _context.CounselorQueue
                            .Where(q => q.TenantId == tenantId
                                     && q.BranchId == branchId
                                     && q.Status == "Waiting"
                                     && q.DeletedAt == null)
                            .MaxAsync(q => (int?)q.QueuePosition) ?? 0;

                        tokenNumber = $"FU-{now:yyMMdd}-{(maxPosition + 1):D3}";
                        var queueItem = new CounselorQueueItem
                        {
                            Id = Guid.NewGuid(),
                            TenantId = tenantId,
                            BranchId = branchId,
                            SessionId = sessionId,
                            PatientId = sessionMeta.PatientId,
                            TokenNumber = tokenNumber,
                            QueueType = "RepeatCounselling",
                            QueuePosition = maxPosition + 1,
                            PriorityScore = 60.00m,
                            UrgencyLevel = "Normal",
                            Status = "Waiting",
                            AddedToQueueAt = now,
                            CreatedAt = now,
                            UpdatedAt = now,
                        };
                        _context.CounselorQueue.Add(queueItem);
                        queueItemId = queueItem.Id;
                    }

                    if (ownershipChanged)
                    {
                        await StageOwnershipTrailAsync(
                            tenantId: tenantId,
                            sessionId: sessionId,
                            branchId: sessionMeta.BranchId,
                            actorUserId: actorUserId,
                            previousCounselorId: previousOwner,
                            newCounselorId: null,
                            changeType: OwnershipAuditEvents.Requeued,
                            source: "Requeue",
                            intent: "Requeue",
                            reason: trimmedReason);
                    }

                    await _context.SaveChangesAsync();
                    await ownershipTx.CommitAsync();

                    if (!clearedViaBulk)
                    {
                        newVersion = await _context.CounselingSession
                            .AsNoTracking()
                            .Where(s => s.Id == sessionId)
                            .Select(s => (int?)s.Version)
                            .FirstOrDefaultAsync();
                    }
                }
                catch (Exception)
                {
                    await ownershipTx.RollbackAsync();
                    throw;
                }

                _logger.LogInformation(
                    "Requeued counseling session {SessionId} (previous owner {PreviousOwner}) by actor {ActorId}",
                    sessionId, previousOwner, actorUserId);

                return new ReQueueSessionResult
                {
                    Success = true,
                    Message = "Patient re-queued to counselor waiting list",
                    SessionId = sessionId,
                    CounselorId = null,
                    Version = newVersion,
                    TokenNumber = tokenNumber,
                    QueueItemId = queueItemId,
                };
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error re-queuing counseling session {SessionId}", sessionId);
                return new ReQueueSessionResult
                {
                    Success = false,
                    FailureKind = AssignSessionFailureKind.BadRequest,
                    Message = "Error re-queuing patient",
                };
            }
        }

        /// <summary>
        /// Matches GetCounselors discovery heuristics (role COUNSEL / userType / designation).
        /// </summary>
        private async Task<bool> IsAssignableCounsellorAsync(
            Guid userId,
            string? userType,
            string? designation)
        {
            if (!string.IsNullOrWhiteSpace(userType)
                && userType.Contains("counsel", StringComparison.OrdinalIgnoreCase))
                return true;
            if (!string.IsNullOrWhiteSpace(designation)
                && designation.Contains("counsel", StringComparison.OrdinalIgnoreCase))
                return true;

            return await (
                from ur in _context.UserRoles.Cast<AuthService.Models.Identity.AppUserRole>()
                join r in _context.Roles on ur.RoleId equals r.Id
                where ur.UserId == userId
                      && ur.IsActive
                      && r.NormalizedName != null
                      && r.NormalizedName.Contains("COUNSEL")
                select ur
            ).AnyAsync();
        }

        /// <summary>
        /// Phase 3I Slice 12 — Reassignment Required list predicate (PD-S12-01 / PD-S12-02).
        /// Operationally open + non-null owner who is unavailable (inactive, soft-deleted,
        /// not counsellor-eligible, or unauthorized for the session branch).
        /// </summary>
        private IQueryable<CounselingSession> ApplyReassignmentRequiredFilter(
            IQueryable<CounselingSession> query,
            Guid? tenantId)
        {
            var now = DateTime.UtcNow;
            var openStatuses = CounsellorOwnershipAvailability.OperationalOpenSessionStatuses;

            // Owner ids that still satisfy counsellor eligibility heuristics.
            var eligibleOwnerIds =
                from u in _context.Users.AsNoTracking()
                where u.DeletedAt == null
                      && (!tenantId.HasValue || u.TenantId == tenantId.Value)
                      && (
                          (u.UserType != null && u.UserType.ToLower().Contains("counsel"))
                          || (u.Designation != null && u.Designation.ToLower().Contains("counsel"))
                          || (
                              from ur in _context.UserRoles.Cast<AuthService.Models.Identity.AppUserRole>()
                              join r in _context.Roles on ur.RoleId equals r.Id
                              where ur.UserId == u.Id
                                    && ur.IsActive
                                    && r.NormalizedName != null
                                    && r.NormalizedName.Contains("COUNSEL")
                              select ur
                          ).Any()
                      )
                select u.Id;

            // Owner+branch pairs with current branch authorization (primary or active UserBranch).
            var authorizedOwnerBranchPairs =
                (
                    from u in _context.Users.AsNoTracking()
                    where u.DeletedAt == null
                          && u.BranchId != null
                          && (!tenantId.HasValue || u.TenantId == tenantId.Value)
                    select new { OwnerId = u.Id, BranchId = u.BranchId!.Value }
                )
                .Concat(
                    from ub in _context.UserBranches.AsNoTracking()
                    where ub.Status == "active"
                          && ub.EffectiveFrom <= now
                          && (ub.EffectiveUntil == null || ub.EffectiveUntil > now)
                          && (!tenantId.HasValue || ub.TenantId == tenantId.Value)
                    select new { OwnerId = ub.UserId, BranchId = ub.BranchId }
                )
                .Distinct();

            return
                from s in query
                where s.CounselorId != null
                      && openStatuses.Contains(s.Status)
                join u in _context.Users.AsNoTracking() on s.CounselorId equals u.Id into ownerJoin
                from u in ownerJoin.DefaultIfEmpty()
                let ownerMissing = u == null
                let ownerSoftDeleted = u != null && u.DeletedAt != null
                let ownerInactive = u != null && (
                    u.UserStatus != null
                    && (u.UserStatus.ToLower() == "inactive" || u.UserStatus.ToLower() == "suspended"))
                let ownerNotEligible = u != null && u.DeletedAt == null && !eligibleOwnerIds.Contains(u.Id)
                let ownerUnauthorizedForBranch =
                    s.BranchId != null
                    && u != null
                    && u.DeletedAt == null
                    && !authorizedOwnerBranchPairs.Any(p =>
                        p.OwnerId == u.Id && p.BranchId == s.BranchId.Value)
                where ownerMissing
                      || ownerSoftDeleted
                      || ownerInactive
                      || ownerNotEligible
                      || ownerUnauthorizedForBranch
                select s;
        }

        private sealed class OwnershipTargetAvailability
        {
            public bool IsAvailable { get; init; }
            public string? Message { get; init; }
            public AssignSessionFailureKind FailureKind { get; init; } = AssignSessionFailureKind.BadRequest;
        }

        /// <summary>
        /// Phase 3I Slice 12 (PD-S12-17) — Assign/Reassign target must be available:
        /// not soft-deleted, not inactive, counsellor-eligible, PD16-authorized for session branch.
        /// Branch denial remains Forbidden (existing PD16 contract); unavailable status is BadRequest.
        /// </summary>
        private async Task<OwnershipTargetAvailability> EvaluateOwnershipTargetAvailabilityAsync(
            Guid tenantId,
            Guid targetCounselorId,
            Guid? sessionBranchId)
        {
            var target = await _context.Users
                .AsNoTracking()
                .Where(u => u.Id == targetCounselorId)
                .Select(u => new
                {
                    u.Id,
                    u.TenantId,
                    u.DeletedAt,
                    u.UserStatus,
                    u.UserType,
                    u.Designation,
                })
                .FirstOrDefaultAsync();

            if (target == null || target.DeletedAt != null)
            {
                return new OwnershipTargetAvailability
                {
                    IsAvailable = false,
                    FailureKind = AssignSessionFailureKind.NotFound,
                    Message = "Target counsellor not found.",
                };
            }

            if (target.TenantId != tenantId)
            {
                return new OwnershipTargetAvailability
                {
                    IsAvailable = false,
                    FailureKind = AssignSessionFailureKind.Forbidden,
                    Message = "Target counsellor is not valid for this session.",
                };
            }

            if (CounsellorOwnershipAvailability.IsUnavailableUserStatus(target.UserStatus))
            {
                return new OwnershipTargetAvailability
                {
                    IsAvailable = false,
                    FailureKind = AssignSessionFailureKind.BadRequest,
                    Message = "Target counsellor is unavailable for ownership.",
                };
            }

            if (!await IsAssignableCounsellorAsync(targetCounselorId, target.UserType, target.Designation))
            {
                return new OwnershipTargetAvailability
                {
                    IsAvailable = false,
                    FailureKind = AssignSessionFailureKind.BadRequest,
                    Message = "Target user is not a counsellor.",
                };
            }

            if (sessionBranchId.HasValue)
            {
                try
                {
                    await _followupBranchAccess.ResolveAccessibleBranchesAsync(
                        tenantId, targetCounselorId, sessionBranchId);
                }
                catch (UnauthorizedAccessException)
                {
                    return new OwnershipTargetAvailability
                    {
                        IsAvailable = false,
                        FailureKind = AssignSessionFailureKind.Forbidden,
                        Message = "Target counsellor is not authorized for this session branch.",
                    };
                }
            }

            return new OwnershipTargetAvailability { IsAvailable = true };
        }

        public async Task<SessionOperationResult> StartSessionAsync(Guid tenantId, Guid sessionId, Guid currentUserId, int? expectedVersion, string? sessionType = null)
        {
            try
            {
                var session = await _context.CounselingSession
                    .FirstOrDefaultAsync(s => s.Id == sessionId && s.TenantId == tenantId && s.DeletedAt == null);

                if (session == null)
                {
                    return new SessionOperationResult
                    {
                        Success = false,
                        FailureKind = SessionOperationFailureKind.NotFound,
                        Message = "Session not found"
                    };
                }

                var ownerDeny = DenyUnlessSessionOwner(session, currentUserId);
                if (ownerDeny != null)
                    return ownerDeny;

                var versionDeny = DenyUnlessExpectedVersion(session, expectedVersion);
                if (versionDeny != null)
                    return versionDeny;

                if (!string.IsNullOrWhiteSpace(sessionType))
                    session.SessionType = sessionType.Trim();

                // Phase 3I Slice 2 (PD-START-01): Start MUST NOT establish or change CounselorId.
                // Phase 3I Slice 4 (PD-AUTH-01): Start is owner-level; actor must already own the session.

                session.Status = "InProgress";
                session.SessionStartTime = DateTime.UtcNow;
                session.UpdatedAt = DateTime.UtcNow;
                session.UpdatedByUserId = currentUserId;

                // Update queue item status.
                // "Waiting" → InProgress: Start Counseling from Pending.
                // "Called" → InProgress: normal first entry after call.
                // "Completed" → InProgress: repeat counselling / re-evaluate reopen.
                var queueItem = await _context.CounselorQueue
                    .FirstOrDefaultAsync(q => q.SessionId == sessionId && q.DeletedAt == null);

                if (queueItem != null
                    && (queueItem.Status == "Waiting"
                        || queueItem.Status == "Called"
                        || queueItem.Status == "Completed"))
                {
                    queueItem.Status = "InProgress";
                    queueItem.StartedAt = DateTime.UtcNow;
                    queueItem.UpdatedAt = DateTime.UtcNow;
                    // Reset the decision flags so the waiting-list mapping reflects the new outcome
                    // once the counsellor saves (completeSession will re-evaluate based on new input).
                    session.PatientAgreedToSurgery = null;
                    session.PendingDecision = false;
                }

                await _context.SaveChangesAsync();

                _logger.LogInformation("Started counseling session {SessionId}", sessionId);

                var startedSession = await GetSessionByIdAsync(tenantId, sessionId);

                return new SessionOperationResult
                {
                    Success = true,
                    Message = "Session started successfully",
                    SessionId = sessionId,
                    Session = startedSession
                };
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error starting counseling session {SessionId}", sessionId);
                return new SessionOperationResult
                {
                    Success = false,
                    Message = $"Error starting session: {ex.Message}"
                };
            }
        }

        public async Task<SessionOperationResult> CompleteSessionAsync(Guid tenantId, Guid sessionId, Guid currentUserId, int? expectedVersion)
        {
            try
            {
                var session = await _context.CounselingSession
                    .FirstOrDefaultAsync(s => s.Id == sessionId && s.TenantId == tenantId && s.DeletedAt == null);

                if (session == null)
                {
                    return new SessionOperationResult
                    {
                        Success = false,
                        FailureKind = SessionOperationFailureKind.NotFound,
                        Message = "Session not found"
                    };
                }

                var ownerDeny = DenyUnlessSessionOwner(session, currentUserId);
                if (ownerDeny != null)
                    return ownerDeny;

                var versionDeny = DenyUnlessExpectedVersion(session, expectedVersion);
                if (versionDeny != null)
                    return versionDeny;

                session.Status = "Completed";
                session.SessionEndTime = DateTime.UtcNow;

                if (session.SessionStartTime.HasValue)
                {
                    session.DurationMinutes = await CalculateDurationMinutesAsync(session.SessionStartTime.Value, session.SessionEndTime.Value);
                }

                session.UpdatedAt = DateTime.UtcNow;
                session.UpdatedByUserId = currentUserId;

                // Update queue item status if exists
                var queueItem = await _context.CounselorQueue
                    .FirstOrDefaultAsync(q => q.SessionId == sessionId && q.DeletedAt == null);

                if (queueItem != null)
                {
                    queueItem.Status = "Completed";
                    queueItem.CompletedAt = DateTime.UtcNow;
                    queueItem.ActualWaitMinutes = (int)((queueItem.CompletedAt.Value - queueItem.AddedToQueueAt).TotalMinutes);
                    queueItem.UpdatedAt = DateTime.UtcNow;
                }

                await _context.SaveChangesAsync();

                if (queueItem != null)
                {
                    await NotifyQueueDisplayAsync(session.TenantId, queueItem.BranchId);
                }

                _logger.LogInformation("Completed counseling session {SessionId}", sessionId);

                // Fire-and-forget: notify CCMS if insurance/govt payment type
                var insuranceTypes = new HashSet<string>(StringComparer.OrdinalIgnoreCase)
                    { "Insurance", "TPA", "CoPay", "CGHS", "SGHS", "GovernmentScheme", "ESH", "Arograshree", "Railway" };
                if (insuranceTypes.Contains(session.PatientType ?? ""))
                {
                    // Resolve patient display name for CCMS case creation
                    string? ccmsPatientName = null;
                    if (session.PatientId != Guid.Empty)
                    {
                        var pt = await _context.Patients
                            .AsNoTracking()
                            .Where(p => p.Id == session.PatientId)
                            .Select(p => new { p.FirstName, p.LastName })
                            .FirstOrDefaultAsync();
                        if (pt != null)
                            ccmsPatientName = $"{pt.FirstName} {pt.LastName}".Trim();
                    }

                    var capturedPatientName = ccmsPatientName;
                    var capturedPaymentType = session.PatientType ?? "Insurance";
                    var capturedPackageAddons = session.PackageAddonsJson;
                    var capturedBranchId = session.BranchId;
                    var capturedDoctorId = session.ReferredByDoctorId;
                    var capturedPatientId = session.PatientId;
                    var capturedPackageId = session.SelectedPackageId;
                    var capturedTenantId = tenantId;
                    var capturedSessionId = sessionId;
                    var capturedUserId = currentUserId;
                    var capturedInternalKey = _internalApiKey;
                    var capturedCcmsUrl = _ccmsBaseUrl;

                    _ = Task.Run(async () =>
                    {
                        try
                        {
                            var fields = ParseCcmsFieldsFromPackageAddons(capturedPackageAddons);
                            var draftSeed = JsonSerializer.Serialize(new
                            {
                                insurerName = fields.InsurerName,
                                insuranceCompany = fields.InsurerName,
                                estimatedAmount = fields.Estimate,
                                finalPayableAmount = fields.Estimate,
                                paymentType = capturedPaymentType,
                                insuranceProviderId = fields.InsuranceProviderId,
                            });
                            var payload = new
                            {
                                tenantId = capturedTenantId,
                                sessionId = capturedSessionId,
                                journeyId = (Guid?)null,
                                patientId = capturedPatientId,
                                patientName = capturedPatientName,
                                paymentType = capturedPaymentType,
                                notRequiredPreAuth = fields.NotRequiredPreAuth,
                                branchId = capturedBranchId,
                                doctorId = capturedDoctorId,
                                insuranceProviderId = fields.InsuranceProviderId,
                                tpaProviderId = fields.TpaProviderId,
                                governmentSchemeId = fields.GovernmentSchemeId,
                                packageId = capturedPackageId,
                                legacyPreauthId = (Guid?)null,
                                sessionPreauthId = (Guid?)null,
                                actorUserId = capturedUserId,
                                insurerName = fields.InsurerName,
                                estimatedAmount = fields.Estimate,
                                counsellorDraftJson = draftSeed,
                            };
                            var json = JsonSerializer.Serialize(payload);
                            var client = _httpClientFactory.CreateClient();
                            var request = new HttpRequestMessage(
                                HttpMethod.Post,
                                $"{capturedCcmsUrl}/ccms/integration/counselling-completed")
                            {
                                Content = new StringContent(json, Encoding.UTF8, "application/json"),
                            };
                            if (!string.IsNullOrWhiteSpace(capturedInternalKey))
                                request.Headers.Add("X-Internal-Key", capturedInternalKey);
                            request.Headers.Add("X-Idempotency-Key", $"counselling-complete-{capturedSessionId}");

                            var response = await client.SendAsync(request);
                            if (!response.IsSuccessStatusCode)
                            {
                                _logger.LogWarning(
                                    "CCMS counselling-completed returned {Status} for session {SessionId}",
                                    response.StatusCode, capturedSessionId);
                            }
                        }
                        catch (Exception ex)
                        {
                            _logger.LogWarning(ex, "CCMS counselling-completed callback failed for session {SessionId}", capturedSessionId);
                        }
                    });
                }

                var completedSession = await GetSessionByIdAsync(tenantId, sessionId);

                return new SessionOperationResult
                {
                    Success = true,
                    Message = "Session completed successfully",
                    SessionId = sessionId,
                    Session = completedSession
                };
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error completing counseling session {SessionId}", sessionId);
                return new SessionOperationResult
                {
                    Success = false,
                    Message = $"Error completing session: {ex.Message}"
                };
            }
        }

        /// <summary>
        /// Marks a completed counselling session as AddOnSurgery in the queue.
        /// Called by the counsellor when they upgrade the package on a Done session.
        /// The queue item status is set to "AddOnSurgery" so the waiting list shows
        /// the violet Add-On Surgery tab.
        /// </summary>
        public async Task<SessionOperationResult> MarkAddOnSurgeryAsync(Guid tenantId, Guid sessionId, Guid currentUserId)
        {
            try
            {
                var session = await _context.CounselingSession
                    .FirstOrDefaultAsync(s => s.Id == sessionId && s.TenantId == tenantId && s.DeletedAt == null);

                if (session == null)
                {
                    return new SessionOperationResult
                    {
                        Success = false,
                        FailureKind = SessionOperationFailureKind.NotFound,
                        Message = "Session not found"
                    };
                }

                var ownerDeny = DenyUnlessSessionOwner(session, currentUserId);
                if (ownerDeny != null)
                    return ownerDeny;

                var queueItem = await _context.CounselorQueue
                    .FirstOrDefaultAsync(q => q.SessionId == sessionId && q.TenantId == tenantId && q.DeletedAt == null);

                if (queueItem == null)
                {
                    return new SessionOperationResult
                    {
                        Success = false,
                        FailureKind = SessionOperationFailureKind.NotFound,
                        Message = "Queue item not found"
                    };
                }

                queueItem.Status    = "AddOnSurgery";
                queueItem.UpdatedAt = DateTime.UtcNow;

                await _context.SaveChangesAsync();

                _logger.LogInformation("Marked session {SessionId} as AddOnSurgery in queue", sessionId);

                var updatedSession = await GetSessionByIdAsync(tenantId, sessionId);
                return new SessionOperationResult
                {
                    Success   = true,
                    Message   = "Session marked as Add-On Surgery",
                    SessionId = sessionId,
                    Session   = updatedSession
                };
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error marking session {SessionId} as AddOnSurgery", sessionId);
                return new SessionOperationResult { Success = false, Message = $"Error: {ex.Message}" };
            }
        }

        public async Task<SessionOperationResult> CancelSessionAsync(Guid tenantId, Guid sessionId, string reason, Guid currentUserId, int? expectedVersion)        {
            try
            {
                var session = await _context.CounselingSession
                    .FirstOrDefaultAsync(s => s.Id == sessionId && s.TenantId == tenantId && s.DeletedAt == null);

                if (session == null)
                {
                    return new SessionOperationResult
                    {
                        Success = false,
                        FailureKind = SessionOperationFailureKind.NotFound,
                        Message = "Session not found"
                    };
                }

                var ownerDeny = DenyUnlessSessionOwner(session, currentUserId);
                if (ownerDeny != null)
                    return ownerDeny;

                var versionDeny = DenyUnlessExpectedVersion(session, expectedVersion);
                if (versionDeny != null)
                    return versionDeny;

                session.Status = "Cancelled";
                session.ReasonsForDelay = reason;
                session.UpdatedAt = DateTime.UtcNow;
                session.UpdatedByUserId = currentUserId;

                // Cancel queue item if exists
                var queueItem = await _context.CounselorQueue
                    .FirstOrDefaultAsync(q => q.SessionId == sessionId && q.DeletedAt == null && q.Status != "Completed");

                if (queueItem != null)
                {
                    queueItem.Status = "Cancelled";
                    queueItem.UpdatedAt = DateTime.UtcNow;
                }

                await _context.SaveChangesAsync();

                _logger.LogInformation("Cancelled counseling session {SessionId}", sessionId);

                var cancelledSession = await GetSessionByIdAsync(tenantId, sessionId);

                return new SessionOperationResult
                {
                    Success = true,
                    Message = "Session cancelled successfully",
                    SessionId = sessionId,
                    Session = cancelledSession
                };
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error cancelling counseling session {SessionId}", sessionId);
                return new SessionOperationResult
                {
                    Success = false,
                    Message = $"Error cancelling session: {ex.Message}"
                };
            }
        }

        public async Task<SessionOperationResult> DeleteSessionAsync(Guid tenantId, Guid sessionId, Guid currentUserId, int? expectedVersion)
        {
            using var transaction = await _context.Database.BeginTransactionAsync();
            try
            {
                var session = await _context.CounselingSession
                    .FirstOrDefaultAsync(s => s.Id == sessionId && s.TenantId == tenantId && s.DeletedAt == null);

                if (session == null)
                {
                    await transaction.RollbackAsync();
                    return new SessionOperationResult
                    {
                        Success = false,
                        FailureKind = SessionOperationFailureKind.NotFound,
                        Message = "Session not found"
                    };
                }

                // Phase 3I Slice 7 (PD-S7-02/05/06): expected Version required; stale → Conflict (409).
                var versionDeny = DenyUnlessExpectedVersion(session, expectedVersion);
                if (versionDeny != null)
                {
                    await transaction.RollbackAsync();
                    return versionDeny;
                }

                // Soft delete queue items
                var queueItems = await _context.CounselorQueue
                    .Where(q => q.SessionId == sessionId && q.DeletedAt == null)
                    .ToListAsync();

                foreach (var item in queueItems)
                {
                    item.DeletedAt = DateTime.UtcNow;
                    item.UpdatedAt = DateTime.UtcNow;
                }

                // Soft delete notes
                var notes = await _context.CounselingSessionNotes
                    .Where(n => n.SessionId == sessionId && n.DeletedAt == null)
                    .ToListAsync();

                foreach (var note in notes)
                {
                    note.DeletedAt = DateTime.UtcNow;
                    note.UpdatedAt = DateTime.UtcNow;
                }

                // Soft delete documents
                var documents = await _context.CounselingSessionDocuments
                    .Where(d => d.SessionId == sessionId && d.DeletedAt == null)
                    .ToListAsync();

                foreach (var doc in documents)
                {
                    doc.DeletedAt = DateTime.UtcNow;
                    doc.UpdatedAt = DateTime.UtcNow;
                }

                // Soft delete session
                session.DeletedAt = DateTime.UtcNow;
                session.UpdatedAt = DateTime.UtcNow;
                session.UpdatedByUserId = currentUserId;

                await _context.SaveChangesAsync();
                await transaction.CommitAsync();

                _logger.LogInformation("Soft deleted counseling session {SessionId}", sessionId);
                return new SessionOperationResult
                {
                    Success = true,
                    Message = "Session deleted successfully",
                    SessionId = sessionId,
                };
            }
            catch (Exception ex)
            {
                await transaction.RollbackAsync();
                _logger.LogError(ex, "Error deleting counseling session {SessionId}", sessionId);
                throw;
            }
        }

        // ============================================================================
        // COUNSELOR QUEUE (Continuing in next section...)
        // ============================================================================

        public async Task<QueueListResponse> GetQueueAsync(Guid tenantId, Guid? branchId = null, string? status = null)
        {
            try
            {
                var query = _context.CounselorQueue
                    .Where(q => q.TenantId == tenantId && q.DeletedAt == null);

                // Filter by branch if provided
                if (branchId.HasValue)
                    query = query.Where(q => q.BranchId == branchId.Value);

                if (!string.IsNullOrEmpty(status))
                    query = query.Where(q => q.Status == status);

                var totalCount = await query.CountAsync();
                var waitingCount = await query.CountAsync(q => q.Status == "Waiting");
                var inProgressCount = await query.CountAsync(q => q.Status == "InProgress");
                var completedTodayCount = await query.CountAsync(q => q.Status == "Completed" && q.CompletedAt.HasValue && q.CompletedAt.Value.Date == DateTime.UtcNow.Date);

                var queueItems = await query
                    .OrderByDescending(q => q.PriorityScore)
                    .ThenBy(q => q.QueuePosition)
                    .Select(q => new CounselorQueueItemDto
                    {
                        Id = q.Id,
                        TenantId = q.TenantId,
                        BranchId = q.BranchId,
                        SessionId = q.SessionId,
                        PatientId = q.PatientId,
                        TokenNumber = q.TokenNumber,
                        QueueType = q.QueueType,
                        QueuePosition = q.QueuePosition,
                        PriorityScore = q.PriorityScore,
                        UrgencyLevel = q.UrgencyLevel,
                        AddedToQueueAt = q.AddedToQueueAt,
                        EstimatedWaitMinutes = q.EstimatedWaitMinutes,
                        CalledAt = q.CalledAt,
                        StartedAt = q.StartedAt,
                        CompletedAt = q.CompletedAt,
                        ActualWaitMinutes = q.ActualWaitMinutes,
                        Status = q.Status,
                        CreatedAt = q.CreatedAt,
                        // Join session for counselor assignment and session details
                        CounselorId = q.Session != null ? q.Session.CounselorId : null,
                        SessionType = q.Session != null ? q.Session.SessionType : null,
                        PatientType = q.Session != null ? q.Session.PatientType : null,
                        SessionNumber = q.Session != null ? q.Session.SessionNumber : null,
                    })
                    .ToListAsync();

                // Hydrate patient names in a single batch query
                var patientIds = queueItems.Select(q => q.PatientId).Distinct().ToList();
                var patientNames = await _context.Patients
                    .Where(p => patientIds.Contains(p.Id))
                    .Select(p => new { p.Id, p.FirstName, p.LastName, p.MedicalRecordNumber })
                    .ToDictionaryAsync(p => p.Id);

                foreach (var item in queueItems)
                {
                    if (patientNames.TryGetValue(item.PatientId, out var pt))
                    {
                        item.PatientName = $"{pt.FirstName} {pt.LastName}".Trim();
                    }
                }

                _logger.LogInformation("Retrieved {Count} queue items for branch {BranchId}", queueItems.Count, branchId);

                return new QueueListResponse
                {
                    QueueItems = queueItems,
                    TotalCount = totalCount,
                    WaitingCount = waitingCount,
                    InProgressCount = inProgressCount,
                    CompletedTodayCount = completedTodayCount
                };
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error retrieving counselor queue for branch {BranchId}", branchId);
                throw;
            }
        }

        public async Task<CounselorQueueItemDto?> GetQueueItemByIdAsync(Guid tenantId, Guid queueItemId)
        {
            try
            {
                var item = await _context.CounselorQueue
                    .Where(q => q.Id == queueItemId && q.TenantId == tenantId && q.DeletedAt == null)
                    .Select(q => new CounselorQueueItemDto
                    {
                        Id = q.Id,
                        TenantId = q.TenantId,
                        BranchId = q.BranchId,
                        SessionId = q.SessionId,
                        PatientId = q.PatientId,
                        TokenNumber = q.TokenNumber,
                        QueueType = q.QueueType,
                        QueuePosition = q.QueuePosition,
                        PriorityScore = q.PriorityScore,
                        UrgencyLevel = q.UrgencyLevel,
                        AddedToQueueAt = q.AddedToQueueAt,
                        EstimatedWaitMinutes = q.EstimatedWaitMinutes,
                        CalledAt = q.CalledAt,
                        StartedAt = q.StartedAt,
                        CompletedAt = q.CompletedAt,
                        ActualWaitMinutes = q.ActualWaitMinutes,
                        Status = q.Status,
                        CreatedAt = q.CreatedAt
                    })
                    .FirstOrDefaultAsync();

                return item;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error retrieving queue item {QueueItemId}", queueItemId);
                throw;
            }
        }

        public async Task<CounselorQueueItemDto?> GetQueueItemBySessionIdAsync(Guid tenantId, Guid sessionId)
        {
            try
            {
                var item = await _context.CounselorQueue
                    .Where(q => q.SessionId == sessionId && q.TenantId == tenantId && q.DeletedAt == null)
                    .Select(q => new CounselorQueueItemDto
                    {
                        Id = q.Id,
                        TenantId = q.TenantId,
                        BranchId = q.BranchId,
                        SessionId = q.SessionId,
                        PatientId = q.PatientId,
                        TokenNumber = q.TokenNumber,
                        QueueType = q.QueueType,
                        QueuePosition = q.QueuePosition,
                        PriorityScore = q.PriorityScore,
                        UrgencyLevel = q.UrgencyLevel,
                        AddedToQueueAt = q.AddedToQueueAt,
                        EstimatedWaitMinutes = q.EstimatedWaitMinutes,
                        CalledAt = q.CalledAt,
                        StartedAt = q.StartedAt,
                        CompletedAt = q.CompletedAt,
                        ActualWaitMinutes = q.ActualWaitMinutes,
                        Status = q.Status,
                        CreatedAt = q.CreatedAt
                    })
                    .FirstOrDefaultAsync();

                return item;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error retrieving queue item by session {SessionId}", sessionId);
                throw;
            }
        }

        public async Task<CounselorQueueItemDto> AddToQueueAsync(AddToQueueRequest request)
        {
            try
            {
                var initialPriorityScore = await CalculatePriorityScoreAsync(request.UrgencyLevel ?? "Normal", 0);

                var queueItem = new CounselorQueueItem
                {
                    Id = Guid.NewGuid(),
                    TenantId = request.TenantId,
                    BranchId = request.BranchId,
                    SessionId = request.SessionId,
                    PatientId = request.PatientId,
                    TokenNumber = "", // Will be generated by trigger
                    QueueType = request.QueueType,
                    QueuePosition = 0, // Will be set by trigger
                    PriorityScore = initialPriorityScore,
                    UrgencyLevel = request.UrgencyLevel,
                    EstimatedWaitMinutes = request.EstimatedWaitMinutes,
                    Status = "Waiting",
                    AddedToQueueAt = DateTime.UtcNow,
                    CreatedAt = DateTime.UtcNow,
                    UpdatedAt = DateTime.UtcNow
                };

                _context.CounselorQueue.Add(queueItem);
                await _context.SaveChangesAsync();
                await NotifyQueueDisplayAsync(request.TenantId, request.BranchId);

                _logger.LogInformation("Added session {SessionId} to counselor queue", request.SessionId);

                return (await GetQueueItemByIdAsync(request.TenantId, queueItem.Id))!;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error adding session to queue");
                throw;
            }
        }

        public async Task<CounselorQueueItemDto> UpdateQueueItemStatusAsync(Guid tenantId, Guid queueItemId, string status, Guid currentUserId)
        {
            try
            {
                var queueItem = await _context.CounselorQueue
                    .FirstOrDefaultAsync(q => q.Id == queueItemId && q.TenantId == tenantId && q.DeletedAt == null);

                if (queueItem == null)
                    throw new Exception("Queue item not found");

                queueItem.Status = status;

                if (status == "Called" && !queueItem.CalledAt.HasValue)
                {
                    queueItem.CalledAt = DateTime.UtcNow;
                }
                else if (status == "InProgress" && !queueItem.StartedAt.HasValue)
                {
                    queueItem.StartedAt = DateTime.UtcNow;
                }
                else if (status == "Completed" && !queueItem.CompletedAt.HasValue)
                {
                    queueItem.CompletedAt = DateTime.UtcNow;
                    queueItem.ActualWaitMinutes = (int)((queueItem.CompletedAt.Value - queueItem.AddedToQueueAt).TotalMinutes);
                }

                queueItem.UpdatedAt = DateTime.UtcNow;

                await _context.SaveChangesAsync();

                await NotifyQueueDisplayAsync(tenantId, queueItem.BranchId);

                _logger.LogInformation("Updated queue item {QueueItemId} status to {Status}", queueItemId, status);

                return (await GetQueueItemByIdAsync(tenantId, queueItemId))!;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error updating queue item status {QueueItemId}", queueItemId);
                throw;
            }
        }

        public async Task<CallNextPatientResponse> CallNextPatientAsync(CallNextPatientRequest request, Guid currentUserId)
        {
            try
            {
                // Find highest priority waiting patient
                var nextPatient = await _context.CounselorQueue
                    .Where(q => q.BranchId == request.BranchId && q.Status == "Waiting" && q.DeletedAt == null)
                    .OrderByDescending(q => q.PriorityScore)
                    .ThenBy(q => q.QueuePosition)
                    .FirstOrDefaultAsync();

                if (nextPatient == null)
                {
                    return new CallNextPatientResponse
                    {
                        Success = false,
                        Message = "No patients waiting in queue"
                    };
                }

                nextPatient.Status = "Called";
                nextPatient.CalledAt = DateTime.UtcNow;
                nextPatient.UpdatedAt = DateTime.UtcNow;

                await _context.SaveChangesAsync();
                await NotifyQueueDisplayAsync(nextPatient.TenantId, nextPatient.BranchId);

                _logger.LogInformation("Called next patient - Queue Item {QueueItemId}", nextPatient.Id);

                var queueItemDto = await GetQueueItemByIdAsync(nextPatient.TenantId, nextPatient.Id);
                var sessionDto = await _context.CounselingSession
                    .Where(s => s.Id == nextPatient.SessionId && s.DeletedAt == null)
                    .Select(s => new CounselingSessionDto
                    {
                        Id = s.Id,
                        TenantId = s.TenantId,
                        SessionNumber = s.SessionNumber,
                        PatientId = s.PatientId,
                        SessionType = s.SessionType,
                        PatientType = s.PatientType,
                        Status = s.Status,
                        Version = s.Version,
                        CreatedAt = s.CreatedAt
                    })
                    .FirstOrDefaultAsync();

                return new CallNextPatientResponse
                {
                    Success = true,
                    Message = $"Patient token {nextPatient.TokenNumber} called",
                    QueueItem = queueItemDto,
                    Session = sessionDto
                };
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error calling next patient for branch {BranchId}", request.BranchId);
                return new CallNextPatientResponse
                {
                    Success = false,
                    Message = $"Error calling next patient: {ex.Message}"
                };
            }
        }

        public async Task<bool> StartSessionFromQueueAsync(Guid tenantId, Guid queueItemId, Guid currentUserId, int? expectedVersion = null)
        {
            try
            {
                var queueItem = await _context.CounselorQueue
                    .FirstOrDefaultAsync(q => q.Id == queueItemId && q.TenantId == tenantId && q.DeletedAt == null);

                if (queueItem == null)
                    return false;

                var session = await _context.CounselingSession
                    .FirstOrDefaultAsync(s => s.Id == queueItem.SessionId && s.DeletedAt == null);

                if (session != null)
                {
                    // Phase 3I Slice 4 (PD-AUTH-01): queue start is owner-level content mutate.
                    var ownerDeny = DenyUnlessSessionOwner(session, currentUserId);
                    if (ownerDeny != null)
                        throw new UnauthorizedAccessException(ownerDeny.Message);

                    // Phase 3I Slice 7 (M11): no HTTP route today. When a caller supplies an expected
                    // Version, honor it (fail closed); tests-only callers that omit it are unaffected.
                    if (expectedVersion.HasValue && session.Version != expectedVersion.Value)
                        throw new InvalidOperationException(SessionConcurrency.StaleMessage);
                }

                queueItem.Status = "InProgress";
                queueItem.StartedAt = DateTime.UtcNow;
                queueItem.UpdatedAt = DateTime.UtcNow;

                if (session != null)
                {
                    // Phase 3I Slice 2: do not stamp or alter CounselorId on queue start.
                    session.Status = "InProgress";
                    session.SessionStartTime = DateTime.UtcNow;
                    session.UpdatedAt = DateTime.UtcNow;
                    session.UpdatedByUserId = currentUserId;
                }

                await _context.SaveChangesAsync();
                await NotifyQueueDisplayAsync(tenantId, queueItem.BranchId);

                _logger.LogInformation("Started session from queue - Queue Item {QueueItemId}", queueItemId);
                return true;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error starting session from queue {QueueItemId}", queueItemId);
                throw;
            }
        }

        public async Task<bool> CompleteQueueItemAsync(Guid tenantId, Guid queueItemId, Guid currentUserId)
        {
            try
            {
                var queueItem = await _context.CounselorQueue
                    .FirstOrDefaultAsync(q => q.Id == queueItemId && q.TenantId == tenantId && q.DeletedAt == null);

                if (queueItem == null)
                    return false;

                queueItem.Status = "Completed";
                queueItem.CompletedAt = DateTime.UtcNow;
                queueItem.ActualWaitMinutes = (int)((queueItem.CompletedAt.Value - queueItem.AddedToQueueAt).TotalMinutes);
                queueItem.UpdatedAt = DateTime.UtcNow;

                await _context.SaveChangesAsync();
                await NotifyQueueDisplayAsync(tenantId, queueItem.BranchId);

                _logger.LogInformation("Completed queue item {QueueItemId}", queueItemId);
                return true;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error completing queue item {QueueItemId}", queueItemId);
                throw;
            }
        }

        public async Task<bool> RemoveFromQueueAsync(Guid tenantId, Guid queueItemId, string reason, Guid currentUserId)
        {
            try
            {
                var queueItem = await _context.CounselorQueue
                    .FirstOrDefaultAsync(q => q.Id == queueItemId && q.TenantId == tenantId && q.DeletedAt == null);

                if (queueItem == null)
                    return false;

                queueItem.Status = "Cancelled";
                queueItem.UpdatedAt = DateTime.UtcNow;
                queueItem.DeletedAt = DateTime.UtcNow;

                await _context.SaveChangesAsync();
                await NotifyQueueDisplayAsync(tenantId, queueItem.BranchId);

                _logger.LogInformation("Removed queue item {QueueItemId} - Reason: {Reason}", queueItemId, reason);
                return true;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error removing queue item {QueueItemId}", queueItemId);
                throw;
            }
        }

        // ============================================================================
        // SESSION NOTES
        // ============================================================================

        public async Task<List<SessionNoteDto>> GetSessionNotesAsync(Guid tenantId, Guid sessionId)
        {
            try
            {
                var notes = await _context.CounselingSessionNotes
                    .Where(n => n.SessionId == sessionId && n.TenantId == tenantId && n.DeletedAt == null)
                    .Select(n => new SessionNoteDto
                    {
                        Id = n.Id,
                        TenantId = n.TenantId,
                        SessionId = n.SessionId,
                        NoteType = n.NoteType,
                        NoteText = n.NoteText,
                        IsConfidential = n.IsConfidential,
                        Tags = n.Tags,
                        CreatedAt = n.CreatedAt,
                        CreatedByUserId = n.CreatedByUserId
                    })
                    .OrderByDescending(n => n.CreatedAt)
                    .ToListAsync();

                return notes;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error retrieving session notes for session {SessionId}", sessionId);
                throw;
            }
        }

        public async Task<SessionNoteDto?> GetNoteByIdAsync(Guid tenantId, Guid noteId)
        {
            try
            {
                var note = await _context.CounselingSessionNotes
                    .Where(n => n.Id == noteId && n.TenantId == tenantId && n.DeletedAt == null)
                    .Select(n => new SessionNoteDto
                    {
                        Id = n.Id,
                        TenantId = n.TenantId,
                        SessionId = n.SessionId,
                        NoteType = n.NoteType,
                        NoteText = n.NoteText,
                        IsConfidential = n.IsConfidential,
                        Tags = n.Tags,
                        CreatedAt = n.CreatedAt,
                        CreatedByUserId = n.CreatedByUserId
                    })
                    .FirstOrDefaultAsync();

                return note;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error retrieving note {NoteId}", noteId);
                throw;
            }
        }

        public async Task<SessionNoteDto> CreateSessionNoteAsync(CreateSessionNoteRequest request, Guid currentUserId)
        {
            try
            {
                var note = new CounselingSessionNote
                {
                    Id = Guid.NewGuid(),
                    TenantId = request.TenantId,
                    SessionId = request.SessionId,
                    NoteType = request.NoteType,
                    NoteText = request.NoteText,
                    IsConfidential = request.IsConfidential,
                    Tags = request.Tags,
                    CreatedAt = DateTime.UtcNow,
                    CreatedByUserId = currentUserId,
                    UpdatedAt = DateTime.UtcNow,
                    UpdatedByUserId = currentUserId
                };

                _context.CounselingSessionNotes.Add(note);
                await _context.SaveChangesAsync();

                _logger.LogInformation("Created session note {NoteId} for session {SessionId}", note.Id, request.SessionId);

                return new SessionNoteDto
                {
                    Id = note.Id,
                    TenantId = note.TenantId,
                    SessionId = note.SessionId,
                    NoteType = note.NoteType,
                    NoteText = note.NoteText,
                    IsConfidential = note.IsConfidential,
                    Tags = note.Tags,
                    CreatedAt = note.CreatedAt,
                    CreatedByUserId = note.CreatedByUserId
                };
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error creating session note");
                throw;
            }
        }

        public async Task<SessionNoteDto> UpdateSessionNoteAsync(Guid tenantId, Guid noteId, UpdateSessionNoteRequest request, Guid currentUserId)
        {
            try
            {
                var note = await _context.CounselingSessionNotes
                    .FirstOrDefaultAsync(n => n.Id == noteId && n.TenantId == tenantId && n.DeletedAt == null);

                if (note == null)
                    throw new Exception("Note not found");

                if (request.NoteType != null) note.NoteType = request.NoteType;
                if (request.NoteText != null) note.NoteText = request.NoteText;
                if (request.IsConfidential.HasValue) note.IsConfidential = request.IsConfidential.Value;
                if (request.Tags != null) note.Tags = request.Tags;

                note.UpdatedAt = DateTime.UtcNow;
                note.UpdatedByUserId = currentUserId;

                await _context.SaveChangesAsync();

                _logger.LogInformation("Updated session note {NoteId}", noteId);

                return new SessionNoteDto
                {
                    Id = note.Id,
                    TenantId = note.TenantId,
                    SessionId = note.SessionId,
                    NoteType = note.NoteType,
                    NoteText = note.NoteText,
                    IsConfidential = note.IsConfidential,
                    Tags = note.Tags,
                    CreatedAt = note.CreatedAt,
                    CreatedByUserId = note.CreatedByUserId
                };
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error updating session note {NoteId}", noteId);
                throw;
            }
        }

        public async Task<bool> DeleteSessionNoteAsync(Guid tenantId, Guid noteId, Guid currentUserId)
        {
            try
            {
                var note = await _context.CounselingSessionNotes
                    .FirstOrDefaultAsync(n => n.Id == noteId && n.TenantId == tenantId && n.DeletedAt == null);

                if (note == null)
                    return false;

                note.DeletedAt = DateTime.UtcNow;
                note.UpdatedAt = DateTime.UtcNow;
                note.UpdatedByUserId = currentUserId;

                await _context.SaveChangesAsync();

                _logger.LogInformation("Deleted session note {NoteId}", noteId);
                return true;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error deleting session note {NoteId}", noteId);
                throw;
            }
        }

        // ============================================================================
        // SESSION DOCUMENTS
        // ============================================================================

        public async Task<List<SessionDocumentDto>> GetSessionDocumentsAsync(Guid tenantId, Guid sessionId)
        {
            try
            {
                var documents = await _context.CounselingSessionDocuments
                    .Where(d => d.SessionId == sessionId && d.TenantId == tenantId && d.DeletedAt == null)
                    .Select(d => new SessionDocumentDto
                    {
                        Id = d.Id,
                        TenantId = d.TenantId,
                        SessionId = d.SessionId,
                        DocumentType = d.DocumentType,
                        DocumentName = d.DocumentName,
                        DocumentDescription = d.DocumentDescription,
                        FilePath = d.FilePath,
                        FileType = d.FileType,
                        FileSizeBytes = d.FileSizeBytes,
                        IsVerified = d.IsVerified,
                        VerifiedByUserId = d.VerifiedByUserId,
                        VerifiedAt = d.VerifiedAt,
                        VerificationNotes = d.VerificationNotes,
                        Status = d.Status,
                        CreatedAt = d.CreatedAt,
                        CreatedByUserId = d.CreatedByUserId
                    })
                    .OrderByDescending(d => d.CreatedAt)
                    .ToListAsync();

                return documents;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error retrieving session documents for session {SessionId}", sessionId);
                throw;
            }
        }

        public async Task<SessionDocumentDto?> GetDocumentByIdAsync(Guid tenantId, Guid documentId)
        {
            try
            {
                var document = await _context.CounselingSessionDocuments
                    .Where(d => d.Id == documentId && d.TenantId == tenantId && d.DeletedAt == null)
                    .Select(d => new SessionDocumentDto
                    {
                        Id = d.Id,
                        TenantId = d.TenantId,
                        SessionId = d.SessionId,
                        DocumentType = d.DocumentType,
                        DocumentName = d.DocumentName,
                        DocumentDescription = d.DocumentDescription,
                        FilePath = d.FilePath,
                        FileType = d.FileType,
                        FileSizeBytes = d.FileSizeBytes,
                        IsVerified = d.IsVerified,
                        VerifiedByUserId = d.VerifiedByUserId,
                        VerifiedAt = d.VerifiedAt,
                        VerificationNotes = d.VerificationNotes,
                        Status = d.Status,
                        CreatedAt = d.CreatedAt,
                        CreatedByUserId = d.CreatedByUserId
                    })
                    .FirstOrDefaultAsync();

                return document;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error retrieving document {DocumentId}", documentId);
                throw;
            }
        }

        public async Task<SessionDocumentDto> CreateSessionDocumentAsync(CreateSessionDocumentRequest request, Guid currentUserId)
        {
            try
            {
                var document = new CounselingSessionDocument
                {
                    Id = Guid.NewGuid(),
                    TenantId = request.TenantId,
                    SessionId = request.SessionId,
                    DocumentType = request.DocumentType,
                    DocumentName = request.DocumentName,
                    DocumentDescription = request.DocumentDescription,
                    FilePath = request.FilePath,
                    FileType = request.FileType,
                    FileSizeBytes = request.FileSizeBytes,
                    IsVerified = false,
                    Status = "active",
                    CreatedAt = DateTime.UtcNow,
                    CreatedByUserId = currentUserId,
                    UpdatedAt = DateTime.UtcNow,
                    UpdatedByUserId = currentUserId
                };

                _context.CounselingSessionDocuments.Add(document);
                await _context.SaveChangesAsync();

                _logger.LogInformation("Created session document {DocumentId} for session {SessionId}", document.Id, request.SessionId);

                return new SessionDocumentDto
                {
                    Id = document.Id,
                    TenantId = document.TenantId,
                    SessionId = document.SessionId,
                    DocumentType = document.DocumentType,
                    DocumentName = document.DocumentName,
                    DocumentDescription = document.DocumentDescription,
                    FilePath = document.FilePath,
                    FileType = document.FileType,
                    FileSizeBytes = document.FileSizeBytes,
                    IsVerified = document.IsVerified,
                    VerifiedByUserId = document.VerifiedByUserId,
                    VerifiedAt = document.VerifiedAt,
                    VerificationNotes = document.VerificationNotes,
                    Status = document.Status,
                    CreatedAt = document.CreatedAt,
                    CreatedByUserId = document.CreatedByUserId
                };
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error creating session document");
                throw;
            }
        }

        public async Task<SessionDocumentDto> UploadSessionAudioAsync(
            Guid tenantId, 
            Guid sessionId, 
            Microsoft.AspNetCore.Http.IFormFile audioFile, 
            Guid currentUserId)
        {
            try
            {
                // Validate session exists and belongs to tenant
                var session = await _context.CounselingSession
                    .FirstOrDefaultAsync(s => s.Id == sessionId && s.TenantId == tenantId && s.DeletedAt == null);
                
                if (session == null)
                    throw new InvalidOperationException($"Session {sessionId} not found or does not belong to tenant {tenantId}");

                // Validate file format (audio only)
                var allowedExtensions = new[] { ".mp3", ".wav", ".webm", ".m4a", ".ogg", ".opus" };
                var fileExtension = Path.GetExtension(audioFile.FileName).ToLowerInvariant();
                
                if (!allowedExtensions.Contains(fileExtension))
                    throw new InvalidOperationException($"Invalid audio file format. Allowed formats: {string.Join(", ", allowedExtensions)}");

                // Validate file size (max 100MB)
                const long maxFileSize = 100 * 1024 * 1024; // 100MB
                if (audioFile.Length > maxFileSize)
                    throw new InvalidOperationException("File size exceeds maximum allowed size of 100MB");

                // Upload to blob storage in session-audio container
                string blobUrl;
                using (var stream = audioFile.OpenReadStream())
                {
                    var fileName = $"{tenantId}/{sessionId}/recording_{DateTime.UtcNow:yyyyMMddHHmmss}{fileExtension}";
                    blobUrl = await _blobStorageService.UploadFileAsync(
                        fileName, 
                        stream, 
                        audioFile.ContentType ?? "audio/webm", 
                        "session-audio");
                }

                // Create document record
                var document = new CounselingSessionDocument
                {
                    Id = Guid.NewGuid(),
                    TenantId = tenantId,
                    SessionId = sessionId,
                    DocumentType = "AudioRecording",
                    DocumentName = audioFile.FileName,
                    DocumentDescription = $"Audio recording for session {session.SessionNumber}",
                    FilePath = blobUrl,
                    FileType = fileExtension.TrimStart('.').ToUpperInvariant(),
                    FileSizeBytes = audioFile.Length,
                    IsVerified = false,
                    Status = "active",
                    CreatedAt = DateTime.UtcNow,
                    CreatedByUserId = currentUserId,
                    UpdatedAt = DateTime.UtcNow,
                    UpdatedByUserId = currentUserId
                };

                _context.CounselingSessionDocuments.Add(document);
                await _context.SaveChangesAsync();

                _logger.LogInformation(
                    "Uploaded audio recording {DocumentId} for session {SessionId}. File size: {FileSize} bytes",
                    document.Id, sessionId, audioFile.Length);

                return new SessionDocumentDto
                {
                    Id = document.Id,
                    TenantId = document.TenantId,
                    SessionId = document.SessionId,
                    DocumentType = document.DocumentType,
                    DocumentName = document.DocumentName,
                    DocumentDescription = document.DocumentDescription,
                    FilePath = document.FilePath,
                    FileType = document.FileType,
                    FileSizeBytes = document.FileSizeBytes,
                    IsVerified = document.IsVerified,
                    Status = document.Status,
                    CreatedAt = document.CreatedAt,
                    CreatedByUserId = document.CreatedByUserId
                };
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error uploading audio for session {SessionId}", sessionId);
                throw;
            }
        }

        public async Task<SessionDocumentDto> VerifyDocumentAsync(Guid tenantId, Guid documentId, VerifyDocumentRequest request, Guid currentUserId)
        {
            try
            {
                var document = await _context.CounselingSessionDocuments
                    .FirstOrDefaultAsync(d => d.Id == documentId && d.TenantId == tenantId && d.DeletedAt == null);

                if (document == null)
                    throw new Exception("Document not found");

                document.IsVerified = request.IsVerified;
                document.VerifiedByUserId = currentUserId;
                document.VerifiedAt = DateTime.UtcNow;
                document.VerificationNotes = request.VerificationNotes;
                document.UpdatedAt = DateTime.UtcNow;
                document.UpdatedByUserId = currentUserId;

                await _context.SaveChangesAsync();

                _logger.LogInformation("Verified session document {DocumentId}", documentId);

                return (await GetDocumentByIdAsync(tenantId, documentId))!;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error verifying document {DocumentId}", documentId);
                throw;
            }
        }

        public async Task<bool> DeleteSessionDocumentAsync(Guid tenantId, Guid documentId, Guid currentUserId)
        {
            try
            {
                var document = await _context.CounselingSessionDocuments
                    .FirstOrDefaultAsync(d => d.Id == documentId && d.TenantId == tenantId && d.DeletedAt == null);

                if (document == null)
                    return false;

                document.DeletedAt = DateTime.UtcNow;
                document.UpdatedAt = DateTime.UtcNow;
                document.UpdatedByUserId = currentUserId;

                await _context.SaveChangesAsync();

                _logger.LogInformation("Deleted session document {DocumentId}", documentId);
                return true;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error deleting session document {DocumentId}", documentId);
                throw;
            }
        }

        // ============================================================================
        // BUSINESS LOGIC & UTILITIES
        // ============================================================================

        public async Task<string> GenerateSessionNumberAsync(Guid tenantId, Guid branchId)
        {
            await Task.CompletedTask;

            // Session number generation handled by database trigger
            // This is a placeholder implementation
            var today = DateTime.UtcNow.Date;
            var datePrefix = today.ToString("yyyyMMdd");
            return $"CS-BRANCH-{datePrefix}-XXXX"; // Placeholder, actual generation in DB
        }

        public async Task<int> CalculateDurationMinutesAsync(DateTime startTime, DateTime endTime)
        {
            await Task.CompletedTask;
            return (int)(endTime - startTime).TotalMinutes;
        }

        public async Task<decimal> CalculatePriorityScoreAsync(string urgencyLevel, int waitMinutes)
        {
            await Task.CompletedTask;

            var urgencyWeight = urgencyLevel switch
            {
                "Critical" => 4.0m,
                "High" => 3.0m,
                "Normal" => 2.0m,
                "Low" => 1.0m,
                _ => 1.0m
            };

            var waitWeight = 1.0m + (waitMinutes / 30.0m);

            return urgencyWeight * waitWeight;
        }

        // ============================================================================
        // MASTER CATALOG & INVESTIGATIONS
        // ============================================================================

        public async Task<List<MasterCatalogItemDto>> GetMasterCatalogAsync(Guid tenantId, string? testType = null)
        {
            var query = _context.LabTestCatalog
                .Where(c => (c.TenantId == null || c.TenantId == tenantId) && c.DeletedAt == null && c.IsActive);

            if (!string.IsNullOrEmpty(testType))
                query = query.Where(c => c.TestType == testType);

            return await query
                .OrderBy(c => c.Category).ThenBy(c => c.TestName)
                .Select(c => new MasterCatalogItemDto
                {
                    Id       = c.Id.ToString(),
                    Name     = c.TestName,
                    Code     = c.TestCode,
                    Category = c.Category,
                    TestType = c.TestType,
                    Price    = c.Price ?? 0m,
                })
                .ToListAsync();
        }

        public async Task SaveSessionInvestigationsAsync(Guid tenantId, Guid sessionId, Guid orderedByUserId, List<InvestigationOrderItemDto> investigations)
        {
            var session = await _context.CounselingSession
                .Where(s => s.Id == sessionId && s.TenantId == tenantId && s.DeletedAt == null)
                .FirstOrDefaultAsync()
                ?? throw new InvalidOperationException($"Session {sessionId} not found.");

            var ownerDeny = DenyUnlessSessionOwner(session, orderedByUserId);
            if (ownerDeny != null)
                throw new UnauthorizedAccessException(ownerDeny.Message);

            // Soft-delete existing orders for this session
            var existing = await _context.CounselorLabOrderItems
                .Where(o => o.SessionId == sessionId && o.TenantId == tenantId && o.DeletedAt == null)
                .ToListAsync();
            foreach (var e in existing)
                e.DeletedAt = DateTime.UtcNow;

            // Insert new orders
            foreach (var inv in investigations)
            {
                var item = new CounselorLabOrderItem
                {
                    Id              = Guid.NewGuid(),
                    TenantId        = tenantId,
                    SessionId       = sessionId,
                    PatientId       = session.PatientId,
                    OrderedByUserId = orderedByUserId,
                    // FK constraint dropped — store catalogId for all types (Lab, Scan, Imaging).
                    // IDs may come from lab_test_catalog OR service catalog.
                    LabTestCatalogId = Guid.TryParse(inv.CatalogId, out var cid) ? cid : (Guid?)null,
                    Eye             = inv.Eye,
                    TestName        = inv.TestName,
                    TestCode        = inv.TestCode,
                    TestType        = inv.TestType,
                    Price           = inv.Price,
                    Urgency         = inv.Urgency,
                    Status          = "Pending",
                    OrderedAt       = DateTime.UtcNow,
                    CreatedAt       = DateTime.UtcNow,
                    UpdatedAt       = DateTime.UtcNow,
                };
                _context.CounselorLabOrderItems.Add(item);
            }

            await _context.SaveChangesAsync();
        }

        /// <summary>
        /// PD-C — block duplicate CounselingSession when a non-historical episode exists.
        /// SurgeryDone is derived only from OtFinalizeSchedules (no session-level field).
        /// Done (Completed + agreed) + !SurgeryDone → ReEvaluate; other non-historical → continue existing.
        /// </summary>
        private async Task<SessionOperationResult?> TryGetCreateSessionReuseBlockAsync(
            Guid tenantId,
            Guid patientId)
        {
            var candidates = await _context.CounselingSession
                .AsNoTracking()
                .Where(s =>
                    s.TenantId == tenantId
                    && s.PatientId == patientId
                    && s.DeletedAt == null
                    && s.Status != "Cancelled")
                .Select(s => new
                {
                    s.Id,
                    s.PatientAgreedToSurgery,
                    s.Status,
                })
                .ToListAsync();

            if (candidates.Count == 0)
                return null;

            var candidateIds = candidates.Select(c => c.Id).ToList();
            var surgeryDoneIds = await _context.OtFinalizeSchedules
                .AsNoTracking()
                .Where(o =>
                    o.TenantId == tenantId
                    && o.DeletedAt == null
                    && o.Status == OtFinalizeStatus.SurgeryDone
                    && o.CounsellingSessionId != null
                    && candidateIds.Contains(o.CounsellingSessionId.Value))
                .Select(o => o.CounsellingSessionId!.Value)
                .Distinct()
                .ToListAsync();

            var activeEpisodes = candidates
                .Where(c => !surgeryDoneIds.Contains(c.Id))
                .ToList();

            if (activeEpisodes.Count == 0)
                return null;

            var episodeIds = activeEpisodes.Select(e => e.Id).ToList();
            var queueRows = await _context.CounselorQueue
                .AsNoTracking()
                .Where(q =>
                    q.TenantId == tenantId
                    && q.DeletedAt == null
                    && episodeIds.Contains(q.SessionId))
                .Select(q => new { q.SessionId, q.Status })
                .ToListAsync();

            var queueBySession = queueRows
                .GroupBy(q => q.SessionId)
                .ToDictionary(g => g.Key, g => g.Select(x => x.Status).ToList());

            // Prefer Done + !SurgeryDone → ReEvaluate when present.
            foreach (var episode in activeEpisodes)
            {
                if (!queueBySession.TryGetValue(episode.Id, out var statuses))
                    statuses = new List<string>();
                var hasCompletedQueue = statuses.Any(s => s == "Completed");
                var sessionCompleted = episode.Status == "Completed";
                if ((hasCompletedQueue || sessionCompleted) && episode.PatientAgreedToSurgery == true)
                {
                    return new SessionOperationResult
                    {
                        Success = false,
                        FailureKind = SessionOperationFailureKind.Conflict,
                        SessionId = episode.Id,
                        Message =
                            "Existing counselling is completed but surgery is not done. ReEvaluate the existing counselling session instead of creating another.",
                    };
                }
            }

            foreach (var episode in activeEpisodes)
            {
                if (!queueBySession.TryGetValue(episode.Id, out var statuses))
                    statuses = new List<string>();
                var hasActiveQueue = statuses.Any(s =>
                    s == "Waiting" || s == "InProgress" || s == "Called" || s == "AddOnSurgery");
                if (hasActiveQueue)
                {
                    return new SessionOperationResult
                    {
                        Success = false,
                        FailureKind = SessionOperationFailureKind.Conflict,
                        SessionId = episode.Id,
                        Message =
                            "Patient already has an active counselling session. Open the existing waiting list row instead of creating another.",
                    };
                }
            }

            // Any remaining non-SurgeryDone episode (e.g. Completed + not agreed) stays same-session.
            var existing = activeEpisodes[0];
            return new SessionOperationResult
            {
                Success = false,
                FailureKind = SessionOperationFailureKind.Conflict,
                SessionId = existing.Id,
                Message =
                    "Patient already has an open counselling episode. Continue the existing session instead of creating another.",
            };
        }

        /// <summary>
        /// Phase 3I Slice 4 (PD-AUTH-01 / S4-D3–D5): owner-level counselling mutate
        /// requires current CounselorId == actor. Unassigned and non-owner → Forbidden.
        /// No Admin content bypass (Slice 6 for supervisory ops).
        /// </summary>
        private static SessionOperationResult? DenyUnlessSessionOwner(
            CounselingSession session,
            Guid actorUserId)
        {
            if (!session.CounselorId.HasValue)
            {
                return new SessionOperationResult
                {
                    Success = false,
                    FailureKind = SessionOperationFailureKind.Forbidden,
                    Message =
                        "Session is unassigned. Ownership must be established through Assign or claim-for-lifecycle before mutating counselling content."
                };
            }

            if (session.CounselorId.Value != actorUserId)
            {
                return new SessionOperationResult
                {
                    Success = false,
                    FailureKind = SessionOperationFailureKind.Forbidden,
                    Message = "Only the assigned counsellor may mutate this session."
                };
            }

            return null;
        }

        /// <summary>
        /// Phase 3I Slice 7 (PD-S7-02/05/06): missing expected Version → BadRequest (fail closed, no LWW);
        /// stale Version → Conflict (409), distinct from ownership Forbidden (403).
        /// </summary>
        private static SessionOperationResult? DenyUnlessExpectedVersion(
            CounselingSession session,
            int? expectedVersion)
        {
            if (!expectedVersion.HasValue)
            {
                return new SessionOperationResult
                {
                    Success = false,
                    FailureKind = SessionOperationFailureKind.BadRequest,
                    Message = "Version is required."
                };
            }

            if (session.Version != expectedVersion.Value)
            {
                return new SessionOperationResult
                {
                    Success = false,
                    FailureKind = SessionOperationFailureKind.Conflict,
                    Message = SessionConcurrency.StaleMessage
                };
            }

            return null;
        }

        /// <summary>
        /// PD-PENDING-READONLY-01: counselling-content updates allowed only after StartSession
        /// sets InProgress, or for post-start terminal statuses that historically allowed Update.
        /// Pre-start (Scheduled / empty) is rejected.
        /// </summary>
        private static bool AllowsCounselingContentMutation(string? status)
        {
            if (string.IsNullOrWhiteSpace(status))
                return false;

            return status.Equals("InProgress", StringComparison.OrdinalIgnoreCase)
                || status.Equals("Completed", StringComparison.OrdinalIgnoreCase)
                || status.Equals("Cancelled", StringComparison.OrdinalIgnoreCase)
                || status.Equals("NoShow", StringComparison.OrdinalIgnoreCase);
        }

        private Task NotifyQueueDisplayAsync(Guid tenantId, Guid branchId) =>
            _queueDisplayNotifier.NotifyBranchDisplayUpdatedAsync(tenantId, branchId);
    }
}
