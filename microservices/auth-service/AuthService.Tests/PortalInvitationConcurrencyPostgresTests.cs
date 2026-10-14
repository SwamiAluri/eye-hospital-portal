using System;
using System.Linq;
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
using Xunit;
using Xunit.Abstractions;

namespace AuthService.Tests;

/// <summary>
/// L-PORTAL-01 S2 — PostgreSQL concurrency for invitation accept.
/// Requires AUTHSERVICE_TEST_CONNECTION or ConnectionStrings__DefaultConnection.
/// When unset, the test body records SKIPPED and returns (do not treat as a concurrency pass).
/// </summary>
public class PortalInvitationConcurrencyPostgresTests : IAsyncLifetime
{
    private static readonly string? Conn =
        Environment.GetEnvironmentVariable("AUTHSERVICE_TEST_CONNECTION")
        ?? Environment.GetEnvironmentVariable("ConnectionStrings__DefaultConnection");

    private readonly ITestOutputHelper _out;
    private AppDbContext? _db;
    private bool _ready;
    private Guid _tenant;
    private Guid _staff;
    private Guid _patient;

    public PortalInvitationConcurrencyPostgresTests(ITestOutputHelper output) => _out = output;

    public async Task InitializeAsync()
    {
        if (string.IsNullOrWhiteSpace(Conn))
        {
            _out.WriteLine("SKIPPED: no database connection configured.");
            return;
        }

        _tenant = Guid.NewGuid();
        _staff = Guid.NewGuid();
        _patient = Guid.NewGuid();

        var options = new DbContextOptionsBuilder<AppDbContext>()
            .UseNpgsql(Conn)
            .Options;
        var http = new DefaultHttpContext();
        http.Items["TenantId"] = _tenant;
        _db = new AppDbContext(options, new HttpContextAccessor { HttpContext = http });
        await _db.Database.OpenConnectionAsync();
        await _db.Database.ExecuteSqlRawAsync($"SELECT set_config('app.tenant_id', '{_tenant}', false)");

        await _db.Database.ExecuteSqlRawAsync("""
            CREATE TABLE IF NOT EXISTS portal_invitations (
                id uuid NOT NULL PRIMARY KEY,
                tenant_id uuid NOT NULL,
                patient_id uuid NOT NULL,
                delivery_channel character varying(50) NOT NULL,
                token_hash character varying(128) NOT NULL,
                expires_at timestamp with time zone NOT NULL,
                used_at timestamp with time zone,
                superseded_at timestamp with time zone,
                superseded_by_invitation_id uuid,
                created_by_user_id uuid NOT NULL,
                created_at timestamp with time zone NOT NULL,
                status character varying(30) NOT NULL
            );
            CREATE INDEX IF NOT EXISTS ix_portal_invitations_token_hash ON portal_invitations (token_hash);
            CREATE TABLE IF NOT EXISTS portal_patient_links (
                id uuid NOT NULL PRIMARY KEY,
                tenant_id uuid NOT NULL,
                principal_user_id uuid NOT NULL,
                patient_id uuid NOT NULL,
                verification_status character varying(30) NOT NULL,
                verification_method_code character varying(100),
                verified_at timestamp with time zone,
                verified_by_user_id uuid,
                revoked_at timestamp with time zone,
                revoked_reason character varying(500),
                created_at timestamp with time zone NOT NULL
            );
            """);

        _db.Users.Add(new AppUser
        {
            Id = _staff,
            TenantId = _tenant,
            UserName = $"staff_{_staff:N}@t.local",
            NormalizedUserName = $"STAFF_{_staff:N}@T.LOCAL",
            Email = $"staff_{_staff:N}@t.local",
            NormalizedEmail = $"STAFF_{_staff:N}@T.LOCAL",
            UserType = "Staff",
            UserStatus = "active",
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow
        });
        _db.Patients.Add(new Patient
        {
            Id = _patient,
            TenantId = _tenant,
            MedicalRecordNumber = $"MRN{_patient:N}"[..20],
            FirstName = "Conc",
            LastName = "Patient",
            DateOfBirth = new DateTime(1990, 1, 1),
            Gender = "Unknown",
            Status = "Active",
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow
        });
        await _db.SaveChangesAsync();
        _ready = true;
    }

