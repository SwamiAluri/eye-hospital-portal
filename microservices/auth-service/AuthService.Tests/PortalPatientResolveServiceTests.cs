using System;
using System.Linq;
using System.Security.Claims;
using System.Threading.Tasks;
using AuthService.Context;
using AuthService.Models.Domain;
using AuthService.Models.Identity;
using AuthService.Services;
using Microsoft.AspNetCore.Http;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging.Abstractions;
using Moq;
using Xunit;

namespace AuthService.Tests;

/// <summary>
/// L-PORTAL-01 S1 — fail-closed Portal patient resolution + mandatory denial audit.
/// Uses InMemory for resolve logic; filtered unique indexes are covered separately (Postgres).
/// </summary>
public class PortalPatientResolveServiceTests
{
    private static readonly Guid TenantA = Guid.Parse("aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa");
    private static readonly Guid TenantB = Guid.Parse("bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb");

    [Fact]
    public async Task Resolve_NoActiveVerifiedLink_Denied_WithAudit()
    {
        await using var db = CreateDb(TenantA);
        var principal = await SeedPrincipalAsync(db, TenantA);
        var patient = await SeedPatientAsync(db, TenantA);
        db.PortalPatientLinks.Add(Link(TenantA, principal.Id, patient.Id, PortalLinkVerificationStatus.Unverified));
        await db.SaveChangesAsync();

        var (svc, _) = CreateSut(db, TenantA);
        var result = await svc.ResolveAsync(TenantA, principal.Id);

        Assert.False(result.Succeeded);
        Assert.Null(result.PatientId);
        Assert.Equal(PortalResolveDenialReason.Unverified, result.DenialReasonCode);
        Assert.True(result.DenialAuditPersisted);
        Assert.Contains(db.AuditLogs, a => a.Action == PortalIdentityAudit.ResolveDenied);
    }

    [Fact]
    public async Task Resolve_ExactlyOneActiveVerifiedLink_Succeeds()
    {
        await using var db = CreateDb(TenantA);
        var principal = await SeedPrincipalAsync(db, TenantA);
        var patient = await SeedPatientAsync(db, TenantA);
        // Historical rows allowed
        db.PortalPatientLinks.Add(Link(TenantA, principal.Id, patient.Id, PortalLinkVerificationStatus.Unverified));
        db.PortalPatientLinks.Add(Link(TenantA, principal.Id, patient.Id, PortalLinkVerificationStatus.Revoked, revokedAt: DateTime.UtcNow.AddDays(-1)));
        var active = Link(TenantA, principal.Id, patient.Id, PortalLinkVerificationStatus.Verified, verifiedAt: DateTime.UtcNow);
        db.PortalPatientLinks.Add(active);
        await db.SaveChangesAsync();

        var (svc, _) = CreateSut(db, TenantA);
        var result = await svc.ResolveAsync(TenantA, principal.Id, clientSuppliedPatientId: Guid.NewGuid());

        Assert.True(result.Succeeded);
        Assert.Equal(patient.Id, result.PatientId);
        Assert.Equal(active.Id, result.LinkId);
    }

    [Fact]
    public async Task Resolve_MultipleActiveVerifiedForPrincipal_DeniedAmbiguous()
    {
        await using var db = CreateDb(TenantA);
        var principal = await SeedPrincipalAsync(db, TenantA);
        var p1 = await SeedPatientAsync(db, TenantA);
        var p2 = await SeedPatientAsync(db, TenantA);
        db.PortalPatientLinks.Add(Link(TenantA, principal.Id, p1.Id, PortalLinkVerificationStatus.Verified, verifiedAt: DateTime.UtcNow));
        db.PortalPatientLinks.Add(Link(TenantA, principal.Id, p2.Id, PortalLinkVerificationStatus.Verified, verifiedAt: DateTime.UtcNow));
        await db.SaveChangesAsync();

        var (svc, _) = CreateSut(db, TenantA);
        var result = await svc.ResolveAsync(TenantA, principal.Id);

        Assert.False(result.Succeeded);
        Assert.Equal(PortalResolveDenialReason.Ambiguous, result.DenialReasonCode);
        Assert.True(result.DenialAuditPersisted);
    }

