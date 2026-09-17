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
        IReadOnlyCollection<Guid> accessibleBranchIds,
        string? intention,
        string? q,
        int page,
        int pageSize,
        CancellationToken ct = default);

    Task<FollowupPagedResult<ColdLeadItemDto>> GetColdLeadsAsync(
        Guid tenantId,
        IReadOnlyCollection<Guid> accessibleBranchIds,
        string? q,
        int page,
        int pageSize,
        CancellationToken ct = default);

    Task<FollowupPagedResult<PostSurgeryFollowupItemDto>> GetPostSurgeryAsync(
        Guid tenantId,
        IReadOnlyCollection<Guid> accessibleBranchIds,
        string? q,
        int page,
        int pageSize,
        CancellationToken ct = default);

    Task<FollowupStatsDto> GetStatsAsync(
        Guid tenantId,
        IReadOnlyCollection<Guid> accessibleBranchIds,
        Guid? requestedBranchId,
        string? intention,
        string? q,
        CancellationToken ct = default);
}

/// <summary>
/// Phase 2B / Phase2X — server-side Follow-up list/search/stats.
/// Populations: Active allowlist / Cold Declined+ReferredElsewhere / discharged journeys.
/// Does NOT implement due-date rules or automatic lifecycle exits.
/// Phase2X Slice 2: does NOT exclude Active rows for clinical surgery-completion / OT / discharge / agreement.
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
        IReadOnlyCollection<Guid> accessibleBranchIds,
        string? intention,
        string? q,
        int page,
        int pageSize,
        CancellationToken ct = default)
    {
        (page, pageSize) = FollowupQueryContracts.NormalizePagination(page, pageSize);
        if (accessibleBranchIds.Count == 0)
        {
            return EmptyPage<ActiveFollowupItemDto>(page, pageSize);
        }

        var query = BuildActiveSessionQuery(tenantId, accessibleBranchIds, intention, q);

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
        var counselorNames = await LoadCounselorNamesAsync(sessions.Select(s => s.CounselorId), ct);

        var items = sessions.Select(s =>
        {
            patients.TryGetValue(s.PatientId, out var pt);
            string? counselorName = null;
            if (s.CounselorId.HasValue)
                counselorNames.TryGetValue(s.CounselorId.Value, out counselorName);

            return new ActiveFollowupItemDto
            {
                SessionId = s.Id,
                PatientId = s.PatientId,
                PatientName = FormatName(pt),
                Uhid = pt?.MedicalRecordNumber,
                Phone = pt?.ContactNumber,
                BranchId = s.BranchId,
                CounselorId = s.CounselorId,
                CounselorName = counselorName,
                RecommendedSurgery = s.RecommendedSurgery,
                PatientIntention = s.PatientIntention,
                SessionDate = s.SessionDate,
                LastContactDate = s.LastContactDate,
                ContactAttemptCount = s.ContactAttemptCount,
                LastContactOutcome = s.LastContactOutcome,
                EscalationStatus = s.EscalationStatus,
                OverdueSinceDate = s.OverdueSinceDate,
                // Phase2Y: residual echo only — Center UI must not present AlertLevel as priority.
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
        IReadOnlyCollection<Guid> accessibleBranchIds,
        string? q,
        int page,
        int pageSize,
        CancellationToken ct = default)
    {
        (page, pageSize) = FollowupQueryContracts.NormalizePagination(page, pageSize);
        if (accessibleBranchIds.Count == 0)
        {
            return EmptyPage<ColdLeadItemDto>(page, pageSize);
        }

        var query = BuildColdSessionQuery(tenantId, accessibleBranchIds, q);

        var total = await query.CountAsync(ct);
        var sessions = await query
            .OrderByDescending(s => s.LastContactDate)
            .ThenBy(s => s.Id)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .AsNoTracking()
            .ToListAsync(ct);

        var patients = await LoadPatientsAsync(tenantId, sessions.Select(s => s.PatientId), ct);
        var counselorNames = await LoadCounselorNamesAsync(sessions.Select(s => s.CounselorId), ct);

        var items = sessions.Select(s =>
        {
            patients.TryGetValue(s.PatientId, out var pt);
            string? counselorName = null;
            if (s.CounselorId.HasValue)
                counselorNames.TryGetValue(s.CounselorId.Value, out counselorName);

            return new ColdLeadItemDto
            {
                SessionId = s.Id,
                PatientId = s.PatientId,
                PatientName = FormatName(pt),
                Uhid = pt?.MedicalRecordNumber,
                Phone = pt?.ContactNumber,
                BranchId = s.BranchId,
                CounselorId = s.CounselorId,
                CounselorName = counselorName,
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
        IReadOnlyCollection<Guid> accessibleBranchIds,
        string? q,
        int page,
        int pageSize,
        CancellationToken ct = default)
    {
        (page, pageSize) = FollowupQueryContracts.NormalizePagination(page, pageSize);
        if (accessibleBranchIds.Count == 0)
        {
            return EmptyPage<PostSurgeryFollowupItemDto>(page, pageSize);
        }

        var journeyQuery = BuildPostSurgeryJourneyQuery(tenantId, accessibleBranchIds, q);

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

        // Phase2X G13: do NOT attach opportunistic latest CounselingSession by CreatedAt.
        // No authoritative Journey → Session link exists; SessionId stays null.

        var now = DateTime.UtcNow;
        var items = journeys.Select(j =>
        {
            discharges.TryGetValue(j.Id, out var ds);
            pendingVisits.TryGetValue(j.PatientId, out var visitCount);
            return new PostSurgeryFollowupItemDto
            {
                JourneyId = j.Id,
                PatientId = j.PatientId,
                PatientName = FormatName(j.Patient),
                Uhid = j.Uhid ?? j.Patient?.MedicalRecordNumber,
                Phone = j.Patient?.ContactNumber,
                BranchId = j.BranchId,
                SessionId = null,
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
        IReadOnlyCollection<Guid> accessibleBranchIds,
        Guid? requestedBranchId,
        string? intention,
        string? q,
        CancellationToken ct = default)
    {
        var term = FollowupQueryContracts.NormalizeSearch(q);
        if (accessibleBranchIds.Count == 0)
        {
            return new FollowupStatsDto
            {
                Filters = new FollowupStatsFiltersDto
                {
                    BranchId = requestedBranchId,
                    Intention = intention,
                    Q = string.IsNullOrEmpty(term) ? null : term,
                    Scope = "filtered",
                },
            };
        }

        var activeQ = BuildActiveSessionQuery(tenantId, accessibleBranchIds, intention, q);
        var coldQ = BuildColdSessionQuery(tenantId, accessibleBranchIds, q);
        var postQ = BuildPostSurgeryJourneyQuery(tenantId, accessibleBranchIds, q);
        var orphanQ = BuildOrphanSessionQuery(tenantId, accessibleBranchIds, q);

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
        var over30 = await postQ.CountAsync(j => j.DischargedAt != null && j.DischargedAt <= cutoff, ct);
        var postPatientIds = await postQ.Select(j => j.PatientId).Distinct().ToListAsync(ct);
        var pendingMap = await LoadPendingVisitCountsAsync(tenantId, postPatientIds, ct);
        var pendingVisits = pendingMap.Values.Sum();
        double? avgDays = null;
        var discharged = await postQ.Where(j => j.DischargedAt != null).Select(j => j.DischargedAt!.Value).ToListAsync(ct);
        if (discharged.Count > 0)
        {
            var now = DateTime.UtcNow;
            avgDays = discharged.Average(d => (now - d).TotalDays);
        }

        var orphanTotal = await orphanQ.CountAsync(ct);
        var willingNow = await orphanQ.CountAsync(s => s.PatientIntention == "WillingNow", ct);
        var willingTwoWeeks = await orphanQ.CountAsync(s => s.PatientIntention == "WillingTwoWeeks", ct);
        var willingSixMonths = await orphanQ.CountAsync(s => s.PatientIntention == "WillingSixMonths", ct);
        var secondOpinion = await orphanQ.CountAsync(s => s.PatientIntention == "SecondOpinion", ct);

        return new FollowupStatsDto
        {
            Filters = new FollowupStatsFiltersDto
            {
                BranchId = requestedBranchId,
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
            OrphanIntentions = new FollowupOrphanIntentionAuditDto
            {
                Total = orphanTotal,
                WillingNow = willingNow,
                WillingTwoWeeks = willingTwoWeeks,
                WillingSixMonths = willingSixMonths,
                SecondOpinion = secondOpinion,
            },
        };
    }

    // ── Query builders (shared by list + stats) ──────────────────────────────

    internal IQueryable<CounselingSession> BuildActiveSessionQuery(
        Guid tenantId, IReadOnlyCollection<Guid> accessibleBranchIds, string? intention, string? q)
    {
        var activeIntentions = FollowupQueryContracts.ActiveIntentions;
        var branchIds = accessibleBranchIds as Guid[] ?? accessibleBranchIds.ToArray();
        var query = _context.CounselingSession
            .AsNoTracking()
            .Where(s => s.TenantId == tenantId
                     && s.DeletedAt == null
                     && activeIntentions.Contains(s.PatientIntention ?? "")
                     && s.BranchId != null
                     && branchIds.Contains(s.BranchId.Value)
                     && (intention == null || s.PatientIntention == intention));

        return ApplySessionSearch(query, tenantId, q);
    }

    internal IQueryable<CounselingSession> BuildColdSessionQuery(
        Guid tenantId, IReadOnlyCollection<Guid> accessibleBranchIds, string? q)
    {
        var coldIntentions = FollowupQueryContracts.ColdIntentions;
        var branchIds = accessibleBranchIds as Guid[] ?? accessibleBranchIds.ToArray();
        var query = _context.CounselingSession
            .AsNoTracking()
            .Where(s => s.TenantId == tenantId
                     && s.DeletedAt == null
                     && coldIntentions.Contains(s.PatientIntention ?? "")
                     && s.BranchId != null
                     && branchIds.Contains(s.BranchId.Value));

        return ApplySessionSearch(query, tenantId, q);
    }

    internal IQueryable<CounselingSession> BuildOrphanSessionQuery(
        Guid tenantId, IReadOnlyCollection<Guid> accessibleBranchIds, string? q)
    {
        var orphanIntentions = FollowupQueryContracts.OrphanIntentions;
        var branchIds = accessibleBranchIds as Guid[] ?? accessibleBranchIds.ToArray();
        var query = _context.CounselingSession
            .AsNoTracking()
            .Where(s => s.TenantId == tenantId
                     && s.DeletedAt == null
                     && orphanIntentions.Contains(s.PatientIntention ?? "")
                     && s.BranchId != null
                     && branchIds.Contains(s.BranchId.Value));

        return ApplySessionSearch(query, tenantId, q);
    }

    internal IQueryable<PatientJourneyReadOnly> BuildPostSurgeryJourneyQuery(
        Guid tenantId, IReadOnlyCollection<Guid> accessibleBranchIds, string? q)
    {
        var branchIds = accessibleBranchIds as Guid[] ?? accessibleBranchIds.ToArray();
        var query = _context.PatientJourneys
            .AsNoTracking()
            .Where(j => j.TenantId == tenantId
                     && j.IsDischarged == true
                     && j.DeletedAt == null
                     && j.BranchId != null
                     && branchIds.Contains(j.BranchId.Value));

        var term = FollowupQueryContracts.NormalizeSearch(q);
        if (string.IsNullOrEmpty(term))
            return query;

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

    private async Task<Dictionary<Guid, string>> LoadCounselorNamesAsync(
        IEnumerable<Guid?> counselorIds, CancellationToken ct)
    {
        var ids = counselorIds.Where(id => id.HasValue).Select(id => id!.Value).Distinct().ToList();
        if (ids.Count == 0)
            return new Dictionary<Guid, string>();

        return await _context.Users
            .AsNoTracking()
            .Where(u => ids.Contains(u.Id))
            .ToDictionaryAsync(u => u.Id, u => ((u.FirstName ?? "") + " " + (u.LastName ?? "")).Trim(), ct);
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

    private static FollowupPagedResult<T> EmptyPage<T>(int page, int pageSize) => new()
    {
        Total = 0,
        Page = page,
        PageSize = pageSize,
        Items = new List<T>(),
    };

    private static string FormatName(Patient? pt)
        => pt != null ? (pt.FirstName + " " + pt.LastName).Trim() : "Unknown";
}
