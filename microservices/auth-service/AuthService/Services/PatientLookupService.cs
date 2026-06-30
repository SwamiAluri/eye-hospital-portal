using System.Globalization;
using System.Text;
using AuthService.Context;
using AuthService.Models.Domain;
using AuthService.Models.Domain.Dtos;
using Microsoft.EntityFrameworkCore;

namespace AuthService.Services;

public interface IPatientLookupService
{
    Task<List<PatientSuggestRowDto>> SuggestAsync(Guid tenantId, Guid branchId, Guid userId, string q, int limit);
    Task<PatientLookupPageDto> LookupAsync(PatientLookupQuery query);
    Task<PatientLookupStatsDto> GetStatsAsync(Guid tenantId, Guid branchId, Guid userId);
    Task<bool> ToggleFavoriteAsync(Guid tenantId, Guid userId, Guid patientId);
    Task<byte[]> ExportCsvAsync(PatientLookupQuery query);
}

public class PatientLookupService : IPatientLookupService
{
    private static readonly HashSet<string> CompletedVisitStatuses = new(StringComparer.OrdinalIgnoreCase)
    {
        "completed", "cancelled"
    };

    private static readonly HashSet<string> HighQueuePriorities = new(StringComparer.OrdinalIgnoreCase)
    {
        "emergency", "urgent"
    };

    private readonly AppDbContext _context;
    private readonly IPatientEngagementService _engagements;
    private readonly ILogger<PatientLookupService> _logger;

    public PatientLookupService(
        AppDbContext context,
        IPatientEngagementService engagements,
        ILogger<PatientLookupService> logger)
    {
        _context = context;
        _engagements = engagements;
        _logger = logger;
    }

    public async Task<List<PatientSuggestRowDto>> SuggestAsync(
        Guid tenantId, Guid branchId, Guid userId, string q, int limit)
    {
        var needle = (q ?? "").Trim().ToLowerInvariant();
        if (needle.Length < 2) return new List<PatientSuggestRowDto>();

        limit = Math.Clamp(limit, 1, 20);

        var candidates = await _context.Patients
            .AsNoTracking()
            .Where(p => p.TenantId == tenantId && p.DeletedAt == null)
            .Where(p => p.BranchId == null || p.BranchId == branchId)
            .Where(p =>
                (p.FirstName + " " + p.LastName).ToLower().Contains(needle) ||
                (p.MedicalRecordNumber ?? "").ToLower().Contains(needle) ||
                (p.ContactNumber ?? "").Contains(needle) ||
                (p.Email ?? "").ToLower().Contains(needle))
            .Take(50)
            .Select(p => new PatientSuggestRowDto
            {
                Id = p.Id,
                FirstName = p.FirstName,
                LastName = p.LastName,
                Mrn = p.MedicalRecordNumber,
                DateOfBirth = p.DateOfBirth,
                Gender = p.Gender,
                Phone = p.ContactNumber,
                Email = p.Email,
                PhotoThumbnailUrl = p.PhotoThumbnailUrl
            })
            .ToListAsync();

        return PatientLookupRanking.Rank(candidates, needle).Take(limit).ToList();
    }

