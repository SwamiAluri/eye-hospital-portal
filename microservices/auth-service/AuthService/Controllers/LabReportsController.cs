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
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace AuthService.Controllers;

[ApiController]
[Route("api/lab-reports")]
[Authorize]
public class LabReportsController : ControllerBase
{
    private readonly AppDbContext _context;
    private readonly ILabReportCanonicalDocumentService _labDocuments;
    private readonly ILogger<LabReportsController> _logger;

    public LabReportsController(
        AppDbContext context,
        ILabReportCanonicalDocumentService labDocuments,
        ILogger<LabReportsController> logger)
    {
        _context = context;
        _labDocuments = labDocuments;
        _logger = logger;
    }

    private Guid? GetTenantId() => Guid.TryParse(User.FindFirst("TenantId")?.Value ?? User.FindFirst("tenant_id")?.Value, out var id) ? id : null;
    private Guid? GetUserId() => Guid.TryParse(User.FindFirst("sub")?.Value ?? User.FindFirst("UserId")?.Value, out var id) ? id : null;

    /// <summary>
    /// Tenant-scoped laboratory worklist. Soft-deleted rows excluded via EF query filter.
    /// </summary>
    [HttpGet]
    [RequirePermission("patient.view")]
    public async Task<ActionResult> List(
        [FromQuery] string? status = null,
        [FromQuery] string? category = null,
        [FromQuery] string? priority = null,
        [FromQuery] string? search = null,
        [FromQuery] int take = 100,
        CancellationToken cancellationToken = default)
    {
        var tenantId = GetTenantId();
        if (tenantId == null) return Unauthorized();

        var limit = Math.Clamp(take, 1, 200);

        var query =
            from lab in _context.LabReports
            join patient in _context.Patients on lab.PatientId equals patient.Id
            where lab.TenantId == tenantId.Value && patient.TenantId == tenantId.Value
            select new { lab, patient };

        if (!string.IsNullOrWhiteSpace(status))
            query = query.Where(x => x.lab.Status == status);

        if (!string.IsNullOrWhiteSpace(category))
            query = query.Where(x => x.lab.TestCategory == category);

        if (!string.IsNullOrWhiteSpace(priority))
            query = query.Where(x => x.lab.Priority == priority);

        if (!string.IsNullOrWhiteSpace(search))
        {
            var term = search.Trim().ToLower();
            query = query.Where(x =>
                x.lab.TestName.ToLower().Contains(term) ||
                (x.lab.TestCode != null && x.lab.TestCode.ToLower().Contains(term)) ||
                x.patient.MedicalRecordNumber.ToLower().Contains(term) ||
                x.patient.FirstName.ToLower().Contains(term) ||
                x.patient.LastName.ToLower().Contains(term));
        }

        var rows = await query
            .OrderByDescending(x => x.lab.OrderedAt ?? x.lab.CreatedAt)
            .Take(limit)
            .ToListAsync(cancellationToken);

        var reports = rows.Select(x =>
        {
            x.lab.PatientDisplayName = $"{x.patient.FirstName} {x.patient.LastName}".Trim();
            x.lab.MedicalRecordNumber = x.patient.MedicalRecordNumber;
            return x.lab;
        }).ToList();

        return Ok(reports);
    }

    [HttpGet("patient/{patientId:guid}")]
    [RequirePermission("patient.view")]
    public async Task<ActionResult> GetByPatient(
        Guid patientId,
        [FromQuery] string? status = null,
        [FromQuery] string? category = null,
        CancellationToken cancellationToken = default)
    {
        var tenantId = GetTenantId();
        if (tenantId == null) return Unauthorized();

        var query = _context.LabReports
            .Where(l => l.TenantId == tenantId.Value && l.PatientId == patientId);

        if (!string.IsNullOrEmpty(status))
            query = query.Where(l => l.Status == status);

        if (!string.IsNullOrEmpty(category))
            query = query.Where(l => l.TestCategory == category);

        var reports = await query.OrderByDescending(l => l.OrderedAt ?? l.CreatedAt).ToListAsync(cancellationToken);
        await _labDocuments.PopulateCanonicalAsync(tenantId.Value, reports, cancellationToken);
        return Ok(reports);
    }

