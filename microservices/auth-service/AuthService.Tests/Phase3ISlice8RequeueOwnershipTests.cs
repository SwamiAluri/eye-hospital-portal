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
/// Phase 3I Slice 8 — ReQueue clears ownership (A → NULL), Version CAS,
/// single active Waiting, OwnershipRequeued dual trail.
/// </summary>
public class Phase3ISlice8RequeueOwnershipTests : IDisposable
{
    private readonly AppDbContext _db;
    private readonly CounselingWorkflowService _svc;
    private readonly Mock<IAuditService> _audit = new();
    private readonly IFollowupBranchAccessService _branchAccess;

    private readonly Guid _tenant = Guid.Parse("aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa");
    private readonly Guid _branchA = Guid.Parse("11111111-1111-1111-1111-111111111111");
    private readonly Guid _branchB = Guid.Parse("22222222-2222-2222-2222-222222222222");
    private readonly Guid _amelia = Guid.Parse("c0000001-0000-0000-0000-000000000001");
    private readonly Guid _ravi = Guid.Parse("c0000002-0000-0000-0000-000000000002");
    private readonly Guid _otherBranchCounsellor = Guid.Parse("c0000003-0000-0000-0000-000000000003");
    private readonly Guid _admin = Guid.Parse("a0000001-0000-0000-0000-000000000001");
    private readonly Guid _patient = Guid.Parse("f1000001-0000-0000-0000-000000000001");

    private const string DefaultReason = "Patient requested callback next week";

    public Phase3ISlice8RequeueOwnershipTests()
    {
        _db = TestDbContextFactory.CreateInMemory();
        _branchAccess = new FollowupBranchAccessService(_db);
        _svc = CreateWorkflowService(_db, _branchAccess, _audit.Object);
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
        void AddCounsellor(Guid id, Guid tenant, Guid branch, string first, string last)
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
                UserType = "Counsellor",
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
        AddCounsellor(_otherBranchCounsellor, _tenant, _branchB, "Other", "Branch");

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
            MedicalRecordNumber = "MRN-S8",
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
        string queueStatus = "Completed",
        string sessionStatus = "Completed",
        int version = 1)
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
            Version = version,
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
            TokenNumber = $"S8-{sessionId.ToString()[..8]}",
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

    private int HistoryCount(Guid sessionId, string changeType) =>
        _db.CounselingSessionAuditLog.Count(h =>
            h.SessionId == sessionId && h.ChangeType == changeType);

    private int ActiveWaitingCount(Guid sessionId) =>
        _db.CounselorQueue.Count(q =>
            q.SessionId == sessionId
            && q.DeletedAt == null
            && q.Status == "Waiting");

    private Task<ReQueueSessionResult> ReQueueAsync(
        Guid sessionId,
        Guid? expectedCounselorId,
        Guid actor,
        string reason = DefaultReason,
        int? expectedVersion = 1,
        string? newIntention = null,
        string? notes = null,
        string? sessionType = null) =>
        _svc.ReQueueSessionAsync(
            _tenant,
            sessionId,
            expectedVersion,
            expectedCounselorId,
            reason,
            newIntention,
            notes,
            sessionType,
            actor);

    [Fact]
    public async Task Requeue_Owned_ClearsCounselorId_ToNull()
    {
        var sessionId = await SeedSessionAsync(_amelia);

        var result = await ReQueueAsync(sessionId, _amelia, _admin);

        Assert.True(result.Success);
        Assert.Null(result.CounselorId);
        var row = await _db.CounselingSession.AsNoTracking().FirstAsync(s => s.Id == sessionId);
        Assert.Null(row.CounselorId);
        Assert.Equal("Completed", row.Status);
    }

    [Fact]
    public async Task Requeue_CorrectExpectedOwnerAndVersion_Succeeds_IncrementsVersionOnce()
    {
        var sessionId = await SeedSessionAsync(_amelia, version: 3);

        var result = await ReQueueAsync(sessionId, _amelia, _admin, expectedVersion: 3);

        Assert.True(result.Success);
        Assert.Equal(4, result.Version);
        var row = await _db.CounselingSession.AsNoTracking().FirstAsync(s => s.Id == sessionId);
        Assert.Equal(4, row.Version);
    }