    [Fact]
    public async Task Resolve_PatientHasMultipleActiveVerifiedPrincipals_DeniedAmbiguous()
    {
        await using var db = CreateDb(TenantA);
        var principal = await SeedPrincipalAsync(db, TenantA);
        var other = await SeedPrincipalAsync(db, TenantA);
        var patient = await SeedPatientAsync(db, TenantA);
        db.PortalPatientLinks.Add(Link(TenantA, principal.Id, patient.Id, PortalLinkVerificationStatus.Verified, verifiedAt: DateTime.UtcNow));
        db.PortalPatientLinks.Add(Link(TenantA, other.Id, patient.Id, PortalLinkVerificationStatus.Verified, verifiedAt: DateTime.UtcNow));
        await db.SaveChangesAsync();

        var (svc, _) = CreateSut(db, TenantA);
        var result = await svc.ResolveAsync(TenantA, principal.Id);

        Assert.False(result.Succeeded);
        Assert.Equal(PortalResolveDenialReason.Ambiguous, result.DenialReasonCode);
    }

    [Fact]
    public async Task Resolve_HistoricalUnverifiedAndRevoked_DoNotBlockSingleVerified()
    {
        await using var db = CreateDb(TenantA);
        var principal = await SeedPrincipalAsync(db, TenantA);
        var patient = await SeedPatientAsync(db, TenantA);
        for (var i = 0; i < 3; i++)
            db.PortalPatientLinks.Add(Link(TenantA, principal.Id, patient.Id, PortalLinkVerificationStatus.Unverified));
        db.PortalPatientLinks.Add(Link(TenantA, principal.Id, patient.Id, PortalLinkVerificationStatus.Revoked, revokedAt: DateTime.UtcNow));
        var active = Link(TenantA, principal.Id, patient.Id, PortalLinkVerificationStatus.Verified, verifiedAt: DateTime.UtcNow);
        db.PortalPatientLinks.Add(active);
        await db.SaveChangesAsync();

        var (svc, _) = CreateSut(db, TenantA);
        var result = await svc.ResolveAsync(TenantA, principal.Id);

        Assert.True(result.Succeeded);
        Assert.Equal(patient.Id, result.PatientId);
    }

    [Fact]
    public async Task Resolve_CrossTenantPrincipal_Denied()
    {
        await using var db = CreateDb(TenantA);
        var principal = await SeedPrincipalAsync(db, TenantB);
        var patient = await SeedPatientAsync(db, TenantA);
        db.PortalPatientLinks.Add(Link(TenantA, principal.Id, patient.Id, PortalLinkVerificationStatus.Verified, verifiedAt: DateTime.UtcNow));
        await db.SaveChangesAsync();

        var (svc, _) = CreateSut(db, TenantA);
        var result = await svc.ResolveAsync(TenantA, principal.Id);

        Assert.False(result.Succeeded);
        Assert.Equal(PortalResolveDenialReason.CrossTenant, result.DenialReasonCode);
    }

    [Fact]
    public async Task Resolve_CrossTenantPatient_Denied()
    {
        await using var db = CreateDb(TenantA);
        var principal = await SeedPrincipalAsync(db, TenantA);
        var patient = await SeedPatientAsync(db, TenantB);
        db.PortalPatientLinks.Add(Link(TenantA, principal.Id, patient.Id, PortalLinkVerificationStatus.Verified, verifiedAt: DateTime.UtcNow));
        await db.SaveChangesAsync();

        var (svc, _) = CreateSut(db, TenantA);
        var result = await svc.ResolveAsync(TenantA, principal.Id);

        Assert.False(result.Succeeded);
        Assert.Equal(PortalResolveDenialReason.CrossTenant, result.DenialReasonCode);
    }

