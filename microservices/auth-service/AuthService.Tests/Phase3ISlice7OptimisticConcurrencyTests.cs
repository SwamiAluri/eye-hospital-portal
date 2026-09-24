using System;
using System.Linq;
using System.Threading.Tasks;
using AuthService.Context;
using AuthService.Models.Counselor;
using AuthService.Models.Domain;
using AuthService.Models.Identity;
using AuthService.Services;
using AuthService.Services.Interfaces;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;
using Moq;
using Xunit;

namespace AuthService.Tests;

/// <summary>
/// Phase 3I Slice 7 (PD-S7-01..06) — Optimistic concurrency for Auth CounselingSession.
/// Covers: Create defaults Version=1; Update current-vs-stale; Assign/Claim/Reassign Version;
/// AddCommLog (M18) success + stale (no side-effect leakage); ApplyCcmsCallback (M19) system-writer
/// success + genuine concurrent-write race preserving the other writer's data; missing-Version fail-closed
/// (400); and the 403 (ownership ACL) vs 409 (stale Version) distinction.
///
/// Follows the fixture/style of Phase3ISlice6ReassignOwnershipTests.cs and
/// AuthService.Tests/Phase3ISlice4OwnerMutationAclTests.cs.
/// </summary>
public class Phase3ISlice7OptimisticConcurrencyTests : IDisposable
{
    private readonly string _dbName = Guid.NewGuid().ToString();
    private readonly AppDbContext _db;
    private readonly CounselingWorkflowService _svc;
    private readonly CounselorCommunicationService _commSvc;
    private readonly Mock<IAuditService> _audit = new();
    private readonly IFollowupBranchAccessService _branchAccess;

    private readonly Guid _tenant = Guid.Parse("aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa");
    private readonly Guid _branchA = Guid.Parse("11111111-1111-1111-1111-111111111111");
    private readonly Guid _amelia = Guid.Parse("c0000001-0000-0000-0000-000000000001");
    private readonly Guid _ravi = Guid.Parse("c0000002-0000-0000-0000-000000000002");
    private readonly Guid _admin = Guid.Parse("a0000001-0000-0000-0000-000000000001");
    private readonly Guid _patient = Guid.Parse("f1000001-0000-0000-0000-000000000001");

    public Phase3ISlice7OptimisticConcurrencyTests()
    {
        _db = TestDbContextFactory.CreateInMemoryNamed(_dbName);
        _branchAccess = new FollowupBranchAccessService(_db);
        _svc = CreateWorkflowService(_db, _branchAccess, _audit.Object);
        _commSvc = new CounselorCommunicationService(_db, new Mock<ILogger<CounselorCommunicationService>>().Object);
        Seed();
    }

    public void Dispose() => _db.Dispose();

    private static CounselingWorkflowService CreateWorkflowService(
        AppDbContext db,
        IFollowupBranchAccessService branchAccess,
        IAuditService audit)
    {
        var logger = new Mock<ILogger<CounselingWorkflowService>>();
        var blob = new Mock<IBlobStorageService>();
        var http = new Mock<System.Net.Http.IHttpClientFactory>();
        var config = new Mock<IConfiguration>();
        config.Setup(c => c["CcmsService:BaseUrl"]).Returns("http://localhost:7075/api");
        config.Setup(c => c["InternalApi:Key"]).Returns(string.Empty);
        var notifier = new Mock<IQueueDisplayNotifier>();
        return new CounselingWorkflowService(
            db, logger.Object, blob.Object, http.Object, config.Object, notifier.Object, branchAccess, audit);
    }

