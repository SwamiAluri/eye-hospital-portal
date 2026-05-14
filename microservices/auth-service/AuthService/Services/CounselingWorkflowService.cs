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

namespace AuthService.Services
{
    public class CounselingWorkflowService : ICounselingWorkflowService
    {
        private readonly AppDbContext _context;
        private readonly ILogger<CounselingWorkflowService> _logger;
        private readonly Interfaces.IBlobStorageService _blobStorageService;
        private readonly IHttpClientFactory _httpClientFactory;
        private readonly string _ccmsBaseUrl;

        public CounselingWorkflowService(
            AppDbContext context, 
            ILogger<CounselingWorkflowService> logger,
            Interfaces.IBlobStorageService blobStorageService,
            IHttpClientFactory httpClientFactory,
            IConfiguration configuration)
        {
            _context = context;
            _logger = logger;
            _blobStorageService = blobStorageService;
            _httpClientFactory = httpClientFactory;
            _ccmsBaseUrl = configuration["CcmsService:BaseUrl"] ?? "http://localhost:7075/api";
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

                if (filters.BranchId.HasValue)
                    query = query.Where(s => s.BranchId == filters.BranchId.Value);

                if (filters.PatientId.HasValue)
                    query = query.Where(s => s.PatientId == filters.PatientId.Value);

                if (filters.CounselorId.HasValue)
                    query = query.Where(s => s.CounselorId == filters.CounselorId.Value);

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

                if (!string.IsNullOrEmpty(filters.Search))
                {
                    query = query.Where(s => s.SessionNumber != null && s.SessionNumber.Contains(filters.Search));
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

                    // ── Surgery catalog ─────────────────────────────────────────────────────────
                    // Strategy: always show the full active catalog so the counsellor can present
                    // every pricing option. Items that the doctor explicitly recommended are
                    // flagged IsRecommended = true and the UI pins them at the top.

                    // Step 1 – collect the IDs the doctor recommended (from JSONB, keyed by surgeryTypeId+eye)
                    var doctorRecommendedKeys = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
                    if (!string.IsNullOrWhiteSpace(session.RecommendedProcedures))
                    {
                        try
                        {
                            var procs = JsonSerializer.Deserialize<List<JsonElement>>(session.RecommendedProcedures);
                            if (procs != null)
                            {
                                foreach (var p in procs)
                                {
                                    if (p.TryGetProperty("surgeryTypeId", out var tp) && tp.GetString() is { } tid && !string.IsNullOrEmpty(tid))
                                    {
                                        var eye = p.TryGetProperty("eye", out var ep) ? ep.GetString() ?? "" : "";
                                        // key = "<typeId>|<eye>" so we can pin the exact eye the doctor specified
                                        doctorRecommendedKeys.Add($"{tid}|{eye}");
                                        // Also allow matching without eye (in case eye is blank)
                                        doctorRecommendedKeys.Add($"{tid}|");
                                    }
                                }
                            }
                        }
                        catch { /* malformed JSON – just treat as no recommendation */ }
                    }

                    // Step 2 – if no JSONB, try matching recommended_surgery text → get IDs
                    if (doctorRecommendedKeys.Count == 0 && !string.IsNullOrWhiteSpace(session.RecommendedSurgery))
                    {
                        var textMatches = await _context.ServiceVariants
                            .Where(v => v.IsActive
                                      && (EF.Functions.ILike(v.VariantName, $"%{session.RecommendedSurgery}%")
                                          || EF.Functions.ILike(v.VariantCode ?? "", $"%{session.RecommendedSurgery}%")))
                            .Select(v => v.Id.ToString())
                            .ToListAsync();

                        var eye = session.SurgeryTentativeEye ?? "";
                        foreach (var tid in textMatches)
                            doctorRecommendedKeys.Add($"{tid}|{eye}");
                    }

                    // Step 3 – load ALL active surgery types for this tenant
                    {
                        string[] eyes = session.SurgeryTentativeEye == "BE"
                            ? new[] { "RE", "LE" }
                            : new[] { session.SurgeryTentativeEye ?? "RE" };

                        var allTypes = await _context.ServiceVariants
                            .Include(v => v.CatalogService)
                                .ThenInclude(s => s.Category)
                            .Where(v => v.IsActive
                                     && v.CatalogService.IsActive
                                     && v.CatalogService.Category.IsActive
                                     && v.CatalogService.Category.Code != "DIAGNOSTICS"
                                     && v.CatalogService.Category.Code != "INVESTIGATIONS")
                            .OrderBy(v => v.CatalogService.Category.DisplayOrder)
                            .ThenBy(v => v.DisplayOrder)
                            .Select(v => new
                            {
                                v.Id,
                                Name = v.VariantName,
                                CategoryCode = v.CatalogService.Category.Code,
                            })
                            .ToListAsync();

                        // Load global prices for all surgery types (DefaultPrice removed during normalisation)
                        var typeIds = allTypes.Select(t => t.Id).ToList();
                        var typePriceMap = (await _context.VariantPrices
                            .Where(p => typeIds.Contains(p.VariantId)
                                     && p.BranchId == null
                                     && p.EffectiveTo == null
                                     && p.IsActive
                                     && p.DeletedAt == null)
                            .ToListAsync())
                            .GroupBy(p => p.VariantId)
                            .ToDictionary(g => g.Key,
                                          g => g.OrderByDescending(p => p.EffectiveFrom).First().Amount);

                        foreach (var st in allTypes)
                        {
                            foreach (var eye in eyes)
                            {
                                var isRec = doctorRecommendedKeys.Contains($"{st.Id}|{eye}")
                                         || doctorRecommendedKeys.Contains($"{st.Id}|");
                                session.SurgeriesWithPricing.Add(new SurgeryPricingDto
                                {
                                    Id              = $"type-{st.Id}-{eye}",
                                    SurgeryName     = st.Name,
                                    SurgeryCategory = st.CategoryCode,
                                    Eye             = eye,
                                    Cost            = typePriceMap.GetValueOrDefault(st.Id, 0m),
                                    IsRecommended   = isRec,
                                });
                            }
                        }
                    }

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
            using var transaction = await _context.Database.BeginTransactionAsync();
            try
            {
                var session = new CounselingSession
                {
                    Id = Guid.NewGuid(),
                    TenantId = request.TenantId,
                    BranchId = request.BranchId,
                    PatientId = request.PatientId,
                    VisitId = request.VisitId,
                    ReferredByDoctorId = request.ReferredByDoctorId,
                    CounselorId = request.CounselorId,
                    SessionType = request.SessionType,
                    SessionDate = request.SessionDate ?? DateTime.UtcNow.Date,
                    PatientType = request.PatientType,
                    ClinicalSummary = request.ClinicalSummary,
                    RecommendedSurgery = request.RecommendedSurgery,
                    RecommendedIol = request.RecommendedIol,
                    IolPower = request.IolPower,
                    RecommendedProcedures = request.RecommendedProcedures,
                    Urgency = request.Urgency,
                    PatientPresent = request.PatientPresent,
                    AttenderName = request.AttenderName,
                    AttenderPhone = request.AttenderPhone,
                    AttenderRelation = request.AttenderRelation,
                    AttenderIsDecisionMaker = request.AttenderIsDecisionMaker,
                    AttenderNotes = request.AttenderNotes,
                    PatientIntention = request.PatientIntention,
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
                        Message = "Session not found"
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

                if (request.CounselorId.HasValue) session.CounselorId = request.CounselorId.Value;
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

                // Patient Intention & Anesthesia
                if (request.PatientIntention != null) session.PatientIntention = request.PatientIntention;
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

        public async Task<SessionOperationResult> StartSessionAsync(Guid tenantId, Guid sessionId, Guid currentUserId)
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
                        Message = "Session not found"
                    };
                }

                session.Status = "InProgress";
                session.SessionStartTime = DateTime.UtcNow;
                session.UpdatedAt = DateTime.UtcNow;
                session.UpdatedByUserId = currentUserId;

                // Update queue item status.
                // "Called" → InProgress: normal first entry.
                // "Completed" → InProgress: repeat counselling — patient is coming back.
                var queueItem = await _context.CounselorQueue
                    .FirstOrDefaultAsync(q => q.SessionId == sessionId && q.DeletedAt == null);

                if (queueItem != null && (queueItem.Status == "Called" || queueItem.Status == "Completed"))
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

        public async Task<SessionOperationResult> CompleteSessionAsync(Guid tenantId, Guid sessionId, Guid currentUserId)
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
                        Message = "Session not found"
                    };
                }

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

