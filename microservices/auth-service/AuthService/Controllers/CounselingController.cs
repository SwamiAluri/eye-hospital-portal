using System;
using System.Collections.Generic;
using System.Linq;
using System.Security.Claims;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.SignalR;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using AuthService.Authorization;
using AuthService.Context;
using AuthService.Hubs;
using AuthService.Models.Counselor;
using AuthService.Models.Domain;
using AuthService.Models.Identity;
using AuthService.Services;

namespace AuthService.Controllers
{
    [Authorize]
    [ApiController]
    [Route("api/[controller]")]
    public class CounselingController : ControllerBase
    {
        private readonly ICounselingWorkflowService _counselingService;
        private readonly ICounselorCommunicationService _communicationService;
        private readonly IFollowupListService _followupListService;
        private readonly IFollowupBranchAccessService _followupBranchAccess;
        private readonly ICounselingAnalyticsService _analyticsService;
        private readonly ILogger<CounselingController> _logger;
        private readonly IEmailService _emailService;
        private readonly ISmsService _smsService;
        private readonly IHubContext<QueueHub> _queueHub;
        private readonly AppDbContext _context;
        private readonly IOtFinalizeService _otFinalizeService;

        public CounselingController(
            ICounselingWorkflowService counselingService,
            ICounselorCommunicationService communicationService,
            IFollowupListService followupListService,
            IFollowupBranchAccessService followupBranchAccess,
            ICounselingAnalyticsService analyticsService,
            ILogger<CounselingController> logger,
            IEmailService emailService,
            ISmsService smsService,
            IHubContext<QueueHub> queueHub,
            AppDbContext context,
            IOtFinalizeService otFinalizeService)
        {
            _counselingService = counselingService;
            _communicationService = communicationService;
            _followupListService = followupListService;
            _followupBranchAccess = followupBranchAccess;
            _analyticsService = analyticsService;
            _logger = logger;
            _emailService = emailService;
            _smsService = smsService;
            _queueHub = queueHub;
            _context = context;
            _otFinalizeService = otFinalizeService;
        }

        private Guid GetTenantId()
        {
            var tenantIdClaim = User.FindFirst("TenantId")?.Value;
            if (string.IsNullOrEmpty(tenantIdClaim) || !Guid.TryParse(tenantIdClaim, out var tenantId))
            {
                throw new UnauthorizedAccessException("Tenant ID not found in token");
            }
            return tenantId;
        }

        private Guid GetCurrentUserId()
        {
            var userIdClaim = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            if (string.IsNullOrEmpty(userIdClaim) || !Guid.TryParse(userIdClaim, out var userId))
            {
                throw new UnauthorizedAccessException("User ID not found in token");
            }
            return userId;
        }

        /// <summary>Phase 3I Slice 4 — map owner ACL / validation failures to HTTP status.</summary>
        private IActionResult MapSessionOperationResult(SessionOperationResult result)
        {
            if (result.Success)
                return Ok(result);

            return result.FailureKind switch
            {
                SessionOperationFailureKind.Forbidden => StatusCode(
                    StatusCodes.Status403Forbidden, result),
                SessionOperationFailureKind.NotFound => NotFound(result),
                // Phase 3I Slice 7 (PD-S7-06): stale/missing Version → 409, distinct from 403 ownership.
                SessionOperationFailureKind.Conflict => Conflict(result),
                _ => BadRequest(result),
            };
        }

        /// <summary>Safely extracts a string property from a JSON blob; returns null on any error.</summary>
        private static string? ExtractJsonString(string json, string propertyName)
        {
            try
            {
                using var doc = System.Text.Json.JsonDocument.Parse(json);
                if (doc.RootElement.TryGetProperty(propertyName, out var prop))
                    return prop.GetString();
            }
            catch { /* ignore */ }
            return null;
        }

        /// <summary>
        /// Computes upgrade diff (new rate − previous rate) from the packageAddonsJson blob.
        /// Returns null when either rate is missing.
        /// </summary>
        private static decimal? ComputeUpgradeDiff(string json)
        {
            try
            {
                using var doc = System.Text.Json.JsonDocument.Parse(json);
                var root = doc.RootElement;
                if (root.TryGetProperty("rate", out var newRateProp) && newRateProp.TryGetDecimal(out var newRate) &&
                    root.TryGetProperty("previousPackageAmount", out var prevProp) && prevProp.TryGetDecimal(out var prevRate))
                {
                    return newRate - prevRate;
                }
            }
            catch { /* ignore */ }
            return null;
        }

        // ============================================================================
        // COUNSELING SESSIONS
        // ============================================================================

        [HttpGet("sessions")]
        [RequirePermission("counseling_sessions.read")]
        public async Task<IActionResult> GetAllSessions([FromQuery] SessionFilters filters)
        {
            try
            {
                filters.TenantId = GetTenantId();
                // Phase2Z F-04 — always enforce branch authorization (PD16 parity with Analytics/Follow-up).
                var branches = await ResolveFollowupBranchesAsync(filters.BranchId);
                filters.AccessibleBranchIds = branches;
                var response = await _counselingService.GetAllSessionsAsync(filters);
                return Ok(response);
            }
            catch (UnauthorizedAccessException ex)
            {
                return StatusCode(StatusCodes.Status403Forbidden, new { message = ex.Message });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error retrieving counseling sessions");
                return StatusCode(500, new { message = "Error retrieving sessions", error = ex.Message });
            }
        }

        [HttpGet("sessions/{id}")]
        [RequirePermission("counseling_sessions.read")]
        public async Task<IActionResult> GetSessionById(Guid id)
        {
            try
            {
                var tenantId = GetTenantId();
                var session = await _counselingService.GetSessionByIdAsync(tenantId, id);
                
                if (session == null)
                    return NotFound(new { message = "Session not found" });

                // Check whether the linked OT record has been marked SurgeryDone.
                // This overrides the counselling-queue status so the session page
                // can show a read-only "Surgery Completed" banner immediately.
                var hasSurgeryDone = await _context.OtFinalizeSchedules.AnyAsync(o =>
                    o.CounsellingSessionId == id &&
                    o.Status == OtFinalizeStatus.SurgeryDone &&
                    o.DeletedAt == null);
                if (hasSurgeryDone)
                    session.OtStatus = OtFinalizeStatus.SurgeryDone;

                return Ok(session);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error retrieving session {SessionId}", id);
                return StatusCode(500, new { message = "Error retrieving session", error = ex.Message });
            }
        }

        [HttpGet("sessions/by-number/{sessionNumber}")]
        [RequirePermission("counseling_sessions.read")]
        public async Task<IActionResult> GetSessionByNumber(string sessionNumber)
        {
            try
            {
                var tenantId = GetTenantId();
                var session = await _counselingService.GetSessionByNumberAsync(tenantId, sessionNumber);
                
                if (session == null)
                    return NotFound(new { message = "Session not found" });
                
                return Ok(session);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error retrieving session by number {SessionNumber}", sessionNumber);
                return StatusCode(500, new { message = "Error retrieving session", error = ex.Message });
            }
        }

        /// <summary>Get all counseling sessions for a specific patient (for patient history view)</summary>
        [HttpGet("patients/{patientId}/sessions")]
        [RequirePermission("counseling_sessions.read")]
        public async Task<IActionResult> GetPatientSessions(Guid patientId)
        {
            try
            {
                var tenantId = GetTenantId();
                var branches = await ResolveFollowupBranchesAsync(null);
                var filters = new SessionFilters
                {
                    TenantId = tenantId,
                    PatientId = patientId,
                    AccessibleBranchIds = branches,
                    PageSize = 50
                };
                var response = await _counselingService.GetAllSessionsAsync(filters);
                return Ok(response);
            }
            catch (UnauthorizedAccessException ex)
            {
                return StatusCode(StatusCodes.Status403Forbidden, new { message = ex.Message });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error retrieving sessions for patient {PatientId}", patientId);
                return StatusCode(500, new { message = "Error retrieving patient sessions", error = ex.Message });
            }
        }

        [HttpPost("sessions")]
        [RequirePermission("counseling_sessions.create")]
        public async Task<IActionResult> CreateSession([FromBody] CreateCounselingSessionRequest request)
        {
            try
            {
                var tenantId = GetTenantId();
                var currentUserId = GetCurrentUserId();
                
                request.TenantId = tenantId;
                request.BranchId = await _followupBranchAccess.ResolveEffectiveBranchAsync(
                    tenantId, currentUserId, request.BranchId);

                // Reject patients assigned to a branch outside the caller's authorization.
                var patient = await _context.Patients.AsNoTracking()
                    .FirstOrDefaultAsync(p => p.Id == request.PatientId && p.TenantId == tenantId && p.DeletedAt == null);
                if (patient == null)
                    return BadRequest(new { message = "Patient not found in this tenant." });
                if (patient.BranchId.HasValue)
                {
                    var accessible = await _followupBranchAccess.ResolveAccessibleBranchesAsync(
                        tenantId, currentUserId, requestedBranchId: null);
                    if (!accessible.Contains(patient.BranchId.Value))
                    {
                        return StatusCode(StatusCodes.Status403Forbidden,
                            new { message = "Patient belongs to a branch you are not authorized to access." });
                    }
                }
                
                var result = await _counselingService.CreateSessionAsync(request, currentUserId);
                return MapSessionOperationResult(result);
            }
            catch (UnauthorizedAccessException ex)
            {
                return StatusCode(StatusCodes.Status403Forbidden, new { message = ex.Message });
            }
            catch (InvalidOperationException ex)
            {
                return BadRequest(new { message = ex.Message });
            }
            catch (ArgumentException ex)
            {
                return BadRequest(new { message = ex.Message });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error creating counseling session");
                return StatusCode(500, new { message = "Error creating session", error = ex.Message });
            }
        }

        [HttpPut("sessions/{id}")]
        [RequirePermission("counseling_sessions.update")]
        public async Task<IActionResult> UpdateSession(Guid id, [FromBody] UpdateCounselingSessionRequest request)
        {
            try
            {
                var tenantId = GetTenantId();
                var currentUserId = GetCurrentUserId();
                
                var result = await _counselingService.UpdateSessionAsync(tenantId, id, request, currentUserId);
                return MapSessionOperationResult(result);
            }
            catch (ArgumentException ex)
            {
                return BadRequest(new { message = ex.Message });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error updating counseling session {SessionId}", id);
                return StatusCode(500, new { message = "Error updating session", error = ex.Message });
            }
        }

        /// <summary>
        /// Phase 3I Slice 3 — explicit initial ownership assignment (NULL → target counsellor).
        /// Open/view/start do not assign. Permission: counseling_sessions.update (PD-ASSIGN-01).
        /// </summary>
        [HttpPost("sessions/{id}/assign")]
        [RequirePermission("counseling_sessions.update")]
        public async Task<IActionResult> AssignSession(Guid id, [FromBody] AssignCounselingSessionRequest request)
        {
            try
            {
                if (request == null || request.CounselorId == Guid.Empty)
                    return BadRequest(new { message = "CounselorId is required." });

                var tenantId = GetTenantId();
                var actorUserId = GetCurrentUserId();

                var result = await _counselingService.AssignSessionAsync(
                    tenantId, id, request.CounselorId, request.Version, actorUserId);

                if (result.Success)
                    return Ok(result);

                return result.FailureKind switch
                {
                    AssignSessionFailureKind.NotFound => NotFound(new { message = result.Message }),
                    AssignSessionFailureKind.Forbidden => StatusCode(
                        StatusCodes.Status403Forbidden, new { message = result.Message }),
                    AssignSessionFailureKind.Conflict => Conflict(new { message = result.Message }),
                    _ => BadRequest(new { message = result.Message }),
                };
            }
            catch (UnauthorizedAccessException ex)
            {
                return StatusCode(StatusCodes.Status403Forbidden, new { message = ex.Message });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error assigning counseling session {SessionId}", id);
                return StatusCode(500, new { message = "Error assigning session", error = ex.Message });
            }
        }