    private void Seed()
    {
        void AddCounsellor(Guid id, Guid tenant, Guid branch, string first, string last, string userType = "Counsellor")
        {
            _db.Users.Add(new AppUser
            {
                Id = id,
                TenantId = tenant,
                UserName = $"{first.ToLower()}@test",
                NormalizedUserName = $"{first.ToUpper()}@TEST",
                Email = $"{first.ToLower()}@test",
                NormalizedEmail = $"{first.ToUpper()}@TEST",
                FirstName = first,
                LastName = last,
                BranchId = branch,
                UserType = userType,
            });
            _db.UserBranches.Add(new UserBranch
            {
                Id = Guid.NewGuid(),
                TenantId = tenant,
                UserId = id,
                BranchId = branch,
                Status = "active",
                EffectiveFrom = DateTime.UtcNow.AddDays(-30),
            });
        }

        AddCounsellor(_amelia, _tenant, _branchA, "Amelia", "Martinez");
        AddCounsellor(_ravi, _tenant, _branchA, "Ravi", "Kumar");

        _db.Users.Add(new AppUser
        {
            Id = _admin,
            TenantId = _tenant,
            UserName = "admin@test",
            NormalizedUserName = "ADMIN@TEST",
            Email = "admin@test",
            NormalizedEmail = "ADMIN@TEST",
            FirstName = "Admin",
            LastName = "User",
            BranchId = _branchA,
            UserType = "Admin",
        });
        _db.UserBranches.Add(new UserBranch
        {
            Id = Guid.NewGuid(),
            TenantId = _tenant,
            UserId = _admin,
            BranchId = _branchA,
            Status = "active",
            EffectiveFrom = DateTime.UtcNow.AddDays(-30),
        });

        _db.Patients.Add(new Patient
        {
            Id = _patient,
            TenantId = _tenant,
            BranchId = _branchA,
            FirstName = "Pat",
            LastName = "Ent",
            MedicalRecordNumber = "MRN-S7",
            DateOfBirth = new DateTime(1990, 1, 1),
            Gender = "Female",
            Status = "Active",
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow,
        });
        _db.SaveChanges();
    }

    private async Task<Guid> SeedSessionAsync(
        Guid? ownerId,
        string sessionStatus = "Scheduled",
        string queueStatus = "Waiting",
        string? packageAddonsJson = null)
    {
        var sessionId = Guid.NewGuid();
        _db.CounselingSession.Add(new CounselingSession
        {
            Id = sessionId,
            TenantId = _tenant,
            BranchId = _branchA,
            PatientId = _patient,
            CounselorId = ownerId,
            SessionType = "Initial",
            SessionDate = DateTime.UtcNow.Date,
            PatientType = "Cash",
            Status = sessionStatus,
            PackageAddonsJson = packageAddonsJson,
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow,
            CreatedByUserId = ownerId ?? _admin,
            UpdatedByUserId = ownerId ?? _admin,
        });
        _db.CounselorQueue.Add(new CounselorQueueItem
        {
            Id = Guid.NewGuid(),
            TenantId = _tenant,
            BranchId = _branchA,
            SessionId = sessionId,
            PatientId = _patient,
            TokenNumber = $"S7-{sessionId.ToString()[..8]}",
            QueueType = "Counseling",
            QueuePosition = 1,
            PriorityScore = 50,
            UrgencyLevel = "Normal",
            Status = queueStatus,
            AddedToQueueAt = DateTime.UtcNow,
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow,
        });
        await _db.SaveChangesAsync();
        return sessionId;
    }

    private async Task<int> CurrentVersionAsync(Guid sessionId) =>
        (await _db.CounselingSession.AsNoTracking().FirstAsync(s => s.Id == sessionId)).Version;

    // ════════════════════════════════════════════════════════════════════
    // Create — Version defaults to 1, no client-supplied expected Version.
    // ════════════════════════════════════════════════════════════════════

    [Fact]
    public async Task Create_NewSession_DefaultsVersionToOne()
    {
        var request = new CreateCounselingSessionRequest
        {
            TenantId = _tenant,
            BranchId = _branchA,
            PatientId = _patient,
            ReferredByDoctorId = Guid.NewGuid(),
            SessionType = "Initial",
            PatientType = "Cash",
        };

        var result = await _svc.CreateSessionAsync(request, _admin);

        Assert.True(result.Success);
        Assert.Equal(1, result.Session!.Version);

        var row = await _db.CounselingSession.AsNoTracking().FirstAsync(s => s.Id == result.SessionId);
        Assert.Equal(1, row.Version);
    }

