namespace LaboratoryApi.Domain;

/// <summary>L-COL-01B planning lifecycle only — no Specimen/Collected clinical semantics.</summary>
public static class CollectionTaskStatuses
{
    public const string Planned = "Planned";
    public const string Ready = "Ready";
    public const string InProgress = "InProgress";
    public const string Completed = "Completed";
    public const string Cancelled = "Cancelled";

    public static readonly HashSet<string> All = new(StringComparer.Ordinal)
    {
        Planned, Ready, InProgress, Completed, Cancelled,
    };

    public static readonly HashSet<string> Terminal = new(StringComparer.Ordinal)
    {
        Completed, Cancelled,
    };

    public static bool IsValid(string? v) =>
        !string.IsNullOrWhiteSpace(v) && All.Contains(v.Trim());

    public static bool IsTerminal(string status) => Terminal.Contains(status);
}

public static class CollectionAuditActions
{
    public const string CreateTask = "CREATE_COLLECTION_TASK";
    public const string TransitionTask = "TRANSITION_COLLECTION_TASK";
    public const string ClaimTask = "CLAIM_COLLECTION_TASK";
    public const string AssignTask = "ASSIGN_COLLECTION_TASK";
    public const string ReleaseTask = "RELEASE_COLLECTION_TASK";
    public const string CancelTask = "CANCEL_COLLECTION_TASK";
}

public static class CollectionAuditResourceTypes
{
    public const string CollectionTask = "LmsCollectionTask";
}
