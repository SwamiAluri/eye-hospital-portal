using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using AuthService.Authorization;
using AuthService.Context;
using AuthService.Models.Domain;
using AuthService.Models.Identity;
using AuthService.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace AuthService.Controllers;

[ApiController]
[Route("api/laboratory/catalog")]
[Authorize]
public class LaboratoryCatalogController : ControllerBase
{
    /// <summary>FIN-VIS-01: existing Billing view permissions for Lab monetary amounts.</summary>
    private static readonly string[] LaboratoryFinancialViewPermissions = { "bill.view", "opd_bill.view" };

    private readonly AppDbContext _context;
    private readonly ILaboratoryCommercialMappingService _commercial;
    private readonly IPermissionService _permissions;

    public LaboratoryCatalogController(
        AppDbContext context,
        ILaboratoryCommercialMappingService commercial,
        IPermissionService? permissions = null)
    {
        _context = context;
        _commercial = commercial;
        _permissions = permissions ?? new PermissionService(context);
    }

    private Guid? GetTenantId() =>
        Guid.TryParse(User.FindFirst("TenantId")?.Value ?? User.FindFirst("tenant_id")?.Value, out var id) ? id : null;

    private Guid? GetUserId() =>
        Guid.TryParse(User.FindFirst("sub")?.Value ?? User.FindFirst("UserId")?.Value, out var id) ? id : null;

    private async Task<bool> CanViewLaboratoryFinancialAmountsAsync()
    {
        if (BillingMutationAuth.HasJwtPermission(User, LaboratoryFinancialViewPermissions))
            return true;

        var userId = GetUserId();
        var tenantId = GetTenantId();
        if (userId == null || tenantId == null)
            return false;

        foreach (var code in LaboratoryFinancialViewPermissions)
        {
            if (await _permissions.HasPermissionAsync(userId.Value, code, tenantId.Value))
                return true;
        }

        return false;
    }

    [HttpGet("tests")]
    [RequirePermission("patient.view")]
    public async Task<ActionResult> SearchTests(
        [FromQuery] string? search = null,
        [FromQuery] bool activeOnly = true,
        [FromQuery] int take = 50,
        CancellationToken cancellationToken = default)
    {
        var tenantId = GetTenantId();
        if (tenantId == null) return Unauthorized();

        var limit = Math.Clamp(take, 1, 100);
        var query = _context.LaboratoryTestDefinitions
            .AsNoTracking()
            .Include(t => t.SpecimenOptions)
            .Where(t => t.TenantId == tenantId.Value);

        if (activeOnly)
            query = query.Where(t => t.IsActive);

        if (!string.IsNullOrWhiteSpace(search))
        {
            var term = search.Trim().ToLower();
            query = query.Where(t =>
                t.Name.ToLower().Contains(term) ||
                t.LocalCode.ToLower().Contains(term) ||
                (t.Category != null && t.Category.ToLower().Contains(term)));
        }

        var rows = await query
            .OrderBy(t => t.Name)
            .Take(limit)
            .ToListAsync(cancellationToken);

        var mapped = new List<object>();
        foreach (var row in rows)
            mapped.Add(await MapTestAsync(tenantId.Value, row, cancellationToken));
        return Ok(mapped);
    }

    [HttpGet("tests/{id:guid}")]
    [RequirePermission("patient.view")]
    public async Task<ActionResult> GetTest(Guid id, CancellationToken cancellationToken = default)
    {
        var tenantId = GetTenantId();
        if (tenantId == null) return Unauthorized();

        var test = await _context.LaboratoryTestDefinitions
            .AsNoTracking()
            .Include(t => t.SpecimenOptions)
            .Include(t => t.Analytes)
            .FirstOrDefaultAsync(t => t.Id == id && t.TenantId == tenantId.Value, cancellationToken);

        if (test == null) return NotFound();
        return Ok(await MapTestDetailAsync(tenantId.Value, test, cancellationToken));
    }