    // ════════════════════════════════════════════════════════════════════
    // UpdateSession — current Version succeeds and bumps; stale Version → 409.
    // ════════════════════════════════════════════════════════════════════

    [Fact]
    public async Task UpdateSession_CurrentVersion_Succeeds_AndBumpsVersion()
    {
        var sessionId = await SeedSessionAsync(_amelia, sessionStatus: "InProgress", queueStatus: "InProgress");
        var v1 = await CurrentVersionAsync(sessionId);

        var result = await _svc.UpdateSessionAsync(_tenant, sessionId, new UpdateCounselingSessionRequest
        {
            Version = v1,
            ClinicalSummary = "First update",
        }, _amelia);

        Assert.True(result.Success);
        var row = await _db.CounselingSession.AsNoTracking().FirstAsync(s => s.Id == sessionId);
        Assert.Equal("First update", row.ClinicalSummary);
        Assert.Equal(v1 + 1, row.Version);
    }

    [Fact]
    public async Task UpdateSession_StaleVersion_ReturnsConflict_NoWrite()
    {
        var sessionId = await SeedSessionAsync(_amelia, sessionStatus: "InProgress", queueStatus: "InProgress");
        var staleVersion = await CurrentVersionAsync(sessionId);

        // Someone else updates first, bumping the version.
        Assert.True((await _svc.UpdateSessionAsync(_tenant, sessionId, new UpdateCounselingSessionRequest
        {
            Version = staleVersion,
            ClinicalSummary = "Winner's update",
        }, _amelia)).Success);

        // Second caller still holds the pre-update (now stale) version.
        var result = await _svc.UpdateSessionAsync(_tenant, sessionId, new UpdateCounselingSessionRequest
        {
            Version = staleVersion,
            ClinicalSummary = "Loser's update — must not apply",
        }, _amelia);

        Assert.False(result.Success);
        Assert.Equal(SessionOperationFailureKind.Conflict, result.FailureKind);
        Assert.Equal(SessionConcurrency.StaleMessage, result.Message);

        var row = await _db.CounselingSession.AsNoTracking().FirstAsync(s => s.Id == sessionId);
        Assert.Equal("Winner's update", row.ClinicalSummary);
    }

    // ════════════════════════════════════════════════════════════════════
    // Assign — Class B ownership mutation. Correct Version succeeds + bumps;
    // stale Version → Conflict, no ownership change, no audit trail.
    // ════════════════════════════════════════════════════════════════════

    [Fact]
    public async Task Assign_CurrentVersion_Succeeds_AndBumpsVersion()
    {
        var sessionId = await SeedSessionAsync(ownerId: null);
        var v1 = await CurrentVersionAsync(sessionId);

        var result = await _svc.AssignSessionAsync(_tenant, sessionId, _ravi, v1, _admin);

        Assert.True(result.Success);
        Assert.Equal(v1 + 1, result.Version);
        var row = await _db.CounselingSession.AsNoTracking().FirstAsync(s => s.Id == sessionId);
        Assert.Equal(_ravi, row.CounselorId);
        Assert.Equal(v1 + 1, row.Version);
    }

    [Fact]
    public async Task Assign_StaleVersion_Conflict_NoOwnershipChange_NoAudit()
    {
        var sessionId = await SeedSessionAsync(ownerId: null);
        var staleVersion = await CurrentVersionAsync(sessionId);

        // Bump the version out from under the caller without assigning ownership
        // (a plain content edit is not possible pre-Start, so use ExecuteUpdate directly
        // to simulate an unrelated concurrent write that only bumps Version).
        var row = await _db.CounselingSession.FirstAsync(s => s.Id == sessionId);
        row.AdditionalNotes = "unrelated concurrent edit";
        await _db.SaveChangesAsync();

        var result = await _svc.AssignSessionAsync(_tenant, sessionId, _ravi, staleVersion, _admin);

        Assert.False(result.Success);
        Assert.Equal(AssignSessionFailureKind.Conflict, result.FailureKind);
        Assert.Equal(SessionConcurrency.StaleMessage, result.Message);

        var after = await _db.CounselingSession.AsNoTracking().FirstAsync(s => s.Id == sessionId);
        Assert.Null(after.CounselorId);
        _audit.Verify(a => a.StageAsync(
            It.IsAny<Guid>(), "OwnershipAssigned", It.IsAny<string>(), It.IsAny<Guid?>(),
            It.IsAny<string?>(), It.IsAny<string?>(), It.IsAny<string?>()), Times.Never);
    }

