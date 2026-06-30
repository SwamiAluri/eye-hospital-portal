using AuthService.Context;
using AuthService.Models.Domain;
using AuthService.Models.Domain.Dtos;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using Npgsql;
using System.Text.Json;

namespace AuthService.Services;

public interface IPatientEngagementService
{
    Task<Dictionary<Guid, PatientEngagementBundle>> LoadForPatientsAsync(
        Guid tenantId, Guid branchId, IReadOnlyList<Guid> patientIds);

    Task<HashSet<Guid>> GetCurrentPatientIdsAsync(Guid tenantId, Guid branchId);
}

public sealed class PatientEngagementBundle
{
    public DateTime? LastVisitAt { get; init; }
    public string? ReasonForVisit { get; init; }
    public DateTime? ScheduledAt { get; init; }
    public List<string> CareProgramCodes { get; init; } = new();
    public string? QueuePriority { get; init; }
    public string ClinicalAcuity { get; init; } = "low";
    public List<PatientActiveEngagementDto> Engagements { get; init; } = new();
    public Guid? PrimaryOpenVisitId { get; init; }
    public string? AssignedProviderName { get; init; }
    public string? AssignedProviderRole { get; init; }
    public int? WaitingMinutes { get; init; }
    public string? CurrentStation { get; init; }
    public string? RoomNumber { get; init; }
    public PatientIpAdmissionDto? IpAdmission { get; init; }
}

public class PatientEngagementService : IPatientEngagementService
{
    private static readonly HashSet<string> CompletedVisitStatuses = new(StringComparer.OrdinalIgnoreCase)
    {
        "completed", "cancelled"
    };

    private static readonly HashSet<string> ActiveQueueStatuses = new(StringComparer.OrdinalIgnoreCase)
    {
        "waiting", "called", "in-progress"
    };

    private static readonly HashSet<string> TerminalCounselingStatuses = new(StringComparer.OrdinalIgnoreCase)
    {
        "completed", "cancelled", "noshow"
    };

    private static readonly HashSet<string> TerminalInsuranceStatuses = new(StringComparer.OrdinalIgnoreCase)
    {
        "approved", "rejected", "cancelled", "closed", "denied"
    };

    private readonly AppDbContext _context;
    private readonly IAcuityScoringService _acuity;
    private readonly ILogger<PatientEngagementService> _logger;

    public PatientEngagementService(
        AppDbContext context,
        IAcuityScoringService acuity,
        ILogger<PatientEngagementService> logger)
    {
        _context = context;
        _acuity = acuity;
        _logger = logger;
    }

