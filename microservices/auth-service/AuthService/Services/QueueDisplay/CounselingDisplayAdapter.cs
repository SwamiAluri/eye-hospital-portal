using AuthService.Context;
using AuthService.DTOs.Queue;
using AuthService.Services.Interfaces;
using AuthService.Services.QueueDisplay;
using Microsoft.EntityFrameworkCore;

namespace AuthService.Services.QueueDisplay;

public class CounselingDisplayAdapter : ICounselingDisplayAdapter
{
    private const string CounselorStation = "counselor";
    private static readonly string[] ActiveStatuses = ["Waiting", "Called", "InProgress"];

    private readonly AppDbContext _context;

    public CounselingDisplayAdapter(AppDbContext context)
    {
        _context = context;
    }

    public async Task<List<QueueDisplayRoomSlideDto>> GetRoomSlidesAsync(Guid tenantId, Guid branchId)
    {
        var rawItems = await (
            from q in _context.CounselorQueue
            join s in _context.CounselingSession on q.SessionId equals s.Id
            join p in _context.Patients on q.PatientId equals p.Id
            join c in _context.Users on s.CounselorId equals c.Id into counselorJoin
            from c in counselorJoin.DefaultIfEmpty()
            where q.TenantId == tenantId
                  && q.BranchId == branchId
                  && q.DeletedAt == null
                  && ActiveStatuses.Contains(q.Status)
            orderby q.QueuePosition
            select new CounselingQueueRow
            {
                TokenNumber = q.TokenNumber,
                QueuePosition = q.QueuePosition,
                Status = q.Status,
                UrgencyLevel = q.UrgencyLevel,
                AddedToQueueAt = q.AddedToQueueAt,
                CalledAt = q.CalledAt,
                StartedAt = q.StartedAt,
                PriorityScore = q.PriorityScore,
                PatientId = q.PatientId,
                PatientFirstName = p.FirstName,
                PatientLastName = p.LastName,
                HealthId = p.HealthId,
                MedicalRecordNumber = p.MedicalRecordNumber,
                DateOfBirth = p.DateOfBirth,
                Gender = p.Gender,
                SessionCategory = s.SessionCategory,
                RecommendedSurgery = s.RecommendedSurgery,
                CounselorFirstName = c != null ? c.FirstName : null,
                CounselorLastName = c != null ? c.LastName : null,
            }
        ).ToListAsync();

        if (rawItems.Count == 0)
        {
            return [];
        }

        var serving = rawItems
            .Where(i => i.Status is "InProgress" or "Called")
            .OrderByDescending(i => i.StartedAt ?? i.CalledAt ?? i.AddedToQueueAt)
            .FirstOrDefault();

        var waiting = rawItems
            .Where(i => i.Status == "Waiting")
            .OrderByDescending(i => i.PriorityScore)
            .ThenBy(i => i.QueuePosition)
            .Take(5)
            .Select(MapPatient)
            .ToList();

        if (serving == null && waiting.Count == 0)
        {
            return [];
        }

        var rooms = await QueueDisplayRoomLoader.LoadRoomsAsync(_context, tenantId, branchId, CounselorStation);
        if (rooms.Count == 0)
        {
            rooms =
            [
                new ServiceRoomConfigDto
                {
                    RoomCode = "COUN-1",
                    Label = "Counseling Room 1",
                    TvDisplayLabel = "Counseling Room 1",
                    TvDisplayLabelTe = "సలహా గది 1",
                    Station = CounselorStation,
                },
            ];
        }

        var room = rooms.First(r => r.IsActive);
        var counselorName = serving != null ? FormatCounselorName(serving.CounselorFirstName, serving.CounselorLastName) : null;

        return
        [
            new QueueDisplayRoomSlideDto
            {
                Station = CounselorStation,
                StationLabel = "Counseling",
                StationLabelTe = "సలహా డెస్క్",
                RoomCode = room.RoomCode,
                DisplayLabel = room.TvDisplayLabel ?? room.Label,
                DisplayLabelTe = room.TvDisplayLabelTe ?? "సలహా గది",
                NowServing = serving != null ? MapPatient(serving) : null,
                NextQueue = waiting,
                StaffName = counselorName,
            },
        ];
    }

    private static QueueDisplayPatientDto MapPatient(CounselingQueueRow row)
    {
        var sessionType = !string.IsNullOrWhiteSpace(row.SessionCategory)
            ? row.SessionCategory
            : string.IsNullOrWhiteSpace(row.RecommendedSurgery) ? "Procedure" : "Surgery";

        return new QueueDisplayPatientDto
        {
            PatientId = row.PatientId,
            TokenNumber = ResolveDisplayToken(row),
            PatientName = $"{row.PatientFirstName} {row.PatientLastName}".Trim(),
            Gender = QueueDisplayMapper.FormatGender(row.Gender),
            AgeCategory = QueueDisplayMapper.MapAgeCategoryFromDateOfBirth(row.DateOfBirth),
            Urgency = MapUrgency(row.UrgencyLevel),
            ReasonLabel = sessionType,
        };
    }

    private static string ResolveDisplayToken(CounselingQueueRow row)
    {
        if (!string.IsNullOrWhiteSpace(row.TokenNumber))
        {
            return row.TokenNumber.Trim();
        }

        var id = !string.IsNullOrWhiteSpace(row.HealthId) ? row.HealthId : row.MedicalRecordNumber;
        if (!string.IsNullOrWhiteSpace(id) && id.Length >= 4)
        {
            return id[^4..].ToUpperInvariant();
        }

        return $"C{row.QueuePosition:D3}";
    }

    private static string MapUrgency(string? urgencyLevel) => urgencyLevel switch
    {
        "Critical" => "Emergency",
        "High" => "Urgent",
        _ => "Routine",
    };

    private static string FormatCounselorName(string? firstName, string? lastName)
    {
        var name = $"{firstName} {lastName}".Trim();
        return string.IsNullOrWhiteSpace(name) ? string.Empty : name;
    }

    private sealed class CounselingQueueRow
    {
        public string TokenNumber { get; init; } = string.Empty;
        public int QueuePosition { get; init; }
        public string Status { get; init; } = string.Empty;
        public string? UrgencyLevel { get; init; }
        public DateTime AddedToQueueAt { get; init; }
        public DateTime? CalledAt { get; init; }
        public DateTime? StartedAt { get; init; }
        public decimal PriorityScore { get; init; }
        public Guid PatientId { get; init; }
        public string PatientFirstName { get; init; } = string.Empty;
        public string PatientLastName { get; init; } = string.Empty;
        public string? HealthId { get; init; }
        public string? MedicalRecordNumber { get; init; }
        public DateTime DateOfBirth { get; init; }
        public string? Gender { get; init; }
        public string? SessionCategory { get; init; }
        public string? RecommendedSurgery { get; init; }
        public string? CounselorFirstName { get; init; }
        public string? CounselorLastName { get; init; }
    }
}
