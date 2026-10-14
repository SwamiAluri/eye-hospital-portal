using System;
using System.Linq;
using System.Security.Claims;
using System.Threading.Tasks;
using AuthService.Context;
using AuthService.Models.Domain;
using AuthService.Models.Identity;
using AuthService.Services;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging.Abstractions;
using Microsoft.Extensions.Options;
using Moq;
using Xunit;

namespace AuthService.Tests;

/// <summary>
/// L-PORTAL-01 S2 — Invitation create / supersede / accept lifecycle (domain service).
/// Staff invite HTTP is intentionally not covered (Gate A: portal.invite.create unauthorized).
/// </summary>
public class PortalInvitationLifecycleTests
{
    private static readonly Guid TenantA = Guid.Parse("aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa");
    private static readonly Guid TenantB = Guid.Parse("bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb");

    [Fact]
    public async Task Create_Succeeds_ReturnsRawToken_PersistsHashOnly()
    {
        await using var db = CreateDb(TenantA);
        var staff = await SeedStaffAsync(db, TenantA);
        var patient = await SeedPatientAsync(db, TenantA);
        var (svc, _) = CreateSut(db, TenantA);

        var result = await svc.CreateAsync(new PortalInvitationCreateCommand
        {
            TenantId = TenantA,
            PatientId = patient.Id,
            CreatedByUserId = staff.Id
        });

        Assert.True(result.Succeeded);
        Assert.False(string.IsNullOrWhiteSpace(result.RawToken));
        Assert.NotNull(result.InvitationId);

        var stored = Assert.Single(db.PortalInvitations);
        Assert.Equal(PortalInvitationService.HashToken(result.RawToken!), stored.TokenHash);
        Assert.DoesNotContain(result.RawToken!, stored.TokenHash);
        Assert.Equal(PortalInvitationStatus.Pending, stored.Status);
        Assert.Equal(PortalInvitationDeliveryChannel.StaffDeliveredToken, stored.DeliveryChannel);
        Assert.Null(stored.UsedAt);
        Assert.DoesNotContain(result.RawToken!, string.Join("|", db.AuditLogs.Select(a => a.Description)));
        Assert.Contains(db.AuditLogs, a => a.Action == PortalIdentityAudit.InviteCreated);
    }

    [Fact]
    public async Task Create_SupersedesPriorUnusedInvitation()
    {
        await using var db = CreateDb(TenantA);
        var staff = await SeedStaffAsync(db, TenantA);
        var patient = await SeedPatientAsync(db, TenantA);
        var (svc, _) = CreateSut(db, TenantA);

        var first = await svc.CreateAsync(new PortalInvitationCreateCommand
        {
            TenantId = TenantA,
            PatientId = patient.Id,
            CreatedByUserId = staff.Id
        });
        var second = await svc.CreateAsync(new PortalInvitationCreateCommand
        {
            TenantId = TenantA,
            PatientId = patient.Id,
            CreatedByUserId = staff.Id
        });

        Assert.True(first.Succeeded);
        Assert.True(second.Succeeded);
        Assert.Equal(first.InvitationId, second.SupersededInvitationId);

        var old = db.PortalInvitations.Single(i => i.Id == first.InvitationId);
        var neu = db.PortalInvitations.Single(i => i.Id == second.InvitationId);
        Assert.Equal(PortalInvitationStatus.Superseded, old.Status);
        Assert.Equal(neu.Id, old.SupersededByInvitationId);
        Assert.Equal(PortalInvitationStatus.Pending, neu.Status);
        Assert.Contains(db.AuditLogs, a => a.Action == PortalIdentityAudit.InviteSuperseded);

        var acceptOld = await svc.AcceptAsync(new PortalInvitationAcceptCommand
        {
            TenantId = TenantA,
            RawToken = first.RawToken!,
            Email = $"p_{Guid.NewGuid():N}@t.local",
            Password = "Accept1!Pass"
        });
        Assert.False(acceptOld.Succeeded);
        Assert.Equal(PortalInvitationRejectReason.Superseded, acceptOld.FailureReasonCode);
    }