    public async Task<HashSet<Guid>> GetCurrentPatientIdsAsync(Guid tenantId, Guid branchId)
    {
        var openVisitIds = await _context.Visits
            .AsNoTracking()
            .Where(v => v.TenantId == tenantId && v.BranchId == branchId && v.DeletedAt == null)
            .Where(v => !CompletedVisitStatuses.Contains(v.Status))
            .Select(v => v.PatientId)
            .ToListAsync();

        var queueIds = await _context.QueueItems
            .AsNoTracking()
            .Where(q => q.TenantId == tenantId && q.BranchId == branchId)
            .Where(q => ActiveQueueStatuses.Contains(q.Status))
            .Select(q => q.PatientId)
            .ToListAsync();

        var ipIds = await _context.PatientJourneys
            .AsNoTracking()
            .Where(j => j.TenantId == tenantId && (j.BranchId == null || j.BranchId == branchId))
            .Where(j => j.DeletedAt == null && !j.IsDischarged)
            .Select(j => j.PatientId)
            .ToListAsync();

        var counselingIds = await _context.CounselingSession
            .AsNoTracking()
            .Where(s => s.TenantId == tenantId && (s.BranchId == null || s.BranchId == branchId))
            .Where(s => s.DeletedAt == null && !TerminalCounselingStatuses.Contains(s.Status))
            .Select(s => s.PatientId)
            .ToListAsync();

        var insuranceIds = await _context.InsurancePreAuthorizations
            .AsNoTracking()
            .Where(p => p.TenantId == tenantId && p.BranchId == branchId)
            .Where(p => !TerminalInsuranceStatuses.Contains(p.Status))
            .Select(p => p.PatientId)
            .ToListAsync();

        var billingIds = await _context.Visits
            .AsNoTracking()
            .Where(v => v.TenantId == tenantId && v.BranchId == branchId && v.DeletedAt == null)
            .Where(v => !CompletedVisitStatuses.Contains(v.Status))
            .Where(v => v.CurrentStation != null && v.CurrentStation.ToLower().Contains("billing"))
            .Select(v => v.PatientId)
            .ToListAsync();

        var today = DateTime.UtcNow.Date;
        var campIds = await _context.CounselingSession
            .AsNoTracking()
            .Where(s => s.TenantId == tenantId && (s.BranchId == null || s.BranchId == branchId))
            .Where(s => s.DeletedAt == null && s.PatientType == "Camp")
            .Where(s => s.SessionDate >= today && !TerminalCounselingStatuses.Contains(s.Status))
            .Select(s => s.PatientId)
            .ToListAsync();

        var ccmsIds = await _context.CounselingSession
            .AsNoTracking()
            .Where(s => s.TenantId == tenantId && (s.BranchId == null || s.BranchId == branchId))
            .Where(s => s.DeletedAt == null && !TerminalCounselingStatuses.Contains(s.Status))
            .Where(s => s.PackageAddonsJson != null && s.PackageAddonsJson.Contains("ccmsCoverageCaseId"))
            .Select(s => s.PatientId)
            .ToListAsync();

        return openVisitIds
            .Concat(queueIds)
            .Concat(ipIds)
            .Concat(counselingIds)
            .Concat(insuranceIds)
            .Concat(billingIds)
            .Concat(campIds)
            .Concat(ccmsIds)
            .ToHashSet();
    }

