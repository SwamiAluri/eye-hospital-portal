using AuthService.DTOs.Billing;
using AuthService.Services;
using AuthService.Services.Interfaces;
using Microsoft.AspNetCore.Mvc;

namespace AuthService.Controllers;

/// <summary>
/// Internal inpatient billing API. OpdBill remains financial SoT.
/// </summary>
[ApiController]
[Route("api/internal/ip-billing")]
public class InternalIpBillingController : ControllerBase
{
    private readonly IOpdBillService _bills;
    private readonly IConfiguration _config;
    private readonly INotificationService? _notifications;
    private readonly IChargeCatalogResolver? _catalog;
    private readonly ILogger<InternalIpBillingController> _log;

    public InternalIpBillingController(
        IOpdBillService bills,
        IConfiguration config,
        ILogger<InternalIpBillingController> log,
        INotificationService? notifications = null,
        IChargeCatalogResolver? catalog = null)
    {
        _bills = bills;
        _config = config;
        _log = log;
        _notifications = notifications;
        _catalog = catalog;
    }

    [HttpPost("ensure-bill")]
    public async Task<IActionResult> EnsureBill([FromBody] EnsureInpatientBillRequest request)
    {
        if (!IsAuthorized()) return Unauthorized(new { error = "Invalid or missing internal API key." });
        try
        {
            var userId = request.ActorUserId != Guid.Empty ? request.ActorUserId : request.PatientId;
            var bill = await _bills.EnsureInpatientBillAsync(request, userId);
            return Ok(bill);
        }
        catch (ChargePostingException ex)
        {
            return Conflict(new { code = ex.Code, error = ex.Message, billId = ex.BillId, failedLines = ex.FailedLines });
        }
        catch (Exception ex)
        {
            _log.LogError(ex, "Ensure inpatient bill failed for journey {JourneyId}", request.PatientJourneyId);
            return StatusCode(500, new { error = ex.Message });
        }
    }

    [HttpGet("summary/{patientJourneyId:guid}")]
    public async Task<IActionResult> Summary(Guid patientJourneyId)
    {
        if (!IsAuthorized()) return Unauthorized(new { error = "Invalid or missing internal API key." });
        var summary = await _bills.GetInpatientSummaryAsync(patientJourneyId);
        return Ok(summary);
    }

    [HttpPost("apply-coverage-allocation")]
    public async Task<IActionResult> ApplyCoverageAllocation([FromBody] ApplyCoverageAllocationRequest request)
    {
        if (!IsAuthorized()) return Unauthorized(new { error = "Invalid or missing internal API key." });
        var summary = await _bills.ApplyCoverageAllocationAsync(request);
        if (summary is null) return NotFound(new { error = "Inpatient bill not found." });
        return Ok(summary);
    }

    public sealed class ClaimStatusChangedRequest
    {
        public Guid TenantId { get; set; }
        public Guid? PatientJourneyId { get; set; }
        public Guid CoverageCaseId { get; set; }
        public string ClaimStatus { get; set; } = string.Empty;
        public Guid ActorUserId { get; set; }
    }

    /// <summary>CCMS → Billing/IP. Claim SoT stays in CCMS; this is an idempotent fan-out only.</summary>
    [HttpPost("claim-status-changed")]
    public async Task<IActionResult> ClaimStatusChanged([FromBody] ClaimStatusChangedRequest request)
    {
        if (!IsAuthorized()) return Unauthorized(new { error = "Invalid or missing internal API key." });
        if (_notifications is not null && request.TenantId != Guid.Empty)
        {
            await _notifications.SendTenantNotificationAsync(
                request.TenantId,
                "ClaimStatusChanged",
                $"Claim status is now {request.ClaimStatus}.",
                request.CoverageCaseId.ToString());
        }
        _log.LogInformation(
            "ClaimStatusChanged case={CaseId} journey={JourneyId} status={Status}",
            request.CoverageCaseId, request.PatientJourneyId, request.ClaimStatus);
        return Ok(new { accepted = true });
    }

