namespace LaboratoryApi.Domain;

public static class OrderStatuses
{
    public const string Draft = "Draft";
    public const string Submitted = "Submitted";
    public const string Cancelled = "Cancelled";

    public static readonly HashSet<string> All = new(StringComparer.Ordinal)
    {
        Draft, Submitted, Cancelled,
    };
}

public static class OrderTestStatuses
{
    public const string Ordered = "Ordered";
}

public static class OrderSources
{
    public const string Clinician = "Clinician";
    public const string SelfRequested = "SelfRequested";
    public const string Referral = "Referral";
    public const string Imported = "Imported";
    public const string Integration = "Integration";

    public static readonly HashSet<string> All = new(StringComparer.Ordinal)
    {
        Clinician, SelfRequested, Referral, Imported, Integration,
    };

    public static bool IsValid(string? v) =>
        !string.IsNullOrWhiteSpace(v) && All.Contains(v.Trim());
}

public static class OrderPriorities
{
    public const string Routine = "Routine";
    public const string Urgent = "Urgent";
    public const string STAT = "STAT";

    public static readonly HashSet<string> All = new(StringComparer.Ordinal)
    {
        Routine, Urgent, STAT,
    };

    public static bool IsValid(string? v) =>
        !string.IsNullOrWhiteSpace(v) && All.Contains(v.Trim());

    public static bool RequiresReason(string priority) =>
        priority is Urgent or STAT;
}

public static class OrderAuditActions
{
    public const string CreateDraft = "CREATE_DRAFT";
    public const string UpdateDraft = "UPDATE_DRAFT";
    public const string SubmitOrder = "SUBMIT_ORDER";
    public const string AmendOrder = "AMEND_ORDER";
    public const string CancelOrder = "CANCEL_ORDER";
}

public static class OrderAuditResourceTypes
{
    public const string Order = "LmsOrder";
    public const string OrderVersion = "LmsOrderVersion";
}
