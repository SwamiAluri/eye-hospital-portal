using System.Text.Json;
using AuthService.Context;
using AuthService.DTOs.Queue;
using AuthService.DTOs.Visit;using AuthService.Models.Domain;
using AuthService.Services.Interfaces;
using Microsoft.AspNetCore.SignalR;
using Microsoft.EntityFrameworkCore;
using AuthService.Hubs;

namespace AuthService.Services;

public class OptometryQueueService : IOptometryQueueService
{
    private const string OptometristStation = "optometrist";

    private readonly AppDbContext _context;
    private readonly IQueueService _queueService;
    private readonly IHubContext<QueueHub> _hubContext;
    private readonly ILogger<OptometryQueueService> _logger;

    private static readonly Dictionary<string, string> ReasonLabels = new(StringComparer.OrdinalIgnoreCase)
    {
        ["INITIAL_REFRACTION"] = "Initial refraction",
        ["POST_INVESTIGATION"] = "Post-investigation",
        ["DOCTOR_REQUESTED"] = "Doctor requested",
        ["PRE_SURGERY_MEASUREMENT"] = "Pre-surgery measurement",
        ["COUNSELLOR_REFRACTION"] = "Counsellor refraction",
        ["OPTICAL_DISPENSING"] = "Optical dispensing",
    };

    public OptometryQueueService(
        AppDbContext context,
        IQueueService queueService,
        IHubContext<QueueHub> hubContext,
        ILogger<OptometryQueueService> logger)
    {
        _context = context;
        _queueService = queueService;
        _hubContext = hubContext;
        _logger = logger;
    }

    public async Task<List<OptometryQueuePatientDto>> GetQueueAsync(Guid tenantId, Guid branchId, bool includeCompletedToday = true)
    {
        var today = DateTime.UtcNow.Date;

        var visits = await _context.Visits
            .Include(v => v.Patient)
            .Include(v => v.Appointment)
            .Include(v => v.AssignedToUser)
            .Where(v =>
                v.TenantId == tenantId &&
                v.BranchId == branchId &&
                v.DeletedAt == null &&
                (v.CurrentStation == OptometristStation || v.CurrentStation == "optometry") &&
                v.CheckedInAt.HasValue &&
                v.CheckedInAt.Value.Date == today)
            .ToListAsync();

        var visitIds = visits.Select(v => v.Id).ToList();
        var events = await _context.VisitStationEvents
            .Where(e => visitIds.Contains(e.VisitId) && e.Station == OptometristStation)
            .OrderByDescending(e => e.CreatedAt)
            .ToListAsync();

        var eventsByVisit = events.GroupBy(e => e.VisitId).ToDictionary(g => g.Key, g => g.ToList());

        var drafts = await _context.ExaminationDrafts
            .Where(d =>
                d.TenantId == tenantId &&
                d.VisitId != null &&
                visitIds.Contains(d.VisitId.Value))
            .ToListAsync();

        var result = new List<OptometryQueuePatientDto>();

        foreach (var visit in visits)
        {
            eventsByVisit.TryGetValue(visit.Id, out var visitEvents);
            visitEvents ??= new List<VisitStationEvent>();

            var latestEvent = visitEvents.FirstOrDefault();
            var latestCompleted = visitEvents.FirstOrDefault(e => e.EventType == "completed");
            var latestStarted = visitEvents.FirstOrDefault(e => e.EventType == "started");
            var latestQueued = visitEvents.FirstOrDefault(e => e.EventType == "queued");
            var latestReferred = visitEvents.FirstOrDefault(e => e.EventType == "referred");

            var status = MapQueueStatus(visit, visitEvents);
            if (status == "Completed" && !includeCompletedToday)
            {
                continue;
            }
            if (status == "Skipped" || status == "Referred")
            {
                if (!includeCompletedToday) continue;
            }

            var passNumber = latestQueued?.PassNumber ?? latestEvent?.PassNumber ?? 1;
            var reasonCode = latestQueued?.ReasonCode ?? latestEvent?.ReasonCode;
            var draft = drafts.FirstOrDefault(d => d.VisitId == visit.Id);

            result.Add(MapToDto(visit, status, passNumber, reasonCode, draft, latestStarted?.RoomCode));
        }

        return result
            .OrderBy(p => StatusOrder(p.Status))
            .ThenBy(p => UrgencyOrder(p.Urgency))
            .ThenBy(p => p.WaitingSince)
            .ToList();
    }

    public async Task<OptometryQueueStatsDto> GetStatsAsync(Guid tenantId, Guid branchId)
    {
        var queue = await GetQueueAsync(tenantId, branchId, includeCompletedToday: true);
        var waiting = queue.Where(p => p.Status == "Waiting").ToList();

        return new OptometryQueueStatsDto
        {
            TotalWaiting = waiting.Count,
            InProgress = queue.Count(p => p.Status == "In Progress"),
            Completed = queue.Count(p => p.Status == "Completed"),
            Referred = queue.Count(p => p.Status == "Referred"),
            EmergencyCount = queue.Count(p => p.Urgency == "Emergency" && p.Status is "Waiting" or "In Progress"),
            UrgentCount = queue.Count(p => p.Urgency == "Urgent" && p.Status is "Waiting" or "In Progress"),
            AverageWaitTime = waiting.Count == 0
                ? 0
                : (int)waiting.Average(p => p.WaitingSince.HasValue
                    ? (DateTime.UtcNow - p.WaitingSince.Value).TotalMinutes
                    : 0),
        };
    }

