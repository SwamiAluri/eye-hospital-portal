namespace CcmsApi.Services;

/// <summary>
/// Maps CCMS workflow CurrentState onto the four Phase 5 coverage statuses
/// consumed by IP/Billing UI. Does not invent a second coverage machine.
/// </summary>
public static class CoverageStatusClassifier
{
    public const string CoverageApproved = "CoverageApproved";
    public const string CoveragePending  = "CoveragePending";
    public const string CoverageRejected = "CoverageRejected";
    public const string CoverageChanged  = "CoverageChanged";

    public static string Classify(string? currentState)
    {
        var s = (currentState ?? string.Empty).Trim().ToUpperInvariant();
        if (s.Length == 0) return CoveragePending;

        if (s is "REJECTED" or "EXPIRED" or "CANCELLED" or "ABORTED")
            return CoverageRejected;

        if (s is "PARTIAL_APPROVAL" or "PARTIAL_APPROVAL"
            or "PARTIAL_SETTLEMENT" or "PARTIAL_SETTLEMENT")
            return CoverageChanged;

        if (s is "APPROVED" or "ADMISSION_READY" or "ADMISSION_READY"
            or "ADMITTED" or "SURGERY_SCHEDULED" or "SURGERY_COMPLETED"
            or "BILL_PENDING" or "BILL_FINALIZED"
            or "CLAIM_READY" or "CLAIM_SUBMITTED" or "CLAIM_IN_PROCESS"
            or "CLAIM_QUERY_RAISED" or "CLAIM_QUERY_RESPONDED"
            or "SETTLEMENT_PENDING" or "FULL_SETTLEMENT"
            or "RECONCILED" or "CLOSED")
            return CoverageApproved;

        return CoveragePending;
    }
}