    [Fact]
    public async Task Accept_ValidToken_CreatesUnverifiedLinkOnly()
    {
        await using var db = CreateDb(TenantA);
        var staff = await SeedStaffAsync(db, TenantA);
        var patient = await SeedPatientAsync(db, TenantA);
        var (svc, _) = CreateSut(db, TenantA);

        var created = await svc.CreateAsync(new PortalInvitationCreateCommand
        {
            TenantId = TenantA,
            PatientId = patient.Id,
            CreatedByUserId = staff.Id
        });

        var email = $"patient_{Guid.NewGuid():N}@t.local";
        var accept = await svc.AcceptAsync(new PortalInvitationAcceptCommand
        {
            TenantId = TenantA,
            RawToken = created.RawToken!,
            Email = email,
            Password = "Accept1!Pass"
        });

        Assert.True(accept.Succeeded);
        Assert.Equal(PortalLinkVerificationStatus.Unverified, accept.LinkVerificationStatus);
        var link = Assert.Single(db.PortalPatientLinks);
        Assert.Equal(PortalLinkVerificationStatus.Unverified, link.VerificationStatus);
        Assert.Null(link.VerifiedAt);
        Assert.Null(link.VerifiedByUserId);
        Assert.Equal(PortalInvitationStatus.Used, db.PortalInvitations.Single().Status);
        Assert.Contains(db.AuditLogs, a => a.Action == PortalIdentityAudit.LinkCreatedUnverified);

        var principal = db.Users.Single(u => u.Id == accept.PrincipalUserId);
        Assert.Equal("Patient", principal.UserType);
        Assert.Equal(email, principal.Email);
    }

    [Fact]
    public async Task Accept_Repeated_CannotConsumeTwice()
    {
        await using var db = CreateDb(TenantA);
        var staff = await SeedStaffAsync(db, TenantA);
        var patient = await SeedPatientAsync(db, TenantA);
        var (svc, _) = CreateSut(db, TenantA);
        var created = await svc.CreateAsync(new PortalInvitationCreateCommand
        {
            TenantId = TenantA,
            PatientId = patient.Id,
            CreatedByUserId = staff.Id
        });

        var first = await svc.AcceptAsync(new PortalInvitationAcceptCommand
        {
            TenantId = TenantA,
            RawToken = created.RawToken!,
            Email = $"a_{Guid.NewGuid():N}@t.local",
            Password = "Accept1!Pass"
        });
        var second = await svc.AcceptAsync(new PortalInvitationAcceptCommand
        {
            TenantId = TenantA,
            RawToken = created.RawToken!,
            Email = $"b_{Guid.NewGuid():N}@t.local",
            Password = "Accept1!Pass"
        });

        Assert.True(first.Succeeded);
        Assert.False(second.Succeeded);
        Assert.Equal(PortalInvitationRejectReason.Used, second.FailureReasonCode);
        Assert.Single(db.PortalPatientLinks);
    }

    [Theory]
    [InlineData("")]
    [InlineData("short")]
    [InlineData(null)]
    public async Task Accept_MalformedToken_Rejected(string? token)
    {
        await using var db = CreateDb(TenantA);
        var (svc, _) = CreateSut(db, TenantA);
        var result = await svc.AcceptAsync(new PortalInvitationAcceptCommand
        {
            TenantId = TenantA,
            RawToken = token!,
            Email = "x@t.local",
            Password = "Accept1!Pass"
        });
        Assert.False(result.Succeeded);
        Assert.Equal(PortalInvitationRejectReason.MalformedToken, result.FailureReasonCode);
        Assert.Empty(db.PortalInvitations);
    }

    [Fact]
    public async Task Accept_InvalidToken_Rejected()
    {
        await using var db = CreateDb(TenantA);
        var (svc, _) = CreateSut(db, TenantA);
        var result = await svc.AcceptAsync(new PortalInvitationAcceptCommand
        {
            TenantId = TenantA,
            RawToken = PortalInvitationService.GenerateRawToken(),
            Email = "x@t.local",
            Password = "Accept1!Pass"
        });
        Assert.False(result.Succeeded);
        Assert.Equal(PortalInvitationRejectReason.InvalidToken, result.FailureReasonCode);
    }