    public async Task<QueueDisplayData?> GetDisplayDataAsync(Guid tenantId, Guid branchId, Guid? departmentId = null)
    {
        var queue = await GetQueueAsync(tenantId, branchId, includeCompletedToday: false);

        if (departmentId.HasValue)
        {
            var deptVisitIds = await _context.Visits
                .Where(v => v.BranchId == branchId && v.DepartmentId == departmentId.Value)
                .Select(v => v.Id)
                .ToListAsync();
            var deptSet = deptVisitIds.ToHashSet();
            queue = queue.Where(p => p.VisitId != Guid.Empty && deptSet.Contains(p.VisitId)).ToList();
        }

        var inProgress = queue
            .Where(p => p.Status == "In Progress")
            .OrderByDescending(p => p.WaitingSince)
            .FirstOrDefault();
        var waiting = queue
            .Where(p => p.Status == "Waiting")
            .OrderBy(p => UrgencyOrder(p.Urgency))
            .ThenBy(p => p.WaitingSince)
            .ToList();

        if (inProgress == null && waiting.Count == 0)
        {
            return null;
        }

        var nextPatients = MapDisplayEntries(waiting);
        var nextTokens = nextPatients.Select(p => p.TokenNumber).Where(t => !string.IsNullOrWhiteSpace(t)).ToList();

        if (inProgress != null)
        {
            return new QueueDisplayData
            {
                CurrentToken = inProgress.TokenNumber,
                CurrentPatientName = inProgress.PatientName,
                CurrentGender = string.IsNullOrWhiteSpace(inProgress.Gender) ? "—" : inProgress.Gender,
                CurrentAgeCategory = QueueDisplayMapper.MapAgeCategory(Math.Max(0, inProgress.Age)),
                CurrentUrgency = inProgress.Urgency,
                CurrentIsReturnVisit = inProgress.IsReturnVisit,
                CurrentPassNumber = inProgress.PassNumber,
                CurrentReasonLabel = inProgress.ReasonLabel,
                NextTokens = nextTokens,
                NextPatients = nextPatients,
                DoctorName = inProgress.AssignedOptometrist ?? "Optometrist",
                RoomNumber = inProgress.RoomCode ?? "N/A",
                DepartmentName = "Ophthalmology",
                QueueType = "Optometry",
                Timestamp = DateTime.UtcNow,
            };
        }

        return new QueueDisplayData
        {
            CurrentToken = "—",
            NextTokens = nextTokens,
            NextPatients = nextPatients,
            DoctorName = "Waiting",
            RoomNumber = "—",
            DepartmentName = "Ophthalmology",
            QueueType = "Optometry",
            Timestamp = DateTime.UtcNow,
        };
    }

    private static List<QueueDisplayPatientEntry> MapDisplayEntries(IEnumerable<OptometryQueuePatientDto> patients) =>
        patients
            .Take(5)
            .Select(p => new QueueDisplayPatientEntry
            {
                TokenNumber = p.TokenNumber,
                PatientName = p.PatientName,
                Gender = QueueDisplayMapper.FormatGender(p.Gender),
                AgeCategory = QueueDisplayMapper.MapAgeCategory(Math.Max(0, p.Age)),
                Urgency = p.Urgency,
                IsReturnVisit = p.IsReturnVisit,
                PassNumber = p.PassNumber,
                ReasonLabel = p.ReasonLabel,
            })
            .ToList();