    [Fact]
    public async Task Requeue_Response_ReturnsNewVersion()
    {
        var sessionId = await SeedSessionAsync(_amelia, version: 1);

        var result = await ReQueueAsync(sessionId, _amelia, _admin);

        Assert.True(result.Success);
        Assert.Equal(2, result.Version);
        Assert.False(string.IsNullOrWhiteSpace(result.TokenNumber));
        Assert.NotNull(result.QueueItemId);
    }

    [Fact]
    public async Task Requeue_WrongExpectedCounselorId_Conflict_NoMutation()
    {
        var sessionId = await SeedSessionAsync(_amelia);
        var priorWaiting = ActiveWaitingCount(sessionId);

        var result = await ReQueueAsync(sessionId, _ravi, _admin);

        Assert.False(result.Success);
        Assert.Equal(AssignSessionFailureKind.Conflict, result.FailureKind);
        var row = await _db.CounselingSession.AsNoTracking().FirstAsync(s => s.Id == sessionId);
        Assert.Equal(_amelia, row.CounselorId);
        Assert.Equal(1, row.Version);
        Assert.Equal(0, HistoryCount(sessionId, "OwnershipRequeued"));
        Assert.Equal(priorWaiting, ActiveWaitingCount(sessionId));
        _audit.Verify(a => a.StageAsync(
            It.IsAny<Guid>(),
            "OwnershipRequeued",
            It.IsAny<string>(),
            It.IsAny<Guid>(),
            It.IsAny<string?>(),
            It.IsAny<string?>(),
            It.IsAny<string?>()), Times.Never);
    }

    [Fact]
    public async Task Requeue_StaleVersion_Conflict_NoMutation()
    {
        var sessionId = await SeedSessionAsync(_amelia, version: 2);

        var result = await ReQueueAsync(sessionId, _amelia, _admin, expectedVersion: 1);

        Assert.False(result.Success);
        Assert.Equal(AssignSessionFailureKind.Conflict, result.FailureKind);
        Assert.Equal(SessionConcurrency.StaleMessage, result.Message);
        var row = await _db.CounselingSession.AsNoTracking().FirstAsync(s => s.Id == sessionId);
        Assert.Equal(_amelia, row.CounselorId);
        Assert.Equal(2, row.Version);
        Assert.Equal(0, HistoryCount(sessionId, "OwnershipRequeued"));
        _audit.Verify(a => a.StageAsync(
            It.IsAny<Guid>(),
            "OwnershipRequeued",
            It.IsAny<string>(),
            It.IsAny<Guid>(),
            It.IsAny<string?>(),
            It.IsAny<string?>(),
            It.IsAny<string?>()), Times.Never);
    }

    [Fact]
    public async Task Requeue_AlreadyUnassigned_NoOwnershipRequeued_DoesNotInventOwner()
    {
        var sessionId = await SeedSessionAsync(null);

        var result = await ReQueueAsync(sessionId, null, _admin);

        Assert.True(result.Success);
        Assert.Null(result.CounselorId);
        var row = await _db.CounselingSession.AsNoTracking().FirstAsync(s => s.Id == sessionId);
        Assert.Null(row.CounselorId);
        Assert.Equal(0, HistoryCount(sessionId, "OwnershipRequeued"));
        _audit.Verify(a => a.StageAsync(
            It.IsAny<Guid>(),
            "OwnershipRequeued",
            It.IsAny<string>(),
            It.IsAny<Guid>(),
            It.IsAny<string?>(),
            It.IsAny<string?>(),
            It.IsAny<string?>()), Times.Never);
    }

    [Fact]
    public async Task Requeue_CompletedFollowup_Succeeds()
    {
        var sessionId = await SeedSessionAsync(_amelia, queueStatus: "Completed", sessionStatus: "Completed");

        var result = await ReQueueAsync(sessionId, _amelia, _admin);

        Assert.True(result.Success);
        Assert.Equal(1, ActiveWaitingCount(sessionId));
    }