    // ════════════════════════════════════════════════════════════════════
    // Claim — lifecycle ownership claim. Same Version contract as Assign.
    // ════════════════════════════════════════════════════════════════════

    [Fact]
    public async Task Claim_CurrentVersion_Succeeds_AndBumpsVersion()
    {
        var sessionId = await SeedSessionAsync(_amelia, sessionStatus: "Completed", queueStatus: "Completed");
        var session = await _db.CounselingSession.FirstAsync(s => s.Id == sessionId);
        session.PatientAgreedToSurgery = true;
        await _db.SaveChangesAsync();
        var v = await CurrentVersionAsync(sessionId);

        var result = await _svc.ClaimSessionForLifecycleAsync(
            _tenant, sessionId, _amelia, CounselingLifecycleClaimIntent.ReEvaluate, v, _ravi);

        Assert.True(result.Success);
        Assert.Equal(v + 1, result.Version);
        var row = await _db.CounselingSession.AsNoTracking().FirstAsync(s => s.Id == sessionId);
        Assert.Equal(_ravi, row.CounselorId);
        Assert.Equal(v + 1, row.Version);
    }

    [Fact]
    public async Task Claim_StaleVersion_Conflict_NoOwnershipChange()
    {
        var sessionId = await SeedSessionAsync(_amelia, sessionStatus: "Completed", queueStatus: "Completed");
        var session = await _db.CounselingSession.FirstAsync(s => s.Id == sessionId);
        session.PatientAgreedToSurgery = true;
        await _db.SaveChangesAsync();
        var staleVersion = await CurrentVersionAsync(sessionId);

        // Unrelated concurrent write bumps Version without changing ownership.
        session.AdditionalNotes = "concurrent edit";
        await _db.SaveChangesAsync();

        var result = await _svc.ClaimSessionForLifecycleAsync(
            _tenant, sessionId, _amelia, CounselingLifecycleClaimIntent.ReEvaluate, staleVersion, _ravi);

        Assert.False(result.Success);
        Assert.Equal(AssignSessionFailureKind.Conflict, result.FailureKind);
        Assert.Equal(SessionConcurrency.StaleMessage, result.Message);
        var row = await _db.CounselingSession.AsNoTracking().FirstAsync(s => s.Id == sessionId);
        Assert.Equal(_amelia, row.CounselorId);
    }

    // ════════════════════════════════════════════════════════════════════
    // Reassign — supervisory A → B. Same Version contract as Assign/Claim.
    // ════════════════════════════════════════════════════════════════════

    [Fact]
    public async Task Reassign_CurrentVersion_Succeeds_AndBumpsVersion()
    {
        var sessionId = await SeedSessionAsync(_amelia);
        var v = await CurrentVersionAsync(sessionId);

        var result = await _svc.ReassignSessionAsync(
            _tenant, sessionId, _ravi, _amelia, "Peer leave coverage", v, _admin);

        Assert.True(result.Success);
        Assert.Equal(v + 1, result.Version);
        var row = await _db.CounselingSession.AsNoTracking().FirstAsync(s => s.Id == sessionId);
        Assert.Equal(_ravi, row.CounselorId);
        Assert.Equal(v + 1, row.Version);
    }