        /// <summary>
        /// Phase 3I — lifecycle ownership claim (owned → actor) for ReEvaluate / StartRepeat only.
        /// Not general Reassign (PD-REASSIGN-01 / Slice 6). Counsellor actor only.
        /// </summary>
        [HttpPost("sessions/{id}/claim-for-lifecycle")]
        [RequirePermission("counseling_sessions.update")]
        public async Task<IActionResult> ClaimSessionForLifecycle(
            Guid id,
            [FromBody] ClaimCounselingSessionForLifecycleRequest request)
        {
            try
            {
                if (request == null || string.IsNullOrWhiteSpace(request.Intent))
                    return BadRequest(new { message = "Intent is required." });

                var tenantId = GetTenantId();
                var actorUserId = GetCurrentUserId();

                var result = await _counselingService.ClaimSessionForLifecycleAsync(
                    tenantId, id, request.ExpectedCounselorId, request.Intent, request.Version, actorUserId);

                if (result.Success)
                    return Ok(result);

                return result.FailureKind switch
                {
                    AssignSessionFailureKind.NotFound => NotFound(new { message = result.Message }),
                    AssignSessionFailureKind.Forbidden => StatusCode(
                        StatusCodes.Status403Forbidden, new { message = result.Message }),
                    AssignSessionFailureKind.Conflict => Conflict(new { message = result.Message }),
                    _ => BadRequest(new { message = result.Message }),
                };
            }
            catch (UnauthorizedAccessException ex)
            {
                return StatusCode(StatusCodes.Status403Forbidden, new { message = ex.Message });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error claiming counseling session {SessionId} for lifecycle", id);
                return StatusCode(500, new { message = "Error claiming session", error = ex.Message });
            }
        }

        /// <summary>
        /// Phase 3I Slice 6 — supervisory General Reassign (owned A → B).
        /// Permission: counseling_sessions.reassign (not .update). Not Assign; not lifecycle Claim.
        /// </summary>
        [HttpPost("sessions/{id}/reassign")]
        [RequirePermission("counseling_sessions.reassign")]
        public async Task<IActionResult> ReassignSession(
            Guid id,
            [FromBody] ReassignCounselingSessionRequest request)
        {
            try
            {
                if (request == null)
                    return BadRequest(new { message = "Request body is required." });

                if (request.CounselorId == Guid.Empty)
                    return BadRequest(new { message = "CounselorId is required." });

                if (request.ExpectedCounselorId == Guid.Empty)
                    return BadRequest(new { message = "ExpectedCounselorId is required." });

                if (string.IsNullOrWhiteSpace(request.Reason))
                    return BadRequest(new { message = "Reason is required." });

                var tenantId = GetTenantId();
                var actorUserId = GetCurrentUserId();

                var result = await _counselingService.ReassignSessionAsync(
                    tenantId,
                    id,
                    request.CounselorId,
                    request.ExpectedCounselorId,
                    request.Reason,
                    request.Version,
                    actorUserId);

                if (result.Success)
                    return Ok(result);

                return result.FailureKind switch
                {
                    AssignSessionFailureKind.NotFound => NotFound(new { message = result.Message }),
                    AssignSessionFailureKind.Forbidden => StatusCode(
                        StatusCodes.Status403Forbidden, new { message = result.Message }),
                    AssignSessionFailureKind.Conflict => Conflict(new { message = result.Message }),
                    _ => BadRequest(new { message = result.Message }),
                };
            }
            catch (UnauthorizedAccessException ex)
            {
                return StatusCode(StatusCodes.Status403Forbidden, new { message = ex.Message });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error reassigning counseling session {SessionId}", id);
                return StatusCode(500, new { message = "Error reassigning session", error = ex.Message });
            }
        }

        /// <summary>
        /// Persists the counselor's current workflow step for a session.
        /// Called every time the counselor advances to the next step so the
        /// position is remembered across page refreshes.
        /// Body: { "stage": 3 }  (1-based step number, 1–6)
        /// </summary>
        [HttpPut("sessions/{id}/advance-stage")]
        [RequirePermission("counseling_sessions.update")]
        public async Task<IActionResult> AdvanceStage(Guid id, [FromBody] AdvanceStageRequest request)
        {
            try
            {
                if (request.Stage < 1 || request.Stage > 6)
                    return BadRequest(new { message = "Stage must be between 1 and 6." });

                var tenantId = GetTenantId();
                var currentUserId = GetCurrentUserId();

                var updateRequest = new AuthService.Models.Counselor.UpdateCounselingSessionRequest
                {
                    CurrentStage = request.Stage.ToString(),
                    Version = request.Version,
                };

                var result = await _counselingService.UpdateSessionAsync(tenantId, id, updateRequest, currentUserId);
                if (result.Success)
                    return Ok(new { success = true, currentStage = request.Stage.ToString(), version = result.Session?.Version });

                return result.FailureKind switch
                {
                    SessionOperationFailureKind.Forbidden => StatusCode(
                        StatusCodes.Status403Forbidden, new { message = result.Message }),
                    SessionOperationFailureKind.NotFound => NotFound(new { message = result.Message }),
                    // Phase 3I Slice 7 (PD-S7-06): stale/missing Version → 409, distinct from 403 ownership.
                    SessionOperationFailureKind.Conflict => Conflict(new { message = result.Message }),
                    _ => BadRequest(new { message = result.Message }),
                };
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error advancing stage for session {SessionId}", id);
                return StatusCode(500, new { message = "Error advancing stage", error = ex.Message });
            }
        }

        [HttpPost("sessions/{id}/start")]
        [RequirePermission("counseling_sessions.update")]
        public async Task<IActionResult> StartSession(Guid id, [FromBody] StartCounselingSessionRequest? request)
        {
            try
            {
                var tenantId = GetTenantId();
                var currentUserId = GetCurrentUserId();
                
                var result = await _counselingService.StartSessionAsync(tenantId, id, currentUserId, request?.Version, request?.SessionType);
                return MapSessionOperationResult(result);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error starting session {SessionId}", id);
                return StatusCode(500, new { message = "Error starting session", error = ex.Message });
            }
        }

        [HttpPost("sessions/{id}/complete")]
        [RequirePermission("counseling_sessions.update")]
        public async Task<IActionResult> CompleteSession(Guid id, [FromBody] CompleteCounselingSessionRequest? request)
        {
            try
            {
                var tenantId = GetTenantId();
                var currentUserId = GetCurrentUserId();
                
                var result = await _counselingService.CompleteSessionAsync(tenantId, id, currentUserId, request?.Version);
                return MapSessionOperationResult(result);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error completing session {SessionId}", id);
                return StatusCode(500, new { message = "Error completing session", error = ex.Message });
            }
        }

        /// <summary>W-01 — copy latest OPD biometry / procedure onto the session (and journey if present).</summary>
        [HttpPost("sessions/{id}/refresh-from-opd")]
        [RequirePermission("counseling_sessions.update")]
        public async Task<IActionResult> RefreshSessionFromOpd(Guid id, [FromBody] RefreshFromOpdRequest? request)
        {
            try
            {
                var snap = await _otFinalizeService.RefreshSessionFromOpdAsync(id, GetTenantId(), GetCurrentUserId(), request?.Version);
                return Ok(snap);
            }
            catch (ArgumentException ex)
            {
                return BadRequest(new { message = ex.Message });
            }
            // Phase 3I Slice 7 (PD-S7-06): stale Version → 409, checked before the generic NotFound catch below.
            catch (InvalidOperationException ex) when (SessionConcurrency.IsStale(ex))
            {
                return Conflict(new { message = ex.Message });
            }
            catch (InvalidOperationException ex)
            {
                return NotFound(new { message = ex.Message });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error refreshing session {SessionId} from OPD", id);
                return StatusCode(500, new { message = "Error refreshing from OPD", error = ex.Message });
            }
        }

        /// <summary>
        /// Marks the counselling queue item for this session as "AddOnSurgery".
        /// Called by the frontend when a counsellor upgrades the package on a Done session.
        /// The queue item status change is reflected immediately in the waiting list.
        /// </summary>
        [HttpPost("sessions/{id}/addon-surgery")]
        [RequirePermission("counseling_sessions.update")]
        public async Task<IActionResult> MarkAddOnSurgery(Guid id)
        {
            try
            {
                var tenantId      = GetTenantId();
                var currentUserId = GetCurrentUserId();

                var result = await _counselingService.MarkAddOnSurgeryAsync(tenantId, id, currentUserId);
                return MapSessionOperationResult(result);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error marking session {SessionId} as AddOnSurgery", id);
                return StatusCode(500, new { message = "Error marking session as Add-On Surgery", error = ex.Message });
            }
        }

        [HttpPost("sessions/{id}/cancel")]
        [RequirePermission("counseling_sessions.update")]
        public async Task<IActionResult> CancelSession(Guid id, [FromBody] CancelSessionRequest request)
        {
            try
            {
                var tenantId = GetTenantId();
                var currentUserId = GetCurrentUserId();
                
                var result = await _counselingService.CancelSessionAsync(tenantId, id, request.Reason, currentUserId, request.Version);
                return MapSessionOperationResult(result);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error cancelling session {SessionId}", id);
                return StatusCode(500, new { message = "Error cancelling session", error = ex.Message });
            }
        }

        /// <summary>Phase 3I Slice 7 (PD-S7-02) — DELETE body carries expected Version, mirrors
        /// RolesController RemovePermissions convention.</summary>
        [HttpDelete("sessions/{id}")]
        [RequirePermission("counseling_sessions.delete")]
        public async Task<IActionResult> DeleteSession(Guid id, [FromBody] DeleteCounselingSessionRequest? request)
        {
            try
            {
                var tenantId = GetTenantId();
                var currentUserId = GetCurrentUserId();
                
                var result = await _counselingService.DeleteSessionAsync(tenantId, id, currentUserId, request?.Version);
                if (result.Success)
                    return Ok(new { message = result.Message });

                return result.FailureKind switch
                {
                    SessionOperationFailureKind.NotFound => NotFound(new { message = result.Message }),
                    SessionOperationFailureKind.Forbidden => StatusCode(
                        StatusCodes.Status403Forbidden, new { message = result.Message }),
                    SessionOperationFailureKind.Conflict => Conflict(new { message = result.Message }),
                    _ => BadRequest(new { message = result.Message }),
                };
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error deleting session {SessionId}", id);
                return StatusCode(500, new { message = "Error deleting session", error = ex.Message });
            }
        }

        // ============================================================================
        // SESSION HISTORY
        // ============================================================================

        [HttpGet("sessions/{id}/history")]
        [RequirePermission("counseling_sessions.read")]
        public async Task<IActionResult> GetSessionHistory(Guid id)
        {
            try
            {
                var tenantId = GetTenantId();
                var history = await (
                    from h in _context.CounselingSessionAuditLog
                    where h.SessionId == id && h.TenantId == tenantId
                    join u in _context.Users on h.ChangedByUserId equals u.Id into userJoin
                    from u in userJoin.DefaultIfEmpty()
                    orderby h.ChangedAt descending
                    select new SessionAuditEntryDto
                    {
                        Id = h.Id,
                        ChangeType = h.ChangeType,
                        // For FieldChanged entries the Reason column stores the field name.
                        FieldName = h.ChangeType == "FieldChanged" ? h.Reason : null,
                        OldValue = h.OldValue,
                        NewValue = h.NewValue,
                        Reason = h.ChangeType != "FieldChanged" ? h.Reason : null,
                        ChangedByUserId = h.ChangedByUserId,
                        ChangedByName = u != null ? u.FirstName + " " + u.LastName : null,
                        ChangedAt = h.ChangedAt,
                    })
                    .Take(50)
                    .ToListAsync();

                return Ok(history);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error retrieving session history {SessionId}", id);
                return StatusCode(500, new { message = "Error retrieving session history", error = ex.Message });
            }
        }