    public async Task<PatientLookupPageDto> LookupAsync(PatientLookupQuery query)
    {
        var page = Math.Max(1, query.Page);
        var pageSize = Math.Clamp(query.PageSize, 1, 100);

        var baseQuery = BuildBasePatientQuery(query.TenantId, query.BranchId);
        baseQuery = ApplySearchFilter(baseQuery, query.Q);
        baseQuery = ApplyAdvancedFilters(baseQuery, query, _context);
        baseQuery = await ApplyTabFilterAsync(baseQuery, query);
        baseQuery = ApplyAssignedToMeFilter(baseQuery, query);

        if (query.FavoritesOnly)
        {
            var favIds = _context.PatientFavorites
                .Where(f => f.TenantId == query.TenantId && f.UserId == query.UserId)
                .Select(f => f.PatientId);
            baseQuery = baseQuery.Where(p => favIds.Contains(p.Id));
        }

        if (query.EngagementTypes.Count > 0)
        {
            var matchingIds = await GetPatientIdsMatchingEngagementTypesAsync(
                query.TenantId, query.BranchId, query.EngagementTypes);
            baseQuery = baseQuery.Where(p => matchingIds.Contains(p.Id));
        }

        if (query.ProgramCodes.Count > 0)
        {
            var codes = query.ProgramCodes
                .Select(c => c.ToUpperInvariant())
                .ToHashSet(StringComparer.OrdinalIgnoreCase);
            var matchingDeptIds = await _context.Departments.AsNoTracking()
                .Where(d => codes.Contains(d.DepartmentCode))
                .Select(d => d.Id)
                .ToListAsync();

            var programPatientIds = await _context.Visits
                .AsNoTracking()
                .Where(v => v.TenantId == query.TenantId && v.BranchId == query.BranchId && v.DeletedAt == null)
                .Where(v => !CompletedVisitStatuses.Contains(v.Status))
                .Where(v => v.DepartmentId != null && matchingDeptIds.Contains(v.DepartmentId.Value))
                .Select(v => v.PatientId)
                .Distinct()
                .ToListAsync();
            baseQuery = baseQuery.Where(p => programPatientIds.Contains(p.Id));
        }

        if (query.PatientTypes.Count > 0)
        {
            var types = query.PatientTypes;
            var typePatientIds = await _context.CounselingSession
                .AsNoTracking()
                .Where(s => s.TenantId == query.TenantId && (s.BranchId == null || s.BranchId == query.BranchId))
                .Where(s => s.DeletedAt == null && types.Contains(s.PatientType))
                .Where(s => s.Status != "Completed" && s.Status != "Cancelled" && s.Status != "NoShow")
                .Select(s => s.PatientId)
                .Distinct()
                .ToListAsync();
            baseQuery = baseQuery.Where(p => typePatientIds.Contains(p.Id));
        }

        var totalCount = await baseQuery.CountAsync();

        List<Patient> pagePatients;
        if (PatientLookupSortHelper.IsEngagementSort(query.SortBy))
        {
            pagePatients = await LoadEngagementSortedPageAsync(
                baseQuery,
                query.TenantId,
                query.BranchId,
                query.SortBy,
                query.SortDir,
                page,
                pageSize);
        }
        else
        {
            var sorted = ApplySort(baseQuery, query.TenantId, query.BranchId, query.SortBy, query.SortDir);
            pagePatients = await sorted
                .Skip((page - 1) * pageSize)
                .Take(pageSize)
                .AsNoTracking()
                .ToListAsync();
        }

        var patientIds = pagePatients.Select(p => p.Id).ToList();
        var favoriteIds = await _context.PatientFavorites
            .Where(f => f.TenantId == query.TenantId && f.UserId == query.UserId && patientIds.Contains(f.PatientId))
            .Select(f => f.PatientId)
            .ToListAsync();
        var favoriteSet = favoriteIds.ToHashSet();

        var enrichments = await _engagements.LoadForPatientsAsync(query.TenantId, query.BranchId, patientIds);

        var items = pagePatients.Select(p =>
        {
            enrichments.TryGetValue(p.Id, out var e);
            return MapRow(p, favoriteSet.Contains(p.Id), e);
        }).ToList();

        return new PatientLookupPageDto
        {
            Items = items,
            TotalCount = totalCount,
            Page = page,
            PageSize = pageSize,
            TotalPages = totalCount == 0 ? 0 : (int)Math.Ceiling(totalCount / (double)pageSize)
        };
    }

