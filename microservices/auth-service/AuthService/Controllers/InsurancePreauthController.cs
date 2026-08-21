using System;
using System.Linq;
using System.Security.Claims;
using System.Text.Json;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using AuthService.Authorization;
using AuthService.Context;
using AuthService.Models.Domain;

namespace AuthService.Controllers
{
    /// <summary>
    /// Manages the new insurance_preauth_requests table (Migration 67).
    /// Separate from the legacy InsuranceController which uses the old schema.
    /// Workflow: Draft → Applied → UnderReview → Approved | Rejected | PendingDocs | Expired | Cancelled
    /// </summary>
    [Authorize]
    [ApiController]
    [Route("api/insurance-preauth")]
    public class InsurancePreauthController : ControllerBase
    {
        private readonly AppDbContext _context;
        private readonly ILogger<InsurancePreauthController> _logger;

        public InsurancePreauthController(AppDbContext context, ILogger<InsurancePreauthController> logger)
        {
            _context = context;
            _logger = logger;
        }

        private Guid GetTenantId()
        {
            var claim = User.FindFirst("TenantId")?.Value;
            if (string.IsNullOrEmpty(claim) || !Guid.TryParse(claim, out var id))
                throw new UnauthorizedAccessException("Tenant ID not found in token");
            return id;
        }

        private Guid GetCurrentUserId()
        {
            var claim = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            if (string.IsNullOrEmpty(claim) || !Guid.TryParse(claim, out var id))
                throw new UnauthorizedAccessException("User ID not found in token");
            return id;
        }

        // ── GET by session ────────────────────────────────────────────────────

        [HttpGet("session/{sessionId}")]
        [RequirePermission("counseling_sessions.read")]
        public async Task<IActionResult> GetBySession(Guid sessionId)
        {
            try
            {
                var tenantId = GetTenantId();
                var requests = await _context.InsurancePreauthRequests
                    .Where(r => r.SessionId == sessionId
                             && r.TenantId == tenantId
                             && r.DeletedAt == null)
                    .OrderByDescending(r => r.CreatedAt)
                    .Select(r => new
                    {
                        r.Id, r.SessionId, r.ScheduleId, r.PatientId,
                        r.InsuranceProvider, r.TpaName, r.PolicyNumber,
                        r.MemberId, r.GroupNumber, r.PreauthRequestNumber,
                        r.InsurerReferenceNumber, r.ProposedSurgeryName,
                        r.ProposedIcdCode, r.EstimatedCost, r.RequestedAmount,
                        r.PreauthStatus, r.AppliedAt, r.LastStatusChangeAt,
                        r.RespondedAt, r.ExpiryDate, r.ApprovedAmount,
                        r.RejectionReason, r.RejectionCode,
                        r.InsurerContactName, r.InsurerContactPhone,
                        r.InsurerContactEmail, r.Notes, r.DocumentsSubmitted,
                        r.CreatedAt, r.UpdatedAt,
                    })
                    .ToListAsync();
                return Ok(requests);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error fetching preauth requests for session {SessionId}", sessionId);
                return StatusCode(500, new { message = "Error fetching pre-auth requests", error = ex.Message });
            }
        }

        // ── GET single ────────────────────────────────────────────────────────

        [HttpGet("{id}")]
        [RequirePermission("counseling_sessions.read")]
        public async Task<IActionResult> GetById(Guid id)
        {
            try
            {
                var tenantId = GetTenantId();
                var r = await _context.InsurancePreauthRequests
                    .FirstOrDefaultAsync(x => x.Id == id && x.TenantId == tenantId && x.DeletedAt == null);
                if (r == null) return NotFound(new { message = "Pre-auth request not found" });
                return Ok(r);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error fetching preauth request {Id}", id);
                return StatusCode(500, new { message = "Error fetching pre-auth request", error = ex.Message });
            }
        }

        // ── POST create ───────────────────────────────────────────────────────