    [HttpGet("{id:guid}")]
    [RequirePermission("patient.view")]
    public async Task<ActionResult> GetById(Guid id, CancellationToken cancellationToken = default)
    {
        var tenantId = GetTenantId();
        if (tenantId == null) return Unauthorized();

        var report = await _context.LabReports
            .Include(l => l.Items.OrderBy(i => i.DisplayOrder))
            .FirstOrDefaultAsync(l => l.Id == id && l.TenantId == tenantId.Value, cancellationToken);

        if (report == null) return NotFound();
        await _labDocuments.PopulateCanonicalAsync(tenantId.Value, new[] { report }, cancellationToken);
        return Ok(report);
    }

    [HttpPost]
    [RequirePermission("patient.update")]
    public async Task<ActionResult> Create([FromBody] LabReport request)
    {
        var tenantId = GetTenantId();
        if (tenantId == null) return Unauthorized();

        if (request.PatientId == Guid.Empty)
            return BadRequest(new { message = "PatientId is required." });

        // Same tenant + soft-delete patient gate used by Counseling/Prescription create paths.
        // Cross-tenant ids resolve as not found (no existence leak).
        var patient = await _context.Patients.AsNoTracking()
            .FirstOrDefaultAsync(p =>
                p.Id == request.PatientId &&
                p.TenantId == tenantId.Value &&
                p.DeletedAt == null);

        if (patient == null)
            return BadRequest(new { message = "Patient not found in this tenant." });

        // Legacy free-text create: do not accept catalog FKs via this path (use catalog-order).
        request.TestDefinitionId = null;
        request.PanelId = null;
        request.Items = new List<LabReportItem>();

        request.Id = Guid.NewGuid();
        request.TenantId = tenantId.Value;
        if (string.IsNullOrWhiteSpace(request.Status))
            request.Status = "ordered";
        if (string.IsNullOrWhiteSpace(request.Priority))
            request.Priority = "routine";
        if (request.OrderedAt == null)
            request.OrderedAt = DateTime.UtcNow;
        request.CreatedAt = DateTime.UtcNow;
        request.UpdatedAt = DateTime.UtcNow;
        request.CreatedByUserId = GetUserId();

        _context.LabReports.Add(request);
        await _context.SaveChangesAsync();

        return CreatedAtAction(nameof(GetById), new { id = request.Id }, request);
    }

