namespace LaboratoryApi.Domain;

/// <summary>LMS Result status. L-TST-01A: Draft. L-VER-01: TechnicalVerified. L-AUTH-01: ClinicallyAuthorized.</summary>
public static class ResultStatuses
{
    public const string Draft = "Draft";

    /// <summary>Analytical/technical verification completed. Not clinically authorized / final / released.</summary>
    public const string TechnicalVerified = "TechnicalVerified";

    public const string TechnicalVerifiedDisplay = "Technical Verified";

    /// <summary>Clinical sign-off of TechnicalVerified version. Not Final / Released / patient-visible.</summary>
    public const string ClinicallyAuthorized = "ClinicallyAuthorized";

    public const string ClinicallyAuthorizedDisplay = "Clinically Authorized";
}

/// <summary>Normalized result datatypes accepted when catalogue supports them.</summary>
public static class ResultDatatypes
{
    public const string Numeric = "Numeric";
    public const string Qualitative = "Qualitative";

    public static string? Normalize(string? catalogueValue)
    {
        if (string.IsNullOrWhiteSpace(catalogueValue)) return null;
        var v = catalogueValue.Trim();
        if (v.Equals("Numeric", StringComparison.OrdinalIgnoreCase)
            || v.Equals("Number", StringComparison.OrdinalIgnoreCase)
            || v.Equals("Quantitative", StringComparison.OrdinalIgnoreCase)
            || v.Equals("QUANTITATIVE", StringComparison.OrdinalIgnoreCase)
            || v.Equals("NUMERIC", StringComparison.OrdinalIgnoreCase))
            return Numeric;
        if (v.Equals("Qualitative", StringComparison.OrdinalIgnoreCase)
            || v.Equals("QUALITATIVE", StringComparison.OrdinalIgnoreCase)
            || v.Equals("Text", StringComparison.OrdinalIgnoreCase))
            return Qualitative;
        return null;
    }
}

public static class ResultIdempotencyOperations
{
    public const string CreateResultDraft = "create_result_draft";
    public const string UpdateResultDraft = "update_result_draft";
    public const string VerifyResult = "verify_result";
    public const string AuthorizeResult = "authorize_result";
}

public static class ResultAuditActions
{
    public const string CreateResultDraft = "CREATE_RESULT_DRAFT";
    public const string UpdateResultDraft = "UPDATE_RESULT_DRAFT";
    public const string VerifyResult = "VERIFY_RESULT";
    public const string AuthorizeResult = "AUTHORIZE_RESULT";
}

public static class ResultAuditResources
{
    public const string LmsResult = "LmsResult";
}

/// <summary>L-CRT-01 — Critical event lifecycle (orthogonal to ResultStatus).</summary>
public static class CriticalResultEventStatuses
{
    public const string Open = "Open";
    public const string Acknowledged = "Acknowledged";
}

/// <summary>L-CRT-01 — in-app notification intent delivery honesty (not acknowledgement).</summary>
public static class CriticalNotificationIntentStatuses
{
    public const string NotAttempted = "NotAttempted";
    public const string Emitted = "Emitted";
    public const string Failed = "Failed";
    public const string Unavailable = "Unavailable";
}

public static class CriticalIdempotencyOperations
{
    public const string CreateCriticalEvent = "create_critical_event";
    public const string AcknowledgeCriticalEvent = "acknowledge_critical_event";
}

public static class CriticalAuditActions
{
    public const string CreateCriticalEvent = "CREATE_CRITICAL_EVENT";
    public const string AcknowledgeCriticalEvent = "ACKNOWLEDGE_CRITICAL_EVENT";
}

public static class CriticalAuditResources
{
    public const string LmsCriticalResultEvent = "LmsCriticalResultEvent";
}
