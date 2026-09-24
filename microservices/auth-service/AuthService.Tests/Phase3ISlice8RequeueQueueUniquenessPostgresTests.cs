using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using AuthService.Context;
using AuthService.Models.Domain;
using AuthService.Models.Identity;
using AuthService.Services;
using AuthService.Services.Interfaces;
using Microsoft.AspNetCore.Http;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;
using Moq;
using Npgsql;
using Xunit;

namespace AuthService.Tests;

/// <summary>
/// Phase 3I Slice 8 — PostgreSQL-enforced CounselorQueue active SessionId uniqueness
/// and ReQueue soft-delete + new Waiting row.
/// Set AUTHSERVICE_TEST_CONNECTION (or ConnectionStrings__DefaultConnection) to run;
/// returns early when unset (same pattern as CCMS_TEST_CONNECTION tests).
/// Does not mutate UAT session bb000001-2222-2222-2222-000000000007.
/// </summary>
public class Phase3ISlice8RequeueQueueUniquenessPostgresTests : IAsyncLifetime
{
    private static readonly string? Conn =
        Environment.GetEnvironmentVariable("AUTHSERVICE_TEST_CONNECTION")
        ?? Environment.GetEnvironmentVariable("ConnectionStrings__DefaultConnection");

    // Existing Downtown Hospital / tenant used by UAT seed data (not the failing session row).
    private static readonly Guid KnownTenant = Guid.Parse("155fe198-6ae5-4a01-9254-ead5b427247e");
    private static readonly Guid KnownBranch = Guid.Parse("74c014cf-9570-4824-bdf9-b369ea11a8f4");

    private AppDbContext? _db;
    private CounselingWorkflowService? _svc;
    private readonly Mock<IAuditService> _audit = new();
    private readonly List<Guid> _sessionIds = new();
    private readonly List<Guid> _queueIds = new();
    private Guid _patient;
    private Guid _admin;
    private bool _ready;

    public async Task InitializeAsync()
    {
        if (string.IsNullOrWhiteSpace(Conn))
            return;

        _patient = Guid.NewGuid();
        _admin = Guid.NewGuid();

        var options = new DbContextOptionsBuilder<AppDbContext>()
            .UseNpgsql(Conn)
            .Options;
        var httpAccessor = new Mock<IHttpContextAccessor>();
        var httpCtx = new DefaultHttpContext();
        httpCtx.Items["TenantId"] = KnownTenant;
        httpAccessor.Setup(x => x.HttpContext).Returns(httpCtx);
        _db = new AppDbContext(options, httpAccessor.Object);
        await _db.Database.OpenConnectionAsync();
        await SetTenantAsync(KnownTenant);

        await _db.Database.ExecuteSqlRawAsync("""
            ALTER TABLE counselor_queue
                DROP CONSTRAINT IF EXISTS counselor_queue_session_id_key;
            DROP INDEX IF EXISTS counselor_queue_session_id_key;
            CREATE UNIQUE INDEX IF NOT EXISTS ux_counselor_queue_session_id_active
                ON counselor_queue (session_id)
                WHERE deleted_at IS NULL;
            """);

        _db.Users.Add(new AppUser
        {
            Id = _admin,
            TenantId = KnownTenant,
            UserName = $"s8q{_admin:N}@t.local",
            NormalizedUserName = $"S8Q{_admin:N}@T.LOCAL",
            Email = $"s8q{_admin:N}@t.local",
            NormalizedEmail = $"S8Q{_admin:N}@T.LOCAL",
            FirstName = "S8Q",
            LastName = "Admin",
            BranchId = KnownBranch,
            UserType = "Admin",
        });
        _db.UserBranches.Add(new UserBranch
        {
            Id = Guid.NewGuid(),
            TenantId = KnownTenant,
            UserId = _admin,
            BranchId = KnownBranch,
            Status = "active",
            EffectiveFrom = DateTime.UtcNow.AddDays(-30),
        });
        _db.Patients.Add(new Patient
        {
            Id = _patient,
            TenantId = KnownTenant,
            BranchId = KnownBranch,
            FirstName = "S8Q",
            LastName = "Patient",
            MedicalRecordNumber = $"S8Q{_patient:N}".Substring(0, 20),
            DateOfBirth = new DateTime(1990, 1, 1),
            Gender = "Female",
            Status = "Active",
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow,
        });
        await _db.SaveChangesAsync();

        var branchAccess = new FollowupBranchAccessService(_db);
        var logger = new Mock<ILogger<CounselingWorkflowService>>();
        var blob = new Mock<IBlobStorageService>();
        var http = new Mock<System.Net.Http.IHttpClientFactory>();
        var config = new Mock<IConfiguration>();
        config.Setup(c => c["CcmsService:BaseUrl"]).Returns("http://localhost:7075/api");
        config.Setup(c => c["InternalApi:Key"]).Returns(string.Empty);
        var notifier = new Mock<IQueueDisplayNotifier>();
        _svc = new CounselingWorkflowService(
            _db, logger.Object, blob.Object, http.Object, config.Object, notifier.Object, branchAccess, _audit.Object);
        _ready = true;
    }

