using AuthService.Context;
using AuthService.Services;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace AuthService.Controllers;

/// <summary>
/// Internal read/validate adapters for LaboratoryApi LMS Order Intake (L-ORD-01B),
/// Collection assignee eligibility (L-COL-01B / PD-COL-OWN-05),
/// and Complete Collection branch authorization (L-COL-01C).
/// Does not expose write APIs and does not create LMS masters.
/// Auth: <c>X-Internal-Key</c> + matching <c>X-Tenant-ID</c>.
/// </summary>
[ApiController]
[Route("api/internal/lms")]
public class InternalLmsReferenceController : ControllerBase
{
    private readonly AppDbContext _db;
    private readonly IConfiguration _config;
    private readonly IPermissionService _permissions;
    private readonly IFollowupBranchAccessService _branchAccess;
    private readonly ILogger<InternalLmsReferenceController> _log;

    public InternalLmsReferenceController(
        AppDbContext db,
        IConfiguration config,
        IPermissionService permissions,
        IFollowupBranchAccessService branchAccess,
        ILogger<InternalLmsReferenceController> log)
    {
        _db = db;
        _config = config;
        _permissions = permissions;
        _branchAccess = branchAccess;
        _log = log;
    }

    public record PatientValidateRequest(Guid PatientId);
    public record VisitValidateRequest(Guid VisitId, Guid PatientId, Guid? OperatingBranchId);
    /// <param name="RequiredPermission">
    /// Optional. When set (e.g. <c>lms.collection.collect</c>), user must hold that capability
    /// (or <c>*</c>) via existing PermissionService — no new roles/grants.
    /// </param>
    public record UserValidateRequest(Guid UserId, string? RequiredPermission = null);
    public record UserBranchValidateRequest(Guid UserId, Guid BranchId);

    public record PatientValidateResponse(
        Guid PatientId,
        string Mrn,
        string DisplayName,
        DateTime DateOfBirth);

    public record VisitValidateResponse(
        Guid VisitId,
        Guid PatientId,
        Guid BranchId,
        string Status);

    public record UserValidateResponse(
        Guid UserId,
        string DisplayName,
        string UserStatus);

    public record UserBranchValidateResponse(
        Guid UserId,
        Guid BranchId,
        bool Authorized);

    [HttpPost("validate-patient")]
    public async Task<IActionResult> ValidatePatient([FromBody] PatientValidateRequest req, CancellationToken ct)
    {
        if (!IsAuthorized()) return Unauthorized(new { error = "Invalid or missing internal API key." });
        if (!TryGetHeaderTenant(out var tenantId))
            return BadRequest(new { error = "X-Tenant-ID header is required." });
        if (req.PatientId == Guid.Empty)
            return BadRequest(new { error = "PatientId is required.", code = "patient_required" });

        var p = await _db.Patients.AsNoTracking()
            .FirstOrDefaultAsync(x =>
                x.Id == req.PatientId &&
                x.TenantId == tenantId &&
                x.DeletedAt == null, ct);

        if (p is null)
            return NotFound(new { error = "Patient not found in tenant.", code = "patient_not_found" });

        var name = string.Join(" ", new[] { p.FirstName, p.MiddleName, p.LastName }
            .Where(s => !string.IsNullOrWhiteSpace(s))).Trim();
        if (string.IsNullOrWhiteSpace(name))
            name = p.MedicalRecordNumber;

        return Ok(new PatientValidateResponse(p.Id, p.MedicalRecordNumber, name, p.DateOfBirth));
    }