    [Fact]
    public async Task Requeue_SurgeryDone_Rejected()
    {
        var sessionId = await SeedSessionAsync(_amelia, queueStatus: "Completed");
        _db.OtFinalizeSchedules.Add(new OtFinalizeSchedule
        {
            Id = Guid.NewGuid(),
            TenantId = _tenant,
            BranchId = _branchA,
            PatientId = _patient,
            PatientName = "Pat Ent",
            SurgeryName = "Phaco",
            CounsellingSessionId = sessionId,
            Status = OtFinalizeStatus.SurgeryDone,
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow,
        });
        await _db.SaveChangesAsync();

        var result = await ReQueueAsync(sessionId, _amelia, _admin);

        Assert.False(result.Success);
        Assert.Equal(AssignSessionFailureKind.BadRequest, result.FailureKind);
        Assert.Contains("SurgeryDone", result.Message);
        var row = await _db.CounselingSession.AsNoTracking().FirstAsync(s => s.Id == sessionId);
        Assert.Equal(_amelia, row.CounselorId);
        Assert.Equal(0, HistoryCount(sessionId, "OwnershipRequeued"));
    }

    [Fact]
    public async Task Requeue_AuthorizedBranch_Succeeds()
    {
        var sessionId = await SeedSessionAsync(_amelia);

        var result = await ReQueueAsync(sessionId, _amelia, _admin);

        Assert.True(result.Success);
    }

    [Fact]
    public async Task Requeue_CrossBranchActor_Forbidden()
    {
        var sessionId = await SeedSessionAsync(_amelia);

        var result = await ReQueueAsync(sessionId, _amelia, _otherBranchCounsellor);

        Assert.False(result.Success);
        Assert.Equal(AssignSessionFailureKind.Forbidden, result.FailureKind);
        var row = await _db.CounselingSession.AsNoTracking().FirstAsync(s => s.Id == sessionId);
        Assert.Equal(_amelia, row.CounselorId);
        Assert.Equal(0, HistoryCount(sessionId, "OwnershipRequeued"));
    }

    [Fact]
    public async Task Requeue_BlankReason_Rejected()
    {
        var sessionId = await SeedSessionAsync(_amelia);

        var result = await ReQueueAsync(sessionId, _amelia, _admin, reason: "   ");

        Assert.False(result.Success);
        Assert.Equal(AssignSessionFailureKind.BadRequest, result.FailureKind);
        Assert.Contains("Reason", result.Message);
        Assert.Equal(0, HistoryCount(sessionId, "OwnershipRequeued"));
    }

    [Fact]
    public async Task Requeue_MissingVersion_Rejected()
    {
        var sessionId = await SeedSessionAsync(_amelia);

        var result = await ReQueueAsync(sessionId, _amelia, _admin, expectedVersion: null);

        Assert.False(result.Success);
        Assert.Equal(AssignSessionFailureKind.BadRequest, result.FailureKind);
        Assert.Contains("Version", result.Message);
    }

    [Fact]
    public async Task Requeue_Owned_CreatesOwnershipRequeued_HistoryAndAudit_WithReason()
    {
        var sessionId = await SeedSessionAsync(_amelia);

        var result = await ReQueueAsync(sessionId, _amelia, _admin, reason: DefaultReason);

        Assert.True(result.Success);
        Assert.Equal(1, HistoryCount(sessionId, "OwnershipRequeued"));
        var hist = _db.CounselingSessionAuditLog.Single(h =>
            h.SessionId == sessionId && h.ChangeType == "OwnershipRequeued");
        Assert.Equal(_admin, hist.ChangedByUserId);
        Assert.Equal(_amelia.ToString(), hist.OldValue);
        Assert.Null(hist.NewValue);
        Assert.Equal(DefaultReason, hist.Reason);

        _audit.Verify(a => a.StageAsync(
            _admin,
            "OwnershipRequeued",
            "CounselingSession",
            sessionId,
            It.Is<string?>(d =>
                d != null
                && d.Contains(_amelia.ToString())
                && d.Contains("Requeue")
                && d.Contains(DefaultReason)),
            _amelia.ToString(),
            null), Times.Once);
    }