    [HttpPost("payment")]
    public async Task<IActionResult> Payment([FromBody] AddPaymentDto request, [FromQuery] Guid actorUserId)
    {
        if (!IsAuthorized()) return Unauthorized(new { error = "Invalid or missing internal API key." });
        try
        {
            var bill = await _bills.AddPaymentAsync(request, actorUserId);
            if (bill == null) return NotFound(new { error = "Bill not found." });
            return Ok(bill);
        }
        catch (ArgumentException ex) { return BadRequest(new { error = ex.Message }); }
        catch (InvalidOperationException ex) { return Conflict(new { error = ex.Message }); }
    }

    [HttpPost("reverse")]
    public async Task<IActionResult> Reverse([FromBody] ReversePaymentRequest request, [FromQuery] Guid actorUserId)
    {
        if (!IsAuthorized()) return Unauthorized(new { error = "Invalid or missing internal API key." });
        try
        {
            var bill = await _bills.ReversePaymentAsync(request, actorUserId);
            if (bill == null) return NotFound(new { error = "Payment not found." });
            return Ok(bill);
        }
        catch (InvalidOperationException ex) { return Conflict(new { error = ex.Message }); }
    }

    public sealed class UatSoftDeleteBillsRequest
    {
        public List<Guid> JourneyIds { get; set; } = [];
    }

    [HttpPost("uat-soft-delete")]
    public async Task<IActionResult> UatSoftDelete([FromBody] UatSoftDeleteBillsRequest request, [FromQuery] Guid actorUserId)
    {
        if (!IsAuthorized()) return Unauthorized(new { error = "Invalid or missing internal API key." });
        var env = _config["ASPNETCORE_ENVIRONMENT"] ?? Environment.GetEnvironmentVariable("ASPNETCORE_ENVIRONMENT");
        var enabled = _config.GetValue("EnableUatDataSeeder", false);
        if (string.Equals(env, "Production", StringComparison.OrdinalIgnoreCase) || !enabled)
            return StatusCode(403, new { error = "UAT bill cleanup is disabled." });
        var n = await _bills.SoftDeleteInpatientBillsForUatAsync(request.JourneyIds ?? [], actorUserId);
        return Ok(new { deleted = n });
    }

    [HttpPost("charge-items")]
    public async Task<IActionResult> ChargeItems([FromBody] ChargeItemsRequest request)
    {
        if (!IsAuthorized()) return Unauthorized(new { error = "Invalid or missing internal API key." });
        try
        {
            var result = await _bills.ChargeItemsAsync(request);
            return Ok(result);
        }
        catch (ArgumentException ex)
        {
            return BadRequest(new { error = ex.Message });
        }
        catch (ChargePostingException ex) when (ex.Code == ChargePostingCodes.BillNotFound)
        {
            return NotFound(new { code = ex.Code, error = ex.Message, billId = ex.BillId });
        }
        catch (ChargePostingException ex)
        {
            return Conflict(new
            {
                code = ex.Code,
                error = ex.Message,
                billId = ex.BillId,
                failedLines = ex.FailedLines,
            });
        }
        catch (InvalidOperationException ex)
        {
            return Conflict(new { error = ex.Message });
        }
    }

    [HttpPost("charge-exception")]
    public async Task<IActionResult> EnqueueChargeException([FromBody] InternalChargeExceptionRequest request)
    {
        if (!IsAuthorized()) return Unauthorized(new { error = "Invalid or missing internal API key." });
        if (_catalog is null)
            return StatusCode(500, new { error = "Charge exception queue is not configured." });
        if (request.TenantId == Guid.Empty)
            return BadRequest(new { error = "TenantId is required." });
        if (string.IsNullOrWhiteSpace(request.IdempotencyKey))
            return BadRequest(new { error = "IdempotencyKey is required." });

        var row = await _catalog.EnqueueUnmappedAsync(request.TenantId, new ChargeExceptionEnqueueRequest
        {
            ItemId = request.ItemId,
            SourceType = string.IsNullOrWhiteSpace(request.SourceType) ? BillChargeSource.Consumable : request.SourceType,
            SourceRefId = request.SourceRefId,
            OpdBillId = request.OpdBillId,
            PatientJourneyId = request.PatientJourneyId,
            Quantity = request.Quantity,
            EstimatedValue = 0,
            Reason = request.Reason ?? "Unmapped OT consumable.",
            IdempotencyKey = request.IdempotencyKey,
            Status = request.Status,
        });
        return Ok(new { id = row.Id, status = row.Status });
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
}
