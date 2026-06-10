using AuthService.Context;
using AuthService.DTOs.Queue;
using AuthService.Models.Domain;
using AuthService.Services.Interfaces;
using AuthService.Services.QueueDisplay;
using Microsoft.EntityFrameworkCore;

namespace AuthService.Services.QueueDisplay;

public class VisitStationDisplayAdapter : IVisitStationDisplayAdapter
{
    private readonly AppDbContext _context;

    public VisitStationDisplayAdapter(AppDbContext context)
    {
        _context = context;
    }

    public Task<List<QueueDisplayRoomSlideDto>> GetDoctorSlidesAsync(Guid tenantId, Guid branchId) =>
        BuildDoctorSlidesAsync(tenantId, branchId);

    public Task<List<QueueDisplayRoomSlideDto>> GetImagingSlidesAsync(Guid tenantId, Guid branchId) =>
        BuildVisitStationSlidesAsync(
            tenantId,
            branchId,
            station: "imaging",
            stationLabel: "Imaging",
            stationLabelTe: "ఇమేజింగ్",
            fallbackRoomCode: "IMG-1",
            fallbackLabel: "Imaging Room 1",
            fallbackLabelTe: "ఇమేజింగ్ గది 1");

    public Task<List<QueueDisplayRoomSlideDto>> GetBillingRegistrationSlidesAsync(Guid tenantId, Guid branchId) =>
        BuildBillingRegistrationSlidesAsync(tenantId, branchId);

    private async Task<List<QueueDisplayRoomSlideDto>> BuildDoctorSlidesAsync(Guid tenantId, Guid branchId)
    {
        var today = DateTime.UtcNow.Date;
        var patients = new List<StationPatientRow>();

        var visits = await LoadVisitRowsAsync(tenantId, branchId, "doctor", today);
        patients.AddRange(visits);

        var queueItems = await _context.QueueItems
            .Include(q => q.Patient)
            .Include(q => q.Appointment)
            .Where(q =>
                q.TenantId == tenantId &&
                q.BranchId == branchId &&
                q.QueueType == "Doctor" &&
                q.CheckedInAt.Date == today &&
                (q.Status == "waiting" || q.Status == "called" || q.Status == "in_consultation" || q.Status == "in-progress"))
            .ToListAsync();

        foreach (var item in queueItems)
        {
            if (item.VisitId.HasValue && patients.Any(p => p.VisitId == item.VisitId.Value))
            {
                continue;
            }

            patients.Add(MapQueueItemRow(item));
        }

        return await BuildSlidesFromPatientsAsync(
            tenantId,
            branchId,
            station: "doctor",
            stationLabel: "Doctor",
            stationLabelTe: "డాక్టర్",
            fallbackRoomCode: "DOC-1",
            fallbackLabel: "Doctor Room 1",
            fallbackLabelTe: "డాక్టర్ గది 1",
            patients);
    }

    private async Task<List<QueueDisplayRoomSlideDto>> BuildBillingRegistrationSlidesAsync(Guid tenantId, Guid branchId)
    {
        var today = DateTime.UtcNow.Date;
        var billingVisits = await LoadVisitRowsAsync(tenantId, branchId, "billing", today);
        var receptionVisits = await LoadVisitRowsAsync(tenantId, branchId, "reception", today);

        var patients = billingVisits.Concat(receptionVisits).ToList();
        if (patients.Count == 0)
        {
            return [];
        }

        var rooms = await QueueDisplayRoomLoader.LoadRoomsAsync(_context, tenantId, branchId, "billing");
        if (rooms.Count == 0)
        {
            rooms =
            [
                new ServiceRoomConfigDto
                {
                    RoomCode = "BILL-1",
                    Label = "Billing Counter 1",
                    TvDisplayLabel = "Billing & Registration",
                    TvDisplayLabelTe = "బిల్లింగ్ & రిజిస్ట్రేషన్",
                    Station = "billing",
                },
            ];
        }

        var room = rooms.First(r => r.IsActive);
        return
        [
            BuildCombinedSlide(
                station: "billing",
                stationLabel: "Billing & Registration",
                stationLabelTe: "బిల్లింగ్ & రిజిస్ట్రేషన్",
                room,
                patients),
        ];
    }

    private async Task<List<QueueDisplayRoomSlideDto>> BuildVisitStationSlidesAsync(
        Guid tenantId,
        Guid branchId,
        string station,
        string stationLabel,
        string stationLabelTe,
        string fallbackRoomCode,
        string fallbackLabel,
        string fallbackLabelTe)
    {
        var today = DateTime.UtcNow.Date;
        var patients = await LoadVisitRowsAsync(tenantId, branchId, station, today);

        return await BuildSlidesFromPatientsAsync(
            tenantId,
            branchId,
            station,
            stationLabel,
            stationLabelTe,
            fallbackRoomCode,
            fallbackLabel,
            fallbackLabelTe,
            patients);
    }