        // ============================================================================
        // WAITING LIST (Counsellor Desk)
        // ============================================================================

        /// <summary>
        /// Returns today's counselling waiting list for the current tenant.
        /// Joins counselor_queue + counseling_sessions + patient and maps to
        /// the WaitingListPatientDto shape expected by the frontend.
        /// </summary>
        [HttpGet("waiting-list")]
        [RequirePermission("counseling_sessions.read")]
        public async Task<IActionResult> GetWaitingList([FromQuery] WaitingListFiltersRequest filters)
        {
            try
            {
                var tenantId = GetTenantId();

                // Phase 3I Slice 1 — PD16: client branchId is a request filter only.
                // Server-authorized branches are the security boundary (FollowupBranchAccessService).
                // Omitting branchId narrows to authorized set — never tenant-wide fallback.
                // Waiting List remains SHARED: CounselorId / CreatedByUserId are not visibility filters.
                var authorizedBranches = await ResolveFollowupBranchesAsync(filters.BranchId);
                var authorizedBranchIds = authorizedBranches as Guid[] ?? authorizedBranches.ToArray();

                // Date range filter — only applied when explicitly provided.
                // Without dates the full active queue is returned (development
                // seeded data may have non-today timestamps).
                var hasFrom = DateTime.TryParse(filters.FromDate, out var fd);
                var hasTo   = DateTime.TryParse(filters.ToDate,   out var td);
                var fromDate = hasFrom ? fd.Date          : (DateTime?)null;
                var toDate   = hasTo   ? td.Date.AddDays(1) : (DateTime?)null;

                // Pre-fetch the set of counselling session IDs whose OT record is SurgeryDone.
                // Using a separate query + HashSet avoids duplicate rows that a LEFT JOIN would
                // produce when a session has more than one ot_finalize_schedule record.
                var surgeryDoneSessionIds = new HashSet<Guid>(
                    await _context.OtFinalizeSchedules
                        .Where(o => o.TenantId == tenantId &&
                                    o.DeletedAt == null &&
                                    o.Status == OtFinalizeStatus.SurgeryDone &&
                                    o.CounsellingSessionId.HasValue)
                        .Select(o => o.CounsellingSessionId!.Value)
                        .Distinct()
                        .ToListAsync());

                var rawItems = await (
                    from q in _context.CounselorQueue
                    join s in _context.CounselingSession on q.SessionId equals s.Id
                    join p in _context.Patients on q.PatientId equals p.Id
                    join u in _context.Users on s.ReferredByDoctorId equals u.Id into userJoin
                    from u in userJoin.DefaultIfEmpty()
                    join c in _context.Users on s.CounselorId equals c.Id into counselorJoin
                    from c in counselorJoin.DefaultIfEmpty()
                    where q.TenantId == tenantId
                       && q.DeletedAt == null
                       && s.DeletedAt == null
                       && authorizedBranchIds.Contains(q.BranchId)
                       && (fromDate == null || q.AddedToQueueAt >= fromDate)
                       && (toDate   == null || q.AddedToQueueAt <  toDate)
                    orderby q.QueuePosition
                    select new
                    {
                        QueueId   = q.Id,
                        SessionId = s.Id,
                        q.QueuePosition,
                        q.TokenNumber,
                        q.Status,
                        q.UrgencyLevel,
                        q.AddedToQueueAt,
                        QueueBranchId = q.BranchId,
                        s.RecommendedSurgery,
                        s.SurgeryTentativeEye,
                        s.SessionCategory,
                        s.SessionType,
                        s.PatientType,
                        s.PatientAgreedToSurgery,
                        s.AdditionalNotes,
                        s.PackageAddonsJson,
                        s.PackageAmount,
                        s.DecisionDate,
                        s.ReasonsForDelay,
                        s.CounselorId,
                        s.Version,
                        CounselorFirstName = c != null ? c.FirstName : null,
                        CounselorLastName  = c != null ? c.LastName  : null,
                        p.FirstName,
                        p.LastName,
                        p.HealthId,
                        p.MedicalRecordNumber,
                        p.DateOfBirth,
                        p.Gender,
                        DoctorFirstName = u != null ? u.FirstName : null,
                        DoctorLastName  = u != null ? u.LastName  : null,
                    }
                ).ToListAsync();

                var result = rawItems
                    .Select(item =>
                    {
                        var dob = item.DateOfBirth;
                        var age = DateTime.UtcNow.Year - dob.Year;
                        if (dob > DateTime.UtcNow.AddYears(-age)) age--;

                        var doctorName = string.IsNullOrEmpty(item.DoctorFirstName)
                            ? string.Empty
                            : $"Dr. {item.DoctorFirstName} {item.DoctorLastName}".Trim();

                        var remarks = string.Join(" – ",
                            new[] { item.UrgencyLevel, item.AdditionalNotes }
                            .Where(x => !string.IsNullOrWhiteSpace(x)));

                        // Prefer the explicit session_category column; fall back to
                        // the legacy heuristic (non-null surgery name → Surgery).
                        var type = !string.IsNullOrEmpty(item.SessionCategory)
                            ? item.SessionCategory
                            : string.IsNullOrEmpty(item.RecommendedSurgery) ? "Procedure" : "Surgery";

                        var status = item.Status switch
                        {
                            "Waiting"       => "Pending",
                            "Called"        => "Processed",
                            "InProgress"    => "Processed",
                            "AddOnSurgery"  => "AddOnSurgery",
                            "Completed"     => surgeryDoneSessionIds.Contains(item.SessionId)
                                ? "SurgeryDone"
                                : item.PatientAgreedToSurgery == true ? "Done" : "RepeatCounselling",
                            _               => "Pending"
                        };

                        return new WaitingListPatientDto
                        {
                            Id          = item.SessionId.ToString(),
                            SlNo        = item.QueuePosition,
                            Uhid        = !string.IsNullOrEmpty(item.HealthId)
                                              ? item.HealthId
                                              : item.MedicalRecordNumber,
                            PatientName = $"{item.FirstName} {item.LastName}".Trim(),
                            Eye         = item.SurgeryTentativeEye ?? string.Empty,
                            Type        = type,
                            SurgeryName = item.RecommendedSurgery ?? string.Empty,
                            PatientType = item.PatientType,
                            Age         = age,
                            Gender      = string.IsNullOrEmpty(item.Gender)
                                              ? string.Empty
                                              : char.ToUpper(item.Gender[0]) + item.Gender.Substring(1).ToLower(),
                            Doctor      = doctorName,
                            Time        = item.AddedToQueueAt.ToLocalTime().ToString("hh:mm tt"),
                            Remarks     = remarks,
                            Status      = status,
                            // Repeat Counselling follow-up — same SoT as session UI:
                            // DecisionDate → FollowUpDate, ReasonsForDelay → FollowUpReason.
                            FollowUpDate = status == "RepeatCounselling" && item.DecisionDate.HasValue
                                ? item.DecisionDate.Value.ToString("yyyy-MM-dd")
                                : null,
                            FollowUpReason = status == "RepeatCounselling" && !string.IsNullOrWhiteSpace(item.ReasonsForDelay)
                                ? item.ReasonsForDelay
                                : null,
                            // ── AddOnSurgery upgrade info ──────────────────────────────
                            // Parse PackageAddonsJson blob written by handleSave() on the
                            // session page when a Done session's package is upgraded.
                            PreviousPackage = status == "AddOnSurgery" && !string.IsNullOrEmpty(item.PackageAddonsJson)
                                ? ExtractJsonString(item.PackageAddonsJson, "previousPackageName")
                                : null,
                            NewPackage = status == "AddOnSurgery" && !string.IsNullOrEmpty(item.PackageAddonsJson)
                                ? ExtractJsonString(item.PackageAddonsJson, "packageName")
                                : null,
                            UpgradeDiff = status == "AddOnSurgery" && !string.IsNullOrEmpty(item.PackageAddonsJson)
                                ? ComputeUpgradeDiff(item.PackageAddonsJson)
                                : null,
                            CounselorId = item.CounselorId?.ToString(),
                            CounselorName = item.CounselorId.HasValue
                                ? $"{item.CounselorFirstName} {item.CounselorLastName}".Trim()
                                : null,
                            BranchId = item.QueueBranchId.ToString(),
                            Version = item.Version,
                        };
                    })
                    .Where(item =>
                        (string.IsNullOrEmpty(filters.PatientName) ||
                            item.PatientName.Contains(filters.PatientName, StringComparison.OrdinalIgnoreCase)) &&
                        (string.IsNullOrEmpty(filters.Mrd) ||
                            item.Uhid.Contains(filters.Mrd, StringComparison.OrdinalIgnoreCase)) &&
                        (string.IsNullOrEmpty(filters.Type) || filters.Type == "All" ||
                            item.Type == filters.Type) &&
                        (string.IsNullOrEmpty(filters.Status) ||
                            item.Status == filters.Status))
                    .ToList();

                return Ok(result);
            }
            catch (UnauthorizedAccessException ex)
            {
                return StatusCode(StatusCodes.Status403Forbidden, new { message = ex.Message });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error retrieving waiting list");
                return StatusCode(500, new { message = "Error retrieving waiting list", error = ex.Message });
            }
        }

        // ============================================================================
        // SESSION NOTES
        // ============================================================================

        [HttpGet("sessions/{sessionId}/notes")]
        [RequirePermission("session_notes.read")]
        public async Task<IActionResult> GetSessionNotes(Guid sessionId)
        {
            try
            {
                var tenantId = GetTenantId();
                var notes = await _counselingService.GetSessionNotesAsync(tenantId, sessionId);
                return Ok(notes);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error retrieving session notes for {SessionId}", sessionId);
                return StatusCode(500, new { message = "Error retrieving notes", error = ex.Message });
            }
        }

        [HttpGet("notes/{id}")]
        [RequirePermission("session_notes.read")]
        public async Task<IActionResult> GetNoteById(Guid id)
        {
            try
            {
                var tenantId = GetTenantId();
                var note = await _counselingService.GetNoteByIdAsync(tenantId, id);
                
                if (note == null)
                    return NotFound(new { message = "Note not found" });
                
                return Ok(note);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error retrieving note {NoteId}", id);
                return StatusCode(500, new { message = "Error retrieving note", error = ex.Message });
            }
        }

        [HttpPost("notes")]
        [RequirePermission("session_notes.create")]
        public async Task<IActionResult> CreateSessionNote([FromBody] CreateSessionNoteRequest request)
        {
            try
            {
                var tenantId = GetTenantId();
                var currentUserId = GetCurrentUserId();
                
                request.TenantId = tenantId;
                
                var note = await _counselingService.CreateSessionNoteAsync(request, currentUserId);
                return Ok(note);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error creating session note");
                return StatusCode(500, new { message = "Error creating note", error = ex.Message });
            }
        }

        [HttpPut("notes/{id}")]
        [RequirePermission("session_notes.update")]
        public async Task<IActionResult> UpdateSessionNote(Guid id, [FromBody] UpdateSessionNoteRequest request)
        {
            try
            {
                var tenantId = GetTenantId();
                var currentUserId = GetCurrentUserId();
                
                var note = await _counselingService.UpdateSessionNoteAsync(tenantId, id, request, currentUserId);
                return Ok(note);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error updating note {NoteId}", id);
                return StatusCode(500, new { message = "Error updating note", error = ex.Message });
            }
        }