    [Fact]
    public async Task Reassign_StaleVersion_Conflict_NoOwnershipChange()
    {
        var sessionId = await SeedSessionAsync(_amelia);
        var staleVersion = await CurrentVersionAsync(sessionId);

        var session = await _db.CounselingSession.FirstAsync(s => s.Id == sessionId);
        session.AdditionalNotes = "concurrent edit";
        await _db.SaveChangesAsync();

        var result = await _svc.ReassignSessionAsync(
            _tenant, sessionId, _ravi, _amelia, "Peer leave coverage", staleVersion, _admin);

        Assert.False(result.Success);
        Assert.Equal(AssignSessionFailureKind.Conflict, result.FailureKind);
        var row = await _db.CounselingSession.AsNoTracking().FirstAsync(s => s.Id == sessionId);
        Assert.Equal(_amelia, row.CounselorId);
    }

    // ════════════════════════════════════════════════════════════════════
    // M18 — AddCommLogAsync: success bumps Session Version; stale throws and
    // leaves ContactAttemptCount / the log table completely untouched.
    // ════════════════════════════════════════════════════════════════════

    [Fact]
    public async Task AddCommLog_CurrentVersion_Succeeds_BumpsSessionVersion_AndContactCount()
    {
        var sessionId = await SeedSessionAsync(_amelia, sessionStatus: "InProgress", queueStatus: "InProgress");
        var v = await CurrentVersionAsync(sessionId);

        var dto = await _commSvc.AddCommLogAsync(sessionId, new CreateCommLogRequest
        {
            Version = v,
            Channel = "Phone",
            Direction = "Outbound",
            Outcome = "Answered",
        }, _tenant, _amelia);

        Assert.Equal(v + 1, dto.SessionVersion);
        var row = await _db.CounselingSession.AsNoTracking().FirstAsync(s => s.Id == sessionId);
        Assert.Equal(v + 1, row.Version);
        Assert.Equal(1, row.ContactAttemptCount);
        Assert.Equal(1, _db.CounselorCommunicationLogs.Count(l => l.SessionId == sessionId));
    }

    [Fact]
    public async Task AddCommLog_StaleVersion_Throws_NoLogRow_NoContactCountBump()
    {
        var sessionId = await SeedSessionAsync(_amelia, sessionStatus: "InProgress", queueStatus: "InProgress");
        var staleVersion = await CurrentVersionAsync(sessionId);

        // Unrelated concurrent write bumps the version before this caller submits.
        var session = await _db.CounselingSession.FirstAsync(s => s.Id == sessionId);
        session.AdditionalNotes = "concurrent edit";
        await _db.SaveChangesAsync();

        var ex = await Assert.ThrowsAsync<InvalidOperationException>(() =>
            _commSvc.AddCommLogAsync(sessionId, new CreateCommLogRequest
            {
                Version = staleVersion,
                Channel = "Phone",
                Direction = "Outbound",
                Outcome = "Answered",
            }, _tenant, _amelia));

        Assert.Equal(SessionConcurrency.StaleMessage, ex.Message);
        Assert.Equal(0, _db.CounselorCommunicationLogs.Count(l => l.SessionId == sessionId));
        var row = await _db.CounselingSession.AsNoTracking().FirstAsync(s => s.Id == sessionId);
        Assert.Equal(0, row.ContactAttemptCount);
    }

    [Fact]
    public async Task AddCommLog_MissingVersion_Throws_ArgumentException()
    {
        var sessionId = await SeedSessionAsync(_amelia, sessionStatus: "InProgress", queueStatus: "InProgress");

        await Assert.ThrowsAsync<ArgumentException>(() =>
            _commSvc.AddCommLogAsync(sessionId, new CreateCommLogRequest
            {
                Version = null,
                Channel = "Phone",
                Direction = "Outbound",
                Outcome = "Answered",
            }, _tenant, _amelia));

        Assert.Equal(0, _db.CounselorCommunicationLogs.Count(l => l.SessionId == sessionId));
    }

