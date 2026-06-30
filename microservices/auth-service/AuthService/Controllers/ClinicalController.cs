using AuthService.Authorization;

using AuthService.Context;

using Microsoft.AspNetCore.Authorization;

using Microsoft.AspNetCore.Mvc;

using Microsoft.EntityFrameworkCore;

using System.Text.Json;



namespace AuthService.Controllers;



[ApiController]

[Route("api/clinical")]

[Authorize]

public class ClinicalController : ControllerBase

{

    private readonly AppDbContext _context;



    public ClinicalController(AppDbContext context)

    {

        _context = context;

    }



    /// <summary>GET /api/clinical/hpi-templates — pill options grouped by HPI category.</summary>

    [HttpGet("hpi-templates")]

    [RequirePermission("CLINICAL:EXAMINATION:VIEW")]

    public async Task<ActionResult<IReadOnlyList<HpiTemplateCategoryDto>>> GetHpiTemplates()

    {

        var tenantId = User.FindFirst("TenantId")?.Value;

        if (string.IsNullOrEmpty(tenantId))

            return Unauthorized();



        var tenantGuid = Guid.Parse(tenantId);

        var rows = await _context.MasterValues

            .AsNoTracking()

            .Where(m =>

                m.TenantId == tenantGuid

                && m.EntityType == "clinical.hpi_category"

                && m.IsActive

                && m.DeletedAt == null)

            .OrderBy(m => m.SortOrder)

            .ToListAsync();



        if (rows.Count == 0)

            return Ok(HpiTemplateSeed.Data);



        var templates = rows.Select(row =>

        {

            var pills = Array.Empty<string>();

            if (!string.IsNullOrWhiteSpace(row.Metadata))

            {

                try

                {

                    using var doc = JsonDocument.Parse(row.Metadata);

                    if (doc.RootElement.TryGetProperty("pills", out var pillsEl)

                        && pillsEl.ValueKind == JsonValueKind.Array)

                    {

                        pills = pillsEl.EnumerateArray()

                            .Select(p => p.GetString() ?? "")

                            .Where(p => !string.IsNullOrWhiteSpace(p))

                            .ToArray();

                    }

                }

                catch

                {

                    // ignore malformed metadata

                }

            }



            return new HpiTemplateCategoryDto

            {

                Category = row.Code,

                Label = row.Label,

                Pills = pills,

            };

        }).Where(t => t.Pills.Count > 0).ToList();



        return Ok(templates.Count > 0 ? templates : HpiTemplateSeed.Data);

    }



    /// <summary>GET /api/clinical/pe-templates — physical exam section templates.</summary>

    [HttpGet("pe-templates")]

    [RequirePermission("CLINICAL:EXAMINATION:VIEW")]

    public async Task<ActionResult<IReadOnlyList<PeTemplateDto>>> GetPeTemplates()

    {

        var tenantId = User.FindFirst("TenantId")?.Value;

        if (string.IsNullOrEmpty(tenantId))

            return Unauthorized();



        var tenantGuid = Guid.Parse(tenantId);

        var rows = await _context.MasterValues

            .AsNoTracking()

            .Where(m =>

                m.TenantId == tenantGuid

                && m.EntityType == "clinical.pe_template"

                && m.IsActive

                && m.DeletedAt == null)

            .OrderBy(m => m.SortOrder)

            .ToListAsync();



        if (rows.Count == 0)

            return Ok(PeTemplateSeed.Data);



        var templates = rows.Select(row =>

        {

            var sections = Array.Empty<string>();

            if (!string.IsNullOrWhiteSpace(row.Metadata))

            {

                try

                {

                    using var doc = JsonDocument.Parse(row.Metadata);

                    if (doc.RootElement.TryGetProperty("sections", out var sectionsEl)

                        && sectionsEl.ValueKind == JsonValueKind.Array)

                    {

                        sections = sectionsEl.EnumerateArray()

                            .Select(s => s.GetString() ?? "")

                            .Where(s => !string.IsNullOrWhiteSpace(s))

                            .ToArray();

                    }

                }

                catch

                {

                    // ignore

                }

            }



            return new PeTemplateDto

            {

                Code = row.Code,

                Label = row.Label,

                Sections = sections,

            };

        }).Where(t => t.Sections.Count > 0).ToList();



        return Ok(templates.Count > 0 ? templates : PeTemplateSeed.Data);

    }



    /// <summary>GET /api/clinical/medication-suggestions — recent + common ophthalmology meds.</summary>

    [HttpGet("medication-suggestions")]

    [RequirePermission("CLINICAL:EXAMINATION:VIEW")]

    public async Task<ActionResult<IReadOnlyList<MedicationSuggestionDto>>> GetMedicationSuggestions(

        [FromQuery] Guid patientId,

        [FromQuery] string? diagnosis = null)