        [HttpDelete("notes/{id}")]
        [RequirePermission("session_notes.delete")]
        public async Task<IActionResult> DeleteSessionNote(Guid id)
        {
            try
            {
                var tenantId = GetTenantId();
                var currentUserId = GetCurrentUserId();
                
                var success = await _counselingService.DeleteSessionNoteAsync(tenantId, id, currentUserId);
                return success ? Ok(new { message = "Note deleted successfully" }) : NotFound(new { message = "Note not found" });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error deleting note {NoteId}", id);
                return StatusCode(500, new { message = "Error deleting note", error = ex.Message });
            }
        }

        // ============================================================================
        // SESSION DOCUMENTS
        // ============================================================================

        [HttpGet("sessions/{sessionId}/documents")]
        [RequirePermission("session_documents.read")]
        public async Task<IActionResult> GetSessionDocuments(Guid sessionId)
        {
            try
            {
                var tenantId = GetTenantId();
                var documents = await _counselingService.GetSessionDocumentsAsync(tenantId, sessionId);
                return Ok(documents);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error retrieving session documents for {SessionId}", sessionId);
                return StatusCode(500, new { message = "Error retrieving documents", error = ex.Message });
            }
        }

        [HttpGet("documents/{id}")]
        [RequirePermission("session_documents.read")]
        public async Task<IActionResult> GetDocumentById(Guid id)
        {
            try
            {
                var tenantId = GetTenantId();
                var document = await _counselingService.GetDocumentByIdAsync(tenantId, id);
                
                if (document == null)
                    return NotFound(new { message = "Document not found" });
                
                return Ok(document);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error retrieving document {DocumentId}", id);
                return StatusCode(500, new { message = "Error retrieving document", error = ex.Message });
            }
        }

        [HttpPost("documents")]
        [RequirePermission("session_documents.create")]
        public async Task<IActionResult> CreateSessionDocument([FromBody] CreateSessionDocumentRequest request)
        {
            try
            {
                var tenantId = GetTenantId();
                var currentUserId = GetCurrentUserId();
                
                request.TenantId = tenantId;
                
                var document = await _counselingService.CreateSessionDocumentAsync(request, currentUserId);
                return Ok(document);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error creating session document");
                return StatusCode(500, new { message = "Error creating document", error = ex.Message });
            }
        }

        [HttpPost("documents/upload")]
        [RequirePermission("session_documents.create")]
        [RequestSizeLimit(104857600)] // 100MB max
        public async Task<IActionResult> UploadSessionDocument(
            [FromForm] string sessionId,
            [FromForm] IFormFile file,
            [FromForm] string? documentType = null,
            [FromForm] string? documentName = null,
            [FromForm] bool isVerified = false,
            [FromForm] string? verificationMethod = null)
        {
            try
            {
                var tenantId = GetTenantId();
                var currentUserId = GetCurrentUserId();

                if (file == null || file.Length == 0)
                    return BadRequest(new { message = "No file provided" });

                // Validate file type (images, PDFs, docs)
                var allowedExtensions = new[] { ".jpg", ".jpeg", ".png", ".gif", ".pdf", ".doc", ".docx" };
                var extension = Path.GetExtension(file.FileName).ToLowerInvariant();
                if (!allowedExtensions.Contains(extension))
                    return BadRequest(new { message = $"File type {extension} not allowed. Allowed: {string.Join(", ", allowedExtensions)}" });

                // Handle mock/temp session IDs — return success without DB write
                var isValidGuid = Guid.TryParse(sessionId, out var sessionGuid);
                bool isMockSession = string.IsNullOrEmpty(sessionId) ||
                    sessionId.StartsWith("temp-") ||
                    sessionId.StartsWith("mock-") ||
                    !isValidGuid;

                if (isMockSession)
                {
                    _logger.LogInformation(
                        "Mock session document upload (not persisted): {FileName} for session '{SessionId}'",
                        file.FileName, sessionId);
                    return Ok(new
                    {
                        message = "Document uploaded successfully (development mode)",
                        isMock = true,
                        fileInfo = new { originalName = file.FileName, size = file.Length, type = file.ContentType }
                    });
                }

                // Real session — create document record
                // TODO: Add actual file storage (Azure Blob, AWS S3, etc.)
                var documentRequest = new CreateSessionDocumentRequest
                {
                    TenantId = tenantId,
                    SessionId = sessionGuid,
                    DocumentType = documentType ?? "General Document",
                    DocumentName = documentName ?? file.FileName,
                    FilePath = $"/documents/{sessionGuid}/{Guid.NewGuid()}{extension}", // Placeholder path
                    FileType = extension.TrimStart('.'),
                    FileSizeBytes = file.Length
                };

                var document = await _counselingService.CreateSessionDocumentAsync(documentRequest, currentUserId);

                _logger.LogInformation(
                    "Document uploaded: {FileName} (Type: {DocumentType}, Size: {FileSize} bytes) for session {SessionId}",
                    file.FileName,
                    documentType,
                    file.Length,
                    sessionGuid);

                return Ok(new
                {
                    message = "Document uploaded successfully",
                    document = document,
                    fileInfo = new
                    {
                        originalName = file.FileName,
                        size = file.Length,
                        type = file.ContentType
                    }
                });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error uploading document");
                return StatusCode(500, new { message = "Error uploading document", error = ex.Message });
            }
        }

        [HttpPost("sessions/{sessionId}/upload-audio")]
        [RequirePermission("session_documents.create")]
        [RequestSizeLimit(104857600)] // 100MB max
        public async Task<IActionResult> UploadSessionAudio(
            Guid sessionId,
            [FromForm] IFormFile audioFile)
        {
            try
            {
                var tenantId = GetTenantId();
                var currentUserId = GetCurrentUserId();

                if (audioFile == null || audioFile.Length == 0)
                    return BadRequest(new { message = "No audio file provided" });

                var document = await _counselingService.UploadSessionAudioAsync(
                    tenantId, 
                    sessionId, 
                    audioFile, 
                    currentUserId);
                
                return Ok(document);
            }
            catch (InvalidOperationException ex)
            {
                _logger.LogWarning(ex, "Invalid audio upload request for session {SessionId}", sessionId);
                return BadRequest(new { message = ex.Message });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error uploading audio for session {SessionId}", sessionId);
                return StatusCode(500, new { message = "Error uploading audio", error = ex.Message });
            }
        }

        [HttpPost("documents/{id}/verify")]
        [RequirePermission("session_documents.verify")]
        public async Task<IActionResult> VerifyDocument(Guid id, [FromBody] VerifyDocumentRequest request)
        {
            try
            {
                var tenantId = GetTenantId();
                var currentUserId = GetCurrentUserId();
                
                var document = await _counselingService.VerifyDocumentAsync(tenantId, id, request, currentUserId);
                return Ok(document);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error verifying document {DocumentId}", id);
                return StatusCode(500, new { message = "Error verifying document", error = ex.Message });
            }
        }

        [HttpDelete("documents/{id}")]
        [RequirePermission("session_documents.delete")]
        public async Task<IActionResult> DeleteSessionDocument(Guid id)
        {
            try
            {
                var tenantId = GetTenantId();
                var currentUserId = GetCurrentUserId();
                
                var success = await _counselingService.DeleteSessionDocumentAsync(tenantId, id, currentUserId);
                return success ? Ok(new { message = "Document deleted successfully" }) : NotFound(new { message = "Document not found" });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error deleting document {DocumentId}", id);
                return StatusCode(500, new { message = "Error deleting document", error = ex.Message });
            }
        }

        // ============================================================================
        // COST ESTIMATE SHARING
        // ============================================================================

        [HttpPost("share/email")]
        [RequirePermission("counseling_sessions.read")]
        public async Task<IActionResult> ShareCostEstimateByEmail([FromBody] ShareCostEstimateEmailRequest request)
        {
            try
            {
                var tenantId = GetTenantId();
                var currentUserId = GetCurrentUserId();

                if (string.IsNullOrEmpty(request.To))
                    return BadRequest(new { message = "Recipient email is required" });

                // Send email with PDF attachment
                var success = await _emailService.SendEmailAsync(
                    request.To,
                    request.Subject ?? "Cost Estimate from Hospital",
                    request.Body ?? "Please find attached the cost estimate for your consultation."
                );

                if (success)
                {
                    _logger.LogInformation(
                        "Cost estimate shared via email to {Email} by user {UserId} in tenant {TenantId}",
                        request.To, currentUserId, tenantId
                    );

                    return Ok(new
                    {
                        success = true,
                        messageId = Guid.NewGuid().ToString(),
                        deliveredAt = DateTime.UtcNow
                    });
                }

                return StatusCode(500, new { success = false, error = "Failed to send email" });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error sharing cost estimate via email");
                return StatusCode(500, new { success = false, error = ex.Message });
            }
        }

        [HttpPost("share/sms")]
        [RequirePermission("counseling_sessions.read")]
        public async Task<IActionResult> ShareCostEstimateBySMS([FromBody] ShareCostEstimateSMSRequest request)
        {
            try
            {
                var tenantId = GetTenantId();
                var currentUserId = GetCurrentUserId();

                if (string.IsNullOrEmpty(request.To))
                    return BadRequest(new { message = "Recipient phone number is required" });

                if (string.IsNullOrEmpty(request.Message))
                    return BadRequest(new { message = "Message content is required" });

                // Send SMS
                var success = await _smsService.SendSmsAsync(request.To, request.Message);

                if (success)
                {
                    _logger.LogInformation(
                        "Cost estimate shared via SMS to {Phone} by user {UserId} in tenant {TenantId}",
                        request.To, currentUserId, tenantId
                    );

                    return Ok(new
                    {
                        success = true,
                        messageId = Guid.NewGuid().ToString(),
                        deliveredAt = DateTime.UtcNow
                    });
                }

                return StatusCode(500, new { success = false, error = "Failed to send SMS" });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error sharing cost estimate via SMS");
                return StatusCode(500, new { success = false, error = ex.Message });
            }
        }

        [HttpPost("share/whatsapp")]
        [RequirePermission("counseling_sessions.read")]
        public async Task<IActionResult> ShareCostEstimateByWhatsApp([FromBody] ShareCostEstimateWhatsAppRequest request)
        {
            try
            {
                var tenantId = GetTenantId();
                var currentUserId = GetCurrentUserId();

                if (string.IsNullOrEmpty(request.To))
                    return BadRequest(new { message = "Recipient phone number is required" });

                if (string.IsNullOrEmpty(request.Message))
                    return BadRequest(new { message = "Message content is required" });

                // For now, use SMS service for WhatsApp (WhatsApp Business API integration needed)
                // TODO: Implement WhatsApp Business API integration
                var success = await _smsService.SendSmsAsync(request.To, request.Message);

                if (success)
                {
                    _logger.LogInformation(
                        "Cost estimate shared via WhatsApp to {Phone} by user {UserId} in tenant {TenantId}",
                        request.To, currentUserId, tenantId
                    );

                    return Ok(new
                    {
                        success = true,
                        messageId = Guid.NewGuid().ToString(),
                        deliveredAt = DateTime.UtcNow
                    });
                }

                return StatusCode(500, new { success = false, error = "Failed to send WhatsApp message" });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error sharing cost estimate via WhatsApp");
                return StatusCode(500, new { success = false, error = ex.Message });
            }
        }

        // ============================================================================
        // COMMUNICATION LOGS  — Phase B
        // ============================================================================

