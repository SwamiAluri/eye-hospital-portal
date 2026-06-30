using AuthService.Context;
using AuthService.Models.Domain;
using AuthService.Models.Domain.Dtos;
using AuthService.Models.Identity;
using Microsoft.EntityFrameworkCore;

namespace AuthService.Services;

public interface IPatientOmniSearchService
{
    Task<List<PatientOmniSearchHitDto>> SearchAsync(
        Guid tenantId,
        Guid branchId,
        Guid userId,
        string scope,
        string q,
        int limit);
}

public class PatientOmniSearchService : IPatientOmniSearchService
{
    private static readonly HashSet<string> ValidScopes = new(StringComparer.OrdinalIgnoreCase)
    {
        "patients",
        "care_programs",
        "conditions",
        "procedures",
        "providers",
        "insurance",
        "ip",
        "camps",
    };

    private static readonly (string Code, string Label)[] CarePrograms =
    {
        ("CATARACT", "Cataract"),
        ("GLAUCOMA", "Glaucoma"),
        ("RETINA", "Retina"),
        ("CORNEA", "Cornea"),
        ("REFRACTIVE", "LASIK / Refractive"),
    };

    private static readonly HashSet<string> ProviderRoleNames = new(StringComparer.OrdinalIgnoreCase)
    {
        "Doctor",
        "Optometrist",
        "Counselor",
        "Ophthalmologist",
        "Surgeon",
        "Consultant",
    };

    private static readonly HashSet<string> CompletedSessionStatuses = new(StringComparer.OrdinalIgnoreCase)
    {
        "Completed",
        "Cancelled",
        "NoShow",
    };

    private readonly AppDbContext _context;
    private readonly IPatientLookupService _patientLookup;

    public PatientOmniSearchService(AppDbContext context, IPatientLookupService patientLookup)
    {
        _context = context;
        _patientLookup = patientLookup;
    }

    public async Task<List<PatientOmniSearchHitDto>> SearchAsync(
        Guid tenantId,
        Guid branchId,
        Guid userId,
        string scope,
        string q,
        int limit)
    {
        if (!ValidScopes.Contains(scope))
            return new List<PatientOmniSearchHitDto>();

        limit = Math.Clamp(limit, 1, 25);
        var needle = (q ?? "").Trim().ToLowerInvariant();

        return scope.ToLowerInvariant() switch
        {
            "patients" => await SearchPatientsAsync(tenantId, branchId, userId, needle, limit),
            "care_programs" => SearchCarePrograms(needle, limit),
            "conditions" => await SearchConditionsAsync(tenantId, needle, limit),
            "procedures" => await SearchProceduresAsync(needle, limit),
            "providers" => await SearchProvidersAsync(tenantId, branchId, needle, limit),
            "insurance" => await SearchInsuranceAsync(tenantId, branchId, needle, limit),
            "ip" => await SearchIpPatientsAsync(tenantId, branchId, needle, limit),
            "camps" => await SearchCampsAsync(tenantId, branchId, needle, limit),
            _ => new List<PatientOmniSearchHitDto>(),
        };
    }

    private async Task<List<PatientOmniSearchHitDto>> SearchPatientsAsync(
        Guid tenantId,
        Guid branchId,
        Guid userId,
        string needle,
        int limit)
    {
        if (needle.Length < 2)
            return new List<PatientOmniSearchHitDto>();

        var rows = await _patientLookup.SuggestAsync(tenantId, branchId, userId, needle, limit);
        return rows.Select(p => new PatientOmniSearchHitDto
        {
            Id = p.Id.ToString(),
            Title = $"{p.FirstName} {p.LastName}".Trim(),
            Subtitle = $"MRN {p.Mrn}",
            Meta = p.Phone,
            ActionType = "patient_profile",
            PatientId = p.Id.ToString(),
        }).ToList();
    }

