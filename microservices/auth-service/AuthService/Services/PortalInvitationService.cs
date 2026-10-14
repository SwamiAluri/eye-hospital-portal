using System;
using System.Linq;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using System.Threading;
using System.Threading.Tasks;
using AuthService.Context;
using AuthService.Models.Domain;
using AuthService.Models.Identity;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Storage;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;

namespace AuthService.Services;

/// <summary>
/// L-PORTAL-01 S2 — Invitation create/supersede/accept with mandatory StageAsync audits.
/// </summary>
public sealed class PortalInvitationService : IPortalInvitationService
{
    private readonly AppDbContext _db;
    private readonly IAuditService _audit;
    private readonly IPasswordHasher<AppUser> _passwordHasher;
    private readonly PortalInvitationOptions _options;
    private readonly ILogger<PortalInvitationService> _logger;

    public PortalInvitationService(
        AppDbContext db,
        IAuditService audit,
        IPasswordHasher<AppUser> passwordHasher,
        IOptions<PortalInvitationOptions> options,
        ILogger<PortalInvitationService> logger)
    {
        _db = db;
        _audit = audit;
        _passwordHasher = passwordHasher;
        _options = options.Value;
        _logger = logger;
    }

    public async Task<PortalInvitationCreateResult> CreateAsync(
        PortalInvitationCreateCommand command,
        CancellationToken cancellationToken = default)
    {
        if (command.TenantId == Guid.Empty
            || command.PatientId == Guid.Empty
            || command.CreatedByUserId == Guid.Empty)
        {
            return PortalInvitationCreateResult.Fail(PortalInvitationRejectReason.InvalidPatient);
        }

        string channel;
        int expiryHours;
        try
        {
            _options.ValidateOrThrow();
            channel = string.IsNullOrWhiteSpace(command.DeliveryChannel)
                ? PortalInvitationDeliveryChannel.StaffDeliveredToken
                : command.DeliveryChannel.Trim();
            if (!_options.IsChannelEnabled(channel))
                return PortalInvitationCreateResult.Fail(PortalInvitationRejectReason.ChannelDisabled);
            expiryHours = _options.ResolveExpiryHours(command.ExpiryHours);
        }
        catch (InvalidOperationException)
        {
            return PortalInvitationCreateResult.Fail(PortalInvitationRejectReason.PolicyInvalid);
        }

        var patient = await _db.Patients
            .FirstOrDefaultAsync(p => p.Id == command.PatientId, cancellationToken);

        if (patient == null || patient.DeletedAt != null)
            return PortalInvitationCreateResult.Fail(PortalInvitationRejectReason.InvalidPatient);

        if (patient.TenantId != command.TenantId)
            return PortalInvitationCreateResult.Fail(PortalInvitationRejectReason.TenantMismatch);

        if (patient.DeceasedDate != null)
            return PortalInvitationCreateResult.Fail(PortalInvitationRejectReason.InvalidPatient);

        var creator = await _db.Users
            .AsNoTracking()
            .FirstOrDefaultAsync(u => u.Id == command.CreatedByUserId, cancellationToken);

        if (creator == null
            || creator.TenantId != command.TenantId
            || string.Equals(creator.UserType, "Patient", StringComparison.OrdinalIgnoreCase))
        {
            return PortalInvitationCreateResult.Fail(PortalInvitationRejectReason.AccountConstraint);
        }

        var now = DateTime.UtcNow;
        var rawToken = GenerateRawToken();
        var tokenHash = HashToken(rawToken);
        var invitationId = Guid.NewGuid();
        var expiresAt = now.AddHours(expiryHours);

        await using var tx = await BeginTransactionIfSupportedAsync(cancellationToken);
        try
        {
            var priorPending = await _db.PortalInvitations
                .Where(i =>
                    i.TenantId == command.TenantId
                    && i.PatientId == command.PatientId
                    && i.Status == PortalInvitationStatus.Pending
                    && i.UsedAt == null
                    && i.SupersededAt == null)
                .ToListAsync(cancellationToken);

            Guid? supersededId = null;
            foreach (var prior in priorPending)
            {
                prior.Status = PortalInvitationStatus.Superseded;
                prior.SupersededAt = now;
                prior.SupersededByInvitationId = invitationId;
                supersededId = prior.Id;

                await _audit.StageAsync(
                    command.CreatedByUserId,
                    PortalIdentityAudit.InviteSuperseded,
                    PortalIdentityAudit.ResourcePortalInvitation,
                    prior.Id,
                    details: JsonSerializer.Serialize(new
                    {
                        tenantId = command.TenantId,
                        patientId = command.PatientId,
                        oldInvitationId = prior.Id,
                        newInvitationId = invitationId
                    }));
            }

            var invitation = new PortalInvitation
            {
                Id = invitationId,
                TenantId = command.TenantId,
                PatientId = command.PatientId,
                DeliveryChannel = channel,
                TokenHash = tokenHash,
                ExpiresAt = expiresAt,
                CreatedByUserId = command.CreatedByUserId,
                CreatedAt = now,
                Status = PortalInvitationStatus.Pending
            };
            _db.PortalInvitations.Add(invitation);

            await _audit.StageAsync(
                command.CreatedByUserId,
                PortalIdentityAudit.InviteCreated,
                PortalIdentityAudit.ResourcePortalInvitation,
                invitationId,
                details: JsonSerializer.Serialize(new
                {
                    tenantId = command.TenantId,
                    patientId = command.PatientId,
                    invitationId,
                    deliveryChannel = channel,
                    expiresAt
                }));

            await _db.SaveChangesAsync(cancellationToken);
            if (tx != null)
                await tx.CommitAsync(cancellationToken);

            return PortalInvitationCreateResult.Success(invitationId, rawToken, expiresAt, supersededId);
        }
        catch (Exception ex)
        {
            if (tx != null)
                await tx.RollbackAsync(cancellationToken);
            _logger.LogWarning(ex, "Portal invitation create failed; mutation rolled back");
            throw;
        }
    }