    /// <summary>
    /// L3-COM-01 resolver-backed commercial read model (no unit prices — FIN-VIS).
    /// </summary>
    [HttpGet("tests/{id:guid}/commercial")]
    [RequirePermission("patient.view")]
    public async Task<ActionResult> GetCommercialState(Guid id, CancellationToken cancellationToken = default)
    {
        var tenantId = GetTenantId();
        if (tenantId == null) return Unauthorized();

        var test = await _context.LaboratoryTestDefinitions
            .AsNoTracking()
            .FirstOrDefaultAsync(t => t.Id == id && t.TenantId == tenantId.Value, cancellationToken);
        if (test == null) return NotFound();

        return Ok(await _commercial.GetCommercialStateAsync(tenantId.Value, test, cancellationToken));
    }

    /// <summary>
    /// L3-UX-01 read-only Order Summary / estimate for composition-time selections.
    /// Never creates OpdBill, charges, payments, or insurance claims.
    /// Monetary amounts require bill.view or opd_bill.view (FIN-VIS-01).
    /// </summary>
    [HttpPost("order-summary")]
    [RequirePermission("patient.view")]
    public async Task<ActionResult> GetOrderSummary(
        [FromBody] LaboratoryOrderSummaryRequest request,
        CancellationToken cancellationToken = default)
    {
        var tenantId = GetTenantId();
        if (tenantId == null) return Unauthorized();

        if (request?.Items == null || request.Items.Count == 0)
            return BadRequest(new { message = "At least one catalog test or panel is required." });

        var selections = new List<LaboratoryOrderSummarySelection>();
        foreach (var item in request.Items)
        {
            var hasTest = item.TestDefinitionId.HasValue && item.TestDefinitionId != Guid.Empty;
            var hasPanel = item.PanelId.HasValue && item.PanelId != Guid.Empty;
            if (hasTest == hasPanel)
                return BadRequest(new { message = "Each item must specify exactly one of testDefinitionId or panelId." });

            selections.Add(new LaboratoryOrderSummarySelection(
                hasTest ? item.TestDefinitionId : null,
                hasPanel ? item.PanelId : null));
        }

        var includeAmounts = await CanViewLaboratoryFinancialAmountsAsync();

        try
        {
            var summary = await _commercial.BuildOrderSummaryAsync(
                tenantId.Value,
                selections,
                includeAmounts,
                cancellationToken);
            return Ok(summary);
        }
        catch (KeyNotFoundException)
        {
            return NotFound(new { message = "Catalog selection not found for this tenant." });
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(new { message = ex.Message });
        }
    }

    /// <summary>
    /// L3-COM-01 map LaboratoryTestDefinition → active ServiceVariant (global catalog identity).
    /// </summary>
    [HttpPut("tests/{id:guid}/commercial/map")]
    [RequirePermission("patient.update")]
    public async Task<ActionResult> MapServiceVariant(
        Guid id,
        [FromBody] LaboratoryCommercialMapRequest request,
        CancellationToken cancellationToken = default)
    {
        var tenantId = GetTenantId();
        if (tenantId == null) return Unauthorized();
        if (request.ServiceVariantId == Guid.Empty)
            return BadRequest(new { message = "ServiceVariantId is required." });

        try
        {
            var state = await _commercial.MapServiceVariantAsync(
                tenantId.Value,
                GetUserId() ?? Guid.Empty,
                id,
                request.ServiceVariantId,
                cancellationToken);
            return Ok(state);
        }
        catch (KeyNotFoundException)
        {
            return NotFound();
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(new { message = ex.Message });
        }
    }