    {

        if (patientId == Guid.Empty)

            return BadRequest("patientId is required");



        var tenantId = User.FindFirst("TenantId")?.Value;

        if (string.IsNullOrEmpty(tenantId))

            return Unauthorized();



        var tenantGuid = Guid.Parse(tenantId);



        var recent = new List<MedicationSuggestionDto>();

        try

        {

            recent = await _context.PrescriptionMedications

                .AsNoTracking()

                .Where(m => m.TenantId == tenantGuid && m.DeletedAt == null)

                .Join(

                    _context.Prescriptions.AsNoTracking().Where(p =>

                        p.TenantId == tenantGuid && p.PatientId == patientId && p.DeletedAt == null),

                    m => m.PrescriptionId,

                    p => p.Id,

                    (m, p) => new { Medication = m, Prescription = p })

                .OrderByDescending(x => x.Prescription.CreatedAt)

                .Take(20)

                .Select(x => new MedicationSuggestionDto

                {

                    Name = x.Medication.MedicationName,

                    Dosage = x.Medication.Dosage,

                    Frequency = x.Medication.Frequency,

                    Source = "recent",

                })

                .ToListAsync();

        }

        catch

        {

            // Prescription history may be unavailable on partial DB schemas.

        }



        var seen = new HashSet<string>(StringComparer.OrdinalIgnoreCase);

        var merged = new List<MedicationSuggestionDto>();



        foreach (var item in recent)

        {

            if (seen.Add(item.Name))

                merged.Add(item);

        }



        foreach (var common in MedicationSuggestionSeed.CommonOphthalmology(diagnosis))

        {

            if (seen.Add(common.Name))

                merged.Add(common);

        }



        return Ok(merged.Take(25).ToList());

    }

}



public sealed class HpiTemplateCategoryDto

{

    public string Category { get; set; } = "";

    public string Label { get; set; } = "";

    public IReadOnlyList<string> Pills { get; set; } = Array.Empty<string>();

}



public sealed class PeTemplateDto

{

    public string Code { get; set; } = "";

    public string Label { get; set; } = "";

    public IReadOnlyList<string> Sections { get; set; } = Array.Empty<string>();

}



public sealed class MedicationSuggestionDto

{

    public string Name { get; set; } = "";

    public string? Dosage { get; set; }

    public string? Frequency { get; set; }

    public string Source { get; set; } = "common";

}



internal static class HpiTemplateSeed

{

    public static readonly IReadOnlyList<HpiTemplateCategoryDto> Data =

    [

        new()

        {

            Category = "onset",

            Label = "Onset",

            Pills = ["Sudden", "Gradual", "Since childhood", "Since yesterday", "Since weeks", "Since months"],

        },

        new()

        {

            Category = "duration",

            Label = "Duration",

            Pills = ["Hours", "Days", "Weeks", "Months", "Years", "Intermittent"],

        },

        new()

        {

            Category = "quality",

            Label = "Quality",

            Pills = ["Blurring", "Pain", "Redness", "Discharge", "Floaters", "Flashes", "Diplopia"],

        },

        new()

        {

            Category = "severity",

            Label = "Severity",

            Pills = ["Mild", "Moderate", "Severe", "Worse in morning", "Worse in evening"],

        },

        new()

        {

            Category = "timing",

            Label = "Timing",

            Pills = ["Constant", "Intermittent", "Progressive", "Stable", "Improving"],

        },

        new()

        {

            Category = "context",

            Label = "Context",

            Pills = ["After trauma", "Post-surgery", "After screen use", "After injury", "No trigger"],

        },

        new()

        {

            Category = "modifiers",

            Label = "Modifying factors",

            Pills = ["Better with rest", "Worse with reading", "Relieved by drops", "Not relieved by OTC"],

        },

        new()

        {

            Category = "associated",

            Label = "Associated symptoms",

            Pills = ["Headache", "Nausea", "Photophobia", "Lacrimation", "Halos", "Night blindness"],

        },

    ];

}



internal static class PeTemplateSeed

{

    public static readonly IReadOnlyList<PeTemplateDto> Data =

    [

        new()

        {

            Code = "anterior",

            Label = "Anterior Segment",

            Sections = ["Lids", "Conjunctiva", "Cornea", "AC", "Iris", "Lens"],

        },

        new()

        {

            Code = "posterior",

            Label = "Posterior Segment",

            Sections = ["Vitreous", "Disc", "Macula", "Vessels", "Periphery"],

        },

    ];

}



internal static class MedicationSuggestionSeed

{

    public static IEnumerable<MedicationSuggestionDto> CommonOphthalmology(string? diagnosis)

    {

        var list = new List<MedicationSuggestionDto>

        {

            new() { Name = "Timolol 0.5%", Dosage = "1 drop", Frequency = "BD", Source = "common" },

            new() { Name = "Latanoprost 0.005%", Dosage = "1 drop", Frequency = "HS", Source = "common" },

            new() { Name = "Moxifloxacin 0.5%", Dosage = "1 drop", Frequency = "TDS", Source = "common" },

            new() { Name = "Prednisolone acetate 1%", Dosage = "1 drop", Frequency = "QID taper", Source = "common" },

            new() { Name = "Artificial tears", Dosage = "1 drop", Frequency = "QID", Source = "common" },

            new() { Name = "Atropine 1%", Dosage = "1 drop", Frequency = "OD/BID", Source = "common" },

        };



        if (diagnosis?.Contains("glaucoma", StringComparison.OrdinalIgnoreCase) == true)

        {

            list.Insert(0, new MedicationSuggestionDto

            {

                Name = "Brimonidine 0.2%",

                Dosage = "1 drop",

                Frequency = "TDS",

                Source = "common",

            });

        }



        return list;

    }

}