    [Fact]
    public async Task Resolve_MissingPrincipal_Denied()
    {
        await using var db = CreateDb(TenantA);
        var (svc, _) = CreateSut(db, TenantA);
        var result = await svc.ResolveAsync(TenantA, Guid.NewGuid());

        Assert.False(result.Succeeded);
        Assert.Equal(PortalResolveDenialReason.MissingPrincipal, result.DenialReasonCode);
        Assert.True(result.DenialAuditPersisted);
    }

    [Fact]
    public async Task Resolve_StaffUserType_Denied()
    {
        await using var db = CreateDb(TenantA);
        var staff = await SeedPrincipalAsync(db, TenantA, userType: "Staff");
        var patient = await SeedPatientAsync(db, TenantA);
        db.PortalPatientLinks.Add(Link(TenantA, staff.Id, patient.Id, PortalLinkVerificationStatus.Verified, verifiedAt: DateTime.UtcNow));
        await db.SaveChangesAsync();

        var (svc, _) = CreateSut(db, TenantA);
        var result = await svc.ResolveAsync(TenantA, staff.Id);

        Assert.False(result.Succeeded);
        Assert.Equal(PortalResolveDenialReason.InvalidPrincipal, result.DenialReasonCode);
    }

    [Fact]
    public async Task Resolve_MissingPatient_Denied()
    {
        await using var db = CreateDb(TenantA);
        var principal = await SeedPrincipalAsync(db, TenantA);
        db.PortalPatientLinks.Add(Link(TenantA, principal.Id, Guid.NewGuid(), PortalLinkVerificationStatus.Verified, verifiedAt: DateTime.UtcNow));
        await db.SaveChangesAsync();

        var (svc, _) = CreateSut(db, TenantA);
        var result = await svc.ResolveAsync(TenantA, principal.Id);

        Assert.False(result.Succeeded);
        Assert.Equal(PortalResolveDenialReason.MissingPatient, result.DenialReasonCode);
    }

    [Fact]
    public async Task Resolve_DeceasedPatient_Denied()
    {
        await using var db = CreateDb(TenantA);
        var principal = await SeedPrincipalAsync(db, TenantA);
        var patient = await SeedPatientAsync(db, TenantA, deceased: true);
        db.PortalPatientLinks.Add(Link(TenantA, principal.Id, patient.Id, PortalLinkVerificationStatus.Verified, verifiedAt: DateTime.UtcNow));
        await db.SaveChangesAsync();

        var (svc, _) = CreateSut(db, TenantA);
        var result = await svc.ResolveAsync(TenantA, principal.Id);

        Assert.False(result.Succeeded);
        Assert.Equal(PortalResolveDenialReason.Deceased, result.DenialReasonCode);
        Assert.True(result.DenialAuditPersisted);
    }

    [Fact]
    public async Task Resolve_SoftDeletedPatient_Denied()
    {
        await using var db = CreateDb(TenantA);
        var principal = await SeedPrincipalAsync(db, TenantA);
        var patient = await SeedPatientAsync(db, TenantA);
        patient.DeletedAt = DateTime.UtcNow;
        db.PortalPatientLinks.Add(Link(TenantA, principal.Id, patient.Id, PortalLinkVerificationStatus.Verified, verifiedAt: DateTime.UtcNow));
        await db.SaveChangesAsync();

        var (svc, _) = CreateSut(db, TenantA);
        var result = await svc.ResolveAsync(TenantA, principal.Id);

        Assert.False(result.Succeeded);
        Assert.Equal(PortalResolveDenialReason.InvalidPatient, result.DenialReasonCode);
    }

    [Fact]
    public async Task Resolve_VerifiedButRevokedAtSet_TreatedAsNotActive()
    {
        await using var db = CreateDb(TenantA);
        var principal = await SeedPrincipalAsync(db, TenantA);
        var patient = await SeedPatientAsync(db, TenantA);
        db.PortalPatientLinks.Add(Link(
            TenantA, principal.Id, patient.Id,
            PortalLinkVerificationStatus.Verified,
            verifiedAt: DateTime.UtcNow.AddDays(-2),
            revokedAt: DateTime.UtcNow.AddDays(-1)));
        await db.SaveChangesAsync();

        var (svc, _) = CreateSut(db, TenantA);
        var result = await svc.ResolveAsync(TenantA, principal.Id);

        Assert.False(result.Succeeded);
        Assert.Equal(PortalResolveDenialReason.Revoked, result.DenialReasonCode);
    }