    /// <summary>L3-COM-01 remove ServiceVariant mapping (leaves UNMAPPED unless non-billable).</summary>
    [HttpDelete("tests/{id:guid}/commercial/map")]
    [RequirePermission("patient.update")]
    public async Task<ActionResult> UnmapServiceVariant(Guid id, CancellationToken cancellationToken = default)
    {
        var tenantId = GetTenantId();
        if (tenantId == null) return Unauthorized();

        try
        {
            var state = await _commercial.UnmapServiceVariantAsync(
                tenantId.Value,
                GetUserId() ?? Guid.Empty,
                id,
                cancellationToken);
            return Ok(state);
        }
        catch (KeyNotFoundException)
        {
            return NotFound();
        }
    }

    /// <summary>L3-COM-01 / COM-02 Option A — explicit non-billable catalog semantics.</summary>
    [HttpPut("tests/{id:guid}/commercial/non-billable")]
    [RequirePermission("patient.update")]
    public async Task<ActionResult> SetNonBillable(
        Guid id,
        [FromBody] LaboratoryNonBillableRequest request,
        CancellationToken cancellationToken = default)
    {
        var tenantId = GetTenantId();
        if (tenantId == null) return Unauthorized();

        try
        {
            var state = await _commercial.SetNonBillableAsync(
                tenantId.Value,
                GetUserId() ?? Guid.Empty,
                id,
                request.IsNonBillable,
                cancellationToken);
            return Ok(state);
        }
        catch (KeyNotFoundException)
        {
            return NotFound();
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(new { message = ex.Message });
        }
    }

    /// <summary>
    /// Active ServiceVariant picker for Laboratory catalog mapping (identity only — no prices).
    /// Service catalog is global; tenant isolation is enforced on LaboratoryTestDefinition mutations.
    /// Does not require bill.admin.
    /// </summary>
    [HttpGet("service-variants")]
    [RequirePermission("patient.update")]
    public async Task<ActionResult> SearchServiceVariants(
        [FromQuery] string? search = null,
        [FromQuery] int take = 20,
        CancellationToken cancellationToken = default)
    {
        var tenantId = GetTenantId();
        if (tenantId == null) return Unauthorized();

        var rows = await _commercial.SearchServiceVariantsAsync(search, take, cancellationToken);
        return Ok(rows);
    }

    [HttpGet("panels")]
    [RequirePermission("patient.view")]
    public async Task<ActionResult> SearchPanels(
        [FromQuery] string? search = null,
        [FromQuery] bool activeOnly = true,
        [FromQuery] int take = 50,
        CancellationToken cancellationToken = default)
    {
        var tenantId = GetTenantId();
        if (tenantId == null) return Unauthorized();

        var limit = Math.Clamp(take, 1, 100);
        var query = _context.LaboratoryPanels
            .AsNoTracking()
            .Where(p => p.TenantId == tenantId.Value);

        if (activeOnly)
            query = query.Where(p => p.IsActive);

        if (!string.IsNullOrWhiteSpace(search))
        {
            var term = search.Trim().ToLower();
            query = query.Where(p =>
                p.Name.ToLower().Contains(term) ||
                p.LocalCode.ToLower().Contains(term));
        }

        var rows = await query.OrderBy(p => p.Name).Take(limit).ToListAsync(cancellationToken);
        return Ok(rows.Select(MapPanelSummary));
    }

    [HttpGet("panels/{id:guid}")]
    [RequirePermission("patient.view")]
    public async Task<ActionResult> GetPanel(Guid id, CancellationToken cancellationToken = default)
    {
        var tenantId = GetTenantId();
        if (tenantId == null) return Unauthorized();

        var panel = await _context.LaboratoryPanels
            .AsNoTracking()
            .Include(p => p.Items)
            .ThenInclude(i => i.TestDefinition!)
            .ThenInclude(t => t.SpecimenOptions)
            .FirstOrDefaultAsync(p => p.Id == id && p.TenantId == tenantId.Value, cancellationToken);

        if (panel == null) return NotFound();
        return Ok(MapPanelDetail(panel));
    }