    /// <summary>
    /// L2 catalog-driven order. Server derives name/code/category/specimen from catalog; client metadata ignored.
    /// Accepts legacy single TestDefinitionId/PanelId or Items[] for multi-test one LabReport.
    /// </summary>
    [HttpPost("catalog-order")]
    [RequirePermission("patient.update")]
    public async Task<ActionResult> CreateFromCatalog([FromBody] LaboratoryCatalogOrderRequest request)
    {
        var tenantId = GetTenantId();
        if (tenantId == null) return Unauthorized();

        if (request.PatientId == Guid.Empty)
            return BadRequest(new { message = "PatientId is required." });

        if (request.OrderedById == Guid.Empty)
            return BadRequest(new { message = "Ordering clinician is required." });

        if (string.IsNullOrWhiteSpace(request.ClinicalIndication))
            return BadRequest(new { message = "Clinical indication / reason is required." });

        var lines = NormalizeCatalogOrderLines(request);
        if (lines == null)
            return BadRequest(new { message = "Specify Items with one or more catalog selections, or exactly one of TestDefinitionId or PanelId." });
        if (lines.Count == 0)
            return BadRequest(new { message = "At least one catalog test or panel is required." });

        var selectionKeys = lines.Select(l =>
            l.TestDefinitionId.HasValue ? $"test:{l.TestDefinitionId}" : $"panel:{l.PanelId}").ToList();
        if (selectionKeys.Count != selectionKeys.Distinct(StringComparer.Ordinal).Count())
            return BadRequest(new { message = "Duplicate test or panel selection is not allowed in one order." });

        var patient = await _context.Patients.AsNoTracking()
            .FirstOrDefaultAsync(p =>
                p.Id == request.PatientId &&
                p.TenantId == tenantId.Value &&
                p.DeletedAt == null);
        if (patient == null)
            return BadRequest(new { message = "Patient not found in this tenant." });

        if (request.VisitId.HasValue)
        {
            var visitOk = await _context.Visits.AsNoTracking()
                .AnyAsync(v => v.Id == request.VisitId.Value && v.PatientId == request.PatientId && v.TenantId == tenantId.Value);
            if (!visitOk)
                return BadRequest(new { message = "Visit not found for this patient." });
        }

        var doctorOk = await (
            from u in _context.Users
            join ur in _context.UserRoles.Cast<AppUserRole>() on u.Id equals ur.UserId
            join r in _context.Roles on ur.RoleId equals r.Id
            where u.Id == request.OrderedById
                  && u.TenantId == tenantId.Value
                  && u.DeletedAt == null
                  && u.UserStatus == "active"
                  && r.Name != null && r.Name.Contains("Doctor")
            select u.Id).AnyAsync();
        if (!doctorOk)
            return BadRequest(new { message = "Ordering clinician must be an active doctor in this tenant." });

        var doctor = await _context.Users.AsNoTracking().FirstAsync(u => u.Id == request.OrderedById);
        var doctorName = $"{doctor.FirstName} {doctor.LastName}".Trim();
        if (string.IsNullOrWhiteSpace(doctorName))
            doctorName = doctor.Email ?? request.OrderedById.ToString();

        var priority = string.IsNullOrWhiteSpace(request.Priority) ? "routine" : request.Priority.Trim();
        if (priority is not ("routine" or "urgent" or "stat"))
            return BadRequest(new { message = "Priority must be routine, urgent, or stat." });

        LaboratoryTestDefinition? singleTestHeader = null;
        LaboratoryPanel? singlePanelHeader = null;
        var memberDefs = new List<LaboratoryTestDefinition>();
        var lineDisplayNames = new List<string>();

        foreach (var line in lines)
        {
            if (line.TestDefinitionId.HasValue)
            {
                var test = await _context.LaboratoryTestDefinitions
                    .Include(t => t.SpecimenOptions)
                    .FirstOrDefaultAsync(t =>
                        t.Id == line.TestDefinitionId.Value &&
                        t.TenantId == tenantId.Value &&
                        t.IsActive);
                if (test == null)
                    return BadRequest(new { message = "Test definition not found or inactive." });

                memberDefs.Add(test);
                lineDisplayNames.Add(test.Name);
                if (lines.Count == 1)
                    singleTestHeader = test;
            }
            else
            {
                var panel = await _context.LaboratoryPanels
                    .Include(p => p.Items)
                    .ThenInclude(i => i.TestDefinition!)
                    .ThenInclude(t => t.SpecimenOptions)
                    .FirstOrDefaultAsync(p =>
                        p.Id == line.PanelId!.Value &&
                        p.TenantId == tenantId.Value &&
                        p.IsActive);
                if (panel == null)
                    return BadRequest(new { message = "Panel not found or inactive." });

                var panelTests = panel.Items
                    .Where(i => i.TestDefinition != null && i.TestDefinition.IsActive && i.TestDefinition.DeletedAt == null)
                    .OrderBy(i => i.DisplayOrder)
                    .Select(i => i.TestDefinition!)
                    .ToList();
                if (panelTests.Count == 0)
                    return BadRequest(new { message = "Panel has no active member tests." });

                memberDefs.AddRange(panelTests);
                lineDisplayNames.Add(panel.Name);
                if (lines.Count == 1)
                    singlePanelHeader = panel;
            }
        }

        var expandedIds = memberDefs.Select(d => d.Id).ToList();
        if (expandedIds.Count != expandedIds.Distinct().Count())
            return BadRequest(new { message = "Duplicate catalog test is not allowed in one order." });

        var allowedSpecimens = memberDefs
            .SelectMany(t => t.SpecimenOptions.Select(o => o.SpecimenType))
            .Distinct(StringComparer.OrdinalIgnoreCase)
            .ToList();

        string? specimenType = null;
        var anyMultiSpecimen = memberDefs.Any(t => t.SpecimenOptions.Count > 1);
        if (allowedSpecimens.Count == 1)
        {
            specimenType = allowedSpecimens[0];
        }
        else if (allowedSpecimens.Count > 1 && (anyMultiSpecimen || lines.Count == 1))
        {
            // Single catalog selection with multiple specimen options still requires an explicit choice.
            // Multi-test orders with differing single-specimen tests keep header specimen null (metadata per item).
            if (lines.Count == 1 || anyMultiSpecimen)
            {
                if (string.IsNullOrWhiteSpace(request.SpecimenType) ||
                    !allowedSpecimens.Any(s => string.Equals(s, request.SpecimenType.Trim(), StringComparison.OrdinalIgnoreCase)))
                {
                    return BadRequest(new
                    {
                        message = "Specimen type is required and must be valid for the selected catalog item.",
                        allowedSpecimenTypes = allowedSpecimens
                    });
                }
                specimenType = allowedSpecimens.First(s =>
                    string.Equals(s, request.SpecimenType.Trim(), StringComparison.OrdinalIgnoreCase));
            }
        }

        var isMultiLine = lines.Count > 1;
        var headerName = isMultiLine
            ? TruncateLabName(string.Join(" + ", lineDisplayNames))
            : (singleTestHeader?.Name ?? singlePanelHeader!.Name);
        var headerCode = isMultiLine ? null : (singleTestHeader?.LocalCode ?? singlePanelHeader!.LocalCode);
        var headerCategory = isMultiLine ? null : (singleTestHeader?.Category ?? singlePanelHeader!.Category);

        var report = new LabReport
        {
            Id = Guid.NewGuid(),
            TenantId = tenantId.Value,
            PatientId = request.PatientId,
            VisitId = request.VisitId,
            TestDefinitionId = isMultiLine ? null : singleTestHeader?.Id,
            PanelId = isMultiLine ? null : singlePanelHeader?.Id,
            TestName = headerName,
            TestCode = headerCode,
            TestCategory = headerCategory,
            SpecimenType = specimenType,
            ClinicalIndication = request.ClinicalIndication.Trim(),
            Notes = string.IsNullOrWhiteSpace(request.Notes) ? null : request.Notes.Trim(),
            OrderedById = request.OrderedById,
            OrderedByName = doctorName,
            Priority = priority,
            Status = "ordered",
            OrderedAt = DateTime.UtcNow,
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow,
            CreatedByUserId = GetUserId(),
        };

        var order = 0;
        foreach (var def in memberDefs)
        {
            report.Items.Add(new LabReportItem
            {
                Id = Guid.NewGuid(),
                TenantId = tenantId.Value,
                LabReportId = report.Id,
                TestDefinitionId = def.Id,
                TestName = def.Name,
                TestCode = def.LocalCode,
                TestCategory = def.Category,
                DisplayOrder = order++,
                CreatedAt = DateTime.UtcNow,
            });
        }

        _context.LabReports.Add(report);
        await _context.SaveChangesAsync();

        var created = await _context.LabReports
            .AsNoTracking()
            .Include(r => r.Items.OrderBy(i => i.DisplayOrder))
            .FirstAsync(r => r.Id == report.Id);

        return CreatedAtAction(nameof(GetById), new { id = created.Id }, created);
    }