    [Fact]
    public async Task Accept_ExpiredToken_Rejected_AndMutatesExpired()
    {
        await using var db = CreateDb(TenantA);
        var staff = await SeedStaffAsync(db, TenantA);
        var patient = await SeedPatientAsync(db, TenantA);
        var (svc, _) = CreateSut(db, TenantA);
        var created = await svc.CreateAsync(new PortalInvitationCreateCommand
        {
            TenantId = TenantA,
            PatientId = patient.Id,
            CreatedByUserId = staff.Id
        });

        var invite = db.PortalInvitations.Single();
        invite.ExpiresAt = DateTime.UtcNow.AddMinutes(-5);
        await db.SaveChangesAsync();

        var accept = await svc.AcceptAsync(new PortalInvitationAcceptCommand
        {
            TenantId = TenantA,
            RawToken = created.RawToken!,
            Email = $"e_{Guid.NewGuid():N}@t.local",
            Password = "Accept1!Pass"
        });

        Assert.False(accept.Succeeded);
        Assert.Equal(PortalInvitationRejectReason.Expired, accept.FailureReasonCode);
        Assert.Equal(PortalInvitationStatus.Expired, db.PortalInvitations.Single().Status);
        Assert.Contains(db.AuditLogs, a => a.Action == PortalIdentityAudit.InviteExpiredOrRejected);
        Assert.Empty(db.PortalPatientLinks);
    }

    [Fact]
    public async Task Accept_TenantMismatch_Rejected()
    {
        await using var db = CreateDb(TenantA);
        var staff = await SeedStaffAsync(db, TenantA);
        var patient = await SeedPatientAsync(db, TenantA);
        var (svc, _) = CreateSut(db, TenantA);
        var created = await svc.CreateAsync(new PortalInvitationCreateCommand
        {
            TenantId = TenantA,
            PatientId = patient.Id,
            CreatedByUserId = staff.Id
        });

        var accept = await svc.AcceptAsync(new PortalInvitationAcceptCommand
        {
            TenantId = TenantB,
            RawToken = created.RawToken!,
            Email = $"x_{Guid.NewGuid():N}@t.local",
            Password = "Accept1!Pass"
        });

        Assert.False(accept.Succeeded);
        Assert.Equal(PortalInvitationRejectReason.TenantMismatch, accept.FailureReasonCode);
        Assert.Equal(PortalInvitationStatus.Pending, db.PortalInvitations.Single().Status);
        Assert.Empty(db.PortalPatientLinks);
    }

    [Fact]
    public async Task Create_CrossTenantPatient_FailsClosed()
    {
        await using var db = CreateDb(TenantA);
        var staff = await SeedStaffAsync(db, TenantA);
        var foreignPatient = await SeedPatientAsync(db, TenantB);
        var (svc, _) = CreateSut(db, TenantA);

        var result = await svc.CreateAsync(new PortalInvitationCreateCommand
        {
            TenantId = TenantA,
            PatientId = foreignPatient.Id,
            CreatedByUserId = staff.Id
        });

        Assert.False(result.Succeeded);
        Assert.Equal(PortalInvitationRejectReason.TenantMismatch, result.FailureReasonCode);
        Assert.Empty(db.PortalInvitations);
    }

    [Fact]
    public async Task Create_MissingPatient_FailsClosed()
    {
        await using var db = CreateDb(TenantA);
        var staff = await SeedStaffAsync(db, TenantA);
        var (svc, _) = CreateSut(db, TenantA);

        var result = await svc.CreateAsync(new PortalInvitationCreateCommand
        {
            TenantId = TenantA,
            PatientId = Guid.NewGuid(),
            CreatedByUserId = staff.Id
        });

        Assert.False(result.Succeeded);
        Assert.Equal(PortalInvitationRejectReason.InvalidPatient, result.FailureReasonCode);
    }

    [Fact]
    public async Task Create_DeceasedPatient_FailsClosed()
    {
        await using var db = CreateDb(TenantA);
        var staff = await SeedStaffAsync(db, TenantA);
        var patient = await SeedPatientAsync(db, TenantA, deceased: true);
        var (svc, _) = CreateSut(db, TenantA);

        var result = await svc.CreateAsync(new PortalInvitationCreateCommand
        {
            TenantId = TenantA,
            PatientId = patient.Id,
            CreatedByUserId = staff.Id
        });

        Assert.False(result.Succeeded);
        Assert.Equal(PortalInvitationRejectReason.InvalidPatient, result.FailureReasonCode);
    }

