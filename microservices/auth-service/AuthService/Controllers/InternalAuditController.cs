using AuthService.Services;
using Microsoft.AspNetCore.Mvc;

namespace AuthService.Controllers;

/// <summary>
/// Internal platform audit write for satellite services (LaboratoryApi L-CAT-01B).
/// Auth pattern matches other Internal* controllers: shared <c>X-Internal-Key</c>.
/// Hardened for audit writes: tenant header must match body; action/resource allowlisted.
/// </summary>
[ApiController]
[Route("api/internal/audit")]
public class InternalAuditController : ControllerBase
{
    /// <summary>L-CAT-01B catalogue + L-ORD-01B order + L-COL-01B collection audit actions. Expand deliberately.</summary>
    public static readonly HashSet<string> AllowedActions = new(StringComparer.Ordinal)
    {
        "CREATE_DRAFT",
        "UPDATE_DRAFT",
        "SUBMIT_REVIEW",
        "RETURN_TO_DRAFT",
        "APPROVE",
        "ACTIVATE",
        "RETIRE",
        "SUPERSEDE",
        "CREATE_VERSION",
        // L-ORD-01B
        "SUBMIT_ORDER",
        "AMEND_ORDER",
        "CANCEL_ORDER",
        // L-COL-01B
        "CREATE_COLLECTION_TASK",
        "TRANSITION_COLLECTION_TASK",
        "CLAIM_COLLECTION_TASK",
        "ASSIGN_COLLECTION_TASK",
        "RELEASE_COLLECTION_TASK",
        "CANCEL_COLLECTION_TASK",
        // L-COL-01C
        "CREATE_SPECIMEN",
        "COMPLETE_COLLECTION",
        // L-COL-01D
        "RECEIVE_SPECIMEN",
        "REJECT_SPECIMEN",
        // L-COL-01E
        "CREATE_SPECIMEN_BARCODE",
        "PRINT_SPECIMEN_LABEL",
        "REPRINT_SPECIMEN_LABEL",
        // L-TST-01A
        "CREATE_RESULT_DRAFT",
        "UPDATE_RESULT_DRAFT",
        // L-VER-01
        "VERIFY_RESULT",
        // L-AUTH-01
        "AUTHORIZE_RESULT",
        // L-CRT-01
        "CREATE_CRITICAL_EVENT",
        "ACKNOWLEDGE_CRITICAL_EVENT",
        // L-REP-01
        "CREATE_REPORT_DRAFT",
        "APPEND_REPORT_VERSION",
        // L-REP-02A
        "FINALIZE_REPORT",
        // L-REP-02B
        "RELEASE_REPORT",
        // L-REP-03 CUT A
        "ASSIGN_REPORT_NUMBER",
        // L-REP-03 CUT B
        "REQUEST_OFFICIAL_PDF",
        "OFFICIAL_PDF_GENERATED",
        "OFFICIAL_PDF_FAILED",
        // L-REP-03 CUT C
        "DOWNLOAD_OFFICIAL_PDF",
    };

    public static readonly HashSet<string> AllowedResourceTypes = new(StringComparer.Ordinal)
    {
        "LmsCatalogueVersion",
        "LmsOrder",
        "LmsOrderVersion",
        // L-COL-01B
        "LmsCollectionTask",
        // L-COL-01C
        "LmsSpecimen",
        // L-TST-01A
        "LmsResult",
        // L-CRT-01
        "LmsCriticalResultEvent",
        // L-REP-01
        "LmsReport",
        "LmsReportVersion",
    };

    private readonly IAuditService _audit;
    private readonly IConfiguration _config;
    private readonly ILogger<InternalAuditController> _log;

    public InternalAuditController(
        IAuditService audit,
        IConfiguration config,
        ILogger<InternalAuditController> log)
    {
        _audit = audit;
        _config = config;
        _log = log;
    }

    public record InternalAuditWriteRequest(
        Guid TenantId,
        Guid ActorUserId,
        string Action,
        string ResourceType,
        Guid? ResourceId,
        string? Reason = null,
        string? Details = null,
        string? OldValues = null,
        string? NewValues = null,
        string? CorrelationId = null);

    /// <summary>POST /api/internal/audit</summary>
    [HttpPost]
    public async Task<IActionResult> Write([FromBody] InternalAuditWriteRequest req)
    {
        if (!IsAuthorized())
            return Unauthorized(new { error = "Invalid or missing internal API key." });

        if (req.TenantId == Guid.Empty || req.ActorUserId == Guid.Empty)
            return BadRequest(new { error = "TenantId and ActorUserId are required." });
        if (string.IsNullOrWhiteSpace(req.Action) || string.IsNullOrWhiteSpace(req.ResourceType))
            return BadRequest(new { error = "Action and ResourceType are required." });

        // AD-CAT-AUDIT: tenant must be asserted via header and match body (not freely body-only).
        if (!TryGetHeaderTenant(out var headerTenant))
            return BadRequest(new { error = "X-Tenant-ID header is required." });
        if (headerTenant != req.TenantId)
            return BadRequest(new { error = "X-Tenant-ID does not match body TenantId." });

        var action = req.Action.Trim();
        var resourceType = req.ResourceType.Trim();
        if (!AllowedActions.Contains(action))
            return BadRequest(new { error = "Action is not permitted on the internal audit endpoint.", code = "action_not_allowed" });
        if (!AllowedResourceTypes.Contains(resourceType))
            return BadRequest(new { error = "ResourceType is not permitted on the internal audit endpoint.", code = "resource_type_not_allowed" });

        // Ensure AuditService tenant resolution sees the caller tenant (no HTTP user pipeline).
        HttpContext.Items["TenantId"] = req.TenantId;
        if (!string.IsNullOrWhiteSpace(req.CorrelationId))
            HttpContext.Items["SessionId"] = req.CorrelationId.Trim();

        var details = req.Details;
        if (!string.IsNullOrWhiteSpace(req.Reason))
            details = string.IsNullOrWhiteSpace(details) ? $"reason={req.Reason}" : $"{details}; reason={req.Reason}";

        try
        {
            // Timestamp / sequence / hash are server-controlled inside AuditService.LogAsync.
            await _audit.LogAsync(
                req.ActorUserId,
                action,
                resourceType,
                req.ResourceId,
                details,
                req.OldValues,
                req.NewValues);

            return Ok(new
            {
                status = "logged",
                outcome = "success",
                tenantId = req.TenantId,
                action,
                resourceType,
                resourceId = req.ResourceId,
            });
        }
        catch (Exception ex)
        {
            _log.LogError(ex, "Internal audit write failed for {Action} {ResourceType}", action, resourceType);
            return StatusCode(500, new { error = "Audit write failed.", outcome = "failure" });
        }
    }

    private bool IsAuthorized()
    {
        Request.Headers.TryGetValue("X-Internal-Key", out var provided);
        var expected = _config["InternalApi:Key"]
            ?? _config["InternalApiKey"]
            ?? _config["AuthService:InternalApiKey"]
            ?? string.Empty;
        return !string.IsNullOrWhiteSpace(expected)
               && string.Equals(provided.ToString(), expected, StringComparison.Ordinal);
    }

    private bool TryGetHeaderTenant(out Guid tenantId)
    {
        tenantId = Guid.Empty;
        if (!Request.Headers.TryGetValue("X-Tenant-ID", out var vals))
            return false;
        var raw = vals.ToString();
        return Guid.TryParse(raw, out tenantId) && tenantId != Guid.Empty;
    }
}