    private static List<LaboratoryCatalogOrderItemRequest>? NormalizeCatalogOrderLines(LaboratoryCatalogOrderRequest request)
    {
        if (request.Items.Count > 0)
        {
            var lines = new List<LaboratoryCatalogOrderItemRequest>();
            foreach (var item in request.Items)
            {
                var hasTest = item.TestDefinitionId.HasValue && item.TestDefinitionId != Guid.Empty;
                var hasPanel = item.PanelId.HasValue && item.PanelId != Guid.Empty;
                if (hasTest == hasPanel)
                    return null;
                lines.Add(new LaboratoryCatalogOrderItemRequest
                {
                    TestDefinitionId = hasTest ? item.TestDefinitionId : null,
                    PanelId = hasPanel ? item.PanelId : null,
                });
            }
            return lines;
        }

        var legacyTest = request.TestDefinitionId.HasValue && request.TestDefinitionId != Guid.Empty;
        var legacyPanel = request.PanelId.HasValue && request.PanelId != Guid.Empty;
        if (legacyTest == legacyPanel)
            return null;

        return new List<LaboratoryCatalogOrderItemRequest>
        {
            new()
            {
                TestDefinitionId = legacyTest ? request.TestDefinitionId : null,
                PanelId = legacyPanel ? request.PanelId : null,
            }
        };
    }