    [Fact]
    public async Task Create_MandatoryAuditFailure_RollsBackInvitation()
    {
        await using var db = CreateDb(TenantA);
        var staff = await SeedStaffAsync(db, TenantA);
        var patient = await SeedPatientAsync(db, TenantA);

        var audit = new Mock<IAuditService>();
        audit.Setup(a => a.StageAsync(
                It.IsAny<Guid>(),
                PortalIdentityAudit.InviteCreated,
                It.IsAny<string>(),
                It.IsAny<Guid?>(),
                It.IsAny<string?>(),
                It.IsAny<string?>(),
                It.IsAny<string?>()))
            .ThrowsAsync(new InvalidOperationException("audit infra down"));

        var svc = new PortalInvitationService(
            db,
            audit.Object,
            new PasswordHasher<AppUser>(),
            Options.Create(ValidOptions()),
            NullLogger<PortalInvitationService>.Instance);

        await Assert.ThrowsAsync<InvalidOperationException>(() => svc.CreateAsync(new PortalInvitationCreateCommand
        {
            TenantId = TenantA,
            PatientId = patient.Id,
            CreatedByUserId = staff.Id
        }));

        db.ChangeTracker.Clear();
        Assert.Empty(db.PortalInvitations.ToList());
        Assert.DoesNotContain(db.AuditLogs, a => a.Action == PortalIdentityAudit.InviteCreated);
    }

    [Fact]
    public async Task Accept_MandatoryAuditFailure_RollsBackLinkAndInviteUse()
    {
        await using var db = CreateDb(TenantA);
        var staff = await SeedStaffAsync(db, TenantA);
        var patient = await SeedPatientAsync(db, TenantA);
        var (createSvc, _) = CreateSut(db, TenantA);
        var created = await createSvc.CreateAsync(new PortalInvitationCreateCommand
        {
            TenantId = TenantA,
            PatientId = patient.Id,
            CreatedByUserId = staff.Id
        });

        var audit = new Mock<IAuditService>();
        audit.Setup(a => a.StageAsync(
                It.IsAny<Guid>(),
                PortalIdentityAudit.LinkCreatedUnverified,
                It.IsAny<string>(),
                It.IsAny<Guid?>(),
                It.IsAny<string?>(),
                It.IsAny<string?>(),
                It.IsAny<string?>()))
            .ThrowsAsync(new InvalidOperationException("audit infra down"));

        var acceptSvc = new PortalInvitationService(
            db,
            audit.Object,
            new PasswordHasher<AppUser>(),
            Options.Create(ValidOptions()),
            NullLogger<PortalInvitationService>.Instance);

        await Assert.ThrowsAsync<InvalidOperationException>(() => acceptSvc.AcceptAsync(new PortalInvitationAcceptCommand
        {
            TenantId = TenantA,
            RawToken = created.RawToken!,
            Email = $"r_{Guid.NewGuid():N}@t.local",
            Password = "Accept1!Pass"
        }));

        // InMemory has no ambient transaction; StageAsync threw before SaveChanges — no link persisted.
        db.ChangeTracker.Clear();
        Assert.Empty(db.PortalPatientLinks.ToList());
        Assert.DoesNotContain(db.AuditLogs, a => a.Action == PortalIdentityAudit.LinkCreatedUnverified);
        Assert.Equal(PortalInvitationStatus.Pending, db.PortalInvitations.Single().Status);
        Assert.Null(db.PortalInvitations.Single().UsedAt);
    }

    [Fact]
    public async Task AuditPayloads_NeverContainRawTokenOrPassword()
    {
        await using var db = CreateDb(TenantA);
        var staff = await SeedStaffAsync(db, TenantA);
        var patient = await SeedPatientAsync(db, TenantA);
        var (svc, _) = CreateSut(db, TenantA);
        var created = await svc.CreateAsync(new PortalInvitationCreateCommand
        {
            TenantId = TenantA,
            PatientId = patient.Id,
            CreatedByUserId = staff.Id
        });
        var password = "Accept1!SecretToken";
        await svc.AcceptAsync(new PortalInvitationAcceptCommand
        {
            TenantId = TenantA,
            RawToken = created.RawToken!,
            Email = $"s_{Guid.NewGuid():N}@t.local",
            Password = password
        });

        foreach (var log in db.AuditLogs)
        {
            var blob = $"{log.Description}|{log.OldValues}|{log.NewValues}";
            Assert.DoesNotContain(created.RawToken!, blob);
            Assert.DoesNotContain(password, blob);
            Assert.DoesNotContain("Accept1!", blob);
        }
    }

