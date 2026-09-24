using System.Globalization;
using System.Text.Json;
using System.Text.Json.Serialization;

namespace AuthService.Services;

/// <summary>
/// W-01 / FR-1.1 — OPD clinical fields onto OT schedule and IP journey.
/// Incoming blanks never overwrite; refresh is explicit.
/// </summary>
public static class OpdClinicalCopy
{
    public static string? FirstNonEmpty(params string?[] values)
    {
        foreach (var value in values)
        {
            if (!string.IsNullOrWhiteSpace(value))
                return value.Trim();
        }
        return null;
    }

    public static bool ShouldWrite(string? existing, string? incoming, bool forceRefresh)
    {
        if (string.IsNullOrWhiteSpace(incoming)) return false;
        if (forceRefresh) return true;
        return string.IsNullOrWhiteSpace(existing);
    }

    public static string? MapEyeToJourney(string? eye)
    {
        var e = (eye ?? string.Empty).Trim().ToUpperInvariant();
        return e switch
        {
            "RE" or "OD" or "RIGHT" or "R" => "OD",
            "LE" or "OS" or "LEFT" or "L" => "OS",
            "BE" or "OU" or "BOTH" or "BOTH_EYES" => "OU",
            "" => null,
            _ => e,
        };
    }

    public static string? MapEyeToBiometry(string? eye)
    {
        var mapped = MapEyeToJourney(eye);
        return mapped is "OD" or "OS" ? mapped : null;
    }

    public static string EyePhrase(string? eye)
    {
        var mapped = MapEyeToJourney(eye);
        return mapped switch
        {
            "OS" => "left eye",
            "OU" => "both eyes",
            _ => "right eye",
        };
    }

    public static string FormatIol(decimal value)
    {
        var rounded = Math.Round(value, 2, MidpointRounding.AwayFromZero);
        return rounded >= 0m
            ? $"+{rounded.ToString("0.00", CultureInfo.InvariantCulture)} D"
            : $"{rounded.ToString("0.00", CultureInfo.InvariantCulture)} D";
    }

    public static string? IolFromBiometry(decimal? calculatedIol, string? iolCalculationsJson)
    {
        if (calculatedIol.HasValue)
            return FormatIol(calculatedIol.Value);

        if (string.IsNullOrWhiteSpace(iolCalculationsJson))
            return null;

        try
        {
            using var doc = JsonDocument.Parse(iolCalculationsJson);
            if (doc.RootElement.ValueKind != JsonValueKind.Array)
                return null;
            foreach (var el in doc.RootElement.EnumerateArray())
            {
                if (el.TryGetProperty("iolPower", out var p) && p.TryGetDecimal(out var power))
                    return FormatIol(power);
                if (el.TryGetProperty("IolPower", out var p2) && p2.TryGetDecimal(out var power2))
                    return FormatIol(power2);
            }
        }
        catch (JsonException)
        {
            return null;
        }

        return null;
    }

    /// <summary>
    /// First fill: session, then biometry. Refresh: biometry, then session.
    /// Never invent a value from empty sources.
    /// </summary>
    public static string? ResolveIol(
        string? existing,
        string? sessionIol,
        string? biometryIol,
        bool preferBiometry)
    {
        if (preferBiometry)
            return FirstNonEmpty(biometryIol, sessionIol, existing);
        return FirstNonEmpty(existing, sessionIol, biometryIol);
    }

    private static readonly JsonSerializerOptions DiagnosisJsonOptions = new()
    {
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
        DefaultIgnoreCondition = JsonIgnoreCondition.WhenWritingNull,
    };

    /// <summary>
    /// FR-1.1 diagnosis snapshot. Structured MPI diagnoses win; else counselling
    /// clinical_summary.diagnosis; else latest exam string. Never uses recommended surgery.
    /// </summary>
    public static OpdDiagnosisSnapshot ResolveDiagnosis(
        IReadOnlyList<OpdDiagnosisLine>? patientDiagnoses,
        string? clinicalSummaryJson,
        string? examDiagnosis,
        string? recommendedSurgery = null)
    {
        _ = recommendedSurgery;
        var structured = Normalize(patientDiagnoses);
        if (structured.Count > 0)
            return FromLines(structured);

        var fromSummary = DiagnosisFromClinicalSummary(clinicalSummaryJson);
        if (!string.IsNullOrWhiteSpace(fromSummary))
            return FromFreeText(fromSummary);

        if (!string.IsNullOrWhiteSpace(examDiagnosis))
            return FromFreeText(examDiagnosis.Trim());

        return new OpdDiagnosisSnapshot();
    }

