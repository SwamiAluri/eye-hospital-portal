using System;
using System.Threading.Tasks;
using AuthService.Context;
using AuthService.Models.Domain;
using AuthService.Models.Identity;
using Microsoft.AspNetCore.Http;
using Microsoft.EntityFrameworkCore;
using Npgsql;
using Xunit;

namespace AuthService.Tests;

/// <summary>
/// L-PORTAL-01 S1 — PostgreSQL filtered unique indexes for active verified Portal links.
/// Set AUTHSERVICE_TEST_CONNECTION (or ConnectionStrings__DefaultConnection) to run;
/// returns early when unset (same pattern as Phase3ISlice8RequeueQueueUniquenessPostgresTests).
/// Applies S1 DDL via IF NOT EXISTS; cleans up inserted rows.
/// </summary>
public class PortalPatientLinkUniquenessPostgresTests : IAsyncLifetime
{
    private static readonly string? Conn =
        Environment.GetEnvironmentVariable("AUTHSERVICE_TEST_CONNECTION")
        ?? Environment.GetEnvironmentVariable("ConnectionStrings__DefaultConnection");

    private AppDbContext? _db;
    private bool _ready;
    private Guid _tenant;
    private Guid _principal1;
    private Guid _principal2;
    private Guid _patient1;
    private Guid _patient2;

    public async Task InitializeAsync()
    {
        if (string.IsNullOrWhiteSpace(Conn))
            return;

        _tenant = Guid.NewGuid();
        _principal1 = Guid.NewGuid();
        _principal2 = Guid.NewGuid();
        _patient1 = Guid.NewGuid();
        _patient2 = Guid.NewGuid();

        var options = new DbContextOptionsBuilder<AppDbContext>()
            .UseNpgsql(Conn)
            .Options;
        var http = new DefaultHttpContext();
        http.Items["TenantId"] = _tenant;
        _db = new AppDbContext(options, new HttpContextAccessor { HttpContext = http });
        await _db.Database.OpenConnectionAsync();
        await _db.Database.ExecuteSqlRawAsync($"SELECT set_config('app.tenant_id', '{_tenant}', false)");

        await _db.Database.ExecuteSqlRawAsync("""
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
            CREATE UNIQUE INDEX IF NOT EXISTS ux_portal_patient_links_active_verified_patient
                ON portal_patient_links (tenant_id, patient_id)
                WHERE verification_status = 'verified' AND revoked_at IS NULL;
            CREATE UNIQUE INDEX IF NOT EXISTS ux_portal_patient_links_active_verified_principal
                ON portal_patient_links (tenant_id, principal_user_id)
                WHERE verification_status = 'verified' AND revoked_at IS NULL;
            """);

        _db.Users.Add(MakeUser(_principal1, "P1"));
        _db.Users.Add(MakeUser(_principal2, "P2"));
        _db.Patients.Add(MakePatient(_patient1, "A"));
        _db.Patients.Add(MakePatient(_patient2, "B"));
        await _db.SaveChangesAsync();
        _ready = true;
    }

    public async Task DisposeAsync()
    {
        if (_db == null || !_ready)
            return;
        try
        {
            await _db.Database.ExecuteSqlRawAsync(
                "DELETE FROM portal_patient_links WHERE tenant_id = {0}", _tenant);
            await _db.Database.ExecuteSqlRawAsync(
                "DELETE FROM patient WHERE id IN ({0}, {1})", _patient1, _patient2);
            await _db.Database.ExecuteSqlRawAsync(
                "DELETE FROM users WHERE id IN ({0}, {1})", _principal1, _principal2);
        }
        catch
        {
            // best-effort cleanup
        }
        await _db.DisposeAsync();
    }

    [Fact]
    public async Task ActiveVerified_SamePatientTwoPrincipals_RejectedByUniqueIndex()
    {
        if (!_ready) return;

        _db!.PortalPatientLinks.Add(Active(_principal1, _patient1));
        await _db.SaveChangesAsync();

        _db.PortalPatientLinks.Add(Active(_principal2, _patient1));
        await Assert.ThrowsAsync<DbUpdateException>(() => _db.SaveChangesAsync());
    }

    [Fact]
    public async Task ActiveVerified_SamePrincipalTwoPatients_RejectedByUniqueIndex()
    {
        if (!_ready) return;

        _db!.PortalPatientLinks.Add(Active(_principal1, _patient1));
        await _db.SaveChangesAsync();

        _db.PortalPatientLinks.Add(Active(_principal1, _patient2));
        await Assert.ThrowsAsync<DbUpdateException>(() => _db.SaveChangesAsync());
    }

    [Fact]
    public async Task HistoricalUnverifiedAndRevoked_AllowedAlongsideActiveVerified()
    {
        if (!_ready) return;

        _db!.PortalPatientLinks.Add(new PortalPatientLink
        {
            Id = Guid.NewGuid(),
            TenantId = _tenant,
            PrincipalUserId = _principal1,
            PatientId = _patient1,
            VerificationStatus = PortalLinkVerificationStatus.Unverified,
            CreatedAt = DateTime.UtcNow
        });
        _db.PortalPatientLinks.Add(new PortalPatientLink
        {
            Id = Guid.NewGuid(),
            TenantId = _tenant,
            PrincipalUserId = _principal1,
            PatientId = _patient1,
            VerificationStatus = PortalLinkVerificationStatus.Revoked,
            RevokedAt = DateTime.UtcNow.AddDays(-1),
            CreatedAt = DateTime.UtcNow.AddDays(-2)
        });
        _db.PortalPatientLinks.Add(Active(_principal1, _patient1));
        await _db.SaveChangesAsync();

        var count = await _db.PortalPatientLinks.CountAsync(l => l.TenantId == _tenant && l.PrincipalUserId == _principal1);
        Assert.Equal(3, count);
    }

    private PortalPatientLink Active(Guid principalId, Guid patientId) => new()
    {
        Id = Guid.NewGuid(),
        TenantId = _tenant,
        PrincipalUserId = principalId,
        PatientId = patientId,
        VerificationStatus = PortalLinkVerificationStatus.Verified,
        VerifiedAt = DateTime.UtcNow,
        CreatedAt = DateTime.UtcNow
    };

    private AppUser MakeUser(Guid id, string tag) => new()
    {
        Id = id,
        TenantId = _tenant,
        UserName = $"plu{tag}{id:N}@t.local",
        NormalizedUserName = $"PLU{tag}{id:N}@T.LOCAL",
        Email = $"plu{tag}{id:N}@t.local",
        NormalizedEmail = $"PLU{tag}{id:N}@T.LOCAL",
        UserType = "Patient",
        UserStatus = "active",
        CreatedAt = DateTime.UtcNow,
        UpdatedAt = DateTime.UtcNow
    };

    private Patient MakePatient(Guid id, string tag) => new()
    {
        Id = id,
        TenantId = _tenant,
        MedicalRecordNumber = $"PLU{tag}{id:N}"[..20],
        FirstName = "PLU",
        LastName = tag,
        DateOfBirth = new DateTime(1990, 1, 1),
        Gender = "Unknown",
        Status = "Active",
        CreatedAt = DateTime.UtcNow,
        UpdatedAt = DateTime.UtcNow
    };
}
