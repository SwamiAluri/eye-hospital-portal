using System.Security.Claims;
using AuthService.Authorization;
using AuthService.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace AuthService.Controllers;

/// <summary>
/// Patient 360 clinical prescription history. Distinct from the operational prescription routes.
/// </summary>
[ApiController]
[Route("api/prescriptions")]
[Authorize]
public class Patient360MedicationController : ControllerBase
{
    private readonly IPatient360MedicationReadService _medications;

    public Patient360MedicationController(IPatient360MedicationReadService medications)
    {
        _medications = medications;
    }

    [HttpGet("patients/{patientId:guid}/patient-360")]
    [RequirePermission("patient360.medication.read")]
    public async Task<IActionResult> GetPatient360Medications(
        Guid patientId,
        [FromQuery] int pageNumber = 1,
        [FromQuery] int pageSize = 20,
        CancellationToken cancellationToken = default)
    {
        try
        {
            var page = await _medications.ListAsync(
                RequireTenantId(), RequireUserId(), patientId, pageNumber, pageSize, cancellationToken);
            return Ok(page);
        }
        catch (UnauthorizedAccessException ex)
        {
            return Unauthorized(new { message = ex.Message });
        }
        catch (KeyNotFoundException)
        {
            return NotFound(new { message = "Patient was not found for this tenant." });
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