        [HttpGet("sessions/{sessionId}/communication-logs")]
        [RequirePermission("counseling_sessions.read")]
        public async Task<IActionResult> GetCommLogs(Guid sessionId)
        {
            try
            {
                var tenantId = GetTenantId();
                var logs = await _communicationService.GetCommLogsAsync(sessionId, tenantId);
                return Ok(logs);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error retrieving comm logs for session {SessionId}", sessionId);
                return StatusCode(500, new { message = "Error retrieving communication logs", error = ex.Message });
            }
        }

        [HttpPost("sessions/{sessionId}/communication-logs")]
        [RequirePermission("counseling_sessions.update")]
        public async Task<IActionResult> AddCommLog(Guid sessionId, [FromBody] CreateCommLogRequest request)
        {
            try
            {
                var tenantId    = GetTenantId();
                var counselorId = GetCurrentUserId();
                var log = await _communicationService.AddCommLogAsync(sessionId, request, tenantId, counselorId);
                return StatusCode(201, log);
            }
            catch (ArgumentException ex)
            {
                return BadRequest(new { message = ex.Message });
            }
            // Phase 3I Slice 7 (PD-S7-06 / M18): stale Version → 409, checked before the generic NotFound catch below.
            catch (InvalidOperationException ex) when (SessionConcurrency.IsStale(ex))
            {
                return Conflict(new { message = ex.Message });
            }
            catch (InvalidOperationException ex)
            {
                return NotFound(new { message = ex.Message });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error adding comm log for session {SessionId}", sessionId);
                return StatusCode(500, new { message = "Error adding communication log", error = ex.Message });
            }
        }

        // ============================================================================
        // CALLBACK REQUESTS  — Phase B
        // ============================================================================

        [HttpGet("callbacks")]
        [RequirePermission("counseling_sessions.read")]
        public async Task<IActionResult> GetCallbacks(
            [FromQuery] Guid? branchId,
            [FromQuery] DateTime? date,
            [FromQuery] string? status)
        {
            try
            {
                var tenantId = GetTenantId();
                var callbacks = await _communicationService.GetCallbacksAsync(tenantId, branchId, date, status);
                return Ok(callbacks);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error retrieving callbacks");
                return StatusCode(500, new { message = "Error retrieving callbacks", error = ex.Message });
            }
        }

        [HttpPost("sessions/{sessionId}/callbacks")]
        [RequirePermission("counseling_sessions.update")]
        public async Task<IActionResult> ScheduleCallback(Guid sessionId, [FromBody] ScheduleCallbackRequest request)
        {
            try
            {
                var tenantId = GetTenantId();
                var userId   = GetCurrentUserId();
                var cb = await _communicationService.ScheduleCallbackAsync(sessionId, request, tenantId, userId);
                return StatusCode(201, cb);
            }
            catch (InvalidOperationException ex)
            {
                return NotFound(new { message = ex.Message });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error scheduling callback for session {SessionId}", sessionId);
                return StatusCode(500, new { message = "Error scheduling callback", error = ex.Message });
            }
        }

        [HttpPatch("callbacks/{callbackId}/complete")]
        [RequirePermission("counseling_sessions.update")]
        public async Task<IActionResult> CompleteCallback(Guid callbackId, [FromBody] CompleteCallbackRequest request)
        {
            try
            {
                var tenantId = GetTenantId();
                var userId   = GetCurrentUserId();
                var cb = await _communicationService.CompleteCallbackAsync(callbackId, request, tenantId, userId);
                return Ok(cb);
            }
            catch (InvalidOperationException ex)
            {
                return NotFound(new { message = ex.Message });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error completing callback {CallbackId}", callbackId);
                return StatusCode(500, new { message = "Error completing callback", error = ex.Message });
            }
        }

        [HttpPatch("callbacks/{callbackId}/reschedule")]
        [RequirePermission("counseling_sessions.update")]
        public async Task<IActionResult> RescheduleCallback(Guid callbackId, [FromBody] RescheduleCallbackRequest request)
        {
            try
            {
                var tenantId = GetTenantId();
                var userId   = GetCurrentUserId();
                var cb = await _communicationService.RescheduleCallbackAsync(callbackId, request, tenantId, userId);
                return Ok(cb);
            }
            catch (InvalidOperationException ex)
            {
                return NotFound(new { message = ex.Message });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error rescheduling callback {CallbackId}", callbackId);
                return StatusCode(500, new { message = "Error rescheduling callback", error = ex.Message });
            }
        }

        // ============================================================================
        // OVERDUE SESSIONS  — Phase B
        // ============================================================================

        [HttpGet("followups/overdue")]
        [RequirePermission("counseling_sessions.read")]
        public async Task<IActionResult> GetOverdueSessions(
            [FromQuery] Guid? branchId,
            [FromQuery] int days = 7)
        {
            try
            {
                var tenantId = GetTenantId();
                var sessions = await _communicationService.GetOverdueSessionsAsync(tenantId, branchId, days);
                return Ok(sessions);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error retrieving overdue sessions");
                return StatusCode(500, new { message = "Error retrieving overdue sessions", error = ex.Message });
            }
        }

        // ============================================================================
        // QUICK-BOOK SURGERY FROM COUNSELING SESSION  — Phase B
        // ============================================================================

        [HttpPost("sessions/{sessionId}/quick-book-surgery")]
        [RequirePermission("counseling_sessions.update")]
        public async Task<IActionResult> QuickBookSurgery(Guid sessionId, [FromBody] QuickBookFromSessionRequest request)
        {
            try
            {
                var tenantId = GetTenantId();
                var userId   = GetCurrentUserId();
                var result = await _communicationService.QuickBookFromSessionAsync(sessionId, request, tenantId, userId);
                return StatusCode(201, result);
            }
            // Phase 3I Slice 7 (PD-S7-06 / M15): stale Version → 409, checked before the generic BadRequest catch below.
            catch (InvalidOperationException ex) when (SessionConcurrency.IsStale(ex))
            {
                return Conflict(new { success = false, message = ex.Message });
            }
            catch (InvalidOperationException ex)
            {
                return BadRequest(new { success = false, message = ex.Message });
            }
            catch (ArgumentException ex)
            {
                return BadRequest(new { success = false, message = ex.Message });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error quick-booking surgery for session {SessionId}", sessionId);
                return StatusCode(500, new { success = false, message = "Error booking surgery", error = ex.Message });
            }
        }

        // ============================================================================
        // FOLLOW-UP CENTER  — Phase F + Phase 2B (search / filtered total / stats)
        // Active Follow-ups, Cold Leads, Post-Surgery tracking
        // ============================================================================

        /// <summary>
        /// GET /api/Counseling/followups/active — Active PatientIntention allowlist.
        /// Query: branchId?, intention?, q?, page, pageSize.
        /// total = count after population + authorized branch scope + intention + q (not page size).
        /// Phase2X PD16: branchId is a filter within server-authorized branches only.
        /// </summary>
        [HttpGet("followups/active")]
        [RequirePermission("counseling_sessions.read")]
        public async Task<IActionResult> GetActiveFollowups(
            [FromQuery] Guid? branchId,
            [FromQuery] string? intention,
            [FromQuery] string? q,
            [FromQuery] int page = 1,
            [FromQuery] int pageSize = 20)
        {
            try
            {
                var branches = await ResolveFollowupBranchesAsync(branchId);
                var result = await _followupListService.GetActiveAsync(
                    GetTenantId(), branches, intention, q, page, pageSize);
                return Ok(result);
            }
            catch (UnauthorizedAccessException ex)
            {
                return StatusCode(StatusCodes.Status403Forbidden, new { message = ex.Message });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error retrieving active follow-ups");
                return StatusCode(500, new { message = "Error retrieving active follow-ups", error = ex.Message });
            }
        }

        /// <summary>
        /// GET /api/Counseling/followups/cold-leads — Declined / ReferredElsewhere.
        /// Query: branchId?, q?, page, pageSize.
        /// Phase2X PD16: branchId is a filter within server-authorized branches only.
        /// </summary>
        [HttpGet("followups/cold-leads")]
        [RequirePermission("counseling_sessions.read")]
        public async Task<IActionResult> GetColdLeads(
            [FromQuery] Guid? branchId,
            [FromQuery] string? q,
            [FromQuery] int page = 1,
            [FromQuery] int pageSize = 20)
        {
            try
            {
                var branches = await ResolveFollowupBranchesAsync(branchId);
                var result = await _followupListService.GetColdLeadsAsync(
                    GetTenantId(), branches, q, page, pageSize);
                return Ok(result);
            }
            catch (UnauthorizedAccessException ex)
            {
                return StatusCode(StatusCodes.Status403Forbidden, new { message = ex.Message });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error retrieving cold leads");
                return StatusCode(500, new { message = "Error retrieving cold leads", error = ex.Message });
            }
        }

        /// <summary>
        /// GET /api/Counseling/followups/post-surgery — discharged patient_journey rows.
        /// Query: branchId?, q?, page, pageSize.
        /// Phase2X PD16: branchId is a filter within server-authorized branches only.
        /// </summary>
        [HttpGet("followups/post-surgery")]
        [RequirePermission("counseling_sessions.read")]
        public async Task<IActionResult> GetPostSurgeryFollowups(
            [FromQuery] Guid? branchId,
            [FromQuery] string? q,
            [FromQuery] int page = 1,
            [FromQuery] int pageSize = 20)
        {
            try
            {
                var branches = await ResolveFollowupBranchesAsync(branchId);
                var result = await _followupListService.GetPostSurgeryAsync(
                    GetTenantId(), branches, q, page, pageSize);
                return Ok(result);
            }
            catch (UnauthorizedAccessException ex)
            {
                return StatusCode(StatusCodes.Status403Forbidden, new { message = ex.Message });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error retrieving post-surgery follow-ups");
                return StatusCode(500, new { message = "Error retrieving post-surgery follow-ups", error = ex.Message });
            }
        }

        /// <summary>
        /// GET /api/Counseling/followups/stats — server aggregates for Follow-up Center KPIs.
        /// Filters: branchId?, intention? (Active only), q?.
        /// Scope is always the filtered population (same predicates as list endpoints), never the current page.
        /// Does not implement due-date windows. Includes orphan-intention audit counts (not a queue).
        /// Phase2X PD16: branchId is a filter within server-authorized branches only.
        /// </summary>
        [HttpGet("followups/stats")]
        [RequirePermission("counseling_sessions.read")]
        public async Task<IActionResult> GetFollowupStats(
            [FromQuery] Guid? branchId,
            [FromQuery] string? intention,
            [FromQuery] string? q)
        {
            try
            {
                var branches = await ResolveFollowupBranchesAsync(branchId);
                var result = await _followupListService.GetStatsAsync(
                    GetTenantId(), branches, branchId, intention, q);
                return Ok(result);
            }
            catch (UnauthorizedAccessException ex)
            {
                return StatusCode(StatusCodes.Status403Forbidden, new { message = ex.Message });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error retrieving follow-up stats");
                return StatusCode(500, new { message = "Error retrieving follow-up stats", error = ex.Message });
            }
        }

        /// <summary>PD16 — resolve authorized branch scope (never trust client branchId alone).</summary>
        private Task<IReadOnlyList<Guid>> ResolveFollowupBranchesAsync(Guid? requestedBranchId)
            => _followupBranchAccess.ResolveAccessibleBranchesAsync(
                GetTenantId(), GetCurrentUserId(), requestedBranchId);