    public async Task<List<QueueDisplayRoomSlideDto>> GetRoomSlidesAsync(
        Guid tenantId,
        Guid branchId,
        Guid? departmentId = null)
    {
        var queue = await GetQueueAsync(tenantId, branchId, includeCompletedToday: false);

        if (departmentId.HasValue)
        {
            var deptVisitIds = await _context.Visits
                .Where(v => v.BranchId == branchId && v.DepartmentId == departmentId.Value)
                .Select(v => v.Id)
                .ToListAsync();
            var deptSet = deptVisitIds.ToHashSet();
            queue = queue.Where(p => p.VisitId != Guid.Empty && deptSet.Contains(p.VisitId)).ToList();
        }

        var inProgress = queue.Where(p => p.Status == "In Progress").ToList();
        var waiting = queue
            .Where(p => p.Status == "Waiting")
            .OrderBy(p => UrgencyOrder(p.Urgency))
            .ThenBy(p => p.WaitingSince)
            .ToList();

        if (inProgress.Count == 0 && waiting.Count == 0)
        {
            return new List<QueueDisplayRoomSlideDto>();
        }

        var rooms = await LoadServiceRoomsAsync(tenantId, branchId, OptometristStation);
        if (rooms.Count == 0)
        {
            rooms =
            [
                new ServiceRoomConfigDto { RoomCode = "OPT-1", Label = "Optometry Room 1", TvDisplayLabel = "Optometry Room 1", Station = OptometristStation },
                new ServiceRoomConfigDto { RoomCode = "OPT-2", Label = "Optometry Room 2", TvDisplayLabel = "Optometry Room 2", Station = OptometristStation },
            ];
        }

        var nextPatients = waiting.Take(5).Select(QueueDisplayMapper.MapPatient).ToList();
        var slides = new List<QueueDisplayRoomSlideDto>();
        var roomsWithActivity = new HashSet<string>(StringComparer.OrdinalIgnoreCase);

        foreach (var serving in inProgress)
        {
            var roomCode = serving.RoomCode ?? rooms[0].RoomCode;
            roomsWithActivity.Add(roomCode);
            var room = rooms.FirstOrDefault(r => r.RoomCode.Equals(roomCode, StringComparison.OrdinalIgnoreCase))
                ?? rooms[0];
            slides.Add(BuildRoomSlide(room, serving, nextPatients));
        }

        if (waiting.Count > 0)
        {
            foreach (var room in rooms.Where(r => r.IsActive && !roomsWithActivity.Contains(r.RoomCode)))
            {
                slides.Add(new QueueDisplayRoomSlideDto
                {
                    Station = OptometristStation,
                    StationLabel = "Optometry",
                    StationLabelTe = "ఆప్టోమెట్రీ",
                    RoomCode = room.RoomCode,
                    DisplayLabel = room.TvDisplayLabel ?? room.Label,
                    DisplayLabelTe = room.TvDisplayLabelTe,
                    NowServing = null,
                    NextQueue = nextPatients,
                    StaffName = null,
                });
                break;
            }
        }

        if (slides.Count == 0 && waiting.Count > 0)
        {
            var room = rooms[0];
            slides.Add(new QueueDisplayRoomSlideDto
            {
                Station = OptometristStation,
                StationLabel = "Optometry",
                StationLabelTe = "ఆప్టోమెట్రీ",
                RoomCode = room.RoomCode,
                DisplayLabel = room.TvDisplayLabel ?? room.Label,
                NextQueue = nextPatients,
            });
        }

        return slides;
    }

    private static QueueDisplayRoomSlideDto BuildRoomSlide(
        ServiceRoomConfigDto room,
        OptometryQueuePatientDto serving,
        List<QueueDisplayPatientDto> nextQueue) =>
        new()
        {
            Station = OptometristStation,
            StationLabel = "Optometry",
            StationLabelTe = "ఆప్టోమెట్రీ",
            RoomCode = room.RoomCode,
            DisplayLabel = room.TvDisplayLabel ?? room.Label,
            DisplayLabelTe = room.TvDisplayLabelTe,
            NowServing = QueueDisplayMapper.MapPatient(serving),
            NextQueue = nextQueue,
            StaffName = serving.AssignedOptometrist,
        };

    private async Task<List<ServiceRoomConfigDto>> LoadServiceRoomsAsync(
        Guid tenantId,
        Guid branchId,
        string station)
    {
        var items = await _context.MasterValues
            .Where(m =>
                m.TenantId == tenantId &&
                m.EntityType == "operations.service_room" &&
                m.IsActive &&
                m.DeletedAt == null)
            .OrderBy(m => m.SortOrder)
            .ToListAsync();

        var branchKey = branchId.ToString();
        var result = new List<ServiceRoomConfigDto>();

        foreach (var item in items)
        {
            try
            {
                using var doc = JsonDocument.Parse(string.IsNullOrWhiteSpace(item.Metadata) ? "{}" : item.Metadata);
                var root = doc.RootElement;
                var metaBranch = root.TryGetProperty("branchId", out var b) ? b.GetString() : null;
                var metaStation = root.TryGetProperty("station", out var s) ? s.GetString() : null;
                if (!string.Equals(metaStation, station, StringComparison.OrdinalIgnoreCase)) continue;
                if (!string.IsNullOrEmpty(metaBranch) && !string.Equals(metaBranch, branchKey, StringComparison.OrdinalIgnoreCase)) continue;

                var roomCode = root.TryGetProperty("roomCode", out var rc) ? rc.GetString() : item.Code;
                var tvLabel = root.TryGetProperty("tvDisplayLabel", out var tl) ? tl.GetString() : item.Label;
                var tvLabelTe = root.TryGetProperty("tvDisplayLabelTe", out var tlt) ? tlt.GetString() : null;
                var isActive = !root.TryGetProperty("isActive", out var ia) || ia.GetBoolean();

                result.Add(new ServiceRoomConfigDto
                {
                    Code = item.Code,
                    Label = item.Label,
                    RoomCode = roomCode ?? item.Code,
                    Station = metaStation ?? station,
                    TvDisplayLabel = tvLabel,
                    TvDisplayLabelTe = tvLabelTe,
                    IsActive = isActive,
                });
            }
            catch
            {
                // skip malformed metadata
            }
        }

        return result;
    }