    public async Task DisposeAsync()
    {
        if (_db == null)
            return;
        try
        {
            await SetTenantAsync(KnownTenant);
            if (_queueIds.Count > 0)
            {
                var ids = string.Join(",", _queueIds.Select(id => $"'{id}'"));
                await _db.Database.ExecuteSqlRawAsync(
                    $"DELETE FROM counselor_queue WHERE id IN ({ids});");
            }
            if (_sessionIds.Count > 0)
            {
                var ids = string.Join(",", _sessionIds.Select(id => $"'{id}'"));
                await _db.Database.ExecuteSqlRawAsync(
                    $"DELETE FROM counseling_session_audit_log WHERE session_id IN ({ids});");
                await _db.Database.ExecuteSqlRawAsync(
                    $"DELETE FROM counseling_sessions WHERE id IN ({ids});");
            }
            await _db.Database.ExecuteSqlRawAsync(
                $"DELETE FROM user_branches WHERE user_id = '{_admin}';");
            await _db.Database.ExecuteSqlRawAsync(
                $"DELETE FROM patients WHERE id = '{_patient}';");
            await _db.Database.ExecuteSqlRawAsync(
                $"DELETE FROM users WHERE id = '{_admin}';");
        }
        catch
        {
            // Best-effort cleanup for isolated test rows.
        }
        finally
        {
            await _db.DisposeAsync();
        }
    }

    private async Task SetTenantAsync(Guid tenantId)
    {
        await using var cmd = _db!.Database.GetDbConnection().CreateCommand();
        cmd.CommandText = $"SELECT set_config('app.current_tenant_id', '{tenantId}', false);";
        await cmd.ExecuteNonQueryAsync();
    }

    private bool EnsureReady()
    {
        if (_ready && _db != null && _svc != null)
            return true;
        return false;
    }

    private async Task<(Guid sessionId, Guid completedQueueId)> SeedCompletedUnownedSessionAsync(
        string sessionType = "Initial")
    {
        var sessionId = Guid.NewGuid();
        var queueId = Guid.NewGuid();
        _sessionIds.Add(sessionId);
        _queueIds.Add(queueId);

        _db!.CounselingSession.Add(new CounselingSession
        {
            Id = sessionId,
            TenantId = KnownTenant,
            BranchId = KnownBranch,
            PatientId = _patient,
            CounselorId = null,
            ReferredByDoctorId = _admin,
            SessionType = sessionType,
            SessionDate = DateTime.UtcNow.Date,
            PatientType = "Cash",
            Status = "Completed",
            PatientIntention = "ReferredElsewhere",
            Version = 1,
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow,
            CreatedByUserId = _admin,
            UpdatedByUserId = _admin,
        });
        _db.CounselorQueue.Add(new CounselorQueueItem
        {
            Id = queueId,
            TenantId = KnownTenant,
            BranchId = KnownBranch,
            SessionId = sessionId,
            PatientId = _patient,
            TokenNumber = $"TQ{queueId.ToString("N")[..8]}",
            QueueType = "Counseling",
            QueuePosition = 1,
            PriorityScore = 50,
            UrgencyLevel = "Normal",
            Status = "Completed",
            AddedToQueueAt = DateTime.UtcNow,
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow,
        });
        await _db.SaveChangesAsync();
        return (sessionId, queueId);
    }

