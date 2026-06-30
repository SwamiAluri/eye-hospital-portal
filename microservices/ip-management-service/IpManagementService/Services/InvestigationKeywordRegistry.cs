namespace IpManagementService.Services;

/// <summary>Maps ward investigation item_key values to LIS / imaging webhook keywords (Form 1 P1).</summary>
public static class InvestigationKeywordRegistry
{
    public static readonly IReadOnlyDictionary<string, string[]> LisItemKeywords =
        new Dictionary<string, string[]>(StringComparer.OrdinalIgnoreCase)
        {
            ["blood_sugar"]       = ["fbs", "rbs", "blood sugar", "glucose", "random blood", "fasting blood"],
            ["hiv_done"]          = ["hiv", "hiv 1", "hiv 2", "hiv serology"],
            ["blood_urea"]        = ["urea", "bun", "blood urea"],
            ["serum_creatinine"]  = ["creatinine", "s.creatinine", "serum creatinine"],
            ["hba1c_done"]        = ["hba1c", "a1c", "glycated"],
            ["hemoglobin"]        = ["hemoglobin", "hb", "hgb"],
            ["pt_inr"]            = ["pt", "inr", "prothrombin"],
            ["hbsag_done"]        = ["hbsag", "hepatitis b", "hbs ag"],
            ["hcv_done"]          = ["hcv", "hepatitis c", "anti hcv"],
        };

    public static readonly IReadOnlyDictionary<string, string[]> ImagingItemKeywords =
        new Dictionary<string, string[]>(StringComparer.OrdinalIgnoreCase)
        {
            ["ascan_done"]      = ["a-scan", "ascan", "biometry", "axial length", "iol master"],
            ["bscan_done"]      = ["b-scan", "bscan", "ultrasound", "b scan"],
            ["xray_ga_cases"]   = ["x-ray", "xray", "chest", "cxr", "radiograph"],
            ["ecg_done"]        = ["ecg", "ekg", "electrocardiogram"],
        };

    /// <summary>Investigation items completed manually on ward (no external webhook).</summary>
    public static readonly IReadOnlySet<string> ManualOnlyItemKeys =
        new HashSet<string>(StringComparer.OrdinalIgnoreCase)
        {
            "physician_fitness",
            "duct_assessed",
            "consent_confirmed",
        };

    public static IReadOnlyList<string> MatchLisKeys(string testCode, string testName)
    {
        var hay = $"{testCode} {testName}";
        return LisItemKeywords
            .Where(kv => kv.Value.Any(k => hay.Contains(k, StringComparison.OrdinalIgnoreCase)))
            .Select(kv => kv.Key)
            .ToList();
    }

    public static IReadOnlyList<string> MatchImagingKeys(string modality, string studyType)
    {
        var hay = $"{modality} {studyType}";
        return ImagingItemKeywords
            .Where(kv => kv.Value.Any(k => hay.Contains(k, StringComparison.OrdinalIgnoreCase)))
            .Select(kv => kv.Key)
            .ToList();
    }
}