    private static List<PatientOmniSearchHitDto> SearchCarePrograms(string needle, int limit)
    {
        var programs = CarePrograms.AsEnumerable();
        if (!string.IsNullOrEmpty(needle))
        {
            programs = programs.Where(p =>
                p.Code.Contains(needle, StringComparison.OrdinalIgnoreCase) ||
                p.Label.Contains(needle, StringComparison.OrdinalIgnoreCase));
        }

        return programs
            .Take(limit)
            .Select(p => new PatientOmniSearchHitDto
            {
                Id = p.Code,
                Title = p.Label,
                Subtitle = p.Code,
                Meta = "Care program",
                ActionType = "hub_filter",
                HubFilter = new Dictionary<string, string> { ["programCodes"] = p.Code },
            })
            .ToList();
    }

    private async Task<List<PatientOmniSearchHitDto>> SearchConditionsAsync(
        Guid tenantId,
        string needle,
        int limit)
    {
        if (needle.Length < 2)
            return new List<PatientOmniSearchHitDto>();

        var rows = await _context.DiagnosisCodes
            .AsNoTracking()
            .Where(c => c.TenantId == tenantId && c.DeletedAt == null && c.Status == "active")
            .Where(c =>
                c.Code.ToLower().Contains(needle) ||
                c.Description.ToLower().Contains(needle))
            .OrderBy(c => c.Code)
            .Take(limit)
            .Select(c => new { c.Code, c.Description, c.Category })
            .ToListAsync();

        return rows.Select(c => new PatientOmniSearchHitDto
        {
            Id = c.Code,
            Title = c.Description,
            Subtitle = c.Code,
            Meta = c.Category,
            ActionType = "hub_filter",
            HubFilter = new Dictionary<string, string> { ["diagnosis"] = c.Code },
        }).ToList();
    }

    private async Task<List<PatientOmniSearchHitDto>> SearchProceduresAsync(string needle, int limit)
    {
        if (needle.Length < 2)
            return new List<PatientOmniSearchHitDto>();

        var rows = await _context.ServiceVariants
            .AsNoTracking()
            .Where(v => v.DeletedAt == null && v.IsActive)
            .Where(v =>
                v.VariantName.ToLower().Contains(needle) ||
                (v.VariantCode != null && v.VariantCode.ToLower().Contains(needle)) ||
                (v.Description != null && v.Description.ToLower().Contains(needle)))
            .OrderBy(v => v.VariantName)
            .Take(limit)
            .Select(v => new
            {
                v.Id,
                Name = v.VariantName,
                Code = v.VariantCode,
            })
            .ToListAsync();

        return rows.Select(v => new PatientOmniSearchHitDto
        {
            Id = v.Id.ToString(),
            Title = v.Name,
            Subtitle = v.Code,
            Meta = "Procedure",
            ActionType = "hub_filter",
            HubFilter = new Dictionary<string, string> { ["q"] = v.Name },
        }).ToList();
    }

    private async Task<List<PatientOmniSearchHitDto>> SearchProvidersAsync(
        Guid tenantId,
        Guid branchId,
        string needle,
        int limit)
    {
        if (needle.Length < 2)
            return new List<PatientOmniSearchHitDto>();

        var rows = await (
                from u in _context.Users.AsNoTracking()
                join ur in _context.UserRoles on u.Id equals ur.UserId
                join r in _context.Roles on ur.RoleId equals r.Id
                where u.TenantId == tenantId
                      && u.DeletedAt == null
                      && u.UserStatus == "active"
                      && (u.BranchId == null || u.BranchId == branchId)
                      && ProviderRoleNames.Contains(r.Name)
                select new { u, r.Name })
            .ToListAsync();

        var grouped = rows
            .GroupBy(x => x.u.Id)
            .Select(g =>
            {
                var user = g.First().u;
                var roles = g.Select(x => x.Name).Distinct(StringComparer.OrdinalIgnoreCase).ToList();
                return new
                {
                    user.Id,
                    Name = $"{user.FirstName} {user.LastName}".Trim(),
                    user.Designation,
                    user.Specialization,
                    Roles = string.Join(", ", roles),
                };
            })
            .Where(x =>
                x.Name.ToLowerInvariant().Contains(needle) ||
                (x.Designation ?? "").ToLowerInvariant().Contains(needle) ||
                (x.Specialization ?? "").ToLowerInvariant().Contains(needle) ||
                x.Roles.ToLowerInvariant().Contains(needle))
            .OrderBy(x => x.Name)
            .Take(limit)
            .ToList();

        return grouped.Select(p => new PatientOmniSearchHitDto
        {
            Id = p.Id.ToString(),
            Title = p.Name,
            Subtitle = p.Roles,
            Meta = p.Specialization ?? p.Designation,
            ActionType = "hub_filter",
            HubFilter = new Dictionary<string, string> { ["providerId"] = p.Id.ToString() },
        }).ToList();
    }

