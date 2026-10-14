using System;
using System.Security.Claims;
using System.Threading;
using System.Threading.Tasks;
using AuthService.Authorization;
using AuthService.Models.Domain;
using AuthService.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;

namespace AuthService.Controllers;

[Authorize]
[ApiController]
[Route("api/counseling-session-documents")]
public class CounselingSessionDocumentPatientReadController : ControllerBase
{
    private readonly ICounselingWorkflowService _counseling;
    private readonly ICounselingSessionDocumentCanonicalService _canonical;

    public CounselingSessionDocumentPatientReadController(
        ICounselingWorkflowService counseling,
        ICounselingSessionDocumentCanonicalService canonical)
    {
        _counseling = counseling;
        _canonical = canonical;
    }

    /// <summary>
    /// Patient 360 counselling document metadata. Does not return file paths or file bytes.
    /// Excludes AudioRecording. Includes session-owned and patient-level Counselling documents.
    /// </summary>
    [HttpGet("by-patient/{patientId:guid}")]
    [RequirePermission("session_documents.read")]
    public async Task<IActionResult> ByPatient(
        Guid patientId,
        [FromQuery] int pageNumber = 1,
        [FromQuery] int pageSize = 20)
    {
        var tenantRaw = User.FindFirst("tenant_id")?.Value ?? User.FindFirst("TenantId")?.Value;
        if (!Guid.TryParse(tenantRaw, out var tenantId))
            return Unauthorized(new { message = "Tenant ID not found in token" });

        var page = await _counseling.ListMetadataByPatientIdAsync(tenantId, patientId, pageNumber, pageSize);
        return Ok(new
        {
            documents = page.Documents,
            totalCount = page.TotalCount,
            pageNumber = page.PageNumber,
            pageSize = page.PageSize,
        });
    }

    /// <summary>
    /// Patient 360 Counselling upload — patient-level association, no session selection.
    /// </summary>
    [HttpPost("by-patient/{patientId:guid}")]
    [RequirePermission("session_documents.create")]
    [RequestSizeLimit(CanonicalDocumentFileRules.MaxBytes)]
    public async Task<IActionResult> UploadPatientLevel(
        Guid patientId,
        IFormFile file,
        [FromForm] string? documentType,
        CancellationToken cancellationToken)
    {
        var tenantRaw = User.FindFirst("tenant_id")?.Value ?? User.FindFirst("TenantId")?.Value;
        var userRaw = User.FindFirst(ClaimTypes.NameIdentifier)?.Value ?? User.FindFirst("sub")?.Value;
        if (!Guid.TryParse(tenantRaw, out var tenantId) || tenantId == Guid.Empty)
            return Unauthorized(new { message = "Tenant ID not found in token" });
        if (!Guid.TryParse(userRaw, out var userId) || userId == Guid.Empty)
            return Unauthorized(new { message = "User ID not found in token" });

        try
        {
            var document = await _canonical.UploadPatientLevelAsync(
                tenantId, patientId, file, documentType, userId, cancellationToken);
            return StatusCode(StatusCodes.Status201Created, document);
        }
        catch (ArgumentException ex)
        {
            return BadRequest(new { message = ex.Message });
        }
        catch (KeyNotFoundException)
        {
            return NotFound(new { message = "Patient not found" });
        }
    }

    /// <summary>
    /// Patient 360 A2 — Counselling-authorized canonical content (Preview/Download/Print).
    /// Requires session_documents.read. Does not accept General patient-document download permission.
    /// </summary>
    [HttpGet("by-patient/{patientId:guid}/canonical/{canonicalDocumentId:guid}/content")]
    [RequirePermission("session_documents.read")]
    public async Task<IActionResult> CanonicalContent(
        Guid patientId,
        Guid canonicalDocumentId,
        CancellationToken cancellationToken)
    {
        var tenantRaw = User.FindFirst("tenant_id")?.Value ?? User.FindFirst("TenantId")?.Value;
        if (!Guid.TryParse(tenantRaw, out var tenantId))
            return Unauthorized(new { message = "Tenant ID not found in token" });

        var content = await _canonical.OpenContentForPatientAsync(
            tenantId, patientId, canonicalDocumentId, cancellationToken);
        if (content is null)
            return NotFound(new { message = "Document not found" });

        return File(content.Content, content.ContentType, content.FileName);
    }
}
