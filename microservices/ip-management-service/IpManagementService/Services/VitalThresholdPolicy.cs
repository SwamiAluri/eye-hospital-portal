using System.Globalization;
using IpManagementService.Models.Domain;
using IpManagementService.Models.Dtos;

namespace IpManagementService.Services;

/// <summary>
/// Latest bedside vital vs tenant thresholds (W-06 A4). Always a Mark Ready warning.
/// Ward capture labels temperature as °F; values above 45 are converted to °C before compare.
/// </summary>
public static class VitalThresholdPolicy
{
    public const string NotRecorded = "not_recorded";
    public const string OutOfRange = "out_of_range";
    public const string Ok = "ok";

    public sealed record Finding(string Measure, string Direction, string Detail);

    public sealed record Result(string Status, IReadOnlyList<Finding> Findings);

    public static Result Evaluate(VitalSign? latest, IpVitalThreshold threshold)
    {
        if (latest is null)
            return new Result(NotRecorded, []);

        var findings = new List<Finding>();
        var sys = latest.BloodPressureSystolic;
        var dia = latest.BloodPressureDiastolic;
        if (sys is int s && s > threshold.SystolicMax)
            findings.Add(new Finding("Blood pressure", "high",
                $"{s}/{dia?.ToString(CultureInfo.InvariantCulture) ?? "—"} mmHg (usual limit {threshold.SystolicMax}/{threshold.DiastolicMax})"));
        else if (dia is int d && d > threshold.DiastolicMax)
            findings.Add(new Finding("Blood pressure", "high",
                $"{sys?.ToString(CultureInfo.InvariantCulture) ?? "—"}/{d} mmHg (usual limit {threshold.SystolicMax}/{threshold.DiastolicMax})"));

        if (latest.PulseRate is int pulse)
        {
            if (pulse > threshold.PulseMax)
                findings.Add(new Finding("Pulse", "high", $"{pulse} / min (usual {threshold.PulseMin}–{threshold.PulseMax})"));
            else if (pulse < threshold.PulseMin)
                findings.Add(new Finding("Pulse", "low", $"{pulse} / min (usual {threshold.PulseMin}–{threshold.PulseMax})"));
        }

        if (latest.OxygenSaturation is decimal spo2 && spo2 < threshold.Spo2Min)
            findings.Add(new Finding("SpO2", "low",
                $"{spo2.ToString("0.##", CultureInfo.InvariantCulture)}% (usual at least {threshold.Spo2Min.ToString("0.##", CultureInfo.InvariantCulture)}%)"));

        if (latest.Temperature is decimal rawTemp)
        {
            var celsius = ToCelsius(rawTemp);
            if (celsius > threshold.TempMaxC)
                findings.Add(new Finding("Temperature", "high",
                    $"{celsius.ToString("0.0", CultureInfo.InvariantCulture)} °C (usual limit {threshold.TempMaxC.ToString("0.0", CultureInfo.InvariantCulture)} °C)"));
        }

        var gatedPresent = sys is not null || dia is not null || latest.PulseRate is not null
            || latest.OxygenSaturation is not null || latest.Temperature is not null;
        if (!gatedPresent)
            return new Result(NotRecorded, []);

        return findings.Count == 0
            ? new Result(Ok, [])
            : new Result(OutOfRange, findings);
    }

    public static void AddMarkReadyWarning(List<ChecklistGateWarningDto> warnings, Result result)
    {
        if (result.Status == Ok) return;

        if (result.Status == NotRecorded)
        {
            warnings.Add(new ChecklistGateWarningDto(
                "vitals_not_recorded",
                "No bedside vitals on this visit. Add an observation. This does not stop Mark Ready.",
                "warn",
                false));
            return;
        }

        var parts = result.Findings
            .Select(f => $"{f.Measure} is {f.Direction} ({f.Detail})")
            .ToList();
        var lead = string.Join(". ", parts) + ".";
        warnings.Add(new ChecklistGateWarningDto(
            "vitals_out_of_range",
            $"{lead} Tell the surgeon. This is a warning — you can still mark ready for OT.",
            "warn",
            false));
    }

    /// <summary>Ward form stores °F (placeholder 98.6). Values ≤ 45 are treated as already °C.</summary>
    public static decimal ToCelsius(decimal stored)
    {
        if (stored > 45m)
            return Math.Round((stored - 32m) * 5m / 9m, 1, MidpointRounding.AwayFromZero);
        return Math.Round(stored, 1, MidpointRounding.AwayFromZero);
    }
}
