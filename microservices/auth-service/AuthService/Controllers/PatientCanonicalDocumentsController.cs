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
[Route("api/patients/{patientId:guid}/documents")]
public class PatientCanonicalDocumentsController : ControllerBase
{
    private readonly ICanonicalDocumentService _documents;

    public PatientCanonicalDocumentsController(ICanonicalDocumentService documents)
    {
        _documents = documents;
    }

    [HttpPost]
    [RequirePermission(CanonicalDocumentPermissions.Upload)]
    [RequestSizeLimit(CanonicalDocumentFileRules.MaxBytes)]
    public async Task<IActionResult> Upload(
        Guid patientId,
        IFormFile file,
        [FromForm] string? classification,
        [FromForm] string? duplicateResolution,
        [FromForm] Guid? replaceDocumentId,
        CancellationToken cancellationToken)
    {
        if (!TryIdentity(out var tenantId, out var userId, out var error))
            return Unauthorized(new { message = error });

        try
        {
            var document = await _documents.UploadGeneralAsync(
                tenantId,
                patientId,
                userId,
                file,
                new CanonicalDocumentUploadRequest(classification, duplicateResolution, replaceDocumentId),
                cancellationToken);
            return StatusCode(StatusCodes.Status201Created, document);
        }
        catch (CanonicalDocumentDuplicateException ex)
        {
            return Conflict(new
            {
                code = "duplicate_document",
                message = ex.Message,
                candidate = ex.Candidate,
            });
        }
        catch (CanonicalDocumentStaleReplacementException ex)
        {
            return Conflict(new { code = "stale_replacement", message = ex.Message });
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

    [HttpGet]
    [RequirePermission(CanonicalDocumentPermissions.Read)]
    public async Task<IActionResult> List(
        Guid patientId,
        [FromQuery] int pageNumber = 1,
        [FromQuery] int pageSize = 20,
        CancellationToken cancellationToken = default)
    {
        if (!TryIdentity(out var tenantId, out _, out var error))
            return Unauthorized(new { message = error });

        try
        {
            var page = await _documents.ListGeneralByPatientAsync(
                tenantId, patientId, pageNumber, pageSize, cancellationToken);
            return Ok(new
            {
                documents = page.Documents,
                totalCount = page.TotalCount,
                pageNumber = page.PageNumber,
                pageSize = page.PageSize,
            });
        }
        catch (KeyNotFoundException)
        {
            return NotFound(new { message = "Patient not found" });
        }
    }

    [HttpGet("{documentId:guid}/content")]
    [RequirePermission(CanonicalDocumentPermissions.Download)]
    public async Task<IActionResult> Content(
        Guid patientId,
        Guid documentId,
        CancellationToken cancellationToken)
    {
        if (!TryIdentity(out var tenantId, out _, out var error))
            return Unauthorized(new { message = error });

        var content = await _documents.OpenContentAsync(tenantId, patientId, documentId, cancellationToken);
        if (content is null)
            return NotFound(new { message = "Document not found" });

        return File(content.Content, content.ContentType, content.FileName);
    }

    [HttpDelete("{documentId:guid}")]
    [RequirePermission(CanonicalDocumentPermissions.Delete)]
    public async Task<IActionResult> Delete(
        Guid patientId,
        Guid documentId,
        CancellationToken cancellationToken)
    {
        if (!TryIdentity(out var tenantId, out var userId, out var error))
            return Unauthorized(new { message = error });

        try
        {
            await _documents.SoftDeleteGeneralAsync(tenantId, patientId, documentId, userId, cancellationToken);
            return NoContent();
        }
        catch (KeyNotFoundException)
        {
            return NotFound(new { message = "Document not found" });
        }
        catch (UnauthorizedAccessException ex)
        {
            return StatusCode(StatusCodes.Status403Forbidden, new { message = ex.Message });
        }
    }

    private bool TryIdentity(out Guid tenantId, out Guid userId, out string error)
    {
        tenantId = Guid.Empty;
        userId = Guid.Empty;
        var tenantRaw = User.FindFirst("tenant_id")?.Value ?? User.FindFirst("TenantId")?.Value;
        var userRaw = User.FindFirst(ClaimTypes.NameIdentifier)?.Value ?? User.FindFirst("sub")?.Value;
        if (!Guid.TryParse(tenantRaw, out tenantId) || tenantId == Guid.Empty)
        {
            error = "Tenant ID not found in token";
            return false;
        }
        if (!Guid.TryParse(userRaw, out userId) || userId == Guid.Empty)
        {
            error = "User ID not found in token";
            return false;
        }
        error = string.Empty;
        return true;
    }
}