                _logger.LogInformation("Completed counseling session {SessionId}", sessionId);

                // Fire-and-forget: notify CCMS if insurance/govt payment type
                var insuranceTypes = new HashSet<string>(StringComparer.OrdinalIgnoreCase)
                    { "Insurance", "TPA", "CoPay", "CGHS", "SGHS", "GovernmentScheme" };
                if (insuranceTypes.Contains(session.PatientType ?? ""))
                {
                    _ = Task.Run(async () =>
                    {
                        try
                        {
                            var payload = new
                            {
                                tenantId = tenantId,
                                sessionId = sessionId,
                                journeyId = (Guid?)null,
                                patientId = session.PatientId,
                                patientName = (string?)null,
                                paymentType = session.PatientType,
                                notRequiredPreAuth = false,
                                branchId = session.BranchId,
                                doctorId = session.ReferredByDoctorId,
                                insuranceProviderId = (Guid?)null,
                                tpaProviderId = (Guid?)null,
                                governmentSchemeId = (Guid?)null,
                                packageId = session.SelectedPackageId,
                                legacyPreauthId = (Guid?)null,
                                sessionPreauthId = (Guid?)null,
                                actorUserId = currentUserId,
                            };
                            var json = JsonSerializer.Serialize(payload);
                            var client = _httpClientFactory.CreateClient();
                            await client.PostAsync(
                                $"{_ccmsBaseUrl}/ccms/integration/counselling-completed",
                                new StringContent(json, Encoding.UTF8, "application/json"));
                        }
                        catch (Exception ex)
                        {
                            _logger.LogWarning(ex, "CCMS counselling-completed callback failed for session {SessionId}", sessionId);
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
                var queueItem = await _context.CounselorQueue
                    .FirstOrDefaultAsync(q => q.SessionId == sessionId && q.TenantId == tenantId && q.DeletedAt == null);

                if (queueItem == null)
                {
                    return new SessionOperationResult { Success = false, Message = "Queue item not found" };
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

        public async Task<SessionOperationResult> CancelSessionAsync(Guid tenantId, Guid sessionId, string reason, Guid currentUserId)        {
            try
            {
                var session = await _context.CounselingSession
                    .FirstOrDefaultAsync(s => s.Id == sessionId && s.TenantId == tenantId && s.DeletedAt == null);

                if (session == null)
                {
                    return new SessionOperationResult
                    {
                        Success = false,
                        Message = "Session not found"
                    };
                }

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

        public async Task<bool> DeleteSessionAsync(Guid tenantId, Guid sessionId, Guid currentUserId)
        {
            using var transaction = await _context.Database.BeginTransactionAsync();
            try
            {
                var session = await _context.CounselingSession
                    .FirstOrDefaultAsync(s => s.Id == sessionId && s.TenantId == tenantId && s.DeletedAt == null);

                if (session == null)
                    return false;

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
                return true;
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

        public async Task<bool> StartSessionFromQueueAsync(Guid tenantId, Guid queueItemId, Guid currentUserId)
        {
            try
            {
                var queueItem = await _context.CounselorQueue
                    .FirstOrDefaultAsync(q => q.Id == queueItemId && q.TenantId == tenantId && q.DeletedAt == null);

                if (queueItem == null)
                    return false;

                queueItem.Status = "InProgress";
                queueItem.StartedAt = DateTime.UtcNow;
                queueItem.UpdatedAt = DateTime.UtcNow;

                // Update session status
                var session = await _context.CounselingSession
                    .FirstOrDefaultAsync(s => s.Id == queueItem.SessionId && s.DeletedAt == null);

                if (session != null)
                {
                    session.Status = "InProgress";
                    session.SessionStartTime = DateTime.UtcNow;
                    session.UpdatedAt = DateTime.UtcNow;
                    session.UpdatedByUserId = currentUserId;
                }

                await _context.SaveChangesAsync();

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
    }
}
