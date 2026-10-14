using System;
using System.Threading;
using System.Threading.Tasks;

namespace AuthService.Services;

/// <summary>
/// L-PORTAL-01 S2 — Staff-initiated invitation create/supersede and token acceptance.
/// Create HTTP is Gate-A blocked until <c>portal.invite.create</c> is authorized for definition/seeding.
/// </summary>
public interface IPortalInvitationService
{
    /// <summary>
    /// Creates a pending invitation for an explicitly selected tenant-scoped patient.
    /// Supersedes any prior unused (pending) invitation for the same tenant+patient in the same transaction.
    /// Returns the raw single-use token once for staff-delivered handoff; only the hash is persisted.
    /// </summary>
    Task<PortalInvitationCreateResult> CreateAsync(
        PortalInvitationCreateCommand command,
        CancellationToken cancellationToken = default);

    /// <summary>
    /// Accepts a single-use invitation token. On success creates/activates a Patient principal
    /// and ensures an <b>unverified</b> link only (never verified). Failures are enumeration-safe.
    /// </summary>
    Task<PortalInvitationAcceptResult> AcceptAsync(
        PortalInvitationAcceptCommand command,
        CancellationToken cancellationToken = default);
}

public sealed class PortalInvitationCreateCommand
{
    public Guid TenantId { get; init; }
    public Guid PatientId { get; init; }
    public Guid CreatedByUserId { get; init; }
    /// <summary>Optional; defaults to staff_delivered_token when omitted.</summary>
    public string? DeliveryChannel { get; init; }
    /// <summary>Optional expiry override in hours; must fall within configured policy bounds.</summary>
    public int? ExpiryHours { get; init; }
}

public sealed class PortalInvitationAcceptCommand
{
    /// <summary>Caller-asserted tenant; must match invitation tenant or accept fails closed.</summary>
    public Guid TenantId { get; init; }
    public string RawToken { get; init; } = string.Empty;
    public string Email { get; init; } = string.Empty;
    public string Password { get; init; } = string.Empty;
}

public sealed class PortalInvitationCreateResult
{
    public bool Succeeded { get; init; }
    public Guid? InvitationId { get; init; }
    /// <summary>Raw token returned once to the staff caller for staff-delivered handoff. Never persisted.</summary>
    public string? RawToken { get; init; }
    public DateTime? ExpiresAt { get; init; }
    public Guid? SupersededInvitationId { get; init; }
    /// <summary>Internal failure reason; not for client disclosure on public APIs.</summary>
    public string? FailureReasonCode { get; init; }

    public static PortalInvitationCreateResult Success(
        Guid invitationId,
        string rawToken,
        DateTime expiresAt,
        Guid? supersededInvitationId) => new()
    {
        Succeeded = true,
        InvitationId = invitationId,
        RawToken = rawToken,
        ExpiresAt = expiresAt,
        SupersededInvitationId = supersededInvitationId
    };

    public static PortalInvitationCreateResult Fail(string reasonCode) => new()
    {
        Succeeded = false,
        FailureReasonCode = reasonCode
    };
}

public sealed class PortalInvitationAcceptResult
{
    public bool Succeeded { get; init; }
    public Guid? InvitationId { get; init; }
    public Guid? PrincipalUserId { get; init; }
    public Guid? LinkId { get; init; }
    public string? LinkVerificationStatus { get; init; }
    /// <summary>Internal reason; public clients must receive a generic invalid/expired message only.</summary>
    public string? FailureReasonCode { get; init; }

    public static PortalInvitationAcceptResult Success(
        Guid invitationId,
        Guid principalUserId,
        Guid linkId,
        string verificationStatus) => new()
    {
        Succeeded = true,
        InvitationId = invitationId,
        PrincipalUserId = principalUserId,
        LinkId = linkId,
        LinkVerificationStatus = verificationStatus
    };

    public static PortalInvitationAcceptResult Fail(string reasonCode) => new()
    {
        Succeeded = false,
        FailureReasonCode = reasonCode
    };
}