    [Fact]
    public async Task Requeue_CompletedActiveRow_SoftDeletesAndCreatesWaiting_NoUniqueViolation()
    {
        if (!EnsureReady())
            return;

        var (sessionId, completedId) = await SeedCompletedUnownedSessionAsync();

        var result = await _svc!.ReQueueSessionAsync(
            KnownTenant, sessionId, expectedVersion: 1, expectedCounselorId: null,
            reason: "postgres uniqueness uat", newIntention: null, notes: null,
            sessionType: "FOLLOW_UP", actorUserId: _admin);

        Assert.True(result.Success, result.Message);
        Assert.Null(result.CounselorId);

        var session = await _db!.CounselingSession.AsNoTracking()
            .SingleAsync(s => s.Id == sessionId);
        Assert.Equal("Followup", session.SessionType);
        Assert.Null(session.CounselorId);
        Assert.Equal(2, session.Version);

        var rows = await _db.CounselorQueue.AsNoTracking()
            .Where(q => q.SessionId == sessionId)
            .OrderBy(q => q.CreatedAt)
            .ToListAsync();
        Assert.Equal(2, rows.Count);
        var historical = rows.Single(q => q.Id == completedId);
        Assert.NotNull(historical.DeletedAt);
        Assert.Equal("Completed", historical.Status);
        var waiting = rows.Single(q => q.DeletedAt == null);
        _queueIds.Add(waiting.Id);
        Assert.Equal("Waiting", waiting.Status);
        Assert.Equal("RepeatCounselling", waiting.QueueType);
        Assert.Equal(1, rows.Count(q => q.DeletedAt == null));
    }

    [Fact]
    public async Task PartialUniqueIndex_RejectsTwoActiveRows_SameSessionId()
    {
        if (!EnsureReady())
            return;

        var (sessionId, _) = await SeedCompletedUnownedSessionAsync();

        var dupId = Guid.NewGuid();
        _queueIds.Add(dupId);
        _db!.CounselorQueue.Add(new CounselorQueueItem
        {
            Id = dupId,
            TenantId = KnownTenant,
            BranchId = KnownBranch,
            SessionId = sessionId,
            PatientId = _patient,
            TokenNumber = $"TD{dupId.ToString("N")[..8]}",
            QueueType = "Counseling",
            QueuePosition = 2,
            PriorityScore = 50,
            UrgencyLevel = "Normal",
            Status = "Waiting",
            AddedToQueueAt = DateTime.UtcNow,
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow,
        });

        var ex = await Assert.ThrowsAsync<DbUpdateException>(() => _db.SaveChangesAsync());
        var detail = ex.InnerException?.Message ?? ex.Message;
        Assert.Contains("ux_counselor_queue_session_id_active", detail, StringComparison.OrdinalIgnoreCase);
        _db.ChangeTracker.Clear();
    }

    [Fact]
    public async Task PartialUniqueIndex_AllowsMultipleHistoricalRows_SameSessionId()
    {
        if (!EnsureReady())
            return;

        var sessionId = Guid.NewGuid();
        _sessionIds.Add(sessionId);
        _db!.CounselingSession.Add(new CounselingSession
        {
            Id = sessionId,
            TenantId = KnownTenant,
            BranchId = KnownBranch,
            PatientId = _patient,
            CounselorId = null,
            ReferredByDoctorId = _admin,
            SessionType = "Initial",
            SessionDate = DateTime.UtcNow.Date,
            PatientType = "Cash",
            Status = "Completed",
            Version = 1,
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow,
            CreatedByUserId = _admin,
            UpdatedByUserId = _admin,
        });

        var hist1 = Guid.NewGuid();
        var hist2 = Guid.NewGuid();
        var active = Guid.NewGuid();
        _queueIds.AddRange(new[] { hist1, hist2, active });
        var now = DateTime.UtcNow;
        _db.CounselorQueue.AddRange(
            new CounselorQueueItem
            {
                Id = hist1, TenantId = KnownTenant, BranchId = KnownBranch, SessionId = sessionId,
                PatientId = _patient, TokenNumber = $"H1{hist1.ToString("N")[..6]}",
                QueueType = "Counseling", QueuePosition = 1, PriorityScore = 50,
                UrgencyLevel = "Normal", Status = "Completed", AddedToQueueAt = now.AddDays(-2),
                CreatedAt = now.AddDays(-2), UpdatedAt = now.AddDays(-1), DeletedAt = now.AddDays(-1),
            },
            new CounselorQueueItem
            {
                Id = hist2, TenantId = KnownTenant, BranchId = KnownBranch, SessionId = sessionId,
                PatientId = _patient, TokenNumber = $"H2{hist2.ToString("N")[..6]}",
                QueueType = "Counseling", QueuePosition = 2, PriorityScore = 50,
                UrgencyLevel = "Normal", Status = "Completed", AddedToQueueAt = now.AddDays(-1),
                CreatedAt = now.AddDays(-1), UpdatedAt = now.AddHours(-1), DeletedAt = now.AddHours(-1),
            },
            new CounselorQueueItem
            {
                Id = active, TenantId = KnownTenant, BranchId = KnownBranch, SessionId = sessionId,
                PatientId = _patient, TokenNumber = $"HA{active.ToString("N")[..6]}",
                QueueType = "RepeatCounselling", QueuePosition = 3, PriorityScore = 60,
                UrgencyLevel = "Normal", Status = "Waiting", AddedToQueueAt = now,
                CreatedAt = now, UpdatedAt = now,
            });

        var ex = await Record.ExceptionAsync(() => _db.SaveChangesAsync());
        Assert.Null(ex);
        Assert.Equal(2, await _db.CounselorQueue.CountAsync(q =>
            q.SessionId == sessionId && q.DeletedAt != null));
        Assert.Equal(1, await _db.CounselorQueue.CountAsync(q =>
            q.SessionId == sessionId && q.DeletedAt == null));
    }