    public async Task<PortalInvitationAcceptResult> AcceptAsync(
        PortalInvitationAcceptCommand command,
        CancellationToken cancellationToken = default)
    {
        if (command.TenantId == Guid.Empty
            || string.IsNullOrWhiteSpace(command.RawToken)
            || command.RawToken.Length < 16
            || command.RawToken.Length > 256)
        {
            return PortalInvitationAcceptResult.Fail(PortalInvitationRejectReason.MalformedToken);
        }

        if (string.IsNullOrWhiteSpace(command.Email) || string.IsNullOrWhiteSpace(command.Password))
            return PortalInvitationAcceptResult.Fail(PortalInvitationRejectReason.AccountConstraint);

        var tokenHash = HashToken(command.RawToken.Trim());

        await using var tx = await BeginTransactionIfSupportedAsync(cancellationToken);
        try
        {
            var invitation = await _db.PortalInvitations
                .FirstOrDefaultAsync(i => i.TokenHash == tokenHash, cancellationToken);

            if (invitation == null)
            {
                if (tx != null)
                    await tx.RollbackAsync(cancellationToken);
                return PortalInvitationAcceptResult.Fail(PortalInvitationRejectReason.InvalidToken);
            }

            if (invitation.TenantId != command.TenantId)
            {
                await RejectKnownInvitationAsync(
                    invitation,
                    command.TenantId,
                    PortalInvitationRejectReason.TenantMismatch,
                    mutateExpired: false,
                    cancellationToken);
                if (tx != null)
                    await tx.CommitAsync(cancellationToken);
                return PortalInvitationAcceptResult.Fail(PortalInvitationRejectReason.TenantMismatch);
            }

            if (invitation.Status == PortalInvitationStatus.Used || invitation.UsedAt != null)
            {
                await RejectKnownInvitationAsync(
                    invitation,
                    command.TenantId,
                    PortalInvitationRejectReason.Used,
                    mutateExpired: false,
                    cancellationToken);
                if (tx != null)
                    await tx.CommitAsync(cancellationToken);
                return PortalInvitationAcceptResult.Fail(PortalInvitationRejectReason.Used);
            }

            if (invitation.Status == PortalInvitationStatus.Superseded || invitation.SupersededAt != null)
            {
                await RejectKnownInvitationAsync(
                    invitation,
                    command.TenantId,
                    PortalInvitationRejectReason.Superseded,
                    mutateExpired: false,
                    cancellationToken);
                if (tx != null)
                    await tx.CommitAsync(cancellationToken);
                return PortalInvitationAcceptResult.Fail(PortalInvitationRejectReason.Superseded);
            }

            if (invitation.Status == PortalInvitationStatus.Revoked)
            {
                await RejectKnownInvitationAsync(
                    invitation,
                    command.TenantId,
                    PortalInvitationRejectReason.Revoked,
                    mutateExpired: false,
                    cancellationToken);
                if (tx != null)
                    await tx.CommitAsync(cancellationToken);
                return PortalInvitationAcceptResult.Fail(PortalInvitationRejectReason.Revoked);
            }

            var now = DateTime.UtcNow;
            if (invitation.Status == PortalInvitationStatus.Expired
                || invitation.ExpiresAt <= now)
            {
                await RejectKnownInvitationAsync(
                    invitation,
                    command.TenantId,
                    PortalInvitationRejectReason.Expired,
                    mutateExpired: invitation.Status == PortalInvitationStatus.Pending,
                    cancellationToken);
                if (tx != null)
                    await tx.CommitAsync(cancellationToken);
                return PortalInvitationAcceptResult.Fail(PortalInvitationRejectReason.Expired);
            }

            if (invitation.Status != PortalInvitationStatus.Pending)
            {
                await RejectKnownInvitationAsync(
                    invitation,
                    command.TenantId,
                    PortalInvitationRejectReason.InvalidToken,
                    mutateExpired: false,
                    cancellationToken);
                if (tx != null)
                    await tx.CommitAsync(cancellationToken);
                return PortalInvitationAcceptResult.Fail(PortalInvitationRejectReason.InvalidToken);
            }

            // Concurrent accept: only one transition pending → used.
            if (_db.Database.IsRelational())
            {
                var claimed = await _db.PortalInvitations
                    .Where(i =>
                        i.Id == invitation.Id
                        && i.Status == PortalInvitationStatus.Pending
                        && i.UsedAt == null
                        && i.SupersededAt == null
                        && i.ExpiresAt > now)
                    .ExecuteUpdateAsync(setters => setters
                            .SetProperty(i => i.Status, PortalInvitationStatus.Used)
                            .SetProperty(i => i.UsedAt, now),
                        cancellationToken);

                if (claimed != 1)
                {
                    if (tx != null)
                        await tx.RollbackAsync(cancellationToken);
                    return PortalInvitationAcceptResult.Fail(PortalInvitationRejectReason.Used);
                }

                await _db.Entry(invitation).ReloadAsync(cancellationToken);
            }
            else
            {
                invitation.Status = PortalInvitationStatus.Used;
                invitation.UsedAt = now;
            }

            var patient = await _db.Patients
                .FirstOrDefaultAsync(p => p.Id == invitation.PatientId, cancellationToken);

            if (patient == null
                || patient.DeletedAt != null
                || patient.TenantId != invitation.TenantId
                || patient.DeceasedDate != null)
            {
                // Roll back claim: restore pending so staff can supersede; still fail closed.
                invitation.Status = PortalInvitationStatus.Pending;
                invitation.UsedAt = null;
                await RejectKnownInvitationAsync(
                    invitation,
                    invitation.TenantId,
                    PortalInvitationRejectReason.InvalidPatient,
                    mutateExpired: false,
                    cancellationToken);
                if (tx != null)
                    await tx.CommitAsync(cancellationToken);
                return PortalInvitationAcceptResult.Fail(PortalInvitationRejectReason.InvalidPatient);
            }

            var hasActiveVerified = await _db.PortalPatientLinks.AnyAsync(l =>
                    l.TenantId == invitation.TenantId
                    && l.PatientId == invitation.PatientId
                    && l.VerificationStatus == PortalLinkVerificationStatus.Verified
                    && l.RevokedAt == null,
                cancellationToken);

            if (hasActiveVerified)
            {
                invitation.Status = PortalInvitationStatus.Pending;
                invitation.UsedAt = null;
                await RejectKnownInvitationAsync(
                    invitation,
                    invitation.TenantId,
                    PortalInvitationRejectReason.AccountConstraint,
                    mutateExpired: false,
                    cancellationToken);
                if (tx != null)
                    await tx.CommitAsync(cancellationToken);
                return PortalInvitationAcceptResult.Fail(PortalInvitationRejectReason.AccountConstraint);
            }

            var email = command.Email.Trim();
            var normalizedEmail = email.ToUpperInvariant();
            var existing = await _db.Users
                .FirstOrDefaultAsync(u => u.NormalizedEmail == normalizedEmail, cancellationToken);

            AppUser principal;
            if (existing != null)
            {
                if (!string.Equals(existing.UserType, "Patient", StringComparison.OrdinalIgnoreCase)
                    || existing.TenantId != invitation.TenantId
                    || existing.DeletedAt != null)
                {
                    invitation.Status = PortalInvitationStatus.Pending;
                    invitation.UsedAt = null;
                    await RejectKnownInvitationAsync(
                        invitation,
                        invitation.TenantId,
                        PortalInvitationRejectReason.AccountConstraint,
                        mutateExpired: false,
                        cancellationToken);
                    if (tx != null)
                        await tx.CommitAsync(cancellationToken);
                    return PortalInvitationAcceptResult.Fail(PortalInvitationRejectReason.AccountConstraint);
                }

                principal = existing;
                principal.PasswordHash = _passwordHasher.HashPassword(principal, command.Password);
                principal.UserStatus = "active";
                principal.ActivationStatus = "active";
                principal.EmailConfirmed = true;
                principal.MustChangePasswordOnLogin = false;
                principal.UpdatedAt = now;
            }
            else
            {
                var id = Guid.NewGuid();
                principal = new AppUser
                {
                    Id = id,
                    TenantId = invitation.TenantId,
                    UserName = email,
                    NormalizedUserName = normalizedEmail,
                    Email = email,
                    NormalizedEmail = normalizedEmail,
                    EmailConfirmed = true,
                    UserType = "Patient",
                    UserStatus = "active",
                    ActivationStatus = "active",
                    MustChangePasswordOnLogin = false,
                    SecurityStamp = Guid.NewGuid().ToString("N"),
                    CreatedAt = now,
                    UpdatedAt = now
                };
                principal.PasswordHash = _passwordHasher.HashPassword(principal, command.Password);
                _db.Users.Add(principal);
            }

            var link = await _db.PortalPatientLinks.FirstOrDefaultAsync(l =>
                    l.TenantId == invitation.TenantId
                    && l.PrincipalUserId == principal.Id
                    && l.PatientId == invitation.PatientId
                    && l.VerificationStatus == PortalLinkVerificationStatus.Unverified
                    && l.RevokedAt == null,
                cancellationToken);

            var createdLink = false;
            if (link == null)
            {
                link = new PortalPatientLink
                {
                    Id = Guid.NewGuid(),
                    TenantId = invitation.TenantId,
                    PrincipalUserId = principal.Id,
                    PatientId = invitation.PatientId,
                    VerificationStatus = PortalLinkVerificationStatus.Unverified,
                    CreatedAt = now
                };
                _db.PortalPatientLinks.Add(link);
                createdLink = true;
            }

            // Hard rule: acceptance never verifies.
            if (link.VerificationStatus != PortalLinkVerificationStatus.Unverified
                || link.VerifiedAt != null
                || link.VerifiedByUserId != null)
            {
                link.VerificationStatus = PortalLinkVerificationStatus.Unverified;
                link.VerifiedAt = null;
                link.VerifiedByUserId = null;
                link.VerificationMethodCode = null;
            }

            if (createdLink)
            {
                await _audit.StageAsync(
                    principal.Id,
                    PortalIdentityAudit.LinkCreatedUnverified,
                    PortalIdentityAudit.ResourcePortalPatientLink,
                    link.Id,
                    details: JsonSerializer.Serialize(new
                    {
                        tenantId = invitation.TenantId,
                        principalUserId = principal.Id,
                        patientId = invitation.PatientId,
                        linkId = link.Id,
                        verificationStatus = PortalLinkVerificationStatus.Unverified,
                        invitationId = invitation.Id
                    }));
            }

            await _db.SaveChangesAsync(cancellationToken);
            if (tx != null)
                await tx.CommitAsync(cancellationToken);

            return PortalInvitationAcceptResult.Success(
                invitation.Id,
                principal.Id,
                link.Id,
                PortalLinkVerificationStatus.Unverified);
        }
        catch (Exception ex)
        {
            if (tx != null)
                await tx.RollbackAsync(cancellationToken);
            _logger.LogWarning(ex, "Portal invitation accept failed; mutation rolled back");
            throw;
        }
    }