    [HttpPost("validate-visit")]
    public async Task<IActionResult> ValidateVisit([FromBody] VisitValidateRequest req, CancellationToken ct)
    {
        if (!IsAuthorized()) return Unauthorized(new { error = "Invalid or missing internal API key." });
        if (!TryGetHeaderTenant(out var tenantId))
            return BadRequest(new { error = "X-Tenant-ID header is required." });
        if (req.VisitId == Guid.Empty || req.PatientId == Guid.Empty)
            return BadRequest(new { error = "VisitId and PatientId are required.", code = "visit_required" });

        var v = await _db.Visits.AsNoTracking()
            .FirstOrDefaultAsync(x =>
                x.Id == req.VisitId &&
                x.TenantId == tenantId, ct);

        if (v is null)
            return NotFound(new { error = "Visit not found in tenant.", code = "visit_not_found" });
        if (v.PatientId != req.PatientId)
            return BadRequest(new { error = "Visit does not belong to the selected patient.", code = "visit_patient_mismatch" });
        if (string.Equals(v.Status, "cancelled", StringComparison.OrdinalIgnoreCase))
            return BadRequest(new { error = "Visit is cancelled.", code = "visit_cancelled" });

        // PD-ORD-01 / PD-ORD-04: when operating branch supplied, visit branch must match.
        if (req.OperatingBranchId is { } opBranch && opBranch != Guid.Empty && v.BranchId != opBranch)
            return BadRequest(new
            {
                error = "Visit branch does not match the operating branch.",
                code = "visit_branch_mismatch",
            });

        return Ok(new VisitValidateResponse(v.Id, v.PatientId, v.BranchId, v.Status));
    }

    [HttpPost("validate-user")]
    public async Task<IActionResult> ValidateUser([FromBody] UserValidateRequest req, CancellationToken ct)
    {
        if (!IsAuthorized()) return Unauthorized(new { error = "Invalid or missing internal API key." });
        if (!TryGetHeaderTenant(out var tenantId))
            return BadRequest(new { error = "X-Tenant-ID header is required." });
        if (req.UserId == Guid.Empty)
            return BadRequest(new { error = "UserId is required.", code = "user_required" });

        // PD-ORD-02: existence + tenant + active only. No role-name "Doctor" heuristic.
        var u = await _db.Users.AsNoTracking()
            .FirstOrDefaultAsync(x =>
                x.Id == req.UserId &&
                x.TenantId == tenantId &&
                x.DeletedAt == null, ct);

        if (u is null)
            return NotFound(new { error = "User not found in tenant.", code = "user_not_found" });

        if (!string.Equals(u.UserStatus, "active", StringComparison.OrdinalIgnoreCase))
            return BadRequest(new { error = "User is not active.", code = "user_inactive" });

        // PD-COL-OWN-05 (optional): capability check via existing HasPermissionAsync (* or exact code).
        if (!string.IsNullOrWhiteSpace(req.RequiredPermission))
        {
            var code = req.RequiredPermission.Trim();
            var allowed = await _permissions.HasPermissionAsync(u.Id, code, tenantId);
            if (!allowed)
                return BadRequest(new
                {
                    error = "User is not authorized for the required Collection capability.",
                    code = "user_lacks_permission",
                });
        }

        var display = $"{u.FirstName} {u.LastName}".Trim();
        if (string.IsNullOrWhiteSpace(display))
            display = u.Email ?? u.Id.ToString("D");

        return Ok(new UserValidateResponse(u.Id, display, u.UserStatus));
    }