    public async Task<OptometryQueuePatientDto?> CallNextAsync(
        Guid tenantId,
        Guid branchId,
        Guid optometristUserId,
        string roomCode,
        string? optometristName)
    {
        var today = DateTime.UtcNow.Date;

        var candidates = await _context.Visits
            .Include(v => v.Patient)
            .Include(v => v.Appointment)
            .Include(v => v.AssignedToUser)
            .Where(v =>
                v.TenantId == tenantId &&
                v.BranchId == branchId &&
                v.DeletedAt == null &&
                (v.CurrentStation == OptometristStation || v.CurrentStation == "optometry") &&
                v.Status == "with_optometrist" &&
                v.AssignedTo == null &&
                v.CheckedInAt.HasValue &&
                v.CheckedInAt.Value.Date == today)
            .ToListAsync();

        if (candidates.Count == 0)
        {
            return null;
        }

        var next = candidates
            .OrderBy(v => UrgencyOrder(MapUrgency(v)))
            .ThenBy(v => v.CheckedInAt)
            .First();

        // Concurrency: re-check assignment
        var locked = await _context.Visits
            .FirstOrDefaultAsync(v => v.Id == next.Id && v.AssignedTo == null);
        if (locked == null)
        {
            throw new InvalidOperationException("Patient was already assigned to another optometrist");
        }

        var user = await _context.Users.FindAsync(optometristUserId);
        var displayName = optometristName ?? (user != null ? $"{user.FirstName} {user.LastName}".Trim() : "Optometrist");

        locked.AssignedTo = optometristUserId;
        locked.AssignedAt = DateTime.UtcNow;
        locked.ActiveRoomCode = roomCode;
        locked.UpdatedAt = DateTime.UtcNow;

        var queueItem = await EnsureQueueItemAsync(locked, optometristUserId);
        await _queueService.CallPatientAsync(queueItem.Id, roomCode, displayName);

        await RecordStationEventAsync(
            tenantId,
            branchId,
            locked.Id,
            locked.PatientId,
            OptometristStation,
            "started",
            optometristUserId,
            roomCode: roomCode,
            assignedToUserId: optometristUserId,
            queueItemId: queueItem.Id);

        await _context.SaveChangesAsync();

        var events = await _context.VisitStationEvents
            .Where(e => e.VisitId == locked.Id && e.Station == OptometristStation)
            .OrderByDescending(e => e.CreatedAt)
            .ToListAsync();
        var latestQueued = events.FirstOrDefault(e => e.EventType == "queued");
        var draft = await _context.ExaminationDrafts
            .FirstOrDefaultAsync(d =>
                d.PatientId == locked.PatientId &&
                d.VisitId == locked.Id &&
                d.TenantId == tenantId);

        return MapToDto(locked, "In Progress", latestQueued?.PassNumber ?? 1, latestQueued?.ReasonCode, draft, roomCode);
    }

    public async Task<OptometryQueuePatientDto?> StartAsync(Guid visitId, Guid tenantId, Guid optometristUserId, string? roomCode)
    {
        var visit = await _context.Visits
            .Include(v => v.Patient)
            .Include(v => v.Appointment)
            .Include(v => v.AssignedToUser)
            .FirstOrDefaultAsync(v => v.Id == visitId && v.TenantId == tenantId && v.DeletedAt == null);

        if (visit == null || visit.CurrentStation != OptometristStation)
        {
            return null;
        }

        if (visit.AssignedTo.HasValue && visit.AssignedTo != optometristUserId)
        {
            throw new InvalidOperationException("Patient is assigned to another optometrist");
        }

        visit.AssignedTo = optometristUserId;
        visit.AssignedAt = DateTime.UtcNow;
        if (!string.IsNullOrEmpty(roomCode))
        {
            visit.ActiveRoomCode = roomCode;
        }
        visit.UpdatedAt = DateTime.UtcNow;

        await RecordStationEventAsync(
            tenantId,
            visit.BranchId,
            visit.Id,
            visit.PatientId,
            OptometristStation,
            "started",
            optometristUserId,
            roomCode: roomCode,
            assignedToUserId: optometristUserId);

        await _context.SaveChangesAsync();

        await EmitOptometryQueueUpdateAsync(tenantId, visit.BranchId, "started", visitId, visit.TokenNumber);

        var events = await _context.VisitStationEvents
            .Where(e => e.VisitId == visitId && e.Station == OptometristStation)
            .OrderByDescending(e => e.CreatedAt)
            .ToListAsync();
        var latestQueued = events.FirstOrDefault(e => e.EventType == "queued");
        var draft = await _context.ExaminationDrafts
            .FirstOrDefaultAsync(d =>
                d.PatientId == visit.PatientId &&
                d.VisitId == visit.Id &&
                d.TenantId == tenantId);

        return MapToDto(visit, "In Progress", latestQueued?.PassNumber ?? 1, latestQueued?.ReasonCode, draft, roomCode);
    }