    [Fact]
    public async Task Requeue_ExistingWaiting_IsReused_NoDuplicateActive()
    {
        if (!EnsureReady())
            return;

        var (sessionId, completedId) = await SeedCompletedUnownedSessionAsync();
        var completed = await _db!.CounselorQueue.SingleAsync(q => q.Id == completedId);
        completed.DeletedAt = DateTime.UtcNow;
        var waitingId = Guid.NewGuid();
        _queueIds.Add(waitingId);
        _db.CounselorQueue.Add(new CounselorQueueItem
        {
            Id = waitingId,
            TenantId = KnownTenant,
            BranchId = KnownBranch,
            SessionId = sessionId,
            PatientId = _patient,
            TokenNumber = $"TW{waitingId.ToString("N")[..8]}",
            QueueType = "RepeatCounselling",
            QueuePosition = 5,
            PriorityScore = 60,
            UrgencyLevel = "Normal",
            Status = "Waiting",
            AddedToQueueAt = DateTime.UtcNow,
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow,
        });
        await _db.SaveChangesAsync();

        var result = await _svc!.ReQueueSessionAsync(
            KnownTenant, sessionId, expectedVersion: 1, expectedCounselorId: null,
            reason: "reuse waiting", newIntention: null, notes: null,
            sessionType: "Followup", actorUserId: _admin);

        Assert.True(result.Success, result.Message);
        Assert.Equal(waitingId, result.QueueItemId);
        Assert.Equal(1, await _db.CounselorQueue.CountAsync(q =>
            q.SessionId == sessionId && q.DeletedAt == null));
    }

    [Fact]
    public async Task LiveIndexDefinition_IsPartialUniqueOnSessionId()
    {
        if (string.IsNullOrWhiteSpace(Conn))
            return;

        await using var conn = new NpgsqlConnection(Conn);
        await conn.OpenAsync();
        await using var cmd = conn.CreateCommand();
        cmd.CommandText = """
            SELECT indexdef
            FROM pg_indexes
            WHERE tablename = 'counselor_queue'
              AND indexname = 'ux_counselor_queue_session_id_active';
            """;
        var def = (string?)await cmd.ExecuteScalarAsync();
        Assert.NotNull(def);
        Assert.Contains("UNIQUE", def, StringComparison.OrdinalIgnoreCase);
        Assert.Contains("session_id", def, StringComparison.OrdinalIgnoreCase);
        Assert.Contains("deleted_at IS NULL", def, StringComparison.OrdinalIgnoreCase);

        cmd.CommandText = """
            SELECT COUNT(*) FROM pg_constraint
            WHERE conrelid = 'counselor_queue'::regclass
              AND conname = 'counselor_queue_session_id_key';
            """;
        var oldConstraint = Convert.ToInt64(await cmd.ExecuteScalarAsync());
        Assert.Equal(0, oldConstraint);
    }
}