    public async Task DisposeAsync()
    {
        if (_db == null || !_ready) return;
        try
        {
            var principalIds = await _db.PortalPatientLinks
                .Where(l => l.TenantId == _tenant)
                .Select(l => l.PrincipalUserId)
                .ToListAsync();

            await _db.Database.ExecuteSqlRawAsync(
                "DELETE FROM portal_patient_links WHERE tenant_id = {0}", _tenant);
            await _db.Database.ExecuteSqlRawAsync(
                "DELETE FROM portal_invitations WHERE tenant_id = {0}", _tenant);
            foreach (var pid in principalIds.Append(_staff).Distinct())
            {
                await _db.Database.ExecuteSqlRawAsync(
                    "DELETE FROM \"AspNetUsers\" WHERE \"Id\" = {0}", pid);
            }

            await _db.Database.ExecuteSqlRawAsync(
                "DELETE FROM patients WHERE id = {0}", _patient);
        }
        catch (Exception ex)
        {
            _out.WriteLine($"Cleanup warning: {ex.Message}");
        }

        await _db.DisposeAsync();
    }

    [Fact]
    public async Task ConcurrentAccept_OnlyOneSucceeds()
    {
        if (!_ready)
        {
            // Not a concurrency pass. xUnit records this Fact as Passed on early return;
            // evidence reports must label it SKIPPED when AUTHSERVICE_TEST_CONNECTION is unset.
            _out.WriteLine("RESULT=SKIPPED reason=no_database_connection");
            return;
        }

        var createSvc = CreateSvc(_db!, _tenant);
        var created = await createSvc.CreateAsync(new PortalInvitationCreateCommand
        {
            TenantId = _tenant,
            PatientId = _patient,
            CreatedByUserId = _staff
        });
        Assert.True(created.Succeeded);

        async Task<PortalInvitationAcceptResult> AcceptOnce(string email)
        {
            var options = new DbContextOptionsBuilder<AppDbContext>().UseNpgsql(Conn).Options;
            var http = new DefaultHttpContext();
            http.Items["TenantId"] = _tenant;
            await using var db = new AppDbContext(options, new HttpContextAccessor { HttpContext = http });
            await db.Database.OpenConnectionAsync();
            await db.Database.ExecuteSqlRawAsync($"SELECT set_config('app.tenant_id', '{_tenant}', false)");
            var svc = CreateSvc(db, _tenant);
            return await svc.AcceptAsync(new PortalInvitationAcceptCommand
            {
                TenantId = _tenant,
                RawToken = created.RawToken!,
                Email = email,
                Password = "Accept1!Pass"
            });
        }

        var results = await Task.WhenAll(
            AcceptOnce($"c1_{Guid.NewGuid():N}@t.local"),
            AcceptOnce($"c2_{Guid.NewGuid():N}@t.local"));

        Assert.Equal(1, results.Count(r => r.Succeeded));
        Assert.Equal(1, results.Count(r => !r.Succeeded));

        _db!.ChangeTracker.Clear();
        var invite = await _db.PortalInvitations.SingleAsync(i => i.Id == created.InvitationId);
        Assert.Equal(PortalInvitationStatus.Used, invite.Status);
        Assert.Equal(1, await _db.PortalPatientLinks.CountAsync(l =>
            l.TenantId == _tenant && l.PatientId == _patient));
        _out.WriteLine("RESULT=PASSED ConcurrentAccept_OnlyOneSucceeds");
    }

    private static PortalInvitationService CreateSvc(AppDbContext db, Guid tenantId)
    {
        var http = new DefaultHttpContext();
        http.Items["TenantId"] = tenantId;
        var accessor = new HttpContextAccessor { HttpContext = http };
        return new PortalInvitationService(
            db,
            new AuditService(db, accessor),
            new PasswordHasher<AppUser>(),
            Options.Create(new PortalInvitationOptions()),
            NullLogger<PortalInvitationService>.Instance);
    }
}