    public async Task<OptometryQueuePatientDto?> CompleteAsync(
        Guid visitId,
        Guid tenantId,
        Guid userId,
        OptometryCompleteRequestDto? request = null)
    {
        var visit = await _context.Visits
            .Include(v => v.Patient)
            .Include(v => v.Appointment)
            .Include(v => v.AssignedToUser)
            .FirstOrDefaultAsync(v => v.Id == visitId && v.TenantId == tenantId && v.DeletedAt == null);

        if (visit == null)
        {
            return null;
        }

        visit.AssignedTo = null;
        visit.AssignedAt = null;
        visit.ActiveRoomCode = null;
        visit.UpdatedAt = DateTime.UtcNow;

        await RecordStationEventAsync(
            tenantId,
            visit.BranchId,
            visit.Id,
            visit.PatientId,
            OptometristStation,
            "completed",
            userId,
            reasonCode: request?.ReasonCode,
            reasonNotes: request?.Notes);

        if (!string.IsNullOrEmpty(request?.NextStation))
        {
            visit.CurrentStation = request.NextStation;
            visit.Status = MapStationToStatus(request.NextStation);
            visit.UpdatedAt = DateTime.UtcNow;
        }

        var activeQueueItem = await _context.QueueItems
            .FirstOrDefaultAsync(q =>
                q.VisitId == visitId &&
                q.QueueType == "Optometry" &&
                q.Status != "completed");
        if (activeQueueItem != null)
        {
            activeQueueItem.Status = "completed";
            activeQueueItem.UpdatedAt = DateTime.UtcNow;
        }

        await _context.SaveChangesAsync();
        await EmitOptometryQueueUpdateAsync(tenantId, visit.BranchId, "completed", visit.Id, visit.TokenNumber);

        var events = await _context.VisitStationEvents
            .Where(e => e.VisitId == visitId && e.Station == OptometristStation)
            .OrderByDescending(e => e.CreatedAt)
            .ToListAsync();
        var latestQueued = events.FirstOrDefault(e => e.EventType == "queued");
        var draft = await _context.ExaminationDrafts
            .FirstOrDefaultAsync(d =>
                d.PatientId == visit.PatientId &&
                d.VisitId == visit.Id &&
                d.TenantId == tenantId);

        var stillAtOpto = visit.CurrentStation == OptometristStation;
        var status = stillAtOpto ? "Completed" : "Completed";
        return MapToDto(visit, status, latestQueued?.PassNumber ?? 1, latestQueued?.ReasonCode, draft, null);
    }

    public async Task<OptometryQueuePatientDto?> SkipAsync(Guid visitId, Guid tenantId, Guid userId, string reason)
    {
        var visit = await _context.Visits
            .Include(v => v.Patient)
            .Include(v => v.Appointment)
            .Include(v => v.AssignedToUser)
            .FirstOrDefaultAsync(v => v.Id == visitId && v.TenantId == tenantId && v.DeletedAt == null);

        if (visit == null)
        {
            return null;
        }

        visit.AssignedTo = null;
        visit.AssignedAt = null;
        visit.ActiveRoomCode = null;
        visit.UpdatedAt = DateTime.UtcNow;

        await RecordStationEventAsync(
            tenantId,
            visit.BranchId,
            visit.Id,
            visit.PatientId,
            OptometristStation,
            "skipped",
            userId,
            reasonNotes: reason);

        await _context.SaveChangesAsync();
        await EmitOptometryQueueUpdateAsync(tenantId, visit.BranchId, "skipped", visit.Id, visit.TokenNumber);

        var events = await _context.VisitStationEvents
            .Where(e => e.VisitId == visitId && e.Station == OptometristStation)
            .OrderByDescending(e => e.CreatedAt)
            .ToListAsync();
        var latestQueued = events.FirstOrDefault(e => e.EventType == "queued");

        return MapToDto(visit, "Skipped", latestQueued?.PassNumber ?? 1, latestQueued?.ReasonCode, null, null);
    }

    public async Task<OptometryQueuePatientDto?> ReferAsync(Guid visitId, Guid tenantId, Guid userId, string reason)
    {
        var visit = await _context.Visits
            .Include(v => v.Patient)
            .Include(v => v.Appointment)
            .Include(v => v.AssignedToUser)
            .FirstOrDefaultAsync(v => v.Id == visitId && v.TenantId == tenantId && v.DeletedAt == null);

        if (visit == null)
        {
            return null;
        }

        visit.AssignedTo = null;
        visit.AssignedAt = null;
        visit.ActiveRoomCode = null;
        visit.UpdatedAt = DateTime.UtcNow;

        await RecordStationEventAsync(
            tenantId,
            visit.BranchId,
            visit.Id,
            visit.PatientId,
            OptometristStation,
            "referred",
            userId,
            reasonNotes: reason);

        await _context.SaveChangesAsync();
        await EmitOptometryQueueUpdateAsync(tenantId, visit.BranchId, "referred", visit.Id, visit.TokenNumber);

        var events = await _context.VisitStationEvents
            .Where(e => e.VisitId == visitId && e.Station == OptometristStation)
            .OrderByDescending(e => e.CreatedAt)
            .ToListAsync();
        var latestQueued = events.FirstOrDefault(e => e.EventType == "queued");

        return MapToDto(visit, "Referred", latestQueued?.PassNumber ?? 1, latestQueued?.ReasonCode, null, null);
    }