        /// <summary>
        /// Phase 3I Slice 8 — POST /api/Counseling/sessions/{id}/re-queue
        /// Clears CounselorId → NULL, ensures one active Waiting, dual-trails OwnershipRequeued when owned.
        /// Permission: counseling_sessions.update (PD-S8-03/16). Branch authorization enforced in service.
        /// </summary>
        [HttpPost("sessions/{id}/re-queue")]
        [RequirePermission("counseling_sessions.update")]
        public async Task<IActionResult> ReQueueSession(Guid id, [FromBody] ReQueueSessionRequest request)
        {
            try
            {
                if (request == null)
                    return BadRequest(new { message = "Request body is required." });

                if (string.IsNullOrWhiteSpace(request.Reason))
                    return BadRequest(new { message = "Reason is required." });

                var tenantId = GetTenantId();
                var userId = GetCurrentUserId();

                var result = await _counselingService.ReQueueSessionAsync(
                    tenantId,
                    id,
                    request.Version,
                    request.ExpectedCounselorId,
                    request.Reason,
                    request.NewIntention,
                    request.Notes,
                    request.SessionType,
                    userId);

                if (result.Success)
                {
                    return Ok(new
                    {
                        success = true,
                        tokenNumber = result.TokenNumber,
                        queueItemId = result.QueueItemId,
                        message = result.Message,
                        counselorId = result.CounselorId,
                        version = result.Version,
                    });
                }

                return result.FailureKind switch
                {
                    AssignSessionFailureKind.NotFound => NotFound(new { message = result.Message }),
                    AssignSessionFailureKind.Forbidden => StatusCode(
                        StatusCodes.Status403Forbidden, new { message = result.Message }),
                    AssignSessionFailureKind.Conflict => Conflict(new { message = result.Message }),
                    _ => BadRequest(new { message = result.Message }),
                };
            }
            catch (UnauthorizedAccessException ex)
            {
                return StatusCode(StatusCodes.Status403Forbidden, new { message = ex.Message });
            }
            catch (ArgumentException ex)
            {
                return BadRequest(new { message = ex.Message });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error re-queuing session {Id}", id);
                return StatusCode(500, new { message = "Error re-queuing patient" });
            }
        }

        /// <summary>POST /api/Counseling/patients/{patientId}/reminders — log a sent reminder (SMS/WhatsApp/Email) for a patient.</summary>
        [HttpPost("patients/{patientId}/reminders")]
        [RequirePermission("counseling_sessions.update")]
        public async Task<IActionResult> SendReminder(Guid patientId, [FromBody] SendReminderRequest request)
        {
            try
            {
                var tenantId = GetTenantId();
                var userId   = GetCurrentUserId();

                // Resolve to latest session so the log is attached to something meaningful
                var session = await _context.CounselingSession
                    .Where(s => s.PatientId == patientId && s.TenantId == tenantId && s.DeletedAt == null)
                    .OrderByDescending(s => s.CreatedAt)
                    .FirstOrDefaultAsync();

                // Build comm-log entry regardless of whether a session exists.
                // Outcome/NextAction must satisfy migration-69 CHECKs (not free-form master codes).
                if (session != null)
                {
                    var log = new CounselorCommunicationLog
                    {
                        Id                = Guid.NewGuid(),
                        TenantId          = tenantId,
                        SessionId         = session.Id,
                        PatientId         = patientId,
                        CounselorId       = userId,
                        Channel           = request.Channel,
                        Direction         = "Outbound",
                        CommunicationAt   = DateTime.UtcNow,
                        Outcome           = "MessageSent",
                        MessageBody       = request.Message,
                        ResponseSummary   = string.IsNullOrWhiteSpace(request.MessageType)
                            ? null
                            : $"ReminderType:{request.MessageType.Trim()}",
                        NextAction        = "NoFurtherAction",
                        Status            = "active",
                        CreatedAt         = DateTime.UtcNow,
                        UpdatedAt         = DateTime.UtcNow,
                        CreatedByUserId   = userId,
                        UpdatedByUserId   = userId,
                    };
                    _context.CounselorCommunicationLogs.Add(log);
                    await _context.SaveChangesAsync();
                }

                return Ok(new
                {
                    success         = true,
                    loggedToSession = session != null,
                    channel         = request.Channel,
                    messageType     = request.MessageType,
                    sentAt          = DateTime.UtcNow,
                    message         = $"Reminder logged via {request.Channel}"
                });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error sending reminder for patient {PatientId}", patientId);
                return StatusCode(500, new { message = "Error sending reminder", error = ex.Message });
            }
        }

        // ============================================================================
        // ANALYTICS — Phase E + Phase 2D (shared date window, counselorId, from/to)
        // ============================================================================

        /// <summary>
        /// GET /api/Counseling/surgeons — referring-surgeon dropdown for Add Patient / OT counselling.
        /// Uses counseling_sessions.read (not user.view). Same least-privilege pattern as GetCounselors.
        /// Does not invent a new IAM permission. UsersController /users/surgeons remains user.view.
        /// </summary>
        [HttpGet("surgeons")]
        [RequirePermission("counseling_sessions.read")]
        public async Task<IActionResult> GetSurgeons()
        {
            try
            {
                var tenantId = GetTenantId();

                var surgeons = await (
                    from ur in _context.UserRoles.Cast<AppUserRole>()
                    join u in _context.Users on ur.UserId equals u.Id
                    join r in _context.Roles on ur.RoleId equals r.Id
                    where u.TenantId == tenantId
                          && u.DeletedAt == null
                          && ur.IsActive
                          && r.NormalizedName != null
                          && (r.NormalizedName.Contains("DOCTOR")
                              || r.NormalizedName.Contains("SURGEON")
                              || r.NormalizedName.Contains("OPHTHAL"))
                    select new
                    {
                        id = u.Id,
                        name = ((u.FirstName ?? "") + " " + (u.LastName ?? "")).Trim(),
                        specialization = u.Specialization ?? "Ophthalmology",
                        jobTitle = r.Name,
                        email = u.Email,
                        phone = u.PhoneNumber,
                    }
                ).Distinct().OrderBy(s => s.name).ToListAsync();

                if (surgeons.Count == 0)
                {
                    surgeons = await _context.Users
                        .AsNoTracking()
                        .Where(u => u.TenantId == tenantId
                                    && u.DeletedAt == null
                                    && (u.UserType == "Doctor"
                                        || u.UserType == "Surgeon"
                                        || u.UserType == "Ophthalmologist"))
                        .Select(u => new
                        {
                            id = u.Id,
                            name = ((u.FirstName ?? "") + " " + (u.LastName ?? "")).Trim(),
                            specialization = u.Specialization ?? "Ophthalmology",
                            jobTitle = u.UserType,
                            email = u.Email,
                            phone = u.PhoneNumber,
                        })
                        .OrderBy(s => s.name)
                        .ToListAsync();
                }

                return Ok(surgeons);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error retrieving surgeons for counselling desk");
                return StatusCode(500, new { message = "Error retrieving surgeons", error = ex.Message });
            }
        }

        /// <summary>
        /// GET /api/Counseling/anesthetists — anaesthetist dropdown for Finalize OT.
        /// Uses counseling_sessions.read (not user.view). Same least-privilege pattern as GetSurgeons.
        /// Does not invent a new IAM permission. UsersController anesthetists endpoint remains user.view.
        /// </summary>
        [HttpGet("anesthetists")]
        [RequirePermission("counseling_sessions.read")]
        public async Task<IActionResult> GetAnesthetists()
        {
            try
            {
                var tenantId = GetTenantId();

                // Primary: users with anaesthesia-related role (US + UK spellings)
                var anesthetists = await (
                    from ur in _context.UserRoles.Cast<AppUserRole>()
                    join u in _context.Users on ur.UserId equals u.Id
                    join r in _context.Roles on ur.RoleId equals r.Id
                    where u.TenantId == tenantId
                          && u.DeletedAt == null
                          && ur.IsActive
                          && r.NormalizedName != null
                          && (r.NormalizedName.Contains("ANESTHET")
                              || r.NormalizedName.Contains("ANAESTHET")
                              || r.NormalizedName.Contains("ANESTHES"))
                    select new
                    {
                        id = u.Id,
                        name = ((u.FirstName ?? "") + " " + (u.LastName ?? "")).Trim(),
                        employeeId = u.EmployeeId ?? "",
                        specialization = u.Specialization ?? "",
                        jobTitle = r.Name,
                    }
                ).Distinct().OrderBy(a => a.name).ToListAsync();

                // Fallback: UserType / Designation fields (US + UK spellings)
                if (anesthetists.Count == 0)
                {
                    anesthetists = await _context.Users
                        .AsNoTracking()
                        .Where(u => u.TenantId == tenantId
                                    && u.DeletedAt == null
                                    && (
                                        u.UserType == "Anesthesiologist"
                                        || u.UserType == "Anesthetist"
                                        || u.UserType == "Anaesthetist"
                                        || u.UserType == "Anaesthesiologist"
                                        || (u.Designation != null && (
                                            u.Designation.Contains("Anesthet")
                                            || u.Designation.Contains("Anaesthet")
                                            || u.Designation.Contains("Anesthes")))
                                        || (u.Specialization != null && (
                                            u.Specialization.Contains("Anesthet")
                                            || u.Specialization.Contains("Anaesthet")
                                            || u.Specialization.Contains("Anesthes")))
                                    ))
                        .Select(u => new
                        {
                            id = u.Id,
                            name = ((u.FirstName ?? "") + " " + (u.LastName ?? "")).Trim(),
                            employeeId = u.EmployeeId ?? "",
                            specialization = u.Specialization ?? "",
                            jobTitle = u.Designation ?? u.UserType,
                        })
                        .OrderBy(a => a.name)
                        .ToListAsync();
                }

                return Ok(anesthetists);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error retrieving anesthetists for counselling desk");
                return StatusCode(500, new { message = "Error retrieving anesthetists", error = ex.Message });
            }
        }

        /// <summary>
        /// GET /api/Counseling/theaters — OT theater dropdown for Schedule Surgery / Finalize OT.
        /// Uses counseling_sessions.read (not ot.theaters.view). Same least-privilege pattern as GetSurgeons.
        /// Does not invent a new IAM permission. OTBookingController /otbooking/theaters remains ot.theaters.view.
        /// Tenant + authorized-branch filtered; client branchId is not a security bypass.
        /// </summary>
        [HttpGet("theaters")]
        [RequirePermission("counseling_sessions.read")]
        public async Task<IActionResult> GetTheaters([FromQuery] Guid? branchId = null)
        {
            try
            {
                var tenantId = GetTenantId();
                var userId = GetCurrentUserId();

                IReadOnlyList<Guid> accessibleBranches;
                try
                {
                    accessibleBranches = await _followupBranchAccess.ResolveAccessibleBranchesAsync(
                        tenantId, userId, branchId);
                }
                catch (UnauthorizedAccessException ex)
                {
                    return StatusCode(StatusCodes.Status403Forbidden, new { message = ex.Message });
                }

                if (accessibleBranches.Count == 0)
                {
                    return Ok(Array.Empty<object>());
                }

                var branchSet = accessibleBranches.ToHashSet();
                var theaters = await _context.OTTheaters
                    .AsNoTracking()
                    .Where(t => t.TenantId == tenantId
                                && t.DeletedAt == null
                                && t.IsActive
                                && branchSet.Contains(t.BranchId))
                    .OrderBy(t => t.TheaterName)
                    .Select(t => new
                    {
                        id = t.Id,
                        theaterName = t.TheaterName,
                        theaterCode = t.TheaterCode,
                        branchId = t.BranchId,
                    })
                    .ToListAsync();

                return Ok(theaters);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error retrieving theaters for counselling desk");
                return StatusCode(500, new { message = "Error retrieving theaters", error = ex.Message });
            }
        }