    /// <summary>Minimal catalog administration — create active test definition (no fake seeds).</summary>
    [HttpPost("tests")]
    [RequirePermission("patient.update")]
    public async Task<ActionResult> CreateTest([FromBody] LaboratoryTestDefinitionWriteRequest request)
    {
        var tenantId = GetTenantId();
        if (tenantId == null) return Unauthorized();

        if (string.IsNullOrWhiteSpace(request.Name) || string.IsNullOrWhiteSpace(request.LocalCode))
            return BadRequest(new { message = "Name and LocalCode are required." });

        if (request.SpecimenTypes == null || request.SpecimenTypes.Count == 0)
            return BadRequest(new { message = "At least one specimen type is required." });

        var code = request.LocalCode.Trim();
        var codeTaken = await _context.LaboratoryTestDefinitions
            .AnyAsync(t => t.TenantId == tenantId.Value && t.LocalCode.ToLower() == code.ToLower());
        if (codeTaken)
            return BadRequest(new { message = "A laboratory test with this local code already exists." });

        if (request.IsNonBillable && request.ServiceVariantId.HasValue)
            return BadRequest(new { message = "Non-billable tests cannot have a ServiceVariant mapping." });

        if (request.ServiceVariantId.HasValue)
        {
            var variantOk = await _context.ServiceVariants.AsNoTracking()
                .AnyAsync(v => v.Id == request.ServiceVariantId.Value && v.DeletedAt == null && v.IsActive);
            if (!variantOk)
                return BadRequest(new { message = "ServiceVariant not found or inactive." });
        }

        var entity = new LaboratoryTestDefinition
        {
            Id = Guid.NewGuid(),
            TenantId = tenantId.Value,
            Name = request.Name.Trim(),
            LocalCode = code,
            Description = string.IsNullOrWhiteSpace(request.Description) ? null : request.Description.Trim(),
            Category = string.IsNullOrWhiteSpace(request.Category) ? null : request.Category.Trim(),
            Method = string.IsNullOrWhiteSpace(request.Method) ? null : request.Method.Trim(),
            TurnaroundHours = request.TurnaroundHours,
            ServiceVariantId = request.IsNonBillable ? null : request.ServiceVariantId,
            IsNonBillable = request.IsNonBillable,
            IsActive = true,
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow,
            CreatedByUserId = GetUserId(),
        };

        var order = 0;
        foreach (var specimen in request.SpecimenTypes.Select(s => s.Trim()).Where(s => s.Length > 0).Distinct(StringComparer.OrdinalIgnoreCase))
        {
            entity.SpecimenOptions.Add(new LaboratoryTestSpecimenOption
            {
                Id = Guid.NewGuid(),
                TenantId = tenantId.Value,
                TestDefinitionId = entity.Id,
                SpecimenType = specimen,
                IsDefault = order == 0,
                DisplayOrder = order++,
            });
        }

        if (request.Analytes != null)
        {
            var aOrder = 0;
            foreach (var a in request.Analytes)
            {
                if (string.IsNullOrWhiteSpace(a.Name)) continue;
                entity.Analytes.Add(new LaboratoryAnalyte
                {
                    Id = Guid.NewGuid(),
                    TenantId = tenantId.Value,
                    TestDefinitionId = entity.Id,
                    Name = a.Name.Trim(),
                    LocalCode = string.IsNullOrWhiteSpace(a.LocalCode) ? null : a.LocalCode.Trim(),
                    ValueType = string.IsNullOrWhiteSpace(a.ValueType) ? "numeric" : a.ValueType.Trim(),
                    Unit = string.IsNullOrWhiteSpace(a.Unit) ? null : a.Unit.Trim(),
                    ReferenceRangeText = string.IsNullOrWhiteSpace(a.ReferenceRangeText) ? null : a.ReferenceRangeText.Trim(),
                    DisplayOrder = aOrder++,
                    IsActive = true,
                    CreatedAt = DateTime.UtcNow,
                    UpdatedAt = DateTime.UtcNow,
                });
            }
        }

        _context.LaboratoryTestDefinitions.Add(entity);
        await _context.SaveChangesAsync();

        return CreatedAtAction(
            nameof(GetTest),
            new { id = entity.Id },
            await MapTestDetailAsync(tenantId.Value, entity, CancellationToken.None));
    }