    private async Task<List<StationPatientRow>> LoadVisitRowsAsync(
        Guid tenantId,
        Guid branchId,
        string station,
        DateTime today)
    {
        var visits = await _context.Visits
            .Include(v => v.Patient)
            .Include(v => v.Appointment)
            .Include(v => v.AssignedToUser)
            .Include(v => v.Consultant)
            .Where(v =>
                v.TenantId == tenantId &&
                v.BranchId == branchId &&
                v.DeletedAt == null &&
                v.CurrentStation == station &&
                v.CheckedInAt.HasValue &&
                v.CheckedInAt.Value.Date == today &&
                v.Status != "completed" &&
                v.Status != "cancelled")
            .ToListAsync();

        return visits.Select(MapVisitRow).ToList();
    }

    private async Task<List<QueueDisplayRoomSlideDto>> BuildSlidesFromPatientsAsync(
        Guid tenantId,
        Guid branchId,
        string station,
        string stationLabel,
        string stationLabelTe,
        string fallbackRoomCode,
        string fallbackLabel,
        string fallbackLabelTe,
        List<StationPatientRow> patients)
    {
        if (patients.Count == 0)
        {
            return [];
        }

        var inProgress = patients.Where(p => p.IsServing).ToList();
        var waiting = patients
            .Where(p => !p.IsServing)
            .OrderBy(p => UrgencyOrder(p.Urgency))
            .ThenBy(p => p.WaitingSince)
            .Take(5)
            .Select(MapPatient)
            .ToList();

        if (inProgress.Count == 0 && waiting.Count == 0)
        {
            return [];
        }

        var rooms = await QueueDisplayRoomLoader.LoadRoomsAsync(_context, tenantId, branchId, station);
        if (rooms.Count == 0)
        {
            rooms =
            [
                new ServiceRoomConfigDto
                {
                    RoomCode = fallbackRoomCode,
                    Label = fallbackLabel,
                    TvDisplayLabel = fallbackLabel,
                    TvDisplayLabelTe = fallbackLabelTe,
                    Station = station,
                },
            ];
        }

        var slides = new List<QueueDisplayRoomSlideDto>();
        var roomsWithActivity = new HashSet<string>(StringComparer.OrdinalIgnoreCase);

        foreach (var serving in inProgress)
        {
            var roomCode = serving.RoomCode ?? rooms[0].RoomCode;
            roomsWithActivity.Add(roomCode);
            var room = rooms.FirstOrDefault(r => r.RoomCode.Equals(roomCode, StringComparison.OrdinalIgnoreCase)) ?? rooms[0];
            slides.Add(BuildRoomSlide(station, stationLabel, stationLabelTe, room, serving, waiting));
        }

        if (waiting.Count > 0)
        {
            foreach (var room in rooms.Where(r => r.IsActive && !roomsWithActivity.Contains(r.RoomCode)))
            {
                slides.Add(new QueueDisplayRoomSlideDto
                {
                    Station = station,
                    StationLabel = stationLabel,
                    StationLabelTe = stationLabelTe,
                    RoomCode = room.RoomCode,
                    DisplayLabel = room.TvDisplayLabel ?? room.Label,
                    DisplayLabelTe = room.TvDisplayLabelTe,
                    NextQueue = waiting,
                });
                break;
            }
        }

        if (slides.Count == 0 && waiting.Count > 0)
        {
            var room = rooms[0];
            slides.Add(new QueueDisplayRoomSlideDto
            {
                Station = station,
                StationLabel = stationLabel,
                StationLabelTe = stationLabelTe,
                RoomCode = room.RoomCode,
                DisplayLabel = room.TvDisplayLabel ?? room.Label,
                DisplayLabelTe = room.TvDisplayLabelTe,
                NextQueue = waiting,
            });
        }

        return slides;
    }

