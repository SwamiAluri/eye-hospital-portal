using System.Text.Json;

namespace IpManagementService.Services;

/// <summary>Parses pre_op_section_items.item_config JSONB for ward investigations.</summary>
public static class InvestigationItemConfigHelper
{
    private static readonly HashSet<string> DefaultCriticalKeys =
        new(StringComparer.OrdinalIgnoreCase)
        {
            "serum_creatinine", "blood_urea", "hiv_done", "hemoglobin",
            "ecg_done", "hba1c_done", "hbsag_done", "hcv_done",
        };

    public static bool IsCritical(string? itemConfigJson, string itemKey)
    {
        if (TryGetBool(itemConfigJson, "isCritical", out var critical))
            return critical;
        return DefaultCriticalKeys.Contains(itemKey);
    }

    public static string? GetDefaultUnit(string? itemConfigJson)
        => TryGetString(itemConfigJson, "defaultUnit", out var unit) ? unit : null;

    public static string GetValueType(string? itemConfigJson)
        => TryGetString(itemConfigJson, "valueType", out var vt) ? vt! : "text";

    public static bool RequiresReport(string? itemConfigJson)
        => TryGetBool(itemConfigJson, "requiresReport", out var req) && req;

    private static bool TryGetBool(string? json, string prop, out bool value)
    {
        value = false;
        if (string.IsNullOrWhiteSpace(json)) return false;
        try
        {
            using var doc = JsonDocument.Parse(json);
            if (doc.RootElement.TryGetProperty(prop, out var el)
                && el.ValueKind == JsonValueKind.True)
            {
                value = true;
                return true;
            }
            if (doc.RootElement.TryGetProperty(prop, out el)
                && el.ValueKind == JsonValueKind.False)
            {
                value = false;
                return true;
            }
        }
        catch (JsonException) { /* ignore malformed config */ }
        return false;
    }

    public static string? GetWardTargetKey(string? itemConfigJson, string fallbackItemKey)
    {
        if (TryGetString(itemConfigJson, "wardTargetKey", out var key) && !string.IsNullOrWhiteSpace(key))
            return key;
        return fallbackItemKey;
    }

    private static bool TryGetString(string? json, string prop, out string? value)
    {
        value = null;
        if (string.IsNullOrWhiteSpace(json)) return false;
        try
        {
            using var doc = JsonDocument.Parse(json);
            if (doc.RootElement.TryGetProperty(prop, out var el)
                && el.ValueKind == JsonValueKind.String)
            {
                value = el.GetString();
                return true;
            }
        }
        catch (JsonException) { /* ignore */ }
        return false;
    }
}
