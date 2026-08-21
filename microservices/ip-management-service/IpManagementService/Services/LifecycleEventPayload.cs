namespace IpManagementService.Services;

/// <summary>
/// Versioned lifecycle integration payload (Phase 2 event contracts).
/// Keep PHI minimal — identifiers only.
/// </summary>
public static class LifecycleEventPayload
{
    public const int CurrentVersion = 1;

    public static object Build(
        Guid tenantId,
        Guid journeyId,
        Guid? sessionId,
        Guid? patientId,
        Guid actorUserId,
        Guid? coverageCaseId = null,
        Guid? correlationId = null,
        object? extra = null)
    {
        return new
        {
            payloadVersion = CurrentVersion,
            tenantId,
            journeyId,
            sessionId,
            counsellingSessionId = sessionId,
            patientId,
            coverageCaseId,
            actorUserId,
            correlationId = correlationId ?? journeyId,
            occurredAt = DateTime.UtcNow,
            extra,
        };
    }
}