    /// <summary>
    /// L-COL-01C — authorize caller for CollectionTask.CollectionBranchId via existing
    /// <see cref="IFollowupBranchAccessService"/> (active user_branches + primary BranchId).
    /// </summary>
    [HttpPost("validate-user-branch")]
    public async Task<IActionResult> ValidateUserBranch(
        [FromBody] UserBranchValidateRequest req, CancellationToken ct)
    {
        if (!IsAuthorized()) return Unauthorized(new { error = "Invalid or missing internal API key." });
        if (!TryGetHeaderTenant(out var tenantId))
            return BadRequest(new { error = "X-Tenant-ID header is required." });
        if (req.UserId == Guid.Empty)
            return BadRequest(new { error = "UserId is required.", code = "user_required" });
        if (req.BranchId == Guid.Empty)
            return BadRequest(new { error = "BranchId is required.", code = "branch_required" });

        var u = await _db.Users.AsNoTracking()
            .FirstOrDefaultAsync(x =>
                x.Id == req.UserId &&
                x.TenantId == tenantId &&
                x.DeletedAt == null, ct);

        if (u is null)
            return NotFound(new { error = "User not found in tenant.", code = "user_not_found" });

        if (!string.Equals(u.UserStatus, "active", StringComparison.OrdinalIgnoreCase))
            return BadRequest(new { error = "User is not active.", code = "user_inactive" });

        try
        {
            await _branchAccess.ResolveAccessibleBranchesAsync(tenantId, req.UserId, req.BranchId, ct);
        }
        catch (UnauthorizedAccessException)
        {
            return StatusCode(StatusCodes.Status403Forbidden, new
            {
                error = "User is not authorized for the collection branch.",
                code = "branch_unauthorized",
            });
        }

        return Ok(new UserBranchValidateResponse(req.UserId, req.BranchId, Authorized: true));
    }

    public record MasterValueValidateRequest(string EntityType, string Code);
    public record MasterValueValidateResponse(
        string EntityType,
        string Code,
        string Label,
        bool IsActive,
        int SortOrder);

    /// <summary>L-COL-01D — validate a tenant MasterValue code (e.g. rejection reason).</summary>
    [HttpPost("validate-master-value")]
    public async Task<IActionResult> ValidateMasterValue(
        [FromBody] MasterValueValidateRequest req, CancellationToken ct)
    {
        if (!IsAuthorized()) return Unauthorized(new { error = "Invalid or missing internal API key." });
        if (!TryGetHeaderTenant(out var tenantId))
            return BadRequest(new { error = "X-Tenant-ID header is required." });
        if (string.IsNullOrWhiteSpace(req.EntityType) || string.IsNullOrWhiteSpace(req.Code))
            return BadRequest(new { error = "EntityType and Code are required.", code = "master_value_required" });

        var entityType = req.EntityType.Trim();
        var code = req.Code.Trim();

        var row = await _db.MasterValues.AsNoTracking()
            .FirstOrDefaultAsync(x =>
                x.TenantId == tenantId
                && x.EntityType == entityType
                && x.Code == code
                && x.DeletedAt == null, ct);

        if (row is null)
            return NotFound(new { error = "Master value not found.", code = "invalid_rejection_reason" });

        if (!row.IsActive)
            return BadRequest(new
            {
                error = "Master value is inactive and cannot be selected.",
                code = "rejection_reason_inactive",
            });

        return Ok(new MasterValueValidateResponse(
            row.EntityType, row.Code, row.Label, row.IsActive, row.SortOrder));
    }

    /// <summary>L-COL-01D — list MasterValues for an entity type (activeOnly default true).</summary>
    [HttpGet("master-values")]
    public async Task<IActionResult> ListMasterValues(
        [FromQuery] string entityType,
        [FromQuery] bool activeOnly = true,
        CancellationToken ct = default)
    {
        if (!IsAuthorized()) return Unauthorized(new { error = "Invalid or missing internal API key." });
        if (!TryGetHeaderTenant(out var tenantId))
            return BadRequest(new { error = "X-Tenant-ID header is required." });
        if (string.IsNullOrWhiteSpace(entityType))
            return BadRequest(new { error = "entityType is required.", code = "master_value_required" });

        var type = entityType.Trim();
        var q = _db.MasterValues.AsNoTracking()
            .Where(x => x.TenantId == tenantId && x.EntityType == type && x.DeletedAt == null);
        if (activeOnly)
            q = q.Where(x => x.IsActive);

        var rows = await q.OrderBy(x => x.SortOrder).ThenBy(x => x.Code)
            .Select(x => new MasterValueValidateResponse(
                x.EntityType, x.Code, x.Label, x.IsActive, x.SortOrder))
            .ToListAsync(ct);

        return Ok(rows);
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
        return Guid.TryParse(vals.ToString(), out tenantId) && tenantId != Guid.Empty;
    }
}