    // ════════════════════════════════════════════════════════════════════
    // M19 — ApplyCcmsCallbackAsync: approved Class A system writer. No
    // client-supplied Version. Success still bumps Version like any other
    // tracked mutation; a genuine concurrent-write race is surfaced as
    // SessionConcurrency (mapped to 409 by InternalCcmsCallbackController)
    // and must not clobber the other writer's data.
    // ════════════════════════════════════════════════════════════════════

    [Fact]
    public async Task ApplyCcmsCallback_Success_BumpsVersion_MergesPackageAddons()
    {
        var sessionId = await SeedSessionAsync(_amelia);
        var v = await CurrentVersionAsync(sessionId);
        var caseId = Guid.NewGuid();

        var ok = await _svc.ApplyCcmsCallbackAsync(sessionId, _tenant, caseId, "CASE-001", "Created");

        Assert.True(ok);
        var row = await _db.CounselingSession.AsNoTracking().FirstAsync(s => s.Id == sessionId);
        Assert.Equal(v + 1, row.Version);
        Assert.Contains("CASE-001", row.PackageAddonsJson);
        Assert.Contains(caseId.ToString(), row.PackageAddonsJson);
    }

    [Fact]
    public async Task ApplyCcmsCallback_NotFound_ReturnsFalse_NoException()
    {
        var ok = await _svc.ApplyCcmsCallbackAsync(Guid.NewGuid(), _tenant, Guid.NewGuid(), "CASE-002", "Created");
        Assert.False(ok);
    }

    [Fact]
    public async Task ApplyCcmsCallback_ConcurrentStaleWrite_ThrowsSessionConcurrency_PreservesOtherWritersData()
    {
        var sessionId = await SeedSessionAsync(_amelia, packageAddonsJson: null);

        // Pre-load the row into _svc's own DbContext (_db) so its change tracker captures the
        // ORIGINAL (pre-race) Version as the identity-mapped instance. Because ApplyCcmsCallbackAsync
        // queries via the same _context, EF's identity map returns this same tracked instance instead
        // of re-querying — reproducing a genuine "loaded, then someone else wrote, then I write" race.
        var trackedInWorkflowContext = await _db.CounselingSession.FirstAsync(s => s.Id == sessionId);

        // A second, independent context on the SAME backing store simulates another process/request
        // winning the race: it writes and commits first, bumping the row's Version in the database.
        using var otherWriterContext = TestDbContextFactory.CreateInMemoryNamed(_dbName);
        var otherWriterRow = await otherWriterContext.CounselingSession.FirstAsync(s => s.Id == sessionId);
        otherWriterRow.PackageAddonsJson = "{\"otherWriterField\":\"must-survive\"}";
        await otherWriterContext.SaveChangesAsync();

        // ApplyCcmsCallbackAsync now runs against the stale tracked instance in _db: it will build its
        // merge from the stale (null) PackageAddonsJson and attempt to persist against an OriginalValue
        // Version the database no longer has.
        var ex = await Assert.ThrowsAsync<InvalidOperationException>(() =>
            _svc.ApplyCcmsCallbackAsync(sessionId, _tenant, Guid.NewGuid(), "CASE-003", "Created"));

        Assert.True(SessionConcurrency.IsStale(ex));
        Assert.Equal(SessionConcurrency.StaleMessage, ex.Message);

        // The other writer's committed data must survive the failed/rolled-back race.
        using var verifyContext = TestDbContextFactory.CreateInMemoryNamed(_dbName);
        var finalRow = await verifyContext.CounselingSession.AsNoTracking().FirstAsync(s => s.Id == sessionId);
        Assert.Equal("{\"otherWriterField\":\"must-survive\"}", finalRow.PackageAddonsJson);
        Assert.DoesNotContain("CASE-003", finalRow.PackageAddonsJson ?? string.Empty);
    }

    // ════════════════════════════════════════════════════════════════════
    // Missing expected Version — fail closed (400 BadRequest), distinct
    // from a stale-but-present Version (409 Conflict).
    // ════════════════════════════════════════════════════════════════════