    public async Task<byte[]> ExportCsvAsync(PatientLookupQuery query)
    {
        var exportQuery = new PatientLookupQuery
        {
            TenantId = query.TenantId,
            BranchId = query.BranchId,
            UserId = query.UserId,
            Q = query.Q,
            Tab = query.Tab,
            Page = 1,
            PageSize = 5000,
            SortBy = query.SortBy,
            SortDir = query.SortDir,
            FavoritesOnly = query.FavoritesOnly,
            AssignedToMe = query.AssignedToMe,
            EngagementTypes = query.EngagementTypes,
            ProgramCodes = query.ProgramCodes,
            PatientTypes = query.PatientTypes,
            Gender = query.Gender,
            Mrn = query.Mrn,
            Phone = query.Phone,
            DobFrom = query.DobFrom,
            DobTo = query.DobTo,
            AppointmentFrom = query.AppointmentFrom,
            AppointmentTo = query.AppointmentTo
        };
        var page = await LookupAsync(exportQuery);
        var sb = new StringBuilder();
        sb.AppendLine("MRN,First Name,Last Name,Gender,Phone,Reason,Scheduled At,Wait Minutes,Station,Room,Acuity,Engagements,Care Programs,Assigned Provider,Provider Role,Favorite");

        foreach (var row in page.Items)
        {
            var engagements = string.Join("; ", row.ActiveEngagements.Select(e => e.Label));
            var programs = string.Join("; ", row.CareProgramCodes);
            sb.AppendLine(string.Join(",",
                Csv(row.Mrn),
                Csv(row.FirstName),
                Csv(row.LastName),
                Csv(row.Gender),
                Csv(row.Phone),
                Csv(row.ReasonForVisit),
                Csv(row.ScheduledAt?.ToString("o")),
                row.WaitingMinutes?.ToString() ?? "",
                Csv(row.CurrentStation),
                Csv(row.RoomNumber),
                Csv(row.ClinicalAcuity),
                Csv(engagements),
                Csv(programs),
                Csv(row.AssignedProviderName),
                Csv(row.AssignedProviderRole),
                row.IsFavorite ? "yes" : "no"));
        }

        return Encoding.UTF8.GetBytes(sb.ToString());
    }

    public async Task<PatientLookupStatsDto> GetStatsAsync(Guid tenantId, Guid branchId, Guid userId)
    {
        var baseQuery = BuildBasePatientQuery(tenantId, branchId);
        var all = await baseQuery.CountAsync();

        var currentQuery = await ApplyTabFilterAsync(baseQuery, new PatientLookupQuery
        {
            TenantId = tenantId,
            BranchId = branchId,
            UserId = userId,
            Tab = "current"
        });
        var current = await currentQuery.CountAsync();

        var newCutoff = DateTime.UtcNow.AddDays(-30);
        var newCount = await baseQuery.Where(p => p.CreatedAt >= newCutoff).CountAsync();

        var dischargedQuery = await ApplyTabFilterAsync(baseQuery, new PatientLookupQuery
        {
            TenantId = tenantId,
            BranchId = branchId,
            UserId = userId,
            Tab = "discharged"
        });
        var discharged = await dischargedQuery.CountAsync();

        var highQuery = await ApplyTabFilterAsync(baseQuery, new PatientLookupQuery
        {
            TenantId = tenantId,
            BranchId = branchId,
            UserId = userId,
            Tab = "high_priority"
        });
        var highPriority = await highQuery.CountAsync();

        return new PatientLookupStatsDto
        {
            All = all,
            Current = current,
            New = newCount,
            Discharged = discharged,
            HighPriority = highPriority
        };
    }

    public async Task<bool> ToggleFavoriteAsync(Guid tenantId, Guid userId, Guid patientId)
    {
        var existing = await _context.PatientFavorites
            .FirstOrDefaultAsync(f => f.TenantId == tenantId && f.UserId == userId && f.PatientId == patientId);

        if (existing != null)
        {
            _context.PatientFavorites.Remove(existing);
            await _context.SaveChangesAsync();
            return false;
        }

        _context.PatientFavorites.Add(new PatientFavorite
        {
            TenantId = tenantId,
            UserId = userId,
            PatientId = patientId,
            CreatedAt = DateTime.UtcNow
        });
        await _context.SaveChangesAsync();
        return true;
    }

    private IQueryable<Patient> BuildBasePatientQuery(Guid tenantId, Guid branchId) =>
        _context.Patients
            .Where(p => p.TenantId == tenantId && p.DeletedAt == null)
            .Where(p => p.BranchId == null || p.BranchId == branchId);

    private static IQueryable<Patient> ApplySearchFilter(IQueryable<Patient> query, string? q)
    {
        var needle = (q ?? "").Trim().ToLowerInvariant();
        if (needle.Length < 2) return query;

        return query.Where(p =>
            (p.FirstName + " " + p.LastName).ToLower().Contains(needle) ||
            (p.MedicalRecordNumber ?? "").ToLower().Contains(needle) ||
            (p.ContactNumber ?? "").Contains(needle) ||
            (p.Email ?? "").ToLower().Contains(needle));
    }

