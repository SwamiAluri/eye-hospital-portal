using IpManagementService.Models.Domain;
using IpManagementService.Models.Dtos;

namespace IpManagementService.Services;

/// <summary>
/// Derived dilation timer (W-06 A3). First administered dilatation drop + 25 minutes.
/// Never a Mark Ready hard block.
/// </summary>
public static class DilationReadiness
{
    public const int ReadyMinutes = 25;
    public const string NotRecorded = "not_recorded";
    public const string NotReady = "not_ready";
    public const string Ready = "ready";

    public sealed record Slice(
        DateTime? StartedAt,
        DateTime? ReadyAt,
        int? RemainingSeconds,
        string Status,
        string? MedicineName);

    public static Slice From(IEnumerable<PreOpMedicationLog> logs, DateTime utcNow)
    {
        var first = logs
            .Where(m => m.DeletedAt == null
                        && m.AdministeredAt != null
                        && WardChecklistAutoSyncService.IsDilatationMedicine(m.MedicineName))
            .OrderBy(m => m.AdministeredAt)
            .FirstOrDefault();

        if (first?.AdministeredAt is null)
            return new Slice(null, null, null, NotRecorded, null);

        var started = AsUtc(first.AdministeredAt.Value);
        var readyAt = started.AddMinutes(ReadyMinutes);
        var remaining = (int)Math.Ceiling((readyAt - utcNow).TotalSeconds);
        if (remaining > 0)
            return new Slice(started, readyAt, remaining, NotReady, first.MedicineName);

        return new Slice(started, readyAt, 0, Ready, first.MedicineName);
    }

    public static DilationSliceDto ToDto(Slice slice) => new(
        slice.StartedAt,
        slice.ReadyAt,
        slice.RemainingSeconds,
        slice.Status,
        slice.MedicineName);

    public static void AddMarkReadyWarning(List<ChecklistGateWarningDto> warnings, Slice slice)
    {
        if (slice.Status == Ready) return;

        if (slice.Status == NotRecorded)
        {
            warnings.Add(new ChecklistGateWarningDto(
                "dilation_not_recorded",
                "No dilating drop is recorded. You can still mark ready. Open Drops & fasting to record Tropicamide.",
                "warn",
                false));
            return;
        }

        var remaining = FormatMmSs(slice.RemainingSeconds ?? 0);
        var given = slice.StartedAt is DateTime at
            ? $" {slice.MedicineName ?? "Drops"} was given at {at.ToString("HH:mm")} UTC."
            : "";
        warnings.Add(new ChecklistGateWarningDto(
            "dilation_not_ready",
            $"Dilation is not ready yet ({remaining} remaining).{given} This is a warning — you can still mark ready for OT.",
            "warn",
            false));
    }

    public static string FormatMmSs(int remainingSeconds)
    {
        var sec = Math.Max(0, remainingSeconds);
        return $"{sec / 60:00}:{sec % 60:00}";
    }

    private static DateTime AsUtc(DateTime value)
        => value.Kind == DateTimeKind.Utc ? value : DateTime.SpecifyKind(value, DateTimeKind.Utc);
}