    public async Task<Dictionary<Guid, PatientEngagementBundle>> LoadForPatientsAsync(
        Guid tenantId, Guid branchId, IReadOnlyList<Guid> patientIds)
    {
        var scopedIds = patientIds.Count > 0;
        var idSet = scopedIds ? patientIds.ToHashSet() : null;

        var openVisitsQuery = _context.Visits.AsNoTracking()
            .Where(v => v.TenantId == tenantId && v.BranchId == branchId && v.DeletedAt == null)
            .Where(v => !CompletedVisitStatuses.Contains(v.Status));
        if (scopedIds) openVisitsQuery = openVisitsQuery.Where(v => idSet!.Contains(v.PatientId));

        var openVisits = await openVisitsQuery
            .Include(v => v.Appointment)
            .Include(v => v.AssignedToUser)
            .ToListAsync();

        var deptIds = openVisits.Where(v => v.DepartmentId.HasValue).Select(v => v.DepartmentId!.Value).Distinct().ToList();
        var deptCodes = deptIds.Count == 0
            ? new Dictionary<Guid, string>()
            : await _context.Departments.AsNoTracking()
                .Where(d => deptIds.Contains(d.Id))
                .ToDictionaryAsync(d => d.Id, d => d.DepartmentCode);

        var queueQuery = _context.QueueItems.AsNoTracking()
            .Where(q => q.TenantId == tenantId && q.BranchId == branchId)
            .Where(q => ActiveQueueStatuses.Contains(q.Status));
        if (scopedIds) queueQuery = queueQuery.Where(q => idSet!.Contains(q.PatientId));
        var queueItems = await queueQuery.ToListAsync();

        var ipQuery = _context.PatientJourneys.AsNoTracking()
            .Where(j => j.TenantId == tenantId && (j.BranchId == null || j.BranchId == branchId))
            .Where(j => j.DeletedAt == null && !j.IsDischarged);
        if (scopedIds) ipQuery = ipQuery.Where(j => idSet!.Contains(j.PatientId));
        var ipJourneys = await ipQuery.ToListAsync();

        var counselingQuery = _context.CounselingSession.AsNoTracking()
            .Where(s => s.TenantId == tenantId && (s.BranchId == null || s.BranchId == branchId))
            .Where(s => s.DeletedAt == null && !TerminalCounselingStatuses.Contains(s.Status));
        if (scopedIds) counselingQuery = counselingQuery.Where(s => idSet!.Contains(s.PatientId));
        var counselingSessions = await counselingQuery.ToListAsync();

        var insuranceQuery = _context.InsurancePreAuthorizations.AsNoTracking()
            .Where(p => p.TenantId == tenantId && p.BranchId == branchId)
            .Where(p => !TerminalInsuranceStatuses.Contains(p.Status));
        if (scopedIds) insuranceQuery = insuranceQuery.Where(p => idSet!.Contains(p.PatientId));
        var preAuths = await insuranceQuery.ToListAsync();

        var lastVisitsQuery = _context.Visits.AsNoTracking()
            .Where(v => v.TenantId == tenantId && v.BranchId == branchId && v.DeletedAt == null);
        if (scopedIds) lastVisitsQuery = lastVisitsQuery.Where(v => idSet!.Contains(v.PatientId));
        var lastVisits = await lastVisitsQuery
            .GroupBy(v => v.PatientId)
            .Select(g => new { PatientId = g.Key, Last = g.Max(v => v.CheckedInAt ?? v.CreatedAt) })
            .ToListAsync();

        var apptQuery = _context.Appointments.AsNoTracking()
            .Where(a => a.TenantId == tenantId)
            .Where(a => a.Status != "Cancelled" && a.Status != "Completed")
            .Where(a => a.AppointmentDate >= DateTime.UtcNow.Date);
        if (scopedIds) apptQuery = apptQuery.Where(a => idSet!.Contains(a.PatientId));
        var upcomingAppts = await apptQuery.OrderBy(a => a.AppointmentDate).ToListAsync();

        var allPatientIds = scopedIds
            ? patientIds.Distinct().ToList()
            : openVisits.Select(v => v.PatientId)
                .Concat(queueItems.Select(q => q.PatientId))
                .Concat(ipJourneys.Select(j => j.PatientId))
                .Concat(counselingSessions.Select(s => s.PatientId))
                .Concat(preAuths.Select(p => p.PatientId))
                .Distinct()
                .ToList();

        var patients = allPatientIds.Count == 0
            ? new Dictionary<Guid, Patient>()
            : await _context.Patients.AsNoTracking()
                .Where(p => allPatientIds.Contains(p.Id))
                .ToDictionaryAsync(p => p.Id);

        var latestVitals = allPatientIds.Count == 0
            ? new Dictionary<Guid, PatientVitalSigns>()
            : await _context.PatientVitalSigns.AsNoTracking()
                .Where(v => v.TenantId == tenantId && allPatientIds.Contains(v.PatientId) && v.DeletedAt == null)
                .GroupBy(v => v.PatientId)
                .Select(g => g.OrderByDescending(v => v.MeasurementDate).First())
                .ToDictionaryAsync(v => v.PatientId);

        var criticalNotes = await LoadCriticalNotePatientIdsAsync(tenantId, allPatientIds);

        var activeBedWards = allPatientIds.Count == 0
            ? new Dictionary<Guid, string?>()
            : await _context.BedInventories.AsNoTracking()
                .Where(b => b.TenantId == tenantId && b.BranchId == branchId && b.PatientId != null)
                .Where(b => allPatientIds.Contains(b.PatientId!.Value))
                .Where(b => b.BedStatus == "Occupied")
                .GroupBy(b => b.PatientId!.Value)
                .Select(g => new
                {
                    PatientId = g.Key,
                    WardName = g.OrderByDescending(b => b.CreatedAt).Select(b => b.WardName).FirstOrDefault(),
                })
                .ToDictionaryAsync(x => x.PatientId, x => x.WardName);

        var result = new Dictionary<Guid, PatientEngagementBundle>();

        foreach (var pid in allPatientIds)
        {
            patients.TryGetValue(pid, out var patient);
            var engagements = new List<PatientActiveEngagementDto>();
            var careCodes = new List<string>();
            string? queuePriority = null;
            var isEmergency = false;
            var hasUrgentIp = false;

            foreach (var v in openVisits.Where(x => x.PatientId == pid))
            {
                engagements.Add(new PatientActiveEngagementDto
                {
                    Type = "opd",
                    Label = "OPD",
                    Status = v.CurrentStation ?? v.Status,
                    Priority = v.IsEmergency ? "emergency" : null
                });
                if (v.DepartmentId.HasValue && deptCodes.TryGetValue(v.DepartmentId.Value, out var code))
                    careCodes.Add(code);
                if (v.IsEmergency) isEmergency = true;

                if (v.CurrentStation != null && v.CurrentStation.Contains("billing", StringComparison.OrdinalIgnoreCase))
                {
                    engagements.Add(new PatientActiveEngagementDto
                    {
                        Type = "billing",
                        Label = "Billing",
                        Status = v.Status
                    });
                }
            }

            foreach (var q in queueItems.Where(x => x.PatientId == pid))
            {
                engagements.Add(new PatientActiveEngagementDto
                {
                    Type = "queue",
                    Label = "Queue",
                    Status = q.Status,
                    Priority = q.Priority
                });
                queuePriority = q.Priority;
            }

            foreach (var j in ipJourneys.Where(x => x.PatientId == pid))
            {
                engagements.Add(new PatientActiveEngagementDto
                {
                    Type = "ip",
                    Label = "IP",
                    Status = j.ClinicalState
                });
                if (j.ClinicalState.Contains("urgent", StringComparison.OrdinalIgnoreCase))
                    hasUrgentIp = true;
            }

            foreach (var s in counselingSessions.Where(x => x.PatientId == pid))
            {
                engagements.Add(new PatientActiveEngagementDto
                {
                    Type = "counselling",
                    Label = "Counselling",
                    Status = s.Status,
                    Priority = s.Urgency
                });
                if (string.Equals(s.PatientType, "Camp", StringComparison.OrdinalIgnoreCase))
                {
                    engagements.Add(new PatientActiveEngagementDto
                    {
                        Type = "camp",
                        Label = "Camp",
                        Status = s.Status
                    });
                }

                if (TryParseCcmsCoverageCase(s.PackageAddonsJson, out var caseNumber, out var ccmsState))
                {
                    engagements.Add(new PatientActiveEngagementDto
                    {
                        Type = "ccms",
                        Label = "CCMS",
                        Status = ccmsState ?? caseNumber ?? "Active"
                    });
                }
            }

            foreach (var p in preAuths.Where(x => x.PatientId == pid))
            {
                engagements.Add(new PatientActiveEngagementDto
                {
                    Type = "insurance",
                    Label = "Pre-auth",
                    Status = p.Status
                });
            }

            latestVitals.TryGetValue(pid, out var vitals);
            var acuity = _acuity.Compute(
                isEmergency,
                queuePriority,
                patient != null && AcuityScoringService.IsSevereAllergy(patient),
                criticalNotes.Contains(pid),
                AcuityScoringService.IsAbnormalVitals(vitals),
                hasUrgentIp);

            var patientOpenVisits = openVisits.Where(v => v.PatientId == pid).ToList();
            var primaryVisit = patientOpenVisits.OrderByDescending(v => v.CheckedInAt).FirstOrDefault();
            var appt = upcomingAppts.Where(a => a.PatientId == pid).OrderBy(a => a.AppointmentDate).FirstOrDefault();
            var lastVisit = lastVisits.FirstOrDefault(l => l.PatientId == pid)?.Last;
            var assignedName = FormatUserName(primaryVisit?.AssignedToUser);
            var activeJourney = ipJourneys.Where(j => j.PatientId == pid && !j.IsDischarged)
                .OrderByDescending(j => j.CreatedAt)
                .FirstOrDefault();
            PatientIpAdmissionDto? ipAdmission = null;
            if (activeJourney != null)
            {
                activeBedWards.TryGetValue(pid, out var wardName);
                ipAdmission = new PatientIpAdmissionDto
                {
                    IsAdmitted = true,
                    AdmittedAt = activeJourney.CreatedAt,
                    ClinicalState = activeJourney.ClinicalState,
                    ProcedureName = activeJourney.ProcedureName,
                    WardName = wardName,
                };
            }

            var patientQueues = queueItems.Where(x => x.PatientId == pid)
                .OrderBy(q => q.CheckedInAt)
                .ToList();
            var primaryQueue = patientQueues.FirstOrDefault();

            int? waitingMinutes = null;
            string? currentStation = null;
            string? roomNumber = null;

            if (primaryQueue != null)
            {
                waitingMinutes = Math.Max(0, (int)(DateTime.UtcNow - primaryQueue.CheckedInAt).TotalMinutes);
                currentStation = primaryQueue.QueueType;
                roomNumber = primaryQueue.RoomNumber;
            }
            else if (primaryVisit?.CheckedInAt != null)
            {
                waitingMinutes = Math.Max(0, (int)(DateTime.UtcNow - primaryVisit.CheckedInAt.Value).TotalMinutes);
                currentStation = primaryVisit.CurrentStation;
            }

            if (ipAdmission?.IsAdmitted == true && !string.IsNullOrWhiteSpace(ipAdmission.WardName))
                currentStation = ipAdmission.WardName;

            var assignedProviderRole = primaryVisit?.AssignedToUser?.UserType;
            if (string.IsNullOrWhiteSpace(assignedProviderRole) && primaryQueue != null)
                assignedProviderRole = PatientHubQueueLabels.MapQueueTypeToRole(primaryQueue.QueueType);

            result[pid] = new PatientEngagementBundle
            {
                LastVisitAt = lastVisit,
                ReasonForVisit = primaryVisit?.Appointment?.ReasonForVisit ?? appt?.ReasonForVisit,
                ScheduledAt = primaryVisit?.CheckedInAt
                    ?? (appt != null ? appt.AppointmentDate.Date + (appt.StartTime ?? TimeSpan.Zero) : null),
                CareProgramCodes = careCodes.Distinct(StringComparer.OrdinalIgnoreCase).ToList(),
                QueuePriority = queuePriority,
                ClinicalAcuity = acuity,
                Engagements = engagements,
                PrimaryOpenVisitId = primaryVisit?.Id,
                AssignedProviderName = assignedName,
                AssignedProviderRole = assignedProviderRole,
                WaitingMinutes = waitingMinutes,
                CurrentStation = currentStation,
                RoomNumber = roomNumber,
                IpAdmission = ipAdmission,
            };
        }

        return result;
    }