    public static OpdDiagnosisLine FromPatientDiagnosis(
        string? icd10, string? description, string? laterality, string? diagnosisType)
    {
        var type = string.IsNullOrWhiteSpace(diagnosisType) ? null : diagnosisType.Trim();
        return new OpdDiagnosisLine
        {
            Icd10 = string.IsNullOrWhiteSpace(icd10) ? null : icd10.Trim(),
            Description = (description ?? string.Empty).Trim(),
            Laterality = string.IsNullOrWhiteSpace(laterality) ? null : laterality.Trim(),
            DiagnosisType = type,
            IsPrimary = string.Equals(type, "primary", StringComparison.OrdinalIgnoreCase),
        };
    }

    private static List<OpdDiagnosisLine> Normalize(IReadOnlyList<OpdDiagnosisLine>? source)
    {
        var list = new List<OpdDiagnosisLine>();
        if (source is null) return list;

        foreach (var raw in source)
        {
            var line = FromPatientDiagnosis(raw.Icd10, raw.Description, raw.Laterality, raw.DiagnosisType);
            if (raw.IsPrimary) line.IsPrimary = true;
            if (string.IsNullOrWhiteSpace(line.Icd10) && string.IsNullOrWhiteSpace(line.Description))
                continue;
            if (string.IsNullOrWhiteSpace(line.Description) && !string.IsNullOrWhiteSpace(line.Icd10))
                line.Description = line.Icd10;
            list.Add(line);
        }

        if (list.Count == 0) return list;
        if (!list.Exists(l => l.IsPrimary))
            list[0].IsPrimary = true;
        return list.OrderBy(l => l.IsPrimary ? 0 : 1).ToList();
    }

    private static OpdDiagnosisSnapshot FromLines(IReadOnlyList<OpdDiagnosisLine> lines)
    {
        if (lines.Count == 0) return new OpdDiagnosisSnapshot();
        return new OpdDiagnosisSnapshot
        {
            Summary = FormatSummary(lines),
            Json = JsonSerializer.Serialize(lines, DiagnosisJsonOptions),
        };
    }

    private static OpdDiagnosisSnapshot FromFreeText(string text)
    {
        var line = new OpdDiagnosisLine { Description = text, IsPrimary = true };
        return FromLines(new[] { line });
    }

    private static string FormatSummary(IReadOnlyList<OpdDiagnosisLine> lines)
    {
        return string.Join("; ", lines.Select(l =>
        {
            var lat = string.IsNullOrWhiteSpace(l.Laterality) ? "" : $" ({l.Laterality.Trim()})";
            var code = string.IsNullOrWhiteSpace(l.Icd10) ? "" : $"{l.Icd10.Trim()} — ";
            var desc = string.IsNullOrWhiteSpace(l.Description) ? (l.Icd10 ?? "") : l.Description.Trim();
            return $"{code}{desc}{lat}";
        }));
    }

    private static string? DiagnosisFromClinicalSummary(string? json)
    {
        if (string.IsNullOrWhiteSpace(json)) return null;
        try
        {
            using var doc = JsonDocument.Parse(json);
            if (doc.RootElement.ValueKind != JsonValueKind.Object) return null;
            if (doc.RootElement.TryGetProperty("diagnosis", out var d)
                && d.ValueKind == JsonValueKind.String)
            {
                var text = d.GetString();
                return string.IsNullOrWhiteSpace(text) ? null : text.Trim();
            }
            if (doc.RootElement.TryGetProperty("Diagnosis", out var d2)
                && d2.ValueKind == JsonValueKind.String)
            {
                var text = d2.GetString();
                return string.IsNullOrWhiteSpace(text) ? null : text.Trim();
            }
        }
        catch (JsonException)
        {
            return null;
        }

        return null;
    }
}

public sealed class OpdDiagnosisLine
{
    public string? Icd10 { get; set; }
    public string Description { get; set; } = "";
    public string? Laterality { get; set; }
    public string? DiagnosisType { get; set; }
    public bool IsPrimary { get; set; }
}

public sealed class OpdDiagnosisSnapshot
{
    public string? Summary { get; set; }
    public string? Json { get; set; }
}

public class OpdClinicalSnapshotDto
{
    public string? ProcedureName { get; set; }
    public string? EyeOperated { get; set; }
    public string? IolPower { get; set; }
    public bool BiometryMissing { get; set; }
    public string? EyePhrase { get; set; }
    public string? Diagnosis { get; set; }
    public string? DiagnosisJson { get; set; }
    /// <summary>Phase 3I Slice 7 — set after refresh-from-opd mutates CounselingSession (bumped Version).</summary>
    public int? Version { get; set; }
}
