using System;
using System.Linq;
using System.Threading.Tasks;
using AuthService.Context;
using AuthService.Models.Counselor;
using AuthService.Models.Domain;
using AuthService.Services;
using AuthService.Services.Interfaces;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;
using Moq;
using Xunit;

namespace AuthService.Tests;

/// <summary>
/// Phase 3I Slice 11 — strict CounselorId attribution (PD-S11-03/04/05) + PD15 drill parity.
/// </summary>
public class Phase3ISlice11AnalyticsAttributionTests : IDisposable
{
    private static readonly DateTime FixedUtc = new(2026, 9, 10, 15, 30, 0, DateTimeKind.Utc);

    private readonly AppDbContext _db;
    private readonly CounselingAnalyticsService _analytics;
    private readonly CounselingWorkflowService _sessions;

    private readonly Guid _tenant = Guid.Parse("aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa");
    private readonly Guid _branchA = Guid.Parse("11111111-1111-1111-1111-111111111111");
    private readonly Guid _userA = Guid.Parse("33333333-3333-3333-3333-333333333333");
    private readonly Guid _userB = Guid.Parse("44444444-4444-4444-4444-444444444444");
    private readonly Guid _patient = Guid.Parse("a1000001-0000-0000-0000-000000000001");

    public Phase3ISlice11AnalyticsAttributionTests()
    {
        _db = TestDbContextFactory.CreateInMemory();
        _analytics = new CounselingAnalyticsService(_db);
        _sessions = CreateWorkflowService(_db);

        _db.Patients.Add(new Patient
        {
            Id = _patient,
            TenantId = _tenant,
            FirstName = "Test",
            LastName = "Patient",
            MedicalRecordNumber = "MRN-S11",
            DateOfBirth = new DateTime(1980, 1, 1),
            Gender = "Female",
        });
        _db.SaveChanges();
    }

    public void Dispose() => _db.Dispose();

    private static CounselingWorkflowService CreateWorkflowService(AppDbContext db)
    {
        var logger = new Mock<ILogger<CounselingWorkflowService>>();
        var blob = new Mock<IBlobStorageService>();
        var http = new Mock<System.Net.Http.IHttpClientFactory>();
        var config = new Mock<IConfiguration>();
        config.Setup(c => c["CcmsService:BaseUrl"]).Returns("http://localhost:7075/api");
        config.Setup(c => c["InternalApi:Key"]).Returns(string.Empty);
        var notifier = new Mock<IQueueDisplayNotifier>();
        return new CounselingWorkflowService(
            db, logger.Object, blob.Object, http.Object, config.Object, notifier.Object,
            new FollowupBranchAccessService(db),
            new Mock<IAuditService>().Object);
    }

    private Guid AddSession(
        Guid id,
        Guid? counselorId,
        Guid? createdBy,
        DateTime? sessionDate = null,
        bool pending = false,
        bool? agreed = true)
    {
        _db.CounselingSession.Add(new CounselingSession
        {
            Id = id,
            TenantId = _tenant,
            BranchId = _branchA,
            PatientId = _patient,
            CounselorId = counselorId,
            CreatedByUserId = createdBy,
            ReferredByDoctorId = Guid.NewGuid(),
            SessionDate = sessionDate ?? FixedUtc.Date.AddDays(-2),
            PatientType = "Cash",
            SessionType = "Initial",
            Status = "Completed",
            PatientAgreedToSurgery = agreed,
            PendingDecision = pending,
            DecisionDate = pending ? null : FixedUtc.Date.AddDays(-1),
            RecommendedSurgery = "Phaco",
            CreatedAt = FixedUtc,
        });
        _db.SaveChanges();
        return id;
    }

    private Task<CounselingAnalyticsSummaryDto> SummaryFor(Guid? counselorId) =>
        _analytics.GetSummaryAsync(_tenant, new[] { _branchA }, _branchA, counselorId, 30, null, null, FixedUtc);

    private Task<CounselingAnalyticsTrendsDto> TrendsFor(Guid? counselorId) =>
        _analytics.GetTrendsAsync(_tenant, new[] { _branchA }, _branchA, counselorId, 30, null, null, FixedUtc);

    private Task<CounselingAnalyticsAgingDto> AgingFor(Guid? counselorId) =>
        _analytics.GetFollowupAgingAsync(_tenant, new[] { _branchA }, _branchA, counselorId, 365, null, null, FixedUtc);

    private async Task<SessionListResponse> SessionsFor(Guid? counselorId)
    {
        return await _sessions.GetAllSessionsAsync(new SessionFilters
        {
            TenantId = _tenant,
            AccessibleBranchIds = new[] { _branchA },
            BranchId = _branchA,
            CounselorId = counselorId,
            SessionDateFrom = FixedUtc.Date.AddDays(-30),
            SessionDateTo = FixedUtc.Date,
            PageSize = 50,
        });
    }

    [Fact]
    public async Task OwnedByUser_IncludedInScope()
    {
        var id = Guid.Parse("b1000001-0000-0000-0000-000000000001");
        AddSession(id, _userA, _userA);

        var summary = await SummaryFor(_userA);
        var sessions = await SessionsFor(_userA);

        Assert.Equal(1, summary.TotalSessions);
        Assert.Contains(sessions.Sessions, s => s.Id == id);
    }

