using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using AuthService.Context;
using AuthService.Models.Counselor;
using AuthService.Models.Domain;
using Microsoft.EntityFrameworkCore;

namespace AuthService.Services;

public interface IFollowupListService
{
    Task<FollowupPagedResult<ActiveFollowupItemDto>> GetActiveAsync(
        Guid tenantId,
        Guid? branchId,
        string? intention,
        string? q,
        int page,
        int pageSize,
        CancellationToken ct = default);

    Task<FollowupPagedResult<ColdLeadItemDto>> GetColdLeadsAsync(
        Guid tenantId,
        Guid? branchId,
        string? q,
        int page,
        int pageSize,
        CancellationToken ct = default);

    Task<FollowupPagedResult<PostSurgeryFollowupItemDto>> GetPostSurgeryAsync(
        Guid tenantId,
        Guid? branchId,
        string? q,
        int page,
        int pageSize,
        CancellationToken ct = default);

    Task<FollowupStatsDto> GetStatsAsync(
        Guid tenantId,
        Guid? branchId,
        string? intention,
        string? q,
        CancellationToken ct = default);
}

/// <summary>
/// Phase 2B — server-side Follow-up list/search/stats.
/// Populations match CounselingController Phase F predicates (unchanged).
/// Does NOT implement due-date rules.
/// </summary>
public class FollowupListService : IFollowupListService
{
    private readonly AppDbContext _context;

    public FollowupListService(AppDbContext context)
    {
        _context = context;
    }

    public async Task<FollowupPagedResult<ActiveFollowupItemDto>> GetActiveAsync(
        Guid tenantId,
        Guid? branchId,
        string? intention,
        string? q,
        int page,
        int pageSize,
        CancellationToken ct = default)
    {
        (page, pageSize) = FollowupQueryContracts.NormalizePagination(page, pageSize);
        var query = BuildActiveSessionQuery(tenantId, branchId, intention, q);

        var total = await query.CountAsync(ct);
        var sessions = await query
            .OrderBy(s => s.LastContactDate == null ? 0 : 1)
            .ThenBy(s => s.LastContactDate)
            .ThenBy(s => s.Id)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .AsNoTracking()
            .ToListAsync(ct);

        var patients = await LoadPatientsAsync(tenantId, sessions.Select(s => s.PatientId), ct);

        var items = sessions.Select(s =>
        {
            patients.TryGetValue(s.PatientId, out var pt);
            return new ActiveFollowupItemDto
            {
                SessionId = s.Id,
                PatientId = s.PatientId,
                PatientName = FormatName(pt),
                Uhid = pt?.MedicalRecordNumber,
                Phone = pt?.ContactNumber,
                BranchId = s.BranchId,
                RecommendedSurgery = s.RecommendedSurgery,
                PatientIntention = s.PatientIntention,
                SessionDate = s.SessionDate,
                LastContactDate = s.LastContactDate,
                ContactAttemptCount = s.ContactAttemptCount,
                LastContactOutcome = s.LastContactOutcome,
                EscalationStatus = s.EscalationStatus,
                OverdueSinceDate = s.OverdueSinceDate,
                AlertLevel = FollowupQueryContracts.MapAlertLevel(s.EscalationStatus, s.LastContactDate),
            };
        }).ToList();

        return new FollowupPagedResult<ActiveFollowupItemDto>
        {
            Total = total,
            Page = page,
            PageSize = pageSize,
            Items = items,
        };
    }

