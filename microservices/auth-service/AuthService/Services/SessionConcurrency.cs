namespace AuthService.Services;

/// <summary>
/// Phase 3I Slice 7 (PD-S7-01/06) optimistic concurrency on <c>counseling_sessions.version</c>.
/// Mirrors <see cref="BillConcurrency"/>.
/// </summary>
public static class SessionConcurrency
{
    public const string StaleMessage = "This session was updated by another user. Refresh to continue.";

    public static bool IsStale(Exception ex)
        => ex is InvalidOperationException && ex.Message == StaleMessage;
}
