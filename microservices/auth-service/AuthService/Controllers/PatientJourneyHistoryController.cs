using System.Security.Claims;
using AuthService.Authorization;
using AuthService.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace AuthService.Controllers;

/// <summary>
/// Patient 360 closed inpatient episodes. Not the IP census.
/// </summary>
[ApiController]
[Route("api/patient-journeys")]
[Authorize]
public class PatientJourneyHistoryController : ControllerBase
{
    private readonly IPatientJourneyHistoryService _history;

    public PatientJourneyHistoryController(IPatientJourneyHistoryService history)
    {
        _history = history;
    }

    /// <summary>
    /// Closed patient_journey episodes for one patient, limited to the caller's authorized branches.
    /// </summary>
    [HttpGet("patients/{patientId:guid}/patient-360/inpatient-history")]
    [RequirePermission("ip_management.view")]
    public async Task<IActionResult> GetPatient360InpatientHistory(
        Guid patientId,
        [FromQuery] int pageNumber = 1,
        [FromQuery] int pageSize = 20,
        CancellationToken cancellationToken = default)
    {
        try
        {
            var page = await _history.ListPatient360Async(
                RequireTenantId(), RequireUserId(), patientId, pageNumber, pageSize, cancellationToken);
            return Ok(page);
        }
        catch (UnauthorizedAccessException ex)
        {
            return Unauthorized(new { message = ex.Message });
        }
    }

    private Guid RequireTenantId()
    {
        var tenantIdClaim = User.FindFirst("TenantId")?.Value
            ?? User.FindFirst("tenant_id")?.Value;
        if (string.IsNullOrEmpty(tenantIdClaim) || !Guid.TryParse(tenantIdClaim, out var tenantId) || tenantId == Guid.Empty)
            throw new UnauthorizedAccessException("Tenant ID not found in token");
        return tenantId;
    }

    private Guid RequireUserId()
    {
        var userIdClaim = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
        if (string.IsNullOrEmpty(userIdClaim) || !Guid.TryParse(userIdClaim, out var userId) || userId == Guid.Empty)
            throw new UnauthorizedAccessException("User ID not found in token");
        return userId;
    }
}