    public async Task<FollowupPagedResult<ColdLeadItemDto>> GetColdLeadsAsync(
        Guid tenantId,
        Guid? branchId,
        string? q,
        int page,
        int pageSize,
        CancellationToken ct = default)
    {
        (page, pageSize) = FollowupQueryContracts.NormalizePagination(page, pageSize);
        var query = BuildColdSessionQuery(tenantId, branchId, q);

        var total = await query.CountAsync(ct);
        var sessions = await query
            .OrderByDescending(s => s.UpdatedAt ?? s.CreatedAt)
            .ThenBy(s => s.Id)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .AsNoTracking()
            .ToListAsync(ct);

        var patients = await LoadPatientsAsync(tenantId, sessions.Select(s => s.PatientId), ct);

        var items = sessions.Select(s =>
        {
            patients.TryGetValue(s.PatientId, out var pt);
            return new ColdLeadItemDto
            {
                SessionId = s.Id,
                PatientId = s.PatientId,
                PatientName = FormatName(pt),
                Uhid = pt?.MedicalRecordNumber,
                Phone = pt?.ContactNumber,
                BranchId = s.BranchId,
                RecommendedSurgery = s.RecommendedSurgery,
                PatientIntention = s.PatientIntention,
                SessionDate = s.SessionDate,
                LastContactDate = s.LastContactDate,
                ContactAttemptCount = s.ContactAttemptCount,
                LastContactOutcome = s.LastContactOutcome,
                AdditionalNotes = s.AdditionalNotes,
            };
        }).ToList();

        return new FollowupPagedResult<ColdLeadItemDto>
        {
            Total = total,
            Page = page,
            PageSize = pageSize,
            Items = items,
        };
    }

    public async Task<FollowupPagedResult<PostSurgeryFollowupItemDto>> GetPostSurgeryAsync(
        Guid tenantId,
        Guid? branchId,
        string? q,
        int page,
        int pageSize,
        CancellationToken ct = default)
    {
        (page, pageSize) = FollowupQueryContracts.NormalizePagination(page, pageSize);
        var journeyQuery = BuildPostSurgeryJourneyQuery(tenantId, branchId, q);

        var total = await journeyQuery.CountAsync(ct);
        var journeys = await journeyQuery
            .Include(j => j.Patient)
            .OrderByDescending(j => j.DischargedAt)
            .ThenBy(j => j.Id)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .AsNoTracking()
            .ToListAsync(ct);

        var journeyIds = journeys.Select(j => j.Id).ToList();
        var patientIds = journeys.Select(j => j.PatientId).Distinct().ToList();

        var discharges = await _context.DischargeSummaries
            .AsNoTracking()
            .Where(d => journeyIds.Contains(d.PatientJourneyId) && d.DeletedAt == null)
            .ToDictionaryAsync(d => d.PatientJourneyId, ct);

        var pendingVisits = await LoadPendingVisitCountsAsync(tenantId, patientIds, ct);

        var latestSessions = await _context.CounselingSession
            .AsNoTracking()
            .Where(s => patientIds.Contains(s.PatientId) && s.TenantId == tenantId && s.DeletedAt == null)
            .GroupBy(s => s.PatientId)
            .Select(g => new { PatientId = g.Key, SessionId = g.OrderByDescending(s => s.CreatedAt).First().Id })
            .ToDictionaryAsync(x => x.PatientId, x => x.SessionId, ct);

        var now = DateTime.UtcNow;
        var items = journeys.Select(j =>
        {
            discharges.TryGetValue(j.Id, out var ds);
            pendingVisits.TryGetValue(j.PatientId, out var visitCount);
            latestSessions.TryGetValue(j.PatientId, out var latestSessionId);
            return new PostSurgeryFollowupItemDto
            {
                JourneyId = j.Id,
                PatientId = j.PatientId,
                PatientName = FormatName(j.Patient),
                Uhid = j.Uhid ?? j.Patient?.MedicalRecordNumber,
                Phone = j.Patient?.ContactNumber,
                BranchId = j.BranchId,
                SessionId = latestSessionId == Guid.Empty ? null : latestSessionId,
                SurgeryType = j.ProcedureName,
                DischargedAt = j.DischargedAt,
                DaysSinceDischarge = j.DischargedAt.HasValue
                    ? (int)(now - j.DischargedAt.Value).TotalDays
                    : null,
                ConditionAtDischarge = ds?.ConditionAtDischarge,
                DischargeDate = ds?.DischargeDate,
                PendingPostOpVisits = visitCount,
            };
        }).ToList();

        return new FollowupPagedResult<PostSurgeryFollowupItemDto>
        {
            Total = total,
            Page = page,
            PageSize = pageSize,
            Items = items,
        };
    }