    [Fact]
    public async Task NullCounselorId_CreatedByMatch_ExcludedFromScope_IncludedInBranchAggregate()
    {
        var id = Guid.Parse("b1000002-0000-0000-0000-000000000002");
        AddSession(id, counselorId: null, createdBy: _userA);

        Assert.Equal(0, (await SummaryFor(_userA)).TotalSessions);
        Assert.Equal(0, (await TrendsFor(_userA)).Trend.Sum(t => t.Count));
        Assert.DoesNotContain((await SessionsFor(_userA)).Sessions, s => s.Id == id);

        Assert.True((await SummaryFor(null)).TotalSessions >= 1);
        Assert.Contains((await SessionsFor(null)).Sessions, s => s.Id == id);
    }

    [Fact]
    public async Task NullCounselorId_OtherCreator_Excluded()
    {
        var id = Guid.Parse("b1000003-0000-0000-0000-000000000003");
        AddSession(id, counselorId: null, createdBy: _userB);

        Assert.Equal(0, (await SummaryFor(_userA)).TotalSessions);
        Assert.DoesNotContain((await SessionsFor(_userA)).Sessions, s => s.Id == id);
    }

    [Fact]
    public async Task OwnedByOther_CreatedBySelf_Excluded()
    {
        var id = Guid.Parse("b1000004-0000-0000-0000-000000000004");
        AddSession(id, counselorId: _userB, createdBy: _userA);

        Assert.Equal(0, (await SummaryFor(_userA)).TotalSessions);
        Assert.Equal(1, (await SummaryFor(_userB)).TotalSessions);
        Assert.DoesNotContain((await SessionsFor(_userA)).Sessions, s => s.Id == id);
        Assert.Contains((await SessionsFor(_userB)).Sessions, s => s.Id == id);
    }

    [Fact]
    public async Task Pd15Parity_CreatedByOnly_AbsentFromKpisAndDrill()
    {
        var id = Guid.Parse("b1000005-0000-0000-0000-000000000005");
        AddSession(id, counselorId: null, createdBy: _userA, pending: true, agreed: false);

        Assert.Equal(0, (await SummaryFor(_userA)).TotalSessions);
        Assert.Equal(0, (await AgingFor(_userA)).TotalPending);
        Assert.DoesNotContain((await SessionsFor(_userA)).Sessions, s => s.Id == id);
    }

    [Fact]
    public async Task ReQueueClearsOwner_ExitsPreviousOwnerScope_StaysInBranch()
    {
        var id = Guid.Parse("b1000006-0000-0000-0000-000000000006");
        AddSession(id, counselorId: _userA, createdBy: _userA);

        Assert.Equal(1, (await SummaryFor(_userA)).TotalSessions);

        var row = await _db.CounselingSession.FirstAsync(s => s.Id == id);
        row.CounselorId = null; // Slice 8 ReQueue result — do not invoke ReQueue API here
        await _db.SaveChangesAsync();

        Assert.Equal(0, (await SummaryFor(_userA)).TotalSessions);
        Assert.DoesNotContain((await SessionsFor(_userA)).Sessions, s => s.Id == id);
        Assert.Contains((await SessionsFor(null)).Sessions, s => s.Id == id);
    }

    [Fact]
    public async Task Reassigned_AtoB_MovesAttribution()
    {
        var id = Guid.Parse("b1000007-0000-0000-0000-000000000007");
        AddSession(id, counselorId: _userA, createdBy: _userA);

        Assert.Equal(1, (await SummaryFor(_userA)).TotalSessions);

        var row = await _db.CounselingSession.FirstAsync(s => s.Id == id);
        row.CounselorId = _userB;
        await _db.SaveChangesAsync();

        Assert.Equal(0, (await SummaryFor(_userA)).TotalSessions);
        Assert.Equal(1, (await SummaryFor(_userB)).TotalSessions);
        Assert.DoesNotContain((await SessionsFor(_userA)).Sessions, s => s.Id == id);
        Assert.Contains((await SessionsFor(_userB)).Sessions, s => s.Id == id);
    }

    [Fact]
    public async Task CallbackMetrics_UseStrictSessionCounselorId()
    {
        var owned = Guid.Parse("b1000008-0000-0000-0000-000000000008");
        var createdOnly = Guid.Parse("b1000009-0000-0000-0000-000000000009");
        AddSession(owned, _userA, _userA);
        AddSession(createdOnly, null, _userA);

        _db.CounselorCallbackRequests.Add(new CounselorCallbackRequest
        {
            Id = Guid.Parse("c1000001-0000-0000-0000-000000000001"),
            TenantId = _tenant,
            SessionId = owned,
            PatientId = _patient,
            BranchId = _branchA,
            AssignedToUserId = _userA,
            CallbackDate = FixedUtc.Date.AddDays(-1),
            CallbackStatus = "Completed",
            CreatedAt = FixedUtc,
            UpdatedAt = FixedUtc,
            CreatedByUserId = _userA,
            UpdatedByUserId = _userA,
        });
        _db.CounselorCallbackRequests.Add(new CounselorCallbackRequest
        {
            Id = Guid.Parse("c1000002-0000-0000-0000-000000000002"),
            TenantId = _tenant,
            SessionId = createdOnly,
            PatientId = _patient,
            BranchId = _branchA,
            AssignedToUserId = _userA,
            CallbackDate = FixedUtc.Date.AddDays(-1),
            CallbackStatus = "Completed",
            CreatedAt = FixedUtc,
            UpdatedAt = FixedUtc,
            CreatedByUserId = _userA,
            UpdatedByUserId = _userA,
        });
        await _db.SaveChangesAsync();

        var scoped = await SummaryFor(_userA);
        Assert.Equal(1, scoped.CallbackTotal);
        Assert.Equal(1, scoped.CallbackCompleted);

        var branch = await SummaryFor(null);
        Assert.True(branch.CallbackTotal >= 2);
    }
}