    private static string TruncateLabName(string name)
    {
        if (string.IsNullOrWhiteSpace(name)) return "Laboratory order";
        return name.Length <= 300 ? name : name[..297] + "...";
    }

    [HttpPut("{id:guid}")]
    [RequirePermission("patient.update")]
    public async Task<ActionResult> Update(Guid id, [FromBody] LabReport request)
    {
        var tenantId = GetTenantId();
        if (tenantId == null) return Unauthorized();

        var report = await _context.LabReports
            .FirstOrDefaultAsync(l => l.Id == id && l.TenantId == tenantId.Value);

        if (report == null) return NotFound();

        report.TestName = request.TestName;
        report.TestCode = request.TestCode;
        report.TestCategory = request.TestCategory;
        report.OrderedByName = request.OrderedByName;
        report.OrderedById = request.OrderedById;
        report.OrderedAt = request.OrderedAt;
        report.SampleCollectedAt = request.SampleCollectedAt;
        report.CompletedAt = request.CompletedAt;
        report.ResultValue = request.ResultValue;
        report.ResultUnit = request.ResultUnit;
        report.ReferenceRange = request.ReferenceRange;
        report.Interpretation = request.Interpretation;
        report.LabName = request.LabName;
        report.TechnicianName = request.TechnicianName;
        report.VerifiedByName = request.VerifiedByName;
        report.SpecimenType = request.SpecimenType;
        report.Priority = request.Priority;
        report.Notes = request.Notes;
        report.ReportUrl = request.ReportUrl;
        report.Status = request.Status;
        report.UpdatedAt = DateTime.UtcNow;
        report.UpdatedByUserId = GetUserId();

        await _context.SaveChangesAsync();
        return Ok(report);
    }

    [HttpPost("{id:guid}/complete")]
    [RequirePermission("patient.update")]
    public async Task<ActionResult> Complete(Guid id, [FromBody] LabReportResultRequest result)
    {
        var tenantId = GetTenantId();
        if (tenantId == null) return Unauthorized();

        var report = await _context.LabReports
            .FirstOrDefaultAsync(l => l.Id == id && l.TenantId == tenantId.Value);

        if (report == null) return NotFound();

        report.ResultValue = result.ResultValue;
        report.ResultUnit = result.ResultUnit;
        report.ReferenceRange = result.ReferenceRange;
        report.Interpretation = result.Interpretation;
        report.CompletedAt = DateTime.UtcNow;
        report.Status = "completed";
        report.UpdatedAt = DateTime.UtcNow;
        report.UpdatedByUserId = GetUserId();

        await _context.SaveChangesAsync();
        return Ok(report);
    }