        [HttpPost]
        [RequirePermission("counseling_sessions.update")]
        [Obsolete("Use CCMS coverage case workflow. Writes are frozen in Phase 2.")]
        public async Task<IActionResult> Create([FromBody] CreatePreauthRequest request)
        {
            var isBypass = Request.Headers.TryGetValue("X-CCMS-Bypass", out var bypassVal)
                && bypassVal.ToString().Equals("true", StringComparison.OrdinalIgnoreCase);
            if (!isBypass)
            {
                _logger.LogWarning(
                    "Blocked legacy insurance-preauth create for session {SessionId}. Use CCMS.",
                    request.SessionId);
                return Conflict(new
                {
                    message = "New insurance pre-authorizations must be created via CCMS.",
                    ccmsRedirect = $"/dashboard/ccms/cases?sessionId={request.SessionId}",
                });
            }

            try
            {
                var tenantId = GetTenantId();
                var userId = GetCurrentUserId();
                var now = DateTime.UtcNow;

                var entry = new InsurancePreauthRequest
                {
                    Id = Guid.NewGuid(),
                    TenantId = tenantId,
                    SessionId = request.SessionId,
                    ScheduleId = request.ScheduleId,
                    PatientId = request.PatientId,
                    InsuranceProvider = request.InsuranceProvider,
                    TpaName = request.TpaName,
                    PolicyNumber = request.PolicyNumber,
                    MemberId = request.MemberId,
                    GroupNumber = request.GroupNumber,
                    ProposedSurgeryName = request.ProposedSurgeryName,
                    ProposedIcdCode = request.ProposedIcdCode,
                    EstimatedCost = request.EstimatedCost,
                    RequestedAmount = request.RequestedAmount,
                    InsurerContactName = request.InsurerContactName,
                    InsurerContactPhone = request.InsurerContactPhone,
                    InsurerContactEmail = request.InsurerContactEmail,
                    Notes = request.Notes,
                    PreauthStatus = "Draft",
                    DocumentsSubmitted = "[]",
                    CreatedByUserId = userId,
                    UpdatedByUserId = userId,
                    CreatedAt = now,
                    UpdatedAt = now,
                };
                _context.InsurancePreauthRequests.Add(entry);
                await _context.SaveChangesAsync();
                return StatusCode(201, new { id = entry.Id, preauthStatus = entry.PreauthStatus });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error creating preauth request");
                return StatusCode(500, new { message = "Error creating pre-auth request", error = ex.Message });
            }
        }

        // ── PATCH status ──────────────────────────────────────────────────────

        [HttpPatch("{id}/status")]
        [RequirePermission("counseling_sessions.update")]
        [Obsolete("Use CCMS coverage case workflow. Writes are frozen in Phase 2.")]
        public async Task<IActionResult> UpdateStatus(Guid id, [FromBody] UpdatePreauthStatusRequest request)
        {
            var isBypass = Request.Headers.TryGetValue("X-CCMS-Bypass", out var bypassVal)
                && bypassVal.ToString().Equals("true", StringComparison.OrdinalIgnoreCase);
            if (!isBypass)
            {
                return Conflict(new
                {
                    message = "Legacy insurance-preauth status updates are frozen. Use CCMS.",
                    ccmsRedirect = "/dashboard/ccms/cases",
                });
            }

            try
            {
                var tenantId = GetTenantId();
                var userId = GetCurrentUserId();
                var now = DateTime.UtcNow;

                var entry = await _context.InsurancePreauthRequests
                    .FirstOrDefaultAsync(r => r.Id == id && r.TenantId == tenantId && r.DeletedAt == null);
                if (entry == null) return NotFound(new { message = "Pre-auth request not found" });

                entry.PreauthStatus = request.Status;
                entry.LastStatusChangeAt = now;
                entry.UpdatedAt = now;
                entry.UpdatedByUserId = userId;

                if (request.Status == "Applied")
                    entry.AppliedAt = now;
                else if (request.Status is "Approved" or "Rejected" or "PendingDocs")
                    entry.RespondedAt = now;
                else if (request.Status == "InitialApproved")
                {
                    entry.InitialApprovalAt = now;
                    if (request.InitialApprovedAmount.HasValue)
                        entry.InitialApprovedAmount = request.InitialApprovedAmount;
                    if (!string.IsNullOrEmpty(request.InitialApprovedBy))
                        entry.InitialApprovedBy = request.InitialApprovedBy;
                }
                else if (request.Status == "FinalApproved")
                {
                    entry.FinalApprovalAt = now;
                    if (request.FinalApprovedAmount.HasValue)
                        entry.FinalApprovedAmount = request.FinalApprovedAmount;
                    if (!string.IsNullOrEmpty(request.FinalApprovedBy))
                        entry.FinalApprovedBy = request.FinalApprovedBy;
                }

                if (request.ApprovedAmount.HasValue)
                    entry.ApprovedAmount = request.ApprovedAmount;
                if (!string.IsNullOrEmpty(request.RejectionReason))
                    entry.RejectionReason = request.RejectionReason;
                if (!string.IsNullOrEmpty(request.RejectionCode))
                    entry.RejectionCode = request.RejectionCode;
                if (request.ExpiryDate.HasValue)
                    entry.ExpiryDate = request.ExpiryDate;
                if (!string.IsNullOrEmpty(request.InsurerReferenceNumber))
                    entry.InsurerReferenceNumber = request.InsurerReferenceNumber;
                if (!string.IsNullOrEmpty(request.Notes))
                    entry.Notes = request.Notes;

                await _context.SaveChangesAsync();
                return Ok(new { id = entry.Id, preauthStatus = entry.PreauthStatus, updatedAt = now });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error updating preauth status for {Id}", id);
                return StatusCode(500, new { message = "Error updating status", error = ex.Message });
            }
        }

        // ── GET by schedule ───────────────────────────────────────────────────

