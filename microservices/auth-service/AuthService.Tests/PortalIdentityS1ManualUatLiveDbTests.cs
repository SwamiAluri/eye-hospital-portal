using System;
using System.Linq;
using System.Threading.Tasks;
using AuthService.Context;
using AuthService.Models.Domain;
using AuthService.Models.Identity;
using AuthService.Services;
using Microsoft.AspNetCore.Http;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging.Abstractions;
using Npgsql;
using Xunit;
using Xunit.Abstractions;

namespace AuthService.Tests;

/// <summary>
/// L-PORTAL-01 S1 manual UAT against authorized non-prod DB.
/// Requires AUTHSERVICE_TEST_CONNECTION or ConnectionStrings__DefaultConnection.
/// Applies additive S1 DDL (IF NOT EXISTS), runs scenarios, cleans up inserted rows.
/// Does not mutate unrelated production clinical data beyond disposable UAT rows.
/// </summary>
public class PortalIdentityS1ManualUatLiveDbTests : IAsyncLifetime
{
    private static readonly string? Conn =
        Environment.GetEnvironmentVariable("AUTHSERVICE_TEST_CONNECTION")
        ?? Environment.GetEnvironmentVariable("ConnectionStrings__DefaultConnection");

    private readonly ITestOutputHelper _out;
    private AppDbContext? _db;
    private bool _ready;
    private Guid _tenant;
    private Guid _tenantB;
    private Guid _principal;
    private Guid _principal2;
    private Guid _staff;
    private Guid _patient;
    private Guid _patientDeceased;
    private Guid _patientB;

    public PortalIdentityS1ManualUatLiveDbTests(ITestOutputHelper output) => _out = output;