    [Fact]
    public async Task Resolve_DenialAuditPersistenceFailure_StillDenied_NotSuccess()
    {
        await using var db = CreateDb(TenantA);
        var principal = await SeedPrincipalAsync(db, TenantA);
        await db.SaveChangesAsync();

        var audit = new Mock<IAuditService>();
        audit.Setup(a => a.StageAsync(
                It.IsAny<Guid>(),
                It.IsAny<string>(),
                It.IsAny<string>(),
                It.IsAny<Guid?>(),
                It.IsAny<string?>(),
                It.IsAny<string?>(),
                It.IsAny<string?>()))
            .ThrowsAsync(new InvalidOperationException("audit infra down"));

        var svc = new PortalPatientResolveService(db, audit.Object, NullLogger<PortalPatientResolveService>.Instance);
        var result = await svc.ResolveAsync(TenantA, principal.Id);

        Assert.False(result.Succeeded);
        Assert.Null(result.PatientId);
        Assert.False(result.DenialAuditPersisted);
        Assert.Equal(PortalResolveDenialReason.Missing, result.DenialReasonCode);
    }

    [Fact]
    public async Task Resolve_ClientSuppliedPatientId_IgnoredOnSuccess()
    {
        await using var db = CreateDb(TenantA);
        var principal = await SeedPrincipalAsync(db, TenantA);
        var linked = await SeedPatientAsync(db, TenantA);
        var other = await SeedPatientAsync(db, TenantA);
        db.PortalPatientLinks.Add(Link(TenantA, principal.Id, linked.Id, PortalLinkVerificationStatus.Verified, verifiedAt: DateTime.UtcNow));
        await db.SaveChangesAsync();

        var (svc, _) = CreateSut(db, TenantA);
        var result = await svc.ResolveAsync(TenantA, principal.Id, clientSuppliedPatientId: other.Id);

        Assert.True(result.Succeeded);
        Assert.Equal(linked.Id, result.PatientId);
        Assert.NotEqual(other.Id, result.PatientId!.Value);
    }

    [Fact]
    public async Task Resolve_DenialAudit_DoesNotContainSecretsOrClientPatientId()
    {
        await using var db = CreateDb(TenantA);
        var principal = await SeedPrincipalAsync(db, TenantA);
        await db.SaveChangesAsync();

        var clientId = Guid.NewGuid();
        var (svc, _) = CreateSut(db, TenantA);
        await svc.ResolveAsync(TenantA, principal.Id, clientSuppliedPatientId: clientId);

        var audit = Assert.Single(db.AuditLogs.Where(a => a.Action == PortalIdentityAudit.ResolveDenied));
        Assert.DoesNotContain(clientId.ToString(), audit.Description ?? "", StringComparison.OrdinalIgnoreCase);
        Assert.DoesNotContain("password", audit.Description ?? "", StringComparison.OrdinalIgnoreCase);
        Assert.DoesNotContain("token", audit.Description ?? "", StringComparison.OrdinalIgnoreCase);
        Assert.Equal(PortalIdentityAudit.ResourcePortalResolve, audit.ResourceType);
        Assert.Equal(PortalIdentityAudit.RetentionDays, audit.RetentionDays);
    }