        /// <summary>
        /// GET /api/Counseling/counselors — counsellor picker (Analytics + Assign).
        /// Uses counseling_sessions.read (not user.view). Optional branchId narrows discovery
        /// to counsellors with membership on that branch (UX only — Assign validates server-side).
        /// </summary>
        [HttpGet("counselors")]
        [RequirePermission("counseling_sessions.read")]
        public async Task<IActionResult> GetCounselors([FromQuery] Guid? branchId = null)
        {
            try
            {
                var tenantId = GetTenantId();

                // When branchId is supplied, ensure the caller may request that branch scope.
                if (branchId.HasValue)
                {
                    await ResolveFollowupBranchesAsync(branchId);
                }

                var counselors = await (
                    from ur in _context.UserRoles.Cast<AppUserRole>()
                    join u in _context.Users on ur.UserId equals u.Id
                    join r in _context.Roles on ur.RoleId equals r.Id
                    where u.TenantId == tenantId
                          && u.DeletedAt == null
                          && ur.IsActive
                          && r.NormalizedName != null
                          && r.NormalizedName.Contains("COUNSEL")
                          // Phase 3I Slice 12 (PD-S12-17) — exclude unavailable ownership targets from picker.
                          && (u.UserStatus == null
                              || (u.UserStatus.ToLower() != "inactive"
                                  && u.UserStatus.ToLower() != "suspended"))
                    select new
                    {
                        id = u.Id,
                        firstName = u.FirstName ?? "",
                        lastName = u.LastName ?? "",
                        name = ((u.FirstName ?? "") + " " + (u.LastName ?? "")).Trim(),
                        email = u.Email,
                        primaryBranchId = u.BranchId,
                    }
                ).Distinct().OrderBy(c => c.name).ToListAsync();

                if (counselors.Count == 0)
                {
                    counselors = await _context.Users
                        .AsNoTracking()
                        .Where(u => u.TenantId == tenantId
                                    && u.DeletedAt == null
                                    && (u.UserStatus == null
                                        || (u.UserStatus.ToLower() != "inactive"
                                            && u.UserStatus.ToLower() != "suspended"))
                                    && (
                                        (u.UserType != null && u.UserType.ToLower().Contains("counsel"))
                                        || (u.Designation != null && u.Designation.ToLower().Contains("counsel"))
                                    ))
                        .Select(u => new
                        {
                            id = u.Id,
                            firstName = u.FirstName ?? "",
                            lastName = u.LastName ?? "",
                            name = ((u.FirstName ?? "") + " " + (u.LastName ?? "")).Trim(),
                            email = u.Email,
                            primaryBranchId = u.BranchId,
                        })
                        .OrderBy(c => c.name)
                        .ToListAsync();
                }

                if (branchId.HasValue)
                {
                    var now = DateTime.UtcNow;
                    var branchMemberIds = await _context.UserBranches
                        .AsNoTracking()
                        .Where(ub => ub.TenantId == tenantId
                                  && ub.BranchId == branchId.Value
                                  && ub.Status == "active"
                                  && ub.EffectiveFrom <= now
                                  && (ub.EffectiveUntil == null || ub.EffectiveUntil > now))
                        .Select(ub => ub.UserId)
                        .Distinct()
                        .ToListAsync();
                    var memberSet = new HashSet<Guid>(branchMemberIds);
                    counselors = counselors
                        .Where(c =>
                            memberSet.Contains(c.id)
                            || (c.primaryBranchId.HasValue && c.primaryBranchId.Value == branchId.Value))
                        .ToList();
                }

                return Ok(counselors.Select(c => new
                {
                    c.id,
                    c.firstName,
                    c.lastName,
                    c.name,
                    c.email,
                }));
            }
            catch (UnauthorizedAccessException ex)
            {
                return StatusCode(StatusCodes.Status403Forbidden, new { message = ex.Message });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error retrieving counselors for analytics picker");
                return StatusCode(500, new { message = "Error retrieving counselors", error = ex.Message });
            }
        }

        [HttpGet("analytics/summary")]
        [RequirePermission("counseling_sessions.read")]
        public async Task<IActionResult> GetAnalyticsSummary(
            [FromQuery] Guid? branchId,
            [FromQuery] Guid? counselorId,
            [FromQuery] int period = 30,
            [FromQuery] DateTime? from = null,
            [FromQuery] DateTime? to = null)
        {
            try
            {
                var branches = await ResolveFollowupBranchesAsync(branchId);
                var result = await _analyticsService.GetSummaryAsync(
                    GetTenantId(), branches, branchId, counselorId, period, from, to);
                return Ok(result);
            }
            catch (UnauthorizedAccessException ex)
            {
                return StatusCode(StatusCodes.Status403Forbidden, new { message = ex.Message });
            }
            catch (CounselingAnalyticsDateWindowException ex)
            {
                return BadRequest(new { message = ex.Message });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error generating analytics summary");
                return StatusCode(500, new { message = "Error generating analytics", error = ex.Message });
            }
        }

        // ── Analytics: daily trends ───────────────────────────────────────────

        [HttpGet("analytics/trends")]
        [RequirePermission("counseling_sessions.read")]
        public async Task<IActionResult> GetAnalyticsTrends(
            [FromQuery] Guid? branchId,
            [FromQuery] Guid? counselorId,
            [FromQuery] int period = 30,
            [FromQuery] DateTime? from = null,
            [FromQuery] DateTime? to = null)
        {
            try
            {
                var branches = await ResolveFollowupBranchesAsync(branchId);
                var result = await _analyticsService.GetTrendsAsync(
                    GetTenantId(), branches, branchId, counselorId, period, from, to);
                return Ok(result);
            }
            catch (UnauthorizedAccessException ex)
            {
                return StatusCode(StatusCodes.Status403Forbidden, new { message = ex.Message });
            }
            catch (CounselingAnalyticsDateWindowException ex)
            {
                return BadRequest(new { message = ex.Message });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error generating analytics trends");
                return StatusCode(500, new { message = "Error generating analytics trends", error = ex.Message });
            }
        }

        /// <summary>
        /// PendingDecision aging buckets — NOT Follow-up Center Active (PatientIntention allowlist).
        /// </summary>
        [HttpGet("analytics/followup-aging")]
        [RequirePermission("counseling_sessions.read")]
        public async Task<IActionResult> GetFollowupAging(
            [FromQuery] Guid? branchId,
            [FromQuery] Guid? counselorId,
            [FromQuery] int? period = null,
            [FromQuery] DateTime? from = null,
            [FromQuery] DateTime? to = null)
        {
            try
            {
                var branches = await ResolveFollowupBranchesAsync(branchId);
                var result = await _analyticsService.GetFollowupAgingAsync(
                    GetTenantId(), branches, branchId, counselorId, period, from, to);
                return Ok(result);
            }
            catch (UnauthorizedAccessException ex)
            {
                return StatusCode(StatusCodes.Status403Forbidden, new { message = ex.Message });
            }
            catch (CounselingAnalyticsDateWindowException ex)
            {
                return BadRequest(new { message = ex.Message });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error generating followup aging");
                return StatusCode(500, new { message = "Error generating followup aging", error = ex.Message });
            }
        }

        // ============================================================================
        // MASTER CATALOG & INVESTIGATIONS
        // ============================================================================

        /// <summary>
        /// Deprecated (F0.5 / B2) — use GET /api/servicecatalog/full and investigation-catalog mapping.
        /// </summary>
        [HttpGet("master-catalog")]
        [RequirePermission("counseling_sessions.view")]
        public IActionResult GetMasterCatalog([FromQuery] string? testType = null)
        {
            _logger.LogWarning(
                "Deprecated endpoint GET /api/Counseling/master-catalog called (testType={TestType}). Use /api/servicecatalog/full.",
                testType);
            return StatusCode(410, new
            {
                message = "This endpoint is retired. Use GET /api/servicecatalog/full for investigations and procedures.",
                replacement = "/api/servicecatalog/full",
                migration = "B2 — counsellor investigations sourced from Service Catalog DIAGNOSTICS + INVESTIGATIONS categories",
            });
        }

        /// <summary>Save (replace) pre-op investigation orders for a counseling session.</summary>
        [HttpPost("sessions/{id}/investigations")]
        [RequirePermission("counseling_sessions.update")]
        public async Task<IActionResult> SaveSessionInvestigations(Guid id, [FromBody] SaveInvestigationsRequest request)
        {
            try
            {
                var tenantId = GetTenantId();
                var userId   = GetCurrentUserId();
                await _counselingService.SaveSessionInvestigationsAsync(tenantId, id, userId, request.Investigations);
                return Ok(new { message = "Investigations saved successfully" });
            }
            catch (UnauthorizedAccessException ex)
            {
                return StatusCode(StatusCodes.Status403Forbidden, new { message = ex.Message });
            }
            catch (InvalidOperationException ex)
            {
                return NotFound(new { message = ex.Message });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error saving investigations for session {SessionId}", id);
                var inner = ex.InnerException?.InnerException?.Message ?? ex.InnerException?.Message ?? ex.Message;
                return StatusCode(500, new { message = "Error saving investigations", error = ex.Message, detail = inner });
            }
        }

        // ============================================================================
        // OT FINALIZE SCHEDULE
        // ============================================================================

        /// <summary>POST /api/Counseling/ot-schedule — create or update OT record when counsellor marks Done+Schedule.</summary>
        [HttpPost("ot-schedule")]
        [RequirePermission("counseling_sessions.update")]
        public async Task<IActionResult> UpsertOtSchedule([FromBody] UpsertOtScheduleRequest request)
        {
            try
            {
                var tenantId = GetTenantId();
                var userId   = GetCurrentUserId();
                var result   = await _otFinalizeService.UpsertFromCounsellorAsync(request, tenantId, userId);
                return Ok(result);
            }
            catch (UnauthorizedAccessException ex)
            {
                return StatusCode(StatusCodes.Status403Forbidden, new { message = ex.Message });
            }
            catch (ArgumentException ex)
            {
                return BadRequest(new { message = ex.Message });
            }
            // Phase 3I Slice 7 (PD-S7-06 / M14): stale Version → 409, checked before the generic 500 catch below.
            catch (InvalidOperationException ex) when (SessionConcurrency.IsStale(ex))
            {
                return Conflict(new { message = ex.Message });
            }
            // Package C / PD-OTPREP-10: GuardLocked (and other non-stale InvalidOperation) → 409,
            // consistent with UpdateOtSlot / UpdateOtDetails.
            catch (InvalidOperationException ex)
            {
                return Conflict(new { message = ex.Message });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error upserting OT schedule");
                return StatusCode(500, new { message = "Error saving OT schedule", error = ex.Message });
            }
        }

        /// <summary>GET /api/Counseling/ot-schedule — list OT records for the finalize screen.</summary>
        [HttpGet("ot-schedule")]
        [RequirePermission("counseling_sessions.read")]
        public async Task<IActionResult> GetFinalizeList(
            [FromQuery] DateTime? date,
            [FromQuery] string? uhid,
            [FromQuery] string? name,
            [FromQuery] string? status,
            [FromQuery] Guid? sessionId,
            [FromQuery] Guid? branchId)
        {
            try
            {
                var tenantId = GetTenantId();
                // Phase 3I Slice 9 (PD-S9-12): server-side branch authorization (not FE-only).
                var branches = await ResolveFollowupBranchesAsync(branchId);
                var filters  = new OtScheduleFilters
                {
                    Date = date,
                    Uhid = uhid,
                    Name = name,
                    Status = status,
                    CounsellingSessionId = sessionId,
                };
                var results  = await _otFinalizeService.GetFinalizeListAsync(filters, tenantId, branches);
                return Ok(results);
            }
            catch (UnauthorizedAccessException ex)
            {
                return StatusCode(StatusCodes.Status403Forbidden, new { message = ex.Message });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error fetching OT finalize list");
                return StatusCode(500, new { message = "Error fetching OT list", error = ex.Message });
            }
        }