    public async Task InitializeAsync()
    {
        if (string.IsNullOrWhiteSpace(Conn))
        {
            _out.WriteLine("SKIP: no AUTHSERVICE_TEST_CONNECTION / ConnectionStrings__DefaultConnection");
            return;
        }

        _tenant = Guid.NewGuid();
        _tenantB = Guid.NewGuid();
        _principal = Guid.NewGuid();
        _principal2 = Guid.NewGuid();
        _staff = Guid.NewGuid();
        _patient = Guid.NewGuid();
        _patientDeceased = Guid.NewGuid();
        _patientB = Guid.NewGuid();

        var options = new DbContextOptionsBuilder<AppDbContext>()
            .UseNpgsql(Conn)
            .Options;
        var http = new DefaultHttpContext();
        http.Items["TenantId"] = _tenant;
        _db = new AppDbContext(options, new HttpContextAccessor { HttpContext = http });
        await _db.Database.OpenConnectionAsync();
        await _db.Database.ExecuteSqlRawAsync($"SELECT set_config('app.tenant_id', '{_tenant}', false)");

        // 1) Apply S1 migration DDL (authorized non-prod)
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
            CREATE INDEX IF NOT EXISTS ix_portal_invitations_tenant
                ON portal_invitations (tenant_id);
            CREATE INDEX IF NOT EXISTS ix_portal_invitations_tenant_patient
                ON portal_invitations (tenant_id, patient_id);
            CREATE INDEX IF NOT EXISTS ix_portal_invitations_token_hash
                ON portal_invitations (token_hash);

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
            CREATE INDEX IF NOT EXISTS ix_portal_patient_links_tenant
                ON portal_patient_links (tenant_id);
            CREATE UNIQUE INDEX IF NOT EXISTS ux_portal_patient_links_active_verified_patient
                ON portal_patient_links (tenant_id, patient_id)
                WHERE verification_status = 'verified' AND revoked_at IS NULL;
            CREATE UNIQUE INDEX IF NOT EXISTS ux_portal_patient_links_active_verified_principal
                ON portal_patient_links (tenant_id, principal_user_id)
                WHERE verification_status = 'verified' AND revoked_at IS NULL;

            CREATE TABLE IF NOT EXISTS portal_remediation_requests (
                id uuid NOT NULL PRIMARY KEY,
                tenant_id uuid NOT NULL,
                link_id uuid NOT NULL,
                requested_by_user_id uuid NOT NULL,
                approved_by_user_id uuid,
                operation character varying(50) NOT NULL,
                reason character varying(1000) NOT NULL,
                status character varying(30) NOT NULL,
                created_at timestamp with time zone NOT NULL,
                resolved_at timestamp with time zone
            );
            CREATE INDEX IF NOT EXISTS ix_portal_remediation_requests_tenant
                ON portal_remediation_requests (tenant_id);
            CREATE INDEX IF NOT EXISTS ix_portal_remediation_requests_tenant_link
                ON portal_remediation_requests (tenant_id, link_id);
            """);

        _db.Users.Add(MakeUser(_principal, "Patient", "uatp1"));
        _db.Users.Add(MakeUser(_principal2, "Patient", "uatp2"));
        _db.Users.Add(MakeUser(_staff, "Staff", "uats"));
        _db.Patients.Add(MakePatient(_patient, "Live"));
        _db.Patients.Add(MakePatient(_patientDeceased, "Dead", deceased: true));
        _db.Patients.Add(MakePatient(_patientB, "Other", tenantId: _tenantB));
        await _db.SaveChangesAsync();
        _ready = true;
        _out.WriteLine("S1 DDL applied + disposable UAT fixtures seeded");
    }

    public async Task DisposeAsync()
    {
        if (_db == null || !_ready) return;
        try
        {
            await _db.Database.ExecuteSqlRawAsync(
                "DELETE FROM portal_patient_links WHERE tenant_id = {0} OR principal_user_id IN ({1},{2}) OR patient_id IN ({3},{4},{5})",
                _tenant, _principal, _principal2, _patient, _patientDeceased, _patientB);
            await _db.Database.ExecuteSqlRawAsync(
                "DELETE FROM portal_invitations WHERE tenant_id = {0}", _tenant);
            await _db.Database.ExecuteSqlRawAsync(
                "DELETE FROM portal_remediation_requests WHERE tenant_id = {0}", _tenant);
            await _db.Database.ExecuteSqlRawAsync(
                "DELETE FROM audit_log WHERE tenant_id = {0} AND action = {1}",
                _tenant, PortalIdentityAudit.ResolveDenied);
            await _db.Database.ExecuteSqlRawAsync(
                "DELETE FROM patient WHERE id IN ({0},{1},{2})",
                _patient, _patientDeceased, _patientB);
            await _db.Database.ExecuteSqlRawAsync(
                "DELETE FROM users WHERE id IN ({0},{1},{2})",
                _principal, _principal2, _staff);
            _out.WriteLine("Disposable UAT rows cleaned up");
        }
        catch (Exception ex)
        {
            _out.WriteLine($"Cleanup warning: {ex.GetType().Name}: {ex.Message}");
        }
        await _db.DisposeAsync();
    }

    [Fact]
    public async Task Uat_01_TablesAndIndexes_Exist()
    {
        if (!_ready) return;

        var tables = await QueryStringsAsync("""
            SELECT table_name
            FROM information_schema.tables
            WHERE table_schema = 'public'
              AND table_name IN ('portal_invitations','portal_patient_links','portal_remediation_requests')
            ORDER BY 1
            """);
        Assert.Contains("portal_invitations", tables);
        Assert.Contains("portal_patient_links", tables);
        Assert.Contains("portal_remediation_requests", tables);

        var indexes = await QueryStringsAsync("""
            SELECT indexname
            FROM pg_indexes
            WHERE schemaname = 'public'
              AND indexname IN (
                'ux_portal_patient_links_active_verified_patient',
                'ux_portal_patient_links_active_verified_principal')
            ORDER BY 1
            """);
        Assert.Contains("ux_portal_patient_links_active_verified_patient", indexes);
        Assert.Contains("ux_portal_patient_links_active_verified_principal", indexes);
        _out.WriteLine($"PASS tables=[{string.Join(",", tables)}] indexes=[{string.Join(",", indexes)}]");
    }

    private async Task<List<string>> QueryStringsAsync(string sql)
    {
        var list = new List<string>();
        var conn = (NpgsqlConnection)_db!.Database.GetDbConnection();
        if (conn.State != System.Data.ConnectionState.Open)
            await conn.OpenAsync();
        await using var cmd = new NpgsqlCommand(sql, conn);
        await using var reader = await cmd.ExecuteReaderAsync();
        while (await reader.ReadAsync())
            list.Add(reader.GetString(0));
        return list;
    }

    [Fact]
    public async Task Uat_02_UnverifiedRevokedPlusOneVerified_ResolveSucceeds()
    {
        if (!_ready) return;

        _db!.PortalPatientLinks.Add(Link(_principal, _patient, PortalLinkVerificationStatus.Unverified));
        _db.PortalPatientLinks.Add(Link(_principal, _patient, PortalLinkVerificationStatus.Revoked, revokedAt: DateTime.UtcNow.AddDays(-1)));
        var active = Link(_principal, _patient, PortalLinkVerificationStatus.Verified, verifiedAt: DateTime.UtcNow);
        _db.PortalPatientLinks.Add(active);
        await _db.SaveChangesAsync();

        var result = await Resolve(_tenant, _principal);
        Assert.True(result.Succeeded);
        Assert.Equal(_patient, result.PatientId);
        _out.WriteLine($"PASS resolve patientId={result.PatientId} linkId={result.LinkId}");
    }

    [Fact]
    public async Task Uat_03_SecondActiveVerified_SamePatient_UniqueViolation()
    {
        if (!_ready) return;

        // Ensure a clean active verified for principal1→patient
        await ClearLinksForPrincipalPatientAsync();
        _db!.PortalPatientLinks.Add(Link(_principal, _patient, PortalLinkVerificationStatus.Verified, verifiedAt: DateTime.UtcNow));
        await _db.SaveChangesAsync();

        _db.PortalPatientLinks.Add(Link(_principal2, _patient, PortalLinkVerificationStatus.Verified, verifiedAt: DateTime.UtcNow));
        await Assert.ThrowsAsync<DbUpdateException>(() => _db.SaveChangesAsync());
        _db.ChangeTracker.Clear();
        _out.WriteLine("PASS unique violation same patient two principals");
    }

    [Fact]
    public async Task Uat_04_SecondActiveVerified_SamePrincipal_UniqueViolation()
    {
        if (!_ready) return;

        await ClearLinksForPrincipalPatientAsync();
        _db!.PortalPatientLinks.Add(Link(_principal, _patient, PortalLinkVerificationStatus.Verified, verifiedAt: DateTime.UtcNow));
        await _db.SaveChangesAsync();

        var p2 = Guid.NewGuid();
        _db.Patients.Add(MakePatient(p2, "P2"));
        await _db.SaveChangesAsync();
        _db.PortalPatientLinks.Add(Link(_principal, p2, PortalLinkVerificationStatus.Verified, verifiedAt: DateTime.UtcNow));
        await Assert.ThrowsAsync<DbUpdateException>(() => _db.SaveChangesAsync());
        _db.ChangeTracker.Clear();
        await _db.Database.ExecuteSqlRawAsync("DELETE FROM patient WHERE id = {0}", p2);
        _out.WriteLine("PASS unique violation same principal two patients");
    }

    [Fact]
    public async Task Uat_05_Deceased_CrossTenant_Missing_DenyWithAudit()
    {
        if (!_ready) return;

        await ClearLinksForPrincipalPatientAsync();
        var svc = CreateResolveService();

        // Missing link
        var missing = await svc.ResolveAsync(_tenant, _principal);
        Assert.False(missing.Succeeded);
        Assert.Equal(PortalResolveDenialReason.Missing, missing.DenialReasonCode);
        Assert.True(missing.DenialAuditPersisted);

        // Deceased
        _db!.PortalPatientLinks.Add(Link(_principal, _patientDeceased, PortalLinkVerificationStatus.Verified, verifiedAt: DateTime.UtcNow));
        await _db.SaveChangesAsync();
        var deceased = await svc.ResolveAsync(_tenant, _principal);
        Assert.False(deceased.Succeeded);
        Assert.Equal(PortalResolveDenialReason.Deceased, deceased.DenialReasonCode);
        Assert.True(deceased.DenialAuditPersisted);

        await ClearLinksForPrincipalPatientAsync();

        // Cross-tenant: principal in tenant A, call with wrong tenant
        var cross = await svc.ResolveAsync(_tenantB, _principal);
        Assert.False(cross.Succeeded);
        Assert.Equal(PortalResolveDenialReason.CrossTenant, cross.DenialReasonCode);

        var auditCount = await _db.AuditLogs.CountAsync(a =>
            a.TenantId == _tenant
            && a.Action == PortalIdentityAudit.ResolveDenied);
        Assert.True(auditCount >= 2);
        _out.WriteLine($"PASS deny+audit rows (tenant A resolve.denied count>={auditCount})");
    }

    private async Task ClearLinksForPrincipalPatientAsync()
    {
        await _db!.Database.ExecuteSqlRawAsync(
            "DELETE FROM portal_patient_links WHERE tenant_id = {0}", _tenant);
        _db.ChangeTracker.Clear();
    }

    private async Task<PortalPatientResolveResult> Resolve(Guid tenantId, Guid principalId)
    {
        var http = new DefaultHttpContext();
        http.Items["TenantId"] = tenantId;
        var accessor = new HttpContextAccessor { HttpContext = http };
        // Rebind db http for audit tenant
        var options = new DbContextOptionsBuilder<AppDbContext>().UseNpgsql(Conn!).Options;
        await using var db = new AppDbContext(options, accessor);
        await db.Database.OpenConnectionAsync();
        await db.Database.ExecuteSqlRawAsync($"SELECT set_config('app.tenant_id', '{tenantId}', false)");
        var audit = new AuditService(db, accessor);
        var svc = new PortalPatientResolveService(db, audit, NullLogger<PortalPatientResolveService>.Instance);
        return await svc.ResolveAsync(tenantId, principalId);
    }

    private PortalPatientResolveService CreateResolveService()
    {
        var http = new DefaultHttpContext();
        http.Items["TenantId"] = _tenant;
        var accessor = new HttpContextAccessor { HttpContext = http };
        var audit = new AuditService(_db!, accessor);
        return new PortalPatientResolveService(_db!, audit, NullLogger<PortalPatientResolveService>.Instance);
    }

    private AppUser MakeUser(Guid id, string userType, string tag) => new()
    {
        Id = id,
        TenantId = userType == "Patient" && tag == "uatp1" ? _tenant
            : userType == "Patient" && tag == "uatp2" ? _tenant
            : _tenant,
        UserName = $"s1uat_{tag}_{id:N}@t.local",
        NormalizedUserName = $"S1UAT_{tag}_{id:N}@T.LOCAL",
        Email = $"s1uat_{tag}_{id:N}@t.local",
        NormalizedEmail = $"S1UAT_{tag}_{id:N}@T.LOCAL",
        UserType = userType,
        UserStatus = "active",
        CreatedAt = DateTime.UtcNow,
        UpdatedAt = DateTime.UtcNow
    };

    private Patient MakePatient(Guid id, string tag, bool deceased = false, Guid? tenantId = null) => new()
    {
        Id = id,
        TenantId = tenantId ?? _tenant,
        MedicalRecordNumber = $"S1U{tag}{id:N}"[..20],
        FirstName = "S1UAT",
        LastName = tag,
        DateOfBirth = new DateTime(1990, 1, 1),
        Gender = "Unknown",
        Status = "Active",
        DeceasedDate = deceased ? DateTime.UtcNow.AddDays(-1) : null,
        CreatedAt = DateTime.UtcNow,
        UpdatedAt = DateTime.UtcNow
    };

    private PortalPatientLink Link(
        Guid principalId,
        Guid patientId,
        string status,
        DateTime? verifiedAt = null,
        DateTime? revokedAt = null) => new()
    {
        Id = Guid.NewGuid(),
        TenantId = _tenant,
        PrincipalUserId = principalId,
        PatientId = patientId,
        VerificationStatus = status,
        VerifiedAt = verifiedAt,
        RevokedAt = revokedAt,
        CreatedAt = DateTime.UtcNow
    };
}