    public async Task<List<VisitJourneyEventDto>> GetJourneyAsync(Guid visitId, Guid tenantId)
    {
        return await _context.VisitStationEvents
            .Include(e => e.AssignedToUser)
            .Where(e => e.VisitId == visitId && e.TenantId == tenantId)
            .OrderBy(e => e.CreatedAt)
            .Select(e => new VisitJourneyEventDto
            {
                Id = e.Id,
                Station = e.Station,
                EventType = e.EventType,
                PassNumber = e.PassNumber,
                ReasonCode = e.ReasonCode,
                ReasonNotes = e.ReasonNotes,
                RoomCode = e.RoomCode,
                AssignedToName = e.AssignedToUser != null
                    ? (e.AssignedToUser.FirstName + " " + e.AssignedToUser.LastName).Trim()
                    : null,
                CreatedAt = e.CreatedAt,
            })
            .ToListAsync();
    }

    public async Task RecordStationEventAsync(
        Guid tenantId,
        Guid branchId,
        Guid visitId,
        Guid patientId,
        string station,
        string eventType,
        Guid? userId,
        string? reasonCode = null,
        string? reasonNotes = null,
        string? roomCode = null,
        Guid? assignedToUserId = null,
        Guid? queueItemId = null)
    {
        var passNumber = eventType == "queued"
            ? await GetNextPassNumberAsync(visitId, station)
            : await GetCurrentPassNumberAsync(visitId, station);

        var evt = new VisitStationEvent
        {
            Id = Guid.NewGuid(),
            TenantId = tenantId,
            BranchId = branchId,
            VisitId = visitId,
            PatientId = patientId,
            Station = station,
            EventType = eventType,
            PassNumber = passNumber,
            ReasonCode = reasonCode,
            ReasonNotes = reasonNotes,
            AssignedToUserId = assignedToUserId,
            RoomCode = roomCode,
            QueueItemId = queueItemId,
            CreatedAt = DateTime.UtcNow,
            CreatedByUserId = userId,
        };

        _context.VisitStationEvents.Add(evt);

        if (station == OptometristStation && eventType == "queued")
        {
            var visit = await _context.Visits.FindAsync(visitId);
            if (visit != null)
            {
                visit.OptometryPassCount = passNumber;
            }

            await _context.SaveChangesAsync();
            await EmitOptometryQueueUpdateAsync(tenantId, branchId, "queued", visitId, visit?.TokenNumber);
            return;
        }

        await _context.SaveChangesAsync();
    }

    public async Task<int> GetNextPassNumberAsync(Guid visitId, string station)
    {
        var max = await _context.VisitStationEvents
            .Where(e => e.VisitId == visitId && e.Station == station && e.EventType == "queued")
            .Select(e => (int?)e.PassNumber)
            .MaxAsync();
        return (max ?? 0) + 1;
    }

    private async Task<int> GetCurrentPassNumberAsync(Guid visitId, string station)
    {
        var latest = await _context.VisitStationEvents
            .Where(e => e.VisitId == visitId && e.Station == station)
            .OrderByDescending(e => e.CreatedAt)
            .Select(e => e.PassNumber)
            .FirstOrDefaultAsync();
        return latest > 0 ? latest : 1;
    }

    private async Task<QueueItem> EnsureQueueItemAsync(Visit visit, Guid userId)
    {
        var existing = await _context.QueueItems
            .FirstOrDefaultAsync(q =>
                q.VisitId == visit.Id &&
                q.QueueType == "Optometry" &&
                q.Status != "completed");

        if (existing != null)
        {
            existing.Status = "waiting";
            existing.UpdatedAt = DateTime.UtcNow;
            return existing;
        }

        var priority = visit.IsEmergency ? "emergency" :
            visit.Appointment?.Priority?.ToLower() is "urgent" or "high" ? "urgent" : "normal";

        var item = new QueueItem
        {
            Id = Guid.NewGuid(),
            TenantId = visit.TenantId,
            BranchId = visit.BranchId,
            DepartmentId = visit.DepartmentId,
            PatientId = visit.PatientId,
            AppointmentId = visit.AppointmentId,
            VisitId = visit.Id,
            TokenNumber = visit.TokenNumber,
            QueueType = "Optometry",
            Status = "waiting",
            Priority = priority,
            CheckedInAt = visit.CheckedInAt ?? DateTime.UtcNow,
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow,
            CreatedByUserId = userId,
        };

        _context.QueueItems.Add(item);
        await _context.SaveChangesAsync();
        return item;
    }