    private static IQueryable<Patient> ApplyAdvancedFilters(IQueryable<Patient> query, PatientLookupQuery q, AppDbContext context)
    {
        if (!string.IsNullOrWhiteSpace(q.Gender))
            query = query.Where(p => p.Gender.ToLower() == q.Gender!.Trim().ToLower());

        if (!string.IsNullOrWhiteSpace(q.Mrn))
        {
            var mrn = q.Mrn.Trim().ToLower();
            query = query.Where(p => (p.MedicalRecordNumber ?? "").ToLower().Contains(mrn));
        }

        if (!string.IsNullOrWhiteSpace(q.Phone))
        {
            var phone = q.Phone.Trim();
            query = query.Where(p => (p.ContactNumber ?? "").Contains(phone));
        }

        if (q.DobFrom.HasValue)
            query = query.Where(p => p.DateOfBirth >= q.DobFrom.Value);
        if (q.DobTo.HasValue)
            query = query.Where(p => p.DateOfBirth <= q.DobTo.Value);

        if (q.AppointmentFrom.HasValue || q.AppointmentTo.HasValue)
        {
            var from = q.AppointmentFrom ?? DateTime.MinValue;
            var to = q.AppointmentTo ?? DateTime.MaxValue;
            var apptPatientIds = context.Appointments
                .Where(a => a.AppointmentDate >= from && a.AppointmentDate <= to && a.Status != "Cancelled")
                .Select(a => a.PatientId);
            query = query.Where(p => apptPatientIds.Contains(p.Id));
        }

        if (!string.IsNullOrWhiteSpace(q.Name))
        {
            var name = q.Name.Trim().ToLower();
            query = query.Where(p => (p.FirstName + " " + p.LastName).ToLower().Contains(name));
        }

        if (!string.IsNullOrWhiteSpace(q.Diagnosis))
        {
            var dx = q.Diagnosis.Trim().ToLower();
            var dxPatientIds = context.PatientDiagnoses.AsNoTracking()
                .Where(d => d.DeletedAt == null && d.Status == "active")
                .Join(context.DiagnosisCodes.AsNoTracking(),
                    d => d.DiagnosisCodeId,
                    c => c.Id,
                    (d, c) => new { d.PatientId, c.Code, c.Description })
                .Where(x => x.Code.ToLower().Contains(dx) || x.Description.ToLower().Contains(dx))
                .Select(x => x.PatientId);
            query = query.Where(p => dxPatientIds.Contains(p.Id));
        }

        if (q.ProviderId.HasValue)
        {
            var providerId = q.ProviderId.Value;
            var providerPatientIds = context.Visits.AsNoTracking()
                .Where(v => v.DeletedAt == null && !CompletedVisitStatuses.Contains(v.Status))
                .Where(v => v.AssignedTo == providerId || v.ConsultantId == providerId)
                .Select(v => v.PatientId);
            query = query.Where(p => providerPatientIds.Contains(p.Id));
        }

        if (q.DepartmentId.HasValue)
        {
            var deptId = q.DepartmentId.Value;
            var deptPatientIds = context.Visits.AsNoTracking()
                .Where(v => v.DeletedAt == null && v.DepartmentId == deptId)
                .Select(v => v.PatientId);
            query = query.Where(p => deptPatientIds.Contains(p.Id));
        }

        if (!string.IsNullOrWhiteSpace(q.WardName))
        {
            var ward = q.WardName.Trim().ToLower();
            var wardPatientIds = context.BedInventories.AsNoTracking()
                .Where(b => b.PatientId != null && b.WardName != null && b.WardName.ToLower().Contains(ward))
                .Select(b => b.PatientId!.Value);
            query = query.Where(p => wardPatientIds.Contains(p.Id));
        }

        if (q.AdmissionFrom.HasValue || q.AdmissionTo.HasValue)
        {
            var from = q.AdmissionFrom ?? DateTime.MinValue;
            var to = q.AdmissionTo ?? DateTime.MaxValue;
            var ipPatientIds = context.PatientJourneys.AsNoTracking()
                .Where(j => j.DeletedAt == null && !j.IsDischarged)
                .Where(j => j.CreatedAt >= from && j.CreatedAt <= to)
                .Select(j => j.PatientId);
            query = query.Where(p => ipPatientIds.Contains(p.Id));
        }

        return query;
    }