    [Fact]
    public async Task Create_ExpiryOutsidePolicy_FailsClosed()
    {
        await using var db = CreateDb(TenantA);
        var staff = await SeedStaffAsync(db, TenantA);
        var patient = await SeedPatientAsync(db, TenantA);
        var (svc, _) = CreateSut(db, TenantA);

        var result = await svc.CreateAsync(new PortalInvitationCreateCommand
        {
            TenantId = TenantA,
            PatientId = patient.Id,
            CreatedByUserId = staff.Id,
            ExpiryHours = 96
        });

        Assert.False(result.Succeeded);
        Assert.Equal(PortalInvitationRejectReason.PolicyInvalid, result.FailureReasonCode);
    }

    [Fact]
    public async Task ConcurrentCreate_Sequential_PreservesSinglePending()
    {
        await using var db = CreateDb(TenantA);
        var staff = await SeedStaffAsync(db, TenantA);
        var patient = await SeedPatientAsync(db, TenantA);
        var (svc, _) = CreateSut(db, TenantA);

        var a = await svc.CreateAsync(new PortalInvitationCreateCommand
        {
            TenantId = TenantA,
            PatientId = patient.Id,
            CreatedByUserId = staff.Id
        });
        var b = await svc.CreateAsync(new PortalInvitationCreateCommand
        {
            TenantId = TenantA,
            PatientId = patient.Id,
            CreatedByUserId = staff.Id
        });
        var c = await svc.CreateAsync(new PortalInvitationCreateCommand
        {
            TenantId = TenantA,
            PatientId = patient.Id,
            CreatedByUserId = staff.Id
        });

        Assert.True(a.Succeeded && b.Succeeded && c.Succeeded);
        Assert.Equal(1, db.PortalInvitations.Count(i => i.Status == PortalInvitationStatus.Pending));
        Assert.Equal(2, db.PortalInvitations.Count(i => i.Status == PortalInvitationStatus.Superseded));
        Assert.Equal(c.InvitationId, db.PortalInvitations.Single(i => i.Status == PortalInvitationStatus.Pending).Id);
    }

    private static (PortalInvitationService Svc, AuditService Audit) CreateSut(AppDbContext db, Guid tenantId)
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
        var svc = new PortalInvitationService(
            db,
            audit,
            new PasswordHasher<AppUser>(),
            Options.Create(ValidOptions()),
            NullLogger<PortalInvitationService>.Instance);
        return (svc, audit);
    }

    private static PortalInvitationOptions ValidOptions() => new()
    {
        DefaultExpiryHours = 24,
        MinExpiryHours = 1,
        MaxExpiryHours = 72,
        EnabledDeliveryChannels = new System.Collections.Generic.List<string>
        {
            PortalInvitationDeliveryChannel.StaffDeliveredToken
        }
    };

    private static AppDbContext CreateDb(Guid tenantId)
    {
        var options = new DbContextOptionsBuilder<AppDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString("N"))
            .Options;
        var http = new DefaultHttpContext();
        http.Items["TenantId"] = tenantId;
        return new AppDbContext(options, new HttpContextAccessor { HttpContext = http });
    }

    private static async Task<AppUser> SeedStaffAsync(AppDbContext db, Guid tenantId)
    {
        var id = Guid.NewGuid();
        var user = new AppUser
        {
            Id = id,
            TenantId = tenantId,
            UserName = $"staff_{id:N}@t.local",
            NormalizedUserName = $"STAFF_{id:N}@T.LOCAL",
            Email = $"staff_{id:N}@t.local",
            NormalizedEmail = $"STAFF_{id:N}@T.LOCAL",
            UserType = "Staff",
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
}