    private async Task<List<PatientOmniSearchHitDto>> SearchInsuranceAsync(
        Guid tenantId,
        Guid branchId,
        string needle,
        int limit)
    {
        if (needle.Length < 2)
            return new List<PatientOmniSearchHitDto>();

        var providerRows = await _context.InsuranceProviders
            .AsNoTracking()
            .Where(p => p.TenantId == tenantId && p.IsActive)
            .Where(p =>
                p.ProviderName.ToLower().Contains(needle) ||
                p.ProviderCode.ToLower().Contains(needle))
            .OrderBy(p => p.ProviderName)
            .Take(limit)
            .Select(p => new { p.Id, p.ProviderName, p.ProviderCode })
            .ToListAsync();

        var providerHits = providerRows.Select(p => new PatientOmniSearchHitDto
        {
            Id = p.Id.ToString(),
            Title = p.ProviderName,
            Subtitle = p.ProviderCode,
            Meta = "Insurance payer",
            ActionType = "hub_filter",
            HubFilter = new Dictionary<string, string>
            {
                ["engagementTypes"] = "insurance",
                ["patientTypes"] = "Insurance",
                ["q"] = p.ProviderName,
            },
        }).ToList();

        if (providerHits.Count >= limit)
            return providerHits;

        var remaining = limit - providerHits.Count;
        var caseHits = await (
                from s in _context.CounselingSession.AsNoTracking()
                join p in _context.Patients.AsNoTracking() on s.PatientId equals p.Id
                where s.TenantId == tenantId
                      && s.BranchId == branchId
                      && s.DeletedAt == null
                      && p.DeletedAt == null
                      && !CompletedSessionStatuses.Contains(s.Status)
                      && (s.PatientType == "Insurance" || s.PatientType == "CoPay" || s.PatientType == "CGHS")
                      && s.PackageAddonsJson != null
                      && s.PackageAddonsJson.Contains("ccmsCoverageCaseId")
                select new { s, p })
            .ToListAsync();

        var filteredCases = caseHits
            .Where(x =>
            {
                var name = $"{x.p.FirstName} {x.p.LastName}".Trim().ToLowerInvariant();
                var mrn = (x.p.MedicalRecordNumber ?? "").ToLowerInvariant();
                var sessionNo = (x.s.SessionNumber ?? "").ToLowerInvariant();
                return name.Contains(needle) || mrn.Contains(needle) || sessionNo.Contains(needle);
            })
            .Take(remaining)
            .Select(x => new PatientOmniSearchHitDto
            {
                Id = x.s.Id.ToString(),
                Title = $"{x.p.FirstName} {x.p.LastName}".Trim(),
                Subtitle = x.s.SessionNumber ?? "Coverage case",
                Meta = $"{x.s.PatientType} · {x.s.CurrentStage ?? "Open"}",
                ActionType = "hub_path",
                PatientId = x.p.Id.ToString(),
                Path = $"/dashboard/patients/{x.p.Id}?tab=insurance",
            })
            .ToList();

        providerHits.AddRange(filteredCases);
        return providerHits;
    }

