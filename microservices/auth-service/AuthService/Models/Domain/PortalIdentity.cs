using System;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace AuthService.Models.Domain;

/// <summary>
/// L-PORTAL-01 S1 — Portal invitation persistence foundation.
/// Raw invitation secrets are never stored; only <see cref="TokenHash"/>.
/// Lifecycle APIs are out of S1 scope.
/// </summary>
[Table("portal_invitations")]
public class PortalInvitation
{
    [Column("id")]
    public Guid Id { get; set; }

    [Column("tenant_id")]
    public Guid TenantId { get; set; }

    [Column("patient_id")]
    public Guid PatientId { get; set; }

    [Column("delivery_channel")]
    [StringLength(50)]
    public string DeliveryChannel { get; set; } = string.Empty;

    /// <summary>SHA-256 (or equivalent) hash of the single-use invitation secret. Never store raw tokens.</summary>
    [Column("token_hash")]
    [StringLength(128)]
    public string TokenHash { get; set; } = string.Empty;

    [Column("expires_at")]
    public DateTime ExpiresAt { get; set; }

    [Column("used_at")]
    public DateTime? UsedAt { get; set; }

    [Column("superseded_at")]
    public DateTime? SupersededAt { get; set; }

    [Column("superseded_by_invitation_id")]
    public Guid? SupersededByInvitationId { get; set; }

    [Column("created_by_user_id")]
    public Guid CreatedByUserId { get; set; }

    [Column("created_at")]
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    /// <summary>pending | used | expired | superseded | revoked</summary>
    [Column("status")]
    [StringLength(30)]
    public string Status { get; set; } = PortalInvitationStatus.Pending;
}

public static class PortalInvitationStatus
{
    public const string Pending = "pending";
    public const string Used = "used";
    public const string Expired = "expired";
    public const string Superseded = "superseded";
    public const string Revoked = "revoked";
}

/// <summary>
/// L-PORTAL-01 S1 — Portal principal ↔ MPI Patient link.
/// Active verified uniqueness is bidirectional (tenant-scoped); historical unverified/revoked rows are allowed.
/// </summary>
[Table("portal_patient_links")]
public class PortalPatientLink
{
    [Column("id")]
    public Guid Id { get; set; }

    [Column("tenant_id")]
    public Guid TenantId { get; set; }

    [Column("principal_user_id")]
    public Guid PrincipalUserId { get; set; }

    [Column("patient_id")]
    public Guid PatientId { get; set; }

    /// <summary>unverified | verified | revoked</summary>
    [Column("verification_status")]
    [StringLength(30)]
    public string VerificationStatus { get; set; } = PortalLinkVerificationStatus.Unverified;

    [Column("verification_method_code")]
    [StringLength(100)]
    public string? VerificationMethodCode { get; set; }

    [Column("verified_at")]
    public DateTime? VerifiedAt { get; set; }

    [Column("verified_by_user_id")]
    public Guid? VerifiedByUserId { get; set; }

    [Column("revoked_at")]
    public DateTime? RevokedAt { get; set; }

    [Column("revoked_reason")]
    [StringLength(500)]
    public string? RevokedReason { get; set; }

    [Column("created_at")]
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}

public static class PortalLinkVerificationStatus
{
    public const string Unverified = "unverified";
    public const string Verified = "verified";
    public const string Revoked = "revoked";
}

/// <summary>
/// L-PORTAL-01 S1 — Remediation request persistence foundation only (workflows in S4).
/// </summary>
[Table("portal_remediation_requests")]
public class PortalRemediationRequest
{
    [Column("id")]
    public Guid Id { get; set; }

    [Column("tenant_id")]
    public Guid TenantId { get; set; }

    [Column("link_id")]
    public Guid LinkId { get; set; }

    [Column("requested_by_user_id")]
    public Guid RequestedByUserId { get; set; }

    [Column("approved_by_user_id")]
    public Guid? ApprovedByUserId { get; set; }

    [Column("operation")]
    [StringLength(50)]
    public string Operation { get; set; } = string.Empty;

    [Column("reason")]
    [StringLength(1000)]
    public string Reason { get; set; } = string.Empty;

    /// <summary>pending | approved | denied | cancelled</summary>
    [Column("status")]
    [StringLength(30)]
    public string Status { get; set; } = PortalRemediationStatus.Pending;

    [Column("created_at")]
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    [Column("resolved_at")]
    public DateTime? ResolvedAt { get; set; }
}

public static class PortalRemediationStatus
{
    public const string Pending = "pending";
    public const string Approved = "approved";
    public const string Denied = "denied";
    public const string Cancelled = "cancelled";
}

/// <summary>Approved delivery channel codes (policy-enabled). Email/SMS wiring is out of S2.</summary>
public static class PortalInvitationDeliveryChannel
{
    public const string StaffDeliveredToken = "staff_delivered_token";
}

/// <summary>Ratified L-PORTAL-01 audit action / resource-type constants (do not invent alternatives).</summary>
public static class PortalIdentityAudit
{
    public const string ResourcePortalResolve = "PortalResolve";
    public const string ResourcePortalInvitation = "PortalInvitation";
    public const string ResourcePortalPatientLink = "PortalPatientLink";
    public const string ResourcePortalRemediation = "PortalRemediation";
    public const string ResourcePortalPrincipal = "PortalPrincipal";

    public const string ResolveDenied = "portal.resolve.denied";
    public const string InviteCreated = "portal.invite.created";
    public const string InviteSuperseded = "portal.invite.superseded";
    public const string InviteExpiredOrRejected = "portal.invite.expired_or_rejected";
    public const string LinkCreatedUnverified = "portal.link.created_unverified";
    public const int RetentionDays = 2555;
}

/// <summary>Internal reason codes for invitation reject/expire audits (not for client disclosure).</summary>
public static class PortalInvitationRejectReason
{
    public const string Expired = "expired";
    public const string Used = "used";
    public const string Superseded = "superseded";
    public const string Revoked = "revoked";
    public const string InvalidToken = "invalid_token";
    public const string MalformedToken = "malformed_token";
    public const string TenantMismatch = "tenant_mismatch";
    public const string InvalidPatient = "invalid_patient";
    public const string AccountConstraint = "account_constraint";
    public const string PolicyInvalid = "policy_invalid";
    public const string ChannelDisabled = "channel_disabled";
}

public static class PortalResolveDenialReason
{
    public const string Missing = "missing";
    public const string Unverified = "unverified";
    public const string Ambiguous = "ambiguous";
    public const string Deceased = "deceased";
    public const string Revoked = "revoked";
    public const string CrossTenant = "cross_tenant";
    public const string MissingPrincipal = "missing_principal";
    public const string InvalidPrincipal = "invalid_principal";
    public const string MissingPatient = "missing_patient";
    public const string InvalidPatient = "invalid_patient";
}
