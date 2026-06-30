using AuthService.Authorization;
using AuthService.Context;
using AuthService.Models.Domain;
using AuthService.Models.Domain.Dtos;
using AuthService.Services;
using AuthService.Services.Interfaces;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace AuthService.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize]
public class PatientsController : ControllerBase
{
    private readonly IPatientService _patientService;
    private readonly IBlobStorageService _blobStorageService;
    private readonly IConfiguration _configuration;
    private readonly ILogger<PatientsController> _logger;
    private readonly IPatientDuplicateDetectionService _duplicateDetectionService;
    private readonly IPatientLookupService _patientLookupService;
    private readonly IPatientOmniSearchService _patientOmniSearchService;
    private readonly IPatientSummaryService _patientSummaryService;
    private readonly IPatientSummaryPdfService _patientSummaryPdfService;
    private readonly IAuditService _auditService;
    private readonly IPatientMergeService _patientMergeService;
    private readonly IPatientRecentViewsService _recentViewsService;
    private readonly AppDbContext _context;

    public PatientsController(
        IPatientService patientService,
        IBlobStorageService blobStorageService,
        IConfiguration configuration,
        ILogger<PatientsController> logger,
        IPatientDuplicateDetectionService duplicateDetectionService,
        IPatientLookupService patientLookupService,
        IPatientOmniSearchService patientOmniSearchService,
        IPatientSummaryService patientSummaryService,
        IPatientSummaryPdfService patientSummaryPdfService,
        IAuditService auditService,
        IPatientMergeService patientMergeService,
        IPatientRecentViewsService recentViewsService,
        AppDbContext context)
    {
        _patientService = patientService;
        _blobStorageService = blobStorageService;
        _configuration = configuration;
        _logger = logger;
        _duplicateDetectionService = duplicateDetectionService;
        _patientLookupService = patientLookupService;
        _patientOmniSearchService = patientOmniSearchService;
        _patientSummaryService = patientSummaryService;
        _patientSummaryPdfService = patientSummaryPdfService;
        _auditService = auditService;
        _patientMergeService = patientMergeService;
        _recentViewsService = recentViewsService;
        _context = context;
    }

