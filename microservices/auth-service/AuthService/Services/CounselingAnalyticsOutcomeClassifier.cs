using System;
using AuthService.Models.Domain;

namespace AuthService.Services;

/// <summary>
/// Phase 2Z / PD13 — mutually exclusive analytics outcome partition.
/// Active Follow-up (intention allowlist) remains separate from PendingDecision analytics.
/// </summary>
public enum CounselingAnalyticsOutcomePartition
{
    Agreed,
    Declined,
    PendingDecision,
    Exception,
    OtherUnclassified,
}

public static class CounselingAnalyticsOutcomeClassifier
{
    public const string DeclinedIntention = "Declined";
    public const string ReferredElsewhereIntention = "ReferredElsewhere";

    /// <summary>
    /// Classifies a session into exactly one PD13 partition using explicit precedence.
    /// Agreed+Declined Exception requires <see cref="IsDeclinedMarker"/> (PatientIntention
    /// Declined/ReferredElsewhere); bool-only contradictions are not inferred as Exception.
    /// </summary>
    public static CounselingAnalyticsOutcomePartition Classify(CounselingSession session)
        => Classify(session.PendingDecision, session.PatientAgreedToSurgery, session.PatientIntention);

    /// <summary>
    /// Classifies from outcome flags (testable without a full entity).
    /// </summary>
    public static CounselingAnalyticsOutcomePartition Classify(
        bool pending,
        bool? patientAgreedToSurgery,
        string? patientIntention)
    {
        var agreed = patientAgreedToSurgery == true;
        var declinedMarker = IsDeclinedMarker(patientIntention);

        // 1. Agreed + Declined (intention marker required — bool-only not Exception)
        if (agreed && declinedMarker)
            return CounselingAnalyticsOutcomePartition.Exception;

        // 2. Declined marker + PendingDecision
        if (declinedMarker && pending)
            return CounselingAnalyticsOutcomePartition.Exception;

        // 3–4. PendingDecision (includes pending + agreed)
        if (pending)
            return CounselingAnalyticsOutcomePartition.PendingDecision;

        // 5. Agreed only
        if (agreed)
            return CounselingAnalyticsOutcomePartition.Agreed;

        // 6. Classic finalized decline
        if (patientAgreedToSurgery == false && !pending)
            return CounselingAnalyticsOutcomePartition.Declined;

        // 7. Unrecognized / null agreement without pending
        return CounselingAnalyticsOutcomePartition.OtherUnclassified;
    }

    public static bool IsDeclinedMarker(string? patientIntention)
        => patientIntention == DeclinedIntention
        || patientIntention == ReferredElsewhereIntention;
}