    private async Task<IQueryable<Patient>> ApplyTabFilterAsync(IQueryable<Patient> query, PatientLookupQuery q)
    {
        var tab = (q.Tab ?? "all").ToLowerInvariant();
        if (tab == "all") return query;

        if (tab == "new")
        {
            var cutoff = DateTime.UtcNow.AddDays(-30);
            return query.Where(p => p.CreatedAt >= cutoff);
        }

        if (tab == "current")
        {
            var currentIds = await _engagements.GetCurrentPatientIdsAsync(q.TenantId, q.BranchId);
            return query.Where(p => currentIds.Contains(p.Id));
        }

        if (tab == "discharged")
        {
            var currentIds = await _engagements.GetCurrentPatientIdsAsync(q.TenantId, q.BranchId);
            var hasCompletedVisit = _context.Visits
                .Where(v => v.TenantId == q.TenantId && v.BranchId == q.BranchId && v.DeletedAt == null)
                .Where(v => v.Status == "completed")
                .Select(v => v.PatientId);
            return query.Where(p => !currentIds.Contains(p.Id) && hasCompletedVisit.Contains(p.Id));
        }

        if (tab == "high_priority")
        {
            var bundles = await _engagements.LoadForPatientsAsync(q.TenantId, q.BranchId, Array.Empty<Guid>());
            var highIds = bundles
                .Where(kv => kv.Value.ClinicalAcuity is "high" or "critical"
                    || (kv.Value.QueuePriority != null && HighQueuePriorities.Contains(kv.Value.QueuePriority)))
                .Select(kv => kv.Key)
                .ToHashSet();
            return query.Where(p => highIds.Contains(p.Id));
        }

        return query;
    }

    private IQueryable<Patient> ApplyAssignedToMeFilter(IQueryable<Patient> query, PatientLookupQuery q)
    {
        if (!q.AssignedToMe) return query;

        var assignedPatientIds = _context.Visits
            .Where(v => v.TenantId == q.TenantId && v.BranchId == q.BranchId && v.DeletedAt == null)
            .Where(v => !CompletedVisitStatuses.Contains(v.Status))
            .Where(v => v.AssignedTo == q.UserId)
            .Select(v => v.PatientId);

        return query.Where(p => assignedPatientIds.Contains(p.Id));
    }

    private async Task<HashSet<Guid>> GetPatientIdsMatchingEngagementTypesAsync(
        Guid tenantId, Guid branchId, List<string> types)
    {
        var normalized = types.Select(t => t.Trim().ToLowerInvariant()).ToHashSet();
        var bundles = await _engagements.LoadForPatientsAsync(tenantId, branchId, Array.Empty<Guid>());
        return bundles
            .Where(kv => kv.Value.Engagements.Any(e => normalized.Contains(e.Type.ToLowerInvariant())))
            .Select(kv => kv.Key)
            .ToHashSet();
    }

    private async Task<List<Patient>> LoadEngagementSortedPageAsync(
        IQueryable<Patient> baseQuery,
        Guid tenantId,
        Guid branchId,
        string sortBy,
        string sortDir,
        int page,
        int pageSize)
    {
        var patientIds = await baseQuery.Select(p => p.Id).ToListAsync();
        if (patientIds.Count == 0) return new List<Patient>();

        var bundles = await _engagements.LoadForPatientsAsync(tenantId, branchId, patientIds);
        var desc = string.Equals(sortDir, "desc", StringComparison.OrdinalIgnoreCase);
        var key = (sortBy ?? "").ToLowerInvariant();

        IEnumerable<Guid> ordered = key switch
        {
            "acuity" => desc
                ? patientIds
                    .OrderByDescending(id => PatientLookupSortHelper.AcuityRank(
                        bundles.TryGetValue(id, out var a) ? a.ClinicalAcuity : null))
                    .ThenBy(id => id)
                : patientIds
                    .OrderBy(id => PatientLookupSortHelper.AcuityRank(
                        bundles.TryGetValue(id, out var b) ? b.ClinicalAcuity : null))
                    .ThenBy(id => id),
            "waitingminutes" => desc
                ? patientIds
                    .OrderByDescending(id => bundles.TryGetValue(id, out var w) ? w.WaitingMinutes : null)
                    .ThenBy(id => id)
                : patientIds
                    .OrderBy(id => bundles.TryGetValue(id, out var w2) ? w2.WaitingMinutes ?? int.MaxValue : int.MaxValue)
                    .ThenBy(id => id),
            _ => patientIds.OrderBy(id => id),
        };

        var pageIds = ordered.Skip((page - 1) * pageSize).Take(pageSize).ToList();
        if (pageIds.Count == 0) return new List<Patient>();

        var patients = await _context.Patients.AsNoTracking()
            .Where(p => pageIds.Contains(p.Id))
            .ToListAsync();

        var order = pageIds.Select((id, index) => (id, index)).ToDictionary(x => x.id, x => x.index);
        return patients.OrderBy(p => order[p.Id]).ToList();
    }

