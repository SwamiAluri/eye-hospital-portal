using System;
using System.Linq;
using System.Text.Json;
using System.Threading;
using System.Threading.Tasks;
using AuthService.Context;
using AuthService.Models.Domain;
using AuthService.Models.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;

namespace AuthService.Services;

/// <summary>
/// Fail-closed Portal patient resolution. S1 foundation only — no HTTP/JWT cutover.
/// </summary>
public sealed class PortalPatientResolveService : IPortalPatientResolveService
{
    private readonly AppDbContext _db;
    private readonly IAuditService _audit;
    private readonly ILogger<PortalPatientResolveService> _logger;

    public PortalPatientResolveService(
        AppDbContext db,
        IAuditService audit,
        ILogger<PortalPatientResolveService> logger)
    {
        _db = db;
        _audit = audit;
        _logger = logger;
    }

    public async Task<PortalPatientResolveResult> ResolveAsync(
        Guid tenantId,
        Guid principalUserId,
        Guid? clientSuppliedPatientId = null,
        CancellationToken cancellationToken = default)
    {
        // clientSuppliedPatientId is intentionally unused for authority (AT-18).
        _ = clientSuppliedPatientId;

        if (tenantId == Guid.Empty || principalUserId == Guid.Empty)
            return await DenyAsync(tenantId, principalUserId, PortalResolveDenialReason.InvalidPrincipal, cancellationToken);

        var principal = await _db.Users
            .AsNoTracking()
            .FirstOrDefaultAsync(u => u.Id == principalUserId, cancellationToken);

        if (principal == null)
            return await DenyAsync(tenantId, principalUserId, PortalResolveDenialReason.MissingPrincipal, cancellationToken);

        if (!string.Equals(principal.UserType, "Patient", StringComparison.OrdinalIgnoreCase))
            return await DenyAsync(tenantId, principalUserId, PortalResolveDenialReason.InvalidPrincipal, cancellationToken);

        if (principal.TenantId != tenantId)
            return await DenyAsync(tenantId, principalUserId, PortalResolveDenialReason.CrossTenant, cancellationToken);

        var activeVerifiedForPrincipal = await _db.PortalPatientLinks
            .AsNoTracking()
            .Where(l =>
                l.TenantId == tenantId
                && l.PrincipalUserId == principalUserId
                && l.VerificationStatus == PortalLinkVerificationStatus.Verified
                && l.RevokedAt == null)
            .ToListAsync(cancellationToken);

        if (activeVerifiedForPrincipal.Count == 0)
        {
            var hasRevoked = await _db.PortalPatientLinks.AsNoTracking().AnyAsync(l =>
                l.TenantId == tenantId
                && l.PrincipalUserId == principalUserId
                && (l.VerificationStatus == PortalLinkVerificationStatus.Revoked || l.RevokedAt != null),
                cancellationToken);

            var hasUnverified = await _db.PortalPatientLinks.AsNoTracking().AnyAsync(l =>
                l.TenantId == tenantId
                && l.PrincipalUserId == principalUserId
                && l.VerificationStatus == PortalLinkVerificationStatus.Unverified
                && l.RevokedAt == null,
                cancellationToken);

            var reason = hasRevoked && !hasUnverified
                ? PortalResolveDenialReason.Revoked
                : hasUnverified
                    ? PortalResolveDenialReason.Unverified
                    : PortalResolveDenialReason.Missing;

            return await DenyAsync(tenantId, principalUserId, reason, cancellationToken);
        }

        if (activeVerifiedForPrincipal.Count > 1)
            return await DenyAsync(tenantId, principalUserId, PortalResolveDenialReason.Ambiguous, cancellationToken);

        var link = activeVerifiedForPrincipal[0];

        // Bidirectional invariant: patient must have exactly one active verified link (this one).
        var activeVerifiedForPatient = await _db.PortalPatientLinks
            .AsNoTracking()
            .CountAsync(l =>
                l.TenantId == tenantId
                && l.PatientId == link.PatientId
                && l.VerificationStatus == PortalLinkVerificationStatus.Verified
                && l.RevokedAt == null,
                cancellationToken);

        if (activeVerifiedForPatient != 1)
            return await DenyAsync(tenantId, principalUserId, PortalResolveDenialReason.Ambiguous, cancellationToken);

        var patient = await _db.Patients
            .AsNoTracking()
            .FirstOrDefaultAsync(p => p.Id == link.PatientId, cancellationToken);

        if (patient == null)
            return await DenyAsync(tenantId, principalUserId, PortalResolveDenialReason.MissingPatient, cancellationToken);

        if (patient.DeletedAt != null)
            return await DenyAsync(tenantId, principalUserId, PortalResolveDenialReason.InvalidPatient, cancellationToken);

        if (patient.TenantId != tenantId || patient.TenantId != link.TenantId)
            return await DenyAsync(tenantId, principalUserId, PortalResolveDenialReason.CrossTenant, cancellationToken);

        if (patient.DeceasedDate != null)
            return await DenyAsync(tenantId, principalUserId, PortalResolveDenialReason.Deceased, cancellationToken);

        // No ratified portal.resolve.success action — success has no mandatory audit in S1.
        return PortalPatientResolveResult.Success(patient.Id, link.Id);
    }

    private async Task<PortalPatientResolveResult> DenyAsync(
        Guid tenantId,
        Guid principalUserId,
        string reasonCode,
        CancellationToken cancellationToken)
    {
        var details = JsonSerializer.Serialize(new
        {
            tenantId,
            principalUserId,
            reasonCode
            // Never include client patientId, tokens, or demographics.
        });

        try
        {
            await _audit.StageAsync(
                principalUserId == Guid.Empty ? Guid.Empty : principalUserId,
                PortalIdentityAudit.ResolveDenied,
                PortalIdentityAudit.ResourcePortalResolve,
                resourceId: null,
                details: details);

            await _db.SaveChangesAsync(cancellationToken);
            return PortalPatientResolveResult.Denied(reasonCode, auditPersisted: true);
        }
        catch (Exception ex)
        {
            // Fail closed: never convert denial into successful resolution when audit cannot persist.
            _logger.LogWarning(ex, "Mandatory portal.resolve.denied audit failed to persist");
            return PortalPatientResolveResult.Denied(reasonCode, auditPersisted: false);
        }
    }
}