    [Fact]
    public async Task Requeue_AuditFailure_RollsBack_NoPartialState()
    {
        var sessionId = await SeedSessionAsync(_amelia);
        _audit.Setup(a => a.StageAsync(
            It.IsAny<Guid>(),
            It.IsAny<string>(),
            It.IsAny<string>(),
            It.IsAny<Guid>(),
            It.IsAny<string?>(),
            It.IsAny<string?>(),
            It.IsAny<string?>()))
            .ThrowsAsync(new InvalidOperationException("audit down"));

        var result = await ReQueueAsync(sessionId, _amelia, _admin);

        Assert.False(result.Success);
        var row = await _db.CounselingSession.AsNoTracking().FirstAsync(s => s.Id == sessionId);
        Assert.Equal(_amelia, row.CounselorId);
        Assert.Equal(1, row.Version);
        Assert.Equal(0, HistoryCount(sessionId, "OwnershipRequeued"));
        Assert.Equal(0, ActiveWaitingCount(sessionId));
    }

    [Fact]
    public async Task Requeue_CreatesExactlyOneActiveWaiting()
    {
        var sessionId = await SeedSessionAsync(_amelia, queueStatus: "Completed");

        var result = await ReQueueAsync(sessionId, _amelia, _admin);

        Assert.True(result.Success);
        Assert.Equal(1, ActiveWaitingCount(sessionId));
        var waiting = await _db.CounselorQueue.AsNoTracking()
            .SingleAsync(q => q.SessionId == sessionId && q.DeletedAt == null && q.Status == "Waiting");
        Assert.Equal(_branchA, waiting.BranchId);
        Assert.Equal(sessionId, waiting.SessionId);
        Assert.Equal("RepeatCounselling", waiting.QueueType);
    }

    [Fact]
    public async Task Requeue_Repeated_DoesNotDuplicateActiveWaiting()
    {
        var sessionId = await SeedSessionAsync(_amelia, queueStatus: "Completed");

        Assert.True((await ReQueueAsync(sessionId, _amelia, _admin)).Success);
        var version = (await _db.CounselingSession.AsNoTracking().FirstAsync(s => s.Id == sessionId)).Version;

        Assert.True((await ReQueueAsync(sessionId, null, _admin, expectedVersion: version)).Success);

        Assert.Equal(1, ActiveWaitingCount(sessionId));
        Assert.Equal(1, HistoryCount(sessionId, "OwnershipRequeued"));
    }

    [Fact]
    public async Task Requeue_HistoricalCompletedRow_SoftDeleted_RemainsAuditable()
    {
        var sessionId = await SeedSessionAsync(_amelia, queueStatus: "Completed");
        var priorId = (await _db.CounselorQueue.AsNoTracking()
            .SingleAsync(q => q.SessionId == sessionId)).Id;

        Assert.True((await ReQueueAsync(sessionId, _amelia, _admin)).Success);

        var prior = await _db.CounselorQueue.AsNoTracking().SingleAsync(q => q.Id == priorId);
        Assert.NotNull(prior.DeletedAt);
        Assert.Equal("Completed", prior.Status);
        Assert.Equal(1, ActiveWaitingCount(sessionId));
        Assert.Equal(0, _db.CounselorQueue.Count(q =>
            q.SessionId == sessionId && q.DeletedAt == null && q.Status == "Completed"));
    }