    private static string MapQueueStatus(Visit visit, List<VisitStationEvent> events)
    {
        if (events.Any(e => e.EventType == "referred"))
        {
            return "Referred";
        }
        if (events.Any(e => e.EventType == "skipped") && visit.AssignedTo == null)
        {
            var last = events.First();
            if (last.EventType == "skipped") return "Skipped";
        }
        if (visit.AssignedTo.HasValue)
        {
            return "In Progress";
        }
        if (events.Any(e => e.EventType == "completed"))
        {
            var last = events.First();
            if (last.EventType == "completed" &&
                (visit.CurrentStation == OptometristStation || visit.CurrentStation == "optometry"))
            {
                return "Completed";
            }
        }
        return "Waiting";
    }

    private OptometryQueuePatientDto MapToDto(
        Visit visit,
        string status,
        int passNumber,
        string? reasonCode,
        ExaminationDraft? draft,
        string? roomCode)
    {
        var patient = visit.Patient;
        var appointment = visit.Appointment;
        var urgency = MapUrgency(visit);
        var redFlags = DetectRedFlags(visit, urgency);

        var dto = new OptometryQueuePatientDto
        {
            Id = visit.Id.ToString(),
            VisitId = visit.Id,
            PatientId = visit.PatientId,
            PatientName = patient != null ? $"{patient.FirstName} {patient.LastName}".Trim() : "Unknown",
            Mrn = patient?.MedicalRecordNumber ?? "",
            Age = patient?.DateOfBirth != null
                ? (int)((DateTime.UtcNow - patient.DateOfBirth).TotalDays / 365.25)
                : 0,
            Gender = patient?.Gender ?? "",
            TokenNumber = visit.TokenNumber,
            AppointmentTime = appointment?.StartTime != null
                ? DateTime.Today.Add(appointment.StartTime.Value).ToString("hh:mm tt")
                : visit.CheckedInAt?.ToString("hh:mm tt") ?? "",
            ChiefComplaint = visit.Notes ?? appointment?.ReasonForVisit ?? appointment?.Notes ?? "General consultation",
            Source = MapSource(visit.VisitType),
            Status = status,
            Urgency = urgency,
            AssignedOptometrist = visit.AssignedToUser != null
                ? $"{visit.AssignedToUser.FirstName} {visit.AssignedToUser.LastName}".Trim()
                : null,
            AssignedToUserId = visit.AssignedTo,
            WaitingSince = visit.AssignedAt ?? visit.CheckedInAt,
            HasRedFlags = redFlags.Count > 0,
            RedFlags = redFlags,
            PassNumber = passNumber,
            ReasonCode = reasonCode,
            ReasonLabel = reasonCode != null && ReasonLabels.TryGetValue(reasonCode, out var label) ? label : reasonCode,
            IsReturnVisit = passNumber > 1,
            RoomCode = roomCode ?? visit.ActiveRoomCode,
        };

        ApplyDraftSummary(dto, draft);
        return dto;
    }

    private static void ApplyDraftSummary(OptometryQueuePatientDto dto, ExaminationDraft? draft)
    {
        if (draft == null || string.IsNullOrWhiteSpace(draft.Data))
        {
            return;
        }

        try
        {
            using var doc = JsonDocument.Parse(draft.Data);
            var root = doc.RootElement;
            var completed = new List<string>();

            if (TryGetNestedString(root, "visualAcuityData", "distanceOD", out var vaOd))
            {
                dto.VisualAcuityOD = vaOd;
                completed.Add("Visual Acuity");
            }
            if (TryGetNestedString(root, "visualAcuityData", "distanceOS", out var vaOs))
            {
                dto.VisualAcuityOS = vaOs;
            }
            if (TryGetNestedNumber(root, "tonometryData", "iopOD", out var iopOd))
            {
                dto.IopOD = iopOd;
                completed.Add("Tonometry");
            }
            if (TryGetNestedNumber(root, "tonometryData", "iopOS", out var iopOs))
            {
                dto.IopOS = iopOs;
            }
            if (root.TryGetProperty("refractionData", out _) || root.TryGetProperty("retinoscopyData", out _))
            {
                dto.RefractionCompleted = true;
                completed.Add("Refraction");
            }

            dto.CompletedExams = completed;
        }
        catch
        {
            // ignore malformed draft JSON
        }
    }

    private static bool TryGetNestedString(JsonElement root, string obj, string prop, out string value)
    {
        value = "";
        if (root.TryGetProperty(obj, out var o) && o.TryGetProperty(prop, out var p))
        {
            value = p.GetString() ?? "";
            return !string.IsNullOrEmpty(value);
        }
        return false;
    }

    private static bool TryGetNestedNumber(JsonElement root, string obj, string prop, out int value)
    {
        value = 0;
        if (root.TryGetProperty(obj, out var o) && o.TryGetProperty(prop, out var p) && p.TryGetInt32(out value))
        {
            return true;
        }
        return false;
    }