        /// <summary>PUT /api/Counseling/ot-schedule/{id}/slot — edit doctor/theatre/time slot.</summary>
        [HttpPut("ot-schedule/{id}/slot")]
        [RequirePermission("counseling_sessions.update")]
        public async Task<IActionResult> UpdateOtSlot(Guid id, [FromBody] UpdateSlotRequest request)
        {
            try
            {
                var tenantId = GetTenantId();
                var userId   = GetCurrentUserId();
                var result   = await _otFinalizeService.UpdateSlotAsync(id, request, tenantId, userId);
                return Ok(result);
            }
            catch (UnauthorizedAccessException ex)
            {
                return StatusCode(StatusCodes.Status403Forbidden, new { message = ex.Message });
            }
            catch (KeyNotFoundException ex)
            {
                return NotFound(new { message = ex.Message });
            }
            catch (InvalidOperationException ex)
            {
                return Conflict(new { message = ex.Message });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error updating OT slot {Id}", id);
                return StatusCode(500, new { message = "Error updating slot", error = ex.Message });
            }
        }

        /// <summary>POST /api/Counseling/ot-schedule/{id}/confirm — NotConfirmed → Confirmed (with conflict check).</summary>
        [HttpPost("ot-schedule/{id}/confirm")]
        [RequirePermission("counseling_sessions.update")]
        public async Task<IActionResult> ConfirmOtSchedule(Guid id)
        {
            try
            {
                var tenantId = GetTenantId();
                var userId   = GetCurrentUserId();
                var result   = await _otFinalizeService.ConfirmAsync(id, tenantId, userId);
                return Ok(result);
            }
            catch (UnauthorizedAccessException ex)
            {
                return StatusCode(StatusCodes.Status403Forbidden, new { message = ex.Message });
            }
            catch (KeyNotFoundException ex)
            {
                return NotFound(new { message = ex.Message });
            }
            catch (ArgumentException ex)
            {
                return BadRequest(new { message = ex.Message });
            }
            catch (InvalidOperationException ex)
            {
                return Conflict(new { message = ex.Message });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error confirming OT schedule {Id}", id);
                return StatusCode(500, new { message = "Error confirming schedule", error = ex.Message });
            }
        }

        /// <summary>POST /api/Counseling/ot-schedule/{id}/finalise — Confirmed → Finalised.</summary>
        [HttpPost("ot-schedule/{id}/finalise")]
        [RequirePermission("counseling_sessions.update")]
        public async Task<IActionResult> FinaliseOtSchedule(Guid id)
        {
            try
            {
                var tenantId = GetTenantId();
                var userId   = GetCurrentUserId();
                var result   = await _otFinalizeService.FinaliseAsync(id, tenantId, userId);
                return Ok(result);
            }
            catch (UnauthorizedAccessException ex)
            {
                return StatusCode(StatusCodes.Status403Forbidden, new { message = ex.Message });
            }
            catch (KeyNotFoundException ex)
            {
                return NotFound(new { message = ex.Message });
            }
            catch (InvalidOperationException ex)
            {
                return Conflict(new { message = ex.Message });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error finalising OT schedule {Id}", id);
                return StatusCode(500, new { message = "Error finalising schedule", error = ex.Message });
            }
        }

        /// <summary>POST /api/Counseling/ot-schedule/{id}/cancel — Cancelled + required reason (Package 1 PD-FS-04).</summary>
        [HttpPost("ot-schedule/{id}/cancel")]
        [RequirePermission("counseling_sessions.update")]
        public async Task<IActionResult> CancelOtSchedule(Guid id, [FromBody] CancelOtScheduleRequest? request)
        {
            try
            {
                var tenantId = GetTenantId();
                var userId   = GetCurrentUserId();
                var result   = await _otFinalizeService.CancelAsync(
                    id, tenantId, userId, request?.CancelReason ?? string.Empty);
                return Ok(result);
            }
            catch (UnauthorizedAccessException ex)
            {
                return StatusCode(StatusCodes.Status403Forbidden, new { message = ex.Message });
            }
            catch (KeyNotFoundException ex)
            {
                return NotFound(new { message = ex.Message });
            }
            catch (ArgumentException ex)
            {
                return BadRequest(new { message = ex.Message });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error cancelling OT schedule {Id}", id);
                return StatusCode(500, new { message = "Error cancelling schedule", error = ex.Message });
            }
        }

        /// <summary>POST /api/Counseling/ot-schedule/{id}/reopen — OTPrepared → Confirmed + unlock.</summary>
        [HttpPost("ot-schedule/{id}/reopen")]
        [RequirePermission("counseling_sessions.update")]
        public async Task<IActionResult> ReopenOtCase(Guid id)
        {
            try
            {
                var tenantId = GetTenantId();
                var userId   = GetCurrentUserId();
                var result   = await _otFinalizeService.ReopenAsync(id, tenantId, userId);
                return Ok(result);
            }
            catch (UnauthorizedAccessException ex)
            {
                return StatusCode(StatusCodes.Status403Forbidden, new { message = ex.Message });
            }
            catch (KeyNotFoundException ex)
            {
                return NotFound(new { message = ex.Message });
            }
            catch (InvalidOperationException ex)
            {
                return Conflict(new { message = ex.Message });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error reopening OT case {Id}", id);
                return StatusCode(500, new { message = "Error reopening case", error = ex.Message });
            }
        }

        /// <summary>POST /api/Counseling/ot-schedule/prepare — batch lock Finalised → OTPrepared.</summary>
        [HttpPost("ot-schedule/prepare")]
        [RequirePermission("counseling_sessions.update")]
        public async Task<IActionResult> PrepareOtList([FromBody] PrepareOtListRequest request)
        {
            try
            {
                var tenantId = GetTenantId();
                var userId   = GetCurrentUserId();
                await _otFinalizeService.PrepareOtListAsync(request, tenantId, userId);
                return Ok(new { message = "OT list prepared and locked successfully" });
            }
            catch (UnauthorizedAccessException ex)
            {
                return StatusCode(StatusCodes.Status403Forbidden, new { message = ex.Message });
            }
            catch (ArgumentException ex)
            {
                return BadRequest(new { message = ex.Message });
            }
            catch (OtPrepareConflictException ex)
            {
                return Conflict(new { message = ex.Message, conflictingScheduleIds = ex.ConflictingScheduleIds });
            }
            catch (InvalidOperationException ex)
            {
                return Conflict(new { message = ex.Message });
            }
            catch (DbUpdateException ex)
            {
                _logger.LogError(ex, "Error preparing OT list (database update)");
                var detail = ex.InnerException?.InnerException?.Message
                    ?? ex.InnerException?.Message
                    ?? ex.Message;
                return StatusCode(500, new
                {
                    message = "Error preparing OT list",
                    error = ex.Message,
                    detail,
                });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error preparing OT list");
                var detail = ex.InnerException?.InnerException?.Message
                    ?? ex.InnerException?.Message
                    ?? ex.Message;
                return StatusCode(500, new
                {
                    message = "Error preparing OT list",
                    error = ex.Message,
                    detail,
                });
            }
        }

        /// <summary>GET /api/Counseling/ot-list?date=YYYY-MM-DD — locked OTPrepared list for a date.</summary>
        [HttpGet("ot-list")]
        [RequirePermission("counseling_sessions.read")]
        public async Task<IActionResult> GetOtList([FromQuery] DateTime date, [FromQuery] Guid? branchId)
        {
            try
            {
                var tenantId = GetTenantId();
                var branches = await ResolveFollowupBranchesAsync(branchId);
                var results  = await _otFinalizeService.GetOtListAsync(date, tenantId, branches);
                return Ok(results);
            }
            catch (UnauthorizedAccessException ex)
            {
                return StatusCode(StatusCodes.Status403Forbidden, new { message = ex.Message });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error fetching OT list for {Date}", date);
                return StatusCode(500, new { message = "Error fetching OT list", error = ex.Message });
            }
        }

        /// <summary>GET /api/Counseling/ot-schedule/{id} — full detail with patient context and checklist.</summary>
        [HttpGet("ot-schedule/{id}")]
        [RequirePermission("counseling_sessions.read")]
        public async Task<IActionResult> GetOtScheduleDetail(Guid id)
        {
            try
            {
                var tenantId = GetTenantId();
                var userId   = GetCurrentUserId();
                var result   = await _otFinalizeService.GetByIdAsync(id, tenantId, userId);
                return Ok(result);
            }
            catch (UnauthorizedAccessException ex)
            {
                return StatusCode(StatusCodes.Status403Forbidden, new { message = ex.Message });
            }
            catch (KeyNotFoundException ex) { return NotFound(new { message = ex.Message }); }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error fetching OT schedule detail {Id}", id);
                return StatusCode(500, new { message = "Error fetching detail", error = ex.Message });
            }
        }

        /// <summary>PUT /api/Counseling/ot-schedule/{id}/details — save all modal fields.</summary>
        [HttpPut("ot-schedule/{id}/details")]
        [RequirePermission("counseling_sessions.update")]
        public async Task<IActionResult> UpdateOtDetails(Guid id, [FromBody] UpdateOtDetailsRequest request)
        {
            try
            {
                var tenantId = GetTenantId();
                var userId   = GetCurrentUserId();
                var result   = await _otFinalizeService.UpdateDetailsAsync(id, request, tenantId, userId);
                return Ok(result);
            }
            catch (UnauthorizedAccessException ex)
            {
                return StatusCode(StatusCodes.Status403Forbidden, new { message = ex.Message });
            }
            catch (KeyNotFoundException ex) { return NotFound(new { message = ex.Message }); }
            catch (InvalidOperationException ex) { return Conflict(new { message = ex.Message }); }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error updating OT details {Id}", id);
                return StatusCode(500, new { message = "Error updating details", error = ex.Message });
            }
        }
    }

    // Helper DTO for cancel session request
    public class CancelSessionRequest
    {
        public string Reason { get; set; } = null!;

        /// <summary>Phase 3I Slice 7 (PD-S7-02) — required expected Version.</summary>
        public int? Version { get; set; }
    }

    // Helper DTO for advance-stage request
    public class AdvanceStageRequest
    {
        [System.ComponentModel.DataAnnotations.Range(1, 6)]
        public int Stage { get; set; }

        /// <summary>Phase 3I Slice 7 (PD-S7-02) — required expected Version.</summary>
        public int? Version { get; set; }
    }

    // Cost Estimate Sharing DTOs
    public class ShareCostEstimateEmailRequest
    {
        public string To { get; set; } = null!;
        public string? Subject { get; set; }
        public string? Body { get; set; }
        public List<EmailAttachment>? Attachments { get; set; }
        public ShareMetadata? Metadata { get; set; }
    }

    public class ShareCostEstimateSMSRequest
    {
        public string To { get; set; } = null!;
        public string Message { get; set; } = null!;
        public ShareMetadata? Metadata { get; set; }
    }

    public class ShareCostEstimateWhatsAppRequest
    {
        public string To { get; set; } = null!;
        public string Message { get; set; } = null!;
        public List<WhatsAppAttachment>? Attachments { get; set; }
        public ShareMetadata? Metadata { get; set; }
    }

    public class EmailAttachment
    {
        public string Filename { get; set; } = null!;
        public string ContentBase64 { get; set; } = null!;
        public string MimeType { get; set; } = "application/pdf";
    }

    public class WhatsAppAttachment
    {
        public string Filename { get; set; } = null!;
        public string ContentBase64 { get; set; } = null!;
        public string MimeType { get; set; } = "application/pdf";
    }

    public class ShareMetadata
    {
        public string? EstimateNumber { get; set; }
        public string? PatientId { get; set; }
        public decimal? TotalCost { get; set; }
    }
}