    private async Task<HashSet<Guid>> LoadCriticalNotePatientIdsAsync(
        Guid tenantId,
        IReadOnlyList<Guid> patientIds)
    {
        if (patientIds.Count == 0)
            return new HashSet<Guid>();

        try
        {
            return await _context.PatientNotes
                .AsNoTracking()
                .Where(n => n.TenantId == tenantId && patientIds.Contains(n.PatientId))
                .Where(n => n.DeletedAt == null && n.Priority == "critical")
                .Select(n => n.PatientId)
                .ToHashSetAsync();
        }
        catch (PostgresException ex) when (ex.SqlState == PostgresErrorCodes.UndefinedTable)
        {
            _logger.LogWarning(
                "patient_notes table is unavailable; skipping critical-note acuity signals ({SqlState})",
                ex.SqlState);
            return new HashSet<Guid>();
        }
    }

    /// <summary>
    /// Reads CCMS coverage-case linkage written by InternalCcmsCallbackController into PackageAddonsJson.
    /// </summary>
    private static bool TryParseCcmsCoverageCase(
        string? packageAddonsJson,
        out string? caseNumber,
        out string? currentState)
    {
        caseNumber = null;
        currentState = null;
        if (string.IsNullOrWhiteSpace(packageAddonsJson))
            return false;

        try
        {
            using var doc = JsonDocument.Parse(packageAddonsJson);
            var root = doc.RootElement;
            if (!root.TryGetProperty("ccmsCoverageCaseId", out var idProp))
                return false;

            var id = idProp.GetString();
            if (string.IsNullOrWhiteSpace(id))
                return false;

            if (root.TryGetProperty("ccmsCaseNumber", out var cn))
                caseNumber = cn.GetString();
            if (root.TryGetProperty("ccmsCurrentState", out var st))
                currentState = st.GetString();

            return true;
        }
        catch
        {
            return false;
        }
    }

    private static string? FormatUserName(AuthService.Models.Identity.AppUser? user)
    {
        if (user == null) return null;
        var name = $"{user.FirstName ?? ""} {user.LastName ?? ""}".Trim();
        return string.IsNullOrWhiteSpace(name) ? user.UserName : name;
    }
}