    [Fact]
    public async Task Requeue_PreservesIntentionSessionTypeNotes()
    {
        var sessionId = await SeedSessionAsync(_amelia);

        var result = await ReQueueAsync(
            sessionId,
            _amelia,
            _admin,
            newIntention: "WillingWeek",
            notes: "Call Monday",
            sessionType: "FOLLOW_UP");

        Assert.True(result.Success);
        var row = await _db.CounselingSession.AsNoTracking().FirstAsync(s => s.Id == sessionId);
        Assert.Equal("WillingWeek", row.PatientIntention);
        // Postgres CHECK counseling_sessions_session_type_check — master FOLLOW_UP → DB Followup.
        Assert.Equal("Followup", row.SessionType);
        Assert.DoesNotContain("FOLLOW_UP", row.SessionType);
        Assert.Contains("Call Monday", row.AdditionalNotes);
        Assert.Contains("[Re-queue", row.AdditionalNotes);
    }

    [Fact]
    public async Task Requeue_SessionType_FollowupPassthrough_PersistsFollowup()
    {
        var sessionId = await SeedSessionAsync(_amelia);

        var result = await ReQueueAsync(sessionId, _amelia, _admin, sessionType: "Followup");

        Assert.True(result.Success);
        var row = await _db.CounselingSession.AsNoTracking().FirstAsync(s => s.Id == sessionId);
        Assert.Equal("Followup", row.SessionType);
    }

    [Theory]
    [InlineData("Initial", "Initial")]
    [InlineData("Recheck", "Recheck")]
    [InlineData("Urgent", "Urgent")]
    public async Task Requeue_SessionType_ValidDbValues_Preserved(string input, string expected)
    {
        var sessionId = await SeedSessionAsync(_amelia);

        var result = await ReQueueAsync(sessionId, _amelia, _admin, sessionType: input);

        Assert.True(result.Success);
        var row = await _db.CounselingSession.AsNoTracking().FirstAsync(s => s.Id == sessionId);
        Assert.Equal(expected, row.SessionType);
    }

    [Fact]
    public async Task Requeue_SessionType_Unknown_ReturnsBadRequest_DoesNotMutate()
    {
        var sessionId = await SeedSessionAsync(_amelia, version: 1);

        var result = await ReQueueAsync(
            sessionId,
            _amelia,
            _admin,
            sessionType: "TotallyInvalid");

        Assert.False(result.Success);
        Assert.Equal(AssignSessionFailureKind.BadRequest, result.FailureKind);
        Assert.Contains("session type", result.Message, StringComparison.OrdinalIgnoreCase);

        var row = await _db.CounselingSession.AsNoTracking().FirstAsync(s => s.Id == sessionId);
        Assert.Equal(_amelia, row.CounselorId);
        Assert.Equal(1, row.Version);
        Assert.Equal("Initial", row.SessionType);
    }

    [Fact]
    public async Task Requeue_Unassigned_WithFollowUpMasterCode_ClearsNothingAndPersistsFollowup()
    {
        var sessionId = await SeedSessionAsync(null);

        var result = await ReQueueAsync(sessionId, null, _admin, sessionType: "FOLLOW_UP");

        Assert.True(result.Success);
        Assert.Null(result.CounselorId);
        var row = await _db.CounselingSession.AsNoTracking().FirstAsync(s => s.Id == sessionId);
        Assert.Null(row.CounselorId);
        Assert.Equal("Followup", row.SessionType);
    }

    [Fact]
    public async Task Requeue_NotFound_ReturnsNotFound()
    {
        var result = await ReQueueAsync(Guid.NewGuid(), _amelia, _admin);

        Assert.False(result.Success);
        Assert.Equal(AssignSessionFailureKind.NotFound, result.FailureKind);
    }

    [Fact]
    public async Task Requeue_AlreadyWaiting_ReusesRow_NoDuplicate()
    {
        var sessionId = await SeedSessionAsync(_amelia, queueStatus: "Waiting", sessionStatus: "Scheduled");
        var existingId = (await _db.CounselorQueue.AsNoTracking()
            .SingleAsync(q => q.SessionId == sessionId)).Id;

        var result = await ReQueueAsync(sessionId, _amelia, _admin);

        Assert.True(result.Success);
        Assert.Equal(1, ActiveWaitingCount(sessionId));
        Assert.Equal(existingId, result.QueueItemId);
    }
}
