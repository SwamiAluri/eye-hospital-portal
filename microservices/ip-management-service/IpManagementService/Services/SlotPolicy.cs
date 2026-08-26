using IpManagementService.Models.Domain;

namespace IpManagementService.Services;

/// <summary>IP-013. Session windows, staggered arrival, and SentToOT reassignment rules.</summary>
public static class SlotPolicy
{
    public const int StaggerMinutes = 30;
    public const int PreArrivalMinutes = 15;
    public const int ResequenceOffset = 10_000;

    public static readonly TimeOnly MorningStart = new(7, 30);
    public static readonly TimeOnly AfternoonStart = new(13, 30);
    public static readonly TimeOnly EveningStart = new(17, 30);

    public static TimeZoneInfo HospitalTimeZone { get; } = ResolveIndia();

    public static bool IsPastSentToOt(PatientJourney j)
    {
        if (j.SentToOtAt != null) return true;
        return j.ClinicalState is ClinicalState.SentToOT
            or ClinicalState.InOT
            or ClinicalState.SurgeryCompleted
            or ClinicalState.PostOp
            or ClinicalState.ReadyForDischarge
            or ClinicalState.Discharged;
    }

    public static string NormalizeSession(string? session)
    {
        if (string.IsNullOrWhiteSpace(session) || !SlotSession.All.Contains(session.Trim()))
            throw new ArgumentException("Session must be Morning, Afternoon, or Evening.");
        return session.Trim();
    }

    public static string FormatLabel(string session, int sequenceNo)
    {
        var prefix = session switch
        {
            SlotSession.Morning => "AM",
            SlotSession.Afternoon => "PM",
            SlotSession.Evening => "EV",
            _ => session,
        };
        return $"{prefix}-{sequenceNo}";
    }

    public static DateTime DefaultPlannedArrivalUtc(DateOnly slotDate, string session, int sequenceNo)
    {
        var start = session switch
        {
            SlotSession.Afternoon => AfternoonStart,
            SlotSession.Evening => EveningStart,
            _ => MorningStart,
        };
        var local = slotDate.ToDateTime(start)
            .AddMinutes((sequenceNo - 1) * StaggerMinutes - PreArrivalMinutes);
        return TimeZoneInfo.ConvertTimeToUtc(DateTime.SpecifyKind(local, DateTimeKind.Unspecified), HospitalTimeZone);
    }

    private static TimeZoneInfo ResolveIndia()
    {
        foreach (var id in new[] { "India Standard Time", "Asia/Kolkata" })
        {
            try { return TimeZoneInfo.FindSystemTimeZoneById(id); }
            catch (TimeZoneNotFoundException) { }
            catch (InvalidTimeZoneException) { }
        }

        return TimeZoneInfo.CreateCustomTimeZone("IST", TimeSpan.FromHours(5.5), "IST", "IST");
    }
}