    [Fact]
    public async Task Persistence_InvitationStoresTokenHashOnly_AndRemediationRowAllowed()
    {
        await using var db = CreateDb(TenantA);
        var patient = await SeedPatientAsync(db, TenantA);
        var staff = await SeedPrincipalAsync(db, TenantA, userType: "Staff");
        var invite = new PortalInvitation
        {
            Id = Guid.NewGuid(),
            TenantId = TenantA,
            PatientId = patient.Id,
            DeliveryChannel = "staff_delivered_token",
            TokenHash = "abc123hashonly",
            ExpiresAt = DateTime.UtcNow.AddHours(24),
            CreatedByUserId = staff.Id,
            CreatedAt = DateTime.UtcNow,
            Status = PortalInvitationStatus.Pending
        };
        db.PortalInvitations.Add(invite);
        var link = Link(TenantA, (await SeedPrincipalAsync(db, TenantA)).Id, patient.Id, PortalLinkVerificationStatus.Unverified);
        db.PortalPatientLinks.Add(link);
        db.PortalRemediationRequests.Add(new PortalRemediationRequest
        {
            Id = Guid.NewGuid(),
            TenantId = TenantA,
            LinkId = link.Id,
            RequestedByUserId = staff.Id,
            Operation = "revoke",
            Reason = "test foundation row",
            Status = PortalRemediationStatus.Pending,
            CreatedAt = DateTime.UtcNow
        });
        await db.SaveChangesAsync();

        var stored = Assert.Single(db.PortalInvitations);
        Assert.Equal("abc123hashonly", stored.TokenHash);
        Assert.DoesNotContain("raw", stored.TokenHash);
        Assert.Single(db.PortalRemediationRequests);
    }

    private static (PortalPatientResolveService Svc, AuditService Audit) CreateSut(AppDbContext db, Guid tenantId)
    {
        var http = new DefaultHttpContext();
        http.Items["TenantId"] = tenantId;
        http.User = new ClaimsPrincipal(new ClaimsIdentity(new[]
        {
            new Claim("sub", Guid.Empty.ToString()),
            new Claim("tenant_id", tenantId.ToString())
        }, "test"));
        var accessor = new HttpContextAccessor { HttpContext = http };
        var audit = new AuditService(db, accessor);
        var svc = new PortalPatientResolveService(db, audit, NullLogger<PortalPatientResolveService>.Instance);
        return (svc, audit);
    }

    private static AppDbContext CreateDb(Guid tenantId)
    {
        var options = new DbContextOptionsBuilder<AppDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString("N"))
            .Options;
        var http = new DefaultHttpContext();
        http.Items["TenantId"] = tenantId;
        return new AppDbContext(options, new HttpContextAccessor { HttpContext = http });
    }

    private static async Task<AppUser> SeedPrincipalAsync(AppDbContext db, Guid tenantId, string userType = "Patient")
    {
        var id = Guid.NewGuid();
        var user = new AppUser
        {
            Id = id,
            TenantId = tenantId,
            UserName = $"{userType.ToLowerInvariant()}_{id:N}@t.local",
            NormalizedUserName = $"{userType.ToUpperInvariant()}_{id:N}@T.LOCAL",
            Email = $"{userType.ToLowerInvariant()}_{id:N}@t.local",
            NormalizedEmail = $"{userType.ToUpperInvariant()}_{id:N}@T.LOCAL",
            UserType = userType,
            UserStatus = "active",
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow
        };
        db.Users.Add(user);
        await db.SaveChangesAsync();
        return user;
    }

    private static async Task<Patient> SeedPatientAsync(AppDbContext db, Guid tenantId, bool deceased = false)
    {
        var id = Guid.NewGuid();
        var patient = new Patient
        {
            Id = id,
            TenantId = tenantId,
            MedicalRecordNumber = $"MRN{id:N}"[..20],
            FirstName = "Test",
            LastName = "Patient",
            DateOfBirth = new DateTime(1990, 1, 1),
            Gender = "Unknown",
            Status = "Active",
            DeceasedDate = deceased ? DateTime.UtcNow.AddDays(-1) : null,
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow
        };
        db.Patients.Add(patient);
        await db.SaveChangesAsync();
        return patient;
    }

    private static PortalPatientLink Link(
        Guid tenantId,
        Guid principalUserId,
        Guid patientId,
        string status,
        DateTime? verifiedAt = null,
        DateTime? revokedAt = null) => new()
    {
        Id = Guid.NewGuid(),
        TenantId = tenantId,
        PrincipalUserId = principalUserId,
        PatientId = patientId,
        VerificationStatus = status,
        VerifiedAt = verifiedAt,
        RevokedAt = revokedAt,
        CreatedAt = DateTime.UtcNow
    };
}