    [HttpPost("panels")]
    [RequirePermission("patient.update")]
    public async Task<ActionResult> CreatePanel([FromBody] LaboratoryPanelWriteRequest request)
    {
        var tenantId = GetTenantId();
        if (tenantId == null) return Unauthorized();

        if (string.IsNullOrWhiteSpace(request.Name) || string.IsNullOrWhiteSpace(request.LocalCode))
            return BadRequest(new { message = "Name and LocalCode are required." });

        if (request.TestDefinitionIds == null || request.TestDefinitionIds.Count == 0)
            return BadRequest(new { message = "Panel must include at least one test definition." });

        var distinctIds = request.TestDefinitionIds.Distinct().ToList();
        var tests = await _context.LaboratoryTestDefinitions
            .Where(t => t.TenantId == tenantId.Value && distinctIds.Contains(t.Id) && t.IsActive)
            .ToListAsync();

        if (tests.Count != distinctIds.Count)
            return BadRequest(new { message = "One or more test definitions are missing or inactive." });

        var panel = new LaboratoryPanel
        {
            Id = Guid.NewGuid(),
            TenantId = tenantId.Value,
            Name = request.Name.Trim(),
            LocalCode = request.LocalCode.Trim(),
            Description = string.IsNullOrWhiteSpace(request.Description) ? null : request.Description.Trim(),
            Category = string.IsNullOrWhiteSpace(request.Category) ? null : request.Category.Trim(),
            IsActive = true,
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow,
            CreatedByUserId = GetUserId(),
        };

        var order = 0;
        foreach (var testId in distinctIds)
        {
            panel.Items.Add(new LaboratoryPanelItem
            {
                Id = Guid.NewGuid(),
                TenantId = tenantId.Value,
                PanelId = panel.Id,
                TestDefinitionId = testId,
                DisplayOrder = order++,
                IsRequired = true,
            });
        }

        _context.LaboratoryPanels.Add(panel);
        await _context.SaveChangesAsync();

        var loaded = await _context.LaboratoryPanels
            .AsNoTracking()
            .Include(p => p.Items)
            .ThenInclude(i => i.TestDefinition!)
            .ThenInclude(t => t.SpecimenOptions)
            .FirstAsync(p => p.Id == panel.Id);

        return CreatedAtAction(nameof(GetPanel), new { id = panel.Id }, MapPanelDetail(loaded));
    }

