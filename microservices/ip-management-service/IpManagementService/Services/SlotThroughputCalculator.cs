using IpManagementService.Models.Domain;
using IpManagementService.Models.Dtos;

namespace IpManagementService.Services;

/// <summary>
/// RPT-080. Period slot throughput from journey_slot history + PatientJourney timestamps.
/// Same arrival→discharge and turnover windows as the one-day board metrics.
/// </summary>
public static class SlotThroughputCalculator
{
    public const double MaxArrivalToDischargeMinutes = 24 * 60;
    public const double MaxTurnoverMinutes = 180;
    public const int MaxInclusiveDays = 93;

    public static SlotThroughputDto Compute(
        IReadOnlyList<SlotThroughputFact> facts,
        DateOnly from,
        DateOnly to)
    {
        var selected = facts
            .GroupBy(f => (f.JourneyId, f.SlotDate))
            .Select(g => g
                .OrderBy(x => x.ReleasedAt.HasValue)
                .ThenByDescending(x => x.CreatedAt)
                .First())
            .ToList();

        var active = selected.Where(f => f.ReleasedAt == null).ToList();
        var dischargeMins = selected
            .Where(f => f.DischargedAt != null)
            .Select(f => (f.DischargedAt!.Value - f.PlannedArrivalAt).TotalMinutes)
            .Where(m => m >= 0 && m < MaxArrivalToDischargeMinutes)
            .ToList();

        var turnover = new List<double>();
        foreach (var group in active.GroupBy(f => (f.TheatreId, f.Session, f.SlotDate)))
        {
            var ended = group
                .OrderBy(f => f.SequenceNo)
                .Select(f => f.SurgeryEndedAt)
                .Where(t => t != null)
                .Select(t => t!.Value)
                .ToList();
            for (var i = 1; i < ended.Count; i++)
            {
                var gap = (ended[i] - ended[i - 1]).TotalMinutes;
                if (gap >= 0 && gap < MaxTurnoverMinutes)
                    turnover.Add(gap);
            }
        }

        static SlotThroughputBreakdownDto Rollup(
            string key, string label, IReadOnlyList<SlotThroughputFact> rows)
        {
            var mins = rows
                .Where(f => f.DischargedAt != null)
                .Select(f => (f.DischargedAt!.Value - f.PlannedArrivalAt).TotalMinutes)
                .Where(m => m >= 0 && m < MaxArrivalToDischargeMinutes)
                .ToList();
            return new SlotThroughputBreakdownDto(
                key,
                label,
                rows.Count,
                rows.Count(f => f.SurgeryEndedAt != null),
                rows.Count(f => f.DischargedAt != null),
                Avg(mins));
        }

        var sessionOrder = new[] { SlotSession.Morning, SlotSession.Afternoon, SlotSession.Evening };
        var bySession = sessionOrder
            .Select(s => Rollup(s, s, selected.Where(f => f.Session == s).ToList()))
            .Where(b => b.AssignedCount > 0)
            .Concat(selected
                .Select(f => f.Session)
                .Where(s => !sessionOrder.Contains(s))
                .Distinct()
                .Select(s => Rollup(s, s, selected.Where(f => f.Session == s).ToList())))
            .ToList();

        var byTheatre = selected
            .GroupBy(f => f.TheatreId)
            .Select(g => Rollup(
                g.Key.ToString("D"),
                string.IsNullOrWhiteSpace(g.First().TheatreName) ? "Theatre" : g.First().TheatreName!,
                g.ToList()))
            .OrderByDescending(b => b.AssignedCount)
            .ThenBy(b => b.Label, StringComparer.OrdinalIgnoreCase)
            .ToList();

        var byDay = selected
            .GroupBy(f => f.SlotDate)
            .OrderBy(g => g.Key)
            .Select(g => Rollup(g.Key.ToString("yyyy-MM-dd"), g.Key.ToString("dd MMM"), g.ToList()))
            .ToList();

        return new SlotThroughputDto(
            from,
            to,
            selected.Count,
            active.Count,
            selected.Count(f => f.ReleasedAt != null),
            selected.Count(f => f.ClinicalState == ClinicalState.ReadyForSurgery),
            selected.Count(f => f.SurgeryEndedAt != null),
            selected.Count(f => f.DischargedAt != null),
            Avg(dischargeMins),
            Median(dischargeMins),
            Avg(turnover),
            bySession,
            byTheatre,
            byDay);
    }

    private static double? Avg(List<double> values)
        => values.Count == 0 ? null : Math.Round(values.Average(), 1);

    private static double? Median(List<double> values)
    {
        if (values.Count == 0) return null;
        var sorted = values.OrderBy(v => v).ToList();
        var mid = sorted.Count / 2;
        var raw = sorted.Count % 2 == 1
            ? sorted[mid]
            : (sorted[mid - 1] + sorted[mid]) / 2.0;
        return Math.Round(raw, 1);
    }
}

public sealed record SlotThroughputFact(
    Guid SlotId,
    Guid JourneyId,
    Guid TheatreId,
    string? TheatreName,
    DateOnly SlotDate,
    string Session,
    int SequenceNo,
    DateTime PlannedArrivalAt,
    DateTime CreatedAt,
    DateTime? ReleasedAt,
    DateTime? SurgeryEndedAt,
    DateTime? DischargedAt,
    string? ClinicalState);