    public async Task<FollowupStatsDto> GetStatsAsync(
        Guid tenantId,
        Guid? branchId,
        string? intention,
        string? q,
        CancellationToken ct = default)
    {
        var term = FollowupQueryContracts.NormalizeSearch(q);
        var activeQ = BuildActiveSessionQuery(tenantId, branchId, intention, q);
        var coldQ = BuildColdSessionQuery(tenantId, branchId, q);
        var postQ = BuildPostSurgeryJourneyQuery(tenantId, branchId, q);

        var activeTotal = await activeQ.CountAsync(ct);
        var urgentHigh = await activeQ.CountAsync(
            s => s.EscalationStatus == "SupervisorAlert" || s.EscalationStatus == "Escalated", ct);
        var neverContacted = await activeQ.CountAsync(s => s.LastContactDate == null, ct);
        double? activeAvg = activeTotal == 0
            ? null
            : await activeQ.AverageAsync(s => (double)s.ContactAttemptCount, ct);

        var coldTotal = await coldQ.CountAsync(ct);
        var declined = await coldQ.CountAsync(s => s.PatientIntention == "Declined", ct);
        var referred = await coldQ.CountAsync(s => s.PatientIntention == "ReferredElsewhere", ct);
        double? coldAvg = coldTotal == 0
            ? null
            : await coldQ.AverageAsync(s => (double)s.ContactAttemptCount, ct);

        var postTotal = await postQ.CountAsync(ct);
        var cutoff = DateTime.UtcNow.AddDays(-30);
        var over30 = await postQ.CountAsync(
            j => j.DischargedAt != null && j.DischargedAt <= cutoff, ct);

        var now = DateTime.UtcNow;
        double? avgDays = null;
        var withDischarge = postQ.Where(j => j.DischargedAt != null);
        if (await withDischarge.AnyAsync(ct))
        {
            avgDays = await withDischarge.AverageAsync(
                j => (double)(now - j.DischargedAt!.Value).TotalDays, ct);
        }

        // Pending incomplete visits for patients in the filtered post-surgery set (DB-side join).
        var pendingVisits = await (
            from j in postQ
            join s in _context.PostOpCareSchedules.AsNoTracking()
                on j.PatientId equals s.PatientId
            join v in _context.PostOpVisits.AsNoTracking()
                on s.Id equals v.PostOpCareScheduleId
            where s.TenantId == tenantId
               && s.DeletedAt == null
               && !v.Completed
               && v.DeletedAt == null
            select v.Id
        ).CountAsync(ct);

        return new FollowupStatsDto
        {
            Filters = new FollowupStatsFiltersDto
            {
                BranchId = branchId,
                Intention = intention,
                Q = string.IsNullOrEmpty(term) ? null : term,
                Scope = "filtered",
            },
            Active = new FollowupActiveStatsDto
            {
                Total = activeTotal,
                UrgentHigh = urgentHigh,
                NeverContacted = neverContacted,
                AverageAttempts = activeAvg,
            },
            Cold = new FollowupColdStatsDto
            {
                Total = coldTotal,
                Declined = declined,
                ReferredElsewhere = referred,
                AverageAttempts = coldAvg,
            },
            PostSurgery = new FollowupPostSurgeryStatsDto
            {
                Total = postTotal,
                Over30Days = over30,
                PendingPostOpVisits = pendingVisits,
                AverageDaysSinceDischarge = avgDays,
            },
        };
    }

    // ── Query builders (shared by list + stats) ──────────────────────────────

    internal IQueryable<CounselingSession> BuildActiveSessionQuery(
        Guid tenantId, Guid? branchId, string? intention, string? q)
    {
        var activeIntentions = FollowupQueryContracts.ActiveIntentions;
        var query = _context.CounselingSession
            .AsNoTracking()
            .Where(s => s.TenantId == tenantId
                     && s.DeletedAt == null
                     && activeIntentions.Contains(s.PatientIntention ?? "")
                     && (branchId == null || s.BranchId == branchId)
                     && (intention == null || s.PatientIntention == intention));

        return ApplySessionSearch(query, tenantId, q);
    }

    internal IQueryable<CounselingSession> BuildColdSessionQuery(
        Guid tenantId, Guid? branchId, string? q)
    {
        var coldIntentions = FollowupQueryContracts.ColdIntentions;
        var query = _context.CounselingSession
            .AsNoTracking()
            .Where(s => s.TenantId == tenantId
                     && s.DeletedAt == null
                     && coldIntentions.Contains(s.PatientIntention ?? "")
                     && (branchId == null || s.BranchId == branchId));

        return ApplySessionSearch(query, tenantId, q);
    }

