using System;
using System.Threading;
using System.Threading.Tasks;

namespace AuthService.Services;

/// <summary>
/// L-PORTAL-01 S1 — Server-side Portal principal → PatientId resolution (fail closed).
/// Client-supplied patientId is never proof of identity.
/// </summary>
public interface IPortalPatientResolveService
{
    /// <param name="clientSuppliedPatientId">Ignored for authority; accepted only to prove clients cannot override.</param>
    Task<PortalPatientResolveResult> ResolveAsync(
        Guid tenantId,
        Guid principalUserId,
        Guid? clientSuppliedPatientId = null,
        CancellationToken cancellationToken = default);
}

public sealed class PortalPatientResolveResult
{
    public bool Succeeded { get; init; }
    public Guid? PatientId { get; init; }
    public Guid? LinkId { get; init; }
    /// <summary>Internal reason code for audit; not for client disclosure.</summary>
    public string? DenialReasonCode { get; init; }
    public bool DenialAuditPersisted { get; init; }

    public static PortalPatientResolveResult Success(Guid patientId, Guid linkId) => new()
    {
        Succeeded = true,
        PatientId = patientId,
        LinkId = linkId,
        DenialAuditPersisted = false
    };

    public static PortalPatientResolveResult Denied(string reasonCode, bool auditPersisted) => new()
    {
        Succeeded = false,
        PatientId = null,
        LinkId = null,
        DenialReasonCode = reasonCode,
        DenialAuditPersisted = auditPersisted
    };
}