    private async Task<List<PatientOmniSearchHitDto>> SearchIpPatientsAsync(
        Guid tenantId,
        Guid branchId,
        string needle,
        int limit)
    {
        if (needle.Length < 2)
            return new List<PatientOmniSearchHitDto>();

        var journeys = await (
                from j in _context.PatientJourneys.AsNoTracking()
                join p in _context.Patients.AsNoTracking() on j.PatientId equals p.Id
                where j.TenantId == tenantId
                      && j.BranchId == branchId
                      && j.DeletedAt == null
                      && !j.IsDischarged
                      && p.DeletedAt == null
                      && (p.BranchId == null || p.BranchId == branchId)
                select new { j, p })
            .ToListAsync();

        var wardMap = await _context.BedInventories
            .AsNoTracking()
            .Where(b => b.PatientId != null && b.WardName != null)
            .GroupBy(b => b.PatientId!.Value)
            .Select(g => new { PatientId = g.Key, Ward = g.OrderByDescending(b => b.CreatedAt).Select(b => b.WardName).FirstOrDefault() })
            .ToDictionaryAsync(x => x.PatientId, x => x.Ward);

        return journeys
            .Where(x =>
            {
                var name = $"{x.p.FirstName} {x.p.LastName}".Trim().ToLowerInvariant();
                var mrn = (x.p.MedicalRecordNumber ?? "").ToLowerInvariant();
                var ward = wardMap.GetValueOrDefault(x.p.Id, "")?.ToLowerInvariant() ?? "";
                return name.Contains(needle) || mrn.Contains(needle) || ward.Contains(needle);
            })
            .OrderBy(x => x.p.LastName)
            .ThenBy(x => x.p.FirstName)
            .Take(limit)
            .Select(x =>
            {
                var ward = wardMap.GetValueOrDefault(x.p.Id);
                return new PatientOmniSearchHitDto
                {
                    Id = x.p.Id.ToString(),
                    Title = $"{x.p.FirstName} {x.p.LastName}".Trim(),
                    Subtitle = $"MRN {x.p.MedicalRecordNumber}",
                    Meta = string.IsNullOrWhiteSpace(ward) ? "Admitted" : $"Ward {ward}",
                    ActionType = "hub_filter",
                    PatientId = x.p.Id.ToString(),
                    HubFilter = new Dictionary<string, string>
                    {
                        ["engagementTypes"] = "ip",
                        ["preview"] = x.p.Id.ToString(),
                    },
                };
            })
            .ToList();
    }

    private async Task<List<PatientOmniSearchHitDto>> SearchCampsAsync(
        Guid tenantId,
        Guid branchId,
        string needle,
        int limit)
    {
        if (needle.Length < 2)
            return new List<PatientOmniSearchHitDto>();

        var today = DateTime.UtcNow.Date;

        var sessions = await (
                from s in _context.CounselingSession.AsNoTracking()
                join p in _context.Patients.AsNoTracking() on s.PatientId equals p.Id
                where s.TenantId == tenantId
                      && s.BranchId == branchId
                      && s.DeletedAt == null
                      && p.DeletedAt == null
                      && s.PatientType == "Camp"
                      && s.SessionDate.Date == today
                      && !CompletedSessionStatuses.Contains(s.Status)
                select new { s, p })
            .ToListAsync();

        return sessions
            .Where(x =>
            {
                var name = $"{x.p.FirstName} {x.p.LastName}".Trim().ToLowerInvariant();
                var mrn = (x.p.MedicalRecordNumber ?? "").ToLowerInvariant();
                return name.Contains(needle) || mrn.Contains(needle);
            })
            .OrderBy(x => x.p.LastName)
            .Take(limit)
            .Select(x => new PatientOmniSearchHitDto
            {
                Id = x.p.Id.ToString(),
                Title = $"{x.p.FirstName} {x.p.LastName}".Trim(),
                Subtitle = $"MRN {x.p.MedicalRecordNumber}",
                Meta = "Camp · today",
                ActionType = "hub_filter",
                PatientId = x.p.Id.ToString(),
                HubFilter = new Dictionary<string, string>
                {
                    ["engagementTypes"] = "camp",
                    ["patientTypes"] = "Camp",
                    ["preview"] = x.p.Id.ToString(),
                },
            })
            .ToList();
    }
}
