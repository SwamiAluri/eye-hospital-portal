using CcmsApi.Models.Domain;

namespace CcmsApi.Services;

/// <summary>
/// Canonical CCMS → admission decision mapping (Phase 1).
/// Frontend must not duplicate these rules; IP consumes the decision via validate-admission.
/// </summary>
public static class AdmissionCoverageDecisionPolicy
{
    public const string DecisionAllow = "ALLOW";
    public const string DecisionWarn  = "WARN";
    public const string DecisionBlock = "BLOCK";

    /// <summary>
    /// Map a coverage case workflow state to an admission decision.
    /// Emergency FC is an explicit audited exception — it never occurs from a service outage.
    /// </summary>
    public static AdmissionValidationResult Decide(
        CcmsCoverageCase? coverageCase,
        bool emergencyFcApplied = false)
    {
        if (coverageCase is null)
        {
            // IP applies payment-mode context: coverage-based modes treat "no case"
            // as a block; cash/non-coverage modes skip this gate entirely.
            return AdmissionValidationResult.Allow("No coverage case found. Proceeding normally.");
        }

        var state = coverageCase.CurrentState ?? string.Empty;
        var emergencyFc = emergencyFcApplied || coverageCase.EmergencyFcApplied;

        return state switch
        {
            "APPROVED" or "ADMISSION_READY" =>
                AdmissionValidationResult.Allow(null, coverageCase, DecisionAllow),

            "PARTIAL_APPROVAL" =>
                AdmissionValidationResult.Warn(
                    "Partial approval. Patient share applicable.",
                    coverageCase,
                    DecisionWarn),

            // Already past clinical admission in CCMS — do not re-block IP.
            "ADMITTED" or "SURGERY_SCHEDULED" or "SURGERY_COMPLETED"
                or "BILL_PENDING" or "BILL_FINALIZED" or "CLAIM_READY"
                or "CLAIM_SUBMITTED" or "CLAIM_IN_PROCESS" or "CLAIM_QUERY_RAISED" or "CLAIM_QUERY_RESPONDED"
                or "SETTLEMENT_PENDING"
                or "PARTIAL_SETTLEMENT" or "FULL_SETTLEMENT" or "RECONCILED" or "CLOSED" =>
                AdmissionValidationResult.Allow($"Coverage case already in {state}.", coverageCase, DecisionAllow),

            "WAITING_APPROVAL" or "PREAUTH_SENT" when emergencyFc =>
                AdmissionValidationResult.Warn(
                    "Emergency FC applied. Pre-auth still pending TPA response.",
                    coverageCase,
                    DecisionWarn,
                    isEmergencyFc: true),

            "WAITING_APPROVAL" or "PREAUTH_SENT" =>
                AdmissionValidationResult.Block(
                    "Pre-authorization is awaiting TPA approval. Cannot admit under coverage.",
                    coverageCase),

            "PREAUTH_GENERATED" when emergencyFc =>
                AdmissionValidationResult.Warn(
                    "Emergency FC applied. Pre-auth generated but not yet sent.",
                    coverageCase,
                    DecisionWarn,
                    isEmergencyFc: true),

            "PREAUTH_GENERATED" =>
                AdmissionValidationResult.Block(
                    "Pre-auth generated but not sent to TPA. Cannot admit under coverage.",
                    coverageCase),

            "CLARIFICATION_REQUIRED" when emergencyFc =>
                AdmissionValidationResult.Warn(
                    "Emergency FC applied. TPA clarification still outstanding.",
                    coverageCase,
                    DecisionWarn,
                    isEmergencyFc: true),

            "CLARIFICATION_REQUIRED" =>
                AdmissionValidationResult.Block(
                    "TPA requested clarification. Resolve clarification or apply Emergency FC before admission.",
                    coverageCase),

            "RESUBMITTED" when emergencyFc =>
                AdmissionValidationResult.Warn(
                    "Emergency FC applied. Resubmitted pre-auth awaiting decision.",
                    coverageCase,
                    DecisionWarn,
                    isEmergencyFc: true),

            "RESUBMITTED" =>
                AdmissionValidationResult.Block(
                    "Pre-auth resubmitted and awaiting TPA decision. Cannot admit under coverage.",
                    coverageCase),

            "REJECTED" =>
                AdmissionValidationResult.Block(
                    "TPA rejected pre-auth. Cannot admit under insurance.",
                    coverageCase),

            "EXPIRED" =>
                AdmissionValidationResult.Block(
                    "Pre-auth has expired. Renewal required.",
                    coverageCase),

            "CANCELLED" or "ABORTED" =>
                AdmissionValidationResult.Block(
                    "Coverage case was cancelled/aborted.",
                    coverageCase),

            // Early workflow states — existence of a case is not admission-ready.
            "DRAFT" or "ELIGIBILITY_PENDING" or "ELIGIBILITY_VERIFIED"
                or "POLICY_CAPTURED" or "AUTHORIZATION_REQUIRED" =>
                AdmissionValidationResult.Block(
                    $"Coverage authorization is not ready (state: {state}). Complete pre-authorization before admission.",
                    coverageCase),

            _ =>
                AdmissionValidationResult.Block(
                    $"Coverage state '{state}' is not admission-ready.",
                    coverageCase),
        };
    }
}
