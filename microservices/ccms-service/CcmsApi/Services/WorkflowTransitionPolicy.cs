namespace CcmsApi.Services;

/// <summary>
/// Guards raw workflow transitions. Operators must use domain APIs (tabs/modals);
/// workflow admins may fire raw transitions for recovery.
/// </summary>
public static class WorkflowTransitionPolicy
{
    /// <summary>Triggers that create or advance business entities — blocked on POST .../transition for non-admins.</summary>
    public static readonly HashSet<string> OperationalTriggers = new(StringComparer.OrdinalIgnoreCase)
    {
        "VERIFY_ELIGIBILITY",
        "ELIGIBILITY_APPROVED",
        "ELIGIBILITY_FAILED",
        "CAPTURE_POLICY",
        "REQUIRE_AUTHORIZATION",
        "GENERATE_PREAUTH",
        "SEND_PREAUTH",
        "WAIT_RESPONSE",
        "RECEIVE_APPROVAL",
        "RECEIVE_PARTIAL",
        "RECEIVE_REJECTION",
        "REQUEST_CLARIFICATION",
        "RESUBMIT",
        "PREPARE_ADMISSION",
        "ADMIT_PATIENT",
        "SCHEDULE_SURGERY",
        "COMPLETE_SURGERY",
        "GENERATE_BILL",
        "FINALIZE_BILL",
        "PREPARE_CLAIM",
        "SUBMIT_CLAIM",
        "CLAIM_ACKNOWLEDGED",
        "RECEIVE_SETTLEMENT",
        "PARTIAL_PAYMENT",
        "FULL_PAYMENT",
        "RECONCILE",
        "CLOSE_CASE",
    };

    public static readonly HashSet<string> AdminOnlyTriggers = new(StringComparer.OrdinalIgnoreCase)
    {
        "CANCEL",
        "ABORT",
        "EXPIRE_PREAUTH",
    };

    /// <summary>
    /// TPA / pre-auth outcomes must use domain APIs (Record TPA Response, Generate, Send)
    /// even for workflow admins — raw transition would skip auth rows and approval events.
    /// </summary>
    public static readonly HashSet<string> DomainOnlyTriggers = new(StringComparer.OrdinalIgnoreCase)
    {
        "GENERATE_PREAUTH",
        "SEND_PREAUTH",
        "WAIT_RESPONSE",
        "RECEIVE_APPROVAL",
        "RECEIVE_PARTIAL",
        "RECEIVE_REJECTION",
        "REQUEST_CLARIFICATION",
        "RESUBMIT",
    };

    public static bool IsWorkflowAdmin(IReadOnlyCollection<string>? permissions)
    {
        if (permissions is null || permissions.Count == 0) return false;
        return permissions.Contains("*") || permissions.Contains("ccms.workflow.admin");
    }

    public static bool IsOperationalTrigger(string? triggerEvent)
        => !string.IsNullOrWhiteSpace(triggerEvent)
           && OperationalTriggers.Contains(triggerEvent.Trim());

    public static bool IsAdminOnlyTrigger(string? triggerEvent)
        => !string.IsNullOrWhiteSpace(triggerEvent)
           && AdminOnlyTriggers.Contains(triggerEvent.Trim());

    /// <summary>Returns null if allowed; otherwise a human-readable block reason.</summary>
    public static string? GetRawTransitionBlockReason(string triggerEvent, IReadOnlyCollection<string>? permissions)
    {
        var trigger = triggerEvent.Trim();

        if (IsAdminOnlyTrigger(trigger) && !IsWorkflowAdmin(permissions))
            return $"Trigger '{trigger}' is restricted to workflow administrators.";

        if (DomainOnlyTriggers.Contains(trigger))
            return GetDomainApiHint(trigger);

        if (IsOperationalTrigger(trigger) && !IsWorkflowAdmin(permissions))
            return GetDomainApiHint(trigger);

        return null;
    }

    private static string GetDomainApiHint(string trigger) => trigger.ToUpperInvariant() switch
    {
        "VERIFY_ELIGIBILITY" or "ELIGIBILITY_APPROVED" =>
            "Record eligibility via the Overview tab (eligibility check API), not a raw transition.",
        "CAPTURE_POLICY" or "REQUIRE_AUTHORIZATION" =>
            "Capture policy via visit policy or counsellor draft, not a raw transition.",
        "GENERATE_PREAUTH" =>
            "Use Pre-Auth tab → Generate Pre-Auth.",
        "SEND_PREAUTH" or "WAIT_RESPONSE" =>
            "Use Pre-Auth tab → Send to TPA.",
        "RECEIVE_APPROVAL" or "RECEIVE_PARTIAL" or "RECEIVE_REJECTION" or "REQUEST_CLARIFICATION" =>
            "Use Pre-Auth tab → Record TPA Response.",
        "FINALIZE_BILL" or "GENERATE_BILL" =>
            "Use Billing tab → Import / Allocate Bill.",
        "PREPARE_CLAIM" or "SUBMIT_CLAIM" or "CLAIM_ACKNOWLEDGED" =>
            "Use Claims tab to generate, submit, or acknowledge the claim.",
        "PARTIAL_PAYMENT" or "FULL_PAYMENT" or "RECEIVE_SETTLEMENT" =>
            "Use Settlement tab → Record Payment.",
        "RECONCILE" =>
            "Use Settlement tab → Reconcile.",
        "CLOSE_CASE" =>
            "Use Settlement tab → Close Case after reconciliation.",
        _ =>
            $"Trigger '{trigger}' must be executed through the appropriate CCMS tab action, not POST /transition.",
    };
}