    /// <summary>
    /// Attach a report file to an existing LabReport. Does not change clinical Status, results, or ReportUrl.
    /// </summary>
    [HttpPost("{id:guid}/attach-report")]
    [RequirePermission("patient.update")]
    [RequestSizeLimit(CanonicalDocumentFileRules.MaxBytes)]
    public async Task<ActionResult> AttachReport(
        Guid id,
        IFormFile file,
        CancellationToken cancellationToken)
    {
        var tenantId = GetTenantId();
        var userId = GetUserId();
        if (tenantId == null || userId == null) return Unauthorized();

        try
        {
            var report = await _labDocuments.AttachReportAsync(
                tenantId.Value, id, file, userId.Value, cancellationToken);
            return Ok(report);
        }
        catch (LabReportAttachmentConflictException ex)
        {
            return Conflict(new
            {
                code = "lab_report_attachment_exists",
                message = ex.Message,
                existingCanonicalDocumentId = ex.ExistingCanonicalDocumentId,
            });
        }
        catch (ArgumentException ex)
        {
            return BadRequest(new { message = ex.Message });
        }
        catch (KeyNotFoundException)
        {
            return NotFound(new { message = "Lab report not found" });
        }
    }

    /// <summary>
    /// Stream the canonical report attached to this LabReport. Requires patient.view; association is mandatory.
    /// </summary>
    [HttpGet("{id:guid}/report/content")]
    [RequirePermission("patient.view")]
    public async Task<IActionResult> ReportContent(Guid id, CancellationToken cancellationToken)
    {
        var tenantId = GetTenantId();
        if (tenantId == null) return Unauthorized();

        var content = await _labDocuments.OpenContentAsync(tenantId.Value, id, cancellationToken);
        if (content is null)
            return NotFound(new { message = "Report document not found" });

        return File(content.Content, content.ContentType, content.FileName);
    }

    [HttpDelete("{id:guid}")]
    [RequirePermission("patient.update")]
    public async Task<ActionResult> Delete(Guid id)
    {
        var tenantId = GetTenantId();
        if (tenantId == null) return Unauthorized();

        var report = await _context.LabReports
            .FirstOrDefaultAsync(l => l.Id == id && l.TenantId == tenantId.Value);

        if (report == null) return NotFound();

        report.DeletedAt = DateTime.UtcNow;
        report.UpdatedByUserId = GetUserId();
        await _context.SaveChangesAsync();

        return NoContent();
    }
}

public class LabReportResultRequest
{
    public string? ResultValue { get; set; }
    public string? ResultUnit { get; set; }
    public string? ReferenceRange { get; set; }
    public string? Interpretation { get; set; }
}

public class LaboratoryCatalogOrderRequest
{
    public Guid PatientId { get; set; }
    public Guid? VisitId { get; set; }
    /// <summary>Legacy single-test create. Prefer <see cref="Items"/> for multi-test orders.</summary>
    public Guid? TestDefinitionId { get; set; }
    /// <summary>Legacy single-panel create. Prefer <see cref="Items"/> for multi-test orders.</summary>
    public Guid? PanelId { get; set; }
    /// <summary>One or more catalog selections (test or panel) under one LabReport.</summary>
    public List<LaboratoryCatalogOrderItemRequest> Items { get; set; } = new();
    public string? SpecimenType { get; set; }
    public Guid OrderedById { get; set; }
    public string ClinicalIndication { get; set; } = string.Empty;
    public string? Notes { get; set; }
    public string? Priority { get; set; }
}

public class LaboratoryCatalogOrderItemRequest
{
    public Guid? TestDefinitionId { get; set; }
    public Guid? PanelId { get; set; }
}