    private IQueryable<Patient> ApplySort(
        IQueryable<Patient> query,
        Guid tenantId,
        Guid branchId,
        string sortBy,
        string sortDir)
    {
        var desc = string.Equals(sortDir, "desc", StringComparison.OrdinalIgnoreCase);
        return (sortBy ?? "name").ToLowerInvariant() switch
        {
            "mrn" => desc
                ? query.OrderByDescending(p => p.MedicalRecordNumber)
                : query.OrderBy(p => p.MedicalRecordNumber),
            "scheduledat" => desc
                ? query.OrderByDescending(p => _context.Visits
                    .Where(v => v.TenantId == tenantId && v.BranchId == branchId && v.PatientId == p.Id && v.DeletedAt == null)
                    .Where(v => !CompletedVisitStatuses.Contains(v.Status))
                    .Max(v => (DateTime?)(v.CheckedInAt ?? v.CreatedAt)))
                : query.OrderBy(p => _context.Visits
                    .Where(v => v.TenantId == tenantId && v.BranchId == branchId && v.PatientId == p.Id && v.DeletedAt == null)
                    .Where(v => !CompletedVisitStatuses.Contains(v.Status))
                    .Max(v => (DateTime?)(v.CheckedInAt ?? v.CreatedAt))),
            "lastvisit" => desc
                ? query.OrderByDescending(p => _context.Visits
                    .Where(v => v.TenantId == tenantId && v.BranchId == branchId && v.PatientId == p.Id && v.DeletedAt == null)
                    .Max(v => (DateTime?)(v.CheckedInAt ?? v.CreatedAt)))
                : query.OrderBy(p => _context.Visits
                    .Where(v => v.TenantId == tenantId && v.BranchId == branchId && v.PatientId == p.Id && v.DeletedAt == null)
                    .Max(v => (DateTime?)(v.CheckedInAt ?? v.CreatedAt))),
            _ => desc
                ? query.OrderByDescending(p => p.LastName).ThenByDescending(p => p.FirstName)
                : query.OrderBy(p => p.LastName).ThenBy(p => p.FirstName)
        };
    }

    private static PatientLookupRowDto MapRow(Patient p, bool isFavorite, PatientEngagementBundle? e) =>
        new()
        {
            Id = p.Id,
            FirstName = p.FirstName,
            LastName = p.LastName,
            Mrn = p.MedicalRecordNumber,
            DateOfBirth = p.DateOfBirth,
            Gender = p.Gender,
            Phone = p.ContactNumber,
            Email = p.Email,
            PhotoThumbnailUrl = p.PhotoThumbnailUrl,
            IsFavorite = isFavorite,
            LastVisitAt = e?.LastVisitAt,
            CareProgramCodes = e?.CareProgramCodes ?? new List<string>(),
            ReasonForVisit = e?.ReasonForVisit,
            ScheduledAt = e?.ScheduledAt,
            ClinicalAcuity = e?.ClinicalAcuity ?? "low",
            QueuePriority = e?.QueuePriority,
            ActiveEngagements = e?.Engagements ?? new List<PatientActiveEngagementDto>(),
            AssignedProviderName = e?.AssignedProviderName,
            AssignedProviderRole = e?.AssignedProviderRole,
            PrimaryOpenVisitId = e?.PrimaryOpenVisitId,
            WaitingMinutes = e?.WaitingMinutes,
            CurrentStation = e?.CurrentStation,
            RoomNumber = e?.RoomNumber,
            IpAdmission = e?.IpAdmission
        };

    private static string Csv(string? value)
    {
        var v = value ?? "";
        if (v.Contains('"') || v.Contains(',') || v.Contains('\n'))
            return $"\"{v.Replace("\"", "\"\"")}\"";
        return v;
    }
}