    [Fact]
    public async Task Assign_MissingVersion_ReturnsBadRequest()
    {
        var sessionId = await SeedSessionAsync(ownerId: null);

        var result = await _svc.AssignSessionAsync(_tenant, sessionId, _ravi, expectedVersion: null, _admin);

        Assert.False(result.Success);
        Assert.Equal(AssignSessionFailureKind.BadRequest, result.FailureKind);
        var row = await _db.CounselingSession.AsNoTracking().FirstAsync(s => s.Id == sessionId);
        Assert.Null(row.CounselorId);
    }

    [Fact]
    public async Task StartSession_MissingVersion_ReturnsBadRequest()
    {
        var sessionId = await SeedSessionAsync(_amelia);

        var result = await _svc.StartSessionAsync(_tenant, sessionId, _amelia, expectedVersion: null);

        Assert.False(result.Success);
        Assert.Equal(SessionOperationFailureKind.BadRequest, result.FailureKind);
        var row = await _db.CounselingSession.AsNoTracking().FirstAsync(s => s.Id == sessionId);
        Assert.Equal("Scheduled", row.Status);
    }

    [Fact]
    public async Task UpdateSession_MissingVersion_ReturnsBadRequest()
    {
        var sessionId = await SeedSessionAsync(_amelia, sessionStatus: "InProgress", queueStatus: "InProgress");

        var result = await _svc.UpdateSessionAsync(_tenant, sessionId, new UpdateCounselingSessionRequest
        {
            Version = null,
            ClinicalSummary = "should not apply",
        }, _amelia);

        Assert.False(result.Success);
        Assert.Equal(SessionOperationFailureKind.BadRequest, result.FailureKind);
        var row = await _db.CounselingSession.AsNoTracking().FirstAsync(s => s.Id == sessionId);
        Assert.Null(row.ClinicalSummary);
    }

    // ════════════════════════════════════════════════════════════════════
    // 403 (ownership ACL) vs 409 (stale Version) — must remain distinct.
    // StartSessionAsync checks ownership BEFORE Version, so a non-owner is
    // Forbidden regardless of Version, and a stale Version from the correct
    // owner is Conflict, never Forbidden.
    // ════════════════════════════════════════════════════════════════════

    [Fact]
    public async Task StartSession_WrongOwner_CorrectVersion_IsForbidden_Not_Conflict()
    {
        var sessionId = await SeedSessionAsync(_amelia);
        var v = await CurrentVersionAsync(sessionId);

        var result = await _svc.StartSessionAsync(_tenant, sessionId, _ravi, v);

        Assert.False(result.Success);
        Assert.Equal(SessionOperationFailureKind.Forbidden, result.FailureKind);
    }

    [Fact]
    public async Task StartSession_CorrectOwner_StaleVersion_IsConflict_Not_Forbidden()
    {
        var sessionId = await SeedSessionAsync(_amelia);
        var staleVersion = await CurrentVersionAsync(sessionId);

        var session = await _db.CounselingSession.FirstAsync(s => s.Id == sessionId);
        session.AdditionalNotes = "concurrent edit";
        await _db.SaveChangesAsync();

        var result = await _svc.StartSessionAsync(_tenant, sessionId, _amelia, staleVersion);

        Assert.False(result.Success);
        Assert.Equal(SessionOperationFailureKind.Conflict, result.FailureKind);
        Assert.Equal(SessionConcurrency.StaleMessage, result.Message);
    }

    [Fact]
    public async Task StartSession_CorrectOwner_CorrectVersion_Succeeds()
    {
        var sessionId = await SeedSessionAsync(_amelia);
        var v = await CurrentVersionAsync(sessionId);

        var result = await _svc.StartSessionAsync(_tenant, sessionId, _amelia, v);

        Assert.True(result.Success);
        var row = await _db.CounselingSession.AsNoTracking().FirstAsync(s => s.Id == sessionId);
        Assert.Equal("InProgress", row.Status);
        Assert.Equal(v + 1, row.Version);
    }
}