    /// <summary>
    /// L2 ordering-clinician lookup for Laboratory order entry.
    /// Uses patient.view (Lab Technician already has this) — not user.view.
    /// Same least-privilege pattern as CounselingController surgeons/anesthetists.
    /// Does not invent a new IAM permission. UsersController /users/doctors/search remains user.view.
    /// Returns active Doctor-role users only (no full user directory).
    /// </summary>
    [HttpGet("ordering-clinicians")]
    [RequirePermission("patient.view")]
    public async Task<ActionResult> SearchOrderingClinicians(
        [FromQuery] string? search = null,
        [FromQuery] int take = 20,
        CancellationToken cancellationToken = default)
    {
        var tenantId = GetTenantId();
        if (tenantId == null) return Unauthorized();

        var limit = Math.Clamp(take, 1, 50);
        var term = string.IsNullOrWhiteSpace(search) ? null : search.Trim();

        // Least-privilege doctor discovery (Counsellor surgeons pattern + CreateFromCatalog gate).
        // Prefer role name containing Doctor; fall back to UserType for sparse UAT tenants.
        var roleDoctorIds = await (
            from ur in _context.UserRoles.Cast<AppUserRole>()
            join r in _context.Roles on ur.RoleId equals r.Id
            join u in _context.Users on ur.UserId equals u.Id
            where u.TenantId == tenantId.Value
                  && u.DeletedAt == null
                  && u.UserStatus == "active"
                  && r.Name != null && r.Name.Contains("Doctor")
            select u.Id).Distinct().ToListAsync(cancellationToken);

        List<Guid> doctorIds = roleDoctorIds;
        if (doctorIds.Count == 0)
        {
            doctorIds = await _context.Users
                .Where(u => u.TenantId == tenantId.Value
                            && u.DeletedAt == null
                            && u.UserStatus == "active"
                            && (u.UserType == "Doctor" || u.UserType == "Surgeon" || u.UserType == "Ophthalmologist"))
                .Select(u => u.Id)
                .ToListAsync(cancellationToken);
        }

        var doctors = await _context.Users
            .AsNoTracking()
            .Where(u => doctorIds.Contains(u.Id))
            .OrderBy(u => u.LastName).ThenBy(u => u.FirstName)
            .ToListAsync(cancellationToken);

        if (term != null)
        {
            doctors = doctors
                .Where(u =>
                    (u.FirstName != null && u.FirstName.Contains(term, StringComparison.OrdinalIgnoreCase)) ||
                    (u.LastName != null && u.LastName.Contains(term, StringComparison.OrdinalIgnoreCase)) ||
                    (u.LicenseNumber != null && u.LicenseNumber.Contains(term, StringComparison.OrdinalIgnoreCase)) ||
                    (u.Email != null && u.Email.Contains(term, StringComparison.OrdinalIgnoreCase)))
                .Take(limit)
                .ToList();
        }
        else
        {
            doctors = doctors.Take(limit).ToList();
        }

        var results = doctors.Select(d => new
        {
            id = d.Id,
            fullName = $"{d.FirstName ?? ""} {d.LastName ?? ""}".Trim(),
            firstName = d.FirstName,
            lastName = d.LastName,
            specialization = d.Specialization ?? "General Medicine",
            department = "",
            qualification = d.Qualifications,
            licenseNumber = d.LicenseNumber,
            email = d.Email,
            phoneNumber = d.PhoneNumber,
        }).ToList();

        return Ok(new { data = results, count = results.Count });
    }

    private async Task<object> MapTestAsync(
        Guid tenantId,
        LaboratoryTestDefinition t,
        CancellationToken cancellationToken)
    {
        var commercial = await _commercial.GetCommercialStateAsync(tenantId, t, cancellationToken);
        return new
        {
            t.Id,
            t.Name,
            t.LocalCode,
            t.Description,
            t.Category,
            t.Method,
            t.TurnaroundHours,
            t.ServiceVariantId,
            t.IsNonBillable,
            t.IsActive,
            kind = "test",
            commercialState = commercial.CommercialState,
            serviceVariantCode = commercial.ServiceVariantCode,
            serviceVariantName = commercial.ServiceVariantName,
            financiallyActionable = commercial.FinanciallyActionable,
            specimenTypes = t.SpecimenOptions
                .OrderBy(o => o.DisplayOrder)
                .Select(o => new { o.SpecimenType, o.IsDefault })
                .ToList(),
        };
    }