    internal IQueryable<PatientJourneyReadOnly> BuildPostSurgeryJourneyQuery(
        Guid tenantId, Guid? branchId, string? q)
    {
        var query = _context.PatientJourneys
            .AsNoTracking()
            .Where(j => j.TenantId == tenantId
                     && j.IsDischarged == true
                     && j.DeletedAt == null
                     && (branchId == null || j.BranchId == branchId));

        var term = FollowupQueryContracts.NormalizeSearch(q);
        if (string.IsNullOrEmpty(term))
            return query;

        // Join patient for searchable demographics; also match journey Uhid / ProcedureName.
        return from j in query
               join p in _context.Patients.AsNoTracking() on j.PatientId equals p.Id into pj
               from p in pj.DefaultIfEmpty()
               where (p == null || p.TenantId == tenantId)
                  && (
                       (p != null && ((p.FirstName + " " + p.LastName).ToLower().Contains(term)))
                    || (p != null && p.MedicalRecordNumber != null && p.MedicalRecordNumber.ToLower().Contains(term))
                    || (p != null && p.ContactNumber != null && p.ContactNumber.ToLower().Contains(term))
                    || (j.Uhid != null && j.Uhid.ToLower().Contains(term))
                    || (j.ProcedureName != null && j.ProcedureName.ToLower().Contains(term))
                  )
               select j;
    }

    private IQueryable<CounselingSession> ApplySessionSearch(
        IQueryable<CounselingSession> query, Guid tenantId, string? q)
    {
        var term = FollowupQueryContracts.NormalizeSearch(q);
        if (string.IsNullOrEmpty(term))
            return query;

        return from s in query
               join p in _context.Patients.AsNoTracking() on s.PatientId equals p.Id
               where p.TenantId == tenantId
                  && (
                       ((p.FirstName + " " + p.LastName).ToLower().Contains(term))
                    || (p.MedicalRecordNumber != null && p.MedicalRecordNumber.ToLower().Contains(term))
                    || (p.ContactNumber != null && p.ContactNumber.ToLower().Contains(term))
                    || (s.RecommendedSurgery != null && s.RecommendedSurgery.ToLower().Contains(term))
                  )
               select s;
    }

    private async Task<Dictionary<Guid, Patient>> LoadPatientsAsync(
        Guid tenantId, IEnumerable<Guid> patientIds, CancellationToken ct)
    {
        var ids = patientIds.Distinct().ToList();
        if (ids.Count == 0)
            return new Dictionary<Guid, Patient>();

        return await _context.Patients
            .AsNoTracking()
            .Where(p => ids.Contains(p.Id) && p.TenantId == tenantId)
            .ToDictionaryAsync(p => p.Id, ct);
    }

    private async Task<Dictionary<Guid, int>> LoadPendingVisitCountsAsync(
        Guid tenantId, List<Guid> patientIds, CancellationToken ct)
    {
        if (patientIds.Count == 0)
            return new Dictionary<Guid, int>();

        var scheduleIds = await _context.PostOpCareSchedules
            .AsNoTracking()
            .Where(s => patientIds.Contains(s.PatientId)
                     && s.TenantId == tenantId
                     && s.DeletedAt == null)
            .Select(s => new { s.Id, s.PatientId })
            .ToListAsync(ct);

        if (scheduleIds.Count == 0)
            return new Dictionary<Guid, int>();

        var schedulePatientMap = scheduleIds.ToDictionary(s => s.Id, s => s.PatientId);
        var scheduleIdList = scheduleIds.Select(s => s.Id).ToList();

        var incompleteVisits = await _context.PostOpVisits
            .AsNoTracking()
            .Where(v => scheduleIdList.Contains(v.PostOpCareScheduleId)
                     && !v.Completed
                     && v.DeletedAt == null)
            .Select(v => v.PostOpCareScheduleId)
            .ToListAsync(ct);

        return incompleteVisits
            .Where(sid => schedulePatientMap.ContainsKey(sid))
            .GroupBy(sid => schedulePatientMap[sid])
            .ToDictionary(g => g.Key, g => g.Count());
    }

    private static string FormatName(Patient? pt)
        => pt != null ? (pt.FirstName + " " + pt.LastName).Trim() : "Unknown";
}