    private static QueueDisplayRoomSlideDto BuildCombinedSlide(
        string station,
        string stationLabel,
        string stationLabelTe,
        ServiceRoomConfigDto room,
        List<StationPatientRow> patients)
    {
        var serving = patients
            .Where(p => p.IsServing)
            .OrderByDescending(p => p.WaitingSince)
            .FirstOrDefault();

        var waiting = patients
            .Where(p => !p.IsServing)
            .OrderBy(p => UrgencyOrder(p.Urgency))
            .ThenBy(p => p.WaitingSince)
            .Take(5)
            .Select(MapPatient)
            .ToList();

        return new QueueDisplayRoomSlideDto
        {
            Station = station,
            StationLabel = stationLabel,
            StationLabelTe = stationLabelTe,
            RoomCode = room.RoomCode,
            DisplayLabel = room.TvDisplayLabel ?? room.Label,
            DisplayLabelTe = room.TvDisplayLabelTe,
            NowServing = serving != null ? MapPatient(serving) : null,
            NextQueue = waiting,
            StaffName = serving?.StaffName,
        };
    }

    private static QueueDisplayRoomSlideDto BuildRoomSlide(
        string station,
        string stationLabel,
        string stationLabelTe,
        ServiceRoomConfigDto room,
        StationPatientRow serving,
        List<QueueDisplayPatientDto> nextQueue) =>
        new()
        {
            Station = station,
            StationLabel = stationLabel,
            StationLabelTe = stationLabelTe,
            RoomCode = room.RoomCode,
            DisplayLabel = room.TvDisplayLabel ?? room.Label,
            DisplayLabelTe = room.TvDisplayLabelTe,
            NowServing = MapPatient(serving),
            NextQueue = nextQueue,
            StaffName = serving.StaffName,
        };

    private static StationPatientRow MapVisitRow(Visit visit)
    {
        var assigned = visit.AssignedTo.HasValue;
        var staff = visit.AssignedToUser != null
            ? $"{visit.AssignedToUser.FirstName} {visit.AssignedToUser.LastName}".Trim()
            : visit.Consultant != null
                ? $"{visit.Consultant.FirstName} {visit.Consultant.LastName}".Trim()
                : null;

        return new StationPatientRow
        {
            VisitId = visit.Id,
            PatientId = visit.PatientId,
            TokenNumber = visit.TokenNumber,
            PatientFirstName = visit.Patient?.FirstName ?? string.Empty,
            PatientLastName = visit.Patient?.LastName ?? string.Empty,
            Gender = visit.Patient?.Gender,
            DateOfBirth = visit.Patient?.DateOfBirth,
            Urgency = MapVisitUrgency(visit),
            IsServing = assigned,
            RoomCode = visit.ActiveRoomCode,
            StaffName = staff,
            WaitingSince = visit.CheckedInAt ?? visit.CreatedAt,
        };
    }

    private static StationPatientRow MapQueueItemRow(QueueItem item) =>
        new()
        {
            VisitId = item.VisitId,
            PatientId = item.PatientId,
            TokenNumber = item.TokenNumber,
            PatientFirstName = item.Patient?.FirstName ?? string.Empty,
            PatientLastName = item.Patient?.LastName ?? string.Empty,
            Gender = item.Patient?.Gender,
            DateOfBirth = item.Patient?.DateOfBirth,
            Urgency = MapQueuePriority(item.Priority),
            IsServing = item.Status is "called" or "in_consultation" or "in-progress",
            RoomCode = item.RoomNumber,
            StaffName = item.DoctorName,
            WaitingSince = item.CheckedInAt,
        };

    private static QueueDisplayPatientDto MapPatient(StationPatientRow row) =>
        new()
        {
            VisitId = row.VisitId,
            PatientId = row.PatientId,
            TokenNumber = row.TokenNumber,
            PatientName = $"{row.PatientFirstName} {row.PatientLastName}".Trim(),
            Gender = QueueDisplayMapper.FormatGender(row.Gender),
            AgeCategory = QueueDisplayMapper.MapAgeCategoryFromDateOfBirth(row.DateOfBirth),
            Urgency = row.Urgency,
        };

    private static string MapVisitUrgency(Visit visit)
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

    private static string MapQueuePriority(string? priority) => priority?.ToLowerInvariant() switch
    {
        "emergency" => "Emergency",
        "urgent" => "Urgent",
        _ => "Routine",
    };

    private static int UrgencyOrder(string urgency) => urgency switch
    {
        "Emergency" => 0,
        "Urgent" => 1,
        _ => 2,
    };

    private sealed class StationPatientRow
    {
        public Guid? VisitId { get; init; }
        public Guid? PatientId { get; init; }
        public string TokenNumber { get; init; } = string.Empty;
        public string PatientFirstName { get; init; } = string.Empty;
        public string PatientLastName { get; init; } = string.Empty;
        public string? Gender { get; init; }
        public DateTime? DateOfBirth { get; init; }
        public string Urgency { get; init; } = "Routine";
        public bool IsServing { get; init; }
        public string? RoomCode { get; init; }
        public string? StaffName { get; init; }
        public DateTime WaitingSince { get; init; }
    }
}
