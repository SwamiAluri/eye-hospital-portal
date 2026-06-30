using System.Text.Json;

namespace AuthService.Services;

/// <summary>
/// Extracts ophthalmology vitals (VA, IOP) from examination draft JSON.
/// </summary>
public static class PatientOphthalmologyVitalsParser
{
    public sealed class EyeVitals
    {
        public string? VisualAcuityOd { get; init; }
        public string? VisualAcuityOs { get; init; }
        public decimal? IopOd { get; init; }
        public decimal? IopOs { get; init; }
    }

    public static EyeVitals? ParseFromDraftJson(string? json)
    {
        if (string.IsNullOrWhiteSpace(json)) return null;

        try
        {
            using var doc = JsonDocument.Parse(json);
            var root = doc.RootElement;

            string? vaOd = null;
            string? vaOs = null;
            decimal? iopOd = null;
            decimal? iopOs = null;

            if (TryGetNestedString(root, "visualAcuityData", "distanceOD", out var od))
                vaOd = od;
            if (TryGetNestedString(root, "visualAcuityData", "distanceOS", out var os))
                vaOs = os;
            if (TryGetNestedNumber(root, "tonometryData", "iopOD", out var iopOdVal))
                iopOd = iopOdVal;
            if (TryGetNestedNumber(root, "tonometryData", "iopOS", out var iopOsVal))
                iopOs = iopOsVal;

            if (vaOd == null && vaOs == null && iopOd == null && iopOs == null)
                return null;

            return new EyeVitals
            {
                VisualAcuityOd = vaOd,
                VisualAcuityOs = vaOs,
                IopOd = iopOd,
                IopOs = iopOs,
            };
        }
        catch
        {
            return null;
        }
    }

    private static bool TryGetNestedString(JsonElement root, string obj, string prop, out string value)
    {
        value = "";
        if (!root.TryGetProperty(obj, out var nested) || nested.ValueKind != JsonValueKind.Object)
            return false;
        if (!nested.TryGetProperty(prop, out var el))
            return false;
        value = el.ValueKind == JsonValueKind.String ? el.GetString() ?? "" : el.ToString();
        return !string.IsNullOrWhiteSpace(value);
    }

    private static bool TryGetNestedNumber(JsonElement root, string obj, string prop, out decimal value)
    {
        value = 0;
        if (!root.TryGetProperty(obj, out var nested) || nested.ValueKind != JsonValueKind.Object)
            return false;
        if (!nested.TryGetProperty(prop, out var el))
            return false;
        if (el.ValueKind == JsonValueKind.Number && el.TryGetDecimal(out var d))
        {
            value = d;
            return true;
        }
        return decimal.TryParse(el.ToString(), out value);
    }
}