    private async Task<object> MapTestDetailAsync(
        Guid tenantId,
        LaboratoryTestDefinition t,
        CancellationToken cancellationToken)
    {
        var commercial = await _commercial.GetCommercialStateAsync(tenantId, t, cancellationToken);
        return new
        {
            t.Id,
            t.Name,
            t.LocalCode,
            t.Description,
            t.Category,
            t.Method,
            t.TurnaroundHours,
            t.ServiceVariantId,
            t.IsNonBillable,
            t.IsActive,
            kind = "test",
            commercialState = commercial.CommercialState,
            serviceVariantCode = commercial.ServiceVariantCode,
            serviceVariantName = commercial.ServiceVariantName,
            financiallyActionable = commercial.FinanciallyActionable,
            resolverKind = commercial.ResolverKind,
            specimenTypes = t.SpecimenOptions
                .OrderBy(o => o.DisplayOrder)
                .Select(o => new { o.SpecimenType, o.IsDefault })
                .ToList(),
            analytes = t.Analytes
                .Where(a => a.DeletedAt == null && a.IsActive)
                .OrderBy(a => a.DisplayOrder)
                .Select(a => new
                {
                    a.Id,
                    a.Name,
                    a.LocalCode,
                    a.ValueType,
                    a.Unit,
                    a.ReferenceRangeText,
                    a.DisplayOrder,
                })
                .ToList(),
        };
    }

    private static object MapTestSummary(LaboratoryTestDefinition t) => new
    {
        t.Id,
        t.Name,
        t.LocalCode,
        t.Description,
        t.Category,
        t.Method,
        t.TurnaroundHours,
        t.ServiceVariantId,
        t.IsNonBillable,
        t.IsActive,
        kind = "test",
        specimenTypes = t.SpecimenOptions
            .OrderBy(o => o.DisplayOrder)
            .Select(o => new { o.SpecimenType, o.IsDefault })
            .ToList(),
    };

    private static object MapPanelSummary(LaboratoryPanel p) => new
    {
        p.Id,
        p.Name,
        p.LocalCode,
        p.Description,
        p.Category,
        p.IsActive,
        kind = "panel",
    };

    private static object MapPanelDetail(LaboratoryPanel p) => new
    {
        p.Id,
        p.Name,
        p.LocalCode,
        p.Description,
        p.Category,
        p.IsActive,
        kind = "panel",
        items = p.Items
            .OrderBy(i => i.DisplayOrder)
            .Select(i => new
            {
                i.TestDefinitionId,
                i.DisplayOrder,
                i.IsRequired,
                test = i.TestDefinition == null ? null : MapTestSummary(i.TestDefinition),
            })
            .ToList(),
    };
}

public class LaboratoryTestDefinitionWriteRequest
{
    public string Name { get; set; } = string.Empty;
    public string LocalCode { get; set; } = string.Empty;
    public string? Description { get; set; }
    public string? Category { get; set; }
    public string? Method { get; set; }
    public int? TurnaroundHours { get; set; }
    public Guid? ServiceVariantId { get; set; }
    public bool IsNonBillable { get; set; }
    public List<string> SpecimenTypes { get; set; } = new();
    public List<LaboratoryAnalyteWriteRequest>? Analytes { get; set; }
}

public class LaboratoryCommercialMapRequest
{
    public Guid ServiceVariantId { get; set; }
}

public class LaboratoryNonBillableRequest
{
    public bool IsNonBillable { get; set; }
}

/// <summary>L3-UX-01 composition selections for read-only Order Summary.</summary>
public class LaboratoryOrderSummaryRequest
{
    public List<LaboratoryOrderSummaryItemRequest> Items { get; set; } = new();
}

public class LaboratoryOrderSummaryItemRequest
{
    public Guid? TestDefinitionId { get; set; }
    public Guid? PanelId { get; set; }
}

public class LaboratoryAnalyteWriteRequest
{
    public string Name { get; set; } = string.Empty;
    public string? LocalCode { get; set; }
    public string? ValueType { get; set; }
    public string? Unit { get; set; }
    public string? ReferenceRangeText { get; set; }
}

public class LaboratoryPanelWriteRequest
{
    public string Name { get; set; } = string.Empty;
    public string LocalCode { get; set; } = string.Empty;
    public string? Description { get; set; }
    public string? Category { get; set; }
    public List<Guid> TestDefinitionIds { get; set; } = new();
}