        [HttpGet("schedule/{scheduleId}")]
        [RequirePermission("counseling_sessions.read")]
        public async Task<IActionResult> GetBySchedule(Guid scheduleId)
        {
            try
            {
                var tenantId = GetTenantId();
                var requests = await _context.InsurancePreauthRequests
                    .Where(r => r.ScheduleId == scheduleId
                             && r.TenantId == tenantId
                             && r.DeletedAt == null)
                    .OrderByDescending(r => r.CreatedAt)
                    .Select(r => new
                    {
                        r.Id, r.SessionId, r.ScheduleId, r.PatientId,
                        r.InsuranceProvider, r.TpaName, r.PolicyNumber,
                        r.PreauthStatus, r.AppliedAt, r.LastStatusChangeAt,
                        r.RespondedAt, r.ExpiryDate, r.ApprovedAmount,
                        r.InitialApprovedAmount, r.InitialApprovalAt,
                        r.FinalApprovedAmount, r.FinalApprovalAt,
                        r.RejectionReason, r.Notes, r.DocumentsSubmitted,
                        r.CreatedAt, r.UpdatedAt,
                    })
                    .ToListAsync();
                return Ok(requests);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error fetching preauth requests for schedule {ScheduleId}", scheduleId);
                return StatusCode(500, new { message = "Error fetching pre-auth requests", error = ex.Message });
            }
        }

        // ── POST add document ─────────────────────────────────────────────────

        [HttpPost("{id}/documents")]
        [RequirePermission("counseling_sessions.update")]
        [Obsolete("Use CCMS document domain. Writes are frozen in Phase 2.")]
        public async Task<IActionResult> AddDocument(Guid id, [FromBody] AddPreauthDocumentRequest request)
        {
            var isBypass = Request.Headers.TryGetValue("X-CCMS-Bypass", out var bypassVal)
                && bypassVal.ToString().Equals("true", StringComparison.OrdinalIgnoreCase);
            if (!isBypass)
            {
                return Conflict(new
                {
                    message = "Legacy insurance-preauth document writes are frozen. Use CCMS.",
                    ccmsRedirect = "/dashboard/ccms/cases",
                });
            }

            try
            {
                var tenantId = GetTenantId();
                var userId = GetCurrentUserId();
                var now = DateTime.UtcNow;

                var entry = await _context.InsurancePreauthRequests
                    .FirstOrDefaultAsync(r => r.Id == id && r.TenantId == tenantId && r.DeletedAt == null);
                if (entry == null) return NotFound(new { message = "Pre-auth request not found" });

                var docs = JsonSerializer.Deserialize<System.Collections.Generic.List<object>>(
                    entry.DocumentsSubmitted) ?? new();
                docs.Add(new { name = request.Name, url = request.Url, uploadedAt = now });
                entry.DocumentsSubmitted = JsonSerializer.Serialize(docs);
                entry.UpdatedAt = now;
                entry.UpdatedByUserId = userId;

                await _context.SaveChangesAsync();
                return Ok(new { id = entry.Id, documentCount = docs.Count });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error adding document to preauth {Id}", id);
                return StatusCode(500, new { message = "Error adding document", error = ex.Message });
            }
        }
    }

    // ── DTOs ──────────────────────────────────────────────────────────────────

    public class CreatePreauthRequest
    {
        public Guid SessionId { get; set; }
        public Guid? ScheduleId { get; set; }
        public Guid? PatientId { get; set; }
        public string InsuranceProvider { get; set; } = null!;
        public string? TpaName { get; set; }
        public string PolicyNumber { get; set; } = null!;
        public string? MemberId { get; set; }
        public string? GroupNumber { get; set; }
        public string? ProposedSurgeryName { get; set; }
        public string? ProposedIcdCode { get; set; }
        public decimal? EstimatedCost { get; set; }
        public decimal? RequestedAmount { get; set; }
        public string? InsurerContactName { get; set; }
        public string? InsurerContactPhone { get; set; }
        public string? InsurerContactEmail { get; set; }
        public string? Notes { get; set; }
    }

    public class UpdatePreauthStatusRequest
    {
        public string Status { get; set; } = null!;
        public decimal? ApprovedAmount { get; set; }
        public string? RejectionReason { get; set; }
        public string? RejectionCode { get; set; }
        public DateTime? ExpiryDate { get; set; }
        public string? InsurerReferenceNumber { get; set; }
        public string? Notes { get; set; }
        // InitialApproved / FinalApproved fields (Migration 73)
        public decimal? InitialApprovedAmount { get; set; }
        public string? InitialApprovedBy { get; set; }
        public decimal? FinalApprovedAmount { get; set; }
        public string? FinalApprovedBy { get; set; }
    }

    public class AddPreauthDocumentRequest
    {
        public string Name { get; set; } = null!;
        public string Url { get; set; } = null!;
    }
}
