using AuthService.DTOs.Queue;
using AuthService.DTOs.Visit;
using AuthService.Services.Interfaces;

namespace AuthService.Services;

public static class QueueDisplayMapper
{
    public static string MapAgeCategory(int age)
    {
        if (age <= 1) return "Baby";
        if (age <= 12) return "Child";
        if (age <= 17) return "Teen";
        if (age >= 60) return "Senior Citizen";
        return "Adult";
    }

    public static string MapAgeCategoryFromDateOfBirth(DateTime? dateOfBirth)
    {
        if (!dateOfBirth.HasValue) return "Adult";
        var age = (int)((DateTime.UtcNow - dateOfBirth.Value).TotalDays / 365.25);
        return MapAgeCategory(Math.Max(0, age));
    }

    public static string FormatGender(string? gender)
    {
        if (string.IsNullOrWhiteSpace(gender)) return "—";
        var normalized = gender.Trim().ToLowerInvariant();
        return normalized switch
        {
            "m" or "male" => "Male",
            "f" or "female" => "Female",
            "o" or "other" => "Other",
            _ => char.ToUpper(gender[0]) + gender[1..].ToLowerInvariant(),
        };
    }

    public static string ProceedLabelTe(string displayLabel) =>
        $"దయచేసి {displayLabel} గదికి వెళ్లండి";

    public static QueueDisplayPatientDto MapPatient(OptometryQueuePatientDto patient) => new()
    {
        VisitId = patient.VisitId,
        PatientId = patient.PatientId,
        TokenNumber = patient.TokenNumber,
        PatientName = patient.PatientName,
        Gender = QueueDisplayMapper.FormatGender(patient.Gender),
        AgeCategory = MapAgeCategory(Math.Max(0, patient.Age)),
        Urgency = patient.Urgency,
        IsReturnVisit = patient.IsReturnVisit,
        PassNumber = patient.PassNumber,
        ReasonLabel = patient.ReasonLabel,
    };

    public static QueueDisplayPatientDto MapPatientEntry(QueueDisplayPatientEntry entry) => new()
    {
        VisitId = entry.VisitId,
        PatientId = entry.PatientId,
        TokenNumber = entry.TokenNumber,
        PatientName = entry.PatientName,
        Gender = FormatGender(entry.Gender),
        AgeCategory = string.IsNullOrWhiteSpace(entry.AgeCategory) ? "Adult" : entry.AgeCategory,
        Urgency = entry.Urgency,
        IsReturnVisit = entry.IsReturnVisit,
        PassNumber = entry.PassNumber,
        ReasonLabel = entry.ReasonLabel,
    };

    public static List<QueueDisplayTickerMessageDto> DefaultTickerMessages() =>
    [
        new() { En = "Please keep your token with you and listen for your name.", Te = "దయచేసి మీ టోకెన్‌ను దగ్గర ఉంచుకోండి." },
        new() { En = "Kindly maintain silence in the waiting area.", Te = "దయచేసి వేచి ఉండే ప్రాంతంలో నిశ్శబ్దం పాటించండి." },
        new() { En = "When your token appears, please proceed to the indicated room.", Te = "మీ టోకెన్ వచ్చినప్పుడు సూచించిన గదికి వెళ్లండి." },
    ];

    public static QueueDisplayData ToLegacyDisplayData(QueueDisplayRoomSlideDto slide, string queueType)
    {
        var serving = slide.NowServing;
        var next = slide.NextQueue ?? [];

        return new QueueDisplayData
        {
            CurrentToken = serving?.TokenNumber ?? "—",
            CurrentPatientName = serving?.PatientName,
            CurrentGender = serving?.Gender,
            CurrentAgeCategory = serving?.AgeCategory,
            CurrentUrgency = serving?.Urgency,
            CurrentIsReturnVisit = serving?.IsReturnVisit ?? false,
            CurrentPassNumber = serving?.PassNumber ?? 1,
            CurrentReasonLabel = serving?.ReasonLabel,
            NextTokens = next.Select(p => p.TokenNumber).Where(t => !string.IsNullOrWhiteSpace(t)).ToList(),
            NextPatients = next.Select(MapPatientEntryFromDto).ToList(),
            DoctorName = slide.StaffName ?? slide.StationLabel,
            RoomNumber = slide.RoomCode,
            DepartmentName = slide.StationLabel,
            QueueType = queueType,
            Timestamp = DateTime.UtcNow,
        };
    }

    private static QueueDisplayPatientEntry MapPatientEntryFromDto(QueueDisplayPatientDto patient) => new()
    {
        VisitId = patient.VisitId,
        PatientId = patient.PatientId,
        TokenNumber = patient.TokenNumber,
        PatientName = patient.PatientName,
        Gender = patient.Gender,
        AgeCategory = patient.AgeCategory,
        Urgency = patient.Urgency,
        IsReturnVisit = patient.IsReturnVisit,
        PassNumber = patient.PassNumber,
        ReasonLabel = patient.ReasonLabel,
    };
}