    private static List<string> ParseCsvList(string? value) =>
        string.IsNullOrWhiteSpace(value)
            ? new List<string>()
            : value.Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries).ToList();

    private PatientLookupQuery BuildLookupQuery(
        Guid tenantId, Guid branchId, Guid userId,
        string? q, string tab, int page, int pageSize, string sortBy, string sortDir,
        bool favoritesOnly, bool assignedToMe,
        string? engagementTypes, string? programCodes, string? patientTypes,
        string? gender, string? mrn, string? phone,
        DateTime? dobFrom, DateTime? dobTo, DateTime? appointmentFrom, DateTime? appointmentTo,
        string? name = null, string? diagnosis = null, Guid? providerId = null,
        Guid? departmentId = null, string? wardName = null,
        DateTime? admissionFrom = null, DateTime? admissionTo = null) =>
        new()
        {
            TenantId = tenantId,
            BranchId = branchId,
            UserId = userId,
            Q = q,
            Tab = tab,
            Page = page,
            PageSize = pageSize,
            SortBy = sortBy,
            SortDir = sortDir,
            FavoritesOnly = favoritesOnly,
            AssignedToMe = assignedToMe,
            EngagementTypes = ParseCsvList(engagementTypes),
            ProgramCodes = ParseCsvList(programCodes),
            PatientTypes = ParseCsvList(patientTypes),
            Gender = gender,
            Mrn = mrn,
            Phone = phone,
            DobFrom = dobFrom,
            DobTo = dobTo,
            AppointmentFrom = appointmentFrom,
            AppointmentTo = appointmentTo,
            Name = name,
            Diagnosis = diagnosis,
            ProviderId = providerId,
            DepartmentId = departmentId,
            WardName = wardName,
            AdmissionFrom = admissionFrom,
            AdmissionTo = admissionTo,
        };

    private bool TryGetTenantAndUser(out Guid tenantId, out Guid userId)
    {
        tenantId = Guid.Empty;
        userId = Guid.Empty;
        var tenantClaim = User.FindFirst("TenantId")?.Value;
        if (string.IsNullOrEmpty(tenantClaim) || !Guid.TryParse(tenantClaim, out tenantId))
            return false;
        var userClaim = User.FindFirst("sub")?.Value
            ?? User.FindFirst("user_id")?.Value
            ?? User.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier)?.Value;
        if (string.IsNullOrEmpty(userClaim) || !Guid.TryParse(userClaim, out userId))
            return false;
        return true;
    }

    /// <summary>Patient Hub — typeahead suggest (branch-scoped).</summary>
    [HttpGet("suggest")]
    [RequirePermission("patient.view")]
    public async Task<ActionResult<List<PatientSuggestRowDto>>> SuggestPatients(
        [FromQuery] Guid branchId,
        [FromQuery] string q,
        [FromQuery] int limit = 10)
    {
        if (!TryGetTenantAndUser(out var tenantId, out var userId))
            return Unauthorized();

        var rows = await _patientLookupService.SuggestAsync(tenantId, branchId, userId, q, limit);
        return Ok(rows);
    }

    /// <summary>Patient Hub — multi-scope omnisearch (Ctrl+K).</summary>
    [HttpGet("omni-search")]
    [RequirePermission("patient.view")]
    public async Task<ActionResult<List<PatientOmniSearchHitDto>>> OmniSearch(
        [FromQuery] Guid branchId,
        [FromQuery] string scope = "patients",
        [FromQuery] string? q = null,
        [FromQuery] int limit = 15)
    {
        if (!TryGetTenantAndUser(out var tenantId, out var userId))
            return Unauthorized();

        var rows = await _patientOmniSearchService.SearchAsync(
            tenantId,
            branchId,
            userId,
            scope,
            q ?? "",
            limit);
        return Ok(rows);
    }

    /// <summary>Patient Hub — paginated lookup list.</summary>
    [HttpGet("lookup")]
    [RequirePermission("patient.view")]
    public async Task<ActionResult<PatientLookupPageDto>> LookupPatients(
        [FromQuery] Guid branchId,
        [FromQuery] string? q = null,
        [FromQuery] string tab = "all",
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 25,
        [FromQuery] string sortBy = "name",
        [FromQuery] string sortDir = "asc",
        [FromQuery] bool favoritesOnly = false,
        [FromQuery] bool assignedToMe = false,
        [FromQuery] string? engagementTypes = null,
        [FromQuery] string? programCodes = null,
        [FromQuery] string? patientTypes = null,
        [FromQuery] string? gender = null,
        [FromQuery] string? mrn = null,
        [FromQuery] string? phone = null,
        [FromQuery] DateTime? dobFrom = null,
        [FromQuery] DateTime? dobTo = null,
        [FromQuery] DateTime? appointmentFrom = null,
        [FromQuery] DateTime? appointmentTo = null,
        [FromQuery] string? name = null,
        [FromQuery] string? diagnosis = null,
        [FromQuery] Guid? providerId = null,
        [FromQuery] Guid? departmentId = null,
        [FromQuery] string? wardName = null,
        [FromQuery] DateTime? admissionFrom = null,
        [FromQuery] DateTime? admissionTo = null)
    {
        if (!TryGetTenantAndUser(out var tenantId, out var userId))
            return Unauthorized();

        var result = await _patientLookupService.LookupAsync(BuildLookupQuery(
            tenantId, branchId, userId, q, tab, page, pageSize, sortBy, sortDir,
            favoritesOnly, assignedToMe, engagementTypes, programCodes, patientTypes,
            gender, mrn, phone, dobFrom, dobTo, appointmentFrom, appointmentTo,
            name, diagnosis, providerId, departmentId, wardName, admissionFrom, admissionTo));
        return Ok(result);
    }

    /// <summary>Patient Hub — CSV export for current filters.</summary>
    [HttpGet("lookup/export")]
    [RequirePermission("patient.export")]
    public async Task<IActionResult> ExportLookup(
        [FromQuery] Guid branchId,
        [FromQuery] string? q = null,
        [FromQuery] string tab = "all",
        [FromQuery] string sortBy = "name",
        [FromQuery] string sortDir = "asc",
        [FromQuery] bool favoritesOnly = false,
        [FromQuery] bool assignedToMe = false,
        [FromQuery] string? engagementTypes = null,
        [FromQuery] string? programCodes = null,
        [FromQuery] string? patientTypes = null,
        [FromQuery] string? gender = null,
        [FromQuery] string? mrn = null,
        [FromQuery] string? phone = null,
        [FromQuery] DateTime? dobFrom = null,
        [FromQuery] DateTime? dobTo = null,
        [FromQuery] DateTime? appointmentFrom = null,
        [FromQuery] DateTime? appointmentTo = null,
        [FromQuery] string? name = null,
        [FromQuery] string? diagnosis = null,
        [FromQuery] Guid? providerId = null,
        [FromQuery] Guid? departmentId = null,
        [FromQuery] string? wardName = null,
        [FromQuery] DateTime? admissionFrom = null,
        [FromQuery] DateTime? admissionTo = null,
        [FromQuery] string format = "csv")
    {
        if (!TryGetTenantAndUser(out var tenantId, out var userId))
            return Unauthorized();

        if (!string.Equals(format, "csv", StringComparison.OrdinalIgnoreCase))
            return BadRequest(new { message = "Only csv format is supported" });

        var bytes = await _patientLookupService.ExportCsvAsync(BuildLookupQuery(
            tenantId, branchId, userId, q, tab, 1, 5000, sortBy, sortDir,
            favoritesOnly, assignedToMe, engagementTypes, programCodes, patientTypes,
            gender, mrn, phone, dobFrom, dobTo, appointmentFrom, appointmentTo,
            name, diagnosis, providerId, departmentId, wardName, admissionFrom, admissionTo));

        await _auditService.LogDataAccessAsync(userId, "PatientLookup", branchId, "EXPORT_CSV", "PHI");

        return File(bytes, "text/csv", $"patients-{DateTime.UtcNow:yyyyMMdd-HHmm}.csv");
    }

    /// <summary>Patient Hub — classification tab counts.</summary>
    [HttpGet("lookup/stats")]
    [RequirePermission("patient.view")]
    public async Task<ActionResult<PatientLookupStatsDto>> LookupStats([FromQuery] Guid branchId)
    {
        if (!TryGetTenantAndUser(out var tenantId, out var userId))
            return Unauthorized();

        var stats = await _patientLookupService.GetStatsAsync(tenantId, branchId, userId);
        return Ok(stats);
    }

    /// <summary>Patient Hub — recently viewed patients for current user.</summary>
    [HttpGet("recent-views")]
    [RequirePermission("patient.view")]
    public async Task<ActionResult<List<PatientRecentViewDto>>> GetRecentViews([FromQuery] int limit = 6)
    {
        if (!TryGetTenantAndUser(out var tenantId, out var userId))
            return Unauthorized();

        var rows = await _recentViewsService.GetRecentAsync(tenantId, userId, limit);
        return Ok(rows);
    }

    /// <summary>Patient Hub — record a patient preview/profile view.</summary>
    [HttpPost("{id}/recent-view")]
    [RequirePermission("patient.view")]
    public async Task<IActionResult> RecordRecentView(Guid id)
    {
        if (!TryGetTenantAndUser(out var tenantId, out var userId))
            return Unauthorized();

        var exists = await _context.Patients.AnyAsync(p => p.Id == id && p.TenantId == tenantId && p.DeletedAt == null);
        if (!exists) return NotFound();

        await _recentViewsService.RecordViewAsync(tenantId, userId, id);
        return NoContent();
    }

    /// <summary>Patient Hub — PHI access audit (preview drawer, etc.).</summary>
    [HttpPost("{id}/phi-access")]
    [RequirePermission("patient.view")]
    public async Task<IActionResult> LogPhiAccess(Guid id, [FromBody] PhiAccessRequestDto? body)
    {
        if (!TryGetTenantAndUser(out var tenantId, out var userId))
            return Unauthorized();

        var exists = await _context.Patients.AnyAsync(p => p.Id == id && p.TenantId == tenantId && p.DeletedAt == null);
        if (!exists) return NotFound();

        var context = string.IsNullOrWhiteSpace(body?.Context) ? "preview" : body!.Context.Trim();
        await _auditService.LogDataAccessAsync(userId, "Patient", id, "VIEW_PHI", "PHI");
        if (!string.Equals(context, "preview", StringComparison.OrdinalIgnoreCase))
            await _auditService.LogAsync(userId, "VIEW_PHI", "Patient", id, context);
        return NoContent();
    }

    /// <summary>Toggle patient favorite for current user.</summary>
    [HttpPut("{id}/favorite")]
    [RequirePermission("patient.view")]
    public async Task<ActionResult<object>> ToggleFavorite(Guid id)
    {
        if (!TryGetTenantAndUser(out var tenantId, out var userId))
            return Unauthorized();

        var isFavorite = await _patientLookupService.ToggleFavoriteAsync(tenantId, userId, id);
        return Ok(new { isFavorite });
    }

    [HttpGet]
    [RequirePermission("patient.view")]
    public async Task<ActionResult<List<PatientResponse>>> GetAllPatients()
    {
        var tenantId = User.FindFirst("TenantId")?.Value;
        if (string.IsNullOrEmpty(tenantId)) return Unauthorized();

        var patients = await _patientService.GetAllPatientsAsync(Guid.Parse(tenantId));
        
        return Ok(patients.Select(p => MapToResponse(p)));
    }

    [HttpGet("search")]
    [RequirePermission("patient.view")]
    public async Task<ActionResult<List<PatientResponse>>> SearchPatients(
        [FromQuery] string searchTerm,
        [FromQuery] string? searchType = null)
    {
        var tenantId = User.FindFirst("TenantId")?.Value;
        if (string.IsNullOrEmpty(tenantId)) return Unauthorized();

        if (string.IsNullOrWhiteSpace(searchTerm))
            return Ok(new List<PatientResponse>());

        var patients = await _patientService.SearchPatientsAsync(searchTerm, searchType, Guid.Parse(tenantId));
        
        return Ok(patients.Select(p => MapToResponse(p)));
    }

    [HttpGet("{id}")]
    [RequirePermission("patient.view")]
    public async Task<ActionResult<PatientResponse>> GetPatient(Guid id)
    {
        var tenantId = User.FindFirst("TenantId")?.Value;
        if (string.IsNullOrEmpty(tenantId)) return Unauthorized();

        var patient = await _patientService.GetPatientByIdAsync(id, Guid.Parse(tenantId));
        if (patient == null) return NotFound();

        return Ok(MapToResponse(patient));
    }

    /// <summary>Merge duplicate patient records into primary (admin).</summary>
    [HttpPost("{primaryId}/merge")]
    [RequirePermission("patient.update")]
    public async Task<ActionResult<PatientResponse>> MergePatients(
        Guid primaryId,
        [FromBody] MergePatientsRequest request)
    {
        if (!TryGetTenantAndUser(out var tenantId, out var userId))
            return Unauthorized();

        if (request.DuplicatePatientId == Guid.Empty)
            return BadRequest(new { error = "duplicatePatientId is required" });

        try
        {
            var merged = await _patientMergeService.MergePatientsAsync(
                tenantId, primaryId, request.DuplicatePatientId, userId);
            if (merged == null)
                return NotFound(new { error = "One or both patients were not found" });

            await _auditService.LogAsync(
                userId,
                "PATIENT_MERGE",
                "Patient",
                primaryId,
                $"Merged duplicate {request.DuplicatePatientId} into {primaryId}");

            return Ok(MapToResponse(merged));
        }
        catch (ArgumentException ex)
        {
            return BadRequest(new { error = ex.Message });
        }
    }

    [HttpGet("{id}/summary")]
    [RequirePermission("patient.view")]
    public async Task<ActionResult<PatientSummaryDto>> GetPatientSummary(
        Guid id, [FromQuery] Guid branchId, [FromQuery] bool skipPhiAudit = false)
    {
        if (!TryGetTenantAndUser(out var tenantId, out var userId))
            return Unauthorized();

        var summary = await _patientSummaryService.GetSummaryAsync(tenantId, branchId, id);
        if (summary == null) return NotFound();

        if (!skipPhiAudit)
            await _auditService.LogDataAccessAsync(userId, "Patient", id, "VIEW_PHI", "PHI");
        return Ok(summary);
    }

    [HttpGet("{id}/visits/recent")]
    [RequirePermission("patient.view")]
    public async Task<ActionResult<List<PatientRecentVisitDto>>> GetRecentVisits(
        Guid id, [FromQuery] Guid branchId, [FromQuery] int limit = 5)
    {
        if (!TryGetTenantAndUser(out var tenantId, out _))
            return Unauthorized();

        var visits = await _patientSummaryService.GetRecentVisitsAsync(tenantId, branchId, id, limit);
        return Ok(visits);
    }

    [HttpGet("{id}/data-quality")]
    [RequirePermission("patient.view")]
    public async Task<ActionResult<PatientDataQualityDto>> GetDataQuality(Guid id)
    {
        if (!TryGetTenantAndUser(out var tenantId, out _))
            return Unauthorized();

        return Ok(await _patientSummaryService.GetDataQualityAsync(tenantId, id));
    }

    [HttpGet("{id}/vitals/staleness")]
    [RequirePermission("patient.view")]
    public async Task<ActionResult<PatientVitalsStalenessDto>> GetVitalsStaleness(Guid id)
    {
        if (!TryGetTenantAndUser(out var tenantId, out _))
            return Unauthorized();

        return Ok(await _patientSummaryService.GetVitalsStalenessAsync(tenantId, id));
    }

    /// <summary>Patient Hub — export patient summary as PDF.</summary>
    [HttpGet("{id}/summary/export")]
    [RequirePermission("patient.export")]
    public async Task<IActionResult> ExportPatientSummary(
        Guid id,
        [FromQuery] Guid branchId,
        [FromQuery] string format = "pdf")
    {
        if (!TryGetTenantAndUser(out var tenantId, out var userId))
            return Unauthorized();

        if (!string.Equals(format, "pdf", StringComparison.OrdinalIgnoreCase))
            return BadRequest(new { message = "Only pdf format is supported" });

        var generatedBy = User.FindFirst("email")?.Value
            ?? User.Identity?.Name
            ?? userId.ToString();

        var bytes = await _patientSummaryPdfService.GenerateAsync(tenantId, branchId, id, generatedBy);
        if (bytes == null) return NotFound();

        await _auditService.LogDataAccessAsync(userId, "Patient", id, "EXPORT_PDF", "PHI");

        var fileName = $"patient-summary-{id:N}-{DateTime.UtcNow:yyyyMMdd}.pdf";
        return File(bytes, "application/pdf", fileName);
    }

    /// <summary>
    /// Check for duplicate patients before creating a new patient
    /// </summary>
    [HttpPost("check-duplicates")]
    [RequirePermission("patient.view")]
    public async Task<ActionResult<DuplicateCheckResult>> CheckDuplicates([FromBody] DuplicateCheckRequest request)
    {
        var tenantId = User.FindFirst("TenantId")?.Value;
        if (string.IsNullOrEmpty(tenantId)) return Unauthorized();

        var result = await _duplicateDetectionService.CheckDuplicatesAsync(
            request,
            Guid.Parse(tenantId),
            request.ExcludePatientId);

        return Ok(result);
    }

    [HttpPost]
    [RequirePermission("patient.create")]
    public async Task<ActionResult<PatientResponse>> CreatePatient([FromBody] CreatePatientRequest request)
    {
        var tenantId = User.FindFirst("TenantId")?.Value;
        if (string.IsNullOrEmpty(tenantId)) return Unauthorized();

        // Check for duplicates BEFORE creating patient
        var duplicateCheck = await _duplicateDetectionService.CheckDuplicatesAsync(
            new DuplicateCheckRequest
            {
                FirstName = request.FirstName,
                LastName = request.LastName,
                DateOfBirth = request.DateOfBirth,
                ContactNumber = request.ContactNumber,
                Email = request.Email
            },
            Guid.Parse(tenantId)
        );

        // If high-confidence duplicate found (>= 95%), reject creation
        if (duplicateCheck.IsDuplicate && duplicateCheck.Matches.Any(m => m.MatchConfidence >= 0.95m))
        {
            return BadRequest(new
            {
                error = "Duplicate patient detected",
                message = "A patient with very similar details already exists. Please review before creating.",
                duplicates = duplicateCheck.Matches
            });
        }

        var patient = new Patient
        {
            TenantId = Guid.Parse(tenantId),
            MedicalRecordNumber = GenerateMedicalRecordNumber(),
            
            // Phase 6: Extended Demographics
            Title = request.Title,
            FirstName = request.FirstName,
            MiddleName = request.MiddleName,
            LastName = request.LastName,
            DateOfBirth = request.DateOfBirth,
            Nationality = request.Nationality,
            Occupation = request.Occupation,
            MaritalStatus = request.MaritalStatus,
            Religion = request.Religion,
            LanguagePreference = request.LanguagePreference,
            Gender = request.Gender,
            
            // Contact Information
            ContactNumber = request.ContactNumber,
            Email = request.Email,
            Address = request.Address,
            
            // Phase 5: Structured Address
            AddressLine1 = request.AddressLine1,
            AddressLine2 = request.AddressLine2,
            Country = request.Country,
            District = request.District,
            Landmark = request.Landmark,
            PinCode = request.PinCode,
            
            // Medical Information
            BloodGroup = request.BloodGroup,
            Allergies = request.Allergies,
            
            // Phase 4: Enhanced Medical History
            ChronicConditions = request.ChronicConditions,
            CurrentMedications = request.CurrentMedications,
            PastSurgeries = request.PastSurgeries,
            FamilyMedicalHistory = request.FamilyMedicalHistory,
            KnownAllergiesDetails = request.KnownAllergiesDetails,
            ImmunizationRecords = request.ImmunizationRecords,
            DisabilityStatus = request.DisabilityStatus,
            SpecialNeeds = request.SpecialNeeds,
            
            // Phase 8: Lifestyle Fields
            ExerciseHabits = request.ExerciseHabits,
            DietType = request.DietType,
            SmokingStatus = request.SmokingStatus,
            AlcoholUse = request.AlcoholUse,
            LifestyleNotes = request.LifestyleNotes,
            
            // Phase 2: Identity Documents
            HealthId = request.HealthId,
            AadhaarNumber = request.AadhaarNumber,
            NationalId = request.NationalId,
            PassportNumber = request.PassportNumber,
            DrivingLicense = request.DrivingLicense,
            IdProofType = request.IdProofType,
            
            // Phase 3: Guardian Information
            GuardianName = request.GuardianName,
            GuardianRelationship = request.GuardianRelationship,
            GuardianPhone = request.GuardianPhone,
            GuardianEmail = request.GuardianEmail,
            GuardianAddress = request.GuardianAddress,
            GuardianIdProof = request.GuardianIdProof,
            
            // Phase 1: Emergency Contact & Insurance
            EmergencyContactName = request.EmergencyContactName,
            EmergencyContactPhone = request.EmergencyContactPhone,
            EmergencyContactRelationship = request.EmergencyContactRelationship,
            EmergencyContactAddress = request.EmergencyContactAddress,
            EmergencyContactEmail = request.EmergencyContactEmail,
            InsuranceProvider = request.InsuranceProvider,
            InsurancePolicyNumber = request.InsurancePolicyNumber,
            InsuranceGroupNumber = request.InsuranceGroupNumber,
            InsuranceStatus = request.InsuranceStatus,
            InsuranceValidFrom = request.InsuranceValidFrom,
            InsuranceValidTo = request.InsuranceValidTo,
            
            Status = "Active"
        };

        var createdPatient = await _patientService.CreatePatientAsync(patient);
        return CreatedAtAction(nameof(GetPatient), new { id = createdPatient.Id }, MapToResponse(createdPatient));
    }

    [HttpPut("{id}")]
    [RequirePermission("patient.update")]
    public async Task<ActionResult<PatientResponse>> UpdatePatient(Guid id, [FromBody] UpdatePatientRequest request)
    {
        if (id != request.Id) return BadRequest();

        var tenantId = User.FindFirst("TenantId")?.Value;
        if (string.IsNullOrEmpty(tenantId)) return Unauthorized();

        // Check for duplicates when updating (exclude current patient)
        var duplicateCheck = await _duplicateDetectionService.CheckDuplicatesAsync(
            new DuplicateCheckRequest
            {
                FirstName = request.FirstName,
                LastName = request.LastName,
                DateOfBirth = request.DateOfBirth,
                ContactNumber = request.ContactNumber,
                Email = request.Email
            },
            Guid.Parse(tenantId),
            excludePatientId: id // Exclude current patient from duplicate check
        );

        if (duplicateCheck.IsDuplicate && duplicateCheck.Matches.Any(m => m.MatchConfidence >= 0.95m))
        {
            return BadRequest(new
            {
                error = "Duplicate patient detected",
                message = "Updated details match another existing patient.",
                duplicates = duplicateCheck.Matches
            });
        }

        var patient = new Patient
        {
            Id = request.Id,
            TenantId = Guid.Parse(tenantId),
            MedicalRecordNumber = GenerateMedicalRecordNumber(),
            FirstName = request.FirstName,
            LastName = request.LastName,
            DateOfBirth = request.DateOfBirth,
            Gender = request.Gender,
            ContactNumber = request.ContactNumber,
            Email = request.Email,
            Address = request.Address,
            BloodGroup = request.BloodGroup,
            Allergies = request.Allergies
        };

        var updatedPatient = await _patientService.UpdatePatientAsync(patient);
        if (updatedPatient == null) return NotFound();

        return Ok(MapToResponse(updatedPatient));
    }

    [HttpDelete("{id}")]
    [RequirePermission("patient.delete")]
    public async Task<ActionResult> DeletePatient(Guid id)
    {
        var tenantId = User.FindFirst("TenantId")?.Value;
        if (string.IsNullOrEmpty(tenantId)) return Unauthorized();

        var result = await _patientService.DeletePatientAsync(id, Guid.Parse(tenantId));
        if (!result) return NotFound();

        return NoContent();
    }

    /// <summary>
    /// Upload patient photo to Azure Blob Storage
    /// </summary>
    [HttpPost("{id}/photo")]
    [RequirePermission("patient.edit")]
    public async Task<ActionResult> UploadPatientPhoto(Guid id, IFormFile photo)
    {
        try
        {
            var tenantId = User.FindFirst("TenantId")?.Value;
            if (string.IsNullOrEmpty(tenantId)) return Unauthorized();

            // Validate file
            if (photo == null || photo.Length == 0)
                return BadRequest("No photo file provided");

            var maxSizeMB = _configuration.GetValue<int>("AzureBlobStorage:MaxFileSizeMB");
            if (photo.Length > maxSizeMB * 1024 * 1024)
                return BadRequest($"File size exceeds {maxSizeMB}MB limit");

            var allowedTypes = _configuration.GetSection("AzureBlobStorage:AllowedContentTypes").Get<string[]>();
            if (allowedTypes != null && !allowedTypes.Contains(photo.ContentType))
                return BadRequest("Invalid file type. Only JPEG, PNG, and WEBP allowed");

            // Get patient
            var patient = await _patientService.GetPatientByIdAsync(id, Guid.Parse(tenantId));
            if (patient == null)
                return NotFound();

            // Delete old photo if exists
            if (!string.IsNullOrEmpty(patient.PhotoUrl))
            {
                await _blobStorageService.DeleteFileAsync(patient.PhotoUrl);
                if (!string.IsNullOrEmpty(patient.PhotoThumbnailUrl))
                    await _blobStorageService.DeleteFileAsync(patient.PhotoThumbnailUrl);
            }

            // Upload to Azure Blob Storage
            using var stream = photo.OpenReadStream();
            var (photoUrl, thumbnailUrl) = await _blobStorageService.UploadPatientPhotoAsync(
                photo.FileName, stream, photo.ContentType, Guid.Parse(tenantId), id);

            // Update patient record
            patient.PhotoUrl = photoUrl;
            patient.PhotoThumbnailUrl = thumbnailUrl;
            patient.PhotoUploadedAt = DateTime.UtcNow;
            await _patientService.UpdatePatientAsync(patient);

            _logger.LogInformation("Photo uploaded successfully for patient {PatientId}", id);

            return Ok(new
            {
                photoUrl,
                thumbnailUrl,
                uploadedAt = DateTime.UtcNow
            });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error uploading photo for patient {PatientId}", id);
            return StatusCode(500, "Error uploading photo");
        }
    }

    /// <summary>
    /// Delete patient photo from Azure Blob Storage
    /// </summary>
    [HttpDelete("{id}/photo")]
    [RequirePermission("patient.edit")]
    public async Task<ActionResult> DeletePatientPhoto(Guid id)
    {
        try
        {
            var tenantId = User.FindFirst("TenantId")?.Value;
            if (string.IsNullOrEmpty(tenantId)) return Unauthorized();

            var patient = await _patientService.GetPatientByIdAsync(id, Guid.Parse(tenantId));
            if (patient == null)
                return NotFound();

            if (!string.IsNullOrEmpty(patient.PhotoUrl))
            {
                await _blobStorageService.DeleteFileAsync(patient.PhotoUrl);

                if (!string.IsNullOrEmpty(patient.PhotoThumbnailUrl))
                    await _blobStorageService.DeleteFileAsync(patient.PhotoThumbnailUrl);

                patient.PhotoUrl = null;
                patient.PhotoThumbnailUrl = null;
                patient.PhotoUploadedAt = null;
                await _patientService.UpdatePatientAsync(patient);

                _logger.LogInformation("Photo deleted successfully for patient {PatientId}", id);
            }

            return NoContent();
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error deleting photo for patient {PatientId}", id);
            return StatusCode(500, "Error deleting photo");
        }
    }

    [HttpGet("{id}/vitals/latest")]
    [RequirePermission("patient.view")]
    public async Task<ActionResult> GetLatestVitals(Guid id)
    {
        var tenantId = User.FindFirst("TenantId")?.Value;
        if (string.IsNullOrEmpty(tenantId)) return Unauthorized();

        var vitals = await _context.PatientVitalSigns
            .Where(v => v.PatientId == id && v.TenantId == Guid.Parse(tenantId) && v.DeletedAt == null)
            .OrderByDescending(v => v.MeasurementDate)
            .Select(v => new
            {
                bloodPressure = v.BloodPressureSystolic != null && v.BloodPressureDiastolic != null
                    ? $"{v.BloodPressureSystolic}/{v.BloodPressureDiastolic} mmHg"
                    : null,
                heartRate = v.HeartRate,
                temperature = v.Temperature,
                weight = v.WeightKg,
                height = v.HeightCm,
                bmi = v.Bmi,
                oxygenSaturation = v.OxygenSaturation,
                respiratoryRate = v.RespiratoryRate,
                recordedAt = v.MeasurementDate
            })
            .FirstOrDefaultAsync();

        if (vitals == null) return NotFound();
        return Ok(vitals);
    }

    private static PatientResponse MapToResponse(Patient patient)
    {
        return new PatientResponse
        {
            Id = patient.Id,
            MedicalRecordNumber = patient.MedicalRecordNumber,
            Title = patient.Title,
            FirstName = patient.FirstName,
            MiddleName = patient.MiddleName,
            LastName = patient.LastName,
            DateOfBirth = patient.DateOfBirth,
            Nationality = patient.Nationality,
            Occupation = patient.Occupation,
            MaritalStatus = patient.MaritalStatus,
            Religion = patient.Religion,
            LanguagePreference = patient.LanguagePreference,
            Gender = patient.Gender,
            ContactNumber = patient.ContactNumber,
            Email = patient.Email,
            Address = patient.Address,
            AddressLine1 = patient.AddressLine1,
            AddressLine2 = patient.AddressLine2,
            Country = patient.Country,
            District = patient.District,
            Landmark = patient.Landmark,
            PinCode = patient.PinCode,
            BloodGroup = patient.BloodGroup,
            Allergies = patient.Allergies,
            EmergencyContactName = patient.EmergencyContactName,
            EmergencyContactPhone = patient.EmergencyContactPhone,
            EmergencyContactRelationship = patient.EmergencyContactRelationship,
            EmergencyContactEmail = patient.EmergencyContactEmail,
            EmergencyContactAddress = patient.EmergencyContactAddress,
            GuardianName = patient.GuardianName,
            GuardianRelationship = patient.GuardianRelationship,
            GuardianPhone = patient.GuardianPhone,
            GuardianEmail = patient.GuardianEmail,
            GuardianAddress = patient.GuardianAddress,
            PhotoUrl = patient.PhotoUrl,
            PhotoThumbnailUrl = patient.PhotoThumbnailUrl,
            PhotoUploadedAt = patient.PhotoUploadedAt,
            BranchId = patient.BranchId,
            CreatedAt = patient.CreatedAt,
            UpdatedAt = patient.UpdatedAt
        };
    }

    private static string GenerateMedicalRecordNumber()
    {
        // Format: MRN-YYYY-MM-XXXXX
        return $"MRN-{DateTime.UtcNow:yyyy-MM}-{Guid.NewGuid().ToString().Substring(0, 5).ToUpper()}";
    }
}