    private static List<string> DetectRedFlags(Visit visit, string urgency)
    {
        var flags = new List<string>();
        var complaint = (visit.Notes ?? visit.Appointment?.ReasonForVisit ?? "").ToLowerInvariant();

        if (urgency == "Emergency")
        {
            flags.Add("Emergency presentation");
        }
        if (complaint.Contains("sudden") && complaint.Contains("vision"))
        {
            flags.Add("Sudden vision loss");
        }
        if (complaint.Contains("floater"))
        {
            flags.Add("Floaters");
        }
        if (complaint.Contains("pain") && complaint.Contains("headache"))
        {
            flags.Add("Eye pain with headache");
        }
        if (complaint.Contains("halo"))
        {
            flags.Add("Halos — acute glaucoma suspect");
        }

        return flags;
    }

    private static string MapUrgency(Visit visit)
    {
        if (visit.IsEmergency) return "Emergency";
        var p = visit.Appointment?.Priority?.ToLowerInvariant();
        return p switch
        {
            "urgent" or "high" => "Urgent",
            "emergency" => "Emergency",
            _ => "Routine",
        };
    }

    private static string MapSource(string visitType) =>
        visitType.ToLowerInvariant() switch
        {
            "follow_up" or "follow-up" => "Follow-up",
            "post_op" or "post-op" => "Post-Op",
            "review" => "Walk-in",
            _ => "OPD",
        };

    private static int StatusOrder(string status) => status switch
    {
        "In Progress" => 0,
        "Waiting" => 1,
        "Completed" => 2,
        "Referred" => 3,
        "Skipped" => 4,
        _ => 5,
    };

    private static int UrgencyOrder(string urgency) => urgency switch
    {
        "Emergency" => 0,
        "Urgent" => 1,
        _ => 2,
    };

    private async Task EmitOptometryQueueUpdateAsync(
        Guid tenantId,
        Guid branchId,
        string action,
        Guid? visitId = null,
        string? tokenNumber = null)
    {
        try
        {
            var branchGroup = $"Branch-{tenantId}-{branchId}";
            await _hubContext.Clients.Group(branchGroup).SendAsync("QueueUpdate", new
            {
                QueueType = "Optometry",
                Action = action,
                VisitId = visitId,
                TokenNumber = tokenNumber,
                Timestamp = DateTime.UtcNow,
            });

            await _hubContext.Clients.Group(branchGroup).SendAsync("QueueDisplayUpdated", new
            {
                BranchId = branchId,
                Timestamp = DateTime.UtcNow,
            });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to emit optometry queue update for branch {BranchId}", branchId);
        }
    }

    private static string MapStationToStatus(string station) => station.ToLowerInvariant() switch
    {
        "optometrist" => "with_optometrist",
        "doctor" => "with_doctor",
        "counselor" or "counsellor" => "with_counselor",
        "imaging" => "at_imaging",
        "billing" => "at_billing",
        "pharmacy" => "at_pharmacy",
        "optical" => "at_optical",
        "reception" => "checked_in",
        "completed" => "completed",
        _ => "in_progress",
    };

    public async Task<List<OptometryPatientSearchRowDto>> SearchPatientsAsync(
        Guid tenantId,
        Guid branchId,
        string query,
        int limit = 20)
    {
        var needle = (query ?? string.Empty).Trim().ToLowerInvariant();
        if (needle.Length < 3)
        {
            return new List<OptometryPatientSearchRowDto>();
        }

        limit = Math.Clamp(limit, 1, 50);

        return await _context.Patients
            .AsNoTracking()
            .Where(p => p.TenantId == tenantId && p.DeletedAt == null)
            .Where(p => p.BranchId == null || p.BranchId == branchId)
            .Where(p =>
                (p.FirstName + " " + p.LastName).ToLower().Contains(needle) ||
                (p.MedicalRecordNumber ?? "").ToLower().Contains(needle) ||
                (p.HealthId ?? "").ToLower().Contains(needle) ||
                (p.ContactNumber ?? "").ToLower().Contains(needle))
            .OrderBy(p => p.FirstName)
            .ThenBy(p => p.LastName)
            .Take(limit)
            .Select(p => new OptometryPatientSearchRowDto
            {
                Id = p.Id,
                PatientName = (p.FirstName + " " + p.LastName).Trim(),
                Mrn = p.MedicalRecordNumber ?? "",
                Phone = p.ContactNumber,
                Gender = p.Gender,
                DateOfBirth = p.DateOfBirth,
            })
            .ToListAsync();
    }

    public async Task EnsureQueueItemForVisitAsync(Guid visitId, Guid tenantId, Guid userId)
    {
        var visit = await _context.Visits
            .FirstOrDefaultAsync(v => v.Id == visitId && v.TenantId == tenantId && v.DeletedAt == null);

        if (visit == null)
        {
            return;
        }

        await EnsureQueueItemAsync(visit, userId);
    }
}