    private async Task RejectKnownInvitationAsync(
        PortalInvitation invitation,
        Guid tenantId,
        string reasonCode,
        bool mutateExpired,
        CancellationToken cancellationToken)
    {
        if (mutateExpired && invitation.Status == PortalInvitationStatus.Pending)
        {
            invitation.Status = PortalInvitationStatus.Expired;
        }

        await _audit.StageAsync(
            Guid.Empty,
            PortalIdentityAudit.InviteExpiredOrRejected,
            PortalIdentityAudit.ResourcePortalInvitation,
            invitation.Id,
            details: JsonSerializer.Serialize(new
            {
                tenantId,
                invitationId = invitation.Id,
                reasonCode
            }));

        await _db.SaveChangesAsync(cancellationToken);
    }

    private async Task<IDbContextTransaction?> BeginTransactionIfSupportedAsync(CancellationToken cancellationToken)
    {
        if (!_db.Database.IsRelational())
            return null;
        return await _db.Database.BeginTransactionAsync(cancellationToken);
    }

    internal static string GenerateRawToken()
    {
        var bytes = new byte[32];
        RandomNumberGenerator.Fill(bytes);
        return Convert.ToBase64String(bytes)
            .Replace("+", "-", StringComparison.Ordinal)
            .Replace("/", "_", StringComparison.Ordinal)
            .Replace("=", "", StringComparison.Ordinal);
    }

    internal static string HashToken(string rawToken)
    {
        var hash = SHA256.HashData(Encoding.UTF8.GetBytes(rawToken));
        return Convert.ToHexString(hash).ToLowerInvariant();
    }
}